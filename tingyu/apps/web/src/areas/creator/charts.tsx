// Hand-written SVG charts for the creator dashboard (F4). No chart library.
// Trend = small multiples (visits / signups / orders differ by orders of magnitude, so each panel
// gets its own y-axis instead of a dual axis), with one shared crosshair + readout. Funnel = bars
// proportional to the first stage.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CreatorStats } from '@tingyu/shared';
import { niceTicks, pct, shortDate } from './lib';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Day = CreatorStats['daily'][number];
type Key = 'visits' | 'signups' | 'orders';
const SERIES: { key: Key; label: string; unit: string; color: string }[] = [
  { key: 'visits', label: '访问', unit: '次', color: 'var(--blue)' },
  { key: 'signups', label: '注册', unit: '人', color: 'var(--cyan)' },
  { key: 'orders', label: '订单', unit: '单', color: 'var(--orange)' },
];

export function TrendMultiples({ daily }: { daily: Day[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const hov = idx !== null ? daily[idx] : null;
  const onKey = (e: KeyboardEvent) => {
    const n = daily.length;
    if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => (i === null ? 0 : Math.min(n - 1, i + 1))); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => (i === null ? n - 1 : Math.max(0, i - 1))); }
    if (e.key === 'Escape') setIdx(null);
  };
  return (
    <div className="cr-trend">
      <div className="cr-card-head">
        <div>
          <h2 className="cr-h2">近 30 天趋势</h2>
          <p className="cr-sub cr-readout" aria-live="polite">
            {hov ? <><b>{hov.date}</b>{SERIES.map((s) => <span key={s.key}><i className="cr-key-line" style={{ background: s.color }} />{s.label} <b className="num">{hov[s.key]}</b></span>)}</>
              : '悬停或用方向键查看每日数据'}
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="展示方式">
          <button type="button" role="tab" aria-selected={!table} onClick={() => setTable(false)}>图表</button>
          <button type="button" role="tab" aria-selected={table} onClick={() => setTable(true)}>数据表</button>
        </div>
      </div>
      {table ? (
        <div className="cr-table-wrap cr-table-scroll">
          <table className="cr-table">
            <thead><tr><th>日期</th>{SERIES.map((s) => <th key={s.key} className="r">{s.label}</th>)}</tr></thead>
            <tbody>{[...daily].reverse().map((d) => <tr key={d.date}><td>{d.date}</td>{SERIES.map((s) => <td key={s.key} className="r num">{d[s.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="cr-multiples" tabIndex={0} role="group" aria-label="近 30 天访问、注册、订单趋势，使用左右方向键逐日查看" onKeyDown={onKey} onBlur={() => setIdx(null)}>
          {SERIES.map((s) => <Panel key={s.key} daily={daily} s={s} idx={idx} setIdx={setIdx} />)}
        </div>
      )}
    </div>
  );
}

function Panel({ daily, s, idx, setIdx }: { daily: Day[]; s: (typeof SERIES)[number]; idx: number | null; setIdx: (i: number | null) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const n = daily.length;
  const H = 150, padL = 34, padR = 30, top = 10, bot = 124;
  const plotW = Math.max(0, W - padL - padR);
  const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const vals = daily.map((d) => d[s.key]);
  const ticks = niceTicks(Math.max(...vals, 0));
  const tTop = ticks[ticks.length - 1];
  const y = (v: number) => bot - (v / tTop) * (bot - top);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${bot}L${x(0).toFixed(1)},${bot}Z` : '';
  const total = vals.reduce((a, v) => a + v, 0);
  const last = vals[n - 1] ?? 0;
  const step = n > 1 ? plotW / (n - 1) : plotW;
  const xLabels = n ? [0, Math.floor((n - 1) / 2), n - 1] : [];

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <span><i className="cr-key-line" style={{ background: s.color }} />{s.label}</span>
        <b className="num">{total.toLocaleString('zh-CN')}<small> {s.unit} / 30 天</small></b>
      </div>
      <div ref={ref} className="cr-panel-plot">
        {W > 0 && n > 0 && (
          <svg width={W} height={H} className="cr-svg" onPointerLeave={() => setIdx(null)} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'cr-base' : 'cr-grid'} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="cr-ax">{t.toLocaleString('zh-CN')}</text>
              </g>
            ))}
            <path d={area} fill={s.color} opacity={0.1} />
            <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {idx === null && <>
              <circle cx={x(n - 1)} cy={y(last)} r={4} fill={s.color} className="cr-dot" />
              <text x={x(n - 1) + 8} y={y(last) + 4} className="cr-end">{last}</text>
            </>}
            {xLabels.map((i, k) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} className="cr-ax">{shortDate(daily[i].date)}</text>
            ))}
            {idx !== null && (
              <g pointerEvents="none">
                <line x1={x(idx)} x2={x(idx)} y1={top} y2={bot} className="cr-cross" />
                <circle cx={x(idx)} cy={y(vals[idx])} r={4.5} fill={s.color} className="cr-dot" />
                <text x={x(idx) + (x(idx) > W - 60 ? -8 : 8)} y={Math.max(top + 10, y(vals[idx]) - 8)} textAnchor={x(idx) > W - 60 ? 'end' : 'start'} className="cr-end">{vals[idx]}</text>
              </g>
            )}
            {daily.map((d, i) => (
              <rect key={d.date} x={x(i) - step / 2} y={0} width={Math.max(step, 1)} height={bot + 4} fill="transparent"
                onPointerEnter={() => setIdx(i)} onPointerDown={() => setIdx(i)} />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

export function Funnel({ stats }: { stats: Pick<CreatorStats, 'visits' | 'signups' | 'intakes' | 'firstOrders'> }) {
  const steps = [
    { label: '访问落地页', value: stats.visits },
    { label: '注册账号', value: stats.signups },
    { label: 'AI 接待', value: stats.intakes },
    { label: '首单支付', value: stats.firstOrders },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <ol className="cr-funnel">
      {steps.map((s, i) => {
        const w = s.value > 0 ? Math.max(0.6, (s.value / max) * 100) : 0;
        return (
          <li key={s.label}>
            <div className="cr-funnel-label"><span>{s.label}</span><b className="num">{s.value.toLocaleString('zh-CN')}</b></div>
            <div className="cr-funnel-track" role="img" aria-label={`${s.label} ${s.value}`}>
              <div className="cr-funnel-bar" style={{ width: `${w}%` }} />
            </div>
            {i > 0 && <span className="cr-funnel-rate">较上一步 <b className="num">{pct(s.value, steps[i - 1].value)}</b> · 占访问 {pct(s.value, steps[0].value)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Decorative QR-style mark derived from the link (not a scannable code). */
export function QrMark({ text, size = 132 }: { text: string; size?: number }) {
  const N = 25;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const finder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
  const cells: string[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!finder(r, c) && rnd() > 0.52) cells.push(`M${c},${r}h1v1h-1z`);
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.4} fill="none" stroke="var(--ink)" strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} fill="var(--ink)" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="cr-qr" aria-hidden="true">
      <rect x={-1} y={-1} width={N + 2} height={N + 2} rx={2} fill="var(--surface)" />
      <path d={cells.join('')} fill="var(--ink)" />
      {eye(0, 0)}{eye(N - 7, 0)}{eye(0, N - 7)}
      <rect x={N / 2 - 2.5} y={N / 2 - 2.5} width={5} height={5} rx={1.2} fill="var(--blue)" stroke="var(--surface)" strokeWidth={0.8} />
      <text x={N / 2} y={N / 2 + 1.3} textAnchor="middle" fontSize={3.4} fontWeight={800} fill="var(--surface)">屿</text>
    </svg>
  );
}
