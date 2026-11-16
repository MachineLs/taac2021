// Display formatting (China time, UTC+8). Owned by the lead.
import type { AppointmentStatus, ConsultMode } from '@tingyu/shared';
import { MODE_LABEL } from '@tingyu/shared';

const CN = 8 * 3600000;
const cnParts = (iso: string) => { const d = new Date(new Date(iso).getTime() + CN); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() }; };
const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const dayKey = (iso: string) => { const p = cnParts(iso); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
/** "今天" / "明天" / "后天" / "周三" / "11月20日" */
export function relDay(iso: string): string {
  const diff = Math.round((Date.parse(dayKey(iso)) - Date.parse(dayKey(new Date().toISOString()))) / 86400000);
  if (diff === 0) return '今天'; if (diff === 1) return '明天'; if (diff === 2) return '后天'; if (diff === -1) return '昨天';
  const p = cnParts(iso);
  return diff > 2 && diff < 7 ? WEEK[p.wd] : `${p.m}月${p.d}日`;
}
export const time = (iso: string) => { const p = cnParts(iso); return `${pad(p.h)}:${pad(p.mi)}`; };
export const weekday = (iso: string) => WEEK[cnParts(iso).wd];
export const monthDay = (iso: string) => { const p = cnParts(iso); return `${p.m}月${p.d}日`; };
/** "明天 20:00" */
export const when = (iso: string) => `${relDay(iso)} ${time(iso)}`;
/** "11月16日 周一 20:00–20:50" */
export const range = (start: string, end: string) => `${monthDay(start)} ${weekday(start)} ${time(start)}–${time(end)}`;
export const dateTime = (iso: string) => { const p = cnParts(iso); return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`; };
export const yuan = (n: number) => `¥${n.toLocaleString('zh-CN')}`;
export const modeLabel = (m: ConsultMode) => MODE_LABEL[m];
export const STATUS_LABEL: Record<AppointmentStatus, string> = { pending_payment: '待支付', paid: '待咨询', in_session: '咨询中', completed: '已完成', cancelled: '已取消', refunded: '已退款' };
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '刚刚'; if (s < 3600) return `${Math.floor(s / 60)} 分钟前`; if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return relDay(iso) === '昨天' ? '昨天' : monthDay(iso);
};
