// /m/checkout/:id — confirm & pay (simulated), then the success page.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Appointment, PayMethod } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, range, relDay, time, yuan } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../icons';
import { BottomBar, errMsg, invalidateUnread, mmss, NavBar, Spin, useCountdown } from '../ui';

export default function Checkout() {
  const { id = '' } = useParams();
  const a = useAsync(() => api.appointment(id), [id]);
  if (a.loading && !a.data) return <><NavBar title="确认支付" /><Loading full /></>;
  if (a.error || !a.data) return <><NavBar title="确认支付" /><ErrorState error={new Error(errMsg(a.error, '订单加载失败'))} onRetry={a.reload} /></>;
  if (a.data.status === 'pending_payment') return <PayView a={a.data} onPaid={(x) => a.setData(x)} onExpired={a.reload} />;
  if (a.data.status === 'paid' || a.data.status === 'in_session') return <Success a={a.data} />;
  return (
    <>
      <NavBar title="订单状态" />
      <div className="st st-full"><b>{a.data.status === 'cancelled' ? '订单已取消' : a.data.status === 'refunded' ? '订单已退款' : '订单已完成'}</b>
        <span>{a.data.status === 'cancelled' ? '超时未支付的订单会自动取消，时段已释放' : '可以在「我的预约」查看详情'}</span>
        <div className="m-row-gap"><Link className="btn btn-line btn-pill" to={`/m/orders/${a.data.id}`}>查看订单</Link><Link className="btn btn-blue btn-pill" to={`/m/counselors/${a.data.counselor.id}?book=1`}>重新预约</Link></div>
      </div>
    </>
  );
}

const METHODS: { v: PayMethod; label: string; sub: string; cls: string; ch: string }[] = [
  { v: 'wechat', label: '微信支付', sub: '推荐使用', cls: 'wx', ch: '微' },
  { v: 'alipay', label: '支付宝', sub: '支持花呗', cls: 'ali', ch: '支' },
];

function PayView({ a, onPaid, onExpired }: { a: Appointment; onPaid: (a: Appointment) => void; onExpired: () => void }) {
  const toast = useToast();
  const left = useCountdown(a.payExpiresAt);
  const [method, setMethod] = useState<PayMethod>('wechat');
  const [busy, setBusy] = useState(false);
  const expired = !!a.payExpiresAt && left <= 0;
  useEffect(() => { if (expired) { const t = window.setTimeout(onExpired, 1500); return () => window.clearTimeout(t); } }, [expired, onExpired]);

  const pay = async () => {
    setBusy(true);
    try { const r = await api.pay(a.id, { method }); invalidateUnread(); onPaid(r.appointment); }
    catch (e) {
      if (e instanceof ApiError && (e.code === 'payment_expired' || e.status === 410)) { toast('支付已超时，订单已取消'); onExpired(); }
      else toast(errMsg(e, '支付失败，请重试'));
    } finally { setBusy(false); }
  };

  return (
    <div className="m-checkout">
      <NavBar title="确认支付" />
      <div className={`m-pay-timer${expired ? ' off' : ''}`}>
        <Icon name="clock" size={16} />{expired ? '支付已超时，订单将自动取消' : <>请在 <b className="num">{mmss(left)}</b> 内完成支付，超时时段将被释放</>}
      </div>
      <section className="m-card m-order-cc">
        <img className="avatar" src={a.counselor.avatar} alt="" width={52} height={52} />
        <div><b>{a.counselor.name}</b><small>{a.counselor.title}</small></div>
        <span className="badge">{modeLabel(a.mode)}咨询</span>
      </section>
      <section className="m-card">
        <div className="m-kv">
          <div><span>咨询时间</span><span>{range(a.startAt, a.endAt)}</span></div>
          <div><span>咨询方式</span><span>{modeLabel(a.mode)} · 50 分钟</span></div>
          <div><span>接待小结</span><span>{a.intakeSessionId ? (a.shareIntake ? '已授权咨询师查看' : '不同步') : '无'}</span></div>
          <div><span>咨询费用</span><span className="num">{yuan(a.price)}</span></div>
          <div><span>优惠券</span><span className="num" style={{ color: a.discount ? 'var(--orange)' : undefined }}>{a.discount ? `-${yuan(a.discount)}` : '未使用'}</span></div>
          <div className="total"><span>实付金额</span><span>{yuan(a.amount)}</span></div>
        </div>
      </section>
      <section className="m-card">
        <h3>支付方式</h3>
        <div className="m-pay-methods" role="radiogroup" aria-label="支付方式">
          {METHODS.map((m) => (
            <button key={m.v} type="button" role="radio" aria-checked={method === m.v} className={`m-pay-m${method === m.v ? ' on' : ''}`} onClick={() => setMethod(m.v)}>
              <span className={`m-pay-logo ${m.cls}`}>{m.ch}</span><span className="m-pay-t"><b>{m.label}</b><small>{m.sub}</small></span><i className="m-radio" />
            </button>
          ))}
        </div>
      </section>
      <p className="m-note"><Icon name="shield" size={14} />平台担保交易：咨询开始前 24 小时以上可免费取消，全额原路退回。当前为演示环境，支付为模拟，不会产生真实扣款。</p>
      <BottomBar>
        <div className="m-bbar-price"><span className="m-price num" style={{ marginLeft: 0 }}>{yuan(a.amount)}</span>{a.discount > 0 && <small>已优惠 {yuan(a.discount)}</small>}</div>
        <button type="button" className="btn btn-blue btn-lg m-bbar-main" disabled={busy || expired} onClick={pay}>{busy && <Spin />}{method === 'wechat' ? '微信支付' : '支付宝支付'} {yuan(a.amount)}</button>
      </BottomBar>
      {toast.node}
    </div>
  );
}

