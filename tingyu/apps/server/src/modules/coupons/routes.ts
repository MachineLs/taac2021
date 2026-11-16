// Module: coupons — owner: B1 (commerce core). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { UserCoupon } from '@tingyu/shared';
import { all, one, run } from '../../core/db';
import { requireAuth, me } from '../../core/auth';
import { conflict, h, notFound, parse } from '../../core/errors';
import { addDays, id, nowIso } from '../../core/util';
import { expireStalePending, hasPaidOrder } from '../appointments/service';

export const router = Router();

const COUPON_SELECT = `SELECT uc.*, c.title, c.amount, c.min_spend FROM user_coupons uc JOIN coupons c ON c.id = uc.coupon_id`;

export const toUserCoupon = (r: Record<string, any>): UserCoupon => ({
  id: r.id, title: r.title, amount: r.amount, minSpend: r.min_spend, status: r.status, expiresAt: r.expires_at,
});

/** Mark the user's unused-but-past-date coupons as expired. */
export function expireCoupons(userId: string) {
  run(`UPDATE user_coupons SET status = 'expired' WHERE user_id = ? AND status = 'unused' AND expires_at <= ?`, userId, nowIso());
}

router.get('/coupons/mine', requireAuth, h((req, res) => {
  expireStalePending();
  const uid = me(req).id;
  expireCoupons(uid);
  const rows = all(`${COUPON_SELECT} WHERE uc.user_id = ?
    ORDER BY CASE uc.status WHEN 'unused' THEN 0 WHEN 'used' THEN 1 ELSE 2 END, uc.expires_at ASC`, uid);
  const out: UserCoupon[] = rows.map(toUserCoupon);
  res.json(out);
}));

router.post('/coupons/claim', requireAuth, h((req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().min(1, '请输入券码').max(32) }), req.body);
  const uid = me(req).id;
  const coupon = one('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?)', code);
  if (!coupon) throw notFound('券码不存在');
  if (one('SELECT 1 FROM user_coupons WHERE user_id = ? AND coupon_id = ?', uid, coupon.id)) throw conflict('你已经领取过这张券了');
  if (coupon.new_user_only && hasPaidOrder(uid)) throw conflict('这张券仅限新用户首单领取');
  const ucId = id('uc');
  run('INSERT INTO user_coupons (id, user_id, coupon_id, status, expires_at) VALUES (?,?,?,?,?)',
    ucId, uid, coupon.id, 'unused', addDays(nowIso(), coupon.valid_days ?? 7));
  const out: UserCoupon = toUserCoupon(one(`${COUPON_SELECT} WHERE uc.id = ?`, ucId)!);
  res.status(201).json(out);
}));
