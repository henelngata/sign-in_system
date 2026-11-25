// Database connection + schema. Shared by server.mjs, scripts/create-admin.mjs and the Next.js app.
//
// - On Vercel (or anywhere with TURSO_DATABASE_URL set): a hosted Turso/libSQL database.
//   Vercel's filesystem is temporary, so a local SQLite file would lose data there.
// - Otherwise: a local SQLite file at DB_PATH (default data/register.db).
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS officers (
    id              INTEGER PRIMARY KEY,
    staff_no        TEXT    NOT NULL UNIQUE,
    full_name       TEXT    NOT NULL,
    title           TEXT    NOT NULL DEFAULT 'Officer',
    department      TEXT    NOT NULL DEFAULT '',
    pin_hash        TEXT    NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id           INTEGER PRIMARY KEY,
    officer_id   INTEGER NOT NULL REFERENCES officers(id),
    day          TEXT    NOT NULL,
    sign_in_at   TEXT    NOT NULL,
    sign_in_ip   TEXT    NOT NULL,
    sign_out_at  TEXT,
    sign_out_ip  TEXT,
    UNIQUE (officer_id, day)
  );
  CREATE INDEX IF NOT EXISTS attendance_day ON attendance(day);

  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS access_denied (
    id     INTEGER PRIMARY KEY,
    at     TEXT NOT NULL,
    ip     TEXT NOT NULL,
    method TEXT NOT NULL,
    path   TEXT NOT NULL
  );
`;

export function dbConfig() {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN, local: false };
  }
  if (process.env.VERCEL === '1') {
    throw new Error('TURSO_DATABASE_URL is not set. On Vercel the register needs a hosted database (see README: Deploying on Vercel).');
  }
  const file = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DB_PATH || 'data/register.db');
  return { url: `file:${file}`, file, local: true };
}

/** Open the database and make sure the schema is up to date. */
export async function openDb() {
  const cfg = dbConfig();
  if (cfg.local) fs.mkdirSync(path.dirname(cfg.file), { recursive: true });
  const client = createClient({ url: cfg.url, authToken: cfg.authToken });
  if (cfg.local) {
    await client.executeMultiple('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  }
  await client.executeMultiple(SCHEMA);
  await migrate(client);
  return client;
}

/** Add columns introduced after the first release, so existing databases keep working. */
async function migrate(client) {
  const hasColumn = async () =>
    (await client.execute('PRAGMA table_info(officers)')).rows.some((c) => c.name === 'can_view_board');
  if (await hasColumn()) return;
  // Several processes or serverless instances may start at once: take the write lock, then check again.
  const tx = await client.transaction('write');
  try {
    if (!(await hasColumn())) {
      await tx.execute('ALTER TABLE officers ADD COLUMN can_view_board INTEGER NOT NULL DEFAULT 0');
      await tx.execute("UPDATE officers SET can_view_board = 1 WHERE title LIKE '%Director%'");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}
