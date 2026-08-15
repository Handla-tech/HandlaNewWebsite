import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Glob ALL entities (same as the runtime AppModule config) rather than a
// hand-maintained subset. Previously this file only listed 12 of the 35
// entities, which meant migrations/CLI were blind to the rest (purchases,
// quotations, saas, suppliers, support, accounting, ai, analytics, website),
// so those tables only ever existed via synchronize:true. Globbing keeps the
// migration data-source in lockstep with the app.
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  database: process.env.DATABASE_NAME || 'handla_db',
  username: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || undefined,
  entities: [path.resolve(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [path.resolve(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});
