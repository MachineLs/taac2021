import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Appointment, AppointmentStatus, Slot } from '@tingyu/shared';
import { api } from '../../../../api/client';
import { useAsync } from '../../../../lib/useAsync';
import { dayKey, modeLabel, monthDay, range, relDay, STATUS_LABEL, time, weekday, yuan } from '../../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../../components/states';
import { useToast } from '../../../../components/Toast';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Layout';
import { dayIso, errMsg, mmss, nextDays, shortDate, sortSlots, useCountdown } from '../../util';

type TabKey = 'all' | 'pending' | 'upcoming' | 'done' | 'cancelled';
const TABS: { k: TabKey; l: string; st: AppointmentStatus[] }[] = [
  { k: 'all', l: '全部', st: [] },
  { k: 'pending', l: '待支付', st: ['pending_payment'] },
  { k: 'upcoming', l: '待咨询', st: ['paid', 'in_session'] },
  { k: 'done', l: '已完成', st: ['completed'] },
  { k: 'cancelled', l: '已取消', st: ['cancelled', 'refunded'] },
];
const STATUS_CLS: Record<AppointmentStatus, string> = { pending_payment: 'badge-gold', paid: '', in_session: 'badge-green', completed: 'badge-gray', cancelled: 'badge-gray', refunded: 'badge-gray' };
const REVIEW_TAGS = ['专业', '耐心倾听', '很有帮助', '温暖', '方法实用', '守时'];
const DAY = 86400000;

function PayLeft({ a }: { a: Appointment }) {
  const left = useCountdown(a.payExpiresAt);
  return <span className="site-paylabel">{left > 0 ? <>剩余 <b className="num">{mmss(left)}</b></> : '已超时'}</span>;
}

function RescheduleModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: (x: Appointment) => void }) {
  const slots = useAsync(() => api.counselorSlots(a.counselor.id, { days: 14 }), [a.counselor.id]);
  const days = useMemo(() => nextDays(14), []);
  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of sortSlots(slots.data ?? [])) { if (s.status === 'blocked' || s.id === a.slotId || Date.parse(s.startAt) < Date.now()) continue; const k = dayKey(s.startAt); if (!m.has(k)) m.set(k, []); m.get(k)!.push(s); }
    return m;
  }, [slots.data, a.slotId]);
  const [day, setDay] = useState(days[0]);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const f = days.find((d) => byDay.get(d)?.some((s) => s.status === 'open')); if (f) setDay(f); }, [byDay, days]);
  const submit = async () => {
    if (!sel) return;
    setBusy(true); setErr(null);
    try { onDone(await api.reschedule(a.id, { slotId: sel })); }
    catch (e) { setErr(errMsg(e, '改约失败')); slots.reload(); setSel(null); } finally { setBusy(false); }
  };
  const list = byDay.get(day) ?? [];
  return (
    <Modal title="改约到新的时间" onClose={onClose} width={620}>
      <p className="muted site-small">当前：{range(a.startAt, a.endAt)} · {a.counselor.name}。改约需在原预约开始前 24 小时以上，改约不收取费用。</p>
      {slots.error ? <ErrorState error={slots.error} onRetry={slots.reload} /> : !slots.data ? <Loading /> : (
        <>
          <div className="site-days site-days-scroll" role="tablist">
            {days.map((d) => { const n = (byDay.get(d) ?? []).filter((s) => s.status === 'open').length; return (
              <button key={d} type="button" role="tab" aria-selected={day === d} className={`site-day ${day === d ? 'on' : ''}`} onClick={() => { setDay(d); setSel(null); }}>
                <b>{relDay(dayIso(d)).length <= 2 ? relDay(dayIso(d)) : weekday(dayIso(d))}</b><span>{shortDate(d)}</span><small className={n ? '' : 'none'}>{n ? `${n} 个` : '无'}</small>
              </button>); })}
          </div>
          {list.length === 0 ? <p className="site-noslot">这一天没有可改约的时段</p> : (
            <div className="slots site-mt12">{list.map((s) => <button key={s.id} type="button" className={`slot ${sel === s.id ? 'on' : ''}`} disabled={s.status !== 'open'} onClick={() => setSel(s.id)}>{time(s.startAt)}<small>{s.status === 'open' ? '可约' : '已约'}</small></button>)}</div>
          )}
        </>
      )}
      {err && <p className="form-error">{err}</p>}
      <div className="site-modal-f"><button type="button" className="btn btn-line" onClick={onClose}>取消</button><button type="button" className="btn btn-blue" disabled={!sel || busy} onClick={submit}>{busy ? '提交中…' : '确认改约'}</button></div>
    </Modal>
  );
}

function ReviewModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (content.trim().length < 5) { setErr('请至少写 5 个字，帮助其他来访者了解咨询师'); return; }
    setBusy(true); setErr(null);
    try { await api.review(a.id, { rating, content: content.trim(), tags }); onDone(); }
    catch (e) { setErr(errMsg(e, '提交失败')); } finally { setBusy(false); }
  };
  const words = ['', '很不满意', '不太满意', '一般', '满意', '非常满意'];
  return (
    <Modal title={`评价 ${a.counselor.name}`} onClose={onClose}>
      <div className="site-rate" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} 星`} aria-pressed={rating === n} className={(hover || rating) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>★</button>)}
        <span>{words[hover || rating]}</span>
      </div>
      <div className="site-fchips site-mt12">{REVIEW_TAGS.map((t) => <button key={t} type="button" className={`chip ${tags.includes(t) ? 'on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}</div>
      <label className="field site-mt12"><span>说说你的感受（匿名展示）</span><textarea className="textarea" maxLength={500} value={content} onChange={(e) => setContent(e.target.value)} placeholder="咨询师的哪些地方帮助到了你？" /></label>
      {err && <p className="form-error">{err}</p>}
      <div className="site-modal-f"><button type="button" className="btn btn-line" onClick={onClose}>取消</button><button type="button" className="btn btn-blue" disabled={busy} onClick={submit}>{busy ? '提交中…' : '提交评价'}</button></div>
    </Modal>
  );
}

function CancelModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: (x: Appointment) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState('时间冲突');
  const go = async () => {
    setBusy(true); setErr(null);
    try { onDone(await api.cancel(a.id, { reason })); } catch (e) { setErr(errMsg(e, '取消失败')); } finally { setBusy(false); }
  };
  return (
    <Modal title="取消预约" onClose={onClose}>
      <p className="muted">{a.status === 'pending_payment' ? '订单尚未支付，取消后时段将被释放。' : `距开始超过 24 小时，取消后 ${yuan(a.amount)} 将原路全额退回。`}</p>
      <label className="field"><span>取消原因</span>
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{['时间冲突', '想换一位咨询师', '暂时不需要了', '其他原因'].map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      {err && <p className="form-error">{err}</p>}
      <div className="site-modal-f"><button type="button" className="btn btn-line" onClick={onClose}>再想想</button><button type="button" className="btn btn-danger" disabled={busy} onClick={go}>{busy ? '处理中…' : '确认取消'}</button></div>
    </Modal>
  );
}

