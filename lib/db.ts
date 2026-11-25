import type { Client, InValue } from '@libsql/client';
import { openDb } from './schema.mjs';

// One connection per server instance, opened on first use (never during `next build`).
const g = globalThis as unknown as { __registerDb?: Promise<Client> };
function client(): Promise<Client> {
  g.__registerDb ??= openDb().catch((err: unknown) => {
    g.__registerDb = undefined; // retry on the next request instead of caching the failure
    throw err;
  });
  return g.__registerDb;
}

/** All rows, as plain objects keyed by column name. */
export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await (await client()).execute({ sql, args });
  return res.rows.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i]]))) as T[];
}

/** First row, or undefined. */
export async function get<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

/** Run a write; returns how many rows changed. */
export async function run(sql: string, args: InValue[] = []): Promise<{ changes: number }> {
  const res = await (await client()).execute({ sql, args });
  return { changes: res.rowsAffected };
}

export type Officer = {
  id: number;
  staff_no: string;
  full_name: string;
  title: string;
  department: string;
  pin_hash: string;
  active: number;
  can_view_board: number;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};

export type Attendance = {
  id: number;
  officer_id: number;
  day: string;
  sign_in_at: string;
  sign_in_ip: string;
  sign_out_at: string | null;
  sign_out_ip: string | null;
};
