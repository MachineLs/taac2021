// Module: notifications — owner: B2 (care & growth). See docs/API.md.
import { Router } from 'express';
import type { Notification } from '@tingyu/shared';
import { me, requireAuth } from '../../core/auth';
import { all, run, type Row } from '../../core/db';
import { h } from '../../core/errors';
import { nowIso } from '../../core/util';

export const router = Router();

const toNotification = (r: Row): Notification => ({
  id: r.id, type: r.type, title: r.title, body: r.body, link: r.link ?? null, readAt: r.read_at ?? null, createdAt: r.created_at,
});

/** Newest first, latest 100. */
router.get('/notifications', requireAuth, h((req, res) => {
  const list: Notification[] = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100', me(req).id).map(toNotification);
  res.json(list);
}));

router.post('/notifications/read-all', requireAuth, h((req, res) => {
  run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), me(req).id);
  res.json({ ok: true as const });
}));
