import { DataSource, Repository } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import bcrypt from 'bcrypt';
import {
  Country,
  Dialect,
  Language,
  Region,
  Zone,
} from '../../base_data/entities';
import { Role } from '../../auth/entities/Role.entity';
import { User } from '../../auth/entities/User.entity';
import { UserScore } from '../../auth/entities/UserScore.entity';
import { Wallet } from '../../finance/entities/Wallet.entity';

const DEMO_PASSWORD = '12345678';
const AMHARIC_LANGUAGE = { name: 'Amharic', code: 'am' };
const AMHARIC_DIALECT = 'Addis Ababa Amharic';
const ETHIOPIA = { name: 'Ethiopia', code: 'ETH', continent: 'Africa' };
const ADDIS_ABABA = 'Addis Ababa';
const BOLE = 'Bole';

type DemoUserDefinition = {
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone_number: string;
  national_id: string;
  role: string;
  birth_date: string;
  gender: 'Male' | 'Female';
};

export const DEMO_USERS: DemoUserDefinition[] = [
  {
    email: 'super@gmail.com',
    first_name: 'SuperAdmin',
    middle_name: 'Demo',
    last_name: 'One',
    phone_number: '+251911000001',
    national_id: 'E2E-SUPER-001',
    role: 'SuperAdmin',
    birth_date: '1985-01-15',
    gender: 'Male',
  },
  {
    email: 'super1@gmail.com',
    first_name: 'SuperAdmin',
    middle_name: 'Demo',
    last_name: 'Two',
    phone_number: '+251911000002',
    national_id: 'E2E-SUPER-002',
    role: 'SuperAdmin',
    birth_date: '1986-02-15',
    gender: 'Female',
  },
  {
    email: 'faci@gmail.com',
    first_name: 'Facilitator',
    middle_name: 'Demo',
    last_name: 'One',
    phone_number: '+251911000003',
    national_id: 'E2E-FACI-001',
    role: 'Facilitator',
    birth_date: '1988-03-15',
    gender: 'Male',
  },
  {
    email: 'rev@gmail.com',
    first_name: 'Reviewer',
    middle_name: 'Demo',
    last_name: 'One',
    phone_number: '+251911000004',
    national_id: 'E2E-REVIEWER-001',
    role: 'Reviewer',
    birth_date: '1990-04-15',
    gender: 'Female',
  },
  {
    email: 'rev2@gmail.com',
    first_name: 'Reviewer',
    middle_name: 'Demo',
    last_name: 'Two',
    phone_number: '+251911000005',
    national_id: 'E2E-REVIEWER-002',
    role: 'Reviewer',
    birth_date: '1991-05-15',
    gender: 'Male',
  },
  {
    email: 'cont@gmail.com',
    first_name: 'Contributor',
    middle_name: 'Demo',
    last_name: 'One',
    phone_number: '+251123456789',
    national_id: 'E2E-CONT-001',
    role: 'Contributor',
    birth_date: '1995-06-15',
    gender: 'Male',
  },
  {
    email: 'cont1@gmail.com',
    first_name: 'Contributor',
    middle_name: 'Demo',
    last_name: 'Two',
    phone_number: '+251234567890',
    national_id: 'E2E-CONT-002',
    role: 'Contributor',
    birth_date: '1996-07-15',
    gender: 'Female',
  },
  {
    email: 'proj@gmail.com',
    first_name: 'ProjectManager',
    middle_name: 'Demo',
    last_name: 'One',
    phone_number: '+251911000006',
    national_id: 'E2E-PM-001',
    role: 'ProjectManager',
    birth_date: '1987-08-15',
    gender: 'Male',
  },
  {
    email: 'proj1@gmail.com',
    first_name: 'ProjectManager',
    middle_name: 'Demo',
    last_name: 'Two',
    phone_number: '+251911000007',
    national_id: 'E2E-PM-002',
    role: 'ProjectManager',
    birth_date: '1989-09-15',
    gender: 'Female',
  },
  {
    email: 'faci1@gmail.com',
    first_name: 'Facilitator',
    middle_name: 'Demo',
    last_name: 'Two',
    phone_number: '+251911000008',
    national_id: 'E2E-FACI-002',
    role: 'Facilitator',
    birth_date: '1992-10-15',
    gender: 'Female',
  },
];

async function ensureLanguage(repository: Repository<Language>) {
  let language = await repository.findOne({
    where: { name: AMHARIC_LANGUAGE.name },
    withDeleted: true,
  });
  if (!language) {
    language = await repository.save(repository.create(AMHARIC_LANGUAGE));
  } else {
    if (language.deletedAt) await repository.restore(language.id);
    await repository.update(language.id, AMHARIC_LANGUAGE);
  }
  return (await repository.findOne({ where: { id: language.id } }))!;
}

async function ensureCountry(repository: Repository<Country>) {
  let country = await repository.findOne({
    where: { name: ETHIOPIA.name },
    withDeleted: true,
  });
  if (!country) {
    country = await repository.save(repository.create(ETHIOPIA));
  } else {
    if (country.deletedAt) await repository.restore(country.id);
    await repository.update(country.id, ETHIOPIA);
  }
  return (await repository.findOne({ where: { id: country.id } }))!;
}

