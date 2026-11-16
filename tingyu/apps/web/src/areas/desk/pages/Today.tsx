// /desk — today's overview: next client, timeline, weekly numbers, to-dos.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Appointment, ClientBrief } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dayKey, monthDay, time, when, weekday, yuan, ago } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { addDays, cnIso, countdown, greeting, isActive, isUpcoming, thisMonth, todayKey, weekStart } from '../lib';
import { Avatar, Icon, ModeTag, RISK_LABEL, StatusBadge, useNow } from '../ui';

/** Number of earlier completed sessions with the same client. */
function visitIndex(all: Appointment[], a: Appointment) {
  return all.filter((x) => x.client.id === a.client.id && x.id !== a.id && x.status === 'completed' && x.startAt < a.startAt).length;
}

export default function Today() {
  const { user } = useAuth();
  const today = todayKey();
  const appts = useAsync(() => api.wbAppointments({ from: cnIso(addDays(today, -60)), to: cnIso(addDays(today, 8)) }), [today]);
  const earnings = useAsync(() => api.wbEarnings(thisMonth()), []);
  const convs = useAsync(() => api.conversations(), []);

  const all = useMemo(() => [...(appts.data ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt)), [appts.data]);
  const todays = all.filter((a) => dayKey(a.startAt) === today && isActive(a.status));
  const next = all.find(isUpcoming) ?? null;
  const ws = weekStart(today);
  const weekAppts = all.filter((a) => isActive(a.status) && dayKey(a.startAt) >= ws && dayKey(a.startAt) < addDays(ws, 7));
  const recentDone = all.filter((a) => a.status === 'completed' && dayKey(a.startAt) >= addDays(today, -14)).reverse().slice(0, 5);
  const recentKey = recentDone.map((a) => a.id).join(',');

  const brief = useAsync(() => (next ? api.wbBrief(next.id) : Promise.resolve(null)), [next?.id]);
  const todo = useAsync(async () => {
    const briefs = await Promise.all(recentDone.map((a) => api.wbBrief(a.id).catch(() => null)));
    return briefs.filter((b): b is ClientBrief => !!b && !b.notes.some((n) => n.appointmentId === b.appointment.id)).map((b) => b.appointment);
  }, [recentKey]);

  const unreadConvs = (convs.data ?? []).filter((c) => c.unread > 0);
  const unread = unreadConvs.reduce((s, c) => s + c.unread, 0);
  const name = user?.name ?? '';

  return (
    <div className="desk-today">
      <div className="desk-hello">
        <div>
          <h1>{greeting()}，{name ? `${name.slice(0, 1)}老师` : '老师'}</h1>
          <p>
            {appts.loading ? '正在加载今日安排…' : todays.length
              ? <>今天共有 <b className="num">{todays.length}</b> 位来访{next && dayKey(next.startAt) === today ? <>，下一位在 <b className="num">{time(next.startAt)}</b></> : '，都已结束'}。</>
              : '今天没有来访安排，可以去排班页发布更多可约时段。'}
          </p>
        </div>
        <div className="desk-hello-actions">
          <Link className="btn btn-line" to="/desk/schedule"><Icon name="grid" size={16} />管理排班</Link>
          <Link className="btn btn-blue" to="/desk/appointments"><Icon name="list" size={16} />全部来访</Link>
        </div>
      </div>

      <div className="desk-today-grid">
        <div className="desk-today-main">
          {appts.loading ? <div className="card"><Loading /></div>
            : appts.error ? <div className="card"><ErrorState error={appts.error} onRetry={appts.reload} /></div>
            : next ? <NextCard a={next} index={visitIndex(all, next)} brief={brief.data} briefLoading={brief.loading} />
            : <div className="card desk-next-empty"><Empty title="暂无待开始的来访" hint="来访者预约并支付后，会出现在这里。" action={<Link className="btn btn-soft btn-sm" to="/desk/schedule">发布可约时段</Link>} /></div>}

          <section className="card desk-panel">
            <div className="desk-panel-head">
              <h2>今日来访 <span className="muted num">{monthDay(new Date().toISOString())} {weekday(new Date().toISOString())}</span></h2>
              <Link className="desk-more" to="/desk/appointments">来访列表<Icon name="chevR" size={14} /></Link>
            </div>
            {appts.loading ? <Loading /> : appts.error ? <ErrorState error={appts.error} onRetry={appts.reload} />
              : todays.length === 0 ? <Empty title="今天没有来访" hint={next ? `下一位来访：${when(next.startAt)} · ${next.client.name}` : '发布可约时段后，来访者就可以预约了。'} />
              : <Timeline items={todays} all={all} />}
          </section>
        </div>

        <aside className="desk-today-side">
          <section className="card desk-panel">
            <div className="desk-panel-head"><h2>本周数据</h2><span className="muted">{monthDay(cnIso(ws))} – {monthDay(cnIso(addDays(ws, 6)))}</span></div>
            <div className="desk-kpis">
              <div className="desk-kpi"><span>本周来访</span><b className="num">{appts.loading ? '–' : weekAppts.length}</b><small>已完成 {weekAppts.filter((a) => a.status === 'completed').length} · 待咨询 {weekAppts.filter((a) => a.status === 'paid').length}</small></div>
              <div className="desk-kpi"><span>今日来访</span><b className="num">{appts.loading ? '–' : todays.length}</b><small>{todays.filter((a) => a.status === 'completed').length} 位已完成</small></div>
            </div>
            <Link to="/desk/earnings" className="desk-income">
              <div>
                <span>本月净收入</span>
                {earnings.loading ? <b className="num">–</b> : earnings.error ? <b className="desk-income-err">暂无法获取</b> : <b className="num">{yuan(earnings.data!.net)}</b>}
              </div>
              {earnings.data && (
                <dl>
                  <div><dt>完成咨询</dt><dd className="num">{earnings.data.sessions} 次</dd></div>
                  <div><dt>待结算</dt><dd className="num">{yuan(earnings.data.pendingSettlement)}</dd></div>
                </dl>
              )}
              <Icon name="chevR" size={16} className="desk-income-go" />
            </Link>
          </section>

          <section className="card desk-panel">
            <div className="desk-panel-head"><h2>待办</h2>{!todo.loading && !convs.loading && <span className="desk-count num">{(todo.data?.length ?? 0) + unreadConvs.length}</span>}</div>
            <ul className="desk-todos">
              {todo.loading ? <li><Loading label="检查咨询记录…" /></li> : (todo.data ?? []).map((a) => (
                <li key={a.id}>
                  <Link to={`/desk/appointments/${a.id}#notes`} className="desk-todo">
                    <span className="desk-todo-ic desk-todo-note"><Icon name="note" size={16} /></span>
                    <div><b>补写咨询记录 · {a.client.name}</b><small>{when(a.startAt)} 已完成</small></div>
                    <Icon name="chevR" size={14} />
                  </Link>
                </li>
              ))}
              {unreadConvs.map((c) => (
                <li key={c.id}>
                  <Link to={`/desk/messages?c=${c.id}`} className="desk-todo">
                    <span className="desk-todo-ic desk-todo-msg"><Icon name="chat" size={16} /></span>
                    <div><b>{c.client.name} 的 {c.unread} 条未读消息</b><small>{c.lastMessage ? `${ago(c.lastMessage.createdAt)} · ${c.lastMessage.content}` : ''}</small></div>
                    <Icon name="chevR" size={14} />
                  </Link>
                </li>
              ))}
              {!todo.loading && !convs.loading && (todo.data?.length ?? 0) === 0 && unread === 0 && (
                <li className="desk-todo-done"><Icon name="check" size={16} />都处理完了，喝杯茶吧</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NextCard({ a, index, brief, briefLoading }: { a: Appointment; index: number; brief: ClientBrief | null; briefLoading: boolean }) {
  const now = useNow(1000);
  const ms = new Date(a.startAt).getTime() - now;
  const live = ms <= 0;
  const soon = ms > 0 && ms <= 10 * 60000;
  const intake = brief?.intake ?? null;
  return (
    <section className={`card desk-next${live ? ' live' : ''}`}>
      <div className="desk-next-label"><span className="desk-dot" />{live ? '正在进行' : '下一位来访'}</div>
      <div className="desk-next-body">
        <div className="desk-next-who">
          <Avatar src={a.client.avatar} name={a.client.name} size={64} />
          <div>
            <h2>{a.client.name}</h2>
            <div className="desk-next-meta">
              <span className={`desk-visit ${index ? 'repeat' : 'first'}`}>{index ? `复诊 · 第 ${index + 1} 次` : '首次来访'}</span>
              <ModeTag mode={a.mode} />
              <StatusBadge status={a.status} />
            </div>
            <p className="desk-next-time num">{when(a.startAt)}–{time(a.endAt)}</p>
          </div>
        </div>
        <div className={`desk-countdown${soon ? ' soon' : ''}${live ? ' live' : ''}`}>
          <span>{live ? '已开始' : '距开始'}</span>
          <b className="num">{live ? countdown(new Date(a.endAt).getTime() - now).replace('已开始', '即将结束') : countdown(ms)}</b>
          {live && <small>距结束</small>}
        </div>
      </div>

      <div className="desk-next-intake">
        <div className="desk-next-intake-h"><Icon name="spark" size={15} />AI 接待小结摘要<em>仅供参考</em></div>
        {briefLoading ? <span className="muted">加载中…</span>
          : !a.shareIntake ? <span className="muted">来访者未授权同步接待小结</span>
          : !intake ? <span className="muted">来访者未完成 AI 接待</span>
          : (
            <div className="desk-next-intake-b">
              <div className="desk-next-tags">
                <span className="desk-mood">{intake.mood}</span>
                {intake.topics.map((t) => <span key={t} className="tag">{t}</span>)}
                <span className={`desk-risk desk-risk-${intake.risk}`}>{RISK_LABEL[intake.risk]}</span>
              </div>
              <p>持续 {intake.duration} · 建议：{intake.plan}</p>
            </div>
          )}
      </div>

      <div className="desk-next-actions">
        <Link className={`btn ${live || soon ? 'btn-blue' : 'btn-soft'}`} to={`/desk/room/${a.id}`}><Icon name="video" size={16} />进入咨询室</Link>
        <Link className="btn btn-line" to={`/desk/appointments/${a.id}`}><Icon name="doc" size={16} />查看简报</Link>
      </div>
    </section>
  );
}

function Timeline({ items, all }: { items: Appointment[]; all: Appointment[] }) {
  const now = useNow(30000);
  const nowIdx = items.findIndex((a) => new Date(a.endAt).getTime() > now);
  return (
    <ol className="desk-tl">
      {items.map((a, i) => {
        const past = new Date(a.endAt).getTime() <= now;
        const live = !past && new Date(a.startAt).getTime() <= now;
        const idx = visitIndex(all, a);
        return (
          <li key={a.id} className={`${past ? 'past' : ''}${live ? ' live' : ''}`}>
            {i === nowIdx && !live && <div className="desk-tl-now"><span className="num">现在 {time(new Date(now).toISOString())}</span></div>}
            <div className="desk-tl-row">
              <div className="desk-tl-time num"><b>{time(a.startAt)}</b><small>{time(a.endAt)}</small></div>
              <div className="desk-tl-rail"><i /></div>
              <Link to={`/desk/appointments/${a.id}`} className="desk-tl-card">
                <Avatar src={a.client.avatar} name={a.client.name} size={38} />
                <div className="desk-tl-info">
                  <b>{a.client.name}</b>
                  <span>{idx ? `复诊 · 第 ${idx + 1} 次` : '首次来访'}{a.creatorId ? ' · 达人推荐' : ''}</span>
                </div>
                <ModeTag mode={a.mode} />
                <StatusBadge status={a.status} />
                <Icon name="chevR" size={16} className="desk-tl-go" />
              </Link>
            </div>
          </li>
        );
      })}
      {nowIdx === -1 && <li><div className="desk-tl-now"><span>今日来访已全部结束</span></div></li>}
    </ol>
  );
}
