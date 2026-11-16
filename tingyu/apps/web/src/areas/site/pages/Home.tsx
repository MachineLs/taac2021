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
  { label: '焦虑与压力', tag: '焦虑', icon: 'pulse', c: 'blue', desc: '紧张担心、停不下来' },
  { label: '情感与婚姻', tag: '亲密关系', icon: 'heart', c: 'pink', desc: '亲密关系、分手、婚姻' },
  { label: '亲子与家庭', tag: '亲子', icon: 'family', c: 'purple', desc: '育儿、沟通、家庭矛盾' },
  { label: '职场与职业', tag: '职场压力', icon: 'case', c: 'amber', desc: '倦怠、人际、职业选择' },
  { label: '失眠与睡眠', tag: '失眠', icon: 'moon', c: 'cyan', desc: '入睡难、早醒、多梦' },
  { label: '情绪低落', tag: '情绪低落', icon: 'leaf', c: 'green', desc: '提不起劲、容易难过' },
  { label: '青少年成长', tag: '青少年', icon: 'sparkle', c: 'orange', desc: '厌学、叛逆、社交' },
  { label: '自我成长', tag: '自我成长', icon: 'user', c: 'gray', desc: '自我探索、方向迷茫' },
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
  return (
    <div className="site-cats">
      {CATS.map((c) => (
        <Link key={c.tag} className="site-cat" to={`/counselors?tag=${encodeURIComponent(c.tag)}`}>
          <span className={`site-cat-ic site-c-${c.c}`}><Icon name={c.icon} size={24} /></span>
          <b>{c.label}</b>
          <span className="site-cat-cnt">{c.desc}</span>
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
  return (
    <section className="site-sec site-wrap" aria-labelledby="h-today">
      <div className="site-sec-h">
        <div><h2 id="h-today">今日可约的咨询师</h2><p>点击时间直接下单，咨询前 24 小时可免费改约</p></div>
        <Link to="/counselors">查看全部咨询师 →</Link>
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
            <span className="site-kicker"><b>●</b> 持证心理咨询师 · 在线预约 · 平台担保</span>
            <h1>找到<em>适合你</em>的<br />心理咨询师</h1>
            <p className="site-lead">持证咨询师，视频 / 语音 / 面询任你选。看资质、看评价、看可约时间，在线下单，平台担保。</p>
            <Finder />
            <div className="site-hot">热门：{HOT.map((t) => <Link key={t} to={`/counselors?tag=${encodeURIComponent(t)}`}>{t}</Link>)}</div>
            <Link className="site-ai-line" to="/intake">
              <span className="site-orb-sm"><Icon name="mic" size={16} /></span>
              <span><b>不知道选哪位老师？</b>和 AI 助理小屿语音聊 3 分钟，免费帮你匹配</span>
              <Icon name="right" />
            </Link>
          </div>
          <div className="site-visual">
            <div className="site-photo" role="img" aria-label="一位来访者在明亮的咨询室里与咨询师交谈" />
            <div className="site-float site-f-book"><span className="site-ok"><Icon name="check" size={14} stroke={2.6} /></span><div><b>咨询师资质已核验</b>证书 · 面试 · 督导，三重审核</div></div>
            <div className="site-float site-f-today"><b className="num">{today.data ? today.data.total : '–'}</b><div><strong>位咨询师今日可约</strong><span>最快 1 小时内开始</span></div></div>
          </div>
        </div>
      </section>

      <div className="site-wrap site-stats">
        <div className="site-statbox">
          <div><span className="site-ic"><Icon name="shield" /></span><div><b>100% 持证</b><span>证书核验 + 面试 + 持续督导</span></div></div>
          <div><span className="site-ic"><Icon name="lock" /></span><div><b>隐私加密</b><span>咨询内容只有你和咨询师可见</span></div></div>
          <div><span className="site-ic"><Icon name="clock" /></span><div><b>24 小时前可退改</b><span>免费改约，取消全额退款</span></div></div>
          <div><span className="site-ic"><Icon name="card" /></span><div><b>担保交易</b><span>咨询完成后才结算给咨询师</span></div></div>
        </div>
      </div>

      <section className="site-sec site-wrap" aria-labelledby="h-cats">
        <div className="site-sec-h"><div><h2 id="h-cats">按困扰找咨询师</h2><p>选择你最想解决的问题，看擅长这个方向的老师</p></div><Link to="/counselors">全部咨询师 →</Link></div>
        <Categories />
      </section>

      <TodayCounselors />

      <section className="site-sec site-wrap" aria-labelledby="h-steps">
        <div className="site-sec-h"><div><h2 id="h-steps">4 步开始一次咨询</h2><p>从打开网页到见到咨询师，最快当天完成</p></div></div>
        <ol className="site-steps">
          <li><span className="site-step-n">1</span><h3>和 AI 助理聊聊</h3><p>语音说出困扰，小屿帮你理清问题、完成初步筛查。免费，不知道选谁也没关系。</p></li>
          <li><span className="site-step-n">2</span><h3>选择咨询师</h3><p>按困扰、价格、时间筛选，查看资质证书和来访者评价，小屿会给出推荐。</p></li>
          <li><span className="site-step-n">3</span><h3>预约并支付</h3><p>选好时间在线支付，平台担保；开始前 24 小时可以免费改约或退款。</p></li>
          <li><span className="site-step-n">4</span><h3>开始咨询</h3><p>按时进入视频或语音咨询室，也可以线下面询；咨询内容全程保密。</p></li>
        </ol>
      </section>

      <section className="site-sec site-wrap" aria-labelledby="h-svc">
        <div className="site-sec-h"><div><h2 id="h-svc">服务与价格</h2><p>价格透明，下单前就能看到</p></div></div>
        <div className="site-svcs">
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/session-window.jpg)' }} /><div className="site-svc-bd"><h3>一对一心理咨询</h3><p>持证咨询师，视频 / 语音 / 面询，50 分钟一次。</p><div className="site-svc-pr"><b>¥300<small>起 / 次</small></b><Link to="/counselors">去预约 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/headphones.jpg)' }} /><div className="site-svc-bd"><h3>AI 语音接待</h3><p>小屿 24 小时在线，帮你梳理困扰、初步筛查并匹配咨询师。</p><div className="site-svc-pr"><b>免费</b><Link to="/intake">去聊聊 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/notebook-pen.jpg)' }} /><div className="site-svc-bd"><h3>专业心理测评</h3><p>PHQ-9 抑郁、GAD-7 焦虑、ISI 失眠等标准化量表。</p><div className="site-svc-pr"><b>免费</b><Link to="/account/assessments">去测评 →</Link></div></div></article>
          <article className="site-svc"><div className="site-svc-img" style={{ backgroundImage: 'url(/assets/team-highfive.jpg)' }} /><div className="site-svc-bd"><h3>企业 EAP</h3><p>员工心理福利、管理者培训、危机干预，按人数定制。</p><div className="site-svc-pr"><b>定制<small>方案</small></b><span className="muted">即将上线</span></div></div></article>
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
