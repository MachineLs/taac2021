// /admin — 运营总览 (F4).
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { yuan } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { OverviewTrend, Sparkline } from '../charts';
import { IconAlert, IconArrow, IconCalendar, IconCoin, IconMic, IconShield, IconUsers } from '../icons';
import { asError, compact } from '../lib';

export default function Overview() {
  const { data, error, loading, reload } = useAsync(() => api.adminOverview(), []);

  if (!data && loading) return <Loading full label="正在加载运营数据…" />;
  if (!data) return <ErrorState error={asError(error)} onRetry={reload} />;

  const d = data;
  const series = (k: 'gmv' | 'appointments' | 'intakes') => d.daily.map((x) => x[k]);
  const avgOrder = (() => { const n = d.daily.reduce((a, x) => a + x.appointments, 0); return n ? Math.round(d.daily.reduce((a, x) => a + x.gmv, 0) / n) : 0; })();

  return (
    <div className="adm-page">
      {d.openCrisis > 0 && (
        <Link to="/admin/crisis" className="adm-crisis-strip" role="alert">
          <span className="adm-pulse" aria-hidden="true" />
          <b>有 {d.openCrisis} 条危机预警尚未处理</b>
          <span className="adm-hide-sm">请在 3 分钟内联系用户并引导拨打 12356 / 120 / 110</span>
          <span className="adm-crisis-strip-go">立即处理 <IconArrow /></span>
        </Link>
      )}

      <section className="adm-kpis" aria-label="核心指标">
        <div className="adm-kpi">
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconUsers /></span>注册用户</div>
          <div className="adm-kpi-value">{compact(d.users)}</div>
          <div className="adm-kpi-sub">累计注册来访者</div>
        </div>
        <Link to="/admin/counselors" className="adm-kpi adm-kpi-link">
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconShield /></span>已上线咨询师</div>
          <div className="adm-kpi-value">{d.counselors.approved}</div>
          <div className="adm-kpi-sub">{d.counselors.pending > 0 ? <span className="badge badge-gold">待审核 {d.counselors.pending}</span> : '暂无待审核申请'}</div>
        </Link>
        <Link to="/admin/appointments" className="adm-kpi adm-kpi-link">
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconCalendar /></span>今日预约</div>
          <div className="adm-kpi-row"><span className="adm-kpi-value">{d.appointments.today}</span><Sparkline values={series('appointments')} label="预约数" /></div>
          <div className="adm-kpi-sub">待咨询 {d.appointments.paid} · 已完成 {d.appointments.completed}</div>
        </Link>
        <div className="adm-kpi">
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconCoin /></span>GMV</div>
          <div className="adm-kpi-row"><span className="adm-kpi-value">{yuan(d.gmv)}</span><Sparkline values={series('gmv')} label="GMV" /></div>
          <div className="adm-kpi-sub">已支付 + 已完成订单</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconMic /></span>AI 接待次数</div>
          <div className="adm-kpi-row"><span className="adm-kpi-value">{compact(d.intakes)}</span><Sparkline values={series('intakes')} label="AI 接待" /></div>
          <div className="adm-kpi-sub">小屿语音 / 文字接待</div>
        </div>
        <Link to="/admin/crisis" className={`adm-kpi adm-kpi-link${d.openCrisis > 0 ? ' adm-kpi-danger' : ''}`}>
          <div className="adm-kpi-label"><span className="adm-kpi-ic"><IconAlert /></span>未处理危机</div>
          <div className="adm-kpi-value">{d.openCrisis}</div>
          <div className="adm-kpi-sub">{d.openCrisis > 0 ? <>需立即处理 <IconArrow /></> : '当前无待处理预警'}</div>
        </Link>
      </section>

      <section className="card adm-card">
        {d.daily.length ? <OverviewTrend daily={d.daily} /> : <div className="st"><b>暂无趋势数据</b><span>近 14 天还没有订单或接待记录</span></div>}
      </section>

      <div className="adm-grid-2">
        <section className="card adm-card">
          <h2 className="adm-h2">待办事项</h2>
          <ul className="adm-todo">
            <li className={d.openCrisis > 0 ? 'urgent' : ''}>
              <span className="adm-todo-ic"><IconAlert /></span>
              <div><b>危机预警</b><span>{d.openCrisis > 0 ? `${d.openCrisis} 条未处理，须 3 分钟内响应` : '全部已处理'}</span></div>
              <Link className="btn btn-sm btn-line" to="/admin/crisis">{d.openCrisis > 0 ? '去处理' : '查看'}</Link>
            </li>
            <li>
              <span className="adm-todo-ic"><IconShield /></span>
              <div><b>咨询师入驻审核</b><span>{d.counselors.pending > 0 ? `${d.counselors.pending} 份申请等待审核` : '暂无待审核申请'}</span></div>
              <Link className="btn btn-sm btn-line" to="/admin/counselors">{d.counselors.pending > 0 ? '去审核' : '查看'}</Link>
            </li>
            <li>
              <span className="adm-todo-ic"><IconCalendar /></span>
              <div><b>待咨询订单</b><span>{d.appointments.paid} 单已支付，等待咨询开始</span></div>
              <Link className="btn btn-sm btn-line" to="/admin/appointments?status=paid">查看</Link>
            </li>
          </ul>
        </section>
        <section className="card adm-card">
          <h2 className="adm-h2">近 14 天概况</h2>
          <dl className="adm-facts">
            <div><dt>日均 GMV</dt><dd className="num">{yuan(Math.round(d.daily.reduce((a, x) => a + x.gmv, 0) / Math.max(1, d.daily.length)))}</dd></div>
            <div><dt>客单价</dt><dd className="num">{avgOrder ? yuan(avgOrder) : '—'}</dd></div>
            <div><dt>日均预约</dt><dd className="num">{(d.daily.reduce((a, x) => a + x.appointments, 0) / Math.max(1, d.daily.length)).toFixed(1)} 单</dd></div>
            <div><dt>日均 AI 接待</dt><dd className="num">{(d.daily.reduce((a, x) => a + x.intakes, 0) / Math.max(1, d.daily.length)).toFixed(1)} 次</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
