import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Region } from '../../base_data/entities';
export class Region1744707177917 implements Seeder {
  track = false;

  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Region);
    // id should be uuid
    await repository.upsert(
      [
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d80',
          name: 'Oromia',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d81',
          name: 'Tigray',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d82',
          name: 'Addis Ababa',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d83',
          name: 'Sidama',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d84',
          name: 'Afar',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d85',
          name: 'Somali',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
        {
          id: '92e676cb-517f-4c4a-9546-5d586fc14d86',
          name: 'Central Ethiopia',
          country_id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
        },
      ],
      ['id'],
    );
  }
}
