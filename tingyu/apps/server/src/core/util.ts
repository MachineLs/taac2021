// Small helpers shared by all modules. Owned by the lead.
import { randomBytes } from 'node:crypto';

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
/** id('u') → "u_k3j9x0a1b2c3" */
export function id(prefix: string): string {
  const b = randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += ALPHA[b[i] % 36];
  return `${prefix}_${s}`;
}
export const nowIso = () => new Date().toISOString();
export const addMinutes = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60000).toISOString();
export const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();
export const maskPhone = (p: string) => (p.length >= 7 ? p.slice(0, 3) + '****' + p.slice(-4) : p);
export const maskName = (n: string) => (n ? n[0] + '**' : '匿名');
/** "2026-11-16" for an ISO time, in China time (UTC+8). */
export const cnDate = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10);
