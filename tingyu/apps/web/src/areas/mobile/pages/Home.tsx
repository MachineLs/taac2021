// /m — App home (design3/app-home.html).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Appointment, CounselorQuery } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { captureRefFromUrl } from '../../../lib/ref';
import { modeLabel, relDay, time, range } from '../../../lib/format';
import { ErrorState, Empty } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon, type IconName } from '../icons';
import { CardSkeleton, CounselorCard } from '../CounselorCard';
import { errMsg, Sheet, Spin, TabPage, useUnread } from '../ui';

const HOT = ['失眠', '焦虑', '亲密关系', '职场压力', '情绪低落'];
const CATS: { label: string; icon: IconName; c: string; to: string }[] = [
  { label: '焦虑情绪', icon: 'bubble', c: 'c1', to: '/m/counselors?tag=焦虑' },
  { label: '睡眠改善', icon: 'moon', c: 'c7', to: '/m/counselors?tag=失眠' },
  { label: '心理测评', icon: 'doc', c: 'c3', to: '/m/assess' },
  { label: '情感婚姻', icon: 'heart', c: 'c4', to: '/m/counselors?tag=亲密关系' },
  { label: '亲子教育', icon: 'family', c: 'c5', to: '/m/counselors?tag=亲子' },
  { label: '职场压力', icon: 'briefcase', c: 'c6', to: '/m/counselors?tag=职场压力' },
  { label: '情绪低落', icon: 'cloud', c: 'c2', to: '/m/counselors?tag=情绪低落' },
  { label: '青少年', icon: 'star', c: 'c3', to: '/m/counselors?tag=青少年' },
  { label: '线下面询', icon: 'store', c: 'c2', to: '/m/counselors?mode=offline' },
  { label: '全部服务', icon: 'grid', c: 'c8', to: '/m/counselors' },
];
const FEED_TABS: { label: string; q: CounselorQuery }[] = [
  { label: '综合推荐', q: { sort: 'recommended' } },
  { label: '今天可约', q: { availableWithinDays: 1, sort: 'soonest' } },
  { label: '300 元以下', q: { priceMax: 300, sort: 'recommended' } },
  { label: '线下面询', q: { mode: 'offline', sort: 'recommended' } },
];
const CITIES = ['北京', '上海', '杭州', '深圳', '广州', '南京', '成都'];
const CITY_KEY = 'tingyu.m.city';

