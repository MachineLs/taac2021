// /creator — 达人数据看板与推广链接 (F4).
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CreatorStats } from '@tingyu/shared';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useAsync } from '../../lib/useAsync';
import { dateTime, yuan } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Empty, ErrorState, Loading } from '../../components/states';
import { Funnel, QrMark, TrendMultiples } from './charts';
import { asError, compact } from './lib';

const SECTIONS = [
  { id: 'cr-overview', label: '数据概览' },
  { id: 'cr-links', label: '推广链接' },
  { id: 'cr-trend', label: '趋势与转化' },
  { id: 'cr-commissions', label: '佣金明细' },
  { id: 'cr-rules', label: '合作规则' },
];

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.creatorStats(), []);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const onLogout = () => { logout(); nav('/login?next=%2Fcreator', { replace: true }); };

  return (
    <div className="cr">
      <aside className="cr-side" aria-label="达人中心导航">
        <Link to="/creator" className="cr-logo"><span className="cr-logo-mark">屿</span><span><b>听屿</b><small>达人中心</small></span></Link>
        <nav className="cr-nav">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="cr-nav-item">{s.label}</a>)}
        </nav>
        <div className="cr-side-foot">
          <p>达人只做心理科普与引导，<br />不做咨询、不承诺疗效。</p>
          <a href="/">返回官网</a>
        </div>
      </aside>
      <div className="cr-main">
        <header className="cr-top">
          <Link to="/creator" className="cr-logo cr-logo-top"><span className="cr-logo-mark">屿</span><b>达人中心</b></Link>
          <h1 className="cr-top-title">数据看板</h1>
          <div className="cr-top-right">
            {user?.avatar && <img className="avatar" src={user.avatar} alt="" width={30} height={30} />}
            <span className="cr-me-name">{user?.name}</span>
            <button type="button" className="btn btn-line btn-sm" onClick={onLogout}>退出</button>
          </div>
        </header>
        <main className="cr-content">
          {!data && loading ? <Loading full label="正在加载推广数据…" /> : !data ? <ErrorState error={asError(error)} onRetry={reload} /> : <Body s={data} toast={toast} />}
        </main>
      </div>
      {toast.node}
    </div>
  );
}

