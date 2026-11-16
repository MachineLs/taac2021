// /desk/schedule — weekly availability grid: publish open slots, delete open slots, see bookings.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Appointment, Slot } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { useToast } from '../../../components/Toast';
import { dayKey, time, weekday } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { addDays, cnHour, cnIso, shortDate, todayKey, weekStart } from '../lib';
import { Confirm, Icon, PageHead, Spin, errMsg } from '../ui';

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i); // 08:00 … 21:00 starts, last ends 22:00
const pad = (n: number) => String(n).padStart(2, '0');

export default function Schedule() {
  const nav = useNavigate();
  const toast = useToast();
  const today = todayKey();
  const [week, setWeek] = useState(weekStart(today));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [del, setDel] = useState<Slot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const slots = useAsync(() => api.wbSlots({ from: cnIso(week), days: 7 }), [week]);
  const appts = useAsync(() => api.wbAppointments({ from: cnIso(week), to: cnIso(addDays(week, 7)) }).catch(() => [] as Appointment[]), [week]);

  const byCell = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of slots.data ?? []) m.set(`${dayKey(s.startAt)}|${cnHour(s.startAt)}`, s);
    return m;
  }, [slots.data]);
  const apptBySlot = useMemo(() => {
    const m = new Map<string, Appointment>();
    for (const a of appts.data ?? []) if (a.status !== 'cancelled' && a.status !== 'refunded') { m.set(a.slotId, a); m.set(`t|${a.startAt}`, a); }
    return m;
  }, [appts.data]);

  const nowMs = Date.now();
  const isPast = (d: string, h: number) => new Date(cnIso(d, h)).getTime() <= nowMs;
  const stats = useMemo(() => {
    const all = slots.data ?? [];
    return { open: all.filter((s) => s.status === 'open').length, booked: all.filter((s) => s.status === 'booked').length, blocked: all.filter((s) => s.status === 'blocked').length };
  }, [slots.data]);

  function toggle(k: string) {
    setSel((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  function toggleDay(d: string) {
    const empties = HOURS.filter((h) => !isPast(d, h) && !byCell.has(`${d}|${h}`)).map((h) => `${d}|${h}`);
    if (!empties.length) return;
    setSel((prev) => {
      const n = new Set(prev);
      const allOn = empties.every((k) => n.has(k));
      empties.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  }

  async function publish() {
    if (!sel.size) return;
    setPublishing(true);
    try {
      const keys = [...sel].sort();
      const created = await api.wbAddSlots({ slots: keys.map((k) => { const [d, h] = k.split('|'); return { startAt: cnIso(d, Number(h)) }; }) });
      setSel(new Set());
      await slots.reload();
      toast(created.length < keys.length ? `已发布 ${created.length} 个时段（${keys.length - created.length} 个已存在）` : `已发布 ${created.length} 个可约时段`);
    } catch (e) { toast(errMsg(e, '发布失败，请稍后再试')); } finally { setPublishing(false); }
  }

  async function copyLastWeek() {
    setCopying(true);
    try {
      const prev = await api.wbSlots({ from: cnIso(addDays(week, -7)), days: 7 });
      const keys = prev.filter((s) => s.status !== 'blocked').map((s) => `${addDays(dayKey(s.startAt), 7)}|${cnHour(s.startAt)}`)
        .filter((k) => { const [d, h] = k.split('|'); return Number(h) >= 8 && Number(h) <= 21 && !isPast(d, Number(h)) && !byCell.has(k); });
      if (!keys.length) { toast('上周没有可复制的时段'); return; }
      setSel((p) => new Set([...p, ...keys]));
      toast(`已选中 ${keys.length} 个时段，确认后点击「发布时段」`);
    } catch (e) { toast(errMsg(e, '读取上周安排失败')); } finally { setCopying(false); }
  }

  async function removeSlot() {
    if (!del) return;
    setDeleting(true);
    try {
      await api.wbDeleteSlot(del.id);
      slots.setData((slots.data ?? []).filter((s) => s.id !== del.id));
      setDel(null);
      toast('时段已删除');
    } catch (e) { toast(errMsg(e, '删除失败，请稍后再试')); } finally { setDeleting(false); }
  }

  const isThisWeek = week === weekStart(today);
  const weekEnded = new Date(cnIso(addDays(week, 7))).getTime() <= nowMs;

  return (
    <div className="desk-page">
      <PageHead
        title="排班管理"
        sub="点击空白格选择时段，再点击「发布时段」开放给来访者预约；每个时段 50 分钟。"
        actions={<>
          <button className="btn btn-line" type="button" onClick={copyLastWeek} disabled={copying || weekEnded}>{copying ? <Spin /> : <Icon name="copy" size={16} />}复制上周安排</button>
          <button className="btn btn-blue" type="button" onClick={publish} disabled={!sel.size || publishing}>{publishing ? <Spin /> : <Icon name="plus" size={16} />}发布时段{sel.size ? `（${sel.size}）` : ''}</button>
        </>}
      />

      <div className="card desk-sched">
        <div className="desk-sched-bar">
          <div className="desk-week-nav">
            <button className="desk-icon-btn line" type="button" aria-label="上一周" onClick={() => { setWeek(addDays(week, -7)); setSel(new Set()); }}><Icon name="chevL" size={16} /></button>
            <b className="num">{shortDate(days[0])} – {shortDate(days[6])}</b>
            <button className="desk-icon-btn line" type="button" aria-label="下一周" onClick={() => { setWeek(addDays(week, 7)); setSel(new Set()); }}><Icon name="chevR" size={16} /></button>
            {!isThisWeek && <button className="btn btn-text" type="button" onClick={() => { setWeek(weekStart(today)); setSel(new Set()); }}>回到本周</button>}
          </div>
          <div className="desk-legend">
            <span><i className="lg-open" />可约 <b className="num">{stats.open}</b></span>
            <span><i className="lg-booked" />已约 <b className="num">{stats.booked}</b></span>
            <span><i className="lg-blocked" />停诊 <b className="num">{stats.blocked}</b></span>
            <span><i className="lg-sel" />待发布 <b className="num">{sel.size}</b></span>
            {sel.size > 0 && <button className="btn btn-text" type="button" onClick={() => setSel(new Set())}>清除选择</button>}
          </div>
        </div>

        {slots.loading && !slots.data ? <Loading /> : slots.error ? <ErrorState error={slots.error} onRetry={slots.reload} /> : (
          <div className="desk-grid-wrap">
            <div className="desk-grid" role="grid" aria-label="一周排班">
              <div className="desk-grid-corner" />
              {days.map((d) => (
                <button key={d} type="button" className={`desk-grid-day${d === today ? ' today' : ''}`} onClick={() => toggleDay(d)} title="选择当天所有空闲时段">
                  <span>{weekday(cnIso(d, 12))}</span><b className="num">{shortDate(d)}</b>
                </button>
              ))}
              {HOURS.map((h) => (
                <Row key={h} h={h} days={days} today={today} byCell={byCell} apptBySlot={apptBySlot} sel={sel} isPast={isPast}
                  onEmpty={toggle} onOpen={setDel} onBooked={(a) => nav(`/desk/appointments/${a.id}`)} />
              ))}
            </div>
          </div>
        )}
        <p className="desk-sched-foot muted"><Icon name="alert" size={14} />已被预约的时段不能删除；如需调整，请先与来访者沟通改约。点击日期可快速选择当天全部空闲时段。</p>
      </div>

      {del && (
        <Confirm title="删除这个可约时段？" danger busy={deleting} confirmText="删除" onClose={() => setDel(null)} onConfirm={removeSlot}
          body={<p>{weekday(del.startAt)} {shortDate(dayKey(del.startAt))} {time(del.startAt)}–{time(del.endAt)} 将不再对来访者开放预约。</p>} />
      )}
      {toast.node}
    </div>
  );
}

function Row({ h, days, today, byCell, apptBySlot, sel, isPast, onEmpty, onOpen, onBooked }: {
  h: number; days: string[]; today: string; byCell: Map<string, Slot>; apptBySlot: Map<string, Appointment>; sel: Set<string>;
  isPast: (d: string, h: number) => boolean; onEmpty: (k: string) => void; onOpen: (s: Slot) => void; onBooked: (a: Appointment) => void;
}) {
  return (
    <>
      <div className="desk-grid-hour num">{pad(h)}:00</div>
      {days.map((d) => {
        const k = `${d}|${h}`;
        const s = byCell.get(k);
        const past = isPast(d, h);
        const label = `${shortDate(d)} ${pad(h)}:00`;
        if (s?.status === 'booked') {
          const a = apptBySlot.get(s.id) ?? apptBySlot.get(`t|${s.startAt}`);
          return (
            <button key={k} type="button" className={`desk-cell booked${past ? ' past' : ''}`} onClick={() => a && onBooked(a)} disabled={!a} aria-label={`${label} 已约 ${a?.client.name ?? ''}`}>
              <b>{a?.client.name ?? '已预约'}</b><small className="num">{time(s.startAt)}</small>
            </button>
          );
        }
        if (s?.status === 'open') {
          return (
            <button key={k} type="button" className={`desk-cell open${past ? ' past' : ''}`} disabled={past} onClick={() => onOpen(s)} aria-label={`${label} 可约，点击删除`}>
              <b>可约</b><small className="num">{time(s.startAt)}</small><Icon name="trash" size={13} className="desk-cell-del" />
            </button>
          );
        }
        if (s?.status === 'blocked') return <div key={k} className="desk-cell blocked" aria-label={`${label} 停诊`}><small>停诊</small></div>;
        const on = sel.has(k);
        return (
          <button key={k} type="button" className={`desk-cell empty${on ? ' sel' : ''}${d === today ? ' today' : ''}`} disabled={past}
            onClick={() => onEmpty(k)} aria-pressed={on} aria-label={`${label} ${on ? '已选择' : '空闲'}`}>
            {on ? <><Icon name="check" size={14} /><small>待发布</small></> : !past && <Icon name="plus" size={14} className="desk-cell-plus" />}
          </button>
        );
      })}
    </>
  );
}
