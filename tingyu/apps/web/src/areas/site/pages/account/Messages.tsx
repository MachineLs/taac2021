import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ChatMessage, Conversation } from '@tingyu/shared';
import { api } from '../../../../api/client';
import { useAuth } from '../../../../auth/AuthContext';
import { useAsync } from '../../../../lib/useAsync';
import { ago, dayKey, monthDay, time } from '../../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../../components/states';
import { useToast } from '../../../../components/Toast';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/Layout';
import { errMsg } from '../../util';

function ChatWindow({ conv, onSent }: { conv: Conversation; onSent: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const msgs = useAsync(() => api.messages(conv.id), [conv.id]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const isCounselorView = user?.id !== conv.client.id;
  const peer = isCounselorView ? { name: conv.client.name, avatar: conv.client.avatar, sub: '来访者' } : { name: conv.counselor.name, avatar: conv.counselor.avatar, sub: conv.counselor.title };

  // light polling for new replies
  useEffect(() => {
    const t = window.setInterval(() => { api.messages(conv.id).then((d) => msgs.setData(d)).catch(() => {}); }, 8000);
    return () => window.clearInterval(t);
  }, [conv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.data?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setSending(true);
    try { const m = await api.sendMessage(conv.id, t); msgs.setData([...(msgs.data ?? []), m]); setText(''); onSent(); }
    catch (er) { toast(errMsg(er, '发送失败')); } finally { setSending(false); }
  };

  let lastDay = '';
  return (
    <div className="site-chatwin">
      <div className="site-chatwin-h">
        <UserAvatar src={peer.avatar} name={peer.name} size={40} />
        <div><b>{peer.name}</b><span className="muted site-small">{peer.sub}</span></div>
        {!isCounselorView && <Link className="btn btn-soft btn-sm" to={`/counselors/${conv.counselor.id}`}>预约咨询</Link>}
      </div>
      <div className="site-chatwin-body" ref={boxRef}>
        <p className="site-chat-tip"><Icon name="lock" size={13} />消息仅你和咨询师可见。咨询前的沟通用于了解是否合适，正式咨询请预约。</p>
        {msgs.error ? <ErrorState error={msgs.error} onRetry={msgs.reload} /> : !msgs.data ? <Loading /> : msgs.data.length === 0 ? <p className="muted site-center site-small">还没有消息，打个招呼吧：简单说说你想咨询的问题。</p>
          : msgs.data.map((m: ChatMessage) => {
            const d = dayKey(m.createdAt); const showDay = d !== lastDay; lastDay = d;
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id}>
                {showDay && <div className="site-chat-day">{monthDay(m.createdAt)}</div>}
                <div className={`site-msg ${mine ? 'me' : ''}`}>
                  {!mine && <UserAvatar src={peer.avatar} name={peer.name} size={30} />}
                  <div className="site-bubble">{m.content}<time className="num">{time(m.createdAt)}{mine && (m.readAt ? ' · 已读' : ' · 未读')}</time></div>
                </div>
              </div>
            );
          })}
      </div>
      <form className="site-composer" onSubmit={send}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="输入消息…" maxLength={1000} aria-label="输入消息" />
        <button className="btn btn-blue" type="submit" disabled={!text.trim() || sending}><Icon name="send" size={16} />{sending ? '发送中' : '发送'}</button>
      </form>
      {toast.node}
    </div>
  );
}

export default function Messages() {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const convs = useAsync(() => api.conversations(), []);
  const sel = sp.get('c');
  useEffect(() => { document.title = '消息 · 听屿心理'; }, []);
  useEffect(() => { if (!sel && convs.data && convs.data.length > 0) setSp({ c: convs.data[0].id }, { replace: true }); }, [convs.data, sel, setSp]);
  const current = convs.data?.find((c) => c.id === sel) ?? null;

  return (
    <div className="site-acc-page">
      <div className="site-acc-h"><h1>消息</h1></div>
      {convs.error ? <ErrorState error={convs.error} onRetry={convs.reload} /> : !convs.data ? <Loading />
        : convs.data.length === 0 ? <div className="card"><Empty title="还没有消息" hint="在咨询师主页点击「先咨询一下」，可以在预约前和咨询师简单沟通" action={<Link className="btn btn-blue" to="/counselors">去找咨询师</Link>} /></div>
        : (
          <div className="card site-msgs">
            <ul className="site-convs">
              {convs.data.map((c) => {
                const peer = user?.id !== c.client.id ? { name: c.client.name, avatar: c.client.avatar } : { name: c.counselor.name, avatar: c.counselor.avatar };
                return (
                  <li key={c.id}>
                    <button type="button" className={sel === c.id ? 'on' : ''} onClick={() => { setSp({ c: c.id }); if (c.unread) convs.setData(convs.data!.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))); }}>
                      <UserAvatar src={peer.avatar} name={peer.name} size={42} />
                      <span className="site-conv-txt"><b>{peer.name}</b><span>{c.lastMessage?.content ?? '暂无消息'}</span></span>
                      <span className="site-conv-meta"><small>{ago(c.updatedAt)}</small>{c.unread > 0 && <em className="num">{c.unread}</em>}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {current ? <ChatWindow key={current.id} conv={current} onSent={() => api.conversations().then((d) => convs.setData(d)).catch(() => {})} /> : <div className="site-chatwin"><Empty title="选择一个会话" /></div>}
          </div>
        )}
    </div>
  );
}
