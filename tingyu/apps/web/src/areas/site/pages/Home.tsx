import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ConsultMode, CounselorQuery } from '@tingyu/shared';
import { ISSUE_TAGS } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { captureRefFromUrl } from '../../../lib/ref';
import { ErrorState, Empty } from '../../../components/states';
import { Icon } from '../components/Icon';
import { CounselorCard, CounselorCardSkeleton } from '../components/CounselorCard';

const CATS = [
  { label: '焦虑与压力', tag: '焦虑', icon: 'pulse', c: 'blue' },
  { label: '情感与婚姻', tag: '亲密关系', icon: 'heart', c: 'pink' },
  { label: '亲子与家庭', tag: '亲子', icon: 'family', c: 'purple' },
  { label: '职场与职业', tag: '职场压力', icon: 'case', c: 'amber' },
  { label: '失眠与睡眠', tag: '失眠', icon: 'moon', c: 'cyan' },
  { label: '情绪低落', tag: '情绪低落', icon: 'leaf', c: 'green' },
  { label: '青少年成长', tag: '青少年', icon: 'sparkle', c: 'orange' },
  { label: '自我成长', tag: '自我成长', icon: 'user', c: 'gray' },
];
const PRICES: Record<string, { priceMin?: number; priceMax?: number }> = { '': {}, lt300: { priceMax: 300 }, '300-500': { priceMin: 300, priceMax: 500 }, gt500: { priceMin: 500 } };
const HOT = ['失眠', '焦虑', '职场压力', '亲密关系', '亲子', '情绪低落'];

type Tab = { key: string; label: string; q: CounselorQuery };
const TABS: Tab[] = [
  { key: 'rec', label: '综合推荐', q: {} },
  { key: 'cheap', label: '300 元以下', q: { priceMax: 300 } },
  { key: 'video', label: '视频咨询', q: { mode: 'video' } },
  { key: 'voice', label: '语音咨询', q: { mode: 'voice' } },
  { key: 'offline', label: '线下面询', q: { mode: 'offline' } },
];

function Finder() {
  const nav = useNavigate();
  const [tag, setTag] = useState('焦虑');
  const [mode, setMode] = useState<ConsultMode | ''>('');
  const [price, setPrice] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (tag) p.set('tag', tag);
    if (mode) p.set('mode', mode);
    const pr = PRICES[price];
    if (pr.priceMin) p.set('priceMin', String(pr.priceMin));
    if (pr.priceMax) p.set('priceMax', String(pr.priceMax));
    nav(`/counselors?${p.toString()}`);
  };
  return (
    <form className="site-finder" onSubmit={submit} role="search">
      <label className="site-ff"><span>困扰类型</span>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">不限</option>
          {ISSUE_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="site-ff"><span>咨询方式</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as ConsultMode | '')}>
          <option value="">不限</option><option value="video">视频</option><option value="voice">语音</option><option value="text">文字</option><option value="offline">线下面询</option>
        </select>
      </label>
      <label className="site-ff"><span>价格</span>
        <select value={price} onChange={(e) => setPrice(e.target.value)}>
          <option value="">不限</option><option value="lt300">300 元以下</option><option value="300-500">300–500 元</option><option value="gt500">500 元以上</option>
        </select>
      </label>
      <button className="btn btn-blue" type="submit"><Icon name="search" />找咨询师</button>
    </form>
  );
}

function Categories() {
  const counts = useAsync(() => Promise.all(CATS.map((c) => api.counselors({ tag: c.tag, pageSize: 1 }).then((r) => r.total).catch(() => null))), []);
  return (
    <div className="site-cats">
      {CATS.map((c, i) => (
        <Link key={c.tag} className="site-cat" to={`/counselors?tag=${encodeURIComponent(c.tag)}`}>
          <span className={`site-cat-ic site-c-${c.c}`}><Icon name={c.icon} size={24} /></span>
          <b>{c.label}</b>
          <span className="site-cat-cnt">{counts.data?.[i] != null ? `${counts.data[i]} 位咨询师` : counts.loading ? '…' : '查看咨询师'}</span>
          <Icon name="right" className="site-cat-arr" />
        </Link>
      ))}
    </div>
  );
}

