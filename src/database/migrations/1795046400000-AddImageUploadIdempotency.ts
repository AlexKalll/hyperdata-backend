import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUploadIdempotency1795046400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "micro_task" ADD COLUMN "image_upload_id" uuid, ADD COLUMN "image_upload_fingerprint" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_micro_task_image_upload" ON "micro_task" ("task_id", "created_by", "image_upload_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_micro_task_image_upload"`);
    await queryRunner.query(
      `ALTER TABLE "micro_task" DROP COLUMN "image_upload_fingerprint", DROP COLUMN "image_upload_id"`,
    );
  }
}
