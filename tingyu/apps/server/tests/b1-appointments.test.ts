import { describe, it, expect, beforeEach } from 'vitest';
import type { Appointment, PayRes } from '@tingyu/shared';
import { setup, PHONES } from './helpers';
import { one, all, run } from '../src/core/db';
import { id } from '../src/core/util';
import { on } from '../src/core/events';

let ctx: ReturnType<typeof setup>;
let lin: { id: string; price: number };
beforeEach(() => {
  ctx = setup();
  lin = one(`SELECT id, price FROM counselors WHERE name = '林知夏'`) as { id: string; price: number };
});

/** Insert an open slot `hours` from now for a counselor. */
let slotSeq = 0;
function mkSlot(counselorId: string, hours: number, status = 'open') {
  const start = new Date(Date.now() + hours * 3600000);
  start.setUTCSeconds(++slotSeq % 60, 0);   // unique start, never collides with seeded :00 slots
  const s = id('s');
  run('INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,?)', s, counselorId, start.toISOString(),
    new Date(start.getTime() + 50 * 60000).toISOString(), status);
  return s;
}
/** Fresh client via login (gets NEW100). */
async function newClient(phone = '13855550001', refCode?: string) {
  const r = await ctx.api.post('/api/auth/login').send({ phone, code: '123456', refCode });
  const auth = `Bearer ${r.body.token}`;
  const coupons = (await ctx.api.get('/api/coupons/mine').set('Authorization', auth)).body;
  return { auth, userId: r.body.user.id as string, couponId: coupons[0]?.id as string };
}
const book = (auth: string, body: Record<string, unknown>) => ctx.api.post('/api/appointments').set('Authorization', auth).send(body);
const pay = (auth: string, aid: string, method = 'wechat') => ctx.api.post(`/api/appointments/${aid}/pay`).set('Authorization', auth).send({ method });

