// /m/orders/:id — appointment detail: pay, cancel, reschedule sheet, review sheet, enter the room.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Appointment, Slot } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, modeLabel, range, STATUS_LABEL, yuan } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../icons';
import { SlotPicker } from '../BookingSheet';
import { STATUS_TONE } from './Orders';
import { BottomBar, ConfirmSheet, errMsg, hms, mmss, NavBar, Sheet, Spin, useCountdown } from '../ui';

const DAY = 86400000;
const REVIEW_TAGS = ['专业', '耐心', '温暖', '有方法', '倾听', '见效', '负责'];

export default function OrderDetail() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const a = useAsync(() => api.appointment(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rsOpen, setRsOpen] = useState(false);
  const [rvOpen, setRvOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (a.data && sp.get('review') && a.data.status === 'completed' && !a.data.reviewed) setRvOpen(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [a.data]);

  if (a.loading && !a.data) return <><NavBar title="预约详情" /><Loading full /></>;
  if (a.error || !a.data) return <><NavBar title="预约详情" /><ErrorState error={new Error(errMsg(a.error, '订单加载失败'))} onRetry={a.reload} /></>;
  const o = a.data;
  const startMs = new Date(o.startAt).getTime();
  const freeChange = o.status === 'paid' && startMs - Date.now() > DAY;
  const canJoin = (o.status === 'paid' || o.status === 'in_session') && startMs - Date.now() < 10 * 60000 && new Date(o.endAt).getTime() > Date.now();

  const doCancel = async () => {
    setBusy(true);
    try { const x = await api.cancel(o.id, { reason: '来访者主动取消' }); a.setData(x); setCancelOpen(false); toast(x.status === 'refunded' ? '已取消，费用将原路退回' : '订单已取消'); }
    catch (e) { toast(e instanceof ApiError && e.status === 409 ? '距离咨询开始不足 24 小时，无法自助取消，请联系咨询师或客服' : errMsg(e, '取消失败')); setCancelOpen(false); }
    finally { setBusy(false); }
  };
  const closeReview = () => { setRvOpen(false); if (sp.get('review')) setSp({}, { replace: true }); };

  return (
    <div className="m-od">
      <NavBar title="预约详情" />
      <StatusHead o={o} />
      <section className="m-card">
        <Link to={`/m/counselors/${o.counselor.id}`} className="m-order-cc flat">
          <img className="avatar" src={o.counselor.avatar} alt="" width={48} height={48} />
          <div><b>{o.counselor.name}</b><small>{o.counselor.title}</small></div>
          <Icon name="right" size={16} />
        </Link>
        <div className="m-kv" style={{ marginTop: 14 }}>
          <div><span>咨询时间</span><span>{range(o.startAt, o.endAt)}</span></div>
          <div><span>咨询方式</span><span>{modeLabel(o.mode)} · 50 分钟</span></div>
          <div><span>接待小结</span><span>{o.intakeSessionId ? (o.shareIntake ? <Link to={`/m/intake/${o.intakeSessionId}`} className="m-link">已授权咨询师查看 ›</Link> : '未同步') : '无'}</span></div>
        </div>
      </section>
      <section className="m-card">
        <div className="m-kv">
          <div><span>咨询费用</span><span className="num">{yuan(o.price)}</span></div>
          <div><span>优惠</span><span className="num">{o.discount ? `-${yuan(o.discount)}` : '—'}</span></div>
          <div className="total"><span>{o.status === 'pending_payment' ? '需付款' : o.status === 'refunded' ? '已退款' : '实付款'}</span><span>{yuan(o.amount)}</span></div>
        </div>
      </section>
      <section className="m-card">
        <div className="m-kv m-kv-sm">
          <div><span>订单编号</span><span className="num">{o.id}</span></div>
          <div><span>下单时间</span><span className="num">{dateTime(o.createdAt)}</span></div>
          {o.paidAt && <div><span>支付时间</span><span className="num">{dateTime(o.paidAt)}</span></div>}
          {o.cancelledAt && <div><span>取消时间</span><span className="num">{dateTime(o.cancelledAt)}</span></div>}
        </div>
      </section>
      {o.status === 'paid' && (
        <p className="m-note"><Icon name="info" size={14} />{freeChange ? '距开始 24 小时以上，可免费改约或取消（全额退款）。' : '距开始已不足 24 小时，不支持自助取消和改约，如有特殊情况请联系咨询师。'}</p>
      )}

      <BottomBar className="m-od-bar">
        {o.status === 'pending_payment' && <>
          <button type="button" className="btn btn-line btn-lg" onClick={() => setCancelOpen(true)}>取消订单</button>
          <button type="button" className="btn btn-blue btn-lg m-bbar-main" onClick={() => nav(`/m/checkout/${o.id}`)}>去支付 {yuan(o.amount)}</button>
        </>}
        {o.status === 'paid' && <>
          <button type="button" className="m-bbar-ic" disabled={!freeChange} onClick={() => setCancelOpen(true)}><Icon name="close" size={20} />取消</button>
          <button type="button" className="m-bbar-ic" disabled={!freeChange} onClick={() => setRsOpen(true)}><Icon name="calendar" size={20} />改约</button>
          <button type="button" className={`btn btn-lg m-bbar-main ${canJoin ? 'btn-blue' : 'btn-soft'}`} onClick={() => nav(`/m/room/${o.id}`)}>{canJoin ? '进入咨询室' : '查看咨询室'}</button>
        </>}
        {o.status === 'in_session' && <button type="button" className="btn btn-blue btn-lg m-bbar-main" onClick={() => nav(`/m/room/${o.id}`)}>回到咨询室</button>}
        {o.status === 'completed' && <>
          {!o.reviewed && <button type="button" className="btn btn-line btn-lg" onClick={() => setRvOpen(true)}>评价咨询</button>}
          <button type="button" className="btn btn-blue btn-lg m-bbar-main" onClick={() => nav(`/m/counselors/${o.counselor.id}?book=1`)}>再次预约</button>
        </>}
        {(o.status === 'cancelled' || o.status === 'refunded') && <button type="button" className="btn btn-blue btn-lg m-bbar-main" onClick={() => nav(`/m/counselors/${o.counselor.id}?book=1`)}>重新预约</button>}
      </BottomBar>

      <ConfirmSheet open={cancelOpen} onClose={() => setCancelOpen(false)} tone="danger" busy={busy} onConfirm={doCancel}
        title={o.status === 'pending_payment' ? '取消这笔订单？' : '取消这次预约？'} confirm="确认取消"
        body={o.status === 'pending_payment' ? '取消后时段将被释放，其他来访者可以预约。' : <>取消后 <b className="num">{yuan(o.amount)}</b> 将在 1–3 个工作日内原路退回{o.discount ? '，已使用的优惠券不退回' : ''}。</>} />
      <RescheduleSheet o={o} open={rsOpen} onClose={() => setRsOpen(false)} onDone={(x) => { a.setData(x); setRsOpen(false); toast('改约成功'); }} />
      <ReviewSheet o={o} open={rvOpen} onClose={closeReview} onDone={() => { a.setData({ ...o, reviewed: true }); closeReview(); toast('感谢你的评价'); }} />
      {toast.node}
    </div>
  );
}

function StatusHead({ o }: { o: Appointment }) {
  const payLeft = useCountdown(o.status === 'pending_payment' ? o.payExpiresAt : null);
  const startLeft = useCountdown(o.status === 'paid' ? o.startAt : null);
  const sub = o.status === 'pending_payment' ? (payLeft > 0 ? `请在 ${mmss(payLeft)} 内完成支付` : '支付已超时')
    : o.status === 'paid' ? (startLeft > 0 ? `距离咨询开始 ${hms(startLeft)}` : '咨询即将开始')
    : o.status === 'in_session' ? '咨询进行中'
    : o.status === 'completed' ? (o.reviewed ? '感谢你的评价' : '咨询已完成，说说你的感受吧')
    : o.status === 'refunded' ? '费用已原路退回' : '订单已取消';
  return (
    <section className={`m-od-head ${STATUS_TONE[o.status]}`}>
      <b>{STATUS_LABEL[o.status]}</b><span>{sub}</span>
    </section>
  );
}

function RescheduleSheet({ o, open, onClose, onDone }: { o: Appointment; open: boolean; onClose: () => void; onDone: (a: Appointment) => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setErr(null); api.counselorSlots(o.counselor.id, { days: 7 }).then((s) => setSlots(s.filter((x) => x.id !== o.slotId))).catch((e) => setErr(errMsg(e, '时段加载失败'))); };
  useEffect(() => { if (open) { setSlotId(null); load(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const submit = async () => {
    if (!slotId) return;
    setBusy(true); setErr(null);
    try { onDone(await api.reschedule(o.id, { slotId })); }
    catch (e) { setErr(e instanceof ApiError && e.code === 'slot_taken' ? '这个时段刚被约走了，请换一个' : errMsg(e, '改约失败')); if (e instanceof ApiError && e.code === 'slot_taken') load(); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="改约时间" tall
      footer={<button type="button" className="btn btn-blue btn-lg btn-block" disabled={!slotId || busy} onClick={submit}>{busy && <Spin />}确认改约</button>}>
      <p className="m-sheet-hint">当前：{range(o.startAt, o.endAt)} · 改约不产生额外费用</p>
      {err && <div className="m-form-err" role="alert">{err}</div>}
      {!slots ? (err ? null : <Loading />) : <SlotPicker slots={slots} value={slotId} onChange={(s) => setSlotId(s.id)} />}
    </Sheet>
  );
}

function ReviewSheet({ o, open, onClose, onDone }: { o: Appointment; open: boolean; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (content.trim().length < 5) { setErr('请至少写 5 个字，你的感受对其他来访者很有帮助'); return; }
    setBusy(true); setErr(null);
    try { await api.review(o.id, { rating, content: content.trim(), tags }); onDone(); }
    catch (e) { setErr(errMsg(e, '提交失败')); }
    finally { setBusy(false); }
  };
  const LABEL = ['', '很不满意', '不太满意', '一般', '满意', '非常满意'];
  return (
    <Sheet open={open} onClose={onClose} title={`评价 ${o.counselor.name}`}
      footer={<button type="button" className="btn btn-blue btn-lg btn-block" disabled={busy} onClick={submit}>{busy && <Spin />}提交评价</button>}>
      {err && <div className="m-form-err" role="alert">{err}</div>}
      <div className="m-rate" role="radiogroup" aria-label="评分">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} 星`} className={i <= rating ? 'on' : ''} onClick={() => setRating(i)}><Icon name="star" size={34} fill={i <= rating} /></button>
        ))}
        <span>{LABEL[rating]}</span>
      </div>
      <div className="m-chips-wrap" style={{ justifyContent: 'center', margin: '6px 0 14px' }}>
        {REVIEW_TAGS.map((t) => <button key={t} type="button" className={`chip${tags.includes(t) ? ' on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>)}
      </div>
      <textarea className="textarea" rows={4} maxLength={300} value={content} onChange={(e) => setContent(e.target.value)} placeholder="说说这次咨询的感受（匿名展示，不会显示你的全名）" aria-label="评价内容" />
    </Sheet>
  );
}
