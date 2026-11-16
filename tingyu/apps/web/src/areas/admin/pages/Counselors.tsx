// /admin/counselors — 咨询师审核 (F4).
import { useState } from 'react';
import type { CounselorDetail } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, yuan } from '../../../lib/format';
import { useToast } from '../../../components/Toast';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { IconStar } from '../icons';
import { asError, errText } from '../lib';

type Status = 'pending' | 'approved' | 'rejected';
const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: '待审核' }, { key: 'approved', label: '已上线' }, { key: 'rejected', label: '已驳回' },
];

export default function Counselors() {
  const [tab, setTab] = useState<Status>('pending');
  const { data, error, loading, reload, setData } = useAsync(() => api.adminCounselors(tab), [tab]);
  const toast = useToast();
  const [rejecting, setRejecting] = useState<CounselorDetail | null>(null);

  const removeFromList = (id: string) => setData((list) => (list ? list.filter((c) => c.id !== id) : list));

  return (
    <div className="adm-page">
      <div className="adm-page-head">
        <div>
          <p className="adm-sub">审核入驻资料与资质，通过后咨询师将出现在「找咨询师」列表中。</p>
        </div>
        <div className="seg" role="tablist" aria-label="审核状态">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}{tab === t.key && data ? <span className="adm-seg-count">{data.length}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorState error={asError(error)} onRetry={reload} /> : !data ? null : data.length === 0 ? (
        <div className="card"><Empty title={tab === 'pending' ? '没有待审核的申请' : tab === 'approved' ? '暂无已上线咨询师' : '暂无已驳回的申请'} hint={tab === 'pending' ? '新的入驻申请会出现在这里' : undefined} /></div>
      ) : tab === 'pending' ? (
        <div className="adm-apply-list" style={{ opacity: loading ? 0.6 : 1 }}>
          {data.map((c) => (
            <PendingCard key={c.id} c={c}
              onApproved={() => { removeFromList(c.id); toast(`已通过「${c.name}」的入驻申请`); }}
              onReject={() => setRejecting(c)} onError={(m) => toast(m)} />
          ))}
        </div>
      ) : tab === 'approved' ? (
        <ApprovedTable list={data} />
      ) : (
        <div className="adm-apply-list">
          {data.map((c) => <PendingCard key={c.id} c={c} readOnly />)}
        </div>
      )}

      {rejecting && (
        <RejectModal c={rejecting} onClose={() => setRejecting(null)}
          onDone={() => { removeFromList(rejecting.id); toast(`已驳回「${rejecting.name}」的申请`); setRejecting(null); }} />
      )}
      {toast.node}
    </div>
  );
}

function PendingCard({ c, readOnly, onApproved, onReject, onError }: {
  c: CounselorDetail; readOnly?: boolean; onApproved?: () => void; onReject?: () => void; onError?: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    try { await api.adminReviewCounselor(c.id, { status: 'approved' }); onApproved?.(); }
    catch (e) { onError?.(`审核失败：${errText(e)}`); setBusy(false); }
  };
  return (
    <article className="card adm-apply">
      <header className="adm-apply-head">
        <img className="avatar" src={c.avatar} alt="" width={64} height={64} />
        <div className="adm-apply-id">
          <div className="adm-apply-name">
            <h3>{c.name}</h3>
            <span className="badge">{c.title}</span>
            {c.status === 'rejected' && <span className="badge badge-red">已驳回</span>}
            {c.status === 'pending' && <span className="badge badge-gold">待审核</span>}
          </div>
          <p>{c.headline}</p>
          <ul className="adm-meta">
            <li>{c.gender === 'female' ? '女' : '男'}</li>
            <li>从业 {c.years} 年</li>
            <li>{c.city ? `面询城市：${c.city}` : '仅线上'}</li>
            <li>定价 <b className="num">{yuan(c.price)}</b> / 50 分钟</li>
          </ul>
        </div>
        {!readOnly && (
          <div className="adm-apply-actions">
            <button type="button" className="btn btn-line" onClick={onReject} disabled={busy}>驳回</button>
            <button type="button" className="btn btn-blue" onClick={approve} disabled={busy}>
              {busy ? <><span className="adm-btn-spin" aria-hidden="true" />提交中…</> : '通过并上线'}
            </button>
          </div>
        )}
      </header>
      <div className="adm-apply-body">
        <section className="adm-apply-sec adm-apply-intro">
          <h4>个人介绍</h4>
          <p>{c.intro || '（未填写）'}</p>
        </section>
        <section className="adm-apply-sec">
          <h4>擅长方向</h4>
          <div className="adm-tags">{c.tags.length ? c.tags.map((t) => <span key={t} className="tag">{t}</span>) : <span className="muted">未填写</span>}</div>
          <h4>咨询流派</h4>
          <div className="adm-tags">{c.methods.length ? c.methods.map((t) => <span key={t} className="tag">{t}</span>) : <span className="muted">未填写</span>}</div>
          <h4>咨询方式</h4>
          <div className="adm-tags">{c.modes.map((m) => <span key={m} className="tag">{modeLabel(m)}</span>)}</div>
        </section>
        <section className="adm-apply-sec">
          <h4>资质证书</h4>
          {c.qualifications.length ? (
            <ul className="adm-qual">{c.qualifications.map((q, i) => <li key={i}><b>{q.name}</b><span>{q.issuer} · {q.year} 年</span></li>)}</ul>
          ) : <p className="adm-warn-text">未上传资质证书，请电话核实后再审核</p>}
          <h4>培训与督导</h4>
          {c.training.length ? (
            <ul className="adm-qual">{c.training.map((t, i) => <li key={i}><b>{t.period}</b><span>{t.content}</span></li>)}</ul>
          ) : <p className="muted">未填写</p>}
        </section>
      </div>
    </article>
  );
}

