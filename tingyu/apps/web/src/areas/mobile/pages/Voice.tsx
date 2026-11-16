// /m/voice — 小屿 AI voice intake, full-screen and immersive.
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CrisisInfo, IntakeMessage, IntakeSession } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useVoice } from '../../../voice/useVoice';
import { CrisisBanner } from '../../../components/CrisisBanner';
import { useToast } from '../../../components/Toast';
import { Icon } from '../icons';
import { ConfirmSheet, errMsg, intakeStore, Spin } from '../ui';

type Phase = 'boot' | 'intro' | 'live';
const MUTE_KEY = 'tingyu.m.mute';

export default function Voice() {
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('boot');
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [pending, setPending] = useState<IntakeMessage | null>(null);   // optimistic user line
  const [thinking, setThinking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [crisis, setCrisis] = useState<CrisisInfo | null>(null);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } });
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastEnded, setLastEnded] = useState<string | null>(null);
  const sendRef = useRef<(t: string) => void>(() => {});

  const voice = useVoice({
    onFinal: (t) => sendRef.current(t),
    onError: (m) => toast(m),
  });
  const canListen = voice.supported.recognition;

  // restore a session from this tab (refresh-safe)
  useEffect(() => {
    const id = intakeStore.get();
    setLastEnded(intakeStore.last());
    if (!id) { setPhase('intro'); return; }
    api.intakeGet(id).then((s) => {
      if (s.status === 'ended') { intakeStore.set(null); intakeStore.setLast(s.id); setLastEnded(s.id); setPhase('intro'); return; }
      setSession(s); setPhase('live');
    }).catch(() => { intakeStore.set(null); setPhase('intro'); });
  }, []);
  useEffect(() => { if (!canListen) setTyping(true); }, [canListen]);

  // signed in after starting anonymously → bind the session to the account
  useEffect(() => {
    if (!user || !session || session.userId) return;
    api.intakeClaim(session.id).then(setSession).catch(() => { /* not critical */ });
  }, [user, session]);

  const say = useCallback((t: string) => { if (!muted) voice.speak(t); }, [muted, voice]);

  const begin = async () => {
    setStarting(true);
    try {
      const s = await api.intakeStart();
      intakeStore.set(s.id);
      setSession(s); setPhase('live'); setCrisis(null);
      const greet = [...s.messages].reverse().find((m) => m.role === 'assistant');
      if (greet) say(greet.content);
    } catch (e) { toast(errMsg(e, '小屿暂时无法接待，请稍后再试')); }
    finally { setStarting(false); }
  };

  const send = useCallback(async (raw: string) => {
    const content = raw.trim();
    if (!content || !session || thinking) return;
    setPending({ id: 'pending', role: 'user', content, createdAt: new Date().toISOString() });
    setThinking(true); setText('');
    try {
      const res = await api.intakeReply(session.id, content);
      setSession(res.session);
      if (res.crisis) setCrisis(res.crisis);
      say(res.reply.content);
    } catch (e) {
      toast(errMsg(e, '发送失败，请重试')); setText(content);
    } finally { setPending(null); setThinking(false); }
  }, [session, thinking, say, toast]);
  sendRef.current = send;

  const toggleMic = () => {
    if (!session) return;
    if (!canListen) { toast('当前浏览器不支持语音识别，请用文字输入'); setTyping(true); return; }
    if (voice.state === 'listening') voice.stop(); else voice.start();
  };
  const toggleMute = () => {
    const m = !muted; setMuted(m);
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (m) voice.cancelSpeak();
  };
  const replay = () => {
    const last = session && [...session.messages].reverse().find((m) => m.role === 'assistant');
    if (last) voice.speak(last.content);
  };

  const end = async () => {
    if (!session) return;
    setEnding(true);
    try {
      voice.cancelSpeak();
      await api.intakeEnd(session.id);
      intakeStore.set(null); intakeStore.setLast(session.id);
      nav(`/m/intake/${session.id}`);
    } catch (e) { toast(errMsg(e, '生成小结失败，请重试')); setEnding(false); }
  };

  const status = thinking ? 'thinking' : voice.state;
  const statusText = phase !== 'live' ? '你好，我是小屿'
    : status === 'thinking' ? '小屿正在思考…'
    : status === 'speaking' ? '小屿正在说话…'
    : status === 'listening' ? '我在听，请慢慢说'
    : typing ? '打字也可以，想到什么说什么' : '点击麦克风，开始说话';
  const userTurns = session?.messages.filter((m) => m.role === 'user').length ?? 0;
  const messages = session ? (pending ? [...session.messages, pending] : session.messages) : [];
  const showCrisis = !!crisis || !!session?.crisis;

  return (
    <div className={`m-voice is-${phase === 'live' ? status : 'idle'}`}>
      <div className="m-voice-bg" aria-hidden="true"><i /><i /><i /></div>
      <header className="m-voice-top">
        <button type="button" className="m-vbtn" aria-label="返回" onClick={() => nav(-1)}><Icon name="back" size={22} /></button>
        <div className="m-voice-title"><b>小屿</b><span><i className="m-live-dot" />AI 接待助理 · 在线</span></div>
        <div className="m-voice-actions">
          <button type="button" className="m-vbtn" aria-label={muted ? '打开朗读' : '静音朗读'} aria-pressed={muted} onClick={toggleMute}><Icon name={muted ? 'mute' : 'speaker'} size={20} /></button>
          {phase === 'live' && <button type="button" className="m-vend" onClick={() => setEndOpen(true)}>结束</button>}
        </div>
      </header>

      {showCrisis && <div className="m-voice-crisis"><CrisisBanner message={crisis?.message} /></div>}

      <div className={`m-voice-stage${phase === 'live' ? ' live' : ''}`}>
        <Orb level={voice.level} />
        <p className="m-voice-status" aria-live="polite">{statusText}</p>
        {voice.state === 'listening' && <p className="m-voice-interim">{voice.interim || '…'}</p>}
      </div>

      {phase === 'boot' && <div className="m-voice-boot"><Spin /></div>}

      {phase === 'intro' && (
        <div className="m-voice-intro">
          <h1>说说最近的困扰，<br />我帮你找到合适的咨询师</h1>
          <ul>
            <li><Icon name="clock" size={16} />约 3 分钟 · 免费 · 可匿名</li>
            <li><Icon name="lock" size={16} />对话加密保存，只有你授权的咨询师能看到小结</li>
            <li><Icon name="shield" size={16} />小屿只做接待与匹配，不做诊断和治疗</li>
          </ul>
          <button type="button" className="m-voice-start" onClick={begin} disabled={starting}>{starting ? <Spin /> : <Icon name="mic" size={20} />}开始接待</button>
          {!canListen && <small className="m-voice-hint">当前浏览器不支持语音识别，可以用文字和小屿聊</small>}
          {lastEnded && <Link className="m-voice-last" to={`/m/intake/${lastEnded}`}>查看上次的接待小结 ›</Link>}
        </div>
      )}

      {phase === 'live' && (
        <>
          <Transcript messages={messages} thinking={thinking} />
          <div className="m-voice-ctrl">
            {typing ? (
              <form className="m-voice-type" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                {canListen && <button type="button" className="m-vround" aria-label="切换到语音" onClick={() => setTyping(false)}><Icon name="mic" size={20} /></button>}
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="输入你想说的话…" aria-label="输入你想说的话" enterKeyHint="send" maxLength={500} />
                <button type="submit" className="m-vsend" disabled={!text.trim() || thinking} aria-label="发送">{thinking ? <Spin /> : <Icon name="send" size={18} />}</button>
              </form>
            ) : (
              <div className="m-voice-btns">
                <button type="button" className="m-vround" aria-label="切换到文字输入" onClick={() => { voice.stop(); setTyping(true); }}><Icon name="keyboard" size={22} /></button>
                <button type="button" className={`m-vmic${voice.state === 'listening' ? ' on' : ''}`} onClick={toggleMic} disabled={thinking} aria-label={voice.state === 'listening' ? '停止说话' : '开始说话'}>
                  <span className="m-vmic-ring" style={{ transform: `scale(${1 + (voice.state === 'listening' ? voice.level * 0.5 : 0)})` }} />
                  {voice.state === 'listening' ? <span className="m-vmic-stop" /> : <Icon name="mic" size={30} />}
                </button>
                <button type="button" className="m-vround" aria-label="再听一遍" onClick={replay} disabled={thinking || voice.state === 'speaking'}><Icon name="refresh" size={20} /></button>
              </div>
            )}
            <p className="m-voice-foot">{voice.state === 'listening' ? '说完后点击停止，小屿会马上回复' : 'AI 生成内容仅供参考 · 不构成诊断 · 紧急情况请拨打 12356'}</p>
          </div>
        </>
      )}

      <ConfirmSheet open={endOpen} onClose={() => setEndOpen(false)} title="结束这次接待？" confirm="生成接待小结" busy={ending} onConfirm={end}
        body={userTurns < 2
          ? <>你和小屿只聊了 {userTurns} 句，小结可能不够准确。多说一点，匹配会更合适。<br />确定现在结束吗？</>
          : <>小屿会根据刚才的对话，整理出你的情绪状态、主要困扰和建议方案，并推荐合适的咨询师。</>} />
      {toast.node}
    </div>
  );
}

