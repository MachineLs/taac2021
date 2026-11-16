// Intake session persistence, access control and the crisis-first reply pipeline. Owner: B2.
import type { CrisisInfo, IntakeMessage, IntakeReplyRes, IntakeSession, IntakeSummary, RiskLevel } from '@tingyu/shared';
import { all, j, one, run, type Row } from '../../core/db';
import type { AuthUser } from '../../core/auth';
import { config } from '../../core/config';
import { conflict, forbidden, notFound, unauthorized } from '../../core/errors';
import { emit } from '../../core/events';
import { id, nowIso } from '../../core/util';
import { CRISIS_REPLY, crisisInfo, detectCrisis, raiseCrisisAlert } from './crisis';
import { llmProvider } from './llm';
import { initialState, type HistoryItem, type IntakeProvider, type IntakeState } from './provider';
import { greeting, markCrisis, ruleProvider } from './rules';

export const provider = (): IntakeProvider => (config.anthropicApiKey ? llmProvider : ruleProvider);

const toMessage = (m: Row): IntakeMessage => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at });

export function loadMessages(sessionId: string): IntakeMessage[] {
  return all('SELECT * FROM intake_messages WHERE session_id = ? ORDER BY created_at, rowid', sessionId).map(toMessage);
}

export function toSession(r: Row, withMessages = true): IntakeSession {
  return {
    id: r.id, userId: r.user_id ?? null, status: r.status, risk: r.risk as RiskLevel, crisis: !!r.crisis,
    messages: withMessages ? loadMessages(r.id) : [],
    summary: j<IntakeSummary | null>(r.summary, null), createdAt: r.created_at, endedAt: r.ended_at ?? null,
  };
}

export function loadState(r: Row): IntakeState {
  const base = initialState();
  const s = j<Partial<IntakeState>>(r.state, {});
  return { ...base, ...s, signals: { ...base.signals, ...(s.signals ?? {}) }, slots: { ...(s.slots ?? {}) }, retries: { ...(s.retries ?? {}) } };
}

/** Anonymous sessions are reachable by id; bound sessions only by their owner or an admin. */
export function getAccessibleRow(sessionId: string, user: AuthUser | undefined): Row {
  const r = one('SELECT * FROM intake_sessions WHERE id = ?', sessionId);
  if (!r) throw notFound('接待会话不存在');
  if (r.user_id) {
    if (!user) throw unauthorized('请先登录后查看这次接待');
    if (user.id !== r.user_id && !user.roles.includes('admin')) throw forbidden('这不是你的接待会话');
  }
  return r;
}

function addMessage(sessionId: string, role: 'assistant' | 'user', content: string): IntakeMessage {
  const m = { id: id('im'), role, content, createdAt: nowIso() };
  run('INSERT INTO intake_messages (id, session_id, role, content, created_at) VALUES (?,?,?,?,?)', m.id, sessionId, role, content, m.createdAt);
  return m;
}

export function createSession(user: AuthUser | undefined): IntakeSession {
  const sid = id('is');
  const state: IntakeState = { ...initialState(), provider: provider().name };
  run('INSERT INTO intake_sessions (id, user_id, status, risk, crisis, state, created_at) VALUES (?,?,?,?,?,?,?)',
    sid, user?.id ?? null, 'active', 'low', 0, JSON.stringify(state), nowIso());
  addMessage(sid, 'assistant', greeting());
  return toSession(one('SELECT * FROM intake_sessions WHERE id = ?', sid)!);
}

const history = (sessionId: string): HistoryItem[] => loadMessages(sessionId).map((m) => ({ role: m.role, content: m.content }));

export async function replyTo(sessionId: string, user: AuthUser | undefined, content: string): Promise<IntakeReplyRes> {
  const row = getAccessibleRow(sessionId, user);
  if (row.status !== 'active') throw conflict('这次接待已经结束了，可以重新开始一次新的对话');
  const state = loadState(row);
  addMessage(sessionId, 'user', content);

  let text: string;
  let next: IntakeState;
  let crisis: CrisisInfo | null = null;

  // 1) crisis layer first, regardless of provider
  if (detectCrisis(content)) {
    next = markCrisis(state, content);
    text = CRISIS_REPLY;
    crisis = crisisInfo();
  } else {
    const r = await provider().reply(history(sessionId), state);
    next = r.state; text = r.text;
    // a "yes" to the safety question is handled exactly like crisis language
    if (next.safety === 'risk' && state.safety !== 'risk') {
      next = markCrisis({ ...next, turns: next.turns - 1 }, content);
      text = CRISIS_REPLY;
      crisis = crisisInfo();
    }
  }

  // the session may have been ended concurrently while the LLM was thinking
  const fresh = one('SELECT status FROM intake_sessions WHERE id = ?', sessionId);
  if (fresh?.status !== 'active') throw conflict('这次接待已经结束了');

  const reply = addMessage(sessionId, 'assistant', text);
  const risk: RiskLevel = next.crisis ? 'high' : next.safety === 'unclear' && row.risk === 'low' ? 'medium' : row.risk;
  run('UPDATE intake_sessions SET state = ?, risk = ?, crisis = ? WHERE id = ?', JSON.stringify(next), risk, next.crisis || row.crisis ? 1 : 0, sessionId);

  if (crisis) {
    raiseCrisisAlert({ userId: row.user_id ?? null, sessionId, source: 'intake', excerpt: content });
    emit('intake.crisis', { sessionId, userId: row.user_id ?? null });
  }
  return { session: toSession(one('SELECT * FROM intake_sessions WHERE id = ?', sessionId)!), reply, crisis };
}

export async function endSession(sessionId: string, user: AuthUser | undefined): Promise<IntakeSession> {
  const row = getAccessibleRow(sessionId, user);
  if (row.status === 'ended' && row.summary) return toSession(row);
  const summary = await provider().summarize(history(sessionId), loadState(row));
  if (row.crisis) { summary.risk = 'high'; }
  run("UPDATE intake_sessions SET status = 'ended', ended_at = COALESCE(ended_at, ?), summary = ?, risk = ? WHERE id = ?",
    nowIso(), JSON.stringify(summary), summary.risk, sessionId);
  return toSession(one('SELECT * FROM intake_sessions WHERE id = ?', sessionId)!);
}

export function listMine(userId: string): IntakeSession[] {
  return all('SELECT * FROM intake_sessions WHERE user_id = ? ORDER BY created_at DESC', userId).map((r) => toSession(r));
}

export function claimSession(sessionId: string, user: AuthUser): IntakeSession {
  const r = one('SELECT * FROM intake_sessions WHERE id = ?', sessionId);
  if (!r) throw notFound('接待会话不存在');
  if (r.user_id && r.user_id !== user.id) throw forbidden('这次接待已经属于其他账号');
  if (!r.user_id) {
    run('UPDATE intake_sessions SET user_id = ? WHERE id = ? AND user_id IS NULL', user.id, sessionId);
    run('UPDATE crisis_alerts SET user_id = ? WHERE session_id = ? AND user_id IS NULL', user.id, sessionId);
  }
  return toSession(one('SELECT * FROM intake_sessions WHERE id = ?', sessionId)!);
}