function RejectModal({ c, onClose, onDone }: { c: CounselorDetail; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const PRESETS = ['资质证书信息不完整', '从业年限与证书不符', '个人介绍包含疗效承诺', '定价不符合平台规范'];
  const submit = async () => {
    if (!note.trim()) { setErr('请填写驳回原因，申请人会收到这条说明'); return; }
    setBusy(true); setErr(null);
    try { await api.adminReviewCounselor(c.id, { status: 'rejected', note: note.trim() }); onDone(); }
    catch (e) { setErr(errText(e)); setBusy(false); }
  };
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="adm-reject-title" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal adm-modal">
        <h3 id="adm-reject-title">驳回「{c.name}」的入驻申请</h3>
        <p className="adm-sub">驳回原因会通过站内通知发送给申请人，请说明需要补充或修改的内容。</p>
        <div className="adm-presets">
          {PRESETS.map((p) => <button key={p} type="button" className="chip" onClick={() => setNote((n) => (n ? `${n}；${p}` : p))}>{p}</button>)}
        </div>
        <label className="field">
          <span>驳回原因</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="例如：请补充国家二级心理咨询师证书照片" autoFocus />
        </label>
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="adm-modal-actions">
          <button type="button" className="btn btn-line" onClick={onClose} disabled={busy}>取消</button>
          <button type="button" className="btn btn-danger" onClick={submit} disabled={busy}>{busy ? <><span className="adm-btn-spin" aria-hidden="true" />提交中…</> : '确认驳回'}</button>
        </div>
      </div>
    </div>
  );
}

function ApprovedTable({ list }: { list: CounselorDetail[] }) {
  return (
    <div className="card adm-table-card">
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>咨询师</th><th>擅长</th><th className="r">评分</th><th className="r">咨询次数</th><th className="r">复约率</th><th>方式</th><th className="r">价格</th><th /></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="adm-person">
                    <img className="avatar" src={c.avatar} alt="" width={36} height={36} />
                    <div><b>{c.name}{c.badges.map((b) => <span key={b} className="badge badge-gold adm-ml">{b}</span>)}</b><span>{c.title} · {c.years} 年</span></div>
                  </div>
                </td>
                <td><div className="adm-tags adm-tags-tight">{c.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}</div></td>
                <td className="r"><span className="adm-rating"><IconStar /><b className="num">{c.rating.toFixed(2)}</b></span><span className="adm-cell-sub">{c.reviewCount} 条评价</span></td>
                <td className="r num">{c.sessionsCount.toLocaleString('zh-CN')}</td>
                <td className="r num">{c.rebookRate}%</td>
                <td>{c.modes.map(modeLabel).join(' / ')}</td>
                <td className="r"><b className="num">{yuan(c.price)}</b>{c.originalPrice ? <span className="adm-cell-sub"><s>{yuan(c.originalPrice)}</s></span> : null}</td>
                <td className="r"><a className="btn btn-text" href={`/counselors/${c.id}`} target="_blank" rel="noreferrer">主页</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
