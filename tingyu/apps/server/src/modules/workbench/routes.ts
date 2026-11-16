// Module: workbench — owner: B1 (commerce core). See docs/API.md.
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AssessmentResult, ClientBrief, CounselorEarnings, IntakeSummary, SessionNote, Slot } from '@tingyu/shared';
import { all, one, run, tx, j, type Row } from '../../core/db';
import { requireRole, me } from '../../core/auth';
import { badRequest, conflict, forbidden, h, notFound, parse } from '../../core/errors';
import { listAppointments, loadAppointment } from '../../core/mappers';
import { addDays, addMinutes, cnDate, id, nowIso } from '../../core/util';
import { toSlot } from '../counselors/routes';
import { expireStalePending, param } from '../appointments/service';

export const router = Router();
const counselor = requireRole('counselor');
const SLOT_MINUTES = 50;

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);
const isoOpt = z.preprocess(emptyToUndef, z.string().datetime({ offset: true }).optional());
const cid = (req: Request): string => me(req).counselorId!;

function myAppt(req: Request): Row {
  const a = one('SELECT * FROM appointments WHERE id = ?', param(req));
  if (!a) throw notFound('预约不存在');
  if (a.counselor_id !== cid(req)) throw forbidden('这不是你的来访');
  return a;
}
const toNote = (n: Row): SessionNote => ({ id: n.id, appointmentId: n.appointment_id, content: n.content, createdAt: n.created_at, updatedAt: n.updated_at });

// ---------- appointments ----------
router.get('/workbench/appointments', counselor, h((req, res) => {
  expireStalePending();
  const q = parse(z.object({ from: isoOpt, to: isoOpt }), req.query);
  const now = nowIso();
  const from = q.from ? new Date(q.from).toISOString() : addDays(now, -7);
  const to = q.to ? new Date(q.to).toISOString() : addDays(now, 14);
  // Unpaid holds (pending_payment / cancelled) are not part of the counselor's schedule.
  res.json(listAppointments(`WHERE a.counselor_id = ? AND a.start_at >= ? AND a.start_at < ? AND a.status NOT IN ('pending_payment','cancelled')
    ORDER BY a.start_at ASC`, cid(req), from, to));
}));

router.get('/workbench/appointments/:id/brief', counselor, h((req, res) => {
  const a = myAppt(req);
  const appointment = loadAppointment(a.id)!;
  let intake: IntakeSummary | null = null;
  let assessments: AssessmentResult[] = [];
  if (a.share_intake) {
    const s = a.intake_session_id
      ? one('SELECT summary FROM intake_sessions WHERE id = ? AND user_id = ?', a.intake_session_id, a.user_id)
      : one(`SELECT summary FROM intake_sessions WHERE user_id = ? AND summary IS NOT NULL ORDER BY created_at DESC LIMIT 1`, a.user_id);
    intake = j<IntakeSummary | null>(s?.summary, null);
    // latest result per scale
    assessments = all(`SELECT r.* FROM assessment_results r WHERE r.user_id = ? AND r.created_at = (
        SELECT MAX(r2.created_at) FROM assessment_results r2 WHERE r2.user_id = r.user_id AND r2.scale = r.scale)
      GROUP BY r.scale ORDER BY r.scale`, a.user_id)
      .map((r): AssessmentResult => ({ id: r.id, scale: r.scale, score: r.score, max: r.max, level: r.level, interpretation: r.interpretation,
        answers: j<number[]>(r.answers, []), createdAt: r.created_at }));
  }
  // notes this counselor wrote about this client, across all their sessions
  const notes = all(`SELECT n.* FROM session_notes n JOIN appointments a ON a.id = n.appointment_id
    WHERE n.counselor_id = ? AND a.user_id = ? ORDER BY n.created_at DESC`, a.counselor_id, a.user_id).map(toNote);
  const creatorId = a.creator_id ?? one('SELECT referred_by_creator_id AS r FROM users WHERE id = ?', a.user_id)?.r ?? null;
  const cr = creatorId ? one('SELECT name FROM creators WHERE id = ?', creatorId) : undefined;
  const out: ClientBrief = { appointment, intake, assessments, notes, source: cr ? { creatorName: cr.name } : null };
  res.json(out);
}));

