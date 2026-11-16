// Module: counselors — owner: B1 (commerce core). See docs/API.md.
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { CounselorDetail, CounselorSummary, Page, Review, Slot } from '@tingyu/shared';
import { all, one, j } from '../../core/db';
import { h, notFound, parse } from '../../core/errors';
import { toCounselorDetail, toCounselorSummary } from '../../core/mappers';
import { addDays, maskName, nowIso } from '../../core/util';
import { expireStalePending, param } from '../appointments/service';

export const router = Router();

const modeEnum = z.enum(['video', 'voice', 'text', 'offline']);
const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);
const optNum = (s: z.ZodNumber) => z.preprocess(emptyToUndef, s.optional());
const optStr = <T extends z.ZodTypeAny>(s: T) => z.preprocess(emptyToUndef, s.optional());

const listQuery = z.object({
  q: optStr(z.string().trim().max(50)),
  tag: optStr(z.string().trim().max(20)),
  mode: optStr(modeEnum),
  priceMin: optNum(z.coerce.number().int().min(0)),
  priceMax: optNum(z.coerce.number().int().min(0)),
  gender: optStr(z.enum(['female', 'male'])),
  city: optStr(z.string().trim().max(20)),
  availableWithinDays: optNum(z.coerce.number().int().min(1).max(60)),
  sort: optStr(z.enum(['recommended', 'rating', 'price_asc', 'price_desc', 'soonest'])),
  page: optNum(z.coerce.number().int().min(1)),
  pageSize: optNum(z.coerce.number().int().min(1).max(50)),
});

const likeEsc = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

router.get('/counselors', h((req, res) => {
  expireStalePending();
  const q = parse(listQuery, req.query);
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 10;
  const now = nowIso();
  const where: string[] = [`c.status = 'approved'`];
  const params: unknown[] = [];
  if (q.q) {
    const like = `%${likeEsc(q.q)}%`;
    where.push(`(c.name LIKE ? ESCAPE '\\' OR c.tags LIKE ? ESCAPE '\\' OR c.headline LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\' OR c.methods LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like, like);
  }
  if (q.tag) { where.push(`c.tags LIKE ? ESCAPE '\\'`); params.push(`%"${likeEsc(q.tag)}"%`); }
  if (q.mode) { where.push(`c.modes LIKE ?`); params.push(`%"${q.mode}"%`); }
  if (q.priceMin !== undefined) { where.push('c.price >= ?'); params.push(q.priceMin); }
  if (q.priceMax !== undefined) { where.push('c.price <= ?'); params.push(q.priceMax); }
  if (q.gender) { where.push('c.gender = ?'); params.push(q.gender); }
  if (q.city) { where.push('c.city = ?'); params.push(q.city); }
  if (q.availableWithinDays) {
    where.push(`EXISTS (SELECT 1 FROM slots s WHERE s.counselor_id = c.id AND s.status = 'open' AND s.start_at > ? AND s.start_at <= ?)`);
    params.push(now, addDays(now, q.availableWithinDays));
  }
  const order = {
    recommended: 'c.sort_weight DESC, c.rating DESC',
    rating: 'c.rating DESC, c.review_count DESC',
    price_asc: 'c.price ASC, c.rating DESC',
    price_desc: 'c.price DESC, c.rating DESC',
    soonest: 'next_at IS NULL, next_at ASC, c.sort_weight DESC',
  }[q.sort ?? 'recommended'];
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = Number(one(`SELECT COUNT(*) AS n FROM counselors c ${whereSql}`, ...params)!.n);
  const rows = all(`SELECT c.*, (SELECT MIN(s.start_at) FROM slots s WHERE s.counselor_id = c.id AND s.status = 'open' AND s.start_at > ?) AS next_at
    FROM counselors c ${whereSql} ORDER BY ${order}, c.id LIMIT ? OFFSET ?`, now, ...params, pageSize, (page - 1) * pageSize);
  const out: Page<CounselorSummary> = { items: rows.map(toCounselorSummary), total, page, pageSize };
  res.json(out);
}));

/** Approved counselors are public; pending/rejected ones are visible to their owner and admins. */
function loadVisibleCounselor(req: Request, counselorId: string) {
  const c = one('SELECT * FROM counselors WHERE id = ?', counselorId);
  if (!c) throw notFound('咨询师不存在');
  if (c.status !== 'approved') {
    const u = req.user;
    const allowed = u && (u.roles.includes('admin') || u.counselorId === c.id);
    if (!allowed) throw notFound('咨询师不存在');
  }
  return c;
}

router.get('/counselors/:id', h((req, res) => {
  expireStalePending();
  const c = loadVisibleCounselor(req, param(req));
  const out: CounselorDetail = toCounselorDetail(c);
  res.json(out);
}));

export const toSlot = (s: Record<string, any>): Slot => ({ id: s.id, counselorId: s.counselor_id, startAt: s.start_at, endAt: s.end_at, status: s.status });

router.get('/counselors/:id/slots', h((req, res) => {
  expireStalePending();
  const c = loadVisibleCounselor(req, param(req));
  const q = parse(z.object({
    from: optStr(z.string().datetime({ offset: true })),
    days: optNum(z.coerce.number().int().min(1).max(30)),
  }), req.query);
  const now = nowIso();
  const fromIso = q.from ? new Date(q.from).toISOString() : now;
  const lower = fromIso > now ? fromIso : now;
  const upper = addDays(fromIso, q.days ?? 7);
  const rows = all(`SELECT * FROM slots WHERE counselor_id = ? AND status IN ('open','booked') AND start_at > ? AND start_at < ? ORDER BY start_at`,
    c.id, lower, upper);
  const out: Slot[] = rows.map(toSlot);
  res.json(out);
}));

router.get('/counselors/:id/reviews', h((req, res) => {
  const c = loadVisibleCounselor(req, param(req));
  const q = parse(z.object({
    page: optNum(z.coerce.number().int().min(1)),
    pageSize: optNum(z.coerce.number().int().min(1).max(50)),
  }), req.query);
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 10;
  const total = Number(one('SELECT COUNT(*) AS n FROM reviews WHERE counselor_id = ?', c.id)!.n);
  const rows = all(`SELECT r.*, u.name AS u_name FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.counselor_id = ? ORDER BY r.created_at DESC, r.id LIMIT ? OFFSET ?`, c.id, pageSize, (page - 1) * pageSize);
  const out: Page<Review> = { items: rows.map(toReview), total, page, pageSize };
  res.json(out);
}));

export const toReview = (r: Record<string, any>): Review => ({
  id: r.id, counselorId: r.counselor_id, userName: maskName(r.u_name), rating: r.rating, content: r.content,
  tags: j<string[]>(r.tags, []), createdAt: r.created_at,
});
