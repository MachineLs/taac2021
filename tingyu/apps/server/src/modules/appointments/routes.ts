// Module: appointments — owner: B1 (commerce core). See docs/API.md.
import { Router, type Request } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Appointment, AppointmentStatus, PayRes, Review, SessionRoom } from '@tingyu/shared';
import { one, run, tx, type Row } from '../../core/db';
import { config } from '../../core/config';
import { requireAuth, requireRole, me } from '../../core/auth';
import { HttpError, badRequest, conflict, forbidden, h, notFound, parse } from '../../core/errors';
import { listAppointments, loadAppointment } from '../../core/mappers';
import { addMinutes, id, nowIso } from '../../core/util';
import { notify } from '../../core/notify';
import { emit } from '../../core/events';
import { toReview } from '../counselors/routes';
import { expireStalePending, fmtCn, hasPaidOrder, modeLabel, param, releaseSlot, restoreCoupon } from './service';

export const router = Router();

const STATUSES = ['pending_payment', 'paid', 'in_session', 'completed', 'cancelled', 'refunded'] as const;
const modeEnum = z.enum(['video', 'voice', 'text', 'offline']);
const DAY_MS = 24 * 3600000;
const slotTaken = () => conflict('这个时段刚刚被约走了，换一个时间吧', 'slot_taken');

function mustLoad(appointmentId: string): Appointment {
  const a = loadAppointment(appointmentId);
  if (!a) throw notFound('订单不存在');
  return a;
}
function rawAppt(appointmentId: string): Row {
  const r = one('SELECT * FROM appointments WHERE id = ?', appointmentId);
  if (!r) throw notFound('订单不存在');
  return r;
}
function counselorUserId(counselorId: string): string | null {
  return one('SELECT user_id FROM counselors WHERE id = ?', counselorId)?.user_id ?? null;
}
/** Owner only (the client who booked). */
function ownAppt(req: Request): Row {
  const a = rawAppt(param(req));
  if (a.user_id !== me(req).id) throw forbidden('只能操作自己的订单');
  return a;
}
/** Owner, the counselor of the appointment, or an admin. */
function canView(req: Request, a: Row): boolean {
  const u = me(req);
  return a.user_id === u.id || (!!u.counselorId && u.counselorId === a.counselor_id) || u.roles.includes('admin');
}

