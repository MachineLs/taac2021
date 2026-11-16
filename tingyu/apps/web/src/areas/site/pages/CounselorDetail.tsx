import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ConsultMode, Slot } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, dayKey, modeLabel, monthDay, range, relDay, time, weekday, yuan } from '../../../lib/format';
import { ErrorState, Empty, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../components/Icon';
import { PriceTag, Stars } from '../components/CounselorCard';
import { bestCoupon, dayIso, errMsg, nextDays, shortDate, sortSlots } from '../util';

const MODE_ICON: Record<ConsultMode, string> = { video: 'video', voice: 'phone', text: 'chat', offline: 'pin' };
const MODE_HINT: Record<ConsultMode, string> = { video: '视频咨询室', voice: '语音通话', text: '文字咨询', offline: '线下门店' };

function Reviews({ counselorId, rating, count }: { counselorId: string; rating: number; count: number }) {
  const [page, setPage] = useState(1);
  const r = useAsync(() => api.counselorReviews(counselorId, page), [counselorId, page]);
  const pages = r.data ? Math.max(1, Math.ceil(r.data.total / r.data.pageSize)) : 1;
  return (
    <section className="card site-dsec" id="reviews" aria-labelledby="h-rev">
      <div className="site-dsec-h">
        <h2 id="h-rev">来访者评价</h2>
        <span className="site-rev-sum"><b className="num">{rating.toFixed(2)}</b><span className="site-stars">★★★★★</span><span className="muted">{count} 条评价</span></span>
      </div>
      {r.error ? <ErrorState error={r.error} onRetry={r.reload} />
        : !r.data ? <Loading />
        : r.data.items.length === 0 ? <Empty title="还没有评价" hint="完成咨询后，来访者可以留下匿名评价" />
        : (
          <>
            <ul className={`site-revs ${r.loading ? 'site-dim' : ''}`}>
              {r.data.items.map((v) => (
                <li key={v.id}>
                  <div className="site-rev-top"><span className="site-ava-fallback" style={{ width: 32, height: 32, fontSize: 13 }}>{v.userName.slice(0, 1)}</span><b>{v.userName}</b><span className="site-stars">{'★'.repeat(v.rating)}<span className="site-stars-off">{'★'.repeat(5 - v.rating)}</span></span><span className="muted site-rev-date">{monthDay(v.createdAt)}</span></div>
                  <p>{v.content}</p>
                  {v.tags.length > 0 && <div className="site-tags">{v.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="site-pager site-pager-sm">
                <button type="button" className="btn btn-line btn-sm" disabled={page <= 1 || r.loading} onClick={() => setPage(page - 1)}>上一页</button>
                <span className="muted num">{page} / {pages}</span>
                <button type="button" className="btn btn-line btn-sm" disabled={page >= pages || r.loading} onClick={() => setPage(page + 1)}>下一页</button>
              </div>
            )}
          </>
        )}
    </section>
  );
}

export default function CounselorDetail() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  const c = useAsync(() => api.counselor(id), [id]);
  const slots = useAsync(() => api.counselorSlots(id, { days: 7 }), [id]);
  const coupons = useAsync(() => (user ? api.myCoupons() : Promise.resolve(null)), [user?.id]);
  const intakes = useAsync(() => (user ? api.intakeMine() : Promise.resolve(null)), [user?.id]);

  const days = useMemo(() => nextDays(7), []);
  const [mode, setMode] = useState<ConsultMode | null>((sp.get('mode') as ConsultMode) || null);
  const [day, setDay] = useState<string>(days[0]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [couponChoice, setCouponChoice] = useState<string | 'auto' | 'none'>('auto');
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => { if (c.data) document.title = `${c.data.name} · ${c.data.title} · 听屿心理`; }, [c.data]);
  useEffect(() => { if (c.data && (!mode || !c.data.modes.includes(mode))) setMode(c.data.modes[0]); }, [c.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of sortSlots(slots.data ?? [])) {
      if (s.status === 'blocked' || Date.parse(s.startAt) < Date.now()) continue;
      const k = dayKey(s.startAt); if (!m.has(k)) m.set(k, []); m.get(k)!.push(s);
    }
    return m;
  }, [slots.data]);

  // Preselect the slot passed from a card (?slot=), else jump to the first day with open slots.
  useEffect(() => {
    if (!slots.data) return;
    const pre = sp.get('slot');
    const s = pre ? slots.data.find((x) => x.id === pre && x.status === 'open') : null;
    if (s) { setDay(dayKey(s.startAt)); setSlotId(s.id); return; }
    if (pre && !s) toast('你选择的时段已被预约，请重新选择');
    const first = days.find((d) => byDay.get(d)?.some((x) => x.status === 'open'));
    if (first) setDay(first);
  }, [slots.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const counselor = c.data;
  const slot = slots.data?.find((s) => s.id === slotId) ?? null;
  const usable = useMemo(() => (counselor && coupons.data ? coupons.data.filter((x) => bestCoupon([x], counselor.price)) : []), [coupons.data, counselor]);
  const coupon = !counselor ? null : couponChoice === 'none' ? null : couponChoice === 'auto' ? bestCoupon(coupons.data, counselor.price) : usable.find((x) => x.id === couponChoice) ?? null;
  const lastIntake = useMemo(() => (intakes.data ?? []).filter((s) => s.status === 'ended').sort((a, b) => Date.parse(b.endedAt ?? b.createdAt) - Date.parse(a.endedAt ?? a.createdAt))[0] ?? null, [intakes.data]);

  if (c.error) return <div className="site-wrap"><ErrorState error={c.error} onRetry={c.reload} />{c.error instanceof ApiError && c.error.status === 404 && <div className="site-center"><Link className="btn btn-blue" to="/counselors">返回咨询师列表</Link></div>}</div>;
  if (!counselor) return <Loading full />;

  const discount = coupon ? coupon.amount : 0;
  const amount = Math.max(0, counselor.price - discount);

  const book = async () => {
    if (!slot || !mode) return;
    if (!user) {
      nav(`/login?next=${encodeURIComponent(`${loc.pathname}?slot=${slot.id}&mode=${mode}`)}`);
      return;
    }
    setBusy(true);
    try {
      const a = await api.createAppointment({
        counselorId: counselor.id, slotId: slot.id, mode, couponId: coupon?.id ?? null,
        intakeSessionId: lastIntake && share ? lastIntake.id : null, shareIntake: !!lastIntake && share,
      });
      nav(`/checkout/${a.id}`);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'slot_taken' || e.status === 409)) {
        toast(e.message || '这个时段刚刚被预约了，请换一个时间');
        setSlotId(null); slots.reload();
      } else if (e instanceof ApiError && e.status === 401) {
        nav(`/login?next=${encodeURIComponent(loc.pathname)}`);
      } else toast(errMsg(e, '预约失败，请稍后再试'));
    } finally { setBusy(false); }
  };

  const chat = async () => {
    if (!user) { nav(`/login?next=${encodeURIComponent(loc.pathname)}`); return; }
    setChatBusy(true);
    try { const conv = await api.openConversation(counselor.id); nav(`/account/messages?c=${conv.id}`); }
    catch (e) { toast(errMsg(e, '暂时无法发起会话')); } finally { setChatBusy(false); }
  };

  const daySlots = byDay.get(day) ?? [];

  return (
    <div className="site-wrap site-detail">
      <div className="site-crumbs"><Link to="/">首页</Link><Icon name="right" size={12} /><Link to="/counselors">找咨询师</Link><Icon name="right" size={12} /><span>{counselor.name}</span></div>
      <div className="site-detail-grid">
        <div className="site-detail-main">
          <section className="card site-profile">
            <img className="site-profile-ph" src={counselor.avatar} alt={counselor.name} />
            <div className="site-profile-info">
              <div className="site-pc-nm"><h1>{counselor.name}</h1><span className="badge">{counselor.title}</span>{counselor.badges.map((b) => <span key={b} className="badge badge-gold">{b}</span>)}<span className="badge badge-green"><Icon name="shield" size={12} />平台认证</span></div>
              <p className="site-pc-ttl">{counselor.headline}</p>
              <div className="site-kpis">
                <div><b className="num">{counselor.rating.toFixed(2)}</b><span>综合评分</span></div>
                <div><b className="num">{counselor.years}<small>年</small></b><span>从业经验</span></div>
                <div><b className="num">{counselor.sessionsCount.toLocaleString('zh-CN')}</b><span>服务人次</span></div>
                <div><b className="num">{counselor.rebookRate}%</b><span>复购率</span></div>
              </div>
              <div className="site-profile-row"><span className="muted">擅长</span><div className="site-tags">{counselor.tags.map((t) => <Link key={t} className="tag site-tag-link" to={`/counselors?tag=${encodeURIComponent(t)}`}>{t}</Link>)}</div></div>
              <div className="site-profile-row"><span className="muted">方式</span><div className="site-tags">{counselor.modes.map((m) => <span key={m} className="tag"><Icon name={MODE_ICON[m]} size={13} />&nbsp;{modeLabel(m)}</span>)}{counselor.city && counselor.modes.includes('offline') && <span className="tag">{counselor.city}门店</span>}</div></div>
            </div>
          </section>

          <section className="card site-dsec" aria-labelledby="h-intro">
            <h2 id="h-intro">个人简介</h2>
            <p className="site-intro">{counselor.intro}</p>
            <h3>咨询流派</h3>
            <div className="site-tags">{counselor.methods.map((m) => <span key={m} className="badge">{m}</span>)}</div>
          </section>

          <section className="card site-dsec" aria-labelledby="h-qual">
            <h2 id="h-qual">资质证书 <span className="badge badge-green"><Icon name="check" size={12} stroke={2.6} />已核验</span></h2>
            {counselor.qualifications.length === 0 ? <p className="muted">资质信息整理中</p> : (
              <ul className="site-quals">{counselor.qualifications.map((q) => (
                <li key={q.name + q.year}><span className="site-qic"><Icon name="doc" /></span><div><b>{q.name}</b><span>{q.issuer} · {q.year} 年</span></div></li>
              ))}</ul>
            )}
            <h3>受训经历</h3>
            {counselor.training.length === 0 ? <p className="muted">暂无</p> : (
              <ol className="site-timeline">{counselor.training.map((t) => <li key={t.period + t.content}><span className="num">{t.period}</span><p>{t.content}</p></li>)}</ol>
            )}
          </section>

          <Reviews counselorId={counselor.id} rating={counselor.rating} count={counselor.reviewCount} />
        </div>

        <aside className="site-book" aria-label="预约">
          <div className="card site-book-card">
            <div className="site-book-top">
              <PriceTag price={counselor.price} original={counselor.originalPrice} unit="/ 50 分钟" />
              {counselor.nextAvailableAt && <span className="badge badge-green">最早 {relDay(counselor.nextAvailableAt)} {time(counselor.nextAvailableAt)}</span>}
            </div>

            <div className="site-book-step"><h3>1. 咨询方式</h3>
              <div className="site-modes" role="radiogroup" aria-label="咨询方式">
                {counselor.modes.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={`site-mode ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
                    <Icon name={MODE_ICON[m]} size={18} /><b>{modeLabel(m)}</b><small>{MODE_HINT[m]}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="site-book-step"><h3>2. 选择时间</h3>
              <div className="site-days" role="tablist" aria-label="日期">
                {days.map((d) => {
                  const n = (byDay.get(d) ?? []).filter((s) => s.status === 'open').length;
                  return (
                    <button key={d} type="button" role="tab" aria-selected={day === d} className={`site-day ${day === d ? 'on' : ''}`} onClick={() => { setDay(d); setSlotId(null); }}>
                      <b>{relDay(dayIso(d)).length <= 2 ? relDay(dayIso(d)) : weekday(dayIso(d))}</b><span>{shortDate(d)}</span><small className={n ? '' : 'none'}>{slots.data ? (n ? `${n} 个` : '约满') : '…'}</small>
                    </button>
                  );
                })}
              </div>
              {slots.error ? <ErrorState error={slots.error} onRetry={slots.reload} />
                : !slots.data ? <Loading label="加载可约时间…" />
                : daySlots.length === 0 ? <p className="site-noslot">这一天没有排班，看看其他日期吧</p>
                : (
                  <div className="slots site-book-slots">
                    {daySlots.map((s) => (
                      <button key={s.id} type="button" className={`slot ${slotId === s.id ? 'on' : ''}`} disabled={s.status !== 'open'} aria-pressed={slotId === s.id} onClick={() => setSlotId(s.id)}>
                        {time(s.startAt)}<small>{s.status === 'open' ? '可约' : '已约'}</small>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {slot && <div className="site-picked"><Icon name="calendar" size={16} /><span>{range(slot.startAt, slot.endAt)} · {mode && modeLabel(mode)}</span></div>}

            <div className="site-bill">
              <div><span>咨询费（50 分钟）</span><span className="num">{yuan(counselor.price)}</span></div>
              <div>
                <span>优惠券</span>
                {!user ? <Link className="site-coupon-cta" to={`/login?next=${encodeURIComponent(loc.pathname)}`}><Icon name="gift" size={14} />登录领新人券</Link>
                  : coupons.loading ? <span className="muted">…</span>
                  : usable.length === 0 ? <span className="muted">暂无可用</span>
                  : (
                    <select className="site-coupon-sel" value={couponChoice === 'auto' ? coupon?.id ?? 'none' : couponChoice} onChange={(e) => setCouponChoice(e.target.value)} aria-label="选择优惠券">
                      {usable.map((u) => <option key={u.id} value={u.id}>{u.title}（-¥{u.amount}）</option>)}
                      <option value="none">不使用优惠券</option>
                    </select>
                  )}
              </div>
              {coupon && <div className="site-bill-disc"><span>{coupon.title}</span><span className="num">-{yuan(coupon.amount)}</span></div>}
              <div className="site-bill-total"><span>实付</span><span className="price">{yuan(amount)}</span></div>
            </div>

            {lastIntake && (
              <label className="site-share">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
                <span><b>把接待小结同步给咨询师</b><small>{lastIntake.summary ? `你在 ${dateTime(lastIntake.endedAt ?? lastIntake.createdAt)} 和小屿聊过：${lastIntake.summary.mood}` : '咨询师可提前了解你的情况，节省首次咨询时间'}。仅本次咨询师可见。</small></span>
              </label>
            )}

            <button type="button" className="btn btn-blue btn-lg btn-block" disabled={!slot || !mode || busy} onClick={book}>
              {busy ? <><span className="spinner site-spin-w" />提交中…</> : slot ? `立即预约 · ${yuan(amount)}` : '请选择预约时间'}
            </button>
            <button type="button" className="btn btn-line btn-block site-mt8" disabled={chatBusy} onClick={chat}><Icon name="chat" size={16} />{chatBusy ? '打开中…' : '先咨询一下'}</button>
            <ul className="site-assure">
              <li><Icon name="shield" size={14} />平台担保，咨询完成后才结算</li>
              <li><Icon name="clock" size={14} />开始前 24 小时可免费取消或改约</li>
              <li><Icon name="lock" size={14} />咨询内容严格保密</li>
            </ul>
          </div>
          <Link className="site-book-ai" to="/intake"><span className="site-orb-sm"><Icon name="mic" size={16} /></span><span><b>还没想好？</b>先和小屿聊聊，帮你判断是否合适</span><Icon name="right" size={16} /></Link>
        </aside>
      </div>
      {toast.node}
    </div>
  );
}
