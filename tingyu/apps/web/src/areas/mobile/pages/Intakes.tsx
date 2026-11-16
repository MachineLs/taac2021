// /m/intakes — my AI intake history (接待记录).
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { dateTime } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { errMsg, NavBar } from '../ui';

const RISK_LABEL = { low: '低风险', medium: '中等风险', high: '需关注' } as const;

export default function Intakes() {
  const list = useAsync(() => api.intakeMine(), []);
  return (
    <>
      <NavBar title="接待记录" />
      {list.loading && !list.data ? <Loading full />
        : list.error ? <ErrorState error={new Error(errMsg(list.error, '加载失败'))} onRetry={list.reload} />
        : !list.data?.length ? <Empty title="还没有接待记录" hint="和小屿聊 3 分钟，帮你找到合适的咨询师" action={<Link className="btn btn-blue btn-pill" to="/m/voice">和小屿聊聊</Link>} />
        : (
          <div className="m-stack">
            {list.data.map((s) => (
              <Link key={s.id} to={`/m/intake/${s.id}`} className="m-intake-row">
                <span className="m-li-ic c1"><Icon name="sparkle" size={18} /></span>
                <div>
                  <b>{s.summary?.mood ?? (s.status === 'active' ? '接待进行中' : '接待小结')}</b>
                  <small>{s.summary?.topics.join(' · ') || '—'}</small>
                  <small>{dateTime(s.createdAt)}</small>
                </div>
                <span className={`badge ${s.risk === 'high' ? 'badge-red' : s.risk === 'medium' ? 'badge-gold' : 'badge-green'}`}>{RISK_LABEL[s.risk]}</span>
              </Link>
            ))}
          </div>
        )}
    </>
  );
}
