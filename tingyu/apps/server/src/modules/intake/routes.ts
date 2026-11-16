// Module: intake — owner: B2 (care & growth). See docs/API.md.
// AI intake assistant 小屿: anonymous or bound sessions, crisis-first replies, summaries.
import { Router } from 'express';
import { z } from 'zod';
import type { IntakeReplyRes, IntakeSession } from '@tingyu/shared';
import { me, requireAuth } from '../../core/auth';
import { h, parse } from '../../core/errors';
import { claimSession, createSession, endSession, getAccessibleRow, listMine, replyTo, toSession } from './service';

export const router = Router();

const ReplyBody = z.object({ content: z.string().trim().min(1, '说点什么吧').max(2000, '内容太长了') });

router.post('/intake/sessions', h((req, res) => {
  const session: IntakeSession = createSession(req.user);
  res.status(201).json(session);
}));

router.get('/intake/sessions', requireAuth, h((req, res) => {
  const list: IntakeSession[] = listMine(me(req).id);
  res.json(list);
}));

router.get('/intake/sessions/:id', h((req, res) => {
  const session: IntakeSession = toSession(getAccessibleRow(String(req.params.id), req.user));
  res.json(session);
}));

router.post('/intake/sessions/:id/reply', h(async (req, res) => {
  const { content } = parse(ReplyBody, req.body);
  const out: IntakeReplyRes = await replyTo(String(req.params.id), req.user, content);
  res.json(out);
}));

router.post('/intake/sessions/:id/end', h(async (req, res) => {
  const session: IntakeSession = await endSession(String(req.params.id), req.user);
  res.json(session);
}));

router.post('/intake/sessions/:id/claim', requireAuth, h((req, res) => {
  const session: IntakeSession = claimSession(String(req.params.id), me(req));
  res.json(session);
}));