function Success({ a }: { a: Appointment }) {
  const nav = useNavigate();
  return (
    <div className="m-success">
      <NavBar title="预约成功" back="/m" />
      <section className="m-success-hero">
        <span className="m-success-ic"><Icon name="check" size={34} /></span>
        <h1>预约成功</h1>
        <p>{relDay(a.startAt)} {time(a.startAt)} 与 {a.counselor.name} 的{modeLabel(a.mode)}咨询</p>
      </section>
      <section className="m-card">
        <div className="m-order-cc flat">
          <img className="avatar" src={a.counselor.avatar} alt="" width={44} height={44} />
          <div><b>{a.counselor.name}</b><small>{a.counselor.title}</small></div>
        </div>
        <div className="m-kv" style={{ marginTop: 12 }}>
          <div><span>咨询时间</span><span>{range(a.startAt, a.endAt)}</span></div>
          <div><span>咨询方式</span><span>{modeLabel(a.mode)} · 50 分钟</span></div>
          <div><span>实付金额</span><span className="num">{yuan(a.amount)}</span></div>
        </div>
      </section>
      <section className="m-card">
        <h3>咨询前准备</h3>
        <ul className="m-checklist">
          <li><Icon name="checkCircle" size={18} />找一个安静、私密、不会被打扰的空间</li>
          <li><Icon name="checkCircle" size={18} />准备耳机，检查网络和麦克风{a.mode === 'video' ? '、摄像头' : ''}</li>
          <li><Icon name="checkCircle" size={18} />想一想这次最想聊的一两件事，可以先记下来</li>
          {a.shareIntake && <li><Icon name="checkCircle" size={18} />咨询师会提前查看你的接待小结</li>}
        </ul>
      </section>
      <section className="m-card m-room-tip">
        <span className="m-li-ic c1"><Icon name="video" size={18} /></span>
        <div><b>如何进入咨询室</b><small>开始前 10 分钟，在「我的预约」或首页点击「进入咨询室」。咨询开始前我们会发送提醒。</small></div>
      </section>
      <div className="m-success-btns">
        <button type="button" className="btn btn-line btn-lg" onClick={() => nav(`/m/orders/${a.id}`, { replace: true })}>查看订单</button>
        <button type="button" className="btn btn-blue btn-lg" onClick={() => nav('/m', { replace: true })}>返回首页</button>
      </div>
    </div>
  );
}
