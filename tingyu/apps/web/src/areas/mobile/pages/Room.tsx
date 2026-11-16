// /m/room/:id — consultation room: waiting countdown + checklist, or a simulated full-screen video call.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SessionRoom } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, range, relDay, time } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { ConfirmSheet, errMsg, modeFull, hms, mmss, NavBar, useCountdown } from '../ui';

export default function Room() {
  const { id = '' } = useParams();
  const r = useAsync(() => api.room(id), [id]);
  const [inCall, setInCall] = useState(false);
  if (r.loading && !r.data) return <><NavBar title="咨询室" /><Loading full /></>;
  if (r.error || !r.data) return <><NavBar title="咨询室" /><ErrorState error={new Error(errMsg(r.error, '咨询室暂时无法进入'))} onRetry={r.reload} /></>;
  const a = r.data.appointment;
  if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'refunded' || new Date(a.endAt).getTime() < Date.now()) {
    return (
      <>
        <NavBar title="咨询室" />
        <div className="st st-full"><b>{a.status === 'cancelled' || a.status === 'refunded' ? '这次预约已取消' : '这次咨询已结束'}</b><span>{range(a.startAt, a.endAt)}</span>
          <div className="m-row-gap"><Link className="btn btn-line btn-pill" to={`/m/orders/${a.id}`}>查看订单</Link><Link className="btn btn-blue btn-pill" to={`/m/counselors/${a.counselor.id}?book=1`}>再次预约</Link></div></div>
      </>
    );
  }
  if (a.status === 'pending_payment') {
    return <><NavBar title="咨询室" /><div className="st st-full"><b>订单还未支付</b><span>支付后才能进入咨询室</span><Link className="btn btn-blue btn-pill" to={`/m/checkout/${a.id}`}>去支付</Link></div></>;
  }
  if (inCall && r.data.canJoin) return <Call room={r.data} onLeave={() => setInCall(false)} />;
  return <Waiting room={r.data} onJoin={() => setInCall(true)} onOpen={r.reload} />;
}

const PREP = ['找一个安静、私密的空间', '戴上耳机，避免回声', `检查网络、麦克风${''}`, '准备好想聊的一两件事', '关闭其他会占用麦克风的应用'];

function Waiting({ room, onJoin, onOpen }: { room: SessionRoom; onJoin: () => void; onOpen: () => void }) {
  const a = room.appointment;
  const toOpen = useCountdown(room.canJoin ? null : room.joinOpensAt);
  const toStart = useCountdown(a.startAt);
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => { if (!room.canJoin && toOpen === 0 && new Date(room.joinOpensAt).getTime() <= Date.now()) onOpen(); }, [toOpen, room.canJoin, room.joinOpensAt, onOpen]);
  const items = a.mode === 'video' ? PREP.map((p, i) => (i === 2 ? '检查网络、麦克风和摄像头' : p)) : PREP;
  return (
    <div className="m-room-wait">
      <NavBar title="咨询室" />
      <section className="m-room-hero">
        <img className="avatar" src={a.counselor.avatar} alt="" width={76} height={76} />
        <h1>{a.counselor.name}</h1>
        <p>{a.counselor.title} · {modeFull(a.mode)}</p>
        <div className="m-room-count">
          {room.canJoin ? <><small>咨询室已开放</small><b className="num">{toStart > 0 ? mmss(Math.min(toStart, 5999)) : '已开始'}</b><small>{toStart > 0 ? '后开始' : `${time(a.startAt)} – ${time(a.endAt)}`}</small></>
            : <><small>距离咨询室开放</small><b className="num">{hms(toOpen)}</b><small>{relDay(a.startAt)} {time(a.startAt)} 开始 · 提前 10 分钟开放</small></>}
        </div>
        <button type="button" className="btn btn-lg m-room-join" disabled={!room.canJoin} onClick={onJoin}><Icon name={a.mode === 'video' ? 'video' : 'phone'} size={20} />{room.canJoin ? '进入咨询室' : '尚未开放'}</button>
      </section>
      <section className="m-card">
        <h3>咨询前准备<small className="m-h-note">{done.length}/{items.length}</small></h3>
        <ul className="m-prep">
          {items.map((p, i) => (
            <li key={i}><button type="button" className={done.includes(i) ? 'on' : ''} aria-pressed={done.includes(i)} onClick={() => setDone((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}>
              <i className="m-check">{done.includes(i) && <Icon name="check" size={14} />}</i>{p}</button></li>
          ))}
        </ul>
      </section>
      <p className="m-note"><Icon name="lock" size={14} />咨询过程全程加密，不录音不录像。如出现紧急情况，请拨打 12356 心理援助热线或 120。</p>
    </div>
  );
}

function Call({ room, onLeave }: { room: SessionRoom; onLeave: () => void }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const a = room.appointment;
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(a.mode === 'video');
  const [speaker, setSpeaker] = useState(true);
  const [leave, setLeave] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const startMs = new Date(a.startAt).getTime();
  const elapsed = Math.floor((now - (startMs <= now ? startMs : t0)) / 1000);
  const remain = Math.max(0, Math.floor((new Date(a.endAt).getTime() - now) / 1000));
  const video = a.mode === 'video';
  return (
    <div className="m-call">
      <div className="m-call-bg" style={{ backgroundImage: `url(${a.counselor.avatar})` }} aria-hidden="true" />
      {!video && <div className="m-call-voice"><img src={a.counselor.avatar} alt="" /><span className="m-call-wave"><i /><i /><i /><i /><i /></span></div>}
      <div className="m-call-top">
        <span className="m-call-demo"><Icon name="info" size={13} />演示环境 · 不传输真实音视频</span>
        <div className="m-call-who"><b>{a.counselor.name}</b><span className="num">{mmss(Math.max(0, elapsed))} · 剩余 {Math.ceil(remain / 60)} 分钟</span></div>
      </div>
      {video && (
        <div className="m-call-self">
          {cam ? (user?.avatar ? <img src={user.avatar} alt="" /> : <span className="m-call-me">{(user?.name ?? '我').slice(0, 1)}</span>) : <span className="m-call-off"><Icon name="cameraOff" size={20} />摄像头已关闭</span>}
          <small>我</small>
        </div>
      )}
      <div className="m-call-ctrl">
        <button type="button" className={mic ? '' : 'off'} aria-pressed={!mic} onClick={() => setMic(!mic)}><span><Icon name={mic ? 'mic' : 'micOff'} size={24} /></span>{mic ? '静音' : '已静音'}</button>
        {video
          ? <button type="button" className={cam ? '' : 'off'} aria-pressed={!cam} onClick={() => setCam(!cam)}><span><Icon name={cam ? 'camera' : 'cameraOff'} size={24} /></span>{cam ? '关摄像头' : '开摄像头'}</button>
          : <button type="button" className={speaker ? '' : 'off'} aria-pressed={!speaker} onClick={() => setSpeaker(!speaker)}><span><Icon name={speaker ? 'speaker' : 'mute'} size={24} /></span>{speaker ? '扬声器' : '听筒'}</button>}
        <button type="button" className="hang" onClick={() => setLeave(true)}><span><Icon name="hangup" size={28} /></span>离开</button>
      </div>
      <ConfirmSheet open={leave} onClose={() => setLeave(false)} title="离开咨询室？" tone="danger" confirm="离开"
        body="咨询时间内可以随时重新进入。咨询结束由咨询师确认。"
        onConfirm={() => { setLeave(false); onLeave(); nav(`/m/orders/${a.id}`); }} />
    </div>
  );
}
