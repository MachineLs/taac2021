// /m/me — profile, stats, coupons, entry list.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HOTLINES } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dayKey } from '../../../lib/format';
import { Icon, type IconName } from '../icons';
import { ConfirmSheet, intakeStore, Sheet, TabPage } from '../ui';

const maskPhone = (p: string) => (/^\d{11}$/.test(p) ? `${p.slice(0, 3)}****${p.slice(7)}` : p);

export default function Me() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [out, setOut] = useState(false);
  const [help, setHelp] = useState(false);
  const stats = useAsync(async () => {
    if (!user) return null;
    const [appts, moods, results, coupons] = await Promise.allSettled([api.appointments(), api.moods(30), api.assessmentResults(), api.myCoupons()]);
    const A = appts.status === 'fulfilled' ? appts.value : [];
    return {
      sessions: A.filter((a) => a.status === 'completed').length,
      upcoming: A.filter((a) => a.status === 'paid' || a.status === 'in_session').length,
      pending: A.filter((a) => a.status === 'pending_payment').length,
      toReview: A.filter((a) => a.status === 'completed' && !a.reviewed).length,
      days: moods.status === 'fulfilled' ? new Set(moods.value.map((m) => dayKey(m.createdAt))).size : 0,
      tests: results.status === 'fulfilled' ? results.value.length : 0,
      coupons: coupons.status === 'fulfilled' ? coupons.value.filter((c) => c.status === 'unused').length : 0,
    };
  }, [user?.id]);
  const s = stats.data;

  const ENTRIES: { to: string; label: string; icon: IconName; c: string; v?: string }[] = [
    { to: '/m/orders', label: '我的预约', icon: 'calendar', c: 'c1', v: s?.upcoming ? `${s.upcoming} 个待咨询` : undefined },
    { to: '/m/assess', label: '心理测评', icon: 'doc', c: 'c3' },
    { to: '/m/mood', label: '情绪日记', icon: 'smile', c: 'c6' },
    { to: '/m/intakes', label: '接待记录', icon: 'sparkle', c: 'c5' },
    { to: '/m/coupons', label: '优惠券', icon: 'ticket', c: 'c2', v: s?.coupons ? `${s.coupons} 张可用` : undefined },
  ];

  return (
    <TabPage className="m-me">
      <section className="m-me-head">
        {user ? (
          <div className="m-me-user">
            {user.avatar ? <img className="avatar" src={user.avatar} alt="" width={64} height={64} /> : <span className="m-me-av">{user.name.slice(0, 1)}</span>}
            <div><h1>{user.name}</h1><span>{maskPhone(user.phone)}</span></div>
          </div>
        ) : (
          <Link to="/m/login?next=/m/me" className="m-me-user">
            <span className="m-me-av"><Icon name="user" size={30} /></span>
            <div><h1>登录 / 注册</h1><span>登录后享新人首单立减 100 元</span></div>
            <Icon name="right" size={18} />
          </Link>
        )}
        <div className="m-me-stats">
          <Link to="/m/orders?tab=done"><b className="num">{s?.sessions ?? '–'}</b><span>咨询次数</span></Link>
          <Link to="/m/mood"><b className="num">{s?.days ?? '–'}</b><span>打卡天数</span></Link>
          <Link to="/m/assess"><b className="num">{s?.tests ?? '–'}</b><span>测评份数</span></Link>
          <Link to="/m/coupons"><b className="num">{s?.coupons ?? '–'}</b><span>优惠券</span></Link>
        </div>
      </section>

      <section className="m-card m-me-orders">
        <div className="m-card-h">我的预约<Link to="/m/orders">全部<Icon name="right" size={14} /></Link></div>
        <div className="m-me-ord">
          {[
            { k: 'pending', label: '待支付', icon: 'wallet' as IconName, n: s?.pending },
            { k: 'upcoming', label: '待咨询', icon: 'calendar' as IconName, n: s?.upcoming },
            { k: 'done', label: '待评价', icon: 'star' as IconName, n: s?.toReview },
            { k: 'cancelled', label: '退款/取消', icon: 'refresh' as IconName },
          ].map((x) => (
            <Link key={x.k} to={user ? `/m/orders?tab=${x.k}` : '/m/login?next=/m/orders'}><span><Icon name={x.icon} size={24} />{!!x.n && <i className="num">{x.n}</i>}</span>{x.label}</Link>
          ))}
        </div>
      </section>

      <Link to="/m/voice" className="m-me-ai">
        <span className="m-conv-ic c1"><Icon name="mic" size={20} /></span>
        <div><b>和小屿聊聊</b><small>最近感觉怎么样？3 分钟帮你理清困扰</small></div>
        <Icon name="right" size={16} />
      </Link>

      <nav className="m-list">
        {ENTRIES.map((e) => (
          <Link key={e.to} to={user ? e.to : `/m/login?next=${encodeURIComponent(e.to)}`}>
            <span className={`m-li-ic ${e.c}`}><Icon name={e.icon} size={18} /></span><span className="m-li-t">{e.label}</span>{e.v && <span className="m-li-v">{e.v}</span>}<Icon name="right" size={16} />
          </Link>
        ))}
      </nav>
      <nav className="m-list">
        <button type="button" onClick={() => setHelp(true)}><span className="m-li-ic c9"><Icon name="life" size={18} /></span><span className="m-li-t">心理援助热线</span><span className="m-li-v">12356</span><Icon name="right" size={16} /></button>
        <a href="/"><span className="m-li-ic c8"><Icon name="home" size={18} /></span><span className="m-li-t">访问听屿网站</span><Icon name="right" size={16} /></a>
        {user && <button type="button" onClick={() => setOut(true)}><span className="m-li-ic c8"><Icon name="logout" size={18} /></span><span className="m-li-t">退出登录</span><Icon name="right" size={16} /></button>}
      </nav>
      <p className="m-foot-note">听屿心理 · 持证咨询师在线咨询<br />AI 助理小屿只做接待、初筛与匹配，不做诊断和治疗</p>

      <ConfirmSheet open={out} onClose={() => setOut(false)} title="退出登录？" confirm="退出" tone="danger" body="退出后需要重新输入手机验证码登录。"
        onConfirm={() => { logout(); intakeStore.set(null); setOut(false); nav('/m'); }} />
      <Sheet open={help} onClose={() => setHelp(false)} title="心理援助热线">
        <p className="m-sheet-hint">如果你正处在危机中，或有伤害自己的念头，请立即拨打：</p>
        <div className="m-hotlines">{HOTLINES.map((h) => <a key={h.number} href={`tel:${h.number.split(' ')[0]}`}><b>{h.name}</b><span className="num">{h.number}</span><small>{h.note}</small></a>)}</div>
      </Sheet>
    </TabPage>
  );
}
