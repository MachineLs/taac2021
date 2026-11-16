// /admin/crisis — 危机预警 (F4). The most important safety screen: keep it fast, clear, and auto-refreshing.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrisisAlert } from '@tingyu/shared';
import { HOTLINES } from '@tingyu/shared';
import { api } from '../../../api/client';
import { ago, dateTime, time } from '../../../lib/format';
import { useToast } from '../../../components/Toast';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { useAdminShell } from '../AdminLayout';
import { IconPhone, IconRefresh } from '../icons';
import { asError, errText } from '../lib';

type Status = CrisisAlert['status'];
const TABS: { key: Status; label: string }[] = [
  { key: 'open', label: '未处理' }, { key: 'handling', label: '处理中' }, { key: 'resolved', label: '已解决' },
];
const REFRESH_MS = 15000;

export default function Crisis() {
  const [list, setList] = useState<CrisisAlert[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Status>('open');
  const [, tick] = useState(0);
  const toast = useToast();
  const { refreshCrisis } = useAdminShell();
  const knownOpen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.adminCrisis();
      const openIds = new Set(data.filter((a) => a.status === 'open').map((a) => a.id));
      if (knownOpen.current) {
        const fresh = [...openIds].filter((id) => !knownOpen.current!.has(id)).length;
        if (fresh > 0) toast(`收到 ${fresh} 条新的危机预警，请立即处理`);
      }
      knownOpen.current = openIds;
      setList(data); setError(null); setUpdatedAt(new Date().toISOString());
      refreshCrisis();
    } catch (e) { setError(e); }
    finally { setRefreshing(false); }
  }, [toast, refreshCrisis]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    const clock = window.setInterval(() => tick((n) => n + 1), 30000); // keep "已等待" fresh
    return () => { window.clearInterval(t); window.clearInterval(clock); };
  }, [load]);

  const onUpdated = (a: CrisisAlert) => {
    setList((l) => (l ? l.map((x) => (x.id === a.id ? a : x)) : l));
    knownOpen.current?.delete(a.id);
    refreshCrisis();
    toast(a.status === 'handling' ? '已标记为处理中，请尽快联系用户' : '已标记为已解决');
  };

  const counts = { open: 0, handling: 0, resolved: 0 } as Record<Status, number>;
  list?.forEach((a) => { counts[a.status] += 1; });
  const shown = (list ?? []).filter((a) => a.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="adm-page">
      <section className="adm-sop" aria-label="危机处置流程">
        <div className="adm-sop-title"><b>危机处置 SOP</b><span>任何一条预警都可能关乎生命，请严格按流程处置</span></div>
        <ol className="adm-sop-steps">
          <li><em>1</em><div><b>3 分钟内联系</b><span>点「开始处理」认领，立即通过电话 / 站内消息联系用户，确认其当前是否安全</span></div></li>
          <li><em>2</em><div><b>引导拨打专业热线</b><span>全国心理援助热线 <strong className="num">12356</strong>；有生命危险立即拨打 <strong className="num">120 / 110</strong></span></div></li>
          <li><em>3</em><div><b>记录处置过程</b><span>记录联系时间、用户状态、转介去向，确认安全后再「标记已解决」</span></div></li>
        </ol>
        <div className="adm-sop-lines">
          {HOTLINES.map((h) => <span key={h.number}><IconPhone />{h.name} <strong className="num">{h.number}</strong><small>{h.note}</small></span>)}
        </div>
      </section>

      <div className="adm-page-head">
        <div className="seg" role="tablist" aria-label="预警状态">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}{list ? <span className={`adm-seg-count${t.key === 'open' && counts.open > 0 ? ' danger' : ''}`}>{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="adm-refresh">
          <span className="adm-sub">{updatedAt ? `更新于 ${time(updatedAt)}:${String(new Date(updatedAt).getSeconds()).padStart(2, '0')} · 每 15 秒自动刷新` : '每 15 秒自动刷新'}</span>
          <button type="button" className="btn btn-line btn-sm" onClick={load} disabled={refreshing}>
            <span className={refreshing ? 'adm-spin-ic' : ''}><IconRefresh /></span>{refreshing ? '刷新中' : '立即刷新'}
          </button>
        </div>
      </div>

      {error && list ? <p className="adm-inline-err" role="alert">自动刷新失败：{errText(error)}（将继续重试）</p> : null}

      {!list ? (error ? <ErrorState error={asError(error)} onRetry={load} /> : <Loading label="正在加载危机预警…" />) : shown.length === 0 ? (
        <div className="card"><Empty title={tab === 'open' ? '当前没有未处理的危机预警' : tab === 'handling' ? '没有处理中的预警' : '暂无已解决记录'} hint={tab === 'open' ? 'AI 接待或消息中识别到风险表达时，会立即出现在这里' : undefined} /></div>
      ) : (
        <ul className="adm-alerts">
          {shown.map((a) => <AlertItem key={a.id} a={a} onUpdated={onUpdated} onError={(m) => toast(m)} />)}
        </ul>
      )}
      {toast.node}
    </div>
  );
}

