import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { PaginationService } from 'src/common/service/pagination.service';
import { Transaction } from '../entities/Transaction.entity';
import { Wallet } from '../entities/Wallet.entity';
import SantimpaySdk from './SantimPay.service';
import { TransactionService } from './Transaction.service';
import { WalletService } from './Wallet.service';

describe('WalletService.reserveWithdrawal', () => {
  const createService = () => {
    const walletRepository = {};
    const santimPayService = {};
    const transactionService = {
      create: jest.fn().mockResolvedValue({ id: 'transaction-id' }),
    };
    const paginationService = {};
    const dataSource = {};
    return {
      service: new WalletService(
        walletRepository as any,
        santimPayService as any,
        transactionService as any,
        paginationService as any,
        dataSource as any,
      ),
      transactionService,
    };
  };

  it('rejects negative withdrawal amounts before creating a transaction', async () => {
    const { service, transactionService } = createService();
    const queryRunner = { manager: {} } as any;

    await expect(
      service.reserveWithdrawal(
        'user-id',
        -1,
        '+251911234567',
        'Telebirr',
        queryRunner,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionService.create).not.toHaveBeenCalled();
  });

  it('reserves funds under the wallet transaction lock', async () => {
    const { service, transactionService } = createService();
    const wallet = { balance: 100 };
    const queryRunner = {
      manager: {
        findOne: jest.fn().mockResolvedValue(wallet),
        save: jest.fn().mockResolvedValue(wallet),
      },
    } as any;

    await service.reserveWithdrawal(
      'user-id',
      25,
      '+251911234567',
      'Telebirr',
      queryRunner,
    );

    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(wallet.balance).toBe(75);
    expect(transactionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -25, status: 'Reserved' }),
      queryRunner,
    );
  });
});

