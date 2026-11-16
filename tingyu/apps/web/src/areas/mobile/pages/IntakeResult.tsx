// /m/intake/:id — the AI intake summary (接待小结) and matched counselors.
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CounselorDetail, IntakeSession, RiskLevel } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dateTime, modeLabel } from '../../../lib/format';
import { CrisisBanner } from '../../../components/CrisisBanner';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { CounselorCard, PriceTag, shortTitle } from '../CounselorCard';
import { modeFull, errMsg, goodRate, intakeStore, NavBar } from '../ui';

const SCALE_NAME: Record<string, string> = { phq9: '抑郁 PHQ-9', gad7: '焦虑 GAD-7', isi: '失眠 ISI' };
const RISK: Record<RiskLevel, { label: string; cls: string; hint: string }> = {
  low: { label: '低风险', cls: 'ok', hint: '适合常规心理咨询' },
  medium: { label: '中等风险', cls: 'warn', hint: '建议尽快与咨询师面谈' },
  high: { label: '需要重点关注', cls: 'bad', hint: '请优先确保安全，必要时拨打热线' },
};

export default function IntakeResult() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const s = useAsync(() => api.intakeGet(id), [id]);
  const recs = useAsync(async () => {
    const ids = s.data?.summary?.recommendedCounselorIds ?? [];
    const res = await Promise.allSettled(ids.map((x) => api.counselor(x)));
    return res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }, [s.data?.summary?.recommendedCounselorIds.join(',')]);

  if (s.loading && !s.data) return <><NavBar title="接待小结" /><Loading full /></>;
  if (s.error || !s.data) return <><NavBar title="接待小结" /><ErrorState error={new Error(errMsg(s.error, '小结加载失败'))} onRetry={s.reload} /></>;
  const sess: IntakeSession = s.data;
  const sum = sess.summary;

  if (!sum) {
    return (
      <>
        <NavBar title="接待小结" />
        <Empty title={sess.status === 'active' ? '这次接待还没有结束' : '小结正在生成'} hint="和小屿再多聊几句，结束后会生成你的接待小结"
          action={<button type="button" className="btn btn-blue btn-pill" onClick={() => { intakeStore.set(sess.id); nav('/m/voice'); }}>继续和小屿聊</button>} />
      </>
    );
  }
  const risk = RISK[sum.risk] ?? RISK.low;
  const steps = sum.plan.split(/\s*(?:→|->|＞|>)\s*/).filter(Boolean);
  const shareQ = `?intake=${sess.id}`;
  const [first, ...rest] = recs.data ?? [];

  return (
    <div className="m-intake">
      <NavBar title="接待小结" right={<Link to="/m/voice" className="m-nav-link" onClick={() => intakeStore.set(null)}>重新接待</Link>} />
      {(sess.crisis || sum.risk === 'high') && <div className="m-pad-t"><CrisisBanner /></div>}

      <section className="m-intake-hero">
        <div className="m-intake-hero-t"><span className="m-ai-badge"><Icon name="sparkle" size={14} />小屿 AI 接待小结</span><small>{dateTime(sess.endedAt ?? sess.createdAt)}</small></div>
        <div className="m-mood">
          <MoodRing score={sum.moodScore} />
          <div className="m-mood-main">
            <span>当前情绪</span>
            <b>{sum.mood}</b>
            <small>困扰持续 {sum.duration}</small>
          </div>
        </div>
        <div className="m-intake-topics">{sum.topics.map((t) => <span key={t}>{t}</span>)}</div>
      </section>

      <section className="m-card">
        <h3>量表估分<small className="m-h-note">根据对话估算，仅供参考</small></h3>
        <div className="m-scales">
          {sum.scales.map((sc) => {
            const pct = Math.min(100, Math.round((sc.score / Math.max(1, sc.max)) * 100));
            const tone = pct < 25 ? 'ok' : pct < 50 ? 'mid' : pct < 75 ? 'warn' : 'bad';
            return (
              <div key={sc.scale} className="m-scale">
                <div className="m-scale-h"><span>{SCALE_NAME[sc.scale] ?? sc.scale}</span><b className={`t-${tone}`}>{sc.level}</b><em className="num">{sc.score}<small>/{sc.max}</small></em></div>
                <div className="m-bar"><i className={`t-${tone}`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <Link to="/m/assess" className="m-inline-link">做一次正式量表测评，结果更准确 ›</Link>
      </section>

      <section className="m-card">
        <h3>风险评估</h3>
        <div className={`m-risk ${risk.cls}`}><span className="m-risk-dot" /><div><b>{risk.label}</b><small>{risk.hint}</small></div></div>
        <p className="m-risk-note">{sum.riskNote}</p>
      </section>

      <section className="m-card">
        <h3>建议方案</h3>
        <ol className="m-timeline">
          {steps.map((st, i) => <li key={i}><span className="num">{i + 1}</span><div><b>{st}</b>{i === 0 && <small>推荐方式：{modeFull(sum.modality)}</small>}</div></li>)}
        </ol>
        <p className="m-disclaimer"><Icon name="info" size={14} />以上方案由持证咨询师评估后执行和调整。小屿是 AI 助理，只做接待、初筛与匹配，不做诊断和治疗。</p>
      </section>

      <h2 className="m-section-t">为你匹配的咨询师</h2>
      {recs.loading && !recs.data ? <Loading /> : !first ? <Empty title="暂时没有匹配结果" action={<Link className="btn btn-soft btn-pill" to="/m/counselors">浏览全部咨询师</Link>} /> : (
        <>
          <BestMatch c={first} q={shareQ} />
          {rest.map((c) => <div key={c.id} className="m-pad-t"><CounselorCard c={c} extra={shareQ} /></div>)}
        </>
      )}
      {!user && (
        <div className="m-intake-login">
          <Icon name="lock" size={18} /><span>登录后小结会保存到你的账号，预约时可授权咨询师查看</span>
          <Link to={`/m/login?next=${encodeURIComponent(`/m/intake/${sess.id}`)}`}>登录</Link>
        </div>
      )}
      <div style={{ height: 'calc(24px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
  );
}

function MoodRing({ score }: { score: number }) {
  const r = 30, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score));
  const tone = v >= 60 ? 'ok' : v >= 40 ? 'mid' : 'warn';
  return (
    <div className={`m-ring t-${tone}`}>
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="bg" />
        <circle cx="36" cy="36" r={r} className="fg" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 36 36)" />
      </svg>
      <span className="num">{v}<small>情绪分</small></span>
    </div>
  );
}

function BestMatch({ c, q }: { c: CounselorDetail; q: string }) {
  const nav = useNavigate();
  return (
    <article className="m-best">
      <div className="m-best-flag"><Icon name="award" size={14} />最佳匹配</div>
      <div className="m-best-top">
        <img src={c.avatar} alt="" />
        <div>
          <div className="m-ccard-nm"><b>{c.name}</b><span className="badge">{shortTitle(c.title)}</span>{c.badges.map((b) => <span key={b} className="badge badge-gold">{b}</span>)}</div>
          <p>{c.headline}</p>
          <div className="m-ccard-stats"><span>从业 <b className="num">{c.years}</b> 年</span><span>好评 <b className="num">{goodRate(c.rating)}</b></span><span>复购 <b className="num">{c.rebookRate}%</b></span></div>
        </div>
      </div>
      <p className="m-best-why">“{c.intro.slice(0, 60)}{c.intro.length > 60 ? '…' : ''}”</p>
      <div className="m-tagrow">{c.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      <div className="m-best-foot">
        <PriceTag price={c.price} original={c.originalPrice} />
        <button type="button" className="btn btn-line btn-pill" onClick={() => nav(`/m/counselors/${c.id}${q}`)}>看主页</button>
        <button type="button" className="btn btn-blue btn-pill" onClick={() => nav(`/m/counselors/${c.id}${q}&book=1`)}>立即预约</button>
      </div>
    </article>
  );
}