function Orb({ level }: { level: number }) {
  const l = Math.min(1, Math.max(0, level));
  return (
    <div className="m-orb" aria-hidden="true">
      <span className="m-orb-r r3" style={{ transform: `scale(${1 + l * 0.45})`, opacity: 0.25 + l * 0.35 }} />
      <span className="m-orb-r r2" style={{ transform: `scale(${1 + l * 0.28})`, opacity: 0.4 + l * 0.35 }} />
      <span className="m-orb-r r1" style={{ transform: `scale(${1 + l * 0.14})` }} />
      <span className="m-orb-core" style={{ transform: `scale(${1 + l * 0.08})` }}><i /><i /></span>
    </div>
  );
}

const Transcript = memo(function Transcript({ messages, thinking }: { messages: IntakeMessage[]; thinking: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [messages.length, thinking]);
  const lastA = messages.map((m) => m.role).lastIndexOf('assistant');
  return (
    <div className="m-voice-log" ref={ref} aria-live="polite" aria-label="对话记录">
      {messages.map((m, i) => (
        <p key={m.id} className={`m-vline ${m.role}${i === lastA && !thinking ? ' cur' : ''}${m.id === 'pending' ? ' pend' : ''}`}>{m.content}</p>
      ))}
      {thinking && <p className="m-vline assistant m-vdots" aria-label="小屿正在思考"><i /><i /><i /></p>}
    </div>
  );
});
