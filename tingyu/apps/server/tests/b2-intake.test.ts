import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setup, PHONES } from './helpers';
import { all, one } from '../src/core/db';
import { on } from '../src/core/events';
import { config } from '../src/core/config';
import { detectCrisis } from '../src/modules/intake/crisis';
import { extractDuration, extractTopics } from '../src/modules/intake/extract';
import { greeting } from '../src/modules/intake/rules';
import { llmSettings } from '../src/modules/intake/llm';

type Ctx = ReturnType<typeof setup>;
let ctx: Ctx;
beforeEach(() => { ctx = setup(); });

const start = async (token?: string) => {
  const r = token ? await ctx.api.post('/api/intake/sessions').set('Authorization', token) : await ctx.api.post('/api/intake/sessions');
  expect(r.status).toBe(201);
  return r.body;
};
const say = (id: string, content: string, token?: string) => {
  const r = ctx.api.post(`/api/intake/sessions/${id}/reply`).send({ content });
  return token ? r.set('Authorization', token) : r;
};
const spoken = (t: string) => {
  expect(t.length).toBeGreaterThan(0);
  expect(t.length).toBeLessThanOrEqual(80);
  expect(t).not.toMatch(/[*#`]|\n|^\s*[-•]/);
  expect((t.match(/[。！？]/g) || []).length).toBeLessThanOrEqual(3);
};

describe('crisis detection', () => {
  it('flags crisis language', () => {
    for (const t of ['我真的不想活了', '有时候觉得活不下去', '想自杀', '我在攒安眠药', '我已经写好遗书了', '想结束自己的生命', '昨天割腕了', '我不开心想自杀', '好想死']) {
      expect(detectCrisis(t), t).not.toBeNull();
    }
  });
  it('ignores negations and unrelated text', () => {
    for (const t of ['我不想死，只是很累', '没有想过自杀', '从来没有伤害自己的念头', '我不会自残的', '最近工作压力很大', '累死了', '笑死我了']) {
      expect(detectCrisis(t), t).toBeNull();
    }
  });
});

describe('extraction', () => {
  it('maps keywords to issue tags in order of appearance', () => {
    expect(extractTopics('最近工作压力特别大，晚上总是睡不着').map((h) => h.tag)).toEqual(['职场压力', '焦虑', '失眠']);
    expect(extractTopics('和老公总吵架').map((h) => h.tag)).toEqual(['婚姻', '亲密关系']);
    expect(extractTopics('孩子不愿意上学，家长很头疼').map((h) => h.tag)).toContain('亲子');
    expect(extractTopics('每天都很难过，觉得没意思').map((h) => h.tag)).toEqual(['情绪低落']);
  });
  it('parses durations', () => {
    expect(extractDuration('差不多一个多月了吧')?.label).toBe('1 个多月');
    expect(extractDuration('半年了')?.label).toBe('半年');
    expect(extractDuration('大概两周')?.label).toBe('2 周');
    expect(extractDuration('三年多')?.label).toBe('3 年多');
    expect(extractDuration('好几个月了')?.label).toBe('好几个月');
    expect(extractDuration('嗯')).toBeNull();
  });
  it('greets by China time', () => {
    expect(greeting(new Date('2026-11-16T13:00:00Z'))).toMatch(/^晚上好，我是听屿的接待助手小屿.*今晚想聊点什么？$/);   // 21:00 CN
    expect(greeting(new Date('2026-11-16T01:00:00Z'))).toMatch(/^早上好/);                                     // 09:00 CN
  });
});

describe('rule-engine intake conversation', () => {
  it('walks issue → duration → impact → safety → modality → recommendation → booking, and summarizes', async () => {
    const s = await start();
    expect(s.userId).toBeNull();
    expect(s.status).toBe('active');
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe('assistant');
    expect(s.messages[0].content).toMatch(/小屿/);

    let r = await say(s.id, '最近工作压力特别大，晚上总是睡不着，一躺下脑子就停不下来。');
    expect(r.status).toBe(200);
    expect(r.body.crisis).toBeNull();
    spoken(r.body.reply.content);
    expect(r.body.reply.content).toMatch(/工作/);           // empathetic restatement
    expect(r.body.reply.content).toMatch(/多久/);           // asks duration

    r = await say(s.id, '你是机器人吗？');                     // off-topic → answer + re-ask
    spoken(r.body.reply.content);
    expect(r.body.reply.content).toMatch(/小屿/);
    expect(r.body.reply.content).toMatch(/多久/);

    r = await say(s.id, '差不多一个多月了');
    spoken(r.body.reply.content);
    expect(r.body.reply.content).toMatch(/1 个多月/);
    expect(r.body.reply.content).toMatch(/影响/);           // asks impact

    r = await say(s.id, '白天上班老走神，效率很低');
    spoken(r.body.reply.content);
    expect(r.body.reply.content).toMatch(/伤害自己/);       // safety check

    r = await say(s.id, '没有，就是觉得很累');
    spoken(r.body.reply.content);
    expect(r.body.crisis).toBeNull();
    expect(r.body.reply.content).toMatch(/语音|视频|文字/);

    r = await say(s.id, '语音吧');
    spoken(r.body.reply.content);
    expect(r.body.reply.content).toMatch(/推荐.*老师/);
    expect(r.body.reply.content).toMatch(/预约/);
    const linName = one("SELECT name FROM counselors WHERE name = '林知夏'")!.name;
    expect(r.body.reply.content).toContain(linName);

    r = await say(s.id, '好的');
    spoken(r.body.reply.content);
    expect(r.body.session.risk).toBe('low');

    const e = await ctx.api.post(`/api/intake/sessions/${s.id}/end`);
    expect(e.status).toBe(200);
    expect(e.body.status).toBe('ended');
    expect(e.body.endedAt).toBeTruthy();
    const sum = e.body.summary;
    expect(sum.topics).toEqual(expect.arrayContaining(['职场压力', '失眠']));
    expect(sum.duration).toBe('1 个多月');
    expect(sum.risk).toBe('low');
    expect(sum.modality).toBe('voice');
    expect(sum.moodScore).toBeGreaterThanOrEqual(0);
    expect(sum.moodScore).toBeLessThanOrEqual(100);
    expect(sum.riskNote).toMatch(/估计/);
    expect(sum.plan).toMatch(/CBT-I/);
    expect(sum.plan).toMatch(/咨询师/);
    expect(sum.scales.map((x: any) => x.scale)).toEqual(['phq9', 'gad7', 'isi']);
    for (const sc of sum.scales) { expect(sc.score).toBeLessThanOrEqual(sc.max); expect(sc.level).toBeTruthy(); }
    expect(sum.recommendedCounselorIds.length).toBeGreaterThanOrEqual(1);
    expect(sum.recommendedCounselorIds.length).toBeLessThanOrEqual(3);
    const approved = all("SELECT id FROM counselors WHERE status = 'approved'").map((x) => x.id);
    for (const cid of sum.recommendedCounselorIds) expect(approved).toContain(cid);

    // ended sessions are read-only
    const again = await say(s.id, '还在吗');
    expect(again.status).toBe(409);
    // ending twice is idempotent
    expect((await ctx.api.post(`/api/intake/sessions/${s.id}/end`)).body.summary).toEqual(sum);
  });

  it('follows up when answers are off-topic and wraps up after 8 turns', async () => {
    const s = await start();
    let last: any;
    const lines = ['嗯', '不知道', '就是不太舒服', '随便吧', '哈哈', '今天天气不错', '还行', '不清楚', '再说吧'];
    for (const t of lines) {
      last = await say(s.id, t);
      expect(last.status).toBe(200);
      spoken(last.body.reply.content);
    }
    const all8 = last.body.session.messages.filter((m: any) => m.role === 'assistant').map((m: any) => m.content);
    expect(all8.some((t: string) => /推荐|结束对话|先聊到这里/.test(t))).toBe(true);
    expect(all8[1]).toMatch(/多说一点|睡眠、情绪/);   // natural follow-up to the first vague answer
  });

  it('rejects empty content', async () => {
    const s = await start();
    expect((await say(s.id, '   ')).status).toBe(400);
    expect((await ctx.api.post('/api/intake/sessions/is_nope/reply').send({ content: '你好' })).status).toBe(404);
  });
});

describe('crisis handling in intake', () => {
  it('replies with the crisis script, raises the risk, alerts admins and emits intake.crisis', async () => {
    const events: any[] = [];
    on('intake.crisis', (p) => { events.push(p); });
    const token = ctx.tokenFor(PHONES.client);
    const s = await start(token);
    const r = await say(s.id, '工作压力太大了，我真的不想活了', token);
    expect(r.status).toBe(200);
    expect(r.body.crisis).not.toBeNull();
    expect(r.body.crisis.hotlines.map((x: any) => x.number)).toContain('12356');
    expect(r.body.reply.content).toMatch(/12356/);
    expect(r.body.reply.content).toMatch(/安全/);
    spoken(r.body.reply.content.replace(/\s/g, '').slice(0, 80));
    expect(r.body.session.crisis).toBe(true);
    expect(r.body.session.risk).toBe('high');

    const alert = one('SELECT * FROM crisis_alerts WHERE session_id = ?', s.id)!;
    expect(alert.source).toBe('intake');
    expect(alert.status).toBe('open');
    expect(alert.excerpt).toBe('工作压力太大了，我真的不想活了');
    expect(alert.user_id).toBe(r.body.session.userId);
    expect(events).toEqual([{ sessionId: s.id, userId: r.body.session.userId }]);
    const admin = one('SELECT id FROM users WHERE phone = ?', PHONES.admin)!;
    expect(one("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'crisis'", admin.id)!.n).toBe(1);

    // a second crisis message doesn't duplicate the open alert
    const r2 = await say(s.id, '我还是想死', token);
    expect(r2.body.crisis).not.toBeNull();
    expect(one('SELECT COUNT(*) AS n FROM crisis_alerts WHERE session_id = ?', s.id)!.n).toBe(1);

    // follow-up once the person says they are safe
    const r3 = await say(s.id, '我现在在家，安全的', token);
    expect(r3.body.crisis).toBeNull();
    spoken(r3.body.reply.content);

    const e = await ctx.api.post(`/api/intake/sessions/${s.id}/end`).set('Authorization', token);
    expect(e.body.summary.risk).toBe('high');
    expect(e.body.summary.topics).toContain('职场压力');
  });

  it('negated statements do not trigger the crisis flow', async () => {
    const s = await start();
    const r = await say(s.id, '我不想死，就是最近睡不着很焦虑');
    expect(r.body.crisis).toBeNull();
    expect(r.body.session.risk).toBe('low');
    expect(one('SELECT COUNT(*) AS n FROM crisis_alerts WHERE session_id = ?', s.id)!.n).toBe(0);
  });

  it('a "yes" to the safety question is treated as crisis', async () => {
    const s = await start();
    await say(s.id, '最近一直很难过');
    await say(s.id, '两个月了');
    const r1 = await say(s.id, '影响挺大的，不想见人');
    expect(r1.body.reply.content).toMatch(/伤害自己/);
    const r = await say(s.id, '有过');
    expect(r.body.crisis).not.toBeNull();
    expect(r.body.session.risk).toBe('high');
    expect(one('SELECT excerpt FROM crisis_alerts WHERE session_id = ?', s.id)!.excerpt).toBe('有过');
  });
});

describe('intake access control', () => {
  it('anonymous sessions are reachable by id; claim binds them; bound sessions are private', async () => {
    const s = await start();
    expect((await ctx.api.get(`/api/intake/sessions/${s.id}`)).status).toBe(200);

    const client = ctx.tokenFor(PHONES.client);
    const other = ctx.tokenFor(PHONES.creator);
    const admin = ctx.tokenFor(PHONES.admin);
    expect((await ctx.api.post(`/api/intake/sessions/${s.id}/claim`)).status).toBe(401);
    const c = await ctx.api.post(`/api/intake/sessions/${s.id}/claim`).set('Authorization', client);
    expect(c.status).toBe(200);
    expect(c.body.userId).toBeTruthy();

    expect((await ctx.api.get(`/api/intake/sessions/${s.id}`)).status).toBe(401);
    expect((await ctx.api.get(`/api/intake/sessions/${s.id}`).set('Authorization', other)).status).toBe(403);
    expect((await say(s.id, '你好', other)).status).toBe(403);
    expect((await ctx.api.post(`/api/intake/sessions/${s.id}/end`).set('Authorization', other)).status).toBe(403);
    expect((await ctx.api.post(`/api/intake/sessions/${s.id}/claim`).set('Authorization', other)).status).toBe(403);
    expect((await ctx.api.get(`/api/intake/sessions/${s.id}`).set('Authorization', client)).status).toBe(200);
    expect((await ctx.api.get(`/api/intake/sessions/${s.id}`).set('Authorization', admin)).status).toBe(200);
    expect((await say(s.id, '最近睡不着', client)).status).toBe(200);
  });

  it('sessions created with a token are bound and listed in mine', async () => {
    const client = ctx.tokenFor(PHONES.client);
    const s = await start(client);
    expect(s.userId).toBe(one('SELECT id FROM users WHERE phone = ?', PHONES.client)!.id);
    expect((await ctx.api.get('/api/intake/sessions?mine=1')).status).toBe(401);
    const mine = await ctx.api.get('/api/intake/sessions?mine=1').set('Authorization', client);
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBe(2);                    // seeded one + this one
    expect(mine.body[0].id).toBe(s.id);                  // newest first
    expect(mine.body.find((x: any) => x.status === 'ended').summary.topics).toContain('失眠');
  });
});

describe('LLM provider', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => { config.anthropicApiKey = 'test-key'; });
  afterEach(() => { config.anthropicApiKey = ''; globalThis.fetch = realFetch; llmSettings.timeoutMs = 8000; vi.restoreAllMocks(); });

  it('uses Claude for the wording and keeps rule state', async () => {
    const calls: any[] = [];
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '**听起来**工作让你很累。\n这种情况持续多久了？' }] }), { status: 200 });
    }) as any;
    const s = await start();
    const r = await say(s.id, '最近工作压力很大');
    expect(r.status).toBe(200);
    expect(r.body.reply.content).toBe('听起来工作让你很累。这种情况持续多久了？');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init.headers;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(calls[0].init.body);
    expect(body.model).toBe(config.anthropicModel);
    expect(body.system).toMatch(/不做诊断/);
    expect(body.system).toMatch(/12356/);
    expect(body.system).toMatch(/林知夏/);                 // counselor list from DB
    expect(body.messages[0].role).toBe('user');
    expect(body.messages.at(-1).content).toMatch(/最近工作压力很大/);
  });

  it('falls back to the rule engine on HTTP errors and timeouts, and never sends crisis turns to the model', async () => {
    globalThis.fetch = vi.fn(async () => new Response('overloaded', { status: 529 })) as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await start();
    const r = await say(s.id, '最近工作压力很大');
    expect(r.body.reply.content).toMatch(/多久/);

    llmSettings.timeoutMs = 50;
    globalThis.fetch = vi.fn((_u: any, init: any) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    })) as any;
    const r2 = await say(s.id, '一个多月了');
    expect(r2.status).toBe(200);
    expect(r2.body.reply.content).toMatch(/1 个多月/);

    (globalThis.fetch as any).mockClear();
    const r3 = await say(s.id, '有时候觉得活不下去');
    expect(r3.body.crisis).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // summary also falls back
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as any;
    const e = await ctx.api.post(`/api/intake/sessions/${s.id}/end`);
    expect(e.body.summary.risk).toBe('high');
  });

  it('uses a structured LLM summary when available, keeping deterministic risk', async () => {
    const s = await start();
    globalThis.fetch = vi.fn(async (_u: any, init: any) => {
      const body = JSON.parse(init.body);
      const text = body.output_config?.format
        ? JSON.stringify({ mood: '焦虑 · 疲惫', moodScore: 40, topics: ['焦虑', '失眠'], duration: '2 周', riskNote: '未报告自伤念头。', plan: '睡眠评估 → CBT-I 6 次 → 每周情绪追踪' })
        : '嗯，我在听。能多说一点吗？';
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }), { status: 200 });
    }) as any;
    await say(s.id, '最近有点焦虑');
    const e = await ctx.api.post(`/api/intake/sessions/${s.id}/end`);
    expect(e.body.summary.mood).toBe('焦虑 · 疲惫');
    expect(e.body.summary.topics).toEqual(['焦虑', '失眠']);
    expect(e.body.summary.risk).toBe('low');
    expect(e.body.summary.plan).toMatch(/咨询师/);
    expect(e.body.summary.scales).toHaveLength(3);
  });
});

describe('matching', () => {
  it('respects a face-to-face preference and restates impact answers', async () => {
    const s = await start();
    await say(s.id, '最近和老公总是吵架，心里很难受');
    await say(s.id, '大概半年了');
    const imp = await say(s.id, '上班老走神，也不想跟人说话');
    expect(imp.body.reply.content).toMatch(/工作.*影响/);
    await say(s.id, '没有');
    const r = await say(s.id, '想面对面聊');
    expect(r.body.reply.content).toMatch(/周以宁老师/);
    expect(r.body.reply.content).toMatch(/面询/);
    const e = await ctx.api.post(`/api/intake/sessions/${s.id}/end`);
    expect(e.body.summary.modality).toBe('offline');
    expect(e.body.summary.topics.slice(0, 2)).toEqual(['婚姻', '亲密关系']);
    expect(e.body.summary.topics).not.toContain('职场压力');
  });
});