function Body({ s, toast }: { s: CreatorStats; toast: (m: string) => void }) {
  const c = s.creator;
  const rate = Math.round(c.commissionRate * 100);
  const [showAll, setShowAll] = useState(false);
  const commissions = [...s.commissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = showAll ? commissions : commissions.slice(0, 8);
  const settled = s.commissionTotal - s.commissionPending;

  return (
    <div className="cr-page">
      <section id="cr-overview" className="cr-hero">
        <div className="card cr-profile">
          <img className="avatar" src={c.avatar} alt="" width={64} height={64} />
          <div className="cr-profile-main">
            <div className="cr-profile-name"><h2>{c.name}</h2><span className={`tag ${c.platform === '小红书' ? 'cr-tag-pink' : 'cr-tag-ink'}`}>{c.platform}</span></div>
            <p>{c.bio}</p>
            <ul className="cr-profile-meta">
              <li><b className="num">{compact(c.followers)}</b><span>粉丝</span></li>
              <li><b className="num">{c.refCode}</b><span>邀请码</span></li>
              <li><b className="num">{rate}%</b><span>首单分成</span></li>
            </ul>
          </div>
        </div>
        <div id="cr-links" className="card cr-links">
          <div className="cr-links-main">
            <h2 className="cr-h2">我的推广链接</h2>
            <p className="cr-sub">粉丝通过链接注册，30 天内完成首单即计入你的分成。发布时请标注「广告」。</p>
            <CopyRow label="App / H5" value={`${location.origin}/m/r/${c.refCode}`} toast={toast} primary />
            <CopyRow label="网站（桌面）" value={`${location.origin}/r/${c.refCode}`} toast={toast} />
          </div>
          <figure className="cr-qr-box">
            <QrMark text={`${location.origin}/m/r/${c.refCode}`} />
            <figcaption>示意二维码<br /><span>请以上方链接为准</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="cr-kpis" aria-label="核心数据">
        <Kpi label="落地页访问" value={compact(s.visits)} sub="累计带 ref 的访问" />
        <Kpi label="注册用户" value={compact(s.signups)} sub={`访问→注册 ${s.visits ? ((s.signups / s.visits) * 100).toFixed(1) : '0.0'}%`} />
        <Kpi label="AI 接待" value={compact(s.intakes)} sub="归因用户发起的接待" />
        <Kpi label="新客首单" value={compact(s.firstOrders)} sub="已支付的首单" />
        <Kpi label="佣金合计" value={yuan(s.commissionTotal)} sub={`已结算 ${yuan(settled)}`} accent />
        <Kpi label="待结算" value={yuan(s.commissionPending)} sub="次月 15 日前结算" />
      </section>

      <section id="cr-trend" className="cr-grid">
        <div className="card cr-card cr-span-2">
          {s.daily.length ? <TrendMultiples daily={s.daily} /> : <Empty title="近 30 天暂无数据" hint="发布带推广链接的内容后，这里会显示每日访问与转化" />}
        </div>
        <div className="card cr-card">
          <h2 className="cr-h2">转化漏斗</h2>
          <p className="cr-sub">累计数据 · 条形长度按访问量等比例</p>
          <Funnel stats={s} />
        </div>
      </section>

      <section id="cr-commissions" className="card cr-card cr-table-card">
        <div className="cr-card-head">
          <div><h2 className="cr-h2">佣金明细</h2><p className="cr-sub">共 {s.commissions.length} 笔 · 待结算 <b className="num">{yuan(s.commissionPending)}</b></p></div>
        </div>
        {commissions.length === 0 ? <Empty title="还没有佣金记录" hint="粉丝通过你的链接完成首单后，会在这里看到分成" /> : (
          <>
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead><tr><th>订单号</th><th className="r">佣金</th><th>状态</th><th>时间</th></tr></thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id}>
                      <td><code className="cr-code">{m.appointmentId}</code></td>
                      <td className="r"><b className="num">{yuan(m.amount)}</b></td>
                      <td>{m.status === 'settled' ? <span className="badge badge-green">已结算</span> : <span className="badge badge-gold">待结算</span>}</td>
                      <td className="num cr-nowrap">{dateTime(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {commissions.length > 8 && (
              <div className="cr-more"><button type="button" className="btn btn-text" onClick={() => setShowAll((v) => !v)}>{showAll ? '收起' : `查看全部 ${commissions.length} 笔`}</button></div>
            )}
          </>
        )}
      </section>

      <section id="cr-rules" className="card cr-card cr-rules">
        <h2 className="cr-h2">合作规则</h2>
        <div className="cr-rules-grid">
          <div>
            <h3>分成与结算</h3>
            <ul>
              <li>通过你的链接注册的<b>新客首单</b>，按实付金额 <b>{rate}%</b> 分成</li>
              <li>同一用户的<b>复购订单不分成</b>；订单退款时对应佣金取消</li>
              <li>佣金<b>按月结算</b>，每月 15 日前结清上月已完成订单的佣金</li>
            </ul>
          </div>
          <div>
            <h3>内容规范</h3>
            <ul>
              <li>达人只做心理<b>科普与引导</b>，不提供心理咨询或诊断</li>
              <li><b>不承诺疗效</b>，不使用「治愈」「根治」等表述</li>
              <li>推广内容须<b>明确标注「广告」</b>，不得冒用咨询师身份</li>
            </ul>
          </div>
          <div className="cr-rules-safe">
            <h3>遇到危机信号</h3>
            <p>如粉丝在评论或私信中流露伤害自己的想法，请勿自行处理，引导其拨打全国心理援助热线 <b className="num">12356</b>，紧急情况拨打 <b className="num">120 / 110</b>。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`cr-kpi${accent ? ' cr-kpi-accent' : ''}`}>
      <span className="cr-kpi-label">{label}</span>
      <b className="cr-kpi-value">{value}</b>
      <span className="cr-kpi-sub">{sub}</span>
    </div>
  );
}

function CopyRow({ label, value, toast, primary }: { label: string; value: string; toast: (m: string) => void; primary?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setCopied(true); toast('链接已复制'); window.setTimeout(() => setCopied(false), 1800);
    } catch {
      ref.current?.focus(); ref.current?.select();
      toast('已选中链接，请按 Ctrl+C（或长按）复制');
    }
  };
  return (
    <div className="cr-copy">
      <span className="cr-copy-label">{label}</span>
      <div className="cr-copy-row">
        <input ref={ref} className="input cr-copy-input" readOnly value={value} aria-label={`${label}推广链接`} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={`btn ${primary ? 'btn-blue' : 'btn-soft'}`} onClick={copy}>{copied ? '已复制' : '复制链接'}</button>
      </div>
    </div>
  );
}
