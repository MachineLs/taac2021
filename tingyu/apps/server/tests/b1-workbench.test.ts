import { describe, it, expect, beforeEach } from 'vitest';
import type { Appointment, ClientBrief, Slot } from '@tingyu/shared';
import { setup, PHONES } from './helpers';
import { one, all, run } from '../src/core/db';
import { id } from '../src/core/util';

let ctx: ReturnType<typeof setup>;
let lin: string;
beforeEach(() => {
  ctx = setup();
  lin = one(`SELECT id FROM counselors WHERE name = '林知夏'`)!.id;
});
/** China-time hour on CN day (today + dayOffset); hours 7/23 are never used by seed slots. */
const cnAt = (dayOffset: number, hour: number) => {
  const cnNow = new Date(Date.now() + 8 * 3600000);
  return new Date(Date.UTC(cnNow.getUTCFullYear(), cnNow.getUTCMonth(), cnNow.getUTCDate() + dayOffset, hour - 8)).toISOString();
};
const zhouAppt = () => one(`SELECT a.id FROM appointments a JOIN users u ON u.id = a.user_id WHERE u.phone = ? AND a.status = 'paid'`, PHONES.client)!.id as string;

describe('B1 workbench', () => {
  it('requires counselor role', async () => {
    const { api, tokenFor } = ctx;
    expect((await api.get('/api/workbench/appointments')).status).toBe(401);
    expect((await api.get('/api/workbench/appointments').set('Authorization', tokenFor(PHONES.client))).status).toBe(403);
    expect((await api.get('/api/workbench/slots').set('Authorization', tokenFor(PHONES.admin))).status).toBe(403);
    expect((await api.get('/api/workbench/earnings').set('Authorization', tokenFor(PHONES.counselor))).status).toBe(200);
  });

  it('lists my appointments and builds the client brief (shared intake, latest scales, notes, source)', async () => {
    const { api, tokenFor } = ctx;
    const t = tokenFor(PHONES.counselor);
    const list = (await api.get('/api/workbench/appointments').set('Authorization', t)).body as Appointment[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.counselor.id === lin)).toBe(true);
    const aid = zhouAppt();
    expect(list.some((a) => a.id === aid)).toBe(true);

    // another counselor cannot see the brief
    expect((await api.get(`/api/workbench/appointments/${aid}/brief`).set('Authorization', tokenFor('13900000002'))).status).toBe(403);

    // add an older + newer phq9 result to check "latest per scale"
    const zhou = one('SELECT id FROM users WHERE phone = ?', PHONES.client)!.id;
    run(`INSERT INTO assessment_results (id, user_id, scale, answers, score, max, level, interpretation, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      id('ar'), zhou, 'phq9', '[]', 4, 27, '正常', '无明显抑郁症状', new Date().toISOString());

    const note = await api.post(`/api/workbench/appointments/${aid}/notes`).set('Authorization', t).send({ content: '首次咨询：关注睡眠' });
    expect(note.status).toBe(200);
    expect(note.body.content).toBe('首次咨询：关注睡眠');
    const note2 = await api.post(`/api/workbench/appointments/${aid}/notes`).set('Authorization', t).send({ content: '更新：加上 CBT-I 计划' });
    expect(note2.body.id).toBe(note.body.id);
    expect((await api.post(`/api/workbench/appointments/${aid}/notes`).set('Authorization', t).send({ content: '' })).status).toBe(400);

    const brief = (await api.get(`/api/workbench/appointments/${aid}/brief`).set('Authorization', t)).body as ClientBrief;
    expect(brief.appointment.id).toBe(aid);
    expect(brief.intake?.mood).toBe('焦虑 · 疲惫');
    expect(brief.assessments.map((r) => r.scale).sort()).toEqual(['gad7', 'isi', 'phq9']);
    expect(brief.assessments.find((r) => r.scale === 'phq9')!.score).toBe(4);
    expect(brief.notes).toHaveLength(1);
    expect(brief.notes[0].content).toBe('更新：加上 CBT-I 计划');
    expect(brief.source).toEqual({ creatorName: '睡眠研究所阿屿' });

    // without consent: no intake/assessments
    run('UPDATE appointments SET share_intake = 0 WHERE id = ?', aid);
    const b2 = (await api.get(`/api/workbench/appointments/${aid}/brief`).set('Authorization', t)).body as ClientBrief;
    expect(b2.intake).toBeNull();
    expect(b2.assessments).toEqual([]);
    expect(b2.notes).toHaveLength(1);
  });

  it('manages slots: batch add (dedupe, no past), list, delete open only', async () => {
    const { api, tokenFor } = ctx;
    const t = tokenFor(PHONES.counselor);
    const a = cnAt(3, 7), b = cnAt(3, 23);
    const add = await api.post('/api/workbench/slots').set('Authorization', t).send({ slots: [{ startAt: a }, { startAt: b }, { startAt: a }] });
    expect(add.status).toBe(201);
    const created = add.body as Slot[];
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ counselorId: lin, status: 'open', startAt: a });
    expect(new Date(created[0].endAt).getTime() - new Date(created[0].startAt).getTime()).toBe(50 * 60000);
    // duplicates ignored
    expect((await api.post('/api/workbench/slots').set('Authorization', t).send({ slots: [{ startAt: a }] })).body).toEqual([]);
    // past time rejected
    expect((await api.post('/api/workbench/slots').set('Authorization', t).send({ slots: [{ startAt: cnAt(-1, 7) }] })).status).toBe(400);
    expect((await api.post('/api/workbench/slots').set('Authorization', t).send({ slots: [{ startAt: 'tomorrow' }] })).status).toBe(400);

    const listed = (await api.get('/api/workbench/slots').query({ days: 3 }).set('Authorization', t)).body as Slot[];
    expect(listed.some((s) => s.id === created[0].id)).toBe(true);
    expect(listed.every((s) => s.counselorId === lin)).toBe(true);

    expect((await api.delete(`/api/workbench/slots/${created[0].id}`).set('Authorization', t)).body).toEqual({ ok: true });
    expect(one('SELECT 1 FROM slots WHERE id = ?', created[0].id)).toBeUndefined();
    // booked slot cannot be deleted
    const booked = one(`SELECT slot_id FROM appointments WHERE id = ?`, zhouAppt())!.slot_id;
    expect((await api.delete(`/api/workbench/slots/${booked}`).set('Authorization', t)).status).toBe(409);
    // someone else's slot
    expect((await api.delete(`/api/workbench/slots/${created[1].id}`).set('Authorization', tokenFor('13900000002'))).status).toBe(404);
  });

  it('earnings for the current China-time month', async () => {
    const { api, tokenFor } = ctx;
    const t = tokenFor(PHONES.counselor);
    const e = (await api.get('/api/workbench/earnings').set('Authorization', t)).body;
    const cnMonth = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
    expect(e.month).toBe(cnMonth);
    const [y, m] = cnMonth.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1) - 8 * 3600000).toISOString();
    const to = new Date(Date.UTC(y, m, 1) - 8 * 3600000).toISOString();
    const rows = all(`SELECT amount FROM appointments WHERE counselor_id = ? AND status = 'completed' AND start_at >= ? AND start_at < ?`, lin, from, to);
    const gross = rows.reduce((s, r) => s + r.amount, 0);
    expect(e.sessions).toBe(rows.length);
    expect(e.gross).toBe(gross);
    expect(e.platformFee).toBe(Math.round(gross * 0.3));
    expect(e.net).toBe(gross - e.platformFee);
    expect(e.pendingSettlement).toBeGreaterThanOrEqual(0);
    expect((await api.get('/api/workbench/earnings').query({ month: '2026-13' }).set('Authorization', t)).status).toBe(400);
    const empty = (await api.get('/api/workbench/earnings').query({ month: '2020-01' }).set('Authorization', t)).body;
    expect(empty).toEqual({ month: '2020-01', sessions: 0, gross: 0, platformFee: 0, net: 0, pendingSettlement: 0 });
  });
});

describe('B1 applications & admin', () => {
  const apply = { name: '温言', title: '国家二级心理咨询师', headline: '焦虑与自我成长', years: 4, intro: '陪你慢慢来。', tags: ['焦虑'], methods: ['CBT'], modes: ['voice'], price: 300, gender: 'female' };

  it('apply once → pending + counselor role; admin approves → public', async () => {
    const { api, tokenFor } = ctx;
    const login = await api.post('/api/auth/login').send({ phone: '13866660001', code: '123456' });
    const auth = `Bearer ${login.body.token}`;
    expect((await api.post('/api/counselor-applications').set('Authorization', auth).send({ ...apply, price: 'x' })).status).toBe(400);
    const r = await api.post('/api/counselor-applications').set('Authorization', auth).send(apply);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: '温言', status: 'pending', avatar: '/assets/u-man-4.jpg', rating: 5, reviewCount: 0 });
    const me = (await api.get('/api/me').set('Authorization', auth)).body;
    expect(me.roles).toContain('counselor');
    expect(me.counselorId).toBe(r.body.id);
    expect((await api.post('/api/counselor-applications').set('Authorization', auth).send(apply)).status).toBe(409);
    expect((await api.get(`/api/counselors/${r.body.id}`)).status).toBe(404);

    // admin
    const admin = tokenFor(PHONES.admin);
    expect((await api.get('/api/admin/counselors').set('Authorization', auth)).status).toBe(403);
    const pending = (await api.get('/api/admin/counselors').query({ status: 'pending' }).set('Authorization', admin)).body;
    expect(pending.map((c: { name: string }) => c.name).sort()).toEqual(['沈默', '温言'].sort());
    const ok = await api.post(`/api/admin/counselors/${r.body.id}/review`).set('Authorization', admin).send({ status: 'approved' });
    expect(ok.body.status).toBe('approved');
    expect((await api.get(`/api/counselors/${r.body.id}`)).status).toBe(200);
    expect(one(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'application'`, login.body.user.id)).toBeTruthy();
    expect((await api.post(`/api/admin/counselors/${r.body.id}/review`).set('Authorization', admin).send({ status: 'maybe' })).status).toBe(400);
  });

  it('admin rejects and lists orders with paging', async () => {
    const { api, tokenFor } = ctx;
    const admin = tokenFor(PHONES.admin);
    const shen = one(`SELECT id FROM counselors WHERE status = 'pending'`)!.id;
    const rej = await api.post(`/api/admin/counselors/${shen}/review`).set('Authorization', admin).send({ status: 'rejected', note: '资质材料不完整' });
    expect(rej.body.status).toBe('rejected');
    expect((await api.get('/api/admin/counselors').query({ status: 'pending' }).set('Authorization', admin)).body).toEqual([]);

    const p1 = (await api.get('/api/admin/appointments').set('Authorization', admin)).body;
    const total = (one('SELECT COUNT(*) AS n FROM appointments')!.n) as number;
    expect(p1.total).toBe(total);
    expect(p1.items).toHaveLength(20);
    expect(p1.page).toBe(1);
    const paid = (await api.get('/api/admin/appointments').query({ status: 'paid' }).set('Authorization', admin)).body;
    expect(paid.items.every((a: Appointment) => a.status === 'paid')).toBe(true);
    expect(paid.total).toBe(1);
    expect((await api.get('/api/admin/appointments').set('Authorization', tokenFor(PHONES.counselor))).status).toBe(403);
  });
});
