// Single shared Postgres pool. Tune max for your instance size.
import pg from 'pg';
import { config } from '../config.js';
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,                       // per API instance; scale instances horizontally
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
export const query = (text, params) => pool.query(text, params);
// Transaction helper
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
