// /m/assess — scales list + my results.
import { Link } from 'react-router-dom';
import type { ScaleId } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { dateTime } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { Icon, type IconName } from '../icons';
import { errMsg, NavBar } from '../ui';

export const SCALE_META: Record<ScaleId, { icon: IconName; c: string; short: string; tag: string }> = {
  phq9: { icon: 'cloud', c: 'c5', short: '抑郁', tag: '情绪低落' },
  gad7: { icon: 'wave', c: 'c1', short: '焦虑', tag: '焦虑' },
  isi: { icon: 'moon', c: 'c7', short: '失眠', tag: '失眠' },
};
export const levelTone = (score: number, max: number) => { const p = score / Math.max(1, max); return p < 0.2 ? 'ok' : p < 0.45 ? 'mid' : p < 0.7 ? 'warn' : 'bad'; };

export default function Assess() {
  const { user } = useAuth();
  const scales = useAsync(() => api.scales(), []);
  const results = useAsync(async () => (user ? api.assessmentResults() : []), [user?.id]);
  return (
    <>
      <NavBar title="心理测评" />
      <section className="m-assess-hero">
        <h1>专业量表 · 3 分钟了解自己</h1>
        <p>采用国际通用的筛查量表，结果仅作自我了解参考，不构成医学诊断。</p>
      </section>
      {scales.loading && !scales.data ? <Loading /> : scales.error ? <ErrorState error={new Error(errMsg(scales.error, '量表加载失败'))} onRetry={scales.reload} /> : (
        <div className="m-stack">
          {scales.data!.map((s) => {
            const meta = SCALE_META[s.id] ?? SCALE_META.phq9;
            return (
              <Link key={s.id} to={`/m/assess/${s.id}`} className="m-scale-card">
                <span className={`m-scale-ic ${meta.c}`}><Icon name={meta.icon} size={24} /></span>
                <div><b>{s.name}</b><p>{s.description}</p><small>{s.questions.length} 题 · 约 {s.minutes} 分钟</small></div>
                <span className="btn btn-sm btn-pill btn-soft">开始</span>
              </Link>
            );
          })}
        </div>
      )}
      {user && (
        <>
          <h2 className="m-section-t">我的测评记录</h2>
          {results.loading && !results.data ? <Loading /> : !results.data?.length ? <p className="m-slots-empty" style={{ margin: '12px 16px' }}>还没有测评记录，选一个量表开始吧</p> : (
            <div className="m-list">
              {results.data.map((r) => (
                <Link key={r.id} to={`/m/assess/result/${r.id}`}>
                  <span className={`m-li-ic ${SCALE_META[r.scale]?.c ?? 'c1'}`}><Icon name={SCALE_META[r.scale]?.icon ?? 'doc'} size={18} /></span>
                  <span className="m-li-t">{SCALE_META[r.scale]?.short ?? r.scale}筛查<small className="m-li-sub">{dateTime(r.createdAt)}</small></span>
                  <span className={`m-lv t-${levelTone(r.score, r.max)}`}>{r.level} · {r.score}分</span><Icon name="right" size={16} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <p className="m-note"><Icon name="info" size={14} />测评结果仅供参考。如果你正经历严重困扰或有伤害自己的念头，请及时联系专业人员或拨打 12356。</p>
      <div style={{ height: 24 }} />
    </>
  );
}
