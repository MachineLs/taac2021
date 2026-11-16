import { Link, useNavigate } from 'react-router-dom';
import type { CounselorSummary } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, relDay, time } from '../../../lib/format';
import { cardSlots } from '../util';

export function Stars({ value }: { value: number }) {
  return <span className="site-star">★ <b className="num">{value.toFixed(2)}</b></span>;
}

export function PriceTag({ price, original, unit = '/次' }: { price: number; original?: number | null; unit?: string }) {
  return <span className="price site-price">{original && original > price ? <s>¥{original}</s> : null}¥{price}<small>{unit}</small></span>;
}

/** Zocdoc-style counselor card with the next bookable slots. Clicking a slot opens the detail page with it preselected. */
export function CounselorCard({ c, days = 7 }: { c: CounselorSummary; days?: number }) {
  const nav = useNavigate();
  const slots = useAsync(() => api.counselorSlots(c.id, { days }), [c.id, days]);
  const shown = cardSlots(slots.data, 5);
  const modes = c.modes.map(modeLabel).join(' · ');
  return (
    <article className="site-pc">
      <Link className="site-pc-ph" to={`/counselors/${c.id}`} aria-label={`查看${c.name}的主页`}>
        <img src={c.avatar} alt={c.name} loading="lazy" />
      </Link>
      <div className="site-pc-info">
        <div className="site-pc-nm">
          <Link to={`/counselors/${c.id}`}><b>{c.name}</b></Link>
          <span className="badge">{c.title}</span>
          {c.badges.map((b) => <span key={b} className="badge badge-gold">{b}</span>)}
        </div>
        <div className="site-pc-ttl">{c.headline}</div>
        <div className="site-pc-st">
          <Stars value={c.rating} />
          <span>从业 <b className="num">{c.years}</b> 年</span>
          <span>服务 <b className="num">{c.sessionsCount.toLocaleString('zh-CN')}</b> 人次</span>
          <span>复购率 <b className="num">{c.rebookRate}%</b></span>
          {c.city && c.modes.includes('offline') && <span>{c.city} · 可面询</span>}
        </div>
        <div className="site-pc-tg">{c.tags.slice(0, 5).map((t) => <span key={t} className="tag">{t}</span>)}</div>
      </div>
      <div className="site-pc-slots" aria-label="最近可约时间">
        {slots.loading && !slots.data ? Array.from({ length: 5 }, (_, i) => <span key={i} className="site-slot-skel" />)
          : slots.error ? <span className="site-pc-slotmsg">时段加载失败 <button type="button" className="btn-text btn" onClick={() => slots.reload()}>重试</button></span>
          : shown.length === 0 ? <span className="site-pc-slotmsg">近 {days} 天暂无可约时段，可先发消息咨询</span>
          : shown.map((s) => (
            <button key={s.id} type="button" className="slot" disabled={s.status !== 'open'}
              onClick={() => nav(`/counselors/${c.id}?slot=${s.id}`)}
              aria-label={s.status === 'open' ? `预约 ${relDay(s.startAt)} ${time(s.startAt)}` : `${relDay(s.startAt)} 已约满`}>
              {relDay(s.startAt)}<small>{s.status === 'open' ? time(s.startAt) : '已约满'}</small>
            </button>
          ))}
      </div>
      <div className="site-pc-ft">
        <span className="site-pc-modes"><span>{modes}</span><span>50 分钟 / 次</span></span>
        <PriceTag price={c.price} original={c.originalPrice} />
        <Link className="btn btn-blue" to={`/counselors/${c.id}`}>立即预约</Link>
      </div>
    </article>
  );
}

export function CounselorCardSkeleton() {
  return (
    <div className="site-pc site-pc-skel" aria-hidden="true">
      <span className="site-skel" style={{ width: 88, height: 88, borderRadius: 16 }} />
      <div style={{ display: 'grid', gap: 10 }}>
        <span className="site-skel" style={{ width: '45%', height: 20 }} />
        <span className="site-skel" style={{ width: '80%', height: 14 }} />
        <span className="site-skel" style={{ width: '65%', height: 14 }} />
      </div>
      <div className="site-pc-slots">{Array.from({ length: 5 }, (_, i) => <span key={i} className="site-slot-skel" />)}</div>
    </div>
  );
}
