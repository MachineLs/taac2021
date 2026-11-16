import { describe, it, expect, beforeEach } from 'vitest';
import type { CounselorSummary, Page } from '@tingyu/shared';
import { setup, PHONES } from './helpers';
import { one } from '../src/core/db';

let ctx: ReturnType<typeof setup>;
beforeEach(() => { ctx = setup(); });
const list = async (q: Record<string, string | number>) => (await ctx.api.get('/api/counselors').query(q)).body as Page<CounselorSummary>;

describe('B1 counselors', () => {
  it('lists approved counselors with default paging and recommended order', async () => {
    const p = await list({});
    expect(p.total).toBe(12);                   // pending 沈默 excluded
    expect(p.pageSize).toBe(10);
    expect(p.items).toHaveLength(10);
    expect(p.items[0].name).toBe('林知夏');      // highest sort_weight
    expect(p.items.every((c) => c.name !== '沈默')).toBe(true);
    const p2 = await list({ page: 2 });
    expect(p2.items).toHaveLength(2);
    expect((await ctx.api.get('/api/counselors').query({ pageSize: 51 })).status).toBe(400);
  });

  it('filters by tag, mode, price, gender, city, q and availability', async () => {
    const insomnia = await list({ tag: '失眠' });
    expect(insomnia.items.map((c) => c.name).sort()).toEqual(['林知夏', '陈牧'].sort());
    const offline = await list({ mode: 'offline', pageSize: 50 });
    expect(offline.items.every((c) => c.modes.includes('offline'))).toBe(true);
    expect(offline.total).toBe(5);
    const cheap = await list({ priceMin: 300, priceMax: 400, pageSize: 50 });
    expect(cheap.items.every((c) => c.price >= 300 && c.price <= 400)).toBe(true);
    expect(cheap.total).toBeGreaterThan(0);
    const male = await list({ gender: 'male', pageSize: 50 });
    expect(male.items.every((c) => c.gender === 'male')).toBe(true);
    expect((await list({ city: '上海' })).items.map((c) => c.name).sort()).toEqual(['何清', '宋语棠'].sort());
    expect((await list({ q: 'EMDR' })).items.map((c) => c.name)).toEqual(['宋语棠']);
    expect((await list({ q: '林' })).items.map((c) => c.name)).toEqual(['林知夏']);
    const avail = await list({ availableWithinDays: 3, pageSize: 50 });
    expect(avail.items.every((c) => c.nextAvailableAt && new Date(c.nextAvailableAt).getTime() < Date.now() + 3 * 86400000)).toBe(true);
    expect((await ctx.api.get('/api/counselors').query({ mode: 'phone' })).status).toBe(400);
  });

  it('sorts by price, rating and soonest', async () => {
    const asc = (await list({ sort: 'price_asc', pageSize: 50 })).items.map((c) => c.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await list({ sort: 'price_desc', pageSize: 50 })).items.map((c) => c.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const rating = (await list({ sort: 'rating', pageSize: 50 })).items.map((c) => c.rating);
    expect(rating).toEqual([...rating].sort((a, b) => b - a));
    const soon = (await list({ sort: 'soonest', pageSize: 50 })).items.map((c) => c.nextAvailableAt ?? '9999');
    expect(soon).toEqual([...soon].sort());
  });

  it('detail, slots and reviews', async () => {
    const { api } = ctx;
    const lin = (await list({ q: '林知夏' })).items[0];
    const d = await api.get(`/api/counselors/${lin.id}`);
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ id: lin.id, status: 'approved' });
    expect(d.body.qualifications.length).toBeGreaterThan(0);
    expect((await api.get('/api/counselors/c_nope')).status).toBe(404);

    const slots = (await api.get(`/api/counselors/${lin.id}/slots`)).body as { startAt: string; status: string }[];
    expect(slots.length).toBeGreaterThan(0);
    const now = Date.now();
    expect(slots.every((s) => new Date(s.startAt).getTime() > now && new Date(s.startAt).getTime() < now + 7 * 86400000 + 1000)).toBe(true);
    expect(slots.every((s) => s.status === 'open' || s.status === 'booked')).toBe(true);
    expect(slots.some((s) => s.status === 'booked')).toBe(true);     // 小周's booking tomorrow
    expect((await api.get(`/api/counselors/${lin.id}/slots`).query({ days: 31 })).status).toBe(400);

    const rv = await api.get(`/api/counselors/${lin.id}/reviews`);
    expect(rv.body.total).toBeGreaterThan(0);
    expect(rv.body.items[0].userName).toMatch(/^.\*\*$/);
  });

  it('pending counselor is hidden from the public but visible to its owner and admin', async () => {
    const { api, tokenFor } = ctx;
    const pending = one(`SELECT id FROM counselors WHERE status = 'pending'`)!;
    expect((await api.get(`/api/counselors/${pending.id}`)).status).toBe(404);
    expect((await api.get(`/api/counselors/${pending.id}`).set('Authorization', tokenFor(PHONES.pendingCounselor))).body.status).toBe('pending');
    expect((await api.get(`/api/counselors/${pending.id}`).set('Authorization', tokenFor(PHONES.admin))).status).toBe(200);
  });
});