function AlertItem({ a, onUpdated, onError }: { a: CrisisAlert; onUpdated: (a: CrisisAlert) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<null | 'handling' | 'resolved'>(null);
  const [confirm, setConfirm] = useState(false);
  const waitedMin = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 60000);
  const overdue = a.status === 'open' && waitedMin >= 3;

  const update = async (status: 'handling' | 'resolved') => {
    setBusy(status);
    try { onUpdated(await api.adminUpdateCrisis(a.id, { status })); setConfirm(false); }
    catch (e) { onError(`操作失败：${errText(e)}`); }
    finally { setBusy(null); }
  };

  return (
    <li className={`card adm-alert adm-alert-${a.status}`}>
      <div className="adm-alert-main">
        <div className="adm-alert-meta">
          <span className={`badge ${a.source === 'intake' ? 'adm-badge-purple' : 'adm-badge-cyan'}`}>{a.source === 'intake' ? 'AI 接待' : '咨询消息'}</span>
          <span className="adm-alert-user">
            {a.user ? <><b>{a.user.name}</b><span className="num">{a.user.phone}</span></> : <><b>匿名会话</b>{a.sessionId && <span className="adm-code-sm">{a.sessionId}</span>}</>}
          </span>
          <span className="adm-alert-time" title={dateTime(a.createdAt)}>{dateTime(a.createdAt)} · {ago(a.createdAt)}</span>
          {a.status === 'open' && <span className={`badge ${overdue ? 'badge-red' : 'badge-gold'}`}>{overdue ? `已等待 ${waitedMin} 分钟，超时` : '等待响应'}</span>}
        </div>
        <blockquote className="adm-alert-quote">“{a.excerpt}”</blockquote>
        {!a.user && <p className="adm-alert-hint">匿名用户无联系方式：请通过该会话向用户推送热线信息，并持续关注会话动态。</p>}
        {a.handledBy && <p className="adm-alert-handler">处理人：{a.handledBy}</p>}
      </div>
      <div className="adm-alert-actions">
        {a.status === 'open' && (
          <button type="button" className="btn btn-blue adm-btn-crisis" disabled={!!busy} onClick={() => update('handling')}>
            {busy === 'handling' ? <><span className="adm-btn-spin" aria-hidden="true" />认领中…</> : '开始处理'}
          </button>
        )}
        {a.status !== 'resolved' && (confirm ? (
          <div className="adm-confirm">
            <span>已确认用户安全并记录处置过程？</span>
            <div>
              <button type="button" className="btn btn-sm btn-line" disabled={!!busy} onClick={() => setConfirm(false)}>取消</button>
              <button type="button" className="btn btn-sm btn-blue" disabled={!!busy} onClick={() => update('resolved')}>
                {busy === 'resolved' ? <><span className="adm-btn-spin" aria-hidden="true" />提交中…</> : '确认已解决'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-line" disabled={!!busy} onClick={() => setConfirm(true)}>标记已解决</button>
        ))}
        {a.status === 'resolved' && <span className="badge badge-green">已解决</span>}
      </div>
    </li>
  );
}
