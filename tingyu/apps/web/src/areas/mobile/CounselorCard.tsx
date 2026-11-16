// Counselor card used on the home feed, the list and the intake summary (design3 · Zocdoc-style bookable slots).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CounselorSummary, Slot } from '@tingyu/shared';
import { api } from '../../api/client';
import { modeLabel, relDay, time, when } from '../../lib/format';
import { Icon } from './icons';
import { goodRate } from './ui';

export const shortTitle = (t: string) => t.split(' · ')[0].replace(/心理咨询师$/, '').trim() || t;

export function PriceTag({ price, original, unit = '/50分钟' }: { price: number; original?: number | null; unit?: string }) {
  return <span className="m-price num">{original && original > price ? <s>¥{original}</s> : null}¥{price}<small>{unit}</small></span>;
}

export function CounselorCard({ c, withSlots = false, extra }: { c: CounselorSummary; withSlots?: boolean; extra?: string }) {
  const nav = useNavigate();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  useEffect(() => {
    if (!withSlots) return;
    let alive = true;
    api.counselorSlots(c.id, { days: 7 }).then((s) => { if (alive) setSlots(s.filter((x) => x.status !== 'blocked' && new Date(x.startAt).getTime() > Date.now()).slice(0, 4)); }).catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
  }, [c.id, withSlots]);
  const open = () => nav(`/m/counselors/${c.id}${extra ?? ''}`);
  const book = (e: React.MouseEvent, slotId?: string) => {
    e.stopPropagation();
    const q = new URLSearchParams(extra ? extra.replace(/^\?/, '') : '');
    if (slotId) q.set('slot', slotId); else q.set('book', '1');
    nav(`/m/counselors/${c.id}?${q.toString()}`);
  };
  return (
    <article className="m-ccard" onClick={open} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(); }} aria-label={`${c.name}，${c.title}`}>
      <div className="m-ccard-top">
        <div className="m-ccard-av"><img src={c.avatar} alt="" loading="lazy" /><span>{modeLabel(c.modes[0] ?? 'video')}</span></div>
        <div className="m-ccard-main">
          <div className="m-ccard-nm"><b>{c.name}</b><span className="badge">{shortTitle(c.title)}</span>{c.badges.map((b) => <span key={b} className="badge badge-gold">{b}</span>)}</div>
          <div className="m-ccard-ttl">{c.headline}</div>
          <div className="m-ccard-stats"><span>从业 <b className="num">{c.years}</b> 年</span><span>服务 <b className="num">{c.sessionsCount.toLocaleString('zh-CN')}</b> 人次</span><span>好评 <b className="num">{goodRate(c.rating)}</b></span></div>
          <div className="m-ccard-tags">{c.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}</div>
        </div>
      </div>
      {withSlots && slots && slots.length > 0 && (
        <div className="m-ccard-slots" role="group" aria-label="可预约时间">
          {slots.map((s) => (
            <button key={s.id} type="button" disabled={s.status !== 'open'} onClick={(e) => book(e, s.id)}>
              {relDay(s.startAt)}<small>{s.status === 'open' ? time(s.startAt) : '已约满'}</small>
            </button>
          ))}
          {Array.from({ length: Math.max(0, 4 - slots.length) }).map((_, i) => <span key={i} />)}
        </div>
      )}
      <div className="m-ccard-foot">
        <span className={`m-when${c.nextAvailableAt ? '' : ' off'}`}><Icon name="clock" size={14} />{c.nextAvailableAt ? `${when(c.nextAvailableAt)} 可约` : '近期已约满'}</span>
        <PriceTag price={c.price} original={c.originalPrice} />
        <button type="button" className="m-book" onClick={(e) => book(e)}>预约</button>
      </div>
    </article>
  );
}

export function CardSkeleton({ n = 2 }: { n?: number }) {
  return <>{Array.from({ length: n }).map((_, i) => (
    <div key={i} className="m-ccard m-skel" aria-hidden="true">
      <div className="m-ccard-top"><div className="m-skel-b" style={{ width: 64, height: 76, borderRadius: 12 }} />
        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}><div className="m-skel-b" style={{ width: '50%', height: 16 }} /><div className="m-skel-b" style={{ width: '85%', height: 12 }} /><div className="m-skel-b" style={{ width: '70%', height: 12 }} /></div></div>
      <div className="m-skel-b" style={{ height: 34 }} />
    </div>
  ))}</>;
}
