// Creator-area helpers (F4).
import { ApiError } from '../../api/client';

const HAS_CJK = /[一-龥]/;
export function errText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'network') return e.message;
    if (e.status === 401) return '登录已过期，请重新登录';
    if (e.status === 403) return '当前账号不是合作达人账号';
    if (e.status === 404 && e.message === '接口不存在') return '服务接口暂未就绪，请稍后重试';
    if (HAS_CJK.test(e.message)) return e.message;
  }
  if (e instanceof Error && HAS_CJK.test(e.message)) return e.message;
  return '请求失败，请稍后再试';
}
export const asError = (e: unknown) => (e ? new Error(errText(e)) : null);

const trim = (v: number) => (Math.round(v * 10) / 10).toString();
export function compact(n: number): string {
  if (Math.abs(n) >= 10000) return `${trim(n / 10000)} 万`;
  return n.toLocaleString('zh-CN');
}
export const pct = (a: number, b: number) => (b > 0 ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '—');

export function niceTicks(max: number, count = 3, integer = true): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.0001; v += step) out.push(Math.round(v * 1000) / 1000);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}
export const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}`; };
