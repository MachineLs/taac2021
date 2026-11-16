// Small helpers shared by the site (desktop) pages.
import { useEffect, useState } from 'react';
import type { Slot, UserCoupon } from '@tingyu/shared';
import { ApiError } from '../../api/client';
import { dayKey } from '../../lib/format';

export const INTAKE_KEY = 'tingyu.site.intake';

/** Chinese error text for any thrown value. */
export function errMsg(e: unknown, fallback = '操作失败，请稍后再试'): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Best usable coupon for a price: unused, not expired, minSpend met, largest amount. */
export function bestCoupon(coupons: UserCoupon[] | null | undefined, price: number): UserCoupon | null {
  if (!coupons) return null;
  const now = Date.now();
  const ok = coupons.filter((c) => c.status === 'unused' && Date.parse(c.expiresAt) > now && price >= c.minSpend && c.amount < price);
  ok.sort((a, b) => b.amount - a.amount || Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  return ok[0] ?? null;
}

export const sortSlots = (slots: Slot[]) => [...slots].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

/** Visible slots for a counselor card: the earliest non-blocked slots, at most 1 booked shown. */
export function cardSlots(slots: Slot[] | null, n = 5): Slot[] {
  if (!slots) return [];
  const out: Slot[] = [];
  let booked = 0;
  for (const s of sortSlots(slots)) {
    if (s.status === 'blocked' || Date.parse(s.startAt) < Date.now()) continue;
    if (s.status === 'booked') { if (booked >= 1) continue; booked++; }
    out.push(s);
    if (out.length >= n) break;
  }
  return out;
}

/** Next N China-time day keys starting today, "YYYY-MM-DD". */
export function nextDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) out.push(dayKey(new Date(now + i * 86400000).toISOString()));
  return out;
}
/** ISO at noon China time for a day key (handy for relDay/weekday). */
export const dayIso = (key: string) => `${key}T04:00:00.000Z`;

/** Seconds remaining until `target` (ISO), ticking every second. */
export function useCountdown(target: string | null | undefined): number {
  const calc = () => (target ? Math.max(0, Math.floor((Date.parse(target) - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!target) return;
    const t = window.setInterval(() => setLeft(calc()), 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return left;
}
export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export function hms(s: number) {
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d} 天 ${p(h)}:${p(m)}:${p(sec)}` : `${p(h)}:${p(m)}:${p(sec)}`;
}

export const RISK_LABEL = { low: '低风险', medium: '中等风险', high: '高风险' } as const;
export const SCALE_SHORT = { phq9: 'PHQ-9 抑郁', gad7: 'GAD-7 焦虑', isi: 'ISI 失眠' } as const;

/** Map in-app notification links (some point at the mobile app) onto site routes. */
export function siteLink(link: string | null): string | null {
  if (!link) return null;
  if (/^\/m\/orders/.test(link)) return '/account';
  if (/^\/m\/messages/.test(link)) return '/account/messages';
  if (/^\/m\/room\//.test(link)) return link.replace(/^\/m/, '');
  if (/^\/m\/counselors\//.test(link)) return link.replace(/^\/m/, '');
  if (link.startsWith('/m')) return '/account';
  return link;
}

/** Build and download an .ics calendar file for an appointment. */
export function downloadIcs(title: string, startIso: string, endIso: string, desc: string) {
  const f = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tingyu//CN', 'BEGIN:VEVENT', `UID:${Date.now()}@tingyu`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(startIso)}`, `DTEND:${f(endIso)}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:咨询即将开始', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'tingyu-appointment.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
