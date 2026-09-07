import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, QueryRunner, Repository } from 'typeorm';
import { Wallet } from '../entities/Wallet.entity';
import { PaginationService } from 'src/common/service/pagination.service';
import { TransactionService } from './Transaction.service';
import { Transaction } from '../entities/Transaction.entity';
import SantimpaySdk from './SantimPay.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly santimPaySerive: SantimpaySdk,
    private readonly transactionService: TransactionService,
    private readonly paginationService: PaginationService<Wallet>,
    private readonly dataSource: DataSource,
  ) {
    this.paginationService = new PaginationService<Wallet>(
      this.walletRepository,
    );
  }

  async findAll(query: FindOptionsWhere<Wallet>): Promise<Wallet[]> {
    return this.walletRepository.find({ where: query });
  }

  async findOne(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) {
      throw new NotFoundException(`Wallet for this user not found`);
    }
    return wallet;
  }
  async findOneOrCreate(
    userId: string,
    queryRunner?: QueryRunner,
  ): Promise<Wallet> {
    if (queryRunner) {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { user_id: userId },
      });
      if (!wallet) {
        const w = queryRunner.manager.create(Wallet, { user_id: userId });
        return queryRunner.manager.save(w);
      }
      return wallet;
    } else {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: userId },
      });
      if (!wallet) {
        const w = this.walletRepository.create({ user_id: userId });
        return this.walletRepository.save(w);
      }
      return wallet;
    }
  }

  async create(wallet: Partial<Wallet>): Promise<Wallet> {
    const w = this.walletRepository.create(wallet);
    return this.walletRepository.save(w);
  }
  async addFunds(
    userId: string,
    amount: number,
    metadata: any,
    queryRunner: QueryRunner,
  ): Promise<Transaction> {
    const transaction = await this.transactionService.create(
      {
        user_id: userId,
        amount: amount,
        type: 'Credit',
        status: 'Done',
        metadata,
      },
      queryRunner,
    );
    let wallet = await queryRunner.manager.findOne(Wallet, {
      where: { user_id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) {
      wallet = queryRunner.manager.create(Wallet, { user_id: userId });
      wallet = await queryRunner.manager.save(wallet);
    }
    const newBalance = Number(wallet.balance) + amount;
    await queryRunner.manager.update(
      Wallet,
      { id: wallet.id },
      { balance: newBalance },
    );
    return transaction;
  }
  async reserveWithdrawal(
    userId: string,
    amount: number,
    phoneNumber: string,
    paymentMethod: string,
    queryRunner: QueryRunner,
  ): Promise<Transaction> {
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) / 100 !== amount
    ) {
      throw new BadRequestException(
        'Amount must be a positive value with at most two decimal places',
      );
    }
    const wallet = await queryRunner.manager.findOne(Wallet, {
      where: { user_id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet || Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient Balance');
    }
    const transaction = await this.transactionService.create(
      {
        user_id: userId,
        amount: -amount,
        type: 'Withdraw',
        status: 'Reserved',
        metadata: { phoneNumber, paymentMethod },
      },
      queryRunner,
    );
    wallet.balance = Number(wallet.balance) - amount;
    await queryRunner.manager.save(wallet);
    return transaction;
  }

  async submitWithdrawal(transactionId: string): Promise<Transaction> {
    const transaction = await this.transitionToProcessing(transactionId);
    if (!transaction) {
      throw new BadRequestException('Withdrawal cannot be submitted');
    }

    try {
      const response = await this.santimPaySerive.sendToCustomer(
        transaction.id,
        Math.abs(Number(transaction.amount)),
        'Withdrawal',
        transaction.metadata.phoneNumber,
        transaction.metadata.paymentMethod,
      );
      const providerReference = this.getProviderReference(
        response,
        transaction.id,
      );
      return await this.updatePayoutStatus(
        transaction.id,
        'Submitted',
        this.getProviderStatus(response),
        providerReference,
      );
    } catch (error) {
      // A transport error may occur after the provider has accepted the payout.
      // Keep the reservation and let reconciliation determine the final result.
      this.logger.error(`Unable to submit withdrawal ${transaction.id}`);
      return transaction;
    }
  }

  async reconcileWithdrawal(
    transactionId: string,
  ): Promise<Transaction | null> {
    const transaction = await this.transactionService.findOne(transactionId);
    if (
      !transaction ||
      transaction.type !== 'Withdraw' ||
      !['Processing', 'Submitted'].includes(transaction.status)
    ) {
      return transaction;
    }

    try {
      const response = await this.santimPaySerive.checkTransactionStatus(
        transaction.provider_reference || transaction.id,
      );
      const providerStatus = this.getProviderStatus(response);
      const normalizedStatus = providerStatus.toLowerCase();
      if (
        ['success', 'successful', 'settled', 'completed'].includes(
          normalizedStatus,
        )
      ) {
        return await this.updatePayoutStatus(
          transaction.id,
          'Settled',
          providerStatus,
        );
      }
      if (
        ['failed', 'rejected', 'cancelled', 'canceled'].includes(
          normalizedStatus,
        )
      ) {
        return await this.reverseWithdrawal(transaction.id, providerStatus);
      }
      return transaction;
    } catch (error) {
      this.logger.error(`Unable to reconcile withdrawal ${transaction.id}`);
      return transaction;
    }
  }

  async reconcileOutstandingWithdrawals(): Promise<void> {
    const transactions = await this.transactionService.findPendingPayouts();
    for (const transaction of transactions) {
      await this.reconcileWithdrawal(transaction.id);
    }
  }

  private async transitionToProcessing(
    transactionId: string,
  ): Promise<Transaction | null> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.status !== 'Reserved') {
        return null;
      }
      transaction.status = 'Processing';
      return manager.save(transaction);
    });
  }

  private async updatePayoutStatus(
    transactionId: string,
    status: 'Submitted' | 'Settled',
    providerStatus: string,
    providerReference?: string,
  ): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOneOrFail(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!['Processing', 'Submitted'].includes(transaction.status)) {
        return transaction;
      }
      transaction.status = status;
      transaction.provider_status = providerStatus;
      transaction.provider_reference =
        providerReference || transaction.provider_reference;
      return manager.save(transaction);
    });
  }

  private async reverseWithdrawal(
    transactionId: string,
    providerStatus: string,
  ): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOneOrFail(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!['Processing', 'Submitted'].includes(transaction.status)) {
        return transaction;
      }
      const wallet = await manager.findOneOrFail(Wallet, {
        where: { user_id: transaction.user_id },
        lock: { mode: 'pessimistic_write' },
      });
      wallet.balance =
        Number(wallet.balance) + Math.abs(Number(transaction.amount));
      transaction.status = 'Reversed';
      transaction.provider_status = providerStatus;
      await manager.save(wallet);
      return manager.save(transaction);
    });
  }

  private getProviderReference(response: any, fallback: string): string {
    return (
      response?.transactionId || response?.id || response?.data?.id || fallback
    );
  }

  private getProviderStatus(response: any): string {
    return String(
      response?.status ||
        response?.transactionStatus ||
        response?.data?.status ||
        'submitted',
    );
  }

  async update(id: string, wallet: Partial<Wallet>): Promise<Wallet> {
    const existingWallet = await this.walletRepository.preload({
      id,
      ...wallet,
    });
    if (!existingWallet) {
      throw new NotFoundException(`Wallet with id ${id} not found`);
    }
    return this.walletRepository.save(existingWallet);
  }

  async remove(id: string) {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException(`Wallet with id ${id} not found`);
    }
    await this.walletRepository.remove(wallet);
  }
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) {
      throw new NotFoundException(`Wallet for this user not found`);
    }
    return wallet.balance;
  }
}
