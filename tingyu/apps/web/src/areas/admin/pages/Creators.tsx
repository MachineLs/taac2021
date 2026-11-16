// /admin/creators — 达人合作 (F4).
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { yuan } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { asError, compact } from '../lib';

export default function Creators() {
  const { data, error, loading, reload } = useAsync(() => api.adminCreators(), []);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState error={asError(error)} onRetry={reload} />;

  const sorted = [...data].sort((a, b) => b.commissionTotal - a.commissionTotal);
  const totals = data.reduce((s, c) => ({ followers: s.followers + c.followers, firstOrders: s.firstOrders + c.firstOrders, commission: s.commission + c.commissionTotal }), { followers: 0, firstOrders: 0, commission: 0 });

  return (
    <div className="adm-page">
      <section className="adm-kpis adm-kpis-4" aria-label="达人汇总">
        <div className="adm-kpi"><div className="adm-kpi-label">合作达人</div><div className="adm-kpi-value">{data.length}</div><div className="adm-kpi-sub">已签约并发放邀请码</div></div>
        <div className="adm-kpi"><div className="adm-kpi-label">覆盖粉丝</div><div className="adm-kpi-value">{compact(totals.followers)}</div><div className="adm-kpi-sub">各平台粉丝合计</div></div>
        <div className="adm-kpi"><div className="adm-kpi-label">带来首单</div><div className="adm-kpi-value">{totals.firstOrders}</div><div className="adm-kpi-sub">新客首单（已支付）</div></div>
        <div className="adm-kpi"><div className="adm-kpi-label">佣金合计</div><div className="adm-kpi-value">{yuan(totals.commission)}</div><div className="adm-kpi-sub">首单 10% 分成，按月结算</div></div>
      </section>

      {data.length === 0 ? <div className="card"><Empty title="暂无合作达人" /></div> : (
        <div className="card adm-table-card">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>达人</th><th>平台</th><th className="r">粉丝</th><th>邀请码</th><th className="r">分成比例</th><th className="r">首单数</th><th className="r">佣金合计</th></tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="adm-person">
                        <img className="avatar" src={c.avatar} alt="" width={36} height={36} />
                        <div><b>{c.name}</b><span className="adm-clip">{c.bio}</span></div>
                      </div>
                    </td>
                    <td><span className={`tag ${c.platform === '小红书' ? 'adm-tag-pink' : 'adm-tag-ink'}`}>{c.platform}</span></td>
                    <td className="r num">{compact(c.followers)}</td>
                    <td><code className="adm-code">{c.refCode}</code></td>
                    <td className="r num">{Math.round(c.commissionRate * 100)}%</td>
                    <td className="r num">{c.firstOrders}</td>
                    <td className="r"><b className="num">{yuan(c.commissionTotal)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="adm-footnote">达人只做心理科普与引导，不提供咨询、不承诺疗效；推广内容须标注「广告」。复购订单不分成。</p>
    </div>
  );
}
