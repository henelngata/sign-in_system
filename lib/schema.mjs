// Shared by server.mjs, scripts/create-admin.mjs and the Next.js app.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

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

export function dbPath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DB_PATH || 'data/register.db');
}

/** @param {string} [file] */
export function openDb(file = dbPath()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Add columns introduced after the first release, so existing databases keep working. */
function migrate(db) {
  const hasColumn = () => db.prepare('PRAGMA table_info(officers)').all().some((c) => c.name === 'can_view_board');
  if (hasColumn()) return;
  // Several processes (build workers, the server) may open the database at once:
  // take the write lock, then check again before altering.
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!hasColumn()) {
      db.exec(`
        ALTER TABLE officers ADD COLUMN can_view_board INTEGER NOT NULL DEFAULT 0;
        UPDATE officers SET can_view_board = 1 WHERE title LIKE '%Director%';
      `);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
