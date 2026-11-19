import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageToText1794355200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Only the small task_type reference table uses this enum. Recreating the
    // type lets the new reference row be inserted in the same transaction.
    await queryRunner.query(
      `ALTER TYPE "public"."task_type_task_type_enum" RENAME TO "task_type_task_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_type_task_type_enum" AS ENUM ('audio-text', 'text-audio', 'text-text', 'image-text')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_type" ALTER COLUMN "task_type" TYPE "public"."task_type_task_type_enum" USING "task_type"::text::"public"."task_type_task_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."task_type_task_type_enum_old"`,
    );
    await queryRunner.query(
      `INSERT INTO "task_type" ("task_type") VALUES ('image-text') ON CONFLICT ("task_type") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tasks = await queryRunner.query(
      `SELECT 1 FROM "task" t JOIN "task_type" tt ON tt.id = t.task_type_id WHERE tt.task_type = 'image-text' LIMIT 1`,
    );
    if (tasks.length)
      throw new Error(
        'Image-to-text tasks exist; rollback would remove their task type',
      );
    await queryRunner.query(
      `DELETE FROM "task_type" WHERE "task_type" = 'image-text'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."task_type_task_type_enum" RENAME TO "task_type_task_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_type_task_type_enum" AS ENUM ('audio-text', 'text-audio', 'text-text')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_type" ALTER COLUMN "task_type" TYPE "public"."task_type_task_type_enum" USING "task_type"::text::"public"."task_type_task_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."task_type_task_type_enum_old"`,
    );
  }
}
