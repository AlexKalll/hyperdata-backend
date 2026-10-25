import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalInvitationExpiry1792281600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "invitation_link" ALTER COLUMN "expiry_date" DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "invitation_link" ALTER COLUMN "expiry_date" SET NOT NULL',
    );
  }
}
