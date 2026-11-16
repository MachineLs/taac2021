// /desk/room/:id — counselor-side session room (simulated A/V), with brief & notes side panel.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Appointment, ClientBrief, SessionNote } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { useToast } from '../../../components/Toast';
import { dateTime, modeLabel, range, time, when } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { clock } from '../lib';
import { Avatar, Confirm, Icon, RISK_LABEL, Spin, errMsg, useNow } from '../ui';

export default function Room() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const room = useAsync(() => api.room(id), [id]);
  const brief = useAsync(() => api.wbBrief(id), [id]);
  const now = useNow(1000);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [panel, setPanel] = useState<'brief' | 'notes' | null>('brief');
  const [confirm, setConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState<Appointment | null>(null);

  useEffect(() => { if (window.innerWidth < 900) setPanel(null); }, []);

  const appt: Appointment | null = ended ?? brief.data?.appointment ?? room.data?.appointment ?? null;
  if ((room.loading || brief.loading) && !appt) return <div className="desk-room"><Loading full label="正在进入咨询室…" /></div>;
  if (!appt) return <div className="desk-room"><div className="desk-room-err"><ErrorState error={room.error ?? brief.error} onRetry={() => { room.reload(); brief.reload(); }} /><Link className="btn btn-line" to="/desk">返回工作台</Link></div></div>;

  const start = new Date(appt.startAt).getTime();
  const end = new Date(appt.endAt).getTime();
  const started = now >= start;
  const left = end - now;
  const finished = appt.status === 'completed';
  const canEnd = appt.status === 'paid' || appt.status === 'in_session';
  const notOpen = room.data && !room.data.canJoin && now < new Date(room.data.joinOpensAt).getTime();
  const showVideo = appt.mode === 'video' || appt.mode === 'offline';

  async function complete() {
    setEnding(true);
    try {
      const a = await api.complete(id);
      setEnded(a); setConfirm(false);
      toast('咨询已结束');
    } catch (e) { toast(errMsg(e, '结束咨询失败，请稍后再试')); } finally { setEnding(false); }
  }

  return (
    <div className="desk-room">
      <header className="desk-room-top">
        <Link to={`/desk/appointments/${id}`} className="desk-room-back" aria-label="返回简报"><Icon name="chevL" size={18} /></Link>
        <div className="desk-room-title">
          <b>{appt.client.name} · {modeLabel(appt.mode)}咨询</b>
          <small className="num">{range(appt.startAt, appt.endAt)}</small>
        </div>
        <span className="desk-room-demo"><Icon name="alert" size={14} />演示环境：音视频服务待接入</span>
        <div className="desk-room-timer num" aria-live="off">
          <span className={`desk-rec${finished ? ' off' : ''}`} />
          {finished ? '已结束' : started ? clock(now - start) : <><small>距开始</small>{clock(start - now)}</>}
          {!finished && started && <small>{left > 0 ? `剩余 ${Math.ceil(left / 60000)} 分` : `已超时 ${Math.floor(-left / 60000)} 分`}</small>}
        </div>
      </header>

      {notOpen && !finished && <div className="desk-room-notice">咨询室将于 {when(room.data!.joinOpensAt)} 正式开放（开始前 10 分钟），当前为预览，来访者尚未进入。</div>}

      <div className={`desk-room-body${panel ? ' with-panel' : ''}`}>
        <div className="desk-stage">
          <div className={`desk-remote${showVideo ? ' video' : ''}`}>
            {showVideo && <img className="desk-remote-bg" src="/assets/room-light.jpg" alt="" />}
            {!finished && <div className="desk-remote-center">
              <div className="desk-remote-av talking"><Avatar src={appt.client.avatar} name={appt.client.name} size={112} /></div>
              <b>{appt.client.name}</b>
              <span>{notOpen ? '等待来访者进入…' : '已连接 · 模拟画面'}</span>
              {!showVideo && <div className="desk-wave" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}</div>}
            </div>}
            <span className="desk-remote-tag">来访者</span>
          </div>
          <div className={`desk-self${cam ? '' : ' off'}`}>
            {cam ? <Avatar src={user?.avatar} name={user?.name ?? '我'} size={56} /> : <Icon name="videoOff" size={22} />}
            <span>我{mic ? '' : ' · 已静音'}</span>
          </div>
          {finished && (
            <div className="desk-room-ended">
              <Icon name="check" size={28} />
              <b>本次咨询已结束</b>
              <span>请在 24 小时内补写咨询记录，方便下次咨询前回顾。</span>
              <div>
                <button className="btn btn-blue" type="button" onClick={() => nav(`/desk/appointments/${id}#notes`)}>写咨询记录</button>
                <Link className="btn btn-line" to="/desk">返回工作台</Link>
              </div>
            </div>
          )}
        </div>
        {panel && <SidePanel tab={panel} setTab={setPanel} brief={brief.data} briefErr={brief.error} id={id} onClose={() => setPanel(null)} toast={toast} />}
      </div>

      <footer className="desk-room-ctrl">
        <button type="button" className={`desk-ctrl${mic ? '' : ' off'}`} onClick={() => setMic(!mic)} aria-pressed={!mic}><Icon name={mic ? 'mic' : 'micOff'} size={20} /><span>{mic ? '静音' : '取消静音'}</span></button>
        <button type="button" className={`desk-ctrl${cam ? '' : ' off'}`} onClick={() => setCam(!cam)} aria-pressed={!cam}><Icon name={cam ? 'video' : 'videoOff'} size={20} /><span>{cam ? '关闭摄像头' : '开启摄像头'}</span></button>
        <button type="button" className={`desk-ctrl${panel === 'brief' ? ' on' : ''}`} onClick={() => setPanel(panel === 'brief' ? null : 'brief')} aria-pressed={panel === 'brief'}><Icon name="doc" size={20} /><span>简报</span></button>
        <button type="button" className={`desk-ctrl${panel === 'notes' ? ' on' : ''}`} onClick={() => setPanel(panel === 'notes' ? null : 'notes')} aria-pressed={panel === 'notes'}><Icon name="note" size={20} /><span>笔记</span></button>
        {canEnd && <button type="button" className="desk-ctrl end" onClick={() => setConfirm(true)}><Icon name="phone" size={20} /><span>结束咨询</span></button>}
      </footer>

      {confirm && (
        <Confirm title="结束本次咨询？" danger busy={ending} confirmText="结束咨询" onClose={() => setConfirm(false)} onConfirm={complete}
          body={<p>结束后订单将标记为「已完成」，来访者会收到评价邀请。{now < end - 5 * 60000 && <><br /><span className="desk-warn"><Icon name="alert" size={14} />距预定结束（{time(appt.endAt)}）还有 {Math.ceil((end - now) / 60000)} 分钟。</span></>}</p>} />
      )}
      {toast.node}
    </div>
  );
}

