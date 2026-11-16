// /m/orders — my appointments with status tabs.
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Appointment, AppointmentStatus } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, range, STATUS_LABEL, yuan } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { modeFull, errMsg, NavBar } from '../ui';

const TABS: { k: string; label: string; st: AppointmentStatus[] }[] = [
  { k: 'pending', label: '待支付', st: ['pending_payment'] },
  { k: 'upcoming', label: '待咨询', st: ['paid', 'in_session'] },
  { k: 'done', label: '已完成', st: ['completed'] },
  { k: 'cancelled', label: '已取消', st: ['cancelled', 'refunded'] },
];
export const STATUS_TONE: Record<AppointmentStatus, string> = { pending_payment: 'orange', paid: 'blue', in_session: 'green', completed: 'gray', cancelled: 'gray', refunded: 'gray' };

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const list = useAsync(() => api.appointments(), []);
  const tab = TABS.find((t) => t.k === sp.get('tab')) ?? TABS[1];
  const items = (list.data ?? []).filter((a) => tab.st.includes(a.status)).sort((a, b) => (tab.k === 'upcoming' ? a.startAt.localeCompare(b.startAt) : b.createdAt.localeCompare(a.createdAt)));
  const count = (t: typeof TABS[number]) => (list.data ?? []).filter((a) => t.st.includes(a.status)).length;

  return (
    <>
      <NavBar title="我的预约" />
      <div className="m-pill-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={t.k === tab.k} className={t.k === tab.k ? 'on' : ''} onClick={() => setSp({ tab: t.k }, { replace: true })}>
            {t.label}{(t.k === 'pending' || t.k === 'upcoming') && count(t) > 0 && <span className="num">{count(t)}</span>}
          </button>
        ))}
      </div>
      {list.loading && !list.data ? <Loading full />
        : list.error ? <ErrorState error={new Error(errMsg(list.error, '订单加载失败'))} onRetry={list.reload} />
        : !items.length ? <Empty title={`暂无${tab.label}的预约`} hint="找到合适的咨询师，开始第一次咨询" action={<Link className="btn btn-blue btn-pill" to="/m/counselors">找咨询师</Link>} />
        : <div className="m-stack">{items.map((a) => <OrderCard key={a.id} a={a} />)}</div>}
    </>
  );
}

export function OrderCard({ a }: { a: Appointment }) {
  const nav = useNavigate();
  const canJoin = (a.status === 'paid' || a.status === 'in_session') && new Date(a.startAt).getTime() - Date.now() < 10 * 60000 && new Date(a.endAt).getTime() > Date.now();
  return (
    <article className="m-order" onClick={() => nav(`/m/orders/${a.id}`)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') nav(`/m/orders/${a.id}`); }}>
      <div className="m-order-h"><span>{modeFull(a.mode)} · 50 分钟</span><b className={`m-st ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</b></div>
      <div className="m-order-b">
        <img className="avatar" src={a.counselor.avatar} alt="" width={48} height={48} />
        <div><b>{a.counselor.name}</b><small>{a.counselor.title}</small><span><Icon name="calendar" size={14} />{range(a.startAt, a.endAt)}</span></div>
      </div>
      <div className="m-order-f">
        <span>实付 <b className="num">{yuan(a.amount)}</b></span>
        <div onClick={(e) => e.stopPropagation()}>
          {a.status === 'pending_payment' && <Link className="btn btn-sm btn-pill m-btn-orange" to={`/m/checkout/${a.id}`}>去支付</Link>}
          {(a.status === 'paid' || a.status === 'in_session') && <Link className={`btn btn-sm btn-pill ${canJoin ? 'btn-blue' : 'btn-soft'}`} to={`/m/room/${a.id}`}>{canJoin ? '进入咨询室' : '咨询室'}</Link>}
          {a.status === 'completed' && !a.reviewed && <Link className="btn btn-sm btn-pill btn-soft" to={`/m/orders/${a.id}?review=1`}>去评价</Link>}
          {(a.status === 'completed' || a.status === 'cancelled' || a.status === 'refunded') && <Link className="btn btn-sm btn-pill btn-line" to={`/m/counselors/${a.counselor.id}?book=1`}>再次预约</Link>}
        </div>
      </div>
    </article>
  );
}
