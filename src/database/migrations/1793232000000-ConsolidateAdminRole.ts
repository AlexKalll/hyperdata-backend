import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateAdminRole1793232000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles: { id: string; name: string }[] = await queryRunner.query(
      `SELECT "id", "name" FROM "role" WHERE "name" IN ('SuperAdmin', 'Admin') FOR UPDATE`,
    );
    const legacyRole = roles.find((role) => role.name === 'SuperAdmin');
    const adminRole = roles.find((role) => role.name === 'Admin');

    // Keep the original role ID so existing assignments remain valid.
    if (!legacyRole) return;

    if (adminRole) {
      await queryRunner.query(
        `INSERT INTO "role_permission" ("role_id", "permission_id")
         SELECT $1, "permission_id" FROM "role_permission" WHERE "role_id" = $2
         ON CONFLICT ("role_id", "permission_id") DO NOTHING`,
        [legacyRole.id, adminRole.id],
      );
      await queryRunner.query(
        'UPDATE "users" SET "role_id" = $1 WHERE "role_id" = $2',
        [legacyRole.id, adminRole.id],
      );
      await queryRunner.query(
        'UPDATE "notification" SET "role_id" = $1 WHERE "role_id" = $2',
        [legacyRole.id, adminRole.id],
      );
      await queryRunner.query(
        'DELETE FROM "role_permission" WHERE "role_id" = $1',
        [adminRole.id],
      );
      await queryRunner.query('DELETE FROM "role" WHERE "id" = $1', [
        adminRole.id,
      ]);
    }

    await queryRunner.query(
      `UPDATE "role" SET "name" = 'Admin',
       "description" = CASE WHEN "description" IN ('Super Admin', 'SuperAdmin Role')
         THEN 'Admin Role' ELSE "description" END
       WHERE "id" = $1`,
      [legacyRole.id],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the legacy name while retaining the consolidated memberships.
    await queryRunner.query(
      `UPDATE "role" SET "name" = 'SuperAdmin',
       "description" = CASE WHEN "description" = 'Admin Role'
         THEN 'SuperAdmin Role' ELSE "description" END
       WHERE "name" = 'Admin'`,
    );
  }
}
