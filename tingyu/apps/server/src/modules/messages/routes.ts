// Module: messages — owner: B2 (care & growth). See docs/API.md.
// Client ↔ counselor chat. A user sees conversations where they are the client (user_id) or the counselor (counselor_id).
import { Router } from 'express';
import { z } from 'zod';
import type { ChatMessage, Conversation } from '@tingyu/shared';
import { me, requireAuth, type AuthUser } from '../../core/auth';
import { all, one, run, tx, type Row } from '../../core/db';
import { badRequest, forbidden, h, notFound, parse } from '../../core/errors';
import { notify } from '../../core/notify';
import { id, nowIso } from '../../core/util';
import { detectCrisis, raiseCrisisAlert } from '../intake/crisis';

export const router = Router();

const CONV_SELECT = `
  SELECT cv.*, c.name AS c_name, c.avatar AS c_avatar, c.title AS c_title, c.user_id AS c_user_id,
         u.name AS u_name, u.avatar AS u_avatar
  FROM conversations cv
  JOIN counselors c ON c.id = cv.counselor_id
  JOIN users u ON u.id = cv.user_id`;

const toChat = (m: Row): ChatMessage => ({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, content: m.content, createdAt: m.created_at, readAt: m.read_at ?? null });

function toConversation(r: Row, viewerId: string): Conversation {
  const last = one('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', r.id);
  const unread = one('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL', r.id, viewerId)!.n as number;
  return {
    id: r.id,
    counselor: { id: r.counselor_id, name: r.c_name, avatar: r.c_avatar, title: r.c_title },
    client: { id: r.user_id, name: r.u_name, avatar: r.u_avatar ?? null },
    lastMessage: last ? toChat(last) : null,
    unread,
    updatedAt: r.updated_at,
  };
}

/** Loads a conversation the user takes part in (as client or as counselor). */
function loadOwn(convId: string, user: AuthUser): Row {
  const r = one(`${CONV_SELECT} WHERE cv.id = ?`, convId);
  if (!r) throw notFound('会话不存在');
  if (r.user_id !== user.id && r.counselor_id !== user.counselorId) throw forbidden('这不是你的会话');
  return r;
}

router.get('/conversations', requireAuth, h((req, res) => {
  const u = me(req);
  const rows = all(`${CONV_SELECT} WHERE cv.user_id = ? OR cv.counselor_id = ? ORDER BY cv.updated_at DESC`, u.id, u.counselorId ?? '');
  const list: Conversation[] = rows.map((r) => toConversation(r, u.id));
  res.json(list);
}));

const OpenBody = z.object({ counselorId: z.string().min(1) });

router.post('/conversations', requireAuth, h((req, res) => {
  const u = me(req);
  const { counselorId } = parse(OpenBody, req.body);
  const c = one('SELECT id, user_id, status FROM counselors WHERE id = ?', counselorId);
  if (!c || c.status !== 'approved') throw notFound('咨询师不存在或暂未开放');
  if (c.user_id === u.id) throw badRequest('不能和自己发起会话');
  let row = one('SELECT id FROM conversations WHERE user_id = ? AND counselor_id = ?', u.id, counselorId);
  if (!row) {
    const now = nowIso();
    const cid = id('cv');
    run('INSERT INTO conversations (id, user_id, counselor_id, created_at, updated_at) VALUES (?,?,?,?,?)', cid, u.id, counselorId, now, now);
    row = { id: cid };
  }
  const conv: Conversation = toConversation(one(`${CONV_SELECT} WHERE cv.id = ?`, row.id)!, u.id);
  res.json(conv);
}));

/** Oldest first; marks the other party's messages as read. */
router.get('/conversations/:id/messages', requireAuth, h((req, res) => {
  const u = me(req);
  const conv = loadOwn(String(req.params.id), u);
  run('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL', nowIso(), conv.id, u.id);
  const list: ChatMessage[] = all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid', conv.id).map(toChat);
  res.json(list);
}));

const SendBody = z.object({ content: z.string().trim().min(1, '消息不能为空').max(2000, '消息太长了') });

router.post('/conversations/:id/messages', requireAuth, h((req, res) => {
  const u = me(req);
  const conv = loadOwn(String(req.params.id), u);
  const { content } = parse(SendBody, req.body);
  const msg: ChatMessage = { id: id('msg'), conversationId: conv.id, senderId: u.id, content, createdAt: nowIso(), readAt: null };
  const fromClient = conv.user_id === u.id;
  tx(() => {
    run('INSERT INTO messages (id, conversation_id, sender_id, content, created_at, read_at) VALUES (?,?,?,?,?,?)', msg.id, conv.id, u.id, content, msg.createdAt, null);
    run('UPDATE conversations SET updated_at = ? WHERE id = ?', msg.createdAt, conv.id);
    const preview = content.length > 40 ? `${content.slice(0, 40)}……` : content;
    if (fromClient) {
      if (conv.c_user_id) notify(conv.c_user_id, 'message', `${conv.u_name}给你发来消息`, preview, `/desk/messages/${conv.id}`);
      // only the client's words are screened: counselors may legitimately mention crisis terms
      if (detectCrisis(content)) raiseCrisisAlert({ userId: u.id, sessionId: null, source: 'message', excerpt: content });
    } else {
      notify(conv.user_id, 'message', `${conv.c_name}给你发来消息`, preview, `/m/messages/${conv.id}`);
    }
  });
  res.status(201).json(msg);
}));
