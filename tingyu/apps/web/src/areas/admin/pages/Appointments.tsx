// /admin/appointments — 订单管理 (F4).
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppointmentStatus } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, modeLabel, STATUS_LABEL, time, yuan } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { asError } from '../lib';

const FILTERS: { key: AppointmentStatus | ''; label: string }[] = [
  { key: '', label: '全部' }, { key: 'pending_payment', label: '待支付' }, { key: 'paid', label: '待咨询' }, { key: 'in_session', label: '咨询中' },
  { key: 'completed', label: '已完成' }, { key: 'cancelled', label: '已取消' }, { key: 'refunded', label: '已退款' },
];
const STATUS_BADGE: Record<AppointmentStatus, string> = {
  pending_payment: 'badge badge-gold', paid: 'badge', in_session: 'badge adm-badge-cyan', completed: 'badge badge-green', cancelled: 'badge badge-gray', refunded: 'badge badge-red',
};
const isStatus = (s: string | null): s is AppointmentStatus => !!s && s in STATUS_LABEL;

export default function Appointments() {
  const [sp, setSp] = useSearchParams();
  const rawStatus = sp.get('status');
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const { data, error, loading, reload } = useAsync(() => api.adminAppointments({ status, page }), [status, page]);
  const creators = useAsync(() => api.adminCreators().catch(() => []), []);
  const creatorName = useMemo(() => new Map((creators.data ?? []).map((c) => [c.id, c.name])), [creators.data]);

  const go = (next: { status?: string; page?: number }) => {
    const p = new URLSearchParams(sp);
    if (next.status !== undefined) { if (next.status) p.set('status', next.status); else p.delete('status'); p.delete('page'); }
    if (next.page !== undefined) { if (next.page > 1) p.set('page', String(next.page)); else p.delete('page'); }
    setSp(p);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize))) : 1;

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div className="adm-filters" role="toolbar" aria-label="按状态筛选">
          {FILTERS.map((f) => (
            <button key={f.key || 'all'} type="button" className={`chip${(status ?? '') === f.key ? ' on' : ''}`} aria-pressed={(status ?? '') === f.key} onClick={() => go({ status: f.key })}>{f.label}</button>
          ))}
        </div>
        {data && <span className="adm-sub">共 <b className="num">{data.total}</b> 笔订单</span>}
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorState error={asError(error)} onRetry={reload} /> : !data ? null : data.items.length === 0 ? (
        <div className="card"><Empty title="没有符合条件的订单" hint={status ? `当前筛选：${STATUS_LABEL[status]}` : undefined} /></div>
      ) : (
        <div className="card adm-table-card" style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>订单号</th><th>来访者</th><th>咨询师</th><th>预约时间</th><th>方式</th><th className="r">金额</th><th className="r">优惠</th><th>来源达人</th><th>状态</th></tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td><code className="adm-code">{a.id}</code><span className="adm-cell-sub">下单 {dateTime(a.createdAt)}</span></td>
                    <td>
                      <div className="adm-person adm-person-sm">
                        {a.client.avatar ? <img className="avatar" src={a.client.avatar} alt="" width={28} height={28} /> : <span className="adm-avatar-ph" aria-hidden="true">{a.client.name.slice(0, 1)}</span>}
                        <b>{a.client.name}</b>
                      </div>
                    </td>
                    <td>
                      <div className="adm-person adm-person-sm">
                        <img className="avatar" src={a.counselor.avatar} alt="" width={28} height={28} />
                        <b>{a.counselor.name}</b>
                      </div>
                    </td>
                    <td className="nowrap">{dateTime(a.startAt)}<span className="adm-cell-sub">至 {time(a.endAt)}</span></td>
                    <td>{modeLabel(a.mode)}</td>
                    <td className="r"><b className="num">{yuan(a.amount)}</b>{a.discount > 0 && <span className="adm-cell-sub">原价 {yuan(a.price)}</span>}</td>
                    <td className="r num">{a.discount > 0 ? <span className="adm-discount">-{yuan(a.discount)}</span> : <span className="muted">—</span>}</td>
                    <td>{a.creatorId ? <span className="tag adm-tag-blue">{creatorName.get(a.creatorId) ?? '达人推荐'}</span> : <span className="muted">自然流量</span>}</td>
                    <td><span className={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-pager">
            <span className="adm-sub">第 {data.page} / {pages} 页 · 每页 {data.pageSize} 条</span>
            <div className="adm-pager-btns">
              <button type="button" className="btn btn-line btn-sm" disabled={page <= 1 || loading} onClick={() => go({ page: page - 1 })}>上一页</button>
              {pageList(page, pages).map((p, i) => p === 0
                ? <span key={`e${i}`} className="adm-pager-gap">…</span>
                : <button key={p} type="button" className={`btn btn-sm ${p === page ? 'btn-blue' : 'btn-line'}`} aria-current={p === page ? 'page' : undefined} disabled={loading} onClick={() => go({ page: p })}>{p}</button>)}
              <button type="button" className="btn btn-line btn-sm" disabled={page >= pages || loading} onClick={() => go({ page: page + 1 })}>下一页</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** [1, 0(gap), 4, 5, 6, 0, 12] */
function pageList(cur: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: number[] = [1];
  const lo = Math.max(2, cur - 1), hi = Math.min(total - 1, cur + 1);
  if (lo > 2) out.push(0);
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < total - 1) out.push(0);
  out.push(total);
  return out;
}