function SidePanel({ tab, setTab, brief, briefErr, id, onClose, toast }: {
  tab: 'brief' | 'notes'; setTab: (t: 'brief' | 'notes') => void; brief: ClientBrief | null; briefErr: Error | null; id: string; onClose: () => void; toast: (m: string) => void;
}) {
  const [note, setNote] = useState<SessionNote | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!brief) return;
    const n = brief.notes.find((x) => x.appointmentId === id) ?? null;
    setNote(n); setText(n?.content ?? '');
  }, [brief, id]);
  const history = (brief?.notes ?? []).filter((x) => x.appointmentId !== id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try { const n = await api.wbAddNote(id, text.trim()); setNote(n); toast('笔记已保存'); }
    catch (e) { toast(errMsg(e, '保存失败，请稍后再试')); } finally { setBusy(false); }
  }
  const s = brief?.intake;
  return (
    <aside className="desk-room-panel">
      <div className="desk-room-panel-h">
        <div className="seg">
          <button type="button" aria-selected={tab === 'brief'} onClick={() => setTab('brief')}>简报</button>
          <button type="button" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>笔记</button>
        </div>
        <button type="button" className="desk-icon-btn" aria-label="收起面板" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="desk-room-panel-b">
        {tab === 'brief' ? (
          !brief ? (briefErr ? <ErrorState error={briefErr} /> : <Loading />) : (
            <>
              <p className="desk-room-ai"><Icon name="shield" size={14} />小结由 AI 整理，仅供参考，咨询与诊断由您完成。</p>
              {!brief.appointment.shareIntake ? <p className="muted">来访者未授权同步接待小结</p> : !s ? <p className="muted">来访者未完成 AI 接待</p> : (
                <dl className="desk-dl compact">
                  <div><dt>情绪</dt><dd>{s.mood}（{s.moodScore}/100）</dd></div>
                  <div><dt>困扰</dt><dd>{s.topics.join('、')} · {s.duration}</dd></div>
                  <div><dt>风险</dt><dd><span className={`desk-risk desk-risk-${s.risk}`}>{RISK_LABEL[s.risk]}</span> {s.riskNote}</dd></div>
                  {s.scales.map((x) => <div key={x.scale}><dt>{x.scale.toUpperCase()}</dt><dd className="num">{x.score}/{x.max} · {x.level}</dd></div>)}
                  <div><dt>建议</dt><dd>{s.plan}</dd></div>
                </dl>
              )}
              {brief.assessments.length > 0 && <>
                <h4>量表结果</h4>
                <ul className="desk-room-list">{brief.assessments.map((r) => <li key={r.id}><b>{r.scale.toUpperCase()}</b><span className="num">{r.score}/{r.max} · {r.level}</span></li>)}</ul>
              </>}
              {brief.source && <p className="muted desk-small">来源：{brief.source.creatorName}</p>}
              <Link className="btn btn-line btn-sm btn-block" to={`/desk/appointments/${id}`} target="_blank">在新窗口打开完整简报</Link>
            </>
          )
        ) : (
          <>
            <textarea className="textarea" placeholder="边听边记，本次咨询只保留一份记录，可随时更新…" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }} />
            <button className="btn btn-blue btn-sm btn-block" type="button" onClick={save} disabled={busy || !text.trim() || text.trim() === note?.content}>{busy && <Spin />}{note ? '更新笔记' : '保存笔记'}</button>
            {note && <small className="muted num">已保存 · {dateTime(note.updatedAt)}</small>}
            <h4>往次记录</h4>
            <ul className="desk-room-notes">
              {history.map((n) => <li key={n.id}><small className="num">{dateTime(n.createdAt)}</small><p>{n.content}</p></li>)}
              {history.length === 0 && <li className="muted">暂无往次记录</li>}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
