// Module: creators — owner: B2 (care & growth). See docs/API.md.
import { Router } from 'express';
import type { Creator, CounselorSummary, CreatorStats } from '@tingyu/shared';
import { me, requireRole } from '../../core/auth';
import { j, one, run } from '../../core/db';
import { h, notFound } from '../../core/errors';
import { toCounselorSummary } from '../../core/mappers';
import { id, nowIso } from '../../core/util';
import { creatorStats, findByRefCode, toCreator } from './service';

export const router = Router();

const mustFind = (code: string) => {
  const c = findByRefCode(code);
  if (!c) throw notFound('达人不存在');
  return c;
};

router.get('/creators/:refCode', h((req, res) => {
  const creator: Creator = toCreator(mustFind(String(req.params.refCode)));
  res.json(creator);
}));

router.post('/creators/:refCode/visit', h((req, res) => {
  const c = mustFind(String(req.params.refCode));
  run('INSERT INTO referral_visits (id, creator_id, created_at) VALUES (?,?,?)', id('rv'), c.id, nowIso());
  res.json({ ok: true as const });
}));

router.get('/creators/:refCode/counselors', h((req, res) => {
  const c = mustFind(String(req.params.refCode));
  const list: CounselorSummary[] = j<string[]>(c.recommended_counselor_ids, [])
    .map((cid) => one("SELECT * FROM counselors WHERE id = ? AND status = 'approved'", cid))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(toCounselorSummary);
  res.json(list);
}));

router.get('/creator/stats', requireRole('creator'), h((req, res) => {
  const stats: CreatorStats = creatorStats(me(req).creatorId!);
  res.json(stats);
}));
