import { Pool, type PoolConfig } from 'pg';

import { safetyConfig } from './safetyConfig.js';

function buildPoolConfig(): PoolConfig {
  const databaseUrl = process.env['DATABASE_URL'];

  if (databaseUrl !== undefined && databaseUrl.trim() !== '') {
    const sslMode = process.env['PGSSLMODE'];
    return {
      connectionString: databaseUrl,
      max: Number.parseInt(process.env['PG_POOL_MAX'] ?? '10', 10),
      ssl: sslMode !== undefined && sslMode !== 'disable' ? { rejectUnauthorized: false } : undefined,
    };
  }

  const database = process.env['PGDATABASE'];
  if (database === undefined || database.trim() === '') {
    throw new Error('DATABASE_URL or PGDATABASE environment variable is required');
  }

  return {
    host: process.env['PGHOST'] ?? 'localhost',
    port: Number.parseInt(process.env['PGPORT'] ?? '5432', 10),
    database,
    user: process.env['PGUSER'],
    password: process.env['PGPASSWORD'],
    max: Number.parseInt(process.env['PG_POOL_MAX'] ?? '10', 10),
  };
}

function createPool(): Pool {
  const config = buildPoolConfig();
  return new Pool(config);
}

export const pool = createPool();

if (safetyConfig.readOnly || safetyConfig.queryTimeoutMs !== null) {
  pool.on('connect', (client) => {
    if (safetyConfig.readOnly) {
      void client.query('SET SESSION default_transaction_read_only = on');
    }
    if (safetyConfig.queryTimeoutMs !== null) {
      void client.query(
        `SET SESSION statement_timeout = ${String(safetyConfig.queryTimeoutMs)}`
      );
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  void pool.end();
});
process.on('SIGTERM', () => {
  void pool.end();
});
