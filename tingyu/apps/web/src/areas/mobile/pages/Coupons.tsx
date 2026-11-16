// /m/coupons — my coupons + redeem by code.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserCoupon } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { monthDay } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { errMsg, NavBar, Spin } from '../ui';

const TABS: { k: UserCoupon['status']; label: string }[] = [{ k: 'unused', label: '可使用' }, { k: 'used', label: '已使用' }, { k: 'expired', label: '已过期' }];

export default function Coupons() {
  const toast = useToast();
  const list = useAsync(() => api.myCoupons(), []);
  const [tab, setTab] = useState<UserCoupon['status']>('unused');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const redeem = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    try { await api.claimCoupon(c.trim().toUpperCase()); toast('领取成功'); setCode(''); setTab('unused'); list.reload(); }
    catch (e) { toast(e instanceof ApiError && e.status === 409 ? '已经领取过这张券了' : e instanceof ApiError && e.status === 404 ? '兑换码不存在' : errMsg(e, '领取失败')); }
    finally { setBusy(false); }
  };
  const items = (list.data ?? []).filter((c) => (c.status === 'unused' && new Date(c.expiresAt).getTime() < Date.now() ? 'expired' : c.status) === tab);
  const hasNew = list.data?.some((c) => c.amount === 100 || /新人/.test(c.title));
  return (
    <>
      <NavBar title="优惠券" />
      <form className="m-redeem" onSubmit={(e) => { e.preventDefault(); redeem(code); }}>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="输入兑换码，如 WEEK50" aria-label="兑换码" autoCapitalize="characters" />
        <button type="submit" className="btn btn-blue" disabled={busy || !code.trim()}>{busy && <Spin />}兑换</button>
      </form>
      {list.data && !hasNew && (
        <div className="m-coupon m-coupon-in">
          <div className="m-coupon-amt num"><span><small>¥</small>100</span></div>
          <div className="m-coupon-txt"><b>新人首单立减 100 元</b><span>满 300 可用 · 7 天内有效</span></div>
          <button type="button" className="m-coupon-btn" onClick={() => redeem('NEW100')} disabled={busy}>立即领取</button>
        </div>
      )}
      <div className="m-pill-tabs" role="tablist" style={{ marginTop: 12 }}>
        {TABS.map((t) => <button key={t.k} type="button" role="tab" aria-selected={t.k === tab} className={t.k === tab ? 'on' : ''} onClick={() => setTab(t.k)}>{t.label}</button>)}
      </div>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState error={new Error(errMsg(list.error, '加载失败'))} onRetry={list.reload} />
        : !items.length ? <Empty title={`没有${TABS.find((t) => t.k === tab)!.label}的优惠券`} />
        : (
          <div className="m-stack">
            {items.map((c) => (
              <div key={c.id} className={`m-cp${tab !== 'unused' ? ' off' : ''}`}>
                <div className="m-cp-amt num"><b><small>¥</small>{c.amount}</b><span>满 {c.minSpend} 可用</span></div>
                <div className="m-cp-main"><b>{c.title}</b><small>{monthDay(c.expiresAt)}前有效 · 全部咨询师可用</small></div>
                {tab === 'unused' ? <Link to="/m/counselors" className="btn btn-sm btn-pill m-btn-orange">去使用</Link> : <span className="m-cp-st">{tab === 'used' ? '已使用' : '已过期'}</span>}
              </div>
            ))}
          </div>
        )}
      {toast.node}
    </>
  );
}
