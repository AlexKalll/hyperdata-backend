import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultCountries1790298000000 implements MigrationInterface {
  name = 'SeedDefaultCountries1790298000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "setting"."country"
        ("id", "name", "code", "continent")
      VALUES
        ('460e2d8b-bd31-42f6-9195-301bb7677156', 'Nigeria', 'NGA', 'Africa'),
        ('732b9995-9d90-49b7-86d0-411a4905fa91', 'Ghana', 'GHA', 'Africa'),
        ('2dc902b4-5aef-4ecd-b1e2-ad25bf0f8ada', 'Tanzania', 'TZA', 'Africa'),
        ('61bd7c1b-c389-4497-ac85-cd74ef753805', 'Kenya', 'KEN', 'Africa'),
        ('e42b4521-a2ae-45f0-9d02-9f81d4018a8e', 'Uganda', 'UGA', 'Africa'),
        ('911f08f2-4ed4-4a43-819a-0e83b1aa102d', 'Ethiopia', 'ETH', 'Africa')
      ON CONFLICT ("name") DO UPDATE SET
        "code" = EXCLUDED."code",
        "continent" = EXCLUDED."continent",
        "deletedAt" = NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep reference rows on rollback because projects and user profiles may use them.
    await queryRunner.query(`SELECT 1`);
  }
}