// ---------- create ----------
router.post('/appointments', requireAuth, h((req, res) => {
  expireStalePending();
  const body = parse(z.object({
    counselorId: z.string().min(1),
    slotId: z.string().min(1),
    mode: modeEnum,
    couponId: z.string().min(1).nullable().optional(),
    intakeSessionId: z.string().min(1).nullable().optional(),
    shareIntake: z.boolean().optional(),
  }), req.body);
  const u = me(req);
  const now = nowIso();

  const c = one(`SELECT * FROM counselors WHERE id = ? AND status = 'approved'`, body.counselorId);
  if (!c) throw notFound('咨询师不存在');
  const modes = JSON.parse(c.modes || '[]') as string[];
  if (!modes.includes(body.mode)) throw badRequest(`这位咨询师暂不提供${modeLabel(body.mode)}咨询`);

  const slot = one('SELECT * FROM slots WHERE id = ?', body.slotId);
  if (!slot || slot.counselor_id !== c.id) throw notFound('时段不存在');
  if (slot.start_at <= now) throw badRequest('这个时段已经开始了，换一个时间吧');
  if (slot.status !== 'open') throw slotTaken();

  if (body.intakeSessionId) {
    const s = one('SELECT user_id FROM intake_sessions WHERE id = ?', body.intakeSessionId);
    if (!s || s.user_id !== u.id) throw badRequest('接待记录不存在或不属于你');
  }

  const price: number = c.price;
  let discount = 0;
  let couponId: string | null = null;
  if (body.couponId) {
    const uc = one(`SELECT uc.*, cp.amount, cp.min_spend FROM user_coupons uc JOIN coupons cp ON cp.id = uc.coupon_id WHERE uc.id = ?`, body.couponId);
    if (!uc || uc.user_id !== u.id) throw badRequest('优惠券不存在');
    if (uc.status !== 'unused') throw badRequest('优惠券已使用或已失效');
    if (uc.expires_at <= now) throw badRequest('优惠券已过期');
    if (price < uc.min_spend) throw badRequest(`订单满 ${uc.min_spend} 元才能使用这张券`);
    if (one(`SELECT 1 FROM appointments WHERE user_coupon_id = ? AND status = 'pending_payment'`, uc.id)) {
      throw conflict('这张券已用于一笔待支付订单，请先支付或取消那笔订单');
    }
    discount = Math.min(uc.amount, price);
    couponId = uc.id;
  }

  const userRow = one('SELECT referred_by_creator_id FROM users WHERE id = ?', u.id);
  const creatorId: string | null = userRow?.referred_by_creator_id && !hasPaidOrder(u.id) ? userRow.referred_by_creator_id : null;

  const apptId = id('a');
  tx(() => {
    const r = run(`UPDATE slots SET status = 'booked' WHERE id = ? AND status = 'open'`, slot.id);
    if (Number(r.changes) !== 1) throw slotTaken();
    run(`INSERT INTO appointments (id, user_id, counselor_id, slot_id, start_at, end_at, mode, status, price, discount, amount,
           user_coupon_id, intake_session_id, share_intake, creator_id, reviewed, created_at, pay_expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      apptId, u.id, c.id, slot.id, slot.start_at, slot.end_at, body.mode, 'pending_payment', price, discount, price - discount,
      couponId, body.intakeSessionId ?? null, body.shareIntake ? 1 : 0, creatorId, 0, now, addMinutes(now, config.payTimeoutMinutes));
  });
  const out: Appointment = mustLoad(apptId);
  res.status(201).json(out);
}));

// ---------- list / get ----------
router.get('/appointments', requireAuth, h((req, res) => {
  expireStalePending();
  const q = parse(z.object({ status: z.string().optional() }), req.query);
  const statuses = (q.status ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const s of statuses) if (!(STATUSES as readonly string[]).includes(s)) throw badRequest('订单状态不正确');
  const uid = me(req).id;
  const out: Appointment[] = statuses.length
    ? listAppointments(`WHERE a.user_id = ? AND a.status IN (${statuses.map(() => '?').join(',')}) ORDER BY a.start_at DESC`, uid, ...statuses)
    : listAppointments('WHERE a.user_id = ? ORDER BY a.start_at DESC', uid);
  res.json(out);
}));

router.get('/appointments/:id', requireAuth, h((req, res) => {
  expireStalePending();
  const a = rawAppt(param(req));
  if (!canView(req, a)) throw forbidden('没有权限查看这笔订单');
  const out: Appointment = mustLoad(a.id);
  res.json(out);
}));

// ---------- pay (simulated) ----------
const TXN_PREFIX: Record<string, string> = { wechat: 'WX', alipay: 'ALI', card: 'UP' };

router.post('/appointments/:id/pay', requireAuth, h((req, res) => {
  expireStalePending();
  const { method } = parse(z.object({ method: z.enum(['wechat', 'alipay', 'card']) }), req.body);
  const a = ownAppt(req);
  if (a.status === 'cancelled' && a.cancel_reason === 'payment_timeout') throw new HttpError(410, 'payment_expired', '支付已超时，订单已自动取消，请重新预约');
  if (a.status !== 'pending_payment') throw conflict(a.status === 'paid' ? '订单已支付' : '当前订单状态不能支付');
  const now = nowIso();
  if (a.pay_expires_at && a.pay_expires_at <= now) throw new HttpError(410, 'payment_expired', '支付已超时，订单已自动取消，请重新预约');

  const paymentId = id('p');
  const transactionNo = `${TXN_PREFIX[method]}${Date.now()}${String(randomInt(0, 10000)).padStart(4, '0')}`;
  tx(() => {
    const r = run(`UPDATE appointments SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending_payment'`, now, a.id);
    if (Number(r.changes) !== 1) throw conflict('当前订单状态不能支付');
    run('INSERT INTO payments (id, appointment_id, method, amount, status, transaction_no, created_at) VALUES (?,?,?,?,?,?,?)',
      paymentId, a.id, method, a.amount, 'succeeded', transactionNo, now);
    if (a.user_coupon_id) run(`UPDATE user_coupons SET status = 'used', used_at = ? WHERE id = ?`, now, a.user_coupon_id);
  });

  const appt = mustLoad(a.id);
  const when = `${fmtCn(appt.startAt)} ${modeLabel(appt.mode)}咨询`;
  notify(appt.userId, 'appointment', '预约成功', `${appt.counselor.name} · ${when}，开始前 10 分钟可进入咨询室。`, `/m/orders/${appt.id}`);
  const cu = counselorUserId(appt.counselor.id);
  if (cu) notify(cu, 'appointment', '新的预约', `${appt.client.name} 预约了 ${when}，可以提前查看来访者简报。`, `/desk/appointments/${appt.id}`);
  emit('appointment.paid', { appointmentId: appt.id });

  const out: PayRes = { appointment: appt, payment: { id: paymentId, method, amount: a.amount, transactionNo, paidAt: now } };
  res.json(out);
}));

// ---------- cancel / refund ----------
router.post('/appointments/:id/cancel', requireAuth, h((req, res) => {
  expireStalePending();
  const { reason } = parse(z.object({ reason: z.string().trim().max(200).optional() }), req.body ?? {});
  const a = ownAppt(req);
  const now = nowIso();
  if (a.status === 'pending_payment') {
    tx(() => {
      const r = run(`UPDATE appointments SET status = 'cancelled', cancel_reason = ?, cancelled_at = ? WHERE id = ? AND status = 'pending_payment'`,
        reason || 'user_cancelled', now, a.id);
      if (Number(r.changes) !== 1) throw conflict('订单状态已变化，请刷新');
      releaseSlot(a.slot_id);
      restoreCoupon(a.user_coupon_id);
    });
  } else if (a.status === 'paid') {
    if (new Date(a.start_at).getTime() - Date.now() <= DAY_MS) throw conflict('距离开始不足 24 小时，暂不支持取消，可以联系咨询师协商');
    tx(() => {
      const r = run(`UPDATE appointments SET status = 'refunded', cancel_reason = ?, cancelled_at = ? WHERE id = ? AND status = 'paid'`,
        reason || 'user_cancelled', now, a.id);
      if (Number(r.changes) !== 1) throw conflict('订单状态已变化，请刷新');
      run(`UPDATE payments SET status = 'refunded', refunded_at = ? WHERE appointment_id = ? AND status = 'succeeded'`, now, a.id);
      releaseSlot(a.slot_id);
      restoreCoupon(a.user_coupon_id);
    });
    emit('appointment.refunded', { appointmentId: a.id });
    const appt = mustLoad(a.id);
    notify(appt.userId, 'appointment', '已取消并退款', `${appt.counselor.name} · ${fmtCn(appt.startAt)} 的预约已取消，${appt.amount} 元将原路退回。`, `/m/orders/${appt.id}`);
    const cu = counselorUserId(appt.counselor.id);
    if (cu) notify(cu, 'appointment', '来访者取消了预约', `${appt.client.name} 取消了 ${fmtCn(appt.startAt)} 的预约，该时段已重新开放。`, '/desk');
  } else {
    throw conflict('当前订单状态不能取消');
  }
  const out: Appointment = mustLoad(a.id);
  res.json(out);
}));

// ---------- reschedule ----------
router.post('/appointments/:id/reschedule', requireAuth, h((req, res) => {
  expireStalePending();
  const { slotId } = parse(z.object({ slotId: z.string().min(1) }), req.body);
  const a = ownAppt(req);
  if (a.status !== 'paid') throw conflict('只有已支付的预约可以改约');
  if (new Date(a.start_at).getTime() - Date.now() <= DAY_MS) throw conflict('距离开始不足 24 小时，暂不支持改约');
  const slot = one('SELECT * FROM slots WHERE id = ?', slotId);
  if (!slot || slot.counselor_id !== a.counselor_id) throw notFound('时段不存在');
  if (slot.id === a.slot_id) throw badRequest('新时间和原时间相同');
  if (slot.start_at <= nowIso()) throw badRequest('这个时段已经开始了，换一个时间吧');
  if (slot.status !== 'open') throw slotTaken();
  tx(() => {
    const r = run(`UPDATE slots SET status = 'booked' WHERE id = ? AND status = 'open'`, slot.id);
    if (Number(r.changes) !== 1) throw slotTaken();
    releaseSlot(a.slot_id);
    run('UPDATE appointments SET slot_id = ?, start_at = ?, end_at = ? WHERE id = ?', slot.id, slot.start_at, slot.end_at, a.id);
  });
  const appt = mustLoad(a.id);
  notify(appt.userId, 'appointment', '改约成功', `${appt.counselor.name} · 新时间 ${fmtCn(appt.startAt)}`, `/m/orders/${appt.id}`);
  const cu = counselorUserId(appt.counselor.id);
  if (cu) notify(cu, 'appointment', '来访者改约', `${appt.client.name} 将 ${fmtCn(a.start_at)} 的预约改到 ${fmtCn(appt.startAt)}`, `/desk/appointments/${appt.id}`);
  const out: Appointment = appt;
  res.json(out);
}));

// ---------- review ----------
router.post('/appointments/:id/review', requireAuth, h((req, res) => {
  const body = parse(z.object({
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().max(500, '评价最多 500 字'),
    tags: z.array(z.string().trim().min(1).max(12)).max(8).optional(),
  }), req.body);
  const a = ownAppt(req);
  if (a.status !== 'completed') throw conflict('咨询完成后才能评价');
  if (a.reviewed || one('SELECT 1 FROM reviews WHERE appointment_id = ?', a.id)) throw conflict('这次咨询已经评价过了');
  const rid = id('r');
  const now = nowIso();
  tx(() => {
    run('INSERT INTO reviews (id, appointment_id, user_id, counselor_id, rating, content, tags, created_at) VALUES (?,?,?,?,?,?,?,?)',
      rid, a.id, a.user_id, a.counselor_id, body.rating, body.content, JSON.stringify(body.tags ?? []), now);
    run('UPDATE appointments SET reviewed = 1 WHERE id = ?', a.id);
    // Running average so seeded ratings stay consistent: new = (old × n + r) / (n + 1)
    run(`UPDATE counselors SET rating = ROUND((rating * review_count + ?) * 1.0 / (review_count + 1), 2), review_count = review_count + 1 WHERE id = ?`,
      body.rating, a.counselor_id);
  });
  const row = one('SELECT r.*, u.name AS u_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?', rid)!;
  const out: Review = toReview(row);
  res.status(201).json(out);
}));

// ---------- session room ----------
router.get('/appointments/:id/room', requireAuth, h((req, res) => {
  expireStalePending();
  const a = rawAppt(param(req));
  if (!canView(req, a)) throw forbidden('没有权限进入这个咨询室');
  const appt = mustLoad(a.id);
  const joinOpensAt = addMinutes(appt.startAt, -10);
  const now = nowIso();
  const active: AppointmentStatus[] = ['paid', 'in_session'];
  const out: SessionRoom = {
    appointment: appt,
    canJoin: active.includes(appt.status) && now >= joinOpensAt && now < appt.endAt,
    joinOpensAt,
    roomId: appt.id,
  };
  res.json(out);
}));

// ---------- complete (counselor) ----------
router.post('/appointments/:id/complete', requireRole('counselor'), h((req, res) => {
  const a = rawAppt(param(req));
  if (a.counselor_id !== me(req).counselorId) throw forbidden('只能结束自己的咨询');
  if (a.status !== 'paid' && a.status !== 'in_session') throw conflict('当前订单状态不能结束咨询');
  const now = nowIso();
  tx(() => {
    const r = run(`UPDATE appointments SET status = 'completed', completed_at = ? WHERE id = ? AND status IN ('paid','in_session')`, now, a.id);
    if (Number(r.changes) !== 1) throw conflict('订单状态已变化，请刷新');
    run('UPDATE counselors SET sessions_count = sessions_count + 1 WHERE id = ?', a.counselor_id);
  });
  const appt = mustLoad(a.id);
  emit('appointment.completed', { appointmentId: appt.id });
  notify(appt.userId, 'review', '咨询已结束，来评价一下吧', `和 ${appt.counselor.name} 的咨询已结束，你的评价会帮助更多人找到合适的咨询师。`, `/m/orders/${appt.id}`);
  const out: Appointment = appt;
  res.json(out);
}));
