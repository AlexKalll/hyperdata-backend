import dataSource from './data-source';
import { Role } from '../auth/entities/Role.entity';
import { User } from '../auth/entities/User.entity';
import { hashPassword } from '../utils/security/credential.util';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function bootstrapAdmin(): Promise<void> {
  if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'YES') {
    throw new Error(
      'Set ADMIN_BOOTSTRAP_CONFIRM=YES to explicitly authorize the admin bootstrap',
    );
  }

  const email = required('ADMIN_EMAIL').toLowerCase();
  const password = required('ADMIN_PASSWORD');
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  }

  await dataSource.initialize();

  try {
    const roleRepository = dataSource.getRepository(Role);
    const userRepository = dataSource.getRepository(User);
    await roleRepository.upsert(
      [
        { name: 'SuperAdmin', description: 'Super Admin' },
        { name: 'Contributor', description: 'Contributor' },
        { name: 'Facilitator', description: 'Facilitator' },
        { name: 'Reviewer', description: 'Reviewer' },
        { name: 'ProjectManager', description: 'Project Manager' },
      ],
      ['name'],
    );

    const role = await roleRepository.findOne({
      where: { name: 'SuperAdmin' },
    });

    if (!role) {
      throw new Error(
        'SuperAdmin role does not exist. Start the API once so roles can be initialized, or run the approved role seed first.',
      );
    }

    const existingUser = await userRepository.findOne({
      where: { email },
    });
    const hashedPassword = await hashPassword(password);

    if (existingUser) {
      await userRepository.update(existingUser.id, {
        password: hashedPassword,
        role_id: role.id,
        is_active: true,
      });
      console.log(`Updated the SuperAdmin account for ${email}`);
      return;
    }

    await userRepository.save(
      userRepository.create({
        first_name: process.env.ADMIN_FIRST_NAME?.trim() || 'System',
        last_name: process.env.ADMIN_LAST_NAME?.trim() || 'Administrator',
        email,
        password: hashedPassword,
        role_id: role.id,
        is_active: true,
      }),
    );
    console.log(`Created the SuperAdmin account for ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

bootstrapAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
