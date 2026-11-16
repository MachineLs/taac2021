// /m/mood — mood diary: 5-level check-in, tags, note; 30-day curve; history list.
import { useMemo, useState } from 'react';
import type { MoodCheckin } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dayKey, relDay, time } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { errMsg, NavBar, Spin } from '../ui';

type Lv = 1 | 2 | 3 | 4 | 5;
export const MOOD_LABEL = ['', '很糟', '低落', '一般', '不错', '很好'];
const MOOD_TONE = ['', 'red', 'orange', 'amber', 'cyan', 'green'];
const TAGS = ['工作', '学习', '睡眠', '家人', '伴侣', '朋友', '健康', '运动', '天气', '独处'];

export function MoodFace({ v, size = 40 }: { v: Lv; size?: number }) {
  const mouth = { 1: 'M14 29c3-4 9-4 12 0', 2: 'M14.5 28c3-2 8-2 11 0', 3: 'M14.5 27h11', 4: 'M14.5 26c3 2.5 8 2.5 11 0', 5: 'M13.5 25c3 5 10 5 13 0' }[v];
  return (
    <svg className={`m-face t-${MOOD_TONE[v]}`} viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="18" className="f" />
      <circle cx="14.5" cy="17" r="2" className="e" /><circle cx="25.5" cy="17" r="2" className="e" />
      <path d={mouth} className="m" />
    </svg>
  );
}

export default function Mood() {
  const toast = useToast();
  const list = useAsync(() => api.moods(30), []);
  const [mood, setMood] = useState<Lv | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const today = list.data?.find((m) => dayKey(m.createdAt) === dayKey(new Date().toISOString()));

  const save = async () => {
    if (!mood) return;
    setBusy(true);
    try {
      const m = await api.addMood({ mood, tags, note: note.trim() });
      list.setData([m, ...(list.data ?? [])]);
      setMood(null); setTags([]); setNote(''); toast('打卡成功，坚持记录会更了解自己');
    } catch (e) { toast(errMsg(e, '保存失败')); }
    finally { setBusy(false); }
  };

  const sorted = useMemo(() => [...(list.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [list.data]);
  const days = new Set(sorted.map((m) => dayKey(m.createdAt))).size;
  const avg = sorted.length ? sorted.reduce((s, m) => s + m.mood, 0) / sorted.length : 0;

  return (
    <div className="m-mood-page">
      <NavBar title="情绪日记" />
      <section className="m-card m-mood-in">
        <h3>{today ? '今天已打卡，还想再记一笔吗？' : '今天心情怎么样？'}</h3>
        <div className="m-faces" role="radiogroup" aria-label="选择心情">
          {([1, 2, 3, 4, 5] as Lv[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={mood === v} className={mood === v ? 'on' : ''} onClick={() => setMood(v)}>
              <MoodFace v={v} size={44} /><span>{MOOD_LABEL[v]}</span>
            </button>
          ))}
        </div>
        {mood && (
          <div className="m-mood-more">
            <div className="m-chips-wrap">{TAGS.map((t) => <button key={t} type="button" className={`chip${tags.includes(t) ? ' on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>)}</div>
            <textarea className="textarea" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="写点什么吧，发生了什么、有什么感受（选填）" aria-label="备注" />
            <button type="button" className="btn btn-blue btn-lg btn-block btn-pill" disabled={busy} onClick={save}>{busy && <Spin />}保存打卡</button>
          </div>
        )}
      </section>

      <section className="m-card">
        <h3>近 30 天情绪曲线</h3>
        {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState error={new Error(errMsg(list.error, '加载失败'))} onRetry={list.reload} /> : (
          <>
            <div className="m-mood-sum">
              <div><b className="num">{days}</b><span>打卡天数</span></div>
              <div><b className="num">{avg ? avg.toFixed(1) : '–'}</b><span>平均心情</span></div>
              <div><b>{avg ? MOOD_LABEL[Math.round(avg)] : '–'}</b><span>整体状态</span></div>
            </div>
            <Chart data={sorted} />
          </>
        )}
      </section>

      <h2 className="m-section-t">打卡记录</h2>
      {list.data && !sorted.length ? <Empty title="还没有记录" hint="每天花 10 秒记录心情，帮你和咨询师更了解自己" /> : (
        <div className="m-stack">
          {sorted.map((m) => (
            <div key={m.id} className="m-mood-row">
              <MoodFace v={m.mood} size={36} />
              <div>
                <div className="m-mood-row-h"><b>{MOOD_LABEL[m.mood]}</b><small>{relDay(m.createdAt)} {time(m.createdAt)}</small></div>
                {m.tags.length > 0 && <div className="m-review-tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                {m.note && <p>{m.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 24 }} />
      {toast.node}
    </div>
  );
}

function Chart({ data }: { data: MoodCheckin[] }) {
  const W = 340, H = 150, L = 26, R = 8, T = 10, B = 22;
  const days = Array.from({ length: 30 }, (_, i) => { const iso = new Date(Date.now() - (29 - i) * 86400000).toISOString(); return { key: dayKey(iso), iso }; });
  const byDay: Record<string, number[]> = {};
  data.forEach((m) => { (byDay[dayKey(m.createdAt)] ||= []).push(m.mood); });
  const x = (i: number) => L + (i * (W - L - R)) / 29;
  const y = (v: number) => T + ((5 - v) * (H - T - B)) / 4;
  const pts = days.map((d, i) => { const v = byDay[d.key]; return v ? { x: x(i), y: y(v.reduce((a, b) => a + b, 0) / v.length), v: v.reduce((a, b) => a + b, 0) / v.length } : null; }).filter(Boolean) as { x: number; y: number; v: number }[];
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - B} L${pts[0].x.toFixed(1)} ${H - B} Z` : '';
  return (
    <svg className="m-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`近 30 天共 ${pts.length} 天有打卡`}>
      <defs><linearGradient id="m-mood-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="g0" /><stop offset="1" className="g1" /></linearGradient></defs>
      {[1, 2, 3, 4, 5].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 3.5} className="yl">{MOOD_LABEL[v].slice(0, 1) === '很' ? (v === 1 ? '糟' : '好') : MOOD_LABEL[v].slice(0, 1)}</text></g>)}
      {[0, 7, 14, 21, 29].map((i) => <text key={i} x={x(i)} y={H - 6} className="xl">{i === 29 ? '今天' : `${days[i].key.slice(5).replace('-', '/')}`}</text>)}
      {area && <path d={area} fill="url(#m-mood-g)" />}
      {pts.length > 1 && <path d={line} className="ln" />}
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.2} className={`pt t-${MOOD_TONE[Math.round(p.v)]}`} />)}
      {pts.length === 0 && <text x={W / 2} y={H / 2} className="none">打卡后这里会出现你的情绪曲线</text>}
    </svg>
  );
}
