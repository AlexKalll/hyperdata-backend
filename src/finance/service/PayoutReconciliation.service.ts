import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletService } from './Wallet.service';

@Injectable()
export class PayoutReconciliationService {
  private readonly logger = new Logger(PayoutReconciliationService.name);

  constructor(private readonly walletService: WalletService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileOutstandingPayouts(): Promise<void> {
    try {
      await this.walletService.reconcileOutstandingWithdrawals();
    } catch (error) {
      this.logger.error('Payout reconciliation failed');
    }
  }
}
