// Module: admin-commerce — owner: B1 (commerce core). See docs/API.md.
import { Router } from 'express';
import { z } from 'zod';
import type { Appointment, CounselorDetail, Page, Role } from '@tingyu/shared';
import { all, one, run, j } from '../../core/db';
import { requireRole } from '../../core/auth';
import { h, notFound, parse } from '../../core/errors';
import { listAppointments, toCounselorDetail } from '../../core/mappers';
import { notify } from '../../core/notify';
import { expireStalePending, param } from '../appointments/service';

export const router = Router();
const admin = requireRole('admin');
const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);
const counselorStatus = z.enum(['pending', 'approved', 'rejected']);

router.get('/admin/counselors', admin, h((req, res) => {
  const q = parse(z.object({ status: z.preprocess(emptyToUndef, counselorStatus.optional()) }), req.query);
  const rows = q.status
    ? all('SELECT * FROM counselors WHERE status = ? ORDER BY created_at DESC, sort_weight DESC', q.status)
    : all(`SELECT * FROM counselors ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC, sort_weight DESC`);
  const out: CounselorDetail[] = rows.map(toCounselorDetail);
  res.json(out);
}));

router.post('/admin/counselors/:id/review', admin, h((req, res) => {
  const body = parse(z.object({ status: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional() }), req.body);
  const c = one('SELECT * FROM counselors WHERE id = ?', param(req));
  if (!c) throw notFound('咨询师不存在');
  run('UPDATE counselors SET status = ? WHERE id = ?', body.status, c.id);
  if (c.user_id) {
    if (body.status === 'approved') {
      const u = one('SELECT roles FROM users WHERE id = ?', c.user_id);
      const roles = j<Role[]>(u?.roles, ['client']);
      if (!roles.includes('counselor')) run('UPDATE users SET roles = ? WHERE id = ?', JSON.stringify([...roles, 'counselor']), c.user_id);
      notify(c.user_id, 'application', '入驻审核通过', `欢迎加入听屿！现在可以在工作台设置可预约时间了。${body.note ? `备注：${body.note}` : ''}`, '/desk');
    } else {
      notify(c.user_id, 'application', '入驻审核未通过', body.note ? `审核意见：${body.note}` : '很遗憾，本次入驻申请未通过审核，可以完善资料后联系平台。', '/desk');
    }
  }
  const out: CounselorDetail = toCounselorDetail(one('SELECT * FROM counselors WHERE id = ?', c.id)!);
  res.json(out);
}));

router.get('/admin/appointments', admin, h((req, res) => {
  expireStalePending();
  const q = parse(z.object({
    status: z.preprocess(emptyToUndef, z.enum(['pending_payment', 'paid', 'in_session', 'completed', 'cancelled', 'refunded']).optional()),
    page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
    pageSize: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).optional()),
  }), req.query);
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const where = q.status ? 'WHERE a.status = ?' : '';
  const params = q.status ? [q.status] : [];
  const total = Number(one(`SELECT COUNT(*) AS n FROM appointments a ${where}`, ...params)!.n);
  const items = listAppointments(`${where} ORDER BY a.created_at DESC, a.id LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize);
  const out: Page<Appointment> = { items, total, page, pageSize };
  res.json(out);
}));
