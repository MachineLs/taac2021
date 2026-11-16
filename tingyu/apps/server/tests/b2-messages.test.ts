import { describe, it, expect, beforeEach } from 'vitest';
import { setup, PHONES } from './helpers';
import { one } from '../src/core/db';

let ctx: ReturnType<typeof setup>;
beforeEach(() => { ctx = setup(); });
const lin = () => one("SELECT * FROM counselors WHERE name = '林知夏'")!;
const uid = (phone: string) => one('SELECT id FROM users WHERE phone = ?', phone)!.id as string;

describe('conversations & messages', () => {
  it('client and counselor see the seeded conversation; reading marks the other side as read', async () => {
    const client = ctx.tokenFor(PHONES.client), counselor = ctx.tokenFor(PHONES.counselor);
    const c1 = await ctx.api.get('/api/conversations').set('Authorization', client);
    expect(c1.status).toBe(200);
    expect(c1.body).toHaveLength(1);
    const conv = c1.body[0];
    expect(conv.counselor.name).toBe('林知夏');
    expect(conv.client.name).toBe('小周');
    expect(conv.unread).toBe(1);
    expect(conv.lastMessage.content).toMatch(/4-7-8/);

    const k = await ctx.api.get('/api/conversations').set('Authorization', counselor);
    expect(k.body.map((x: any) => x.id)).toEqual([conv.id]);
    expect(k.body[0].unread).toBe(0);

    const m = await ctx.api.get(`/api/conversations/${conv.id}/messages`).set('Authorization', client);
    expect(m.status).toBe(200);
    expect(m.body).toHaveLength(2);
    expect(m.body[0].createdAt < m.body[1].createdAt).toBe(true);
    expect(m.body.every((x: any) => x.readAt)).toBe(true);
    expect((await ctx.api.get('/api/conversations').set('Authorization', client)).body[0].unread).toBe(0);

    // send: updates conversation, notifies the counselor, unread for them
    const s = await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', client).send({ content: '好的，谢谢老师！' });
    expect(s.status).toBe(201);
    expect(s.body).toMatchObject({ conversationId: conv.id, senderId: uid(PHONES.client), content: '好的，谢谢老师！', readAt: null });
    const k2 = await ctx.api.get('/api/conversations').set('Authorization', counselor);
    expect(k2.body[0].unread).toBe(1);
    expect(k2.body[0].updatedAt).toBe(s.body.createdAt);
    const n = one("SELECT * FROM notifications WHERE user_id = ? AND type = 'message' ORDER BY created_at DESC", uid(PHONES.counselor))!;
    expect(n.title).toMatch(/小周/);
    expect(n.link).toBe(`/desk/messages/${conv.id}`);

    // counselor replies → client notified
    const before = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', uid(PHONES.client))!.n;
    await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', counselor).send({ content: '不客气，明天见。' });
    expect(one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', uid(PHONES.client))!.n).toBe(before + 1);
  });

  it('enforces participation and validates input', async () => {
    const client = ctx.tokenFor(PHONES.client), stranger = ctx.tokenFor(PHONES.creator), other = ctx.tokenFor('13900000002');
    const conv = (await ctx.api.get('/api/conversations').set('Authorization', client)).body[0];
    expect((await ctx.api.get(`/api/conversations/${conv.id}/messages`).set('Authorization', stranger)).status).toBe(403);
    expect((await ctx.api.get(`/api/conversations/${conv.id}/messages`).set('Authorization', other)).status).toBe(403);
    expect((await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', stranger).send({ content: 'hi' })).status).toBe(403);
    expect((await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', client).send({ content: '  ' })).status).toBe(400);
    expect((await ctx.api.get('/api/conversations/cv_nope/messages').set('Authorization', client)).status).toBe(404);
    expect((await ctx.api.get('/api/conversations')).status).toBe(401);
  });

  it('opens conversations only with approved counselors, idempotently', async () => {
    const creator = ctx.tokenFor(PHONES.creator);
    const r1 = await ctx.api.post('/api/conversations').set('Authorization', creator).send({ counselorId: lin().id });
    expect(r1.status).toBe(200);
    expect(r1.body.unread).toBe(0);
    expect(r1.body.lastMessage).toBeNull();
    const r2 = await ctx.api.post('/api/conversations').set('Authorization', creator).send({ counselorId: lin().id });
    expect(r2.body.id).toBe(r1.body.id);
    const pending = one("SELECT id FROM counselors WHERE status = 'pending'")!.id;
    expect((await ctx.api.post('/api/conversations').set('Authorization', creator).send({ counselorId: pending })).status).toBe(404);
    expect((await ctx.api.post('/api/conversations').set('Authorization', creator).send({})).status).toBe(400);
    // a counselor cannot open a conversation with themself
    expect((await ctx.api.post('/api/conversations').set('Authorization', ctx.tokenFor(PHONES.counselor)).send({ counselorId: lin().id })).status).toBe(400);
  });

  it('crisis language from the client raises a message alert', async () => {
    const client = ctx.tokenFor(PHONES.client);
    const conv = (await ctx.api.get('/api/conversations').set('Authorization', client)).body[0];
    await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', client).send({ content: '老师，我最近真的不想活了' });
    const a = one("SELECT * FROM crisis_alerts WHERE source = 'message'")!;
    expect(a.user_id).toBe(uid(PHONES.client));
    expect(a.excerpt).toBe('老师，我最近真的不想活了');
    await ctx.api.post(`/api/conversations/${conv.id}/messages`).set('Authorization', client).send({ content: '我不想死，只是累' });
    expect(one("SELECT COUNT(*) AS n FROM crisis_alerts WHERE source = 'message'")!.n).toBe(1);
  });
});

describe('notifications', () => {
  it('lists newest first and marks all read', async () => {
    const client = ctx.tokenFor(PHONES.client);
    const r = await ctx.api.get('/api/notifications').set('Authorization', client);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(2);
    expect(r.body[0].createdAt >= r.body[1].createdAt).toBe(true);
    expect(r.body.some((n: any) => n.readAt === null)).toBe(true);
    expect((await ctx.api.post('/api/notifications/read-all').set('Authorization', client)).body).toEqual({ ok: true });
    const r2 = await ctx.api.get('/api/notifications').set('Authorization', client);
    expect(r2.body.every((n: any) => n.readAt)).toBe(true);
    expect((await ctx.api.get('/api/notifications')).status).toBe(401);
  });
});

describe('mood', () => {
  it('creates and lists check-ins within the window', async () => {
    const client = ctx.tokenFor(PHONES.client);
    const r = await ctx.api.post('/api/mood').set('Authorization', client).send({ mood: 4, tags: ['运动', '运动'], note: '跑了 3 公里' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ mood: 4, tags: ['运动'], note: '跑了 3 公里' });
    const list = await ctx.api.get('/api/mood?days=30').set('Authorization', client);
    expect(list.body.map((m: any) => m.id)).toContain(r.body.id);
    for (let i = 1; i < list.body.length; i++) expect(list.body[i - 1].createdAt >= list.body[i].createdAt).toBe(true);
    expect(list.body.length).toBe(15);
    const short = await ctx.api.get('/api/mood?days=3').set('Authorization', client);
    expect(short.body.length).toBeLessThan(list.body.length);
    const bare = await ctx.api.post('/api/mood').set('Authorization', client).send({ mood: 2 });
    expect(bare.body).toMatchObject({ tags: [], note: '' });
    expect((await ctx.api.post('/api/mood').set('Authorization', client).send({ mood: 6 })).status).toBe(400);
    expect((await ctx.api.get('/api/mood?days=0').set('Authorization', client)).status).toBe(400);
    expect((await ctx.api.post('/api/mood').send({ mood: 3 })).status).toBe(401);
  });
});
