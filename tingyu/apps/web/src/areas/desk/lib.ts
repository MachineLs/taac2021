// Desk-local helpers: China-time date math for the workbench (UTC+8, no DST).
import type { Appointment, AppointmentStatus } from '@tingyu/shared';
import { dayKey } from '../../lib/format';

const CN = 8 * 3600000;
const DAY = 86400000;
export const pad = (n: number) => String(n).padStart(2, '0');

/** Today's China date as "YYYY-MM-DD". */
export const todayKey = () => dayKey(new Date().toISOString());

/** "YYYY-MM-DD" (CN date) + hour/minute (CN time) → ISO UTC string. */
export function cnIso(key: string, hour = 0, minute = 0): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 8, minute)).toISOString();
}
/** Shift a CN date key by n days. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** Monday of the CN week containing `key`. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}
/** CN hour of an ISO timestamp. */
export const cnHour = (iso: string) => new Date(new Date(iso).getTime() + CN).getUTCHours();
/** "2026-11" for the CN month of now. */
export const thisMonth = () => todayKey().slice(0, 7);
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { from: cnIso(`${month}-01`), to: cnIso(`${next}-01`) };
}
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}
export const monthLabel = (month: string) => { const [y, m] = month.split('-').map(Number); return `${y} 年 ${m} 月`; };
export const shortDate = (key: string) => { const [, m, d] = key.split('-').map(Number); return `${m}/${d}`; };
export { DAY };

/** Live statuses: the session still has to happen (or is happening). */
export const isUpcoming = (a: Appointment) => (a.status === 'paid' || a.status === 'in_session') && new Date(a.endAt).getTime() > Date.now();
export const isActive = (s: AppointmentStatus) => s !== 'cancelled' && s !== 'refunded' && s !== 'pending_payment';

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  pending_payment: 'gray', paid: 'blue', in_session: 'green', completed: 'gray', cancelled: 'gray', refunded: 'red',
};

/** "2 小时 05 分" / "12 分 30 秒" style countdown. */
export function countdown(ms: number): string {
  if (ms <= 0) return '已开始';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${pad(mi)} 分`;
  return `${mi} 分 ${pad(se)} 秒`;
}
/** mm:ss or h:mm:ss */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
  return h ? `${h}:${pad(mi)}:${pad(se)}` : `${pad(mi)}:${pad(se)}`;
}
export const greeting = () => {
  const h = cnHour(new Date().toISOString());
  return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
};
