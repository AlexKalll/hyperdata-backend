import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Role } from '../../auth/entities/Role.entity';

export default class Role1744707155039 implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    const repository = dataSource.getRepository(Role);
    await repository.upsert(
      [
        {
          name: 'SuperAdmin',
          description: 'Super Admin',
        },
        {
          name: 'Admin',
          description: 'Admin',
        },
        {
          name: 'Contributor',
          description: 'Contributor',
        },
        {
          name: 'Facilitator',
          description: 'Facilitator',
        },
        {
          name: 'Reviewer',
          description: 'Reviewer',
        },
        {
          name: 'ProjectManager',
          description: 'Project Manager',
        },
      ],
      ['name'],
    );
  }
}
