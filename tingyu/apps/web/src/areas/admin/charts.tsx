// Hand-written SVG charts for the admin console (F4). No chart library.
// Method: dataviz skill — one y-axis per panel (GMV and counts are different units, so they get
// two aligned panels sharing one x-axis + one crosshair instead of a dual-axis chart), thin marks,
// 4px rounded bar ends, 2px lines, surface-ringed dots, legend + table view, hover/keyboard tooltip.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { AdminOverview } from '@tingyu/shared';
import { yuan } from '../../lib/format';
import { axisLabel, niceTicks, shortDate } from './lib';

export function useWidth<T extends HTMLElement>() {
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

/** Column path: 4px rounded data-end, square at the baseline. */
export function colPath(x: number, w: number, yTop: number, yBase: number) {
  const h = yBase - yTop;
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${yBase}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBase}Z`;
}

type Day = AdminOverview['daily'][number];
const SERIES = {
  gmv: { label: 'GMV', color: 'var(--blue)' },
  appointments: { label: '预约数', color: 'var(--cyan)' },
  intakes: { label: 'AI 接待', color: 'var(--orange)' },
};

export function OverviewTrend({ daily }: { daily: Day[] }) {
  const [wrap, W] = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = daily.length;

  const padL = 52, padR = 52;
  const p1Top = 30, p1Bot = 190;           // GMV panel
  const p2Top = 248, p2Bot = 360;          // counts panel
  const H = 388;
  const plotW = Math.max(0, W - padL - padR);
  const band = n ? plotW / n : 0;
  const cx = (i: number) => padL + band * (i + 0.5);
  const bw = Math.max(2, Math.min(24, band * 0.56));
  const labelEvery = Math.max(1, Math.ceil(40 / Math.max(band, 1)));

  const gTicks = niceTicks(Math.max(...daily.map((d) => d.gmv), 0));
  const gTop = gTicks[gTicks.length - 1];
  const gy = (v: number) => p1Bot - (v / gTop) * (p1Bot - p1Top);
  const cTicks = niceTicks(Math.max(...daily.map((d) => Math.max(d.appointments, d.intakes)), 0), 3);
  const cTop = cTicks[cTicks.length - 1];
  const cy = (v: number) => p2Bot - (v / cTop) * (p2Bot - p2Top);
  const linePath = (k: 'appointments' | 'intakes') => daily.map((d, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${cy(d[k]).toFixed(1)}`).join('');

  const last = daily[n - 1];
  const endA = last ? cy(last.appointments) : 0, endI = last ? cy(last.intakes) : 0;
  const endLabelsFit = Math.abs(endA - endI) >= 14;

  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => (i === null ? 0 : Math.min(n - 1, i + 1))); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => (i === null ? n - 1 : Math.max(0, i - 1))); }
    if (e.key === 'Escape') setIdx(null);
  };
  const hov = idx !== null ? daily[idx] : null;
  const tipLeft = idx !== null ? (cx(idx) + 196 > W ? cx(idx) - 188 : cx(idx) + 14) : 0;
  const totals = daily.reduce((a, d) => ({ gmv: a.gmv + d.gmv, appointments: a.appointments + d.appointments, intakes: a.intakes + d.intakes }), { gmv: 0, appointments: 0, intakes: 0 });

  return (
    <div className="adm-chart">
      <div className="adm-chart-head">
        <div>
          <h2 className="adm-h2">近 14 天经营趋势</h2>
          <p className="adm-sub">合计 GMV <b className="num">{yuan(totals.gmv)}</b> · 预约 <b className="num">{totals.appointments}</b> 单 · AI 接待 <b className="num">{totals.intakes}</b> 次</p>
        </div>
        <div className="adm-chart-tools">
          <ul className="adm-legend" aria-label="图例">
            <li><i className="adm-key-rect" style={{ background: SERIES.gmv.color }} />GMV（元）</li>
            <li><i className="adm-key-line" style={{ background: SERIES.appointments.color }} />预约数</li>
            <li><i className="adm-key-line" style={{ background: SERIES.intakes.color }} />AI 接待</li>
          </ul>
          <div className="seg" role="tablist" aria-label="展示方式">
            <button type="button" role="tab" aria-selected={!table} onClick={() => setTable(false)}>图表</button>
            <button type="button" role="tab" aria-selected={table} onClick={() => setTable(true)}>数据表</button>
          </div>
        </div>
      </div>

      {table ? (
        <div className="adm-table-wrap">
          <table className="adm-table adm-table-compact">
            <thead><tr><th>日期</th><th className="r">GMV</th><th className="r">预约数</th><th className="r">AI 接待</th></tr></thead>
            <tbody>{daily.map((d) => <tr key={d.date}><td>{d.date}</td><td className="r num">{yuan(d.gmv)}</td><td className="r num">{d.appointments}</td><td className="r num">{d.intakes}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="adm-chart-body" ref={wrap}>
          {W > 0 && n > 0 && (
            <svg width={W} height={H} className="adm-svg" tabIndex={0} role="group"
              aria-label="近 14 天 GMV 柱状图与预约数、AI 接待折线图，使用左右方向键逐日查看"
              onPointerLeave={() => setIdx(null)} onKeyDown={onKey} onBlur={() => setIdx(null)}>
              {/* panel 1 · GMV */}
              <text x={padL} y={14} className="adm-ax-title">GMV（元）</text>
              {gTicks.map((t) => (
                <g key={`g${t}`}>
                  <line x1={padL} x2={W - padR} y1={gy(t)} y2={gy(t)} className={t === 0 ? 'adm-base' : 'adm-grid'} />
                  <text x={padL - 10} y={gy(t) + 4} textAnchor="end" className="adm-ax">{axisLabel(t, gTop)}</text>
                </g>
              ))}
              {daily.map((d, i) => (
                <path key={d.date} d={colPath(cx(i) - bw / 2, bw, gy(d.gmv), p1Bot)} fill={SERIES.gmv.color}
                  opacity={idx === null || idx === i ? 1 : 0.4} className="adm-bar" />
              ))}

              {/* panel 2 · counts */}
              <text x={padL} y={p2Top - 16} className="adm-ax-title">预约数 / AI 接待（次）</text>
              {cTicks.map((t) => (
                <g key={`c${t}`}>
                  <line x1={padL} x2={W - padR} y1={cy(t)} y2={cy(t)} className={t === 0 ? 'adm-base' : 'adm-grid'} />
                  <text x={padL - 10} y={cy(t) + 4} textAnchor="end" className="adm-ax">{t}</text>
                </g>
              ))}
              <path d={linePath('appointments')} className="adm-line" stroke={SERIES.appointments.color} />
              <path d={linePath('intakes')} className="adm-line" stroke={SERIES.intakes.color} />
              {idx === null && last && (
                <>
                  <circle cx={cx(n - 1)} cy={endA} r={4} fill={SERIES.appointments.color} className="adm-dot" />
                  <circle cx={cx(n - 1)} cy={endI} r={4} fill={SERIES.intakes.color} className="adm-dot" />
                  {endLabelsFit && <>
                    <text x={cx(n - 1) + 10} y={endA + 4} className="adm-end">{last.appointments}</text>
                    <text x={cx(n - 1) + 10} y={endI + 4} className="adm-end">{last.intakes}</text>
                  </>}
                </>
              )}

              {/* shared x-axis */}
              {daily.map((d, i) => ((n - 1 - i) % labelEvery === 0) && (
                <text key={`x${d.date}`} x={cx(i)} y={p2Bot + 20} textAnchor="middle" className={`adm-ax${i === idx ? ' on' : ''}`}>{shortDate(d.date)}</text>
              ))}

              {/* crosshair + hover layer */}
              {hov && idx !== null && (
                <g pointerEvents="none">
                  <line x1={cx(idx)} x2={cx(idx)} y1={p1Top - 6} y2={p2Bot} className="adm-cross" />
                  <circle cx={cx(idx)} cy={cy(hov.appointments)} r={4.5} fill={SERIES.appointments.color} className="adm-dot" />
                  <circle cx={cx(idx)} cy={cy(hov.intakes)} r={4.5} fill={SERIES.intakes.color} className="adm-dot" />
                </g>
              )}
              {daily.map((d, i) => (
                <rect key={`h${d.date}`} x={padL + band * i} y={p1Top - 10} width={band} height={p2Bot - p1Top + 30} fill="transparent"
                  onPointerEnter={() => setIdx(i)} onPointerDown={() => setIdx(i)} />
              ))}
            </svg>
          )}
          {hov && idx !== null && (
            <div className="adm-tip" style={{ left: tipLeft, top: 34 }} role="status">
              <div className="adm-tip-date">{hov.date}</div>
              <div className="adm-tip-row"><i className="adm-key-rect" style={{ background: SERIES.gmv.color }} /><b className="num">{yuan(hov.gmv)}</b><span>GMV</span></div>
              <div className="adm-tip-row"><i className="adm-key-line" style={{ background: SERIES.appointments.color }} /><b className="num">{hov.appointments}</b><span>预约数</span></div>
              <div className="adm-tip-row"><i className="adm-key-line" style={{ background: SERIES.intakes.color }} /><b className="num">{hov.intakes}</b><span>AI 接待</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tiny 14-point sparkline for a stat tile: de-emphasis hue, current day in the accent. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 88, h = 28, pad = 4;
  const max = Math.max(...values, 1);
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg width={w} height={h} className="adm-spark" role="img" aria-label={`${label}近 14 天走势`}>
      <path d={d} fill="none" stroke="var(--ink-4)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="var(--blue)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
