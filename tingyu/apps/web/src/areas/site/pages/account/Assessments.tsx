import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AssessmentResult, ScaleDefinition } from '@tingyu/shared';
import { api } from '../../../../api/client';
import { useAsync } from '../../../../lib/useAsync';
import { dateTime } from '../../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../../components/states';
import { useToast } from '../../../../components/Toast';
import { Icon } from '../../components/Icon';
import { errMsg } from '../../util';

const SCALE_TAG: Record<string, string> = { phq9: '情绪低落', gad7: '焦虑', isi: '失眠' };

function Quiz({ scale, onCancel, onDone }: { scale: ScaleDefinition; onCancel: () => void; onDone: (r: AssessmentResult) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => scale.questions.map(() => null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = answers.filter((x) => x !== null).length;
  const submit = async () => {
    const first = answers.findIndex((x) => x === null);
    if (first >= 0) { setErr(`还有 ${answers.length - done} 题未作答（第 ${first + 1} 题）`); document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setBusy(true); setErr(null);
    try { onDone(await api.submitAssessment(scale.id, answers as number[])); } catch (e) { setErr(errMsg(e, '提交失败')); } finally { setBusy(false); }
  };
  return (
    <div className="card site-quiz">
      <div className="site-quiz-h">
        <button type="button" className="btn btn-text" onClick={onCancel}><Icon name="left" size={14} />返回</button>
        <div><h2>{scale.name}</h2><p className="muted">{scale.prompt}</p></div>
        <span className="num site-quiz-n">{done}/{scale.questions.length}</span>
      </div>
      <div className="site-meter"><i style={{ width: `${(done / scale.questions.length) * 100}%` }} /></div>
      <ol className="site-qs">
        {scale.questions.map((q, i) => {
          const opts = scale.optionsPerQuestion?.[i] ?? scale.options;
          return (
            <li key={i} id={`q-${i}`} className={answers[i] === null ? '' : 'done'}>
              <p><span className="num">{i + 1}.</span> {q}</p>
              <div className="site-opts" role="radiogroup" aria-label={`第 ${i + 1} 题`}>
                {opts.map((o) => (
                  <button key={o.value} type="button" role="radio" aria-checked={answers[i] === o.value} className={answers[i] === o.value ? 'on' : ''}
                    onClick={() => setAnswers(answers.map((x, j) => (j === i ? o.value : x)))}>{o.label}</button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {err && <p className="form-error">{err}</p>}
      <div className="site-quiz-f"><span className="muted site-small">测评结果仅供自我了解，不构成诊断。</span><button type="button" className="btn btn-blue btn-lg" disabled={busy} onClick={submit}>{busy ? '提交中…' : '提交并查看结果'}</button></div>
    </div>
  );
}

function ResultCard({ r, scale, onBack }: { r: AssessmentResult; scale?: ScaleDefinition; onBack: () => void }) {
  const pct = Math.round((r.score / r.max) * 100);
  return (
    <div className="card site-result">
      <button type="button" className="btn btn-text" onClick={onBack}><Icon name="left" size={14} />返回测评列表</button>
      <div className="site-result-main">
        <div className="site-ring" style={{ ['--p' as string]: `${pct}` }}><b className="num">{r.score}</b><span className="num">/ {r.max}</span></div>
        <div>
          <span className="muted">{scale?.name ?? r.scale} · {dateTime(r.createdAt)}</span>
          <h2>{r.level}</h2>
          <p>{r.interpretation}</p>
        </div>
      </div>
      <div className="site-result-acts">
        <Link className="btn btn-blue" to={`/counselors?tag=${encodeURIComponent(SCALE_TAG[r.scale] ?? '')}`}>找擅长的咨询师</Link>
        <Link className="btn btn-line" to="/intake"><Icon name="mic" size={16} />和小屿聊聊</Link>
      </div>
      <p className="site-disclaimer">量表结果只反映最近一段时间的状态，仅供参考，不构成医学诊断。如果分数较高或持续不适，建议尽快联系专业人士。</p>
    </div>
  );
}

export default function Assessments() {
  const scales = useAsync(() => api.scales(), []);
  const results = useAsync(() => api.assessmentResults(), []);
  const toast = useToast();
  const [taking, setTaking] = useState<ScaleDefinition | null>(null);
  const [showing, setShowing] = useState<AssessmentResult | null>(null);
  useEffect(() => { document.title = '心理测评 · 听屿心理'; }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [taking, showing]);

  if (taking) return <div className="site-acc-page"><Quiz scale={taking} onCancel={() => setTaking(null)} onDone={(r) => { setTaking(null); setShowing(r); results.setData([r, ...(results.data ?? [])]); toast('测评完成'); }} />{toast.node}</div>;
  if (showing) return <div className="site-acc-page"><ResultCard r={showing} scale={scales.data?.find((s) => s.id === showing.scale)} onBack={() => setShowing(null)} />{toast.node}</div>;

  const latest = (id: string) => results.data?.find((r) => r.scale === id);
  return (
    <div className="site-acc-page">
      <div className="site-acc-h"><div><h1>心理测评</h1><p className="muted">国际通用的标准化量表，几分钟了解自己最近的状态</p></div></div>
      {scales.error ? <ErrorState error={scales.error} onRetry={scales.reload} /> : !scales.data ? <Loading /> : (
        <div className="site-scales">
          {scales.data.map((s) => {
            const l = latest(s.id);
            return (
              <article key={s.id} className="card site-scale">
                <span className="site-scale-ic"><Icon name="clipboard" size={22} /></span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="site-scale-meta"><span><Icon name="clock" size={14} />约 {s.minutes} 分钟</span><span>{s.questions.length} 题</span></div>
                {l && <button type="button" className="site-scale-last" onClick={() => setShowing(l)}>上次：<b>{l.level}</b> <span className="num">{l.score}/{l.max}</span><Icon name="right" size={12} /></button>}
                <button type="button" className="btn btn-blue btn-block" onClick={() => setTaking(s)}>{l ? '再测一次' : '开始测评'}</button>
              </article>
            );
          })}
        </div>
      )}
      <h2 className="site-h2">测评历史</h2>
      {results.error ? <ErrorState error={results.error} onRetry={results.reload} /> : !results.data ? <Loading />
        : results.data.length === 0 ? <div className="card"><Empty title="还没有测评记录" hint="完成一次测评后，结果会保存在这里，方便对比变化" /></div>
        : (
          <div className="card site-table-wrap">
            <table className="site-table">
              <thead><tr><th>量表</th><th>时间</th><th>得分</th><th>结果</th><th /></tr></thead>
              <tbody>{results.data.map((r) => (
                <tr key={r.id}><td>{scales.data?.find((s) => s.id === r.scale)?.name ?? r.scale}</td><td className="num">{dateTime(r.createdAt)}</td><td className="num">{r.score} / {r.max}</td><td><span className="badge badge-gray">{r.level}</span></td><td><button type="button" className="btn btn-text btn-sm" onClick={() => setShowing(r)}>查看</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      {toast.node}
    </div>
  );
}
