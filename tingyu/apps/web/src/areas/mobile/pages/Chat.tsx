// /m/messages/:id — chat with a counselor (bubbles, send, auto-scroll, 5 s polling).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ChatMessage } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dayKey, relDay, time } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../icons';
import { errMsg, invalidateUnread, NavBar, Spin, usePoll } from '../ui';

export default function Chat() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const conv = useAsync(async () => (await api.conversations()).find((c) => c.id === id) ?? null, [id]);
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const load = async () => {
    try { const m = await api.messages(id); setMsgs((prev) => (prev && prev.length === m.length && prev[prev.length - 1]?.id === m[m.length - 1]?.id ? prev : m)); setErr(null); invalidateUnread(); }
    catch (e) { setErr(e as Error); }
  };
  useEffect(() => { setMsgs(null); first.current = true; load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  usePoll(load, 5000);
  useLayoutEffect(() => {
    if (!msgs) return;
    endRef.current?.scrollIntoView({ behavior: first.current ? 'auto' : 'smooth', block: 'end' });
    first.current = false;
  }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try { const m = await api.sendMessage(id, content); setMsgs((x) => [...(x ?? []), m]); setText(''); }
    catch (e2) { toast(errMsg(e2, '发送失败，请重试')); }
    finally { setSending(false); }
  };

  const c = conv.data;
  return (
    <div className="m-chat">
      <NavBar title={c ? <span className="m-chat-t"><b>{c.counselor.name}</b><small>{c.counselor.title}</small></span> : '消息'}
        right={c && <Link className="m-nav-link" to={`/m/counselors/${c.counselor.id}?book=1`}>预约</Link>} />
      <div className="m-chat-tip"><Icon name="info" size={14} />咨询师通常在 24 小时内回复。消息不是正式咨询；如遇紧急情况请拨打 12356。</div>
      <div className="m-chat-list">
        {msgs === null ? (err ? <ErrorState error={new Error(errMsg(err, '消息加载失败'))} onRetry={load} /> : <Loading />)
          : msgs.length === 0 ? <p className="m-chat-empty">向 {c?.counselor.name ?? '咨询师'} 打个招呼吧，可以简单介绍你的困扰和期望的咨询时间</p>
          : msgs.map((m, i) => {
            const mine = m.senderId === user?.id;
            const showDay = i === 0 || dayKey(msgs[i - 1].createdAt) !== dayKey(m.createdAt);
            const showTime = showDay || new Date(m.createdAt).getTime() - new Date(msgs[i - 1].createdAt).getTime() > 10 * 60000;
            return (
              <div key={m.id}>
                {showTime && <div className="m-chat-time">{relDay(m.createdAt)} {time(m.createdAt)}</div>}
                <div className={`m-msg${mine ? ' me' : ''}`}>
                  {!mine && c && <img className="avatar" src={c.counselor.avatar} alt="" width={36} height={36} />}
                  <p>{m.content}</p>
                  {mine && (user?.avatar ? <img className="avatar" src={user.avatar} alt="" width={36} height={36} /> : <span className="m-msg-me">{(user?.name ?? '我').slice(0, 1)}</span>)}
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <form className="m-chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="输入消息…" aria-label="输入消息" enterKeyHint="send" maxLength={1000} />
        <button type="submit" className="btn btn-blue btn-pill" disabled={!text.trim() || sending}>{sending ? <Spin /> : '发送'}</button>
      </form>
      {toast.node}
    </div>
  );
}
