// Module: auth — owner: B1 (commerce core). See docs/API.md.
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { LoginRes, SendCodeRes, User } from '@tingyu/shared';
import { one, run, tx } from '../../core/db';
import { config } from '../../core/config';
import { requireAuth, signToken, me } from '../../core/auth';
import { HttpError, conflict, h, notFound, parse } from '../../core/errors';
import { toUser } from '../../core/mappers';
import { addDays, addMinutes, id, nowIso } from '../../core/util';

export const router = Router();

const CODE_TTL_MIN = 5;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const phoneSchema = z.string().trim().regex(/^1\d{10}$/, '手机号格式不正确');
const invalidCode = () => new HttpError(400, 'invalid_code', '验证码错误或已过期');

router.post('/auth/send-code', h((req, res) => {
  const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
  const now = nowIso();
  const prev = one('SELECT expires_at FROM sms_codes WHERE phone = ?', phone);
  if (prev) {
    const sentAt = new Date(prev.expires_at).getTime() - CODE_TTL_MIN * 60000;
    if (Date.now() - sentAt < RESEND_SECONDS * 1000) throw conflict('发送太频繁，请稍后再试', 'too_many');
  }
  const code = config.isProd ? String(randomInt(0, 1_000_000)).padStart(6, '0') : config.devSmsCode;
  run(`INSERT INTO sms_codes (phone, code, expires_at, attempts) VALUES (?,?,?,0)
       ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0`,
    phone, code, addMinutes(now, CODE_TTL_MIN));
  // Production would hand `code` to an SMS provider here.
  const body: SendCodeRes = config.isProd ? { ok: true } : { ok: true, devCode: code };
  res.json(body);
}));

function verifyCode(phone: string, code: string) {
  if (!config.isProd && code === config.devSmsCode) { run('DELETE FROM sms_codes WHERE phone = ?', phone); return; }
  const row = one('SELECT code, expires_at, attempts FROM sms_codes WHERE phone = ?', phone);
  if (!row || row.expires_at <= nowIso() || row.attempts >= MAX_ATTEMPTS) throw invalidCode();
  if (row.code !== code) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) run('DELETE FROM sms_codes WHERE phone = ?', phone);
    else run('UPDATE sms_codes SET attempts = ? WHERE phone = ?', attempts, phone);
    throw invalidCode();
  }
  run('DELETE FROM sms_codes WHERE phone = ?', phone);
}

router.post('/auth/login', h((req, res) => {
  const body = parse(z.object({
    phone: phoneSchema,
    code: z.string().trim().regex(/^\d{4,8}$/, '验证码格式不正确'),
    refCode: z.string().trim().max(64).optional().nullable(),
  }), req.body);
  verifyCode(body.phone, body.code);

  let user = one('SELECT * FROM users WHERE phone = ?', body.phone);
  let isNew = false;
  if (!user) {
    isNew = true;
    const now = nowIso();
    const uid = id('u');
    const creator = body.refCode ? one('SELECT id FROM creators WHERE UPPER(ref_code) = UPPER(?)', body.refCode) : undefined;
    tx(() => {
      run('INSERT INTO users (id, phone, name, avatar, roles, referred_by_creator_id, created_at) VALUES (?,?,?,?,?,?,?)',
        uid, body.phone, `用户${body.phone.slice(-4)}`, null, JSON.stringify(['client']), creator?.id ?? null, now);
      const welcome = one(`SELECT id, valid_days FROM coupons WHERE code = 'NEW100'`);
      if (welcome) {
        run('INSERT OR IGNORE INTO user_coupons (id, user_id, coupon_id, status, expires_at) VALUES (?,?,?,?,?)',
          id('uc'), uid, welcome.id, 'unused', addDays(now, welcome.valid_days ?? 7));
      }
    });
    user = one('SELECT * FROM users WHERE id = ?', uid)!;
  }
  const out: LoginRes = { token: signToken(user.id), user: toUser(user), isNew };
  res.json(out);
}));

router.get('/me', requireAuth, h((req, res) => {
  const u = one('SELECT * FROM users WHERE id = ?', me(req).id);
  if (!u) throw notFound('用户不存在');
  const out: User = toUser(u);
  res.json(out);
}));

router.patch('/me', requireAuth, h((req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(1, '昵称不能为空').max(20, '昵称最多 20 个字').optional(),
    avatar: z.string().trim().max(500).nullable().optional(),
  }), req.body);
  const uid = me(req).id;
  if (body.name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', body.name, uid);
  if (body.avatar !== undefined) run('UPDATE users SET avatar = ? WHERE id = ?', body.avatar || null, uid);
  const out: User = toUser(one('SELECT * FROM users WHERE id = ?', uid)!);
  res.json(out);
}));
