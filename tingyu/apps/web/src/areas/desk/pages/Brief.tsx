// /desk/appointments/:id — client brief before/after a session.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { AssessmentResult, ClientBrief, IntakeSummary, ScaleId, SessionNote } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { useToast } from '../../../components/Toast';
import { dateTime, modeLabel, monthDay, range, when, yuan } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { Avatar, Confirm, Icon, ModeTag, RISK_LABEL, Spin, StatusBadge, errMsg } from '../ui';

export const SCALE_NAME: Record<ScaleId, string> = { phq9: 'PHQ-9 抑郁筛查', gad7: 'GAD-7 焦虑筛查', isi: 'ISI 失眠严重度' };

export default function Brief() {
  const { id = '' } = useParams();
  const brief = useAsync(() => api.wbBrief(id), [id]);
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [confirm, setConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  useEffect(() => {
    if (brief.data && loc.hash === '#notes') document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [brief.data, loc.hash]);

  if (brief.loading && !brief.data) return <Loading full />;
  if (brief.error || !brief.data) {
    const nf = (brief.error as { status?: number } | null)?.status === 404;
    return <div className="desk-page"><BackLink /><div className="card"><ErrorState error={nf ? new Error('没有找到这条来访记录') : brief.error} onRetry={nf ? undefined : brief.reload} /></div></div>;
  }
  const b = brief.data;
  const a = b.appointment;
  const canComplete = a.status === 'paid' || a.status === 'in_session';
  const early = new Date(a.startAt).getTime() > Date.now();

  async function complete() {
    setCompleting(true);
    try {
      const updated = await api.complete(a.id);
      brief.setData({ ...b, appointment: updated });
      setConfirm(false);
      toast('咨询已结束，记得补写咨询记录');
    } catch (e) {
      toast(errMsg(e, '结束咨询失败，请稍后再试'));
    } finally { setCompleting(false); }
  }

  async function message() {
    setMsgBusy(true);
    try {
      const cs = await api.conversations();
      const c = cs.find((x) => x.client.id === a.client.id);
      if (c) nav(`/desk/messages?c=${c.id}`);
      else toast('该来访者还没有发起过留言，暂时无法主动发消息');
    } catch (e) {
      toast(errMsg(e, '打开会话失败，请稍后再试'));
    } finally { setMsgBusy(false); }
  }

  return (
    <div className="desk-page desk-brief">
      <BackLink />
      <section className="card desk-brief-head">
        <div className="desk-brief-who">
          <Avatar src={a.client.avatar} name={a.client.name} size={60} />
          <div>
            <h1>{a.client.name}</h1>
            <div className="desk-brief-meta">
              <StatusBadge status={a.status} />
              <ModeTag mode={a.mode} />
              <span className="num"><Icon name="clock" size={14} />{range(a.startAt, a.endAt)}</span>
            </div>
          </div>
        </div>
        <div className="desk-brief-actions">
          <button className="btn btn-line" type="button" onClick={message} disabled={msgBusy}>{msgBusy ? <Spin /> : <Icon name="chat" size={16} />}发消息</button>
          {canComplete && <button className="btn desk-btn-red-line" type="button" onClick={() => setConfirm(true)}>结束咨询</button>}
          {canComplete && <Link className="btn btn-blue" to={`/desk/room/${a.id}`}><Icon name="video" size={16} />进入咨询室</Link>}
        </div>
      </section>

      <div className="desk-ai-notice" role="note">
        <Icon name="shield" size={18} />
        <div><b>小结由 AI 整理，仅供参考，咨询与诊断由您完成。</b><span>以下内容来自来访者与 AI 助理「小屿」的接待对话及自评量表，可能不完整或有偏差，请以您的专业判断为准。</span></div>
      </div>

      <div className="desk-brief-grid">
        <div className="desk-brief-main">
          <IntakeCard brief={b} />
          <AssessCard list={b.assessments} shared={a.shareIntake} />
          <NotesCard key={a.id} brief={b} onSaved={(n) => brief.setData({ ...b, notes: [n, ...b.notes.filter((x) => x.id !== n.id)] })} toast={toast} />
        </div>
        <aside className="desk-brief-side">
          <section className="card desk-panel">
            <div className="desk-panel-head"><h2>预约信息</h2></div>
            <dl className="desk-dl">
              <div><dt>时间</dt><dd className="num">{when(a.startAt)}</dd></div>
              <div><dt>方式</dt><dd>{modeLabel(a.mode)}咨询 · 50 分钟</dd></div>
              <div><dt>订单金额</dt><dd className="num">{yuan(a.price)}{a.discount > 0 && <span className="muted"> · 优惠 {yuan(a.discount)}</span>}</dd></div>
              <div><dt>实付</dt><dd className="num"><b>{yuan(a.amount)}</b></dd></div>
              <div><dt>下单时间</dt><dd className="num">{dateTime(a.createdAt)}</dd></div>
              <div><dt>订单号</dt><dd className="num desk-mono">{a.id}</dd></div>
            </dl>
          </section>
          <section className="card desk-panel">
            <div className="desk-panel-head"><h2>来源</h2></div>
            {b.source ? (
              <div className="desk-source">
                <span className="desk-source-ic"><Icon name="link" size={16} /></span>
                <div><b>{b.source.creatorName}</b><small>通过合作达人推广来到平台{a.creatorId ? '（首单）' : ''}</small></div>
              </div>
            ) : <p className="muted desk-p">自然流量（来访者自行找到平台）</p>}
          </section>
          <section className="card desk-panel desk-tip">
            <h3><Icon name="alert" size={15} />危机处理提示</h3>
            <p>如咨询中发现来访者存在自伤、伤人风险，请立即启动危机干预流程，并引导拨打 <b className="num">12356</b> 心理援助热线或 <b className="num">120 / 110</b>。</p>
          </section>
        </aside>
      </div>

      {confirm && (
        <Confirm
          title="确认结束本次咨询？"
          danger
          busy={completing}
          confirmText="结束咨询"
          onClose={() => setConfirm(false)}
          onConfirm={complete}
          body={<>
            <p>结束后订单状态将变为「已完成」，来访者可以进行评价，本次收入计入当月结算。</p>
            {early && <p className="desk-warn"><Icon name="alert" size={14} />本次咨询尚未到开始时间（{when(a.startAt)}），请确认是否要提前结束。</p>}
          </>}
        />
      )}
      {toast.node}
    </div>
  );
}

function BackLink() {
  return <Link to="/desk/appointments" className="desk-back"><Icon name="chevL" size={16} />返回来访列表</Link>;
}

function ScaleBar({ score, max, level }: { score: number; max: number; level: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const tone = pct >= 60 ? 'red' : pct >= 35 ? 'amber' : 'green';
  return (
    <div className="desk-scalebar">
      <div className="desk-scalebar-track"><i className={`desk-tone-${tone}`} style={{ width: `${pct}%` }} /></div>
      <span className="num"><b>{score}</b>/{max}</span>
      <em className={`desk-lvl desk-lvl-${tone}`}>{level}</em>
    </div>
  );
}

function IntakeCard({ brief }: { brief: ClientBrief }) {
  const a = brief.appointment;
  const s: IntakeSummary | null = brief.intake;
  return (
    <section className="card desk-panel desk-intake">
      <div className="desk-panel-head">
        <h2><Icon name="spark" size={17} />AI 接待小结</h2>
        <span className="desk-ai-tag">AI 生成 · 仅供参考</span>
      </div>
      {!a.shareIntake ? (
        <div className="desk-locked"><Icon name="shield" size={22} /><b>来访者未授权同步接待小结</b><span>来访者下单时没有选择同步 AI 接待内容。可在咨询开始时进行常规初始访谈。</span></div>
      ) : !s ? (
        <div className="desk-locked"><Icon name="doc" size={22} /><b>暂无接待小结</b><span>来访者已授权同步，但没有完成 AI 接待对话。</span></div>
      ) : (
        <>
          {s.risk === 'high' && <div className="desk-risk-bar"><Icon name="alert" size={16} />AI 识别到高风险信号，请在咨询开始时优先进行安全评估。</div>}
          <div className="desk-intake-top">
            <div className="desk-intake-cell">
              <span>情绪状态</span>
              <b>{s.mood}</b>
              <div className="desk-moodmeter"><i style={{ width: `${s.moodScore}%` }} /></div>
              <small className="num">情绪指数 {s.moodScore}/100（越高越好）</small>
            </div>
            <div className="desk-intake-cell">
              <span>主要困扰</span>
              <div className="desk-tags">{s.topics.map((t) => <span key={t} className="tag">{t}</span>)}</div>
              <small>持续约 {s.duration}</small>
            </div>
            <div className="desk-intake-cell">
              <span>风险等级</span>
              <b className={`desk-risk desk-risk-${s.risk}`}>{RISK_LABEL[s.risk]}</b>
              <small>{s.riskNote}</small>
            </div>
          </div>
          {s.scales.length > 0 && (
            <div className="desk-intake-scales">
              <h3>量表估分 <small>根据对话估算，非正式施测</small></h3>
              {s.scales.map((x) => (
                <div key={x.scale} className="desk-scale-row"><span>{SCALE_NAME[x.scale]}</span><ScaleBar score={x.score} max={x.max} level={x.level} /></div>
              ))}
            </div>
          )}
          <div className="desk-intake-plan">
            <h3>对话摘要与建议</h3>
            <p>来访者在接待中提到<b>{s.topics.join('、')}</b>方面的困扰，持续约 {s.duration}，自述情绪「{s.mood}」。{s.riskNote}。</p>
            <div className="desk-plan"><Icon name="arrowR" size={14} /><span>建议方向：{s.plan}</span></div>
            <p className="muted desk-small">偏好咨询方式：{modeLabel(s.modality)}</p>
          </div>
        </>
      )}
    </section>
  );
}

function AssessCard({ list, shared }: { list: AssessmentResult[]; shared: boolean }) {
  return (
    <section className="card desk-panel">
      <div className="desk-panel-head"><h2>最近量表结果</h2><span className="muted">来访者自评</span></div>
      {!shared ? <p className="muted desk-p">来访者未授权同步，无法查看量表结果。</p>
        : list.length === 0 ? <p className="muted desk-p">来访者还没有完成心理测评。</p>
        : (
          <div className="desk-assess">
            {list.map((r) => (
              <div key={r.id} className="desk-assess-item">
                <div className="desk-assess-h"><b>{SCALE_NAME[r.scale]}</b><span className="muted num">{monthDay(r.createdAt)}</span></div>
                <ScaleBar score={r.score} max={r.max} level={r.level} />
                {r.interpretation && <p>{r.interpretation}</p>}
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function NotesCard({ brief, onSaved, toast }: { brief: ClientBrief; onSaved: (n: SessionNote) => void; toast: (m: string) => void }) {
  const apptId = brief.appointment.id;
  const mine = brief.notes.find((n) => n.appointmentId === apptId) ?? null;
  const history = brief.notes.filter((n) => n.appointmentId !== apptId).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const [editing, setEditing] = useState(!mine);
  const [text, setText] = useState(mine?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    const c = text.trim();
    if (!c) { setErr('请先填写记录内容'); return; }
    setBusy(true); setErr('');
    try {
      onSaved(await api.wbAddNote(apptId, c));
      setEditing(false);
      toast('记录已保存');
    } catch (e) { setErr(errMsg(e, '保存失败，请稍后再试')); } finally { setBusy(false); }
  }
  return (
    <section className="card desk-panel" id="notes">
      <div className="desk-panel-head"><h2>咨询记录</h2><span className="muted">仅您本人可见</span></div>
      <h3 className="desk-sub">本次咨询（{monthDay(brief.appointment.startAt)}）</h3>
      {editing ? (
        <div className="desk-note-form">
          <textarea className="textarea" placeholder="记录本次咨询要点、评估与下次计划…（Ctrl + Enter 保存）" value={text} maxLength={5000}
            onChange={(e) => { setText(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }} />
          <div className="desk-note-form-foot">
            {err ? <span className="form-error">{err}</span> : <span className="muted desk-small num">{text.length}/5000</span>}
            <div className="desk-note-btns">
              {mine && <button className="btn btn-line btn-sm" type="button" onClick={() => { setText(mine.content); setEditing(false); setErr(''); }} disabled={busy}>取消</button>}
              <button className="btn btn-blue btn-sm" type="button" onClick={save} disabled={busy}>{busy && <Spin />}保存记录</button>
            </div>
          </div>
        </div>
      ) : mine && (
        <div className="desk-note-cur">
          <p>{mine.content}</p>
          <div><span className="num muted desk-small">最后更新 {dateTime(mine.updatedAt)}</span><button className="btn btn-text" type="button" onClick={() => { setText(mine.content); setEditing(true); }}><Icon name="note" size={14} />编辑</button></div>
        </div>
      )}
      <h3 className="desk-sub">往次记录</h3>
      {history.length === 0 ? <p className="muted desk-p">暂无往次记录。</p> : (
        <ul className="desk-notes">
          {history.map((n) => (
            <li key={n.id}><span className="num muted">{dateTime(n.createdAt)}</span><p>{n.content}</p></li>
          ))}
        </ul>
      )}
    </section>
  );
}
