import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Appointment, PayMethod, PayRes } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, modeLabel, range, STATUS_LABEL, when, yuan } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Layout';
import { downloadIcs, errMsg, mmss, useCountdown } from '../util';

const METHODS: { v: PayMethod; l: string; icon: string; hint: string }[] = [
  { v: 'wechat', l: '微信支付', icon: 'wechat', hint: '推荐，亿万用户的选择' },
  { v: 'alipay', l: '支付宝', icon: 'alipay', hint: '支持花呗' },
  { v: 'card', l: '银行卡', icon: 'card', hint: '储蓄卡 / 信用卡' },
];
const METHOD_LABEL: Record<PayMethod, string> = { wechat: '微信支付', alipay: '支付宝', card: '银行卡' };

function OrderSummary({ a }: { a: Appointment }) {
  return (
    <div className="site-order">
      <img className="avatar" src={a.counselor.avatar} alt="" width={64} height={64} />
      <div>
        <b className="site-order-nm">{a.counselor.name}<span className="badge">{a.counselor.title}</span></b>
        <div className="site-order-meta"><span><Icon name="calendar" size={15} />{range(a.startAt, a.endAt)}</span><span><Icon name="video" size={15} />{modeLabel(a.mode)}咨询 · 50 分钟</span></div>
        {a.shareIntake && <div className="site-order-meta"><span className="badge badge-green">已同步 AI 接待小结给咨询师</span></div>}
      </div>
    </div>
  );
}

