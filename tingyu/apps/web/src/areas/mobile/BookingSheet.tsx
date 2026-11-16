// Booking sheet: mode, 7-day date strip, time slots, coupon, share-intake switch → create appointment.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConsultMode, CounselorDetail, Slot, UserCoupon } from '@tingyu/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { dayKey, modeLabel, monthDay, relDay, time, weekday, yuan } from '../../lib/format';
import { ErrorState, Loading } from '../../components/states';
import { Icon } from './icons';
import { errMsg, Sheet, Spin } from './ui';

export function next7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = new Date(Date.now() + i * 86400000).toISOString();
    return { key: dayKey(iso), rel: i === 0 ? '今天' : i === 1 ? '明天' : weekday(iso), date: monthDay(iso).replace(/^\d+月/, ''), iso };
  });
}

/** Day strip + slot grid; shared by booking and rescheduling. */
export function SlotPicker({ slots, value, onChange }: { slots: Slot[]; value: string | null; onChange: (s: Slot) => void }) {
  const days = useMemo(next7Days, []);
  const byDay = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    for (const s of slots) { if (s.status === 'blocked' || new Date(s.startAt).getTime() <= Date.now()) continue; (m[dayKey(s.startAt)] ||= []).push(s); }
    Object.values(m).forEach((l) => l.sort((a, b) => a.startAt.localeCompare(b.startAt)));
    return m;
  }, [slots]);
  const selected = slots.find((s) => s.id === value);
  const [day, setDay] = useState<string>(() => (selected ? dayKey(selected.startAt) : days.find((d) => byDay[d.key]?.some((s) => s.status === 'open'))?.key ?? days[0].key));
  useEffect(() => { if (selected) setDay(dayKey(selected.startAt)); }, [selected]);
  const list = byDay[day] ?? [];
  return (
    <>
      <div className="m-days" role="tablist" aria-label="选择日期">
        {days.map((d) => {
          const open = byDay[d.key]?.filter((s) => s.status === 'open').length ?? 0;
          return (
            <button key={d.key} type="button" role="tab" aria-selected={d.key === day} className={`m-day${d.key === day ? ' on' : ''}${open ? '' : ' full'}`} onClick={() => setDay(d.key)}>
              <span>{d.rel}</span><b className="num">{d.date}</b><small>{open ? `${open} 个时段` : '约满'}</small>
            </button>
          );
        })}
      </div>
      {list.length === 0 ? <p className="m-slots-empty">这一天暂无可约时段，看看其他日期吧</p> : (
        <div className="m-slot-grid" role="group" aria-label="选择时段">
          {list.map((s) => (
            <button key={s.id} type="button" className={`slot${s.id === value ? ' on' : ''}`} disabled={s.status !== 'open'} onClick={() => onChange(s)} aria-pressed={s.id === value}>
              {time(s.startAt)}<small>{s.status === 'open' ? `至 ${time(s.endAt)}` : '已约满'}</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function BookingSheet({ c, open, onClose, initialSlotId, intakeId: intakeParam }: {
  c: CounselorDetail; open: boolean; onClose: () => void; initialSlotId?: string | null; intakeId?: string | null;
}) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotErr, setSlotErr] = useState<Error | null>(null);
  const [slotId, setSlotId] = useState<string | null>(initialSlotId ?? null);
  const [mode, setMode] = useState<ConsultMode>(c.modes[0] ?? 'video');
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [intakeId, setIntakeId] = useState<string | null>(intakeParam ?? null);
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSlots = () => {
    setSlotErr(null);
    api.counselorSlots(c.id, { days: 7 }).then(setSlots).catch((e) => setSlotErr(e));
  };
  useEffect(() => { if (open) { loadSlots(); setErr(null); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, c.id]);
  useEffect(() => { if (initialSlotId) setSlotId(initialSlotId); }, [initialSlotId]);

  // coupons + latest intake for signed-in users
  useEffect(() => {
    if (!open || !user) return;
    api.myCoupons().then((list) => {
      const ok = list.filter((x) => x.status === 'unused' && x.minSpend <= c.price && new Date(x.expiresAt).getTime() > Date.now()).sort((a, b) => b.amount - a.amount);
      setCoupons(ok); setCouponId((cur) => cur ?? ok[0]?.id ?? null);
    }).catch(() => setCoupons([]));
    if (!intakeParam) {
      api.intakeMine().then((list) => {
        const last = list.filter((s) => s.status === 'ended' && Date.now() - new Date(s.createdAt).getTime() < 30 * 86400000).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (last) setIntakeId(last.id);
      }).catch(() => { /* optional */ });
    }
  }, [open, user, c.price, intakeParam]);

  const slot = slots?.find((s) => s.id === slotId && s.status === 'open') ?? null;
  const coupon = coupons.find((x) => x.id === couponId) ?? null;
  const discount = coupon ? Math.min(coupon.amount, c.price) : 0;
  const amount = c.price - discount;

  const submit = async () => {
    if (!slot) { setErr('请选择一个咨询时段'); return; }
    if (!user) {
      const q = new URLSearchParams({ slot: slot.id }); if (intakeId) q.set('intake', intakeId);
      nav(`/m/login?next=${encodeURIComponent(`/m/counselors/${c.id}?${q}`)}`); return;
    }
    setBusy(true); setErr(null);
    try {
      const a = await api.createAppointment({ counselorId: c.id, slotId: slot.id, mode, couponId: coupon?.id ?? null, intakeSessionId: intakeId, shareIntake: !!intakeId && share });
      nav(`/m/checkout/${a.id}`);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'slot_taken' || e.status === 409)) { setErr('这个时段刚刚被约走了，请换一个时间'); setSlotId(null); loadSlots(); }
      else setErr(errMsg(e, '预约失败，请稍后再试'));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} tall title={<span className="m-bk-title"><img className="avatar" src={c.avatar} alt="" width={28} height={28} />预约 {c.name}</span>}
      footer={
        <div className="m-bk-foot">
          <div className="m-bk-sum">
            <span>实付 <b className="num">{yuan(amount)}</b></span>
            <small>{slot ? `${relDay(slot.startAt)} ${time(slot.startAt)} · ${modeLabel(mode)} · 50 分钟` : '请选择时段'}{discount ? ` · 已减 ${yuan(discount)}` : ''}</small>
          </div>
          <button type="button" className="btn btn-blue btn-lg" disabled={!slot || busy} onClick={submit}>{busy && <Spin />}{user ? '确认预约' : '登录后预约'}</button>
        </div>
      }>
      {err && <div className="m-form-err" role="alert">{err}</div>}
      <div className="m-sheet-sec">
        <h3>咨询方式</h3>
        <div className="m-mode-grid">
          {c.modes.map((m) => (
            <button key={m} type="button" className={`m-mode${m === mode ? ' on' : ''}`} aria-pressed={m === mode} onClick={() => setMode(m)}>
              <Icon name={m === 'video' ? 'video' : m === 'voice' ? 'phone' : m === 'text' ? 'chat' : 'store'} size={18} />
              <b>{modeLabel(m)}</b><small>{m === 'offline' ? (c.city ?? '线下') : '线上'}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="m-sheet-sec">
        <h3>选择时间<small>每次 50 分钟 · 北京时间</small></h3>
        {slotErr ? <ErrorState error={new Error(errMsg(slotErr, '时段加载失败'))} onRetry={loadSlots} /> : !slots ? <Loading label="正在获取可约时段…" /> : <SlotPicker slots={slots} value={slotId} onChange={(s) => { setSlotId(s.id); setErr(null); }} />}
      </div>
      {user && (
        <div className="m-sheet-sec">
          <h3>优惠券</h3>
          {coupons.length === 0 ? <p className="m-slots-empty">暂无可用优惠券</p> : (
            <div className="m-cp-list">
              {coupons.map((x) => (
                <button key={x.id} type="button" className={`m-cp-opt${x.id === couponId ? ' on' : ''}`} onClick={() => setCouponId(x.id === couponId ? null : x.id)} aria-pressed={x.id === couponId}>
                  <b className="num">¥{x.amount}</b><span>{x.title}<small>满 {x.minSpend} 可用</small></span><i className="m-radio" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="m-sheet-sec">
        {intakeId ? (
          <label className="m-share">
            <span className="m-li-ic c1"><Icon name="sparkle" size={18} /></span>
            <span className="m-share-t"><b>同步接待小结给咨询师</b><small>咨询师可提前了解你的情况，首次咨询更高效。仅本次咨询师可见。</small></span>
            <span className="m-switch"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} aria-label="同步接待小结" /><span /></span>
          </label>
        ) : (
          <button type="button" className="m-share" onClick={() => nav('/m/voice')}>
            <span className="m-li-ic c1"><Icon name="mic" size={18} /></span>
            <span className="m-share-t"><b>先和小屿聊 3 分钟（可选）</b><small>生成接待小结，预约时可同步给咨询师</small></span>
            <Icon name="right" size={16} />
          </button>
        )}
      </div>
      <p className="m-bk-rule"><Icon name="shield" size={14} />开始前 24 小时以上可免费取消或改约 · 平台担保交易</p>
    </Sheet>
  );
}