describe('B1 appointments', () => {
  it('book → pay → refund (>24h) with coupon, attribution, notifications and event', async () => {
    const { api } = ctx;
    const paidEvents: string[] = [];
    on('appointment.paid', (p) => paidEvents.push(p.appointmentId));
    const c = await newClient('13855550001', 'AYU2026');
    const slotId = mkSlot(lin.id, 72);

    const r = await book(c.auth, { counselorId: lin.id, slotId, mode: 'voice', couponId: c.couponId, shareIntake: true });
    expect(r.status).toBe(201);
    const a = r.body as Appointment;
    expect(a).toMatchObject({ status: 'pending_payment', price: 400, discount: 100, amount: 300, couponId: c.couponId, shareIntake: true, reviewed: false });
    expect(a.creatorId).toBe(one(`SELECT id FROM creators WHERE ref_code = 'AYU2026'`)!.id);
    const ttl = new Date(a.payExpiresAt!).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60000);
    expect(ttl).toBeLessThanOrEqual(15 * 60000);
    expect(one('SELECT status FROM slots WHERE id = ?', slotId)!.status).toBe('booked');

    const p = await pay(c.auth, a.id, 'alipay');
    expect(p.status).toBe(200);
    const pr = p.body as PayRes;
    expect(pr.appointment.status).toBe('paid');
    expect(pr.payment).toMatchObject({ method: 'alipay', amount: 300 });
    expect(pr.payment.transactionNo).toMatch(/^ALI\d+/);
    expect(paidEvents).toEqual([a.id]);
    expect(one('SELECT status FROM user_coupons WHERE id = ?', c.couponId)!.status).toBe('used');
    const linUser = one('SELECT user_id FROM counselors WHERE id = ?', lin.id)!.user_id;
    expect(all('SELECT * FROM notifications WHERE user_id = ? AND type = ?', c.userId, 'appointment')).toHaveLength(1);
    expect(all(`SELECT * FROM notifications WHERE user_id = ? AND title = '新的预约'`, linUser)).toHaveLength(1);
    expect((await pay(c.auth, a.id)).status).toBe(409);              // already paid

    // list & get
    expect((await api.get('/api/appointments').query({ status: 'paid' }).set('Authorization', c.auth)).body.map((x: Appointment) => x.id)).toEqual([a.id]);
    expect((await api.get(`/api/appointments/${a.id}`).set('Authorization', ctx.tokenFor(PHONES.counselor))).status).toBe(200);
    expect((await api.get(`/api/appointments/${a.id}`).set('Authorization', ctx.tokenFor(PHONES.admin))).status).toBe(200);
    expect((await api.get(`/api/appointments/${a.id}`).set('Authorization', ctx.tokenFor(PHONES.client))).status).toBe(403);
    expect((await api.get(`/api/appointments/${a.id}`).set('Authorization', ctx.tokenFor('13900000002'))).status).toBe(403);

    // refund
    const cancel = await api.post(`/api/appointments/${a.id}/cancel`).set('Authorization', c.auth).send({ reason: '临时出差' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('refunded');
    expect(cancel.body.cancelledAt).toBeTruthy();
    expect(one('SELECT status, refunded_at FROM payments WHERE appointment_id = ?', a.id)).toMatchObject({ status: 'refunded' });
    expect(one('SELECT status FROM slots WHERE id = ?', slotId)!.status).toBe('open');
    expect(one('SELECT status, used_at FROM user_coupons WHERE id = ?', c.couponId)).toMatchObject({ status: 'unused', used_at: null });
    expect((await api.post(`/api/appointments/${a.id}/cancel`).set('Authorization', c.auth).send({})).status).toBe(409);
  });

  it('paid order within 24h cannot be cancelled; unpaid order cancels directly', async () => {
    const { api } = ctx;
    const c = await newClient();
    const soon = mkSlot(lin.id, 5);
    const a = (await book(c.auth, { counselorId: lin.id, slotId: soon, mode: 'video', couponId: c.couponId })).body as Appointment;
    // unpaid → cancelled, slot released, coupon back
    const x = await api.post(`/api/appointments/${a.id}/cancel`).set('Authorization', c.auth).send({});
    expect(x.body.status).toBe('cancelled');
    expect(one('SELECT status FROM slots WHERE id = ?', soon)!.status).toBe('open');
    expect(one('SELECT status FROM user_coupons WHERE id = ?', c.couponId)!.status).toBe('unused');

    const b = (await book(c.auth, { counselorId: lin.id, slotId: soon, mode: 'video' })).body as Appointment;
    await pay(c.auth, b.id);
    const y = await api.post(`/api/appointments/${b.id}/cancel`).set('Authorization', c.auth).send({});
    expect(y.status).toBe(409);
    expect(y.body.error.code).toBe('conflict');
  });

  it('second booking of the same slot → 409 slot_taken', async () => {
    const c1 = await newClient('13855550001');
    const c2 = await newClient('13855550002');
    const slotId = mkSlot(lin.id, 48);
    expect((await book(c1.auth, { counselorId: lin.id, slotId, mode: 'voice' })).status).toBe(201);
    const r = await book(c2.auth, { counselorId: lin.id, slotId, mode: 'voice' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('slot_taken');
    expect(all('SELECT * FROM appointments WHERE slot_id = ?', slotId)).toHaveLength(1);
  });

  it('validates slot ownership, time, mode and intake session', async () => {
    const c = await newClient();
    const he = one(`SELECT id FROM counselors WHERE name = '何清'`)!.id;
    const other = mkSlot(he, 48);
    expect((await book(c.auth, { counselorId: lin.id, slotId: other, mode: 'voice' })).status).toBe(404);
    const past = mkSlot(lin.id, -2);
    expect((await book(c.auth, { counselorId: lin.id, slotId: past, mode: 'voice' })).status).toBe(400);
    const blocked = mkSlot(lin.id, 30, 'blocked');
    expect((await book(c.auth, { counselorId: lin.id, slotId: blocked, mode: 'voice' })).body.error.code).toBe('slot_taken');
    const ok = mkSlot(lin.id, 30);
    expect((await book(c.auth, { counselorId: lin.id, slotId: ok, mode: 'offline' })).status).toBe(400);   // 林知夏 has no offline
    const zhouIntake = one(`SELECT i.id FROM intake_sessions i JOIN users u ON u.id = i.user_id WHERE u.phone = ?`, PHONES.client)!.id;
    expect((await book(c.auth, { counselorId: lin.id, slotId: ok, mode: 'voice', intakeSessionId: zhouIntake })).status).toBe(400);
    expect((await book(c.auth, { counselorId: lin.id, slotId: ok, mode: 'nope' })).status).toBe(400);
    expect((await ctx.api.post('/api/appointments').send({ counselorId: lin.id, slotId: ok, mode: 'voice' })).status).toBe(401);
    expect(one('SELECT status FROM slots WHERE id = ?', ok)!.status).toBe('open');
  });

  it('coupon rules: owner, min spend, expiry, single pending use', async () => {
    const c = await newClient('13855550001');
    const c2 = await newClient('13855550002');
    const s1 = mkSlot(lin.id, 30);
    // someone else's coupon
    expect((await book(c2.auth, { counselorId: lin.id, slotId: s1, mode: 'voice', couponId: c.couponId })).status).toBe(400);
    // min spend: 顾言 costs 300 = min spend OK; make a cheap counselor price to fail
    const gu = one(`SELECT id FROM counselors WHERE name = '顾言'`)!.id;
    run('UPDATE counselors SET price = 200 WHERE id = ?', gu);
    const g = mkSlot(gu, 30);
    const minSpend = await book(c.auth, { counselorId: gu, slotId: g, mode: 'voice', couponId: c.couponId });
    expect(minSpend.status).toBe(400);
    expect(minSpend.body.error.message).toContain('300');
    // used on one pending order → cannot be reused on another
    expect((await book(c.auth, { counselorId: lin.id, slotId: s1, mode: 'voice', couponId: c.couponId })).status).toBe(201);
    const s2 = mkSlot(lin.id, 31);
    expect((await book(c.auth, { counselorId: lin.id, slotId: s2, mode: 'voice', couponId: c.couponId })).status).toBe(409);
    // expired coupon
    run(`UPDATE user_coupons SET expires_at = ? WHERE id = ?`, new Date(Date.now() - 1000).toISOString(), c2.couponId);
    expect((await book(c2.auth, { counselorId: lin.id, slotId: s2, mode: 'voice', couponId: c2.couponId })).status).toBe(400);
    const mine = (await ctx.api.get('/api/coupons/mine').set('Authorization', c2.auth)).body;
    expect(mine[0].status).toBe('expired');
  });

  it('claim coupons: once per user; new-user-only coupons need no paid order', async () => {
    const { api, tokenFor } = ctx;
    const c = await newClient();
    const dup = await api.post('/api/coupons/claim').set('Authorization', c.auth).send({ code: 'NEW100' });
    expect(dup.status).toBe(409);
    const w = await api.post('/api/coupons/claim').set('Authorization', c.auth).send({ code: 'week50' });
    expect(w.status).toBe(201);
    expect(w.body).toMatchObject({ title: '周末关怀券 50 元', amount: 50, minSpend: 400, status: 'unused' });
    expect((await api.post('/api/coupons/claim').set('Authorization', c.auth).send({ code: 'NOPE' })).status).toBe(404);
    // a seeded user with history (completed orders) but no NEW100 cannot claim it
    const veteran = one(`SELECT u.phone FROM users u JOIN appointments a ON a.user_id = u.id WHERE a.status = 'completed' LIMIT 1`)!.phone;
    const v = await api.post('/api/coupons/claim').set('Authorization', tokenFor(veteran)).send({ code: 'NEW100' });
    expect(v.status).toBe(409);
    // the admin has no orders → can claim
    expect((await api.post('/api/coupons/claim').set('Authorization', tokenFor(PHONES.admin)).send({ code: 'NEW100' })).status).toBe(201);
  });

  it('unpaid orders time out: cancelled, slot released, coupon returned; paying → 410', async () => {
    const { api } = ctx;
    const c = await newClient();
    const slotId = mkSlot(lin.id, 30);
    const a = (await book(c.auth, { counselorId: lin.id, slotId, mode: 'voice', couponId: c.couponId })).body as Appointment;
    run('UPDATE appointments SET pay_expires_at = ? WHERE id = ?', new Date(Date.now() - 1000).toISOString(), a.id);
    // any slot read triggers expiry
    const slots = (await api.get(`/api/counselors/${lin.id}/slots`)).body as { id: string; status: string }[];
    expect(slots.find((s) => s.id === slotId)?.status).toBe('open');
    expect(one('SELECT status, cancel_reason FROM appointments WHERE id = ?', a.id)).toMatchObject({ status: 'cancelled', cancel_reason: 'payment_timeout' });
    const p = await pay(c.auth, a.id);
    expect(p.status).toBe(410);
    expect(p.body.error.code).toBe('payment_expired');
    // the coupon can be used again
    expect((await book(c.auth, { counselorId: lin.id, slotId, mode: 'voice', couponId: c.couponId })).status).toBe(201);
  });

  it('reschedule a paid order (>24h) to another open slot of the same counselor', async () => {
    const { api } = ctx;
    const c = await newClient();
    const s1 = mkSlot(lin.id, 50);
    const s2 = mkSlot(lin.id, 74);
    const a = (await book(c.auth, { counselorId: lin.id, slotId: s1, mode: 'voice' })).body as Appointment;
    expect((await api.post(`/api/appointments/${a.id}/reschedule`).set('Authorization', c.auth).send({ slotId: s2 })).status).toBe(409); // unpaid
    await pay(c.auth, a.id);
    const he = one(`SELECT id FROM counselors WHERE name = '何清'`)!.id;
    expect((await api.post(`/api/appointments/${a.id}/reschedule`).set('Authorization', c.auth).send({ slotId: mkSlot(he, 80) })).status).toBe(404);
    const r = await api.post(`/api/appointments/${a.id}/reschedule`).set('Authorization', c.auth).send({ slotId: s2 });
    expect(r.status).toBe(200);
    expect(r.body.slotId).toBe(s2);
    expect(r.body.status).toBe('paid');
    expect(one('SELECT status FROM slots WHERE id = ?', s1)!.status).toBe('open');
    expect(one('SELECT status FROM slots WHERE id = ?', s2)!.status).toBe('booked');
    // within 24h: refuse
    const s3 = mkSlot(lin.id, 10);
    run('UPDATE appointments SET start_at = ? WHERE id = ?', new Date(Date.now() + 5 * 3600000).toISOString(), a.id);
    expect((await api.post(`/api/appointments/${a.id}/reschedule`).set('Authorization', c.auth).send({ slotId: s3 })).status).toBe(409);
  });

  it('room, complete by counselor, review updates rating', async () => {
    const { api, tokenFor } = ctx;
    const completed: string[] = [];
    on('appointment.completed', (p) => completed.push(p.appointmentId));
    const c = await newClient();
    const s = mkSlot(lin.id, 0.1);    // starts in 6 minutes → room open
    const a = (await book(c.auth, { counselorId: lin.id, slotId: s, mode: 'voice' })).body as Appointment;
    let room = (await api.get(`/api/appointments/${a.id}/room`).set('Authorization', c.auth)).body;
    expect(room.canJoin).toBe(false);   // unpaid
    await pay(c.auth, a.id);
    room = (await api.get(`/api/appointments/${a.id}/room`).set('Authorization', c.auth)).body;
    expect(room).toMatchObject({ canJoin: true, roomId: a.id });
    expect((await api.get(`/api/appointments/${a.id}/room`).set('Authorization', tokenFor(PHONES.counselor))).body.canJoin).toBe(true);
    expect((await api.get(`/api/appointments/${a.id}/room`).set('Authorization', tokenFor(PHONES.client))).status).toBe(403);
    const later = mkSlot(lin.id, 30);
    const b = (await book(c.auth, { counselorId: lin.id, slotId: later, mode: 'voice' })).body as Appointment;
    await pay(c.auth, b.id);
    expect((await api.get(`/api/appointments/${b.id}/room`).set('Authorization', c.auth)).body.canJoin).toBe(false);

    // review before completion
    expect((await api.post(`/api/appointments/${a.id}/review`).set('Authorization', c.auth).send({ rating: 5, content: '好' })).status).toBe(409);
    // complete: only that counselor
    expect((await api.post(`/api/appointments/${a.id}/complete`).set('Authorization', c.auth)).status).toBe(403);
    expect((await api.post(`/api/appointments/${a.id}/complete`).set('Authorization', tokenFor('13900000002'))).status).toBe(403);
    const before = one('SELECT sessions_count, rating, review_count FROM counselors WHERE id = ?', lin.id)!;
    const done = await api.post(`/api/appointments/${a.id}/complete`).set('Authorization', tokenFor(PHONES.counselor));
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('completed');
    expect(completed).toEqual([a.id]);
    expect(one('SELECT sessions_count FROM counselors WHERE id = ?', lin.id)!.sessions_count).toBe(before.sessions_count + 1);
    expect(one(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'review'`, c.userId)).toBeTruthy();
    expect((await api.post(`/api/appointments/${a.id}/complete`).set('Authorization', tokenFor(PHONES.counselor))).status).toBe(409);

    // review
    expect((await api.post(`/api/appointments/${a.id}/review`).set('Authorization', c.auth).send({ rating: 6, content: 'x' })).status).toBe(400);
    const rv = await api.post(`/api/appointments/${a.id}/review`).set('Authorization', c.auth).send({ rating: 1, content: '还可以', tags: ['耐心'] });
    expect(rv.status).toBe(201);
    expect(rv.body).toMatchObject({ counselorId: lin.id, rating: 1, content: '还可以', tags: ['耐心'], userName: '用**' });
    const after = one('SELECT rating, review_count FROM counselors WHERE id = ?', lin.id)!;
    expect(after.review_count).toBe(before.review_count + 1);
    const expected = Math.round(((before.rating * before.review_count + 1) / (before.review_count + 1)) * 100) / 100;
    expect(after.rating).toBeCloseTo(expected, 2);
    expect((await api.get(`/api/appointments/${a.id}`).set('Authorization', c.auth)).body.reviewed).toBe(true);
    expect((await api.post(`/api/appointments/${a.id}/review`).set('Authorization', c.auth).send({ rating: 5, content: '再评' })).status).toBe(409);
    const list = (await api.get(`/api/counselors/${lin.id}/reviews`)).body;
    expect(list.items[0].id).toBe(rv.body.id);
  });

  it('second order of a referred user is not attributed', async () => {
    const c = await newClient('13855550009', 'WORK2026');
    const a = (await book(c.auth, { counselorId: lin.id, slotId: mkSlot(lin.id, 40), mode: 'voice' })).body as Appointment;
    expect(a.creatorId).toBeTruthy();
    await pay(c.auth, a.id);
    const b = (await book(c.auth, { counselorId: lin.id, slotId: mkSlot(lin.id, 60), mode: 'voice' })).body as Appointment;
    expect(b.creatorId).toBeNull();
  });
});
