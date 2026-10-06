import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Country } from '../../base_data/entities';
export class Country1744707155040 implements Seeder {
  track = false;

  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Country);
    await repository.upsert(
      [
        {
          id: '460e2d8b-bd31-42f6-9195-301bb7677156',
          name: 'Nigeria',
          code: 'NGR',
          continent: 'Africa',
        },
        {
          id: '732b9995-9d90-49b7-86d0-411a4905fa91',
          name: 'Ghana',
          code: 'GHN',
          continent: 'Africa',
        },
        {
          id: '2dc902b4-5aef-4ecd-b1e2-ad25bf0f8ada',
          name: 'Tanzania',
          code: 'TZN',
          continent: 'Africa',
        },
        {
          id: '61bd7c1b-c389-4497-ac85-cd74ef753805',
          name: 'Kenya',
          code: 'KEY',
          continent: 'Africa',
        },
        {
          id: 'e42b4521-a2ae-45f0-9d02-9f81d4018a8e',
          name: 'Uganda',
          code: 'UGD',
          continent: 'Africa',
        },
        {
          id: '911f08f2-4ed4-4a43-819a-0e83b1aa102d',
          name: 'Ethiopia',
          code: 'ETH',
          continent: 'Africa',
        },
      ],
      ['id'],
    );
  }
}
