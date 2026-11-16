import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../api/client';
import { useAsync } from '../../../../lib/useAsync';
import { ago } from '../../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../../components/states';
import { useToast } from '../../../../components/Toast';
import { Icon } from '../../components/Icon';
import { errMsg, siteLink } from '../../util';

const TYPE_ICON: Record<string, string> = { appointment: 'calendar', message: 'chat', coupon: 'gift', intake: 'mic', review: 'star', system: 'bell' };

export default function Notifications() {
  const list = useAsync(() => api.notifications(), []);
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = '通知 · 听屿心理'; }, []);
  const unread = (list.data ?? []).filter((n) => !n.readAt).length;
  const readAll = async () => {
    setBusy(true);
    try { await api.readAllNotifications(); list.setData((list.data ?? []).map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))); }
    catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="site-acc-page">
      <div className="site-acc-h"><div><h1>通知</h1>{unread > 0 && <p className="muted">{unread} 条未读</p>}</div><button type="button" className="btn btn-line btn-sm" disabled={!unread || busy} onClick={readAll}>全部已读</button></div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading />
        : list.data.length === 0 ? <div className="card"><Empty title="暂无通知" hint="预约、消息和系统提醒会显示在这里" /></div>
        : (
          <ul className="card site-notis">
            {list.data.map((n) => {
              const to = siteLink(n.link);
              return (
                <li key={n.id} className={n.readAt ? '' : 'unread'}>
                  <button type="button" disabled={!to} onClick={() => to && nav(to)}>
                    <span className="site-noti-ic"><Icon name={TYPE_ICON[n.type] ?? 'bell'} size={18} /></span>
                    <span className="site-noti-txt"><b>{n.title}</b><span>{n.body}</span></span>
                    <span className="muted site-small">{ago(n.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      {toast.node}
    </div>
  );
}
