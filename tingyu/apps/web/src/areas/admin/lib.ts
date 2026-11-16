// Admin-area helpers (F4).
import { ApiError } from '../../api/client';

const HAS_CJK = /[一-龥]/;

/** Turns any thrown value into a Chinese, user-facing message. */
export function errText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'network') return e.message;
    if (e.status === 401) return '登录已过期，请重新登录';
    if (e.status === 403) return '没有权限执行此操作';
    if (e.status === 404 && e.message === '接口不存在') return '服务接口暂未就绪，请稍后重试';
    if (HAS_CJK.test(e.message)) return e.message;
    return '请求失败，请稍后再试';
  }
  if (e instanceof Error && HAS_CJK.test(e.message)) return e.message;
  return '请求失败，请稍后再试';
}
export const asError = (e: unknown) => (e ? new Error(errText(e)) : null);

/** 468000 → "46.8 万"; 1234 → "1,234" */
export function compact(n: number): string {
  if (Math.abs(n) >= 100000000) return `${trim(n / 100000000)} 亿`;
  if (Math.abs(n) >= 10000) return `${trim(n / 10000)} 万`;
  return n.toLocaleString('zh-CN');
}
const trim = (v: number) => (Math.round(v * 10) / 10).toString();

/** Clean axis ticks from 0 to a rounded max. */
export function niceTicks(max: number, count = 4, integer = true): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.0001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
/** Axis label: full below 10,000, compact (1万) above. */
export const axisLabel = (v: number, top: number) => (top >= 10000 ? (v === 0 ? '0' : `${trim(v / 10000)}万`) : v.toLocaleString('zh-CN'));

/** "2026-11-03" → "11/3" */
export const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}`; };
