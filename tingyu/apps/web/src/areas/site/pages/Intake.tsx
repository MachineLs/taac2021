import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { CounselorDetail, CrisisInfo, IntakeMessage, IntakeSession } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, modeLabel, time, yuan } from '../../../lib/format';
import { useVoice } from '../../../voice/useVoice';
import { CrisisBanner } from '../../../components/CrisisBanner';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../components/Icon';
import { errMsg, INTAKE_KEY, RISK_LABEL, SCALE_SHORT } from '../util';

const STEPS = [
  { t: '说说你的困扰', d: '最近让你最困扰的是什么' },
  { t: '持续时间与影响', d: '多久了，对生活和工作的影响' },
  { t: '情绪与睡眠', d: '情绪、睡眠、精力的变化' },
  { t: '安全评估', d: '确认你现在是安全的' },
  { t: '生成小结与匹配', d: '整理要点，推荐合适的咨询师' },
];

const store = {
  get: () => { try { return sessionStorage.getItem(INTAKE_KEY); } catch { return null; } },
  set: (id: string | null) => { try { id ? sessionStorage.setItem(INTAKE_KEY, id) : sessionStorage.removeItem(INTAKE_KEY); } catch { /* ignore */ } },
};

function VoiceOrb({ level, mode }: { level: number; mode: 'idle' | 'listening' | 'thinking' | 'speaking' }) {
  const l = Math.min(1, Math.max(0, level));
  return (
    <div className={`site-orb site-orb-${mode}`} aria-hidden="true">
      <span className="site-orb-ring r3" style={{ transform: `scale(${1 + l * 0.42})`, opacity: 0.18 + l * 0.3 }} />
      <span className="site-orb-ring r2" style={{ transform: `scale(${1 + l * 0.28})`, opacity: 0.3 + l * 0.35 }} />
      <span className="site-orb-ring r1" style={{ transform: `scale(${1 + l * 0.16})` }} />
      <span className="site-orb-core" style={{ transform: `scale(${1 + l * 0.08})` }}>
        {mode === 'thinking' ? <span className="site-dots"><i /><i /><i /></span>
          : <span className="site-bars">{[0.55, 0.85, 1, 0.75, 0.5].map((k, i) => <i key={i} style={{ height: `${14 + (mode === 'idle' ? 4 : l * 46) * k}px` }} />)}</span>}
      </span>
    </div>
  );
}

function SummaryCard({ s, loggedIn }: { s: IntakeSession; loggedIn: boolean }) {
  const sum = s.summary!;
  const recs = useAsync(() => Promise.all(sum.recommendedCounselorIds.slice(0, 3).map((id) => api.counselor(id).catch(() => null))).then((x) => x.filter(Boolean) as CounselorDetail[]), [s.id]);
  const riskCls = sum.risk === 'high' ? 'badge-red' : sum.risk === 'medium' ? 'badge-gold' : 'badge-green';
  return (
    <section className="card site-sum" aria-labelledby="h-sum">
      <div className="site-sum-h">
        <div><h2 id="h-sum">接待小结</h2><span className="muted site-small">{dateTime(s.endedAt ?? s.createdAt)} · 由小屿整理</span></div>
        <span className={`badge ${riskCls}`}>{RISK_LABEL[sum.risk]}</span>
      </div>
      {sum.risk === 'high' && <CrisisBanner />}
      <div className="site-sum-mood">
        <div><span className="muted site-small">当前情绪</span><b>{sum.mood}</b></div>
        <div className="site-meter" aria-label={`情绪状态 ${sum.moodScore}/100`}><i style={{ width: `${sum.moodScore}%` }} /></div>
        <span className="num site-small muted">{sum.moodScore}/100</span>
      </div>
      <dl className="site-sum-kv">
        <dt>主要困扰</dt><dd><div className="site-tags">{sum.topics.map((t) => <span key={t} className="tag">{t}</span>)}</div></dd>
        <dt>持续时间</dt><dd>{sum.duration}</dd>
        <dt>风险评估</dt><dd>{sum.riskNote}</dd>
      </dl>
      {sum.scales.length > 0 && (
        <div className="site-sum-scales">
          <h3>量表估计 <small className="muted">根据对话推测，建议完成正式测评</small></h3>
          {sum.scales.map((x) => (
            <div key={x.scale} className="site-scale-row">
              <span>{SCALE_SHORT[x.scale] ?? x.scale}</span>
              <div className="site-meter site-meter-warm"><i style={{ width: `${Math.round((x.score / x.max) * 100)}%` }} /></div>
              <span className="num">{x.score}/{x.max}</span><span className="badge badge-gray">{x.level}</span>
            </div>
          ))}
        </div>
      )}
      <div className="site-sum-plan">
        <h3>建议方案</h3>
        <p>{sum.plan}</p>
        <span className="muted site-small">建议咨询方式：{modeLabel(sum.modality)}</span>
      </div>
      <div className="site-sum-recs">
        <h3>为你推荐的咨询师</h3>
        {recs.loading ? <Loading /> : (recs.data ?? []).length === 0 ? <p className="muted site-small">暂无推荐，<Link to="/counselors">去浏览全部咨询师</Link></p> : recs.data!.map((c, i) => (
          <div key={c.id} className="site-rec">
            <img className="avatar" src={c.avatar} alt="" width={52} height={52} />
            <div className="site-rec-info">
              <b>{c.name}{i === 0 && <span className="badge">最匹配</span>}</b>
              <span>{c.title} · ★ {c.rating.toFixed(2)}</span>
              <span className="site-tags">{c.tags.slice(0, 3).map((t) => <em key={t}>{t}</em>)}</span>
            </div>
            <div className="site-rec-act"><span className="price">{yuan(c.price)}</span><Link className="btn btn-blue btn-sm" to={`/counselors/${c.id}?mode=${c.modes.includes(sum.modality) ? sum.modality : c.modes[0]}`}>预约</Link></div>
          </div>
        ))}
      </div>
      {!loggedIn && (
        <div className="site-sum-login"><Icon name="lock" size={16} /><span>登录后保存这份小结，预约时可一键同步给咨询师，还能领 100 元新人券。</span><Link className="btn btn-soft btn-sm" to="/login?next=%2Fintake">登录保存</Link></div>
      )}
      <p className="site-disclaimer">以上为 AI 初步筛查结果，仅供参考，不构成医学诊断。专业判断请以持证咨询师或医生为准。</p>
    </section>
  );
}

