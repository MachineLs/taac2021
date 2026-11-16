import { describe, it, expect, beforeEach } from 'vitest';
import { setup, PHONES } from './helpers';
import { one } from '../src/core/db';

let ctx: ReturnType<typeof setup>;
let token: string;
beforeEach(() => { ctx = setup(); token = ctx.tokenFor(PHONES.client); });
const submit = (scale: string, answers: unknown) => ctx.api.post(`/api/assessments/${scale}`).set('Authorization', token).send({ answers });

describe('assessments', () => {
  it('lists the three standard scales publicly', async () => {
    const r = await ctx.api.get('/api/assessments/scales');
    expect(r.status).toBe(200);
    const [phq, gad, isi] = r.body;
    expect(r.body.map((s: any) => s.id)).toEqual(['phq9', 'gad7', 'isi']);
    expect(phq.questions).toHaveLength(9);
    expect(phq.questions[8]).toMatch(/伤害自己/);
    expect(phq.options).toEqual([{ label: '完全不会', value: 0 }, { label: '好几天', value: 1 }, { label: '一半以上的天数', value: 2 }, { label: '几乎每天', value: 3 }]);
    expect(gad.questions).toHaveLength(7);
    expect(isi.questions).toHaveLength(7);
    expect(isi.optionsPerQuestion).toHaveLength(7);
    for (const opts of isi.optionsPerQuestion) expect(opts.map((o: any) => o.value)).toEqual([0, 1, 2, 3, 4]);
    expect(isi.optionsPerQuestion[3][0].label).not.toBe(isi.optionsPerQuestion[0][0].label);
  });

  it('scores and grades PHQ-9 / GAD-7 / ISI at the band boundaries', async () => {
    const cases: [string, number[], number, string][] = [
      ['phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0], 0, '无/极轻'],
      ['phq9', [1, 1, 1, 1, 0, 0, 0, 0, 0], 4, '无/极轻'],
      ['phq9', [1, 1, 1, 1, 1, 0, 0, 0, 0], 5, '轻度'],
      ['phq9', [2, 2, 2, 2, 2, 0, 0, 0, 0], 10, '中度'],
      ['phq9', [3, 3, 3, 3, 3, 0, 0, 0, 0], 15, '中重度'],
      ['phq9', [3, 3, 3, 3, 3, 3, 2, 0, 0], 20, '重度'],
      ['gad7', [1, 1, 1, 1, 0, 0, 0], 4, '无'],
      ['gad7', [3, 3, 3, 0, 0, 0, 0], 9, '轻度'],
      ['gad7', [2, 2, 2, 2, 2, 0, 0], 10, '中度'],
      ['gad7', [3, 3, 3, 3, 3, 0, 0], 15, '重度'],
      ['isi', [1, 1, 1, 1, 1, 1, 1], 7, '无临床意义'],
      ['isi', [2, 2, 2, 2, 0, 0, 0], 8, '轻度'],
      ['isi', [3, 3, 3, 3, 3, 0, 0], 15, '中度'],
      ['isi', [4, 4, 4, 4, 4, 2, 0], 22, '重度'],
    ];
    for (const [scale, answers, score, level] of cases) {
      const r = await submit(scale, answers);
      expect(r.status, `${scale} ${answers}`).toBe(201);
      expect(r.body).toMatchObject({ scale, score, level, answers, max: { phq9: 27, gad7: 21, isi: 28 }[scale] });
      expect(r.body.interpretation).toMatch(/不作为诊断/);
    }
    const list = await ctx.api.get('/api/assessments/results').set('Authorization', token);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(cases.length + 3);                 // + seeded results
    expect(list.body[0].scale).toBe('isi');                          // newest first
    expect(list.body[0].score).toBe(22);
  });

  it('validates answers', async () => {
    expect((await submit('phq9', [0, 0, 0])).status).toBe(400);
    expect((await submit('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 4])).status).toBe(400);
    expect((await submit('isi', [0, 0, 0, 0, 0, 0, 5])).status).toBe(400);
    expect((await submit('gad7', [0, 0, 0, 0, 0, 0, 1.5])).status).toBe(400);
    expect((await submit('gad7', 'x')).status).toBe(400);
    expect((await submit('bdi', [0])).status).toBe(404);
    expect((await ctx.api.post('/api/assessments/phq9').send({ answers: [0, 0, 0, 0, 0, 0, 0, 0, 0] })).status).toBe(401);
    expect((await ctx.api.get('/api/assessments/results')).status).toBe(401);
  });

  it('PHQ-9 item 9 > 0 raises a crisis alert and points to 12356', async () => {
    const r = await submit('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(r.status).toBe(201);
    expect(r.body.interpretation).toMatch(/12356/);
    const uid = one('SELECT id FROM users WHERE phone = ?', PHONES.client)!.id;
    const a = one("SELECT * FROM crisis_alerts WHERE user_id = ? AND excerpt = 'PHQ-9 第 9 题阳性'", uid)!;
    expect(a).toBeTruthy();
    expect(a.source).toBe('intake');
    expect(a.session_id).toBeNull();
    const ok = await submit('phq9', [3, 3, 3, 0, 0, 0, 0, 0, 0]);
    expect(ok.body.interpretation).not.toMatch(/12356/);
  });
});
