import { describe, it, expect, beforeEach } from 'vitest';
import { setup, PHONES } from './helpers';
import { one, run } from '../src/core/db';

let ctx: ReturnType<typeof setup>;
beforeEach(() => { ctx = setup(); });

describe('B1 auth', () => {
  it('send-code validates phone, returns devCode and rate-limits', async () => {
    const { api } = ctx;
    expect((await api.post('/api/auth/send-code').send({ phone: '123' })).status).toBe(400);
    const r = await api.post('/api/auth/send-code').send({ phone: '13812345678' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, devCode: '123456' });
    expect(one('SELECT * FROM sms_codes WHERE phone = ?', '13812345678')).toBeTruthy();
    const again = await api.post('/api/auth/send-code').send({ phone: '13812345678' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('too_many');
  });

  it('wrong codes are rejected and the stored code is voided after 5 failures', async () => {
    const { api } = ctx;
    const phone = '13812340000';
    await api.post('/api/auth/send-code').send({ phone });
    run('UPDATE sms_codes SET code = ? WHERE phone = ?', '654321', phone);   // simulate a real random code
    for (let i = 0; i < 5; i++) {
      const r = await api.post('/api/auth/login').send({ phone, code: '000000' });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('invalid_code');
    }
    expect(one('SELECT * FROM sms_codes WHERE phone = ?', phone)).toBeUndefined();
    expect((await api.post('/api/auth/login').send({ phone, code: '654321' })).body.error.code).toBe('invalid_code');
    // dev code always works outside production
    expect((await api.post('/api/auth/login').send({ phone, code: '123456' })).status).toBe(200);
  });

  it('new user: auto register, NEW100 coupon, referral attribution', async () => {
    const { api } = ctx;
    const r = await api.post('/api/auth/login').send({ phone: '13812345678', code: '123456', refCode: 'AYU2026' });
    expect(r.status).toBe(200);
    expect(r.body.isNew).toBe(true);
    expect(r.body.user.name).toBe('用户5678');
    expect(r.body.user.roles).toEqual(['client']);
    const row = one('SELECT referred_by_creator_id FROM users WHERE id = ?', r.body.user.id)!;
    const ayu = one(`SELECT id FROM creators WHERE ref_code = 'AYU2026'`)!;
    expect(row.referred_by_creator_id).toBe(ayu.id);

    const coupons = await api.get('/api/coupons/mine').set('Authorization', `Bearer ${r.body.token}`);
    expect(coupons.status).toBe(200);
    expect(coupons.body).toHaveLength(1);
    expect(coupons.body[0]).toMatchObject({ title: '新人首单立减 100 元', amount: 100, minSpend: 300, status: 'unused' });
    const days = (new Date(coupons.body[0].expiresAt).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    // second login: not new, no extra coupon
    const r2 = await api.post('/api/auth/login').send({ phone: '13812345678', code: '123456' });
    expect(r2.body.isNew).toBe(false);
    expect(r2.body.user.id).toBe(r.body.user.id);
  });

  it('invalid refCode is ignored; existing users are never re-attributed', async () => {
    const { api } = ctx;
    const r = await api.post('/api/auth/login').send({ phone: '13812349999', code: '123456', refCode: 'NOPE' });
    expect(r.body.isNew).toBe(true);
    expect(one('SELECT referred_by_creator_id FROM users WHERE id = ?', r.body.user.id)!.referred_by_creator_id).toBeNull();
    const old = await api.post('/api/auth/login').send({ phone: PHONES.admin, code: '123456', refCode: 'AYU2026' });
    expect(old.body.isNew).toBe(false);
    expect(one('SELECT referred_by_creator_id FROM users WHERE phone = ?', PHONES.admin)!.referred_by_creator_id).toBeNull();
  });

  it('GET/PATCH /me', async () => {
    const { api, tokenFor } = ctx;
    expect((await api.get('/api/me')).status).toBe(401);
    const t = tokenFor(PHONES.counselor);
    const me = await api.get('/api/me').set('Authorization', t);
    expect(me.body.roles).toContain('counselor');
    expect(me.body.counselorId).toMatch(/^c_/);
    const p = await api.patch('/api/me').set('Authorization', t).send({ name: '  林老师 ', avatar: null });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ name: '林老师', avatar: null });
    expect((await api.patch('/api/me').set('Authorization', t).send({ name: '' })).status).toBe(400);
  });
});