function Success({ a, pay }: { a: Appointment; pay: PayRes['payment'] | null }) {
  const nav = useNavigate();
  return (
    <div className="site-co-success">
      <div className="card site-success-hero">
        <span className="site-success-ic"><Icon name="check" size={30} stroke={2.6} /></span>
        <h1>预约成功</h1>
        <p>{when(a.startAt)} · {a.counselor.name} · {modeLabel(a.mode)}咨询。开始前 10 分钟可进入咨询室。</p>
        {pay && <p className="muted site-small">支付 {yuan(pay.amount)} · {METHOD_LABEL[pay.method]} · 交易号 <span className="num">{pay.transactionNo}</span></p>}
        <div className="site-row-gap site-center">
          <button type="button" className="btn btn-line" onClick={() => downloadIcs(`心理咨询 · ${a.counselor.name}`, a.startAt, a.endAt, `${modeLabel(a.mode)}咨询，开始前 10 分钟进入听屿咨询室`)}><Icon name="calendar" size={16} />添加到日历</button>
          <button type="button" className="btn btn-line" onClick={() => api.openConversation(a.counselor.id).then((c) => nav(`/account/messages?c=${c.id}`)).catch(() => nav('/account/messages'))}><Icon name="chat" size={16} />消息咨询师</button>
          <Link className="btn btn-blue" to="/account">去个人中心</Link>
        </div>
      </div>
      <div className="site-co-grid2">
        <div className="card card-pad"><h3 className="site-h3">预约信息</h3><OrderSummary a={a} /></div>
        <div className="card card-pad">
          <h3 className="site-h3">咨询前准备</h3>
          <ul className="site-checklist">
            <li><Icon name="check" size={16} />找一个安静、不被打扰的空间，准备好耳机</li>
            <li><Icon name="check" size={16} />想一想最希望这次咨询带来什么改变</li>
            <li><Icon name="check" size={16} />可以先完成一份 <Link to="/account/assessments">心理测评</Link>，帮助咨询师了解你</li>
            <li><Icon name="check" size={16} />开始前 24 小时内不可取消，请合理安排时间</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const appt = useAsync(() => api.appointment(id), [id]);
  const [method, setMethod] = useState<PayMethod>('wechat');
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState<PayRes['payment'] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const a = appt.data;
  const left = useCountdown(a?.status === 'pending_payment' ? a.payExpiresAt : null);
  const expired = a?.status === 'pending_payment' && !!a.payExpiresAt && left <= 0;
  useEffect(() => { document.title = '确认订单 · 听屿心理'; }, []);

  if (appt.error) return <div className="site-wrap site-co"><ErrorState error={appt.error} onRetry={appt.reload} /></div>;
  if (!a) return <Loading full />;

  const pay = async () => {
    setPaying(true);
    try { const r = await api.pay(a.id, { method }); setPayment(r.payment); appt.setData(r.appointment); window.scrollTo(0, 0); }
    catch (e) {
      if (e instanceof ApiError && (e.code === 'payment_expired' || e.status === 410)) { toast('订单已超时关闭，请重新选择时间预约'); appt.reload(); }
      else toast(errMsg(e, '支付失败，请重试'));
    } finally { setPaying(false); }
  };
  const cancel = async () => {
    setCancelling(true);
    try { const r = await api.cancel(a.id, { reason: '用户在支付页取消' }); appt.setData(r); setConfirmCancel(false); toast('订单已取消'); }
    catch (e) { toast(errMsg(e, '取消失败')); } finally { setCancelling(false); }
  };

  const paidLike = a.status === 'paid' || a.status === 'in_session' || a.status === 'completed';

  return (
    <div className="site-wrap site-co">
      <div className="site-steps-bar" aria-label="预约进度">
        <span className="done"><i>1</i>选择时间</span><span className="ln" />
        <span className={paidLike ? 'done' : 'on'}><i>2</i>确认支付</span><span className="ln" />
        <span className={paidLike ? 'on' : ''}><i>3</i>预约成功</span>
      </div>

      {paidLike ? <Success a={a} pay={payment} />
        : a.status !== 'pending_payment' || expired ? (
          <div className="card site-co-closed">
            <span className="site-closed-ic"><Icon name="info" size={28} /></span>
            <h1>{expired ? '订单已超时关闭' : `订单${STATUS_LABEL[a.status]}`}</h1>
            <p className="muted">{expired ? '超过 15 分钟未支付，时段已释放。' : a.status === 'refunded' ? '款项将原路退回，1–3 个工作日到账。' : '这笔订单已无法支付。'}你可以重新选择时间预约。</p>
            <OrderSummary a={a} />
            <div className="site-row-gap site-center"><Link className="btn btn-line" to="/account">我的预约</Link><button className="btn btn-blue" type="button" onClick={() => nav(`/counselors/${a.counselor.id}`)}>重新预约</button></div>
          </div>
        ) : (
          <div className="site-co-grid">
            <div className="site-co-main">
              <div className="site-timer" role="timer"><Icon name="clock" size={18} />请在 <b className="num">{mmss(left)}</b> 内完成支付，超时订单将自动取消、时段释放</div>
              <section className="card card-pad"><h2 className="site-h3">订单信息</h2><OrderSummary a={a} />
                <div className="site-kv"><span>订单号</span><span className="num">{a.id}</span><span>下单时间</span><span className="num">{dateTime(a.createdAt)}</span></div>
              </section>
              <section className="card card-pad">
                <h2 className="site-h3">支付方式</h2>
                <div className="site-paym" role="radiogroup" aria-label="支付方式">
                  {METHODS.map((m) => (
                    <label key={m.v} className={`site-pm ${method === m.v ? 'on' : ''}`}>
                      <input type="radio" name="pm" value={m.v} checked={method === m.v} onChange={() => setMethod(m.v)} />
                      <span className={`site-pm-ic site-pm-${m.v}`}><Icon name={m.icon} size={20} /></span>
                      <span><b>{m.l}</b><small>{m.hint}</small></span>
                      <span className="site-radio" aria-hidden="true" />
                    </label>
                  ))}
                </div>
                <p className="muted site-small">演示环境：模拟支付，不会产生真实扣款。</p>
              </section>
            </div>
            <aside className="card card-pad site-co-side">
              <h2 className="site-h3">金额明细</h2>
              <div className="site-bill">
                <div><span>咨询费</span><span className="num">{yuan(a.price)}</span></div>
                <div><span>优惠</span><span className="num site-disc">{a.discount ? `-${yuan(a.discount)}` : '—'}</span></div>
                <div className="site-bill-total"><span>应付</span><span className="price site-price-lg">{yuan(a.amount)}</span></div>
              </div>
              <button type="button" className="btn btn-orange btn-lg btn-block" disabled={paying || expired} onClick={pay}>{paying ? <><span className="spinner site-spin-w" />支付中…</> : `${METHOD_LABEL[method]} ${yuan(a.amount)}`}</button>
              <button type="button" className="btn btn-text btn-block site-mt12" onClick={() => setConfirmCancel(true)}>取消订单</button>
              <ul className="site-assure">
                <li><Icon name="shield" size={14} />担保交易：咨询完成后才结算给咨询师</li>
                <li><Icon name="clock" size={14} />开始前 24 小时可免费取消，全额退款</li>
              </ul>
            </aside>
          </div>
        )}

      {confirmCancel && (
        <Modal title="取消这笔订单？" onClose={() => setConfirmCancel(false)}>
          <p className="muted">取消后时段会被释放，已使用的优惠券将退回账户。</p>
          <div className="site-modal-f"><button className="btn btn-line" type="button" onClick={() => setConfirmCancel(false)}>再想想</button><button className="btn btn-danger" type="button" disabled={cancelling} onClick={cancel}>{cancelling ? '取消中…' : '确认取消'}</button></div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
}
