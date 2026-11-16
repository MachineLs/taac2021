// SQLite access (node:sqlite). Owned by the lead.
import type { DatabaseSync as DB } from 'node:sqlite';
import { createRequire } from 'node:module';
// Loaded via require so test bundlers (vitest) don't try to resolve the prefix-only builtin.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DB;
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let current: DatabaseSync | null = null;

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
  db.exec(schema);
  current = db;
  return db;
}

/** The database opened by createApp(). Modules call db() inside handlers. */
export function db(): DatabaseSync {
  if (!current) throw new Error('database not opened');
  return current;
}

/** Run fn inside a transaction; rolls back on throw. */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try { const r = fn(); d.exec('COMMIT'); return r; }
  catch (e) { d.exec('ROLLBACK'); throw e; }
}

export type Row = Record<string, any>;
export const one = (sql: string, ...params: any[]): Row | undefined => db().prepare(sql).get(...params) as Row | undefined;
export const all = (sql: string, ...params: any[]): Row[] => db().prepare(sql).all(...params) as Row[];
export const run = (sql: string, ...params: any[]) => db().prepare(sql).run(...params);

/** Parse a JSON column safely. */
export function j<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}