export default function Home() {
  const nav = useNavigate();
  const { user } = useAuth();
  const unread = useUnread();
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [city, setCity] = useState(() => { try { return localStorage.getItem(CITY_KEY) || '北京'; } catch { return '北京'; } });
  const [cityOpen, setCityOpen] = useState(false);
  useEffect(() => { captureRefFromUrl(); }, []);

  const feed = useAsync(() => api.counselors({ ...FEED_TABS[tab].q, ...(tab === 3 ? { city } : {}), pageSize: 5 }), [tab, city]);
  const next = useAsync<Appointment | null>(async () => {
    if (!user) return null;
    const list = await api.appointments('paid').catch(() => [] as Appointment[]);
    const soon = list.filter((a) => new Date(a.endAt).getTime() > Date.now()).sort((a, b) => a.startAt.localeCompare(b.startAt));
    return soon[0] ?? null;
  }, [user?.id]);

  // new-user coupon
  const coupons = useAsync(async () => (user ? api.myCoupons().catch(() => []) : []), [user?.id]);
  const hasNew = !!coupons.data?.some((c) => c.amount === 100 || /新人/.test(c.title));
  const [claiming, setClaiming] = useState(false);
  const claim = async () => {
    if (!user) { nav('/m/login?next=/m'); return; }
    setClaiming(true);
    try { await api.claimCoupon('NEW100'); toast('领取成功，下单时自动可用'); coupons.reload(); }
    catch (e) { if (e instanceof ApiError && e.status === 409) { toast('你已经领取过新人券了'); coupons.reload(); } else toast(errMsg(e, '领取失败，请稍后再试')); }
    finally { setClaiming(false); }
  };

  const pickCity = (c: string) => { setCity(c); try { localStorage.setItem(CITY_KEY, c); } catch { /* ignore */ } setCityOpen(false); };

  return (
    <TabPage className="m-home">
      <div className="m-home-head">
        <div className="m-home-bar">
          <span className="m-logo"><i>屿</i>听屿心理</span>
          <button type="button" className="m-city" onClick={() => setCityOpen(true)}>{city}<Icon name="down" size={14} /></button>
          <Link to={user ? '/m/notifications' : '/m/login?next=/m/notifications'} className="m-ib" aria-label={unread.notifications ? `通知，${unread.notifications} 条未读` : '通知'}>
            <Icon name="bell" size={22} />{unread.notifications > 0 && <span className="m-dot" />}
          </Link>
        </div>
        <form className="m-search" role="search" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get('q'); nav(`/m/counselors${v ? `?q=${encodeURIComponent(String(v))}` : ''}`); }}>
          <Icon name="search" size={18} />
          <input name="q" placeholder="搜索咨询师、困扰或话题" aria-label="搜索咨询师、困扰或话题" enterKeyHint="search" />
          <button type="submit">搜索</button>
        </form>
        <div className="m-hot"><span>热门：</span>{HOT.map((h, i) => <Link key={h} to={`/m/counselors?q=${encodeURIComponent(h)}`} className={i === 0 ? 'hot' : ''}>{h}</Link>)}</div>
      </div>

      {next.data && <NextSession a={next.data} />}

      <Link to="/m/voice" className="m-ai">
        <div className="m-ai-t">不知道找哪位老师？<small>AI 助理</small></div>
        <p>语音聊 3 分钟，帮你匹配老师<br />免费 · 匿名 · 24 小时在线</p>
        <span className="m-ai-go"><Icon name="mic" size={16} />语音聊聊</span>
      </Link>

      <nav className="m-cats" aria-label="服务分类">
        {CATS.map((c) => <Link key={c.label} to={c.to}><span className={`m-cat-ic ${c.c}`}><Icon name={c.icon} size={22} /></span>{c.label}</Link>)}
      </nav>

      <div className="m-coupon">
        <div className="m-coupon-amt num"><span><small>¥</small>100</span></div>
        <div className="m-coupon-txt"><b>新人首单立减 100 元</b><span>满 300 可用 · 7 天内有效</span></div>
        {hasNew
          ? <Link to="/m/coupons" className="m-coupon-btn done">已领取</Link>
          : <button type="button" className="m-coupon-btn" onClick={claim} disabled={claiming}>{claiming && <Spin />}{user ? '立即领取' : '登录领取'}</button>}
      </div>

      <div className="m-trust">
        <span><Icon name="shield" size={14} />咨询师 100% 持证</span>
        <span><Icon name="shield" size={14} />平台担保交易</span>
        <span><Icon name="shield" size={14} />不满意可退款</span>
      </div>

      <section className="m-sec">
        <div className="m-sec-h"><h2>为你推荐</h2><Link to="/m/counselors">全部咨询师 ›</Link></div>
        <div className="m-feed-tabs" role="tablist">
          {FEED_TABS.map((t, i) => <button key={t.label} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{t.label}</button>)}
        </div>
        {feed.loading && !feed.data ? <CardSkeleton n={2} />
          : feed.error ? <ErrorState error={new Error(errMsg(feed.error, '加载失败'))} onRetry={feed.reload} />
          : !feed.data?.items.length ? <Empty title="暂时没有符合条件的咨询师" hint={tab === 3 ? `${city}暂无可面询的咨询师，可以换个城市或选择线上咨询` : '换个条件看看'} />
          : <div className={feed.loading ? 'm-dim' : ''}>{feed.data.items.map((c) => <CounselorCard key={c.id} c={c} withSlots />)}
              <Link to="/m/counselors" className="m-more">查看全部咨询师<Icon name="right" size={14} /></Link></div>}
      </section>

      <p className="m-foot-note">听屿的 AI 助理小屿只做接待、初筛与匹配，不提供诊断和治疗。<br />如遇紧急情况请拨打 12356 心理援助热线或 120。</p>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title="选择城市">
        <p className="m-sheet-hint">城市用于筛选线下面询，线上咨询不受城市限制</p>
        <div className="m-chips-wrap">{CITIES.map((c) => <button key={c} type="button" className={`chip${c === city ? ' on' : ''}`} onClick={() => pickCity(c)}>{c}</button>)}</div>
      </Sheet>
      {toast.node}
    </TabPage>
  );
}

function NextSession({ a }: { a: Appointment }) {
  const soon = new Date(a.startAt).getTime() - Date.now() < 10 * 60000;
  return (
    <Link to={soon ? `/m/room/${a.id}` : `/m/orders/${a.id}`} className="m-next">
      <img className="avatar" src={a.counselor.avatar} alt="" width={44} height={44} />
      <div className="m-next-main">
        <span className="m-next-k">下一次咨询 · {modeLabel(a.mode)}</span>
        <b>{relDay(a.startAt)} {time(a.startAt)} · {a.counselor.name}</b>
        <small>{range(a.startAt, a.endAt)}</small>
      </div>
      <span className="m-next-go">{soon ? '进入咨询室' : '查看'}</span>
    </Link>
  );
}
