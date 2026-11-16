import { useEffect, useMemo, useState } from 'react';
import type { MoodCheckin } from '@tingyu/shared';
import { api } from '../../../../api/client';
import { useAsync } from '../../../../lib/useAsync';
import { dayKey, monthDay, time, relDay } from '../../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../../components/states';
import { useToast } from '../../../../components/Toast';
import { dayIso, errMsg } from '../../util';

type M = 1 | 2 | 3 | 4 | 5;
const MOODS: { v: M; e: string; l: string }[] = [
  { v: 1, e: '😣', l: '很糟' }, { v: 2, e: '😔', l: '低落' }, { v: 3, e: '😐', l: '一般' }, { v: 4, e: '🙂', l: '不错' }, { v: 5, e: '😄', l: '很好' },
];
const TAGS = ['工作', '睡眠', '家人', '感情', '朋友', '学习', '运动', '健康', '天气', '独处'];

function MoodChart({ data }: { data: MoodCheckin[] }) {
  const days = useMemo(() => { const out: string[] = []; for (let i = 29; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * 86400000).toISOString())); return out; }, []);
  const avg = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of data) { const k = dayKey(c.createdAt); if (!m.has(k)) m.set(k, []); m.get(k)!.push(c.mood); }
    return days.map((d) => { const v = m.get(d); return v ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  }, [data, days]);
  const W = 720, H = 220, L = 40, R = 12, T = 14, B = 30;
  const x = (i: number) => L + (i * (W - L - R)) / (days.length - 1);
  const y = (v: number) => T + ((5 - v) * (H - T - B)) / 4;
  const segs: string[] = []; let cur = '';
  avg.forEach((v, i) => { if (v == null) { if (cur) segs.push(cur); cur = ''; return; } cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
  if (cur) segs.push(cur);
  const pts = avg.map((v, i) => (v == null ? null : { i, v })).filter(Boolean) as { i: number; v: number }[];
  const area = pts.length > 1 ? `M${x(pts[0].i)},${H - B} ${pts.map((p) => `L${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} L${x(pts[pts.length - 1].i)},${H - B} Z` : '';
  const mean = pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
  return (
    <div className="site-chart">
      <div className="site-chart-h"><b>近 30 天情绪变化</b><span className="muted site-small">{pts.length ? `打卡 ${pts.length} 天 · 平均 ${mean!.toFixed(1)} 分` : '还没有记录'}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近 30 天情绪折线图" preserveAspectRatio="none">
        {[1, 2, 3, 4, 5].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="site-grid" /><text x={L - 10} y={y(v) + 4} textAnchor="end" className="site-axis">{MOODS[v - 1].l}</text></g>)}
        {days.map((d, i) => (i % 5 === 0 || i === days.length - 1) && <text key={d} x={x(i)} y={H - 8} textAnchor="middle" className="site-axis">{i === days.length - 1 ? '今天' : monthDay(dayIso(d))}</text>)}
        {area && <path d={area} className="site-area" />}
        {segs.map((s, i) => <path key={i} d={s} className="site-line" />)}
        {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={4} className="site-dot"><title>{`${monthDay(dayIso(days[p.i]))} · ${p.v.toFixed(1)}`}</title></circle>)}
      </svg>
    </div>
  );
}

export default function Mood() {
  const list = useAsync(() => api.moods(30), []);
  const toast = useToast();
  const [mood, setMood] = useState<M | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = '情绪记录 · 听屿心理'; }, []);
  const today = (list.data ?? []).filter((c) => relDay(c.createdAt) === '今天');

  const submit = async () => {
    if (!mood) { toast('先选一个最接近你现在状态的心情'); return; }
    setBusy(true);
    try {
      const c = await api.addMood({ mood, tags, note: note.trim() });
      list.setData([c, ...(list.data ?? [])]); setMood(null); setTags([]); setNote(''); toast('已记录，照顾好自己');
    } catch (e) { toast(errMsg(e, '记录失败')); } finally { setBusy(false); }
  };

  return (
    <div className="site-acc-page">
      <div className="site-acc-h"><div><h1>情绪记录</h1><p className="muted">每天花 10 秒记录心情，看见自己的变化</p></div></div>
      <div className="site-mood-grid">
        <section className="card card-pad site-checkin">
          <h2 className="site-h3">{today.length ? '再记录一次此刻的心情' : '今天感觉怎么样？'}</h2>
          <div className="site-moods" role="radiogroup" aria-label="心情">
            {MOODS.map((m) => <button key={m.v} type="button" role="radio" aria-checked={mood === m.v} className={mood === m.v ? 'on' : ''} onClick={() => setMood(m.v)}><span aria-hidden="true">{m.e}</span>{m.l}</button>)}
          </div>
          <div className="site-fchips">{TAGS.map((t) => <button key={t} type="button" className={`chip ${tags.includes(t) ? 'on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}</div>
          <textarea className="textarea site-mt12" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="想写点什么吗？（可选，仅自己可见）" aria-label="备注" />
          <button type="button" className="btn btn-blue btn-block site-mt12" disabled={busy || !mood} onClick={submit}>{busy ? '保存中…' : '记录心情'}</button>
        </section>
        <section className="card card-pad">
          {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : <MoodChart data={list.data} />}
        </section>
      </div>
      <h2 className="site-h2">最近记录</h2>
      {list.data && (list.data.length === 0 ? <div className="card"><Empty title="还没有情绪记录" hint="从今天开始记录吧" /></div> : (
        <ul className="card site-moodlist">
          {list.data.slice(0, 20).map((c) => (
            <li key={c.id}><span className="site-moodface" aria-hidden="true">{MOODS[c.mood - 1]?.e}</span>
              <div><b>{MOODS[c.mood - 1]?.l}</b>{c.tags.map((t) => <span key={t} className="tag">{t}</span>)}{c.note && <p>{c.note}</p>}</div>
              <span className="muted site-small num">{relDay(c.createdAt)} {time(c.createdAt)}</span></li>
          ))}
        </ul>
      ))}
      {toast.node}
    </div>
  );
}
