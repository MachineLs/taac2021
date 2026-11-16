import { describe, it, expect, beforeEach } from 'vitest';
import { setup, PHONES } from './helpers';
import { one, run } from '../src/core/db';
import { emit } from '../src/core/events';
import { cnDate, id, nowIso, addDays } from '../src/core/util';

let ctx: ReturnType<typeof setup>;
beforeEach(() => { ctx = setup(); });
const creatorRow = (code = 'AYU2026') => one('SELECT * FROM creators WHERE ref_code = ?', code)!;

/** A referred user with a fresh paid-ish appointment attributed to the creator (as B1 would create it). */
function makeOrder(creatorId: string | null, amount = 300, status = 'paid') {
  const uid = id('u');
  run('INSERT INTO users (id, phone, name, roles, referred_by_creator_id, created_at) VALUES (?,?,?,?,?,?)', uid, '1770000' + Math.floor(Math.random() * 1e4).toString().padStart(4, '0'), '新用户', '["client"]', creatorId, nowIso());
  const c = one("SELECT id FROM counselors WHERE status = 'approved' LIMIT 1")!;
  const start = addDays(nowIso(), 3);
  const sid = id('s');
  run('INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,?)', sid, c.id, start, addDays(start, 0.04), 'booked');
  const aid = id('a');
  run(`INSERT INTO appointments (id, user_id, counselor_id, slot_id, start_at, end_at, mode, status, price, discount, amount, creator_id, created_at, paid_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, aid, uid, c.id, sid, start, addDays(start, 0.04), 'voice', status, amount + 100, 100, amount, creatorId, nowIso(), nowIso());
  return aid;
}

describe('creator landing', () => {
  it('serves the public creator profile, recommended counselors and records visits', async () => {
    const r = await ctx.api.get('/api/creators/AYU2026');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: '睡眠研究所阿屿', refCode: 'AYU2026', commissionRate: 0.1, platform: '抖音' });
    expect((await ctx.api.get('/api/creators/ayu2026')).status).toBe(200);
    expect((await ctx.api.get('/api/creators/NOPE')).status).toBe(404);

    const cs = await ctx.api.get('/api/creators/AYU2026/counselors');
    expect(cs.body.map((c: any) => c.name)).toEqual(['林知夏', '何清', '陈牧']);
    expect(cs.body[0]).toHaveProperty('nextAvailableAt');

    const before = one('SELECT COUNT(*) AS n FROM referral_visits WHERE creator_id = ?', creatorRow().id)!.n;
    expect((await ctx.api.post('/api/creators/AYU2026/visit')).body).toEqual({ ok: true });
    expect(one('SELECT COUNT(*) AS n FROM referral_visits WHERE creator_id = ?', creatorRow().id)!.n).toBe(before + 1);
    expect((await ctx.api.post('/api/creators/NOPE/visit')).status).toBe(404);
  });
});

describe('creator stats', () => {
  it('requires the creator role and reports funnel + commissions', async () => {
    expect((await ctx.api.get('/api/creator/stats')).status).toBe(401);
    expect((await ctx.api.get('/api/creator/stats').set('Authorization', ctx.tokenFor(PHONES.client))).status).toBe(403);
    const r = await ctx.api.get('/api/creator/stats').set('Authorization', ctx.tokenFor(PHONES.creator));
    expect(r.status).toBe(200);
    const s = r.body;
    const cid = creatorRow().id;
    expect(s.creator.refCode).toBe('AYU2026');
    expect(s.visits).toBe(one('SELECT COUNT(*) AS n FROM referral_visits WHERE creator_id = ?', cid)!.n);
    expect(s.signups).toBe(one('SELECT COUNT(*) AS n FROM users WHERE referred_by_creator_id = ?', cid)!.n);
    expect(s.intakes).toBeGreaterThan(0);
    expect(s.firstOrders).toBe(one("SELECT COUNT(*) AS n FROM appointments WHERE creator_id = ? AND status IN ('paid','in_session','completed')", cid)!.n);
    expect(s.commissionTotal).toBe(one('SELECT SUM(amount) AS n FROM commissions WHERE creator_id = ?', cid)!.n);
    expect(s.commissionPending).toBe(one("SELECT SUM(amount) AS n FROM commissions WHERE creator_id = ? AND status = 'pending'", cid)!.n);
    expect(s.commissionPending).toBeLessThan(s.commissionTotal);
    expect(s.daily).toHaveLength(30);
    expect(s.daily[29].date).toBe(cnDate(nowIso()));
    expect(s.daily[0].date < s.daily[29].date).toBe(true);
    expect(s.daily.reduce((a: number, d: any) => a + d.visits, 0)).toBe(s.visits);
    expect(s.daily.reduce((a: number, d: any) => a + d.orders, 0)).toBeGreaterThan(0);
    expect(s.commissions.length).toBe(one('SELECT COUNT(*) AS n FROM commissions WHERE creator_id = ?', cid)!.n);
    expect(s.commissions[0].createdAt >= s.commissions[1].createdAt).toBe(true);
  });
});

describe('commission listeners', () => {
  it('accrues commission on appointment.paid once, rounding amount × rate', async () => {
    const cr = creatorRow();
    const aid = makeOrder(cr.id, 355);
    emit('appointment.paid', { appointmentId: aid });
    emit('appointment.paid', { appointmentId: aid });
    const rows = one('SELECT COUNT(*) AS n, SUM(amount) AS s FROM commissions WHERE appointment_id = ?', aid)!;
    expect(rows.n).toBe(1);
    expect(rows.s).toBe(36);                              // round(35.5)
    expect(one("SELECT status FROM commissions WHERE appointment_id = ?", aid)!.status).toBe('pending');
    expect(one("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'commission'", cr.user_id)!.n).toBe(1);

    const stats = (await ctx.api.get('/api/creator/stats').set('Authorization', ctx.tokenFor(PHONES.creator))).body;
    expect(stats.commissions[0].appointmentId).toBe(aid);
    expect(stats.daily[29].orders).toBeGreaterThanOrEqual(1);
  });

  it('ignores orders without a creator', () => {
    const aid = makeOrder(null);
    emit('appointment.paid', { appointmentId: aid });
    expect(one('SELECT COUNT(*) AS n FROM commissions WHERE appointment_id = ?', aid)!.n).toBe(0);
    emit('appointment.paid', { appointmentId: 'a_missing' });
  });

  it('voids the pending commission on appointment.refunded; settled ones stay', async () => {
    const cr = creatorRow();
    const token = ctx.tokenFor(PHONES.creator);
    const before = (await ctx.api.get('/api/creator/stats').set('Authorization', token)).body;
    const aid = makeOrder(cr.id, 300);
    emit('appointment.paid', { appointmentId: aid });
    const mid = (await ctx.api.get('/api/creator/stats').set('Authorization', token)).body;
    expect(mid.commissionTotal).toBe(before.commissionTotal + 30);
    expect(mid.commissionPending).toBe(before.commissionPending + 30);

    run("UPDATE appointments SET status = 'refunded' WHERE id = ?", aid);
    emit('appointment.refunded', { appointmentId: aid });
    expect(one('SELECT COUNT(*) AS n FROM commissions WHERE appointment_id = ?', aid)!.n).toBe(0);
    const after = (await ctx.api.get('/api/creator/stats').set('Authorization', token)).body;
    expect(after.commissionTotal).toBe(before.commissionTotal);
    expect(after.commissionPending).toBe(before.commissionPending);
    expect(after.firstOrders).toBe(before.firstOrders);

    const settled = one("SELECT appointment_id FROM commissions WHERE creator_id = ? AND status = 'settled' LIMIT 1", cr.id)!.appointment_id;
    emit('appointment.refunded', { appointmentId: settled });
    expect(one('SELECT COUNT(*) AS n FROM commissions WHERE appointment_id = ?', settled)!.n).toBe(1);
  });
});

describe('admin ops', () => {
  it('is admin-only', async () => {
    for (const [method, path] of [['get', '/api/admin/overview'], ['get', '/api/admin/crisis'], ['patch', '/api/admin/crisis/x'], ['get', '/api/admin/creators']] as const) {
      expect((await (ctx.api as any)[method](path)).status, path).toBe(401);
      expect((await (ctx.api as any)[method](path).set('Authorization', ctx.tokenFor(PHONES.client))).status, path).toBe(403);
      expect((await (ctx.api as any)[method](path).set('Authorization', ctx.tokenFor(PHONES.creator))).status, path).toBe(403);
    }
  });

  it('overview aggregates the platform with a 14-day CN-date series', async () => {
    const r = await ctx.api.get('/api/admin/overview').set('Authorization', ctx.tokenFor(PHONES.admin));
    expect(r.status).toBe(200);
    const o = r.body;
    expect(o.users).toBe(one('SELECT COUNT(*) AS n FROM users')!.n);
    expect(o.counselors).toEqual({ approved: 12, pending: 1 });
    expect(o.appointments.paid).toBe(1);
    expect(o.appointments.completed).toBeGreaterThan(10);
    expect(o.gmv).toBe(one("SELECT SUM(amount) AS n FROM appointments WHERE status IN ('paid','in_session','completed')")!.n);
    expect(o.intakes).toBe(one('SELECT COUNT(*) AS n FROM intake_sessions')!.n);
    expect(o.openCrisis).toBe(1);
    expect(o.daily).toHaveLength(14);
    expect(o.daily[13].date).toBe(cnDate(nowIso()));
    expect(o.daily.reduce((a: number, d: any) => a + d.gmv, 0)).toBeGreaterThan(0);
    expect(o.daily.reduce((a: number, d: any) => a + d.intakes, 0)).toBeGreaterThan(0);
  });

  it('lists and updates crisis alerts', async () => {
    const admin = ctx.tokenFor(PHONES.admin);
    // create one bound to a user via the intake flow
    const client = ctx.tokenFor(PHONES.client);
    const s = (await ctx.api.post('/api/intake/sessions').set('Authorization', client)).body;
    await ctx.api.post(`/api/intake/sessions/${s.id}/reply`).set('Authorization', client).send({ content: '我想结束自己的生命' });

    const list = await ctx.api.get('/api/admin/crisis').set('Authorization', admin);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    const mine = list.body.find((a: any) => a.sessionId === s.id);
    expect(mine.user).toMatchObject({ name: '小周', phone: PHONES.client });
    expect(mine.source).toBe('intake');
    expect(list.body.find((a: any) => a.sessionId !== s.id).user).toBeNull();

    const p = await ctx.api.patch(`/api/admin/crisis/${mine.id}`).set('Authorization', admin).send({ status: 'handling' });
    expect(p.status).toBe(200);
    expect(p.body.status).toBe('handling');
    expect(p.body.handledBy).toBe(one('SELECT id FROM users WHERE phone = ?', PHONES.admin)!.id);
    expect((await ctx.api.get('/api/admin/crisis?status=open').set('Authorization', admin)).body).toHaveLength(1);
    expect((await ctx.api.get('/api/admin/crisis?status=handling').set('Authorization', admin)).body.map((a: any) => a.id)).toEqual([mine.id]);
    expect((await ctx.api.get('/api/admin/crisis?status=bogus').set('Authorization', admin)).status).toBe(400);
    expect((await ctx.api.patch(`/api/admin/crisis/${mine.id}`).set('Authorization', admin).send({ status: 'open' })).status).toBe(400);
    expect((await ctx.api.patch('/api/admin/crisis/ca_nope').set('Authorization', admin).send({ status: 'resolved' })).status).toBe(404);
  });

  it('lists creators with first orders and commission totals', async () => {
    const r = await ctx.api.get('/api/admin/creators').set('Authorization', ctx.tokenFor(PHONES.admin));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(3);
    const ayu = r.body.find((c: any) => c.refCode === 'AYU2026');
    const stats = (await ctx.api.get('/api/creator/stats').set('Authorization', ctx.tokenFor(PHONES.creator))).body;
    expect(ayu.firstOrders).toBe(stats.firstOrders);
    expect(ayu.commissionTotal).toBe(stats.commissionTotal);
  });
});

describe('commission end-to-end with the B1 order flow', () => {
  it('referred signup → first order paid → commission; refund voids it', async () => {
    const phone = '17712345678';
    await ctx.api.post('/api/auth/send-code').send({ phone });
    const login = await ctx.api.post('/api/auth/login').send({ phone, code: '123456', refCode: 'WORK2026' });
    expect(login.status).toBe(200);
    const token = `Bearer ${login.body.token}`;
    const cr = creatorRow('WORK2026');
    const counselor = one("SELECT id, price FROM counselors WHERE name = '方宁'")!;
    const slot = one("SELECT id FROM slots WHERE counselor_id = ? AND status = 'open' AND start_at > ? ORDER BY start_at LIMIT 1", counselor.id, addDays(nowIso(), 3))!;
    const appt = await ctx.api.post('/api/appointments').set('Authorization', token).send({ counselorId: counselor.id, slotId: slot.id, mode: 'video' });
    expect(appt.status).toBeLessThan(300);
    expect(appt.body.creatorId).toBe(cr.id);
    const pay = await ctx.api.post(`/api/appointments/${appt.body.id}/pay`).set('Authorization', token).send({ method: 'wechat' });
    expect(pay.status).toBe(200);
    const cm = one('SELECT * FROM commissions WHERE appointment_id = ?', appt.body.id)!;
    expect(cm.creator_id).toBe(cr.id);
    expect(cm.amount).toBe(Math.round(pay.body.appointment.amount * 0.1));

    const cancel = await ctx.api.post(`/api/appointments/${appt.body.id}/cancel`).set('Authorization', token).send({});
    expect(cancel.body.status).toBe('refunded');
    expect(one('SELECT COUNT(*) AS n FROM commissions WHERE appointment_id = ?', appt.body.id)!.n).toBe(0);
  });
});
