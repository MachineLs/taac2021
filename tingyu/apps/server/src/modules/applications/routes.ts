// Module: applications — owner: B1 (commerce core). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { CounselorDetail, Role } from '@tingyu/shared';
import { one, run, tx, j } from '../../core/db';
import { requireAuth, me } from '../../core/auth';
import { conflict, h, parse } from '../../core/errors';
import { toCounselorDetail } from '../../core/mappers';
import { id, nowIso } from '../../core/util';

export const router = Router();

const DEFAULT_AVATAR = '/assets/u-man-4.jpg';
const str = (max: number) => z.string().trim().min(1).max(max);

export const applySchema = z.object({
  name: str(20),
  title: str(40),
  headline: str(80),
  years: z.number().int().min(0).max(60),
  intro: str(2000),
  tags: z.array(str(12)).min(1).max(10),
  methods: z.array(str(40)).max(10),
  modes: z.array(z.enum(['video', 'voice', 'text', 'offline'])).min(1).max(4),
  price: z.number().int().min(50).max(5000),
  city: z.string().trim().max(20).nullable().optional(),
  gender: z.enum(['female', 'male']),
});

router.post('/counselor-applications', requireAuth, h((req, res) => {
  const body = parse(applySchema, req.body);
  const uid = me(req).id;
  const existing = one('SELECT id, status FROM counselors WHERE user_id = ?', uid);
  if (existing && existing.status !== 'rejected') throw conflict('你已经提交过入驻申请了');
  if (existing) {
    // re-application after rejection: update the same profile and send it back to review
    run(`UPDATE counselors SET name = ?, title = ?, headline = ?, years = ?, tags = ?, modes = ?, price = ?, city = ?, gender = ?, intro = ?, methods = ?, status = 'pending' WHERE id = ?`,
      body.name, body.title, body.headline, body.years, JSON.stringify([...new Set(body.tags)]), JSON.stringify([...new Set(body.modes)]),
      body.price, body.city || null, body.gender, body.intro, JSON.stringify(body.methods), existing.id);
    const again: CounselorDetail = toCounselorDetail(one('SELECT * FROM counselors WHERE id = ?', existing.id)!);
    res.status(201).json(again);
    return;
  }
  const user = one('SELECT avatar, roles FROM users WHERE id = ?', uid)!;
  const cid = id('c');
  const now = nowIso();
  tx(() => {
    run(`INSERT INTO counselors (id, user_id, name, avatar, title, headline, badges, years, sessions_count, rating, review_count, rebook_rate,
           tags, modes, price, original_price, city, gender, intro, methods, qualifications, training, status, sort_weight, created_at)
         VALUES (?,?,?,?,?,?,'[]',?,0,5,0,0,?,?,?,NULL,?,?,?,?,'[]','[]','pending',0,?)`,
      cid, uid, body.name, user.avatar || DEFAULT_AVATAR, body.title, body.headline, body.years,
      JSON.stringify([...new Set(body.tags)]), JSON.stringify([...new Set(body.modes)]), body.price, body.city || null, body.gender,
      body.intro, JSON.stringify(body.methods), now);
    const roles = j<Role[]>(user.roles, ['client']);
    if (!roles.includes('counselor')) run('UPDATE users SET roles = ? WHERE id = ?', JSON.stringify([...roles, 'counselor']), uid);
  });
  const out: CounselorDetail = toCounselorDetail(one('SELECT * FROM counselors WHERE id = ?', cid)!);
  res.status(201).json(out);
}));