describe('WalletService withdrawal lifecycle (mock provider, no database)', () => {
  const createService = (balance = '100.0000') => {
    const wallet = { id: 'wallet-id', user_id: 'user-id', balance };
    let transaction: Transaction | null = null;
    // Return snapshots so stale reconciliation reads cannot mutate persisted state.
    const manager = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === Wallet ? { ...wallet } : transaction && { ...transaction },
      ),
      findOneOrFail: jest.fn(async (entity: unknown) => {
        if (entity === Wallet) return { ...wallet };
        if (!transaction) throw new Error('Transaction not found');
        return { ...transaction };
      }),
      save: jest.fn(async (entity: Wallet | Transaction) => {
        if (entity.id === wallet.id) Object.assign(wallet, entity);
        else transaction = { ...entity } as Transaction;
        return { ...entity };
      }),
    };
    const provider = {
      sendToCustomer: jest.fn().mockResolvedValue({
        transactionId: 'provider-id',
        status: 'pending',
      }),
      checkTransactionStatus: jest
        .fn()
        .mockResolvedValue({ status: 'success' }),
    };
    const transactionService = {
      create: jest.fn(async (data: Partial<Transaction>) => {
        transaction = { id: 'transaction-id', ...data } as Transaction;
        return { ...transaction };
      }),
      findOne: jest.fn(async () => transaction && { ...transaction }),
    };
    const dataSource = {
      transaction: jest.fn(async (run: (value: typeof manager) => unknown) =>
        run(manager),
      ),
    };
    const service = new WalletService(
      {} as Repository<Wallet>,
      provider as unknown as SantimpaySdk,
      transactionService as unknown as TransactionService,
      {} as PaginationService<Wallet>,
      dataSource as unknown as DataSource,
    );
    const reserve = (amount = 25) =>
      service.reserveWithdrawal(
        'user-id',
        amount,
        '+251911234567',
        'Telebirr',
        { manager } as unknown as QueryRunner,
      );
    return { service, reserve, wallet, manager, provider, transactionService };
  };

  afterEach(() => jest.restoreAllMocks());

  it.each([0.29, 1.1, 19.99, 0.01, 100])(
    'accepts a legitimate two-decimal withdrawal of %s',
    async (amount) => {
      const { reserve, wallet } = createService();
      await expect(reserve(amount)).resolves.toMatchObject({
        amount: -amount,
        status: 'Reserved',
      });
      expect(Number(wallet.balance)).toBeCloseTo(100 - amount, 8);
    },
  );

  it.each([0, -1, NaN, Infinity, -Infinity, 0.001, 1.001, 0.2900001])(
    'rejects invalid amount %s without touching persistence or the provider',
    async (amount) => {
      const { reserve, manager, provider, transactionService } =
        createService();
      await expect(reserve(amount)).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.findOne).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(transactionService.create).not.toHaveBeenCalled();
      expect(provider.sendToCustomer).not.toHaveBeenCalled();
    },
  );

  it('rejects insufficient balance without a debit or provider call', async () => {
    const { reserve, wallet, manager, provider, transactionService } =
      createService('24.9999');
    await expect(reserve()).rejects.toThrow('Insufficient Balance');
    expect(wallet.balance).toBe('24.9999');
    expect(manager.save).not.toHaveBeenCalled();
    expect(transactionService.create).not.toHaveBeenCalled();
    expect(provider.sendToCustomer).not.toHaveBeenCalled();
  });

  it('rejects a missing wallet without creating a debit', async () => {
    const { reserve, manager, transactionService, provider } = createService();
    manager.findOne.mockResolvedValueOnce(null);
    await expect(reserve()).rejects.toThrow('Insufficient Balance');
    expect(manager.save).not.toHaveBeenCalled();
    expect(transactionService.create).not.toHaveBeenCalled();
    expect(provider.sendToCustomer).not.toHaveBeenCalled();
  });

  it('reserves, submits once, and settles without a second debit', async () => {
    const { reserve, service, wallet, provider, manager, transactionService } =
      createService();
    const reservation = await reserve();
    expect(provider.sendToCustomer).not.toHaveBeenCalled();
    expect(wallet.balance).toBe(75);
    expect(await service.submitWithdrawal(reservation.id)).toMatchObject({
      status: 'Submitted',
      provider_reference: 'provider-id',
    });
    expect(provider.sendToCustomer).toHaveBeenCalledWith(
      reservation.id,
      25,
      'Withdrawal',
      '+251911234567',
      'Telebirr',
    );
    await expect(service.submitWithdrawal(reservation.id)).rejects.toThrow(
      'Withdrawal cannot be submitted',
    );
    expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
      status: 'Settled',
      amount: -25,
      provider_status: 'success',
    });
    await service.reconcileWithdrawal(reservation.id);
    expect(provider.checkTransactionStatus).toHaveBeenCalledTimes(1);
    expect(provider.checkTransactionStatus).toHaveBeenCalledWith('provider-id');
    expect(provider.sendToCustomer).toHaveBeenCalledTimes(1);
    expect(transactionService.create).toHaveBeenCalledTimes(1);
    expect(wallet.balance).toBe(75);
    expect(
      manager.save.mock.calls.filter(([row]) => row.id === wallet.id),
    ).toHaveLength(1);
    expect(manager.findOne).toHaveBeenCalledWith(Transaction, {
      where: { id: reservation.id },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it.each(['failed', 'rejected', 'cancelled', 'canceled'])(
    'reverses confirmed %s exactly once, including a stale reconciliation read',
    async (status) => {
      const {
        reserve,
        service,
        wallet,
        provider,
        manager,
        transactionService,
      } = createService();
      const reservation = await reserve();
      const submitted = await service.submitWithdrawal(reservation.id);
      provider.checkTransactionStatus.mockResolvedValue({ status });
      expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
        status: 'Reversed',
        provider_status: status,
      });
      expect(wallet.balance).toBe(100);
      // Simulate a worker that read Submitted before the first reversal committed.
      transactionService.findOne.mockResolvedValueOnce(submitted);
      expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
        status: 'Reversed',
      });
      await service.reconcileWithdrawal(reservation.id);
      expect(provider.checkTransactionStatus).toHaveBeenCalledTimes(2);
      expect(wallet.balance).toBe(100);
      expect(
        manager.save.mock.calls.filter(([row]) => row.id === wallet.id),
      ).toHaveLength(2);
      expect(manager.findOneOrFail).toHaveBeenCalledWith(Transaction, {
        where: { id: reservation.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.findOneOrFail).toHaveBeenCalledWith(Wallet, {
        where: { user_id: 'user-id' },
        lock: { mode: 'pessimistic_write' },
      });
    },
  );

  it('keeps an ambiguous submission reserved and reconciles by the local ID', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { reserve, service, wallet, provider } = createService();
    const reservation = await reserve();
    provider.sendToCustomer.mockRejectedValue(new Error('Connection reset'));
    expect(await service.submitWithdrawal(reservation.id)).toMatchObject({
      status: 'Processing',
    });
    expect(wallet.balance).toBe(75);
    await expect(service.submitWithdrawal(reservation.id)).rejects.toThrow(
      'Withdrawal cannot be submitted',
    );
    provider.checkTransactionStatus.mockRejectedValueOnce(new Error('Timeout'));
    expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
      status: 'Processing',
    });
    expect(wallet.balance).toBe(75);
    expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
      status: 'Settled',
    });
    expect(provider.checkTransactionStatus).toHaveBeenCalledWith(
      reservation.id,
    );
    expect(provider.sendToCustomer).toHaveBeenCalledTimes(1);
    expect(wallet.balance).toBe(75);
  });

  it.each(['pending', 'unknown'])(
    'keeps funds reserved for a nonterminal provider status of %s',
    async (status) => {
      const { reserve, service, wallet, provider } = createService();
      const reservation = await reserve();
      await service.submitWithdrawal(reservation.id);
      provider.checkTransactionStatus.mockResolvedValue({ status });
      expect(await service.reconcileWithdrawal(reservation.id)).toMatchObject({
        status: 'Submitted',
      });
      expect(wallet.balance).toBe(75);
    },
  );
});
