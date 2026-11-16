// Module: assessments — owner: B2 (care & growth). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { AssessmentResult, ScaleDefinition, ScaleId } from '@tingyu/shared';
import { me, requireAuth } from '../../core/auth';
import { all, j, run, tx, type Row } from '../../core/db';
import { badRequest, h, notFound, parse } from '../../core/errors';
import { id, nowIso } from '../../core/util';
import { raiseCrisisAlert } from '../intake/crisis';
import { SCALES, SCALE_MAX, interpret, scaleById, scaleLevel } from './scales';

export const router = Router();

const toResult = (r: Row): AssessmentResult => ({
  id: r.id, scale: r.scale, score: r.score, max: r.max, level: r.level, interpretation: r.interpretation,
  answers: j<number[]>(r.answers, []), createdAt: r.created_at,
});

router.get('/assessments/scales', (_req, res) => {
  const scales: ScaleDefinition[] = SCALES;
  res.json(scales);
});

router.get('/assessments/results', requireAuth, h((req, res) => {
  const list: AssessmentResult[] = all('SELECT * FROM assessment_results WHERE user_id = ? ORDER BY created_at DESC, rowid DESC', me(req).id).map(toResult);
  res.json(list);
}));

const Body = z.object({ answers: z.array(z.number().int()) });

router.post('/assessments/:scale', requireAuth, h((req, res) => {
  const def = scaleById(String(req.params.scale));
  if (!def) throw notFound('没有这个量表');
  const { answers } = parse(Body, req.body);
  if (answers.length !== def.questions.length) throw badRequest(`需要回答全部 ${def.questions.length} 道题`);
  answers.forEach((v, i) => {
    const opts = def.optionsPerQuestion?.[i] ?? def.options;
    if (!opts.some((o) => o.value === v)) throw badRequest(`第 ${i + 1} 题的答案无效`);
  });
  const scale = def.id as ScaleId;
  const score = answers.reduce((a, b) => a + b, 0);
  const level = scaleLevel(scale, score);
  const item9 = scale === 'phq9' && answers[8] > 0;
  const result: AssessmentResult = {
    id: id('ar'), scale, score, max: SCALE_MAX[scale], level, interpretation: interpret(scale, level, item9), answers, createdAt: nowIso(),
    ...(item9 ? { crisis: true } : {}),
  };
  const user = me(req);
  tx(() => {
    run('INSERT INTO assessment_results (id, user_id, scale, answers, score, max, level, interpretation, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      result.id, user.id, scale, JSON.stringify(answers), score, result.max, level, result.interpretation, result.createdAt);
    if (item9) raiseCrisisAlert({ userId: user.id, sessionId: null, source: 'intake', excerpt: 'PHQ-9 第 9 题阳性' });
  });
  res.status(201).json(result);
}));