async function ensureRegion(
  repository: Repository<Region>,
  country_id: string,
) {
  let region = await repository.findOne({
    where: { name: ADDIS_ABABA },
    withDeleted: true,
  });
  if (!region) {
    region = await repository.save(
      repository.create({ name: ADDIS_ABABA, country_id }),
    );
  } else {
    if (region.deletedAt) await repository.restore(region.id);
    await repository.update(region.id, { country_id });
  }
  return (await repository.findOne({ where: { id: region.id } }))!;
}

async function ensureZone(repository: Repository<Zone>, region_id: string) {
  let zone = await repository.findOne({
    where: { name: BOLE },
    withDeleted: true,
  });
  if (!zone) {
    zone = await repository.save(repository.create({ name: BOLE, region_id }));
  } else {
    if (zone.deletedAt) await repository.restore(zone.id);
    await repository.update(zone.id, { region_id });
  }
  return (await repository.findOne({ where: { id: zone.id } }))!;
}

async function ensureDialect(
  repository: Repository<Dialect>,
  language_id: string,
) {
  let dialect = await repository.findOne({
    where: { name: AMHARIC_DIALECT },
    withDeleted: true,
  });
  if (!dialect) {
    dialect = await repository.save(
      repository.create({
        name: AMHARIC_DIALECT,
        description: 'Demo dialect for Amharic end-to-end tests',
        language_id,
      }),
    );
  } else {
    if (dialect.deletedAt) await repository.restore(dialect.id);
    await repository.update(dialect.id, {
      description: 'Demo dialect for Amharic end-to-end tests',
      language_id,
    });
  }
  return (await repository.findOne({ where: { id: dialect.id } }))!;
}

async function ensureDemoUser(
  repository: Repository<User>,
  definition: DemoUserDefinition,
  role_id: string,
  language_id: string,
  dialect_id: string,
  region_id: string,
  zone_id: string,
  password: string,
) {
  const profile: Partial<User> = {
    first_name: definition.first_name,
    middle_name: definition.middle_name,
    last_name: definition.last_name,
    phone_number: definition.phone_number,
    national_id: definition.national_id,
    password,
    birth_date: new Date(definition.birth_date),
    gender: definition.gender,
    is_active: true,
    role_id,
    language_id,
    dialect_id,
    region_id,
    zone_id,
    city: ADDIS_ABABA,
    woreda: BOLE,
    sectors: ['language-data'],
  };
  const existing = await repository.findOne({
    where: { email: definition.email },
  });
  if (existing) {
    await repository.update(existing.id, profile);
    return {
      user: (await repository.findOne({ where: { id: existing.id } }))!,
      created: false,
    };
  }
  const user = await repository.save(
    repository.create({ ...profile, email: definition.email }),
  );
  return { user, created: true };
}

async function ensureWalletAndScore(dataSource: DataSource, user_id: string) {
  const walletRepository = dataSource.getRepository(Wallet);
  const wallet = await walletRepository.findOne({ where: { user_id } });
  if (!wallet) {
    await walletRepository.save(
      walletRepository.create({ user_id, balance: 0 }),
    );
  }

  const scoreRepository = dataSource.getRepository(UserScore);
  let score = await scoreRepository.findOne({ where: { user_id } });
  if (!score) {
    score = await scoreRepository.save(
      scoreRepository.create({ user_id, score: 0 }),
    );
  }
  // Preserve earned balances and scores when preparing another manual test.
  await dataSource.getRepository(User).update(user_id, { score });
}

export default class TestUsers1744707251495 implements Seeder {
  track = false;

  public async run(dataSource: DataSource): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Demo user seed cannot run in production');
    }

    if (process.env.ENABLE_DEMO_USERS_SEED !== 'true') {
      console.log(
        'Demo users seed is disabled, please set ENABLE_DEMO_USERS_SEED=true in the .env to enable it',
      );
      return;
    }

    const language = await ensureLanguage(dataSource.getRepository(Language));
    const country = await ensureCountry(dataSource.getRepository(Country));
    const region = await ensureRegion(
      dataSource.getRepository(Region),
      country.id,
    );
    const zone = await ensureZone(dataSource.getRepository(Zone), region.id);
    const dialect = await ensureDialect(
      dataSource.getRepository(Dialect),
      language.id,
    );

    const roleRepository = dataSource.getRepository(Role);
    const roles = await roleRepository.find({
      select: { id: true, name: true },
    });
    const roleIds = new Map(roles.map((role) => [role.name, role.id]));
    const userRepository = dataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const seededUsers = new Map<string, User>();
    let createdCount = 0;
    let updatedCount = 0;

    for (const definition of DEMO_USERS) {
      const role_id = roleIds.get(definition.role);
      if (!role_id) throw new Error(`Role ${definition.role} not found`);
      const result = await ensureDemoUser(
        userRepository,
        definition,
        role_id,
        language.id,
        dialect.id,
        region.id,
        zone.id,
        hashedPassword,
      );
      seededUsers.set(definition.email, result.user);
      if (result.created) createdCount++;
      else updatedCount++;

      if (definition.role === 'Contributor' || definition.role === 'Reviewer') {
        await ensureWalletAndScore(dataSource, result.user.id);
      }
    }

    console.log(
      `Demo users seed completed. ${createdCount} users created, ${updatedCount} users updated. ${seededUsers.size} users have complete Amharic profiles.`,
    );
  }
}