function TodayCounselors() {
  const [tab, setTab] = useState('rec');
  const [sort, setSort] = useState<CounselorQuery['sort']>('recommended');
  const q = TABS.find((t) => t.key === tab)!.q;
  const list = useAsync(() => api.counselors({ ...q, availableWithinDays: 1, sort, pageSize: 4 }), [tab, sort]);
  const all = useAsync(() => api.counselors({ pageSize: 1 }), []);
  return (
    <section className="site-sec site-wrap" aria-labelledby="h-today">
      <div className="site-sec-h">
        <div><h2 id="h-today">今日可约的咨询师</h2><p>点击时间直接下单，咨询前 24 小时可免费改约</p></div>
        <Link to="/counselors?availableWithinDays=1">查看全部{all.data ? ` ${all.data.total} 位` : ''} →</Link>
      </div>
      <div className="site-ftabs">
        {TABS.map((t) => <button key={t.key} type="button" className={`chip ${tab === t.key ? 'on' : ''}`} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>)}
        <label className="site-sort">排序
          <select value={sort} onChange={(e) => setSort(e.target.value as CounselorQuery['sort'])}>
            <option value="recommended">综合推荐</option><option value="rating">好评优先</option><option value="soonest">最快可约</option><option value="price_asc">价格从低到高</option>
          </select>
        </label>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : list.loading && !list.data ? <div className="site-plist">{[0, 1, 2, 3].map((i) => <CounselorCardSkeleton key={i} />)}</div>
        : list.data && list.data.items.length === 0 ? <Empty title="今天这个条件下暂无可约咨询师" hint="换个筛选条件，或查看未来几天的时间" action={<Link className="btn btn-soft" to="/counselors">查看全部咨询师</Link>} />
        : <div className={`site-plist ${list.loading ? 'site-dim' : ''}`}>{list.data?.items.map((c) => <CounselorCard key={c.id} c={c} />)}</div>}
    </section>
  );
}

