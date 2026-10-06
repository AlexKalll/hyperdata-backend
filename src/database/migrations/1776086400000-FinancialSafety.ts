import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinancialSafety1776086400000 implements MigrationInterface {
  name = 'FinancialSafety1776086400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Reserved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Processing'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Submitted'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Settled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_status_enum" ADD VALUE IF NOT EXISTS 'Reversed'`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "provider_reference" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "provider_status" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "failure_reason" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "UQ_transaction_provider_reference" UNIQUE ("provider_reference")`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "CK_transaction_signed_amount" CHECK (("type" = 'Credit' AND "amount" > 0) OR ("type" = 'Withdraw' AND "amount" < 0)) NOT VALID`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD CONSTRAINT "CK_wallet_non_negative_balance" CHECK ("balance" >= 0) NOT VALID`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_payment" ADD CONSTRAINT "CK_task_payment_non_negative_rates" CHECK ("contributor_credit_per_microtask" >= 0 AND "reviewer_credit_per_microtask" >= 0) NOT VALID`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_payment" DROP CONSTRAINT "CK_task_payment_non_negative_rates"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" DROP CONSTRAINT "CK_wallet_non_negative_balance"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "CK_transaction_signed_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "UQ_transaction_provider_reference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN "failure_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN "provider_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN "provider_reference"`,
    );
  }
}
