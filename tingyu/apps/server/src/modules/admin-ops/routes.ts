// Module: admin-ops — owner: B2 (care & growth). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { AdminOverview, Creator, CrisisAlert } from '@tingyu/shared';
import { me, requireRole } from '../../core/auth';
import { all, one, run, type Row } from '../../core/db';
import { h, notFound, parse } from '../../core/errors';
import { cnDate, nowIso } from '../../core/util';
import { PAID_STATES, cnDayStartIso, commissionTotal, firstOrders, lastCnDates, toCreator } from '../creators/service';

export const router = Router();
const admin = requireRole('admin');

const n = (sql: string, ...p: any[]) => (one(sql, ...p)!.n as number) ?? 0;

router.get('/admin/overview', admin, h((_req, res) => {
  const today = cnDate(nowIso());
  const dates = lastCnDates(14);
  const since = cnDayStartIso(dates[0]);
  const daily = new Map(dates.map((d) => [d, { date: d, gmv: 0, appointments: 0, intakes: 0 }]));
  for (const a of all(`SELECT amount, paid_at FROM appointments WHERE status IN ${PAID_STATES} AND paid_at >= ?`, since)) {
    const d = daily.get(cnDate(a.paid_at)); if (d) { d.gmv += a.amount; d.appointments += 1; }
  }
  for (const s of all('SELECT created_at FROM intake_sessions WHERE created_at >= ?', since)) {
    const d = daily.get(cnDate(s.created_at)); if (d) d.intakes += 1;
  }
  const overview: AdminOverview = {
    users: n('SELECT COUNT(*) AS n FROM users'),
    counselors: {
      approved: n("SELECT COUNT(*) AS n FROM counselors WHERE status = 'approved'"),
      pending: n("SELECT COUNT(*) AS n FROM counselors WHERE status = 'pending'"),
    },
    appointments: {
      today: all(`SELECT start_at FROM appointments WHERE status IN ${PAID_STATES} AND start_at >= ? AND start_at < ?`,
        cnDayStartIso(today), new Date(new Date(cnDayStartIso(today)).getTime() + 86400000).toISOString()).length,
      paid: n("SELECT COUNT(*) AS n FROM appointments WHERE status = 'paid'"),
      completed: n("SELECT COUNT(*) AS n FROM appointments WHERE status = 'completed'"),
    },
    gmv: n(`SELECT COALESCE(SUM(amount), 0) AS n FROM appointments WHERE status IN ${PAID_STATES}`),
    intakes: n('SELECT COUNT(*) AS n FROM intake_sessions'),
    openCrisis: n("SELECT COUNT(*) AS n FROM crisis_alerts WHERE status = 'open'"),
    daily: [...daily.values()],
  };
  res.json(overview);
}));

const CRISIS_SELECT = `SELECT ca.*, u.name AS u_name, u.phone AS u_phone FROM crisis_alerts ca LEFT JOIN users u ON u.id = ca.user_id`;
const toAlert = (r: Row): CrisisAlert => ({
  id: r.id, user: r.user_id ? { id: r.user_id, name: r.u_name, phone: r.u_phone } : null, sessionId: r.session_id ?? null,
  source: r.source, excerpt: r.excerpt, status: r.status, createdAt: r.created_at, handledBy: r.handled_by ?? null,
});

const CrisisQuery = z.object({ status: z.enum(['open', 'handling', 'resolved']).optional() });
router.get('/admin/crisis', admin, h((req, res) => {
  const { status } = parse(CrisisQuery, req.query);
  const rows = status ? all(`${CRISIS_SELECT} WHERE ca.status = ? ORDER BY ca.created_at DESC`, status) : all(`${CRISIS_SELECT} ORDER BY ca.created_at DESC`);
  const list: CrisisAlert[] = rows.map(toAlert);
  res.json(list);
}));

const CrisisBody = z.object({ status: z.enum(['handling', 'resolved']) });
router.patch('/admin/crisis/:id', admin, h((req, res) => {
  const { status } = parse(CrisisBody, req.body);
  const r = run('UPDATE crisis_alerts SET status = ?, handled_by = ? WHERE id = ?', status, me(req).id, String(req.params.id));
  if (!Number(r.changes)) throw notFound('预警不存在');
  const alert: CrisisAlert = toAlert(one(`${CRISIS_SELECT} WHERE ca.id = ?`, String(req.params.id))!);
  res.json(alert);
}));

router.get('/admin/creators', admin, h((_req, res) => {
  const list: (Creator & { firstOrders: number; commissionTotal: number })[] = all('SELECT * FROM creators ORDER BY followers DESC')
    .map((c) => ({ ...toCreator(c), firstOrders: firstOrders(c.id), commissionTotal: commissionTotal(c.id) }));
  res.json(list);
}));
