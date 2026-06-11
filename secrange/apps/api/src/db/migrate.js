// Minimal migration runner: applies migrations/*.sql in order, tracks applied ones.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { pool } from './pool.js';

const dir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../migrations');

async function run() {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM _migrations WHERE name=$1', [f]);
    if (done.rowCount) { console.log('skip', f); continue; }
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log('apply', f);
    await pool.query('BEGIN');
    try { await pool.query(sql); await pool.query('INSERT INTO _migrations(name) VALUES($1)', [f]); await pool.query('COMMIT'); }
    catch (e) { await pool.query('ROLLBACK'); console.error('failed', f, e.message); process.exit(1); }
  }
  await pool.end(); console.log('migrations complete');
}
run();
