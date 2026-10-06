import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeederOptions } from 'typeorm-extension';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
const configService = new ConfigService();
ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true });
const schema = configService.get<string>('DATABASE_SCHEMA');
export const dataSourceOptions: PostgresConnectionOptions & SeederOptions = {
  type: 'postgres',
  url: configService.get<string>('DATABASE_URL'), // Use ConfigService process.env.DATABASE_URL,
  schema: schema,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  seeds: [__dirname + '/seeds/*{.ts,.js}'], //
  synchronize: false,
  connectTimeoutMS: 5000,
  logging: false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
