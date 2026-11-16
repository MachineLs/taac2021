// /m/notifications — system notifications; opening the page marks them as read.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { ago } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon, type IconName } from '../icons';
import { errMsg, invalidateUnread, NavBar } from '../ui';

const TYPE_IC: Record<string, [IconName, string]> = { appointment: ['calendar', 'c1'], message: ['bubble', 'c3'], payment: ['wallet', 'c6'], coupon: ['ticket', 'c2'], review: ['star', 'c6'], intake: ['sparkle', 'c5'], system: ['bell', 'c8'] };

/** Map a notification link to a mobile route (backend may store site paths). */
function toMobile(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith('/m/') || link === '/m') return link;
  const m = link.match(/(?:appointments|orders)\/([^/?#]+)/); if (m) return `/m/orders/${m[1]}`;
  const c = link.match(/(?:messages|conversations)\/([^/?#]+)/); if (c) return `/m/messages/${c[1]}`;
  const i = link.match(/intake\/([^/?#]+)/); if (i) return `/m/intake/${i[1]}`;
  const k = link.match(/counselors\/([^/?#]+)/); if (k) return `/m/counselors/${k[1]}`;
  return null;
}

export default function Notifications() {
  const nav = useNavigate();
  const list = useAsync(() => api.notifications(), []);
  useEffect(() => {
    if (list.data?.some((n) => !n.readAt)) api.readAllNotifications().then(invalidateUnread).catch(() => { /* ignore */ });
  }, [list.data]);
  return (
    <>
      <NavBar title="系统通知" />
      {list.loading && !list.data ? <Loading full />
        : list.error ? <ErrorState error={new Error(errMsg(list.error, '通知加载失败'))} onRetry={list.reload} />
        : !list.data?.length ? <Empty title="暂无通知" hint="预约、支付和咨询提醒会出现在这里" />
        : <div className="m-stack">{list.data.map((n) => <Item key={n.id} n={n} onOpen={(to) => nav(to)} />)}</div>}
    </>
  );
}

function Item({ n, onOpen }: { n: Notification; onOpen: (to: string) => void }) {
  const to = toMobile(n.link);
  const [ic, cls] = TYPE_IC[n.type] ?? TYPE_IC.system;
  const body = (
    <>
      <span className={`m-conv-ic ${cls}`}><Icon name={ic} size={20} /></span>
      <div className="m-note-m"><div><b>{n.title}</b>{!n.readAt && <i className="m-new-dot" aria-label="未读" />}<small>{ago(n.createdAt)}</small></div><p>{n.body}</p>{to && <span className="m-note-go">查看详情 ›</span>}</div>
    </>
  );
  return to ? <button type="button" className="m-note-card" onClick={() => onOpen(to)}>{body}</button> : <div className="m-note-card">{body}</div>;
}