export default function Intake() {
  const { user } = useAuth();
  const loc = useLocation();
  const toast = useToast();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [loadErr, setLoadErr] = useState<Error | null>(null);
  const [started, setStarted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [crisis, setCrisis] = useState<CrisisInfo | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ending, setEnding] = useState(false);
  const [typeMode, setTypeMode] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const downAt = useRef(0);
  const sendRef = useRef<(t: string) => void>(() => {});

  const voice = useVoice({ onFinal: (t) => sendRef.current(t), onError: (m) => toast(m) });
  const textFirst = !voice.supported.recognition || typeMode;

  const boot = useCallback(async (fresh = false) => {
    setLoadErr(null); setCrisis(null);
    try {
      const saved = fresh ? null : store.get();
      if (saved) {
        try {
          const s = await api.intakeGet(saved);
          setSession(s); setStarted(s.messages.length > 1 || s.status === 'ended'); return s;
        } catch { store.set(null); }
      }
      const s = await api.intakeStart();
      store.set(s.id); setSession(s); return s;
    } catch (e) { setLoadErr(e as Error); return null; }
  }, []);

  const booted = useRef(false);
  useEffect(() => { document.title = '小屿 AI 语音接待 · 听屿心理'; if (booted.current) return; booted.current = true; boot(); }, [boot]);

  // Bind an anonymous session to the user after login.
  useEffect(() => {
    if (user && session && !session.userId) api.intakeClaim(session.id).then(setSession).catch(() => {});
  }, [user?.id, session?.id, session?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const el = streamRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [session?.messages.length, pending, thinking, voice.interim, started]);

  const say = useCallback((t: string) => { if (voiceOn && voice.supported.synthesis) voice.speak(t); }, [voiceOn, voice]);

  const send = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (!t || !session || thinking || session.status === 'ended') return;
    setPending(t); setThinking(true); setText('');
    try {
      const r = await api.intakeReply(session.id, t);
      setSession(r.session);
      if (r.crisis) setCrisis(r.crisis);
      say(r.reply.content);
    } catch (e) { toast(errMsg(e, '小屿暂时没有回应，请再说一次')); setText(t); }
    finally { setPending(null); setThinking(false); }
  }, [session, thinking, say, toast]);
  sendRef.current = send;

  const begin = () => {
    setStarted(true);
    const opener = session?.messages.filter((m) => m.role === 'assistant').slice(-1)[0];
    if (opener) say(opener.content);
  };
  const restart = async () => {
    voice.cancelSpeak(); store.set(null); setSession(null); setPending(null);
    const s = await boot(true);
    if (s) { setStarted(true); const o = s.messages.find((m) => m.role === 'assistant'); if (o) say(o.content); }
  };
  const end = async () => {
    if (!session) return;
    voice.cancelSpeak(); setEnding(true);
    try { const s = await api.intakeEnd(session.id); setSession(s); if (s.summary) say('谢谢你愿意和我聊这些。我把今天的要点整理成了一份小结，也为你推荐了几位合适的咨询师。'); }
    catch (e) { toast(errMsg(e, '生成小结失败，请重试')); } finally { setEnding(false); }
  };

  const onMicDown = () => {
    if (!started || thinking || session?.status === 'ended') return;
    if (voice.state === 'listening') { voice.stop(); downAt.current = 0; return; }
    downAt.current = Date.now();
    voice.start();
  };
  const onMicUp = () => { if (downAt.current && Date.now() - downAt.current > 600) voice.stop(); downAt.current = 0; };
  const onMicKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (voice.state === 'listening') voice.stop(); else onMicDown(); } };
  const submit = (e: FormEvent) => { e.preventDefault(); send(text); };

  const msgs: IntakeMessage[] = session?.messages ?? [];
  const userTurns = msgs.filter((m) => m.role === 'user').length + (pending ? 1 : 0);
  const ended = session?.status === 'ended';
  const stepIdx = ended ? 5 : Math.min(4, userTurns);
  const orbMode = thinking ? 'thinking' : voice.state === 'listening' ? 'listening' : voice.state === 'speaking' ? 'speaking' : 'idle';
  const status = !started ? '准备好了就开始吧' : ended ? '本次接待已结束' : orbMode === 'thinking' ? '小屿正在思考…' : orbMode === 'listening' ? '倾听中…' : orbMode === 'speaking' ? '小屿正在说话' : textFirst ? '在下方输入你想说的话' : '点击或按住按钮开始说话';
  const visible = useMemo(() => (started ? msgs : []), [started, msgs]);
  const showCrisis = crisis || session?.crisis;

  if (loadErr) return <div className="site-wrap site-intake-page"><ErrorState error={loadErr} onRetry={() => boot()} /></div>;

  return (
    <div className="site-intake-page">
      <div className="site-wrap">
        <div className="site-intake-head">
          <div>
            <h1><span className="site-orb-sm"><Icon name="mic" size={16} /></span>小屿 · AI 语音接待</h1>
            <p className="muted">像和朋友聊天一样说出你的困扰，小屿帮你梳理问题、完成初步筛查，并匹配合适的持证咨询师。<b>小屿只做接待与匹配，不提供诊断和治疗。</b></p>
          </div>
          <div className="site-row-gap">
            {voice.supported.synthesis && <button type="button" className="btn btn-line btn-sm" aria-pressed={voiceOn} onClick={() => { if (voiceOn) voice.cancelSpeak(); setVoiceOn(!voiceOn); }}><Icon name={voiceOn ? 'volume' : 'mute'} size={16} />{voiceOn ? '语音朗读开' : '语音朗读关'}</button>}
            <button type="button" className="btn btn-line btn-sm" onClick={restart} disabled={!session || thinking}><Icon name="refresh" size={16} />重新开始</button>
          </div>
        </div>

        {showCrisis && <div className="site-intake-crisis"><CrisisBanner message={crisis?.message} /></div>}

        <div className="site-intake-grid">
          {/* voice panel */}
          <section className="site-vpanel" aria-label="语音控制">
            <div className="site-vpanel-top"><span className={`site-live ${started && !ended ? 'on' : ''}`}><i />{started && !ended ? '接待进行中' : ended ? '已结束' : '未开始'}</span><span className="site-small">全程加密 · 不会公开</span></div>
            <VoiceOrb level={voice.level} mode={orbMode} />
            <p className="site-vstatus" aria-live="polite">{status}</p>
            <p className="site-interim">{voice.state === 'listening' ? (voice.interim || '请说，我在听…') : ' '}</p>
            {!session ? <Loading label="正在连接小屿…" />
              : !started ? (
                <button type="button" className="btn site-start" onClick={begin}><Icon name="play" size={18} />{msgs.length > 1 ? '继续上次的对话' : '开始语音接待'}</button>
              ) : ended ? (
                <button type="button" className="btn site-start" onClick={restart}><Icon name="refresh" size={18} />开始新的接待</button>
              ) : textFirst ? (
                <div className="site-vnote">
                  {!voice.supported.recognition ? <>当前浏览器不支持语音识别，请在对话框下方输入文字。推荐使用 Chrome / Edge 体验语音接待。</> : <>已切换为文字输入。<button type="button" className="btn btn-text" onClick={() => setTypeMode(false)}>切回语音</button></>}
                </div>
              ) : (
                <>
                  <button type="button" className={`site-mic ${voice.state === 'listening' ? 'on' : ''}`} disabled={thinking}
                    onPointerDown={onMicDown} onPointerUp={onMicUp} onPointerLeave={onMicUp} onKeyDown={onMicKey}
                    aria-label={voice.state === 'listening' ? '结束说话' : '开始说话'} aria-pressed={voice.state === 'listening'}>
                    <Icon name="mic" size={30} />
                  </button>
                  <span className="site-mic-hint">{voice.state === 'listening' ? '说完了点一下，或松开结束' : '点击说话 · 按住说话'}</span>
                  <button type="button" className="btn btn-text site-small" onClick={() => { voice.stop(); setTypeMode(true); }}><Icon name="keyboard" size={15} />不方便说话？改用文字</button>
                </>
              )}
            <div className="site-vpanel-foot"><Icon name="phone" size={14} />如果你现在有伤害自己的想法，请立即拨打 <b>12356</b></div>
          </section>

          {/* conversation */}
          <section className="card site-chat" aria-label="对话">
            <div className="site-chat-h"><b>对话记录</b><span className="muted site-small">{session ? `开始于 ${time(session.createdAt)}` : ''}</span></div>
            <div className="site-stream" ref={streamRef} aria-live="polite">
              {!started && session && (
                <div className="site-chat-intro">
                  <span className="site-orb-md"><Icon name="mic" size={22} /></span>
                  <b>你好，我是小屿</b>
                  <p>点击「{msgs.length > 1 ? '继续上次的对话' : '开始语音接待'}」，我会先跟你打个招呼。整个过程大约 3–5 分钟，你可以随时结束。</p>
                  <ul><li>说出你的困扰，不需要组织语言</li><li>小屿会追问几个问题，帮你理清状况</li><li>结束后生成小结，并推荐合适的咨询师</li></ul>
                </div>
              )}
              {visible.map((m) => (
                <div key={m.id} className={`site-msg ${m.role === 'user' ? 'me' : ''}`}>
                  {m.role === 'assistant' && <span className="site-msg-ava"><Icon name="mic" size={14} /></span>}
                  <div className="site-bubble">{m.content}<time className="num">{time(m.createdAt)}</time></div>
                </div>
              ))}
              {pending && <div className="site-msg me"><div className="site-bubble">{pending}</div></div>}
              {voice.state === 'listening' && voice.interim && <div className="site-msg me"><div className="site-bubble site-bubble-ghost">{voice.interim}</div></div>}
              {thinking && <div className="site-msg"><span className="site-msg-ava"><Icon name="mic" size={14} /></span><div className="site-bubble site-typing"><i /><i /><i /></div></div>}
              {ended && <div className="site-chat-end">本次接待已结束 · 小结见右侧</div>}
            </div>
            <form className="site-composer" onSubmit={submit}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} disabled={!started || ended || !session}
                placeholder={!started ? '点击「开始」后可以输入文字' : ended ? '接待已结束' : textFirst ? '输入你想说的话，按回车发送' : '也可以直接打字告诉小屿'} aria-label="输入文字" maxLength={500} />
              <button className="btn btn-blue" type="submit" disabled={!text.trim() || thinking || !started || ended}><Icon name="send" size={16} />发送</button>
            </form>
          </section>

          {/* progress + summary */}
          <aside className="site-intake-side">
            {ended && session?.summary ? <SummaryCard s={session} loggedIn={!!user} /> : (
              <section className="card site-progress" aria-label="接待进度">
                <div className="site-progress-h"><b>接待进度</b><span className="num">{Math.round((stepIdx / 5) * 100)}%</span></div>
                <div className="site-meter"><i style={{ width: `${(stepIdx / 5) * 100}%` }} /></div>
                <ol className="site-psteps">
                  {STEPS.map((s, i) => (
                    <li key={s.t} className={i < stepIdx ? 'done' : i === stepIdx && started ? 'on' : ''}>
                      <span className="site-pdot">{i < stepIdx ? <Icon name="check" size={12} stroke={3} /> : i + 1}</span>
                      <div><b>{s.t}</b><span>{s.d}</span></div>
                    </li>
                  ))}
                </ol>
                <div className="site-progress-meta">
                  <span>已对话 <b className="num">{userTurns}</b> 轮</span>
                  <span>{userTurns >= 3 ? '信息已基本足够' : '建议至少聊 3 轮'}</span>
                </div>
                <button type="button" className="btn btn-blue btn-block" disabled={!session || userTurns < 1 || thinking || ending || ended} onClick={end}>
                  {ending ? <><span className="spinner site-spin-w" />正在生成小结…</> : '结束并生成小结'}
                </button>
                {ended && !session?.summary && <p className="muted site-small">小结生成中，请稍后刷新。</p>}
                <ul className="site-assure">
                  <li><Icon name="lock" size={14} />对话内容加密保存，仅你和你授权的咨询师可见</li>
                  <li><Icon name="shield" size={14} />{user ? '小结会保存到你的账户' : <>未登录也能聊，<Link to={`/login?next=${encodeURIComponent(loc.pathname)}`}>登录</Link>后可保存小结</>}</li>
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
      {toast.node}
    </div>
  );
}
