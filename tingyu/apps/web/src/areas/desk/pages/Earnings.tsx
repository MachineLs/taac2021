// /desk/earnings — monthly income summary and completed sessions.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { monthDay, time, weekday, yuan } from '../../../lib/format';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { monthLabel, monthRange, shiftMonth, thisMonth } from '../lib';
import { Avatar, Icon, ModeTag, PageHead } from '../ui';

const FEE = 0.3;

export default function Earnings() {
  const cur = thisMonth();
  const [month, setMonth] = useState(cur);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(cur, -i));
  const earn = useAsync(() => api.wbEarnings(month), [month]);
  const list = useAsync(() => { const r = monthRange(month); return api.wbAppointments({ from: r.from, to: r.to }); }, [month]);
  const done = (list.data ?? []).filter((a) => a.status === 'completed').sort((a, b) => b.startAt.localeCompare(a.startAt));
  const e = earn.data;

  return (
    <div className="desk-page">
      <PageHead
        title="收入"
        sub="按月统计已完成咨询的收入，平台每月 10 日结算上月净收入。"
        actions={
          <div className="desk-month">
            <button className="desk-icon-btn line" type="button" aria-label="上个月" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month === months[months.length - 1]}><Icon name="chevL" size={16} /></button>
            <select className="select" value={month} onChange={(ev) => setMonth(ev.target.value)} aria-label="选择月份">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <button className="desk-icon-btn line" type="button" aria-label="下个月" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === cur}><Icon name="chevR" size={16} /></button>
          </div>
        }
      />

      {earn.loading && !e ? <div className="card"><Loading /></div> : earn.error ? <div className="card"><ErrorState error={earn.error} onRetry={earn.reload} /></div> : e && (
        <div className="desk-earn-cards">
          <div className="card desk-earn-card"><span>咨询总额</span><b className="num">{yuan(e.gross)}</b><small>{e.sessions} 次已完成咨询</small></div>
          <div className="card desk-earn-card"><span>平台服务费</span><b className="num">−{yuan(e.platformFee)}</b><small>{e.gross ? `约 ${Math.round((e.platformFee / e.gross) * 100)}%` : '30%'}</small></div>
          <div className="card desk-earn-card main"><span>净收入</span><b className="num">{yuan(e.net)}</b><small>{month === cur ? '本月累计，下月 10 日结算' : '已计入结算'}</small></div>
          <div className="card desk-earn-card"><span>待结算</span><b className="num">{yuan(e.pendingSettlement)}</b><small>已支付、尚未完成的咨询</small></div>
        </div>
      )}

      <div className="desk-earn-grid">
        <section className="card desk-panel">
          <div className="desk-panel-head"><h2>{monthLabel(month)} 已完成咨询</h2><span className="muted num">{done.length} 次</span></div>
          {list.loading && !list.data ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} />
            : done.length === 0 ? <Empty title="本月还没有已完成的咨询" />
            : (
              <div className="desk-table-wrap">
                <table className="desk-table">
                  <thead><tr><th>时间</th><th>来访者</th><th>方式</th><th className="r">实付</th><th className="r">服务费</th><th className="r">净收入</th></tr></thead>
                  <tbody>
                    {done.map((a) => {
                      const fee = Math.round(a.amount * FEE);
                      return (
                        <tr key={a.id}>
                          <td><Link to={`/desk/appointments/${a.id}`}><b className="num">{monthDay(a.startAt)}</b> <span className="muted">{weekday(a.startAt)} {time(a.startAt)}</span></Link></td>
                          <td><div className="desk-cell-who"><Avatar src={a.client.avatar} name={a.client.name} size={28} /><span>{a.client.name}</span>{a.creatorId && <span className="desk-src">达人首单</span>}</div></td>
                          <td><ModeTag mode={a.mode} /></td>
                          <td className="r num">{yuan(a.amount)}</td>
                          <td className="r num muted">−{yuan(fee)}</td>
                          <td className="r num"><b>{yuan(a.amount - fee)}</b></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>
        <aside className="card desk-panel desk-earn-help">
          <div className="desk-panel-head"><h2>结算说明</h2></div>
          <ul>
            <li><b>平台服务费 30%</b>：覆盖支付通道、AI 接待与匹配、来访者保障、获客推广等。</li>
            <li><b>达人推广首单</b>：来访者经合作达人推荐的首单，服务费中的 10% 作为达人推广佣金，由平台承担，您的到手比例不变。</li>
            <li><b>结算周期</b>：每月 10 日结算上月已完成咨询的净收入，至绑定的银行账户。</li>
            <li><b>退款</b>：来访者在开始前 24 小时以上取消会全额退款，不计入收入。</li>
          </ul>
          <p className="muted desk-small">列表中服务费为按 30% 估算，实际以月度账单为准。</p>
        </aside>
      </div>
    </div>
  );
}
