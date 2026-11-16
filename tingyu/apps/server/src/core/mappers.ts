// Row → API type mappers shared across modules. Owned by the lead.
import type { Appointment, CounselorDetail, CounselorSummary, User, Role } from '@tingyu/shared';
import { all, one, j, type Row } from './db';
import { nowIso } from './util';

export function toUser(u: Row): User {
  const c = one('SELECT id FROM counselors WHERE user_id = ?', u.id);
  const cr = one('SELECT id FROM creators WHERE user_id = ?', u.id);
  return { id: u.id, phone: u.phone, name: u.name, avatar: u.avatar ?? null, roles: j<Role[]>(u.roles, ['client']),
    counselorId: c?.id ?? null, creatorId: cr?.id ?? null, createdAt: u.created_at };
}

export function nextAvailableAt(counselorId: string): string | null {
  const r = one("SELECT start_at FROM slots WHERE counselor_id = ? AND status = 'open' AND start_at > ? ORDER BY start_at LIMIT 1", counselorId, nowIso());
  return r?.start_at ?? null;
}

export function toCounselorSummary(c: Row): CounselorSummary {
  return {
    id: c.id, name: c.name, avatar: c.avatar, title: c.title, headline: c.headline, badges: j(c.badges, []),
    years: c.years, sessionsCount: c.sessions_count, rating: Math.round(c.rating * 100) / 100, reviewCount: c.review_count,
    rebookRate: c.rebook_rate, tags: j(c.tags, []), modes: j(c.modes, []), price: c.price, originalPrice: c.original_price ?? null,
    city: c.city ?? null, gender: c.gender, nextAvailableAt: nextAvailableAt(c.id),
  };
}

export function toCounselorDetail(c: Row): CounselorDetail {
  return { ...toCounselorSummary(c), intro: c.intro, methods: j(c.methods, []), qualifications: j(c.qualifications, []),
    training: j(c.training, []), status: c.status };
}

export function getCounselorSummary(counselorId: string): CounselorSummary | null {
  const c = one('SELECT * FROM counselors WHERE id = ?', counselorId);
  return c ? toCounselorSummary(c) : null;
}

/** Standard SELECT for appointments; pass the WHERE/ORDER clause. */
export const APPOINTMENT_SELECT = `
  SELECT a.*, c.name AS c_name, c.avatar AS c_avatar, c.title AS c_title,
         u.name AS u_name, u.avatar AS u_avatar
  FROM appointments a
  JOIN counselors c ON c.id = a.counselor_id
  JOIN users u ON u.id = a.user_id`;

export function toAppointment(a: Row): Appointment {
  return {
    id: a.id, userId: a.user_id,
    counselor: { id: a.counselor_id, name: a.c_name, avatar: a.c_avatar, title: a.c_title },
    client: { id: a.user_id, name: a.u_name, avatar: a.u_avatar ?? null },
    slotId: a.slot_id, startAt: a.start_at, endAt: a.end_at, mode: a.mode, status: a.status,
    price: a.price, discount: a.discount, amount: a.amount, couponId: a.user_coupon_id ?? null,
    intakeSessionId: a.intake_session_id ?? null, shareIntake: !!a.share_intake, creatorId: a.creator_id ?? null,
    reviewed: !!a.reviewed, createdAt: a.created_at, paidAt: a.paid_at ?? null, cancelledAt: a.cancelled_at ?? null,
    payExpiresAt: a.pay_expires_at ?? null,
  };
}

export function loadAppointment(id: string): Appointment | null {
  const r = one(`${APPOINTMENT_SELECT} WHERE a.id = ?`, id);
  return r ? toAppointment(r) : null;
}
export function listAppointments(where: string, ...params: any[]): Appointment[] {
  return all(`${APPOINTMENT_SELECT} ${where}`, ...params).map(toAppointment);
}
