// /m/assess/:scale — one question per screen with a progress bar, then submit → result.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ScaleId } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { ConfirmSheet, errMsg, NavBar, Spin } from '../ui';

export default function AssessTake() {
  const { scale = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const scales = useAsync(() => api.scales(), []);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [quit, setQuit] = useState(false);

  if (scales.loading && !scales.data) return <><NavBar title="心理测评" /><Loading full /></>;
  const s = scales.data?.find((x) => x.id === scale);
  if (scales.error || !s) return <><NavBar title="心理测评" /><ErrorState error={new Error(scales.error ? errMsg(scales.error, '量表加载失败') : '没有找到这个量表')} onRetry={scales.reload} /></>;

  const n = s.questions.length;
  const opts = s.optionsPerQuestion?.[i] ?? s.options;
  const cur = answers[i] ?? null;
  const done = answers.filter((x) => x !== null && x !== undefined).length;

  const submit = async (all: (number | null)[]) => {
    setBusy(true);
    try { const r = await api.submitAssessment(s.id as ScaleId, all.map((x) => x ?? 0)); nav(`/m/assess/result/${r.id}`, { replace: true, state: r }); }
    catch (e) { toast(errMsg(e, '提交失败，请重试')); setBusy(false); }
  };
  const choose = (v: number) => {
    const next = [...answers]; next[i] = v; setAnswers(next);
    if (i < n - 1) window.setTimeout(() => setI(i + 1), 220);
  };

  return (
    <div className="m-take">
      <NavBar title={s.name} onBack={() => (done > 0 ? setQuit(true) : nav(-1))} />
      <div className="m-take-prog"><div className="m-bar"><i style={{ width: `${((i + (cur !== null ? 1 : 0)) / n) * 100}%` }} /></div><span className="num">{i + 1}/{n}</span></div>
      <section className="m-take-q" key={i}>
        <p className="m-take-prompt">{s.prompt}</p>
        <h2>{s.questions[i]}</h2>
        <div className="m-take-opts" role="radiogroup" aria-label="选项">
          {opts.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={cur === o.value} className={cur === o.value ? 'on' : ''} onClick={() => choose(o.value)}>
              {o.label}<i className="m-radio" />
            </button>
          ))}
        </div>
      </section>
      <div className="m-take-nav">
        <button type="button" className="btn btn-line btn-lg" disabled={i === 0} onClick={() => setI(i - 1)}>上一题</button>
        {i < n - 1
          ? <button type="button" className="btn btn-soft btn-lg" disabled={cur === null} onClick={() => setI(i + 1)}>下一题</button>
          : <button type="button" className="btn btn-blue btn-lg" disabled={busy || done < n} onClick={() => submit(answers)}>{busy && <Spin />}查看结果</button>}
      </div>
      <p className="m-take-foot">请根据过去两周的真实感受作答，没有对错之分</p>
      <ConfirmSheet open={quit} onClose={() => setQuit(false)} title="退出测评？" confirm="退出" tone="danger" body="当前作答进度不会保存。" onConfirm={() => nav(-1)} />
      {toast.node}
    </div>
  );
}