export default function Appointments() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as TabKey) || 'all';
  const nav = useNavigate();
  const toast = useToast();
  const list = useAsync(() => api.appointments(), []);
  const [modal, setModal] = useState<{ kind: 'reschedule' | 'review' | 'cancel'; a: Appointment } | null>(null);
  useEffect(() => { document.title = '我的预约 · 听屿心理'; }, []);

  const sorted = useMemo(() => [...(list.data ?? [])].sort((x, y) => {
    const up = (s: AppointmentStatus) => (s === 'pending_payment' || s === 'paid' || s === 'in_session' ? 0 : 1);
    return up(x.status) - up(y.status) || (up(x.status) === 0 ? Date.parse(x.startAt) - Date.parse(y.startAt) : Date.parse(y.startAt) - Date.parse(x.startAt));
  }), [list.data]);
  const cur = TABS.find((t) => t.k === tab) ?? TABS[0];
  const items = cur.st.length ? sorted.filter((a) => cur.st.includes(a.status)) : sorted;
  const count = (t: (typeof TABS)[number]) => (t.st.length ? sorted.filter((a) => t.st.includes(a.status)).length : sorted.length);
  const replace = (x: Appointment) => list.setData((list.data ?? []).map((a) => (a.id === x.id ? x : a)));

  return (
    <div className="site-acc-page">
      <div className="site-acc-h"><h1>我的预约</h1><Link className="btn btn-blue btn-sm" to="/counselors">预约新的咨询</Link></div>
      <div className="site-tabs" role="tablist">
        {TABS.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => setSp(t.k === 'all' ? {} : { tab: t.k })}>{t.l}{list.data && count(t) > 0 && <span className="num">{count(t)}</span>}</button>)}
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading />
        : items.length === 0 ? <div className="card"><Empty title={`暂无${cur.k === 'all' ? '' : cur.l}预约`} hint="找到合适的咨询师，点击时间即可预约" action={<Link className="btn btn-blue" to="/counselors">去找咨询师</Link>} /></div>
        : (
          <ul className="site-appts">
            {items.map((a) => {
              const far = Date.parse(a.startAt) - Date.now() > DAY;
              const soon = Date.parse(a.startAt) - Date.now() < 10 * 60000;
              return (
                <li key={a.id} className="card site-appt">
                  <div className="site-appt-top"><span className="num muted site-small">订单号 {a.id}</span><span className={`badge ${STATUS_CLS[a.status]}`}>{STATUS_LABEL[a.status]}</span></div>
                  <div className="site-appt-body">
                    <Link to={`/counselors/${a.counselor.id}`}><img className="avatar" src={a.counselor.avatar} alt="" width={56} height={56} /></Link>
                    <div className="site-appt-info">
                      <b>{a.counselor.name} <span className="muted site-small">{a.counselor.title}</span></b>
                      <span><Icon name="calendar" size={14} />{range(a.startAt, a.endAt)}{(a.status === 'paid' || a.status === 'in_session') && <em className="site-rel">{relDay(a.startAt)}</em>}</span>
                      <span><Icon name="video" size={14} />{modeLabel(a.mode)}咨询 · 50 分钟{a.shareIntake && ' · 已同步接待小结'}</span>
                    </div>
                    <div className="site-appt-amt"><span className="price">{yuan(a.amount)}</span>{a.discount > 0 && <small className="muted">已优惠 {yuan(a.discount)}</small>}{a.status === 'pending_payment' && <PayLeft a={a} />}</div>
                  </div>
                  <div className="site-appt-acts">
                    {a.status === 'pending_payment' && <>
                      <button type="button" className="btn btn-line btn-sm" onClick={() => setModal({ kind: 'cancel', a })}>取消订单</button>
                      <button type="button" className="btn btn-orange btn-sm" onClick={() => nav(`/checkout/${a.id}`)}>去支付</button>
                    </>}
                    {a.status === 'paid' && <>
                      {far ? <>
                        <button type="button" className="btn btn-line btn-sm" onClick={() => setModal({ kind: 'cancel', a })}>取消预约</button>
                        <button type="button" className="btn btn-line btn-sm" onClick={() => setModal({ kind: 'reschedule', a })}>改约</button>
                      </> : <span className="muted site-small">开始前 24 小时内不可取消或改约</span>}
                      <button type="button" className="btn btn-line btn-sm" onClick={() => api.openConversation(a.counselor.id).then((c) => nav(`/account/messages?c=${c.id}`)).catch((e) => toast(errMsg(e)))}>消息咨询师</button>
                      <button type="button" className={`btn btn-sm ${soon ? 'btn-blue' : 'btn-soft'}`} onClick={() => nav(`/room/${a.id}`)}>进入咨询室</button>
                    </>}
                    {a.status === 'in_session' && <button type="button" className="btn btn-blue btn-sm" onClick={() => nav(`/room/${a.id}`)}>进入咨询室</button>}
                    {a.status === 'completed' && <>
                      <Link className="btn btn-line btn-sm" to={`/counselors/${a.counselor.id}`}>再次预约</Link>
                      {a.reviewed ? <span className="badge badge-green">已评价</span> : <button type="button" className="btn btn-blue btn-sm" onClick={() => setModal({ kind: 'review', a })}>写评价</button>}
                    </>}
                    {(a.status === 'cancelled' || a.status === 'refunded') && <Link className="btn btn-line btn-sm" to={`/counselors/${a.counselor.id}`}>重新预约</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      {modal?.kind === 'reschedule' && <RescheduleModal a={modal.a} onClose={() => setModal(null)} onDone={(x) => { replace(x); setModal(null); toast(`已改约到 ${relDay(x.startAt)} ${time(x.startAt)}`); }} />}
      {modal?.kind === 'review' && <ReviewModal a={modal.a} onClose={() => setModal(null)} onDone={() => { replace({ ...modal.a, reviewed: true }); setModal(null); toast('感谢你的评价'); }} />}
      {modal?.kind === 'cancel' && <CancelModal a={modal.a} onClose={() => setModal(null)} onDone={(x) => { replace(x); setModal(null); toast(x.status === 'refunded' ? '已取消，款项将原路退回' : '已取消'); }} />}
      {toast.node}
    </div>
  );
}
