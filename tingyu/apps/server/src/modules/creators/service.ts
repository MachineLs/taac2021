// Creators (达人): mapping, stats and commission accrual. Owner: B2.
import type { Creator, CreatorStats } from '@tingyu/shared';
import { all, one, run, type Row } from '../../core/db';
import { notify } from '../../core/notify';
import { cnDate, id, nowIso } from '../../core/util';

/** Order states that count as a paid first order (refunded / cancelled do not). */
export const PAID_STATES = "('paid','in_session','completed')";

export const toCreator = (r: Row): Creator => ({
  id: r.id, name: r.name, avatar: r.avatar, platform: r.platform, followers: r.followers, bio: r.bio ?? '',
  refCode: r.ref_code, commissionRate: r.commission_rate,
});

export function findByRefCode(refCode: string): Row | undefined {
  return one('SELECT * FROM creators WHERE ref_code = ?', refCode) ?? one('SELECT * FROM creators WHERE UPPER(ref_code) = UPPER(?)', refCode);
}

export const firstOrders = (creatorId: string): number =>
  one(`SELECT COUNT(*) AS n FROM appointments WHERE creator_id = ? AND status IN ${PAID_STATES}`, creatorId)!.n as number;

export const commissionTotal = (creatorId: string): number =>
  one('SELECT COALESCE(SUM(amount), 0) AS s FROM commissions WHERE creator_id = ?', creatorId)!.s as number;

/** Last `days` China-time dates, oldest first, ending today. */
export function lastCnDates(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) out.push(cnDate(new Date(now - i * 86400000).toISOString()));
  return out;
}

/** ISO lower bound for the first of the given CN dates (00:00 China time). */
export const cnDayStartIso = (date: string) => new Date(`${date}T00:00:00+08:00`).toISOString();

function countByCnDate(rows: Row[], key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) { const d = cnDate(r[key]); m.set(d, (m.get(d) ?? 0) + 1); }
  return m;
}

export function creatorStats(creatorId: string): CreatorStats {
  const c = one('SELECT * FROM creators WHERE id = ?', creatorId)!;
  const visits = one('SELECT COUNT(*) AS n FROM referral_visits WHERE creator_id = ?', creatorId)!.n as number;
  const signups = one('SELECT COUNT(*) AS n FROM users WHERE referred_by_creator_id = ?', creatorId)!.n as number;
  const intakes = one('SELECT COUNT(*) AS n FROM intake_sessions s JOIN users u ON u.id = s.user_id WHERE u.referred_by_creator_id = ?', creatorId)!.n as number;
  const commissionPending = one("SELECT COALESCE(SUM(amount), 0) AS s FROM commissions WHERE creator_id = ? AND status = 'pending'", creatorId)!.s as number;

  const dates = lastCnDates(30);
  const since = cnDayStartIso(dates[0]);
  const v = countByCnDate(all('SELECT created_at FROM referral_visits WHERE creator_id = ? AND created_at >= ?', creatorId, since), 'created_at');
  const s = countByCnDate(all('SELECT created_at FROM users WHERE referred_by_creator_id = ? AND created_at >= ?', creatorId, since), 'created_at');
  const o = countByCnDate(all(`SELECT paid_at FROM appointments WHERE creator_id = ? AND status IN ${PAID_STATES} AND paid_at >= ?`, creatorId, since), 'paid_at');

  return {
    creator: toCreator(c), visits, signups, intakes, firstOrders: firstOrders(creatorId),
    commissionTotal: commissionTotal(creatorId), commissionPending,
    daily: dates.map((date) => ({ date, visits: v.get(date) ?? 0, signups: s.get(date) ?? 0, orders: o.get(date) ?? 0 })),
    commissions: all('SELECT * FROM commissions WHERE creator_id = ? ORDER BY created_at DESC, rowid DESC', creatorId)
      .map((r) => ({ id: r.id, appointmentId: r.appointment_id, amount: r.amount, status: r.status, createdAt: r.created_at })),
  };
}

/** appointment.paid → accrue commission for an attributed first order (idempotent). */
export function accrueCommission(appointmentId: string): string | null {
  const a = one('SELECT id, amount, creator_id, status FROM appointments WHERE id = ?', appointmentId);
  if (!a?.creator_id) return null;
  if (one('SELECT id FROM commissions WHERE appointment_id = ?', appointmentId)) return null;
  const c = one('SELECT id, user_id, commission_rate FROM creators WHERE id = ?', a.creator_id);
  if (!c) return null;
  const amount = Math.round(a.amount * c.commission_rate);
  const cid = id('cm');
  run('INSERT INTO commissions (id, creator_id, appointment_id, amount, status, created_at) VALUES (?,?,?,?,?,?)', cid, c.id, appointmentId, amount, 'pending', nowIso());
  if (c.user_id && amount > 0) notify(c.user_id, 'commission', '新增一笔推广佣金', `你推荐的用户完成了首单，佣金 ${amount} 元待结算。`, '/creator');
  return cid;
}

/** appointment.refunded → void the still-pending commission of that order. Settled ones are left for manual handling. */
export function voidCommission(appointmentId: string): boolean {
  const r = run("DELETE FROM commissions WHERE appointment_id = ? AND status = 'pending'", appointmentId);
  return Number(r.changes) > 0;
}
