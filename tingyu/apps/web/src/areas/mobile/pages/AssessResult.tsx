// /m/assess/result/:id — assessment result.
import { Link, useLocation, useParams } from 'react-router-dom';
import type { AssessmentResult } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dateTime } from '../../../lib/format';
import { CrisisBanner } from '../../../components/CrisisBanner';
import { ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { errMsg, NavBar } from '../ui';
import { levelTone, SCALE_META } from './Assess';

export default function AssessResult() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const fromNav = (loc.state as AssessmentResult | null)?.id === id ? (loc.state as AssessmentResult) : null;
  const r = useAsync(async () => fromNav ?? (await api.assessmentResults()).find((x) => x.id === id) ?? null, [id]);
  if (r.loading && !r.data) return <><NavBar title="测评结果" /><Loading full /></>;
  if (r.error || !r.data) return <><NavBar title="测评结果" /><ErrorState error={new Error(r.error ? errMsg(r.error, '结果加载失败') : '没有找到这份测评结果')} onRetry={r.reload} /></>;
  const x = r.data;
  const meta = SCALE_META[x.scale] ?? SCALE_META.phq9;
  const tone = levelTone(x.score, x.max);
  const pct = Math.min(100, (x.score / Math.max(1, x.max)) * 100);
  // PHQ-9 item 9 asks about self-harm thoughts
  const selfHarm = x.scale === 'phq9' && (x.answers[8] ?? 0) > 0;
  return (
    <div className="m-result">
      <NavBar title="测评结果" back="/m/assess" />
      {selfHarm && <div className="m-pad-t"><CrisisBanner message="你在测评中提到了伤害自己的想法。你的安全最重要，请马上联系专业帮助：" /></div>}
      <section className={`m-result-hero t-${tone}`}>
        <span>{meta.short}筛查 · {dateTime(x.createdAt)}</span>
        <div className="m-result-score"><b className="num">{x.score}</b><small>/ {x.max} 分</small></div>
        <em>{x.level}</em>
        <div className="m-gauge"><i style={{ left: `${pct}%` }} /></div>
        <div className="m-gauge-l"><span>无</span><span>轻度</span><span>中度</span><span>重度</span></div>
      </section>
      <section className="m-card">
        <h3>结果解读</h3>
        <p className="m-dt-intro">{x.interpretation}</p>
        <p className="m-disclaimer"><Icon name="info" size={14} />量表筛查结果仅供自我了解参考，不构成医学诊断。如需进一步评估，请咨询持证专业人员。</p>
      </section>
      <section className="m-card">
        <h3>接下来可以</h3>
        <div className="m-next-steps">
          <Link to="/m/voice"><span className="m-li-ic c1"><Icon name="mic" size={18} /></span><div><b>和小屿聊聊</b><small>3 分钟，帮你匹配合适的咨询师</small></div><Icon name="right" size={16} /></Link>
          <Link to={`/m/counselors?tag=${encodeURIComponent(meta.tag)}`}><span className="m-li-ic c3"><Icon name="people" size={18} /></span><div><b>找擅长「{meta.tag}」的咨询师</b><small>持证咨询师 · 可视频/语音咨询</small></div><Icon name="right" size={16} /></Link>
          <Link to="/m/mood"><span className="m-li-ic c6"><Icon name="smile" size={18} /></span><div><b>坚持记录情绪日记</b><small>每天 10 秒，看见自己的变化</small></div><Icon name="right" size={16} /></Link>
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );
}