router.post('/workbench/appointments/:id/notes', counselor, h((req, res) => {
  const { content } = parse(z.object({ content: z.string().trim().min(1, '笔记不能为空').max(5000) }), req.body);
  const a = myAppt(req);
  const now = nowIso();
  const existing = one('SELECT id FROM session_notes WHERE appointment_id = ? AND counselor_id = ?', a.id, a.counselor_id);
  let noteId: string;
  if (existing) {
    noteId = existing.id;
    run('UPDATE session_notes SET content = ?, updated_at = ? WHERE id = ?', content, now, noteId);
  } else {
    noteId = id('sn');
    run('INSERT INTO session_notes (id, appointment_id, counselor_id, content, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      noteId, a.id, a.counselor_id, content, now, now);
  }
  const out: SessionNote = toNote(one('SELECT * FROM session_notes WHERE id = ?', noteId)!);
  res.json(out);
}));

// ---------- slots ----------
router.get('/workbench/slots', counselor, h((req, res) => {
  expireStalePending();
  const q = parse(z.object({
    from: isoOpt,
    days: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(60).optional()),
  }), req.query);
  const from = q.from ? new Date(q.from).toISOString() : nowIso();
  const to = addDays(from, q.days ?? 14);
  const out: Slot[] = all('SELECT * FROM slots WHERE counselor_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at', cid(req), from, to).map(toSlot);
  res.json(out);
}));

router.post('/workbench/slots', counselor, h((req, res) => {
  const { slots } = parse(z.object({
    slots: z.array(z.object({ startAt: z.string().datetime({ offset: true }) })).min(1).max(200),
  }), req.body);
  const now = nowIso();
  const counselorId = cid(req);
  const starts = [...new Set(slots.map((s) => new Date(s.startAt).toISOString()))].sort();
  if (starts.some((s) => s <= now)) throw badRequest('不能添加已经过去的时间');
  const created: string[] = [];
  tx(() => {
    for (const start of starts) {
      const end = addMinutes(start, SLOT_MINUTES);
      // a previously blocked/removed slot at exactly this time is re-opened
      const same = one('SELECT id, status FROM slots WHERE counselor_id = ? AND start_at = ?', counselorId, start);
      if (same?.status === 'blocked') {
        run(`UPDATE slots SET status = 'open' WHERE id = ?`, same.id);
        created.push(same.id);
        continue;
      }
      // duplicates (same start) and overlaps with existing slots are ignored
      const clash = one('SELECT 1 FROM slots WHERE counselor_id = ? AND start_at < ? AND end_at > ?', counselorId, end, start);
      if (clash) continue;
      const sid = id('s');
      run(`INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,'open')`, sid, counselorId, start, end);
      created.push(sid);
    }
  });
  const out: Slot[] = created.map((sid) => toSlot(one('SELECT * FROM slots WHERE id = ?', sid)!));
  res.status(201).json(out);
}));

router.delete('/workbench/slots/:id', counselor, h((req, res) => {
  const s = one('SELECT * FROM slots WHERE id = ?', param(req));
  if (!s || s.counselor_id !== cid(req)) throw notFound('时段不存在');
  if (s.status !== 'open') throw conflict(s.status === 'booked' ? '已被预约的时段不能删除' : '只能删除可预约的时段');
  const r = run(`DELETE FROM slots WHERE id = ? AND status = 'open'
    AND NOT EXISTS (SELECT 1 FROM appointments WHERE slot_id = slots.id)`, s.id);
  if (Number(r.changes) !== 1) {
    // historical (cancelled) orders still reference the slot: hide it instead of deleting
    run(`UPDATE slots SET status = 'blocked' WHERE id = ? AND status = 'open'`, s.id);
  }
  res.json({ ok: true } as const);
}));

// ---------- earnings ----------
router.get('/workbench/earnings', counselor, h((req, res) => {
  const q = parse(z.object({ month: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式应为 YYYY-MM').optional()) }), req.query);
  const month = q.month ?? cnDate(nowIso()).slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  // China-time month boundaries in UTC
  const from = new Date(Date.UTC(y, m - 1, 1) - 8 * 3600000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) - 8 * 3600000).toISOString();
  const counselorId = cid(req);
  const done = one(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM appointments
    WHERE counselor_id = ? AND status = 'completed' AND start_at >= ? AND start_at < ?`, counselorId, from, to)!;
  const pending = one(`SELECT COALESCE(SUM(amount), 0) AS s FROM appointments
    WHERE counselor_id = ? AND status IN ('paid','in_session') AND start_at >= ? AND start_at < ?`, counselorId, from, to)!;
  const gross = Number(done.s);
  const platformFee = Math.round(gross * 0.3);
  const out: CounselorEarnings = {
    month, sessions: Number(done.n), gross, platformFee, net: gross - platformFee, pendingSettlement: Math.round(Number(pending.s) * 0.7),
  };
  res.json(out);
}));
