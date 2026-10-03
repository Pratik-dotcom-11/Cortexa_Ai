import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  geminiApiKey: string;
  sql: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    database?: string;
    connectionString?: string;
  };
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'studyai-jwt-production-secure-secret-token-key-2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  sql: {
    host: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionString: process.env.DATABASE_URL,
  },
};
