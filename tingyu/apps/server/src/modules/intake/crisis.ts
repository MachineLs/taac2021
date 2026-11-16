// Crisis language detection + handling shared by intake, assessments and messages. Owner: B2.
import { HOTLINES, type CrisisInfo } from '@tingyu/shared';
import { all, one, run } from '../../core/db';
import { notify } from '../../core/notify';
import { id, nowIso } from '../../core/util';

/** Patterns that indicate suicidal / self-harm ideation. */
const CRISIS_PATTERNS: RegExp[] = [
  /自杀/, /不想活/, /活不下去/, /活着没意思/, /活着没有意义/, /结束(自己的?)?(生命|一切)/, /轻生/,
  /伤害自己/, /自残/, /自伤/, /割腕/, /跳楼/, /跳河/, /上吊/, /想死/, /去死/, /寻死/, /一了百了/, /不想醒来/,
  /安眠药.{0,6}攒|攒.{0,6}安眠药/, /遗书/, /离开这个世界/,
];

/**
 * Negation immediately before the keyword ("不想死", "没有想过自杀", "从来没有伤害自己的念头", "不会自残").
 * Anchored at the end of the preceding text so "我不开心想自杀" is NOT treated as negated.
 */
const NEGATION_BEFORE = /(不|没|没有|从没|从没有|从来没|从来没有|从未|不会|并不|并没有|未曾|绝不|绝对不会|不可能)(有过?|过)?(想过?|打算|会|要|再)?(要|去)?$/;

export interface CrisisHit { matched: string; index: number }

/** Returns the first non-negated crisis expression in the text, or null. */
export function detectCrisis(text: string): CrisisHit | null {
  const t = text.replace(/\s+/g, '');
  for (const re of CRISIS_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 8), m.index);
      if (!NEGATION_BEFORE.test(before)) return { matched: m[0], index: m.index };
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return null;
}

export const CRISIS_REPLY = '听到你这么说，我很担心你，也谢谢你愿意告诉我。你现在安全吗？如果有危险请马上拨打 120 或 110，也可以打 12356 心理援助热线。';

export const crisisInfo = (): CrisisInfo => ({ hotlines: HOTLINES, message: CRISIS_REPLY });

export const adminUserIds = (): string[] =>
  all(`SELECT id FROM users WHERE roles LIKE '%"admin"%'`).map((r) => r.id as string);

/**
 * Records a crisis alert and notifies every admin.
 * For intake sessions only one open/handling alert is kept per session (later hits don't spam the queue).
 */
export function raiseCrisisAlert(opts: { userId: string | null; sessionId: string | null; source: 'intake' | 'message'; excerpt: string }): string | null {
  if (opts.sessionId) {
    const existing = one("SELECT id FROM crisis_alerts WHERE session_id = ? AND status IN ('open','handling')", opts.sessionId);
    if (existing) return null;
  }
  const alertId = id('ca');
  const excerpt = opts.excerpt.slice(0, 120);
  run('INSERT INTO crisis_alerts (id, user_id, session_id, source, excerpt, status, created_at) VALUES (?,?,?,?,?,?,?)',
    alertId, opts.userId, opts.sessionId, opts.source, excerpt, 'open', nowIso());
  const where = opts.source === 'intake' ? '小屿接待' : '咨询消息';
  for (const adminId of adminUserIds()) {
    notify(adminId, 'crisis', '危机预警：请尽快跟进', `${where}中识别到高风险表达：「${excerpt.slice(0, 40)}」`, '/admin/crisis');
  }
  return alertId;
}
