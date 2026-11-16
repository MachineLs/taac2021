// /m/messages — conversations + system notifications entry.
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { ago } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { errMsg, LoginPrompt, TabPage, usePoll } from '../ui';

export default function Messages() {
  const { user } = useAuth();
  const convs = useAsync(async () => (user ? api.conversations() : []), [user?.id]);
  const notes = useAsync(async () => (user ? api.notifications() : []), [user?.id]);
  usePoll(() => { convs.reload(); }, 15000, !!user);
  const unreadN = notes.data?.filter((n) => !n.readAt).length ?? 0;
  const latest = notes.data?.[0];

  return (
    <TabPage>
      <header className="m-tab-head"><h1>消息</h1></header>
      {!user ? <LoginPrompt title="登录后查看消息" hint="和咨询师的对话、预约提醒都在这里" /> : (
        <>
          <div className="m-list">
            <Link to="/m/notifications" className="m-conv">
              <span className="m-conv-ic c6"><Icon name="bell" size={22} /></span>
              <div className="m-conv-m"><div><b>系统通知</b>{latest && <small>{ago(latest.createdAt)}</small>}</div><p>{latest ? latest.title : '预约、支付和咨询提醒'}</p></div>
              {unreadN > 0 && <span className="m-unread num">{unreadN}</span>}
            </Link>
            <Link to="/m/voice" className="m-conv">
              <span className="m-conv-ic c1"><Icon name="sparkle" size={22} /></span>
              <div className="m-conv-m"><div><b>小屿 · AI 助理</b><span className="badge">AI</span></div><p>心里有事？随时和我聊聊，帮你找到合适的咨询师</p></div>
            </Link>
          </div>
          <h2 className="m-section-t">咨询师</h2>
          {convs.loading && !convs.data ? <Loading />
            : convs.error ? <ErrorState error={new Error(errMsg(convs.error, '消息加载失败'))} onRetry={convs.reload} />
            : !convs.data?.length ? <Empty title="还没有和咨询师的对话" hint="在咨询师主页点「发消息」，可以先简单沟通" action={<Link className="btn btn-soft btn-pill" to="/m/counselors">去找咨询师</Link>} />
            : (
              <div className="m-list">
                {[...convs.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => (
                  <Link key={c.id} to={`/m/messages/${c.id}`} className="m-conv">
                    <img className="avatar" src={c.counselor.avatar} alt="" width={48} height={48} />
                    <div className="m-conv-m">
                      <div><b>{c.counselor.name}</b><span className="m-conv-t">{c.counselor.title}</span><small>{ago(c.lastMessage?.createdAt ?? c.updatedAt)}</small></div>
                      <p>{c.lastMessage ? `${c.lastMessage.senderId === user.id ? '我：' : ''}${c.lastMessage.content}` : '开始对话吧'}</p>
                    </div>
                    {c.unread > 0 && <span className="m-unread num">{c.unread}</span>}
                  </Link>
                ))}
              </div>
            )}
        </>
      )}
    </TabPage>
  );
}
