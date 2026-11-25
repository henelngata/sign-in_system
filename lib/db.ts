import type { DatabaseSync } from 'node:sqlite';
import { openDb } from './schema.mjs';

const g = globalThis as unknown as { __registerDb?: DatabaseSync };
export const db: DatabaseSync = (g.__registerDb ??= openDb());

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
