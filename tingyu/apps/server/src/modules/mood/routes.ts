// Module: mood — owner: B2 (care & growth). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { MoodCheckin } from '@tingyu/shared';
import { me, requireAuth } from '../../core/auth';
import { all, j, run, type Row } from '../../core/db';
import { h, parse } from '../../core/errors';
import { addDays, id, nowIso } from '../../core/util';

export const router = Router();

const toMood = (r: Row): MoodCheckin => ({ id: r.id, mood: r.mood, tags: j<string[]>(r.tags, []), note: r.note ?? '', createdAt: r.created_at });

const Query = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const Body = z.object({
  mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
  note: z.string().trim().max(500).default(''),
});

/** Newest first. */
router.get('/mood', requireAuth, h((req, res) => {
  const { days } = parse(Query, req.query);
  const list: MoodCheckin[] = all('SELECT * FROM mood_checkins WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC, rowid DESC',
    me(req).id, addDays(nowIso(), -days)).map(toMood);
  res.json(list);
}));

router.post('/mood', requireAuth, h((req, res) => {
  const b = parse(Body, req.body);
  const m: MoodCheckin = { id: id('m'), mood: b.mood, tags: [...new Set(b.tags)], note: b.note, createdAt: nowIso() };
  run('INSERT INTO mood_checkins (id, user_id, mood, tags, note, created_at) VALUES (?,?,?,?,?,?)', m.id, me(req).id, m.mood, JSON.stringify(m.tags), m.note, m.createdAt);
  res.status(201).json(m);
}));
