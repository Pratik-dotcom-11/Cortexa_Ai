import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from './env.ts';
import * as schema from '../models/schema.ts';
import { ensureDatabaseSchema } from './initSchema.ts';

declare global {
  // eslint-disable-next-line no-var
  var _backendPgPool: Pool | undefined;
}

const isConfigured = Boolean(config.sql.connectionString || config.sql.host);
let isPoolConnected = false;
let connectionTested = false;

export const getPgPool = (): Pool | null => {
  if (!isConfigured) {
    return null;
  }

  if (!global._backendPgPool) {
    if (config.sql.connectionString) {
      global._backendPgPool = new Pool({
        connectionString: config.sql.connectionString,
        max: 10,
        connectionTimeoutMillis: 5000,
      });
    } else {
      global._backendPgPool = new Pool({
        host: config.sql.host,
        port: config.sql.port,
        user: config.sql.user || 'postgres',
        password: config.sql.password || 'postgres',
        database: config.sql.database || 'studyai',
        max: 10,
        connectionTimeoutMillis: 5000,
      });
    }

    global._backendPgPool.on('error', (err) => {
      console.warn('PostgreSQL idle client warning:', err.message);
    });
  }

  return global._backendPgPool;
};

export const pool = getPgPool();
export const db: NodePgDatabase<typeof schema> = pool
  ? drizzle(pool, { schema })
  : (null as unknown as NodePgDatabase<typeof schema>);

/**
 * Returns true only if PostgreSQL is actively configured, reachable, and schema verified.
 */
export function isDbActive(): boolean {
  if (!isConfigured || !pool || !db) return false;
  if (connectionTested) return isPoolConnected;
  return false;
}

/**
 * Validates connection and provisions schemas on initial bootstrap.
 */
export async function testDatabaseConnection(): Promise<boolean> {
  if (!isConfigured || !pool) {
    connectionTested = true;
    isPoolConnected = false;
    return false;
  }

  try {
    // Automatically ensure all tables exist
    await ensureDatabaseSchema(pool);
    isPoolConnected = true;
    console.log('PostgreSQL database connected and tables verified successfully.');
  } catch (err: any) {
    isPoolConnected = false;
    console.warn(`PostgreSQL schema bootstrap notice: ${err.message}`);
  } finally {
    connectionTested = true;
  }

  return isPoolConnected;
}

// Background initial probe & schema creation
if (isConfigured && pool) {
  testDatabaseConnection().catch(() => {});
} else {
  connectionTested = true;
  isPoolConnected = false;
}
