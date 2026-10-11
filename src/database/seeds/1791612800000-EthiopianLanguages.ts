import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Language } from '../../base_data/entities/Language.entity';
import { Dialect } from '../../base_data/entities/Dialect.entity';

const languages = [
  {
    name: 'Amharic',
    code: 'am',
    dialects: ['Addis Ababa Amharic'],
  },
  {
    name: 'AfanOromo',
    code: 'om',
    dialects: [
      'Western Oromo (Wellegga)',
      'Eastern Oromo (Harar)',
      'Southern Oromo (Borana)',
    ],
  },
  {
    name: 'Tigrinya',
    code: 'ti',
    dialects: ['Tigray Tigrinya'],
  },
  {
    name: 'Somali',
    code: 'so',
    dialects: ['Ogaden Somali'],
  },
  {
    name: 'Sidama',
    code: 'sid',
    // An honest fallback until admins define a locally appropriate variety.
    dialects: ['General Sidama (unspecified)'],
  },
];

export default class EthiopianLanguages1791612800000 implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    await dataSource.transaction(async (manager) => {
      const languageRepository = manager.getRepository(Language);
      const dialectRepository = manager.getRepository(Dialect);

      for (const definition of languages) {
        let language = await languageRepository.findOne({
          where: [{ name: definition.name }, { code: definition.code }],
          withDeleted: true,
        });
        if (language?.deletedAt) continue;
        if (!language) {
          language = await languageRepository.save(
            languageRepository.create({
              name: definition.name,
              code: definition.code,
            }),
          );
        }

        for (const name of definition.dialects) {
          const existing = await dialectRepository.findOne({
            where: { name },
            withDeleted: true,
          });
          if (existing) {
            if (!existing.deletedAt && existing.language_id !== language.id) {
              throw new Error(`Dialect ${name} belongs to another language`);
            }
            continue;
          }
          await dialectRepository.save(
            dialectRepository.create({ name, language_id: language.id }),
          );
        }
      }
    });
  }
}
