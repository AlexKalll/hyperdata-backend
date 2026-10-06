import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { RejectionType } from '../../base_data/entities';
export class RejectionType1744707251494 implements Seeder {
  track = false;

  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(RejectionType);
    await repository.upsert(
      [
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d70',
          name: 'Not Qualified',
          description: 'Not Qualified',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d71',
          name: 'Not Sufficient',
          description: 'Not Sufficient',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d72',
          name: 'Low Audio Quality',
          description: 'Not Applicable',
        },
      ],
      ['id'],
    );
  }
}
