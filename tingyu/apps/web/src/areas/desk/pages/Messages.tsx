// /desk/messages — conversations with clients (counselor view), polling refresh.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ChatMessage, Conversation } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { ago, dateTime, dayKey, relDay, time } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Avatar, Icon, Spin, errMsg } from '../ui';

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const cid = params.get('c');
  const convs = useAsync(() => api.conversations(), []);
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => { api.conversations().then(convs.setData).catch(() => {}); }, 10000);
    return () => window.clearInterval(t);
  }, [convs.setData]);

  const list = [...(convs.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shown = list.filter((c) => !q.trim() || c.client.name.includes(q.trim()));
  const active = list.find((c) => c.id === cid) ?? null;

  return (
    <div className="desk-page desk-msg-page">
      <div className="desk-msg-tip" role="note"><Icon name="shield" size={16} />咨询外留言仅用于预约、改约等事务沟通，不在留言中进行咨询；遇到来访者危机信号请立即引导拨打 <b className="num">12356</b>。</div>
      <div className={`card desk-msg${active ? ' has-active' : ''}`}>
        <aside className="desk-msg-list">
          <div className="desk-msg-list-h">
            <h2>会话</h2>
            <input className="input" placeholder="搜索来访者" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索来访者" />
          </div>
          {convs.loading && !convs.data ? <Loading /> : convs.error && !convs.data ? <ErrorState error={convs.error} onRetry={convs.reload} />
            : shown.length === 0 ? <Empty title={q ? '没有匹配的会话' : '暂无会话'} hint={q ? undefined : '来访者给您留言后会显示在这里'} />
            : (
              <ul>
                {shown.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`desk-conv${c.id === cid ? ' on' : ''}`} onClick={() => setParams({ c: c.id })}>
                      <Avatar src={c.client.avatar} name={c.client.name} size={40} />
                      <div className="desk-conv-b">
                        <div className="desk-conv-t"><b>{c.client.name}</b><span className="num">{c.lastMessage ? ago(c.lastMessage.createdAt) : ago(c.updatedAt)}</span></div>
                        <div className="desk-conv-p"><span>{c.lastMessage?.content ?? '暂无消息'}</span>{c.unread > 0 && <em className="num">{c.unread}</em>}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </aside>
        <section className="desk-chat">
          {active ? <Chat key={active.id} conv={active} onBack={() => setParams({})} onSeen={() => convs.setData((convs.data ?? []).map((c) => (c.id === active.id ? { ...c, unread: 0 } : c)))} />
            : <div className="desk-chat-empty"><Icon name="chat" size={36} /><b>选择一个会话</b><span>在左侧选择来访者查看留言</span></div>}
        </section>
      </div>
    </div>
  );
}

function Chat({ conv, onBack, onSeen }: { conv: Conversation; onBack: () => void; onSeen: () => void }) {
  const { user } = useAuth();
  const msgs = useAsync(() => api.messages(conv.id), [conv.id]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = msgs.data?.[msgs.data.length - 1]?.id;

  useEffect(() => { if (msgs.data) onSeen(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [msgs.data?.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lastId]);
  useEffect(() => {
    const t = window.setInterval(() => { api.messages(conv.id).then((m) => msgs.setData(m)).catch(() => {}); }, 4000);
    return () => window.clearInterval(t);
  }, [conv.id, msgs.setData]);

  async function send() {
    const c = text.trim();
    if (!c || sending) return;
    setSending(true); setErr('');
    try {
      const m = await api.sendMessage(conv.id, c);
      msgs.setData((msgs.data ?? []).concat(m));
      setText('');
    } catch (e) { setErr(errMsg(e, '发送失败，请稍后重试')); } finally { setSending(false); }
  }

  const items: (ChatMessage | string)[] = [];
  let lastDay = '';
  for (const m of msgs.data ?? []) {
    const d = dayKey(m.createdAt);
    if (d !== lastDay) { items.push(d); lastDay = d; }
    items.push(m);
  }

  return (
    <>
      <header className="desk-chat-h">
        <button className="desk-icon-btn desk-chat-back" type="button" aria-label="返回会话列表" onClick={onBack}><Icon name="chevL" size={18} /></button>
        <Avatar src={conv.client.avatar} name={conv.client.name} size={36} />
        <div><b>{conv.client.name}</b><small>来访者</small></div>
        <Link className="btn btn-line btn-sm" to={`/desk/appointments?client=${conv.client.id}`}>查看来访记录</Link>
      </header>
      <div className="desk-chat-body">
        {msgs.loading && !msgs.data ? <Loading /> : msgs.error && !msgs.data ? <ErrorState error={msgs.error} onRetry={msgs.reload} />
          : items.length === 0 ? <Empty title="还没有消息" hint="可以先打个招呼，说明预约事项" />
          : items.map((it) => typeof it === 'string'
            ? <div key={it} className="desk-chat-day"><span>{relDay(`${it}T04:00:00.000Z`)}</span></div>
            : (
              <div key={it.id} className={`desk-bubble-row${it.senderId === user?.id ? ' me' : ''}`}>
                {it.senderId !== user?.id && <Avatar src={conv.client.avatar} name={conv.client.name} size={30} />}
                <div className="desk-bubble" title={dateTime(it.createdAt)}>
                  <p>{it.content}</p>
                  <small className="num">{time(it.createdAt)}{it.senderId === user?.id && (it.readAt ? ' · 已读' : ' · 未读')}</small>
                </div>
              </div>
            ))}
        <div ref={endRef} />
      </div>
      <footer className="desk-chat-f">
        {err && <div className="form-error">{err}</div>}
        <div className="desk-chat-input">
          <textarea className="textarea" rows={2} placeholder="输入消息，Enter 发送，Shift + Enter 换行" value={text} maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button className="btn btn-blue" type="button" onClick={send} disabled={!text.trim() || sending}>{sending ? <Spin /> : <Icon name="send" size={16} />}发送</button>
        </div>
      </footer>
    </>
  );
}
