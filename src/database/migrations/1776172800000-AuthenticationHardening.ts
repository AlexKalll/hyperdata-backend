import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthenticationHardening1776172800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "revoked_at" TIMESTAMP, "created_date" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_refresh_session_token_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_refresh_session" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_session" ADD CONSTRAINT "FK_refresh_session_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_verification_codes" ADD "attempt_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "user_verification_codes" SET "status" = 'expired' WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_session_expires_at" ON "refresh_session" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_verification_pending_username" ON "user_verification_codes" ("username") WHERE "status" = 'pending'`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_user_verification_pending_username"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_verification_codes" DROP COLUMN "attempt_count"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_session"`);
  }
}
