import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { ensureDatabaseSchema } from '../../backend/src/config/initSchema.ts';

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (process.env.DATABASE_URL) {
      global._postgresPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 3000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 3000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.warn('Unexpected error on idle SQL pool client:', err.message);
    });

    if (process.env.SQL_HOST || process.env.DATABASE_URL) {
      ensureDatabaseSchema(global._postgresPool).catch((err) => {
        console.warn('PostgreSQL src/db schema init notice:', err.message);
      });
    }
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

export * from './schema.ts';
export * from './users.ts';
export * from './subjects.ts';
export * from './materials.ts';
export * from './quizzes.ts';
export * from './flashcards.ts';
export * from './progress.ts';
export * from './studyPlans.ts';
