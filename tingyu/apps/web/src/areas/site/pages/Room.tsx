import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, range, STATUS_LABEL, when } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { Icon } from '../components/Icon';
import { Logo, Modal, UserAvatar } from '../components/Layout';
import { hms, mmss, useCountdown } from '../util';

export default function Room() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const room = useAsync(() => api.room(id), [id]);
  const r = room.data;
  const toOpen = useCountdown(r && !r.canJoin ? r.joinOpensAt : null);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => { document.title = '咨询室 · 听屿心理'; }, []);
  // When the join window opens, re-check with the server.
  useEffect(() => { if (r && !r.canJoin && toOpen === 0 && Date.parse(r.joinOpensAt) <= Date.now()) room.reload(); }, [toOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!joined) return;
    const t0 = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [joined]);

  if (room.error) return <div className="site-room-wrap"><div className="site-room-top"><Logo sub={false} /></div><div className="site-wrap"><ErrorState error={room.error} onRetry={room.reload} /><div className="site-center"><Link className="btn btn-line" to="/account">返回我的预约</Link></div></div></div>;
  if (!r) return <Loading full />;
  const a = r.appointment;
  const ended = a.status === 'completed' || a.status === 'cancelled' || a.status === 'refunded';
  const endLeft = Math.max(0, Math.floor((Date.parse(a.endAt) - Date.now()) / 1000));

  if (joined && r.canJoin) {
    return (
      <div className="site-call">
        <div className="site-call-top">
          <span className="site-live on"><i />咨询进行中</span>
          <b>{a.counselor.name} · {modeLabel(a.mode)}咨询</b>
          <span className="num">{mmss(elapsed)} · 剩余约 {Math.ceil(endLeft / 60)} 分钟</span>
        </div>
        <div className="site-call-stage">
          <div className="site-call-main">
            <img src={a.counselor.avatar} alt={a.counselor.name} />
            <span className="site-call-name">{a.counselor.name}<small>{a.counselor.title}</small></span>
          </div>
          <div className="site-call-self">
            {cam ? <UserAvatar src={user?.avatar} name={user?.name ?? '我'} size={72} /> : <span className="site-call-off"><Icon name="videoOff" size={26} />摄像头已关闭</span>}
            <span>我{!mic && ' · 已静音'}</span>
          </div>
          <div className="site-call-demo"><Icon name="info" size={14} />演示环境：音视频通话服务待接入，当前为界面演示</div>
        </div>
        <div className="site-call-bar">
          <button type="button" className={mic ? '' : 'off'} onClick={() => setMic(!mic)} aria-pressed={!mic}><Icon name={mic ? 'mic' : 'micOff'} size={22} /><span>{mic ? '静音' : '取消静音'}</span></button>
          <button type="button" className={cam ? '' : 'off'} onClick={() => setCam(!cam)} aria-pressed={!cam}><Icon name={cam ? 'video' : 'videoOff'} size={22} /><span>{cam ? '关闭摄像头' : '打开摄像头'}</span></button>
          <button type="button" className="site-hang" onClick={() => setConfirmLeave(true)}><Icon name="hangup" size={24} /><span>离开</span></button>
        </div>
        {confirmLeave && (
          <Modal title="离开咨询室？" onClose={() => setConfirmLeave(false)}>
            <p className="muted">咨询仍在进行中，离开后可以在咨询结束前重新进入。咨询由咨询师结束。</p>
            <div className="site-modal-f"><button type="button" className="btn btn-line" onClick={() => setConfirmLeave(false)}>继续咨询</button><button type="button" className="btn btn-danger" onClick={() => { setJoined(false); setConfirmLeave(false); nav('/account'); }}>离开</button></div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="site-room-wrap">
      <div className="site-room-top"><Logo sub={false} /><Link className="btn btn-line btn-sm" to="/account">返回我的预约</Link></div>
      <div className="site-room-card card">
        <UserAvatar src={a.counselor.avatar} name={a.counselor.name} size={88} />
        <h1>{a.counselor.name} · {modeLabel(a.mode)}咨询</h1>
        <p className="muted">{range(a.startAt, a.endAt)}（{when(a.startAt)}）</p>
        {ended ? (
          <><span className="badge badge-gray">{STATUS_LABEL[a.status]}</span><p>本次咨询已结束。{a.status === 'completed' && !a.reviewed && '欢迎给咨询师留下评价。'}</p><Link className="btn btn-blue" to="/account?tab=done">返回我的预约</Link></>
        ) : r.canJoin ? (
          <>
            <span className="badge badge-green">咨询室已开放</span>
            <button type="button" className="btn btn-blue btn-lg" onClick={() => setJoined(true)}><Icon name="video" />进入咨询室</button>
          </>
        ) : (
          <>
            <div className="site-room-cd"><span>距咨询室开放还有</span><b className="num">{hms(toOpen)}</b><small>开始前 10 分钟开放进入</small></div>
            <button type="button" className="btn btn-line btn-lg" disabled>咨询室尚未开放</button>
          </>
        )}
        <div className="site-room-prep">
          <h3>咨询前准备</h3>
          <ul className="site-checklist">
            <li><Icon name="check" size={16} />找一个安静、私密、不被打扰的空间</li>
            <li><Icon name="check" size={16} />{a.mode === 'video' ? '检查摄像头和麦克风，佩戴耳机效果更好' : '检查麦克风，佩戴耳机效果更好'}</li>
            <li><Icon name="check" size={16} />保持网络稳定，建议连接 Wi-Fi</li>
            <li><Icon name="check" size={16} />准备好想聊的话题，也可以从「最近怎么样」开始</li>
          </ul>
        </div>
        <p className="site-disclaimer">演示环境：音视频通话服务待接入。如在咨询中出现紧急情况，请拨打 12356 / 120 / 110。</p>
      </div>
    </div>
  );
}
