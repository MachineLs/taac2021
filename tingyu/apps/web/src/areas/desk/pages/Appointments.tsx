// /desk/appointments — filterable list of the counselor's appointments.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AppointmentStatus } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { monthDay, time, weekday, yuan } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { addDays, cnIso, todayKey, weekStart } from '../lib';
import { Avatar, Icon, ModeTag, PageHead, StatusBadge } from '../ui';

type StatusFilter = 'all' | AppointmentStatus;
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'paid', label: '待咨询' }, { key: 'in_session', label: '咨询中' },
  { key: 'completed', label: '已完成' }, { key: 'cancelled', label: '已取消' }, { key: 'refunded', label: '已退款' },
];

export default function Appointments() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const clientId = params.get('client');
  const today = todayKey();
  const PRESETS = useMemo(() => [
    { key: 'upcoming', label: '未来 14 天', from: today, to: addDays(today, 13) },
    { key: 'week', label: '本周', from: weekStart(today), to: addDays(weekStart(today), 6) },
    { key: 'month', label: '本月', from: `${today.slice(0, 7)}-01`, to: addDays(`${today.slice(0, 7)}-01`, 30) },
    { key: 'past30', label: '近 30 天', from: addDays(today, -29), to: today },
  ], [today]);
  const [from, setFrom] = useState(addDays(today, clientId ? -179 : -29));
  const [to, setTo] = useState(addDays(today, 13));
  const [status, setStatus] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');

  const valid = from <= to;
  const list = useAsync(() => (valid ? api.wbAppointments({ from: cnIso(from), to: cnIso(addDays(to, 1)) }) : Promise.resolve([])), [from, to]);
  const items = useMemo(() => (list.data ?? []).filter((a) => !clientId || a.client.id === clientId).sort((a, b) => b.startAt.localeCompare(a.startAt)), [list.data, clientId]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const a of items) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [items]);
  const clientName = clientId ? (list.data ?? []).find((a) => a.client.id === clientId)?.client.name ?? '该来访者' : null;
  const shown = items.filter((a) => (status === 'all' || a.status === status) && (!q.trim() || a.client.name.includes(q.trim())));
  const activePreset = PRESETS.find((p) => p.from === from && p.to === to)?.key;
  const total = shown.filter((a) => a.status === 'completed' || a.status === 'paid' || a.status === 'in_session').reduce((s, a) => s + a.amount, 0);

  return (
    <div className="desk-page">
      <PageHead title="来访列表" sub="查看所有预约与咨询，点击一行打开来访者简报。" />

      <div className="card desk-filters">
        <div className="desk-filter-row">
          <div className="seg" role="tablist" aria-label="快捷日期">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={activePreset === p.key} onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>
            ))}
          </div>
          <div className="desk-daterange">
            <label><span className="sr-only">开始日期</span><input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
            <span className="muted">至</span>
            <label><span className="sr-only">结束日期</span><input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          </div>
          <label className="desk-search">
            <span className="sr-only">搜索来访者</span>
            <input className="input" placeholder="搜索来访者姓名" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {clientName && (
          <div className="desk-client-filter">仅显示 <b>{clientName}</b> 的来访<button className="btn btn-text" type="button" onClick={() => setParams({})}>查看全部</button></div>
        )}
        <div className="desk-status-tabs" role="tablist" aria-label="状态筛选">
          {STATUS_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={status === t.key} className={`chip${status === t.key ? ' on' : ''}`} onClick={() => setStatus(t.key)}>
              {t.label}<span className="desk-chip-n num">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card desk-table-card">
        {!valid ? <Empty title="日期范围不正确" hint="开始日期不能晚于结束日期" />
          : list.loading ? <Loading />
          : list.error ? <ErrorState error={list.error} onRetry={list.reload} />
          : shown.length === 0 ? <Empty title="没有符合条件的来访" hint="换个日期范围或状态试试" />
          : (
            <>
              <div className="desk-table-wrap">
                <table className="desk-table">
                  <thead>
                    <tr><th>时间</th><th>来访者</th><th>方式</th><th>状态</th><th className="r">金额</th><th>来源</th><th aria-label="操作" /></tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id} onClick={() => nav(`/desk/appointments/${a.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/desk/appointments/${a.id}`)}>
                        <td><b className="num">{monthDay(a.startAt)}</b> <span className="muted">{weekday(a.startAt)}</span><div className="num muted">{time(a.startAt)}–{time(a.endAt)}</div></td>
                        <td><div className="desk-cell-who"><Avatar src={a.client.avatar} name={a.client.name} size={32} /><b>{a.client.name}</b></div></td>
                        <td><ModeTag mode={a.mode} /></td>
                        <td><StatusBadge status={a.status} /></td>
                        <td className="r num"><b>{yuan(a.amount)}</b>{a.discount > 0 && <div className="muted desk-small">优惠 {yuan(a.discount)}</div>}</td>
                        <td>{a.creatorId ? <span className="desk-src"><Icon name="link" size={13} />达人推广</span> : <span className="muted">自然流量</span>}</td>
                        <td className="r"><Link className="btn btn-text" to={`/desk/appointments/${a.id}`} onClick={(e) => e.stopPropagation()}>简报</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="desk-table-foot">
                <span>共 <b className="num">{shown.length}</b> 条</span>
                <span>有效金额合计 <b className="num">{yuan(total)}</b></span>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