export default function Home() {
  useEffect(() => { captureRefFromUrl(); document.title = '听屿心理 · 找到适合你的心理咨询师'; }, []);
  const today = useAsync(() => api.counselors({ availableWithinDays: 1, pageSize: 1 }), []);
  return (
    <div className="site-home">
      <section className="site-hero">
        <div className="site-wrap site-hero-in">
          <div>
            <span className="site-kicker"><b>●</b> {today.data ? `今日可约咨询师 ${today.data.total} 位` : '今日可约咨询师'} · 最快 1 小时内开始</span>
            <h1>找到<em>适合你</em>的<br />心理咨询师</h1>
            <p className="site-lead">持证咨询师，视频 / 语音 / 面询任你选。看资质、看评价、看可约时间，在线下单，平台担保。</p>
            <Finder />
            <div className="site-hot">热门：{HOT.map((t) => <Link key={t} to={`/counselors?tag=${encodeURIComponent(t)}`}>{t}</Link>)}</div>
          </div>
          <div className="site-visual">
            <div className="site-photo" role="img" aria-label="一位来访者在明亮的咨询室里与咨询师交谈" />
            <div className="site-float site-f-book"><img src="/assets/u-asian-woman.jpg" alt="" /><div><b>周女士 刚刚预约成功</b>林知夏 · 明天 20:00 · 语音</div><span className="site-ok"><Icon name="check" size={14} stroke={2.6} /></span></div>
            <div className="site-float site-f-ai">
              <span className="site-orb-sm"><Icon name="mic" /></span>
              <b>不知道选哪位老师？</b>
              <span>和 AI 助理小屿语音聊 3 分钟，免费帮你匹配</span>
              <Link className="btn btn-blue" to="/intake">免费语音接待助理</Link>
            </div>
            <div className="site-float site-f-rate"><b>4.9</b><div><span className="site-stars">★★★★★</span><span>来自真实来访者评价</span></div></div>
          </div>
        </div>
      </section>

      <div className="site-wrap site-stats">
        <div className="site-statbox">
          <div><span className="site-ic"><Icon name="users" /></span><div><b>2,860</b><span>持证咨询师 · 录取率 2%</span></div></div>
          <div><span className="site-ic"><Icon name="clock" /></span><div><b>120 万+</b><span>累计咨询服务小时</span></div></div>
          <div><span className="site-ic"><Icon name="star" /></span><div><b>98.6%</b><span>来访者好评率</span></div></div>
          <div><span className="site-ic"><Icon name="shield" /></span><div><b>担保交易</b><span>咨询完成后才结算给咨询师</span></div></div>
        </div>
        <p className="site-note">平台数据为示意</p>
      </div>

      <section className="site-sec site-wrap" aria-labelledby="h-cats">
        <div className="site-sec-h"><div><h2 id="h-cats">按困扰找咨询师</h2><p>选择你最想解决的问题，看擅长这个方向的老师</p></div><Link to="/counselors">全部分类 →</Link></div>
        <Categories />
      </section>

      <TodayCounselors />

      <section className="site-sec site-wrap" aria-labelledby="h-steps">
        <div className="site-sec-h"><div><h2 id="h-steps">4 步开始一次咨询</h2><p>从打开网页到见到咨询师，最快当天完成</p></div></div>
        <div className="site-steps">
          <div className="site-step"><div className="site-step-n">1</div><span className="badge badge-green">免费</span><h3>和 AI 助理聊聊</h3><p>语音说出你的困扰，小屿帮你理清问题、完成初步筛查，不知道选谁也没关系。</p><Link to="/intake">开始语音接待 →</Link></div>
          <div className="site-step"><div className="site-step-n">2</div><h3>选择咨询师</h3><p>按困扰、价格、时间筛选，查看资质证书和真实评价，小屿会给出推荐。</p><Link to="/counselors">浏览咨询师 →</Link></div>
          <div className="site-step"><div className="site-step-n">3</div><span className="badge">担保交易</span><h3>预约并支付</h3><p>选好时间在线支付，咨询完成后才结算给咨询师；24 小时前可免费改约。</p></div>
          <div className="site-step"><div className="site-step-n">4</div><h3>开始咨询</h3><p>按时进入视频或语音咨询室，也可到线下门店面询；咨询内容全程保密。</p></div>
        </div>
      </section>

      <section className="site-sec site-wrap" aria-labelledby="h-svc">
        <div className="site-sec-h"><div><h2 id="h-svc">服务与价格</h2><p>价格透明，下单前就能看到</p></div></div>
        <div className="site-svcs">
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/session-window.jpg)' }} /><div className="site-svc-bd"><h3>一对一心理咨询</h3><p>持证咨询师，视频 / 语音 / 面询，50 分钟一次。</p><div className="site-svc-pr"><b>¥300<small>起 / 次</small></b><Link to="/counselors">去预约 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/headphones.jpg)' }} /><div className="site-svc-bd"><h3>AI 语音接待</h3><p>小屿 24 小时在线，帮你梳理困扰、初步筛查并匹配咨询师。</p><div className="site-svc-pr"><b>免费</b><Link to="/intake">去聊聊 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/notebook-pen.jpg)' }} /><div className="site-svc-bd"><h3>专业心理测评</h3><p>PHQ-9 抑郁、GAD-7 焦虑、ISI 失眠等标准化量表。</p><div className="site-svc-pr"><b>免费</b><Link to="/account/assessments">去测评 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/team-highfive.jpg)' }} /><div className="site-svc-bd"><h3>企业 EAP</h3><p>员工心理福利、管理者培训、危机干预，按人数定制。</p><div className="site-svc-pr"><b>定制<small>方案</small></b><span className="muted">敬请期待</span></div></div></article>
        </div>

        <div className="site-guar">
          <div><span className="site-gic"><Icon name="shield" /></span><b>资质严格审核</b><span>证书核验 + 面试 + 督导，录取率 2%</span></div>
          <div><span className="site-gic"><Icon name="lock" /></span><b>隐私加密保护</b><span>咨询内容只有你和咨询师可见</span></div>
          <div><span className="site-gic"><Icon name="card" /></span><b>不满意可退款</b><span>咨询前 24 小时取消全额退款</span></div>
          <div><span className="site-gic site-gic-r"><Icon name="phone" /></span><b>危机干预通道</b><span>识别到风险立即提示 12356 与值班咨询师</span></div>
        </div>

        <div className="site-appband">
          <div className="site-appband-txt">
            <h2>下载听屿心理 App</h2>
            <p>随时预约、视频咨询、AI 助理 24 小时在线。新用户首单立减 100 元。</p>
            <div className="site-dl">
              <Link className="site-store" to="/m"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.3c.9-1.3 1.2-2.5 1.2-2.6 0 0-2.3-.9-2.3-3.8ZM14.2 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.6-1.3Z" /></svg><span><small>Download on the</small><b>App Store</b></span></Link>
              <Link className="site-store" to="/m"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7.2 4.2 4 2.4v19.2l3.2-1.8V4.2Zm1.6.9v13.8L19.6 12 8.8 5.1Z" /></svg><span><small>安卓应用市场</small><b>Android 下载</b></span></Link>
              <Link className="site-store site-store-h5" to="/m"><Icon name="phone" /><span><small>无需安装</small><b>打开手机网页版</b></span></Link>
            </div>
          </div>
          <div className="site-appband-ph"><div className="site-dev"><img src="/assets/shot-app-home-d3.jpg" alt="听屿心理 App 首页截图" /></div></div>
        </div>
      </section>
    </div>
  );
}
