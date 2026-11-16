// /m/counselors/:id — counselor profile with a fixed booking bar and the booking sheet.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Review } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { modeLabel, monthDay, when } from '../../../lib/format';
import { ErrorState, Loading } from '../../../components/states';
import { useToast } from '../../../components/Toast';
import { Icon } from '../icons';
import { PriceTag, shortTitle } from '../CounselorCard';
import { BookingSheet } from '../BookingSheet';
import { BottomBar, errMsg, goodRate, intakeStore, NavBar, Sheet, Spin, Stars } from '../ui';

export default function CounselorDetail() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const c = useAsync(() => api.counselor(id), [id]);
  const reviews = useAsync(() => api.counselorReviews(id, 1), [id]);
  const [bookOpen, setBookOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  const slotParam = sp.get('slot');
  const intakeId = sp.get('intake') || intakeStore.last();
  useEffect(() => { if (c.data && (slotParam || sp.get('book'))) setBookOpen(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [c.data]);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 140);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const closeBook = () => {
    setBookOpen(false);
    if (sp.get('book') || sp.get('slot')) { const n = new URLSearchParams(sp); n.delete('book'); n.delete('slot'); setSp(n, { replace: true }); }
  };
  const message = async () => {
    if (!user) { nav(`/m/login?next=${encodeURIComponent(`/m/counselors/${id}`)}`); return; }
    setMsgBusy(true);
    try { const conv = await api.openConversation(id); nav(`/m/messages/${conv.id}`); }
    catch (e) { toast(errMsg(e, '暂时无法发起对话')); }
    finally { setMsgBusy(false); }
  };

  if (c.loading && !c.data) return <><NavBar title="咨询师" /><Loading full /></>;
  if (c.error || !c.data) return <><NavBar title="咨询师" /><ErrorState error={new Error(errMsg(c.error, '咨询师信息加载失败'))} onRetry={c.reload} /></>;
  const d = c.data;
  const longIntro = d.intro.length > 90;

  return (
    <div className="m-detail">
      <NavBar tone="clear" className={solid ? 'solid' : ''} title={d.name} />
      <section className="m-dt-hero">
        <div className="m-dt-hero-bg" aria-hidden="true" />
        <div className="m-dt-card">
          <div className="m-dt-top">
            <img className="m-dt-photo" src={d.avatar} alt={d.name} />
            <div className="m-dt-id">
              <div className="m-dt-nm"><h1>{d.name}</h1>{d.badges.map((b) => <span key={b} className="badge badge-gold">{b}</span>)}</div>
              <div className="m-dt-title"><span className="badge">{shortTitle(d.title)}</span><span className="m-verified"><Icon name="shield" size={13} />资质已核验</span></div>
              <p>{d.headline}</p>
            </div>
          </div>
          <div className="m-dt-stats">
            <div><b className="num">{d.years}<small>年</small></b><span>从业经验</span></div>
            <div><b className="num">{d.sessionsCount.toLocaleString('zh-CN')}</b><span>服务人次</span></div>
            <div><b className="num">{goodRate(d.rating)}</b><span>好评率</span></div>
            <div><b className="num">{d.rebookRate}%</b><span>复约率</span></div>
          </div>
          <div className="m-dt-next">
            <Icon name="clock" size={15} />{d.nextAvailableAt ? <>最近可约 <b>{when(d.nextAvailableAt)}</b></> : '近 7 天已约满，可先发消息咨询'}
            <button type="button" onClick={() => setBookOpen(true)}>选时间<Icon name="right" size={14} /></button>
          </div>
        </div>
      </section>

      <section className="m-card">
        <h3>擅长领域</h3>
        <div className="m-tagrow">{d.tags.map((t) => <span key={t} className="tag m-tag-blue">{t}</span>)}</div>
        <div className="m-dt-modes">
          {d.modes.map((m) => <span key={m}><Icon name={m === 'video' ? 'video' : m === 'voice' ? 'phone' : m === 'text' ? 'chat' : 'store'} size={16} />{modeLabel(m)}{m === 'offline' && d.city ? ` · ${d.city}` : ''}</span>)}
        </div>
      </section>

      <section className="m-card">
        <h3>个人简介</h3>
        <p className={`m-dt-intro${longIntro && !introOpen ? ' clamp' : ''}`}>{d.intro}</p>
        {longIntro && <button type="button" className="m-inline-link" onClick={() => setIntroOpen(!introOpen)}>{introOpen ? '收起' : '展开全部'}</button>}
        {d.methods.length > 0 && <><h4 className="m-h4">咨询流派</h4><div className="m-tagrow">{d.methods.map((m) => <span key={m} className="tag">{m}</span>)}</div></>}
      </section>

      <section className="m-card">
        <h3>资质认证<span className="m-h-badge"><Icon name="checkCircle" size={13} />平台核验</span></h3>
        <ul className="m-quals">
          {d.qualifications.map((q, i) => <li key={i}><span className="m-li-ic c3"><Icon name="award" size={18} /></span><div><b>{q.name}</b><small>{q.issuer} · {q.year} 年</small></div></li>)}
        </ul>
        {d.training.length > 0 && <><h4 className="m-h4">受训经历</h4>
          <ul className="m-train">{d.training.map((t, i) => <li key={i}><span className="num">{t.period}</span>{t.content}</li>)}</ul></>}
      </section>

      <section className="m-card">
        <div className="m-card-h">用户评价<small className="m-h-note">{d.reviewCount} 条 · {d.rating.toFixed(2)} 分</small>
          {(reviews.data?.total ?? 0) > 3 && <button type="button" onClick={() => setAllReviews(true)}>全部<Icon name="right" size={14} /></button>}</div>
        {reviews.loading && !reviews.data ? <Loading /> : reviews.error ? <p className="m-slots-empty">评价加载失败</p>
          : !reviews.data?.items.length ? <p className="m-slots-empty">暂时还没有评价</p>
          : <div className="m-reviews">{reviews.data.items.slice(0, 3).map((r) => <ReviewItem key={r.id} r={r} />)}</div>}
      </section>

      <section className="m-card m-dt-rules">
        <h3>预约须知</h3>
        <ul>
          <li>每次咨询 50 分钟，开始前 10 分钟可进入咨询室</li>
          <li>开始前 24 小时以上可免费取消或改约，全额退款</li>
          <li>咨询内容严格保密，平台全程担保交易</li>
          <li>如有紧急情况，请拨打 12356 心理援助热线或 120</li>
        </ul>
      </section>

      <BottomBar>
        <button type="button" className="m-bbar-ic" onClick={message} disabled={msgBusy}>{msgBusy ? <Spin /> : <Icon name="bubble" size={22} />}发消息</button>
        <div className="m-bbar-price"><PriceTag price={d.price} original={d.originalPrice} /><small>首次咨询可用新人券</small></div>
        <button type="button" className="btn btn-blue btn-lg m-bbar-main" onClick={() => setBookOpen(true)}>预约咨询</button>
      </BottomBar>

      <BookingSheet c={d} open={bookOpen} onClose={closeBook} initialSlotId={slotParam} intakeId={sp.get('intake') || intakeId} />
      <AllReviews open={allReviews} onClose={() => setAllReviews(false)} id={id} />
      {toast.node}
    </div>
  );
}

function ReviewItem({ r }: { r: Review }) {
  return (
    <div className="m-review">
      <div className="m-review-h"><span className="m-review-av">{r.userName.slice(0, 1)}</span><b>{r.userName}</b><Stars value={r.rating} size={12} /><small>{monthDay(r.createdAt)}</small></div>
      <p>{r.content}</p>
      {r.tags.length > 0 && <div className="m-review-tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>}
    </div>
  );
}

function AllReviews({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const [items, setItems] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const more = async () => {
    setBusy(true);
    try { const r = await api.counselorReviews(id, page + 1); setItems((x) => [...x, ...r.items]); setTotal(r.total); setPage(page + 1); } catch { /* shown via button */ }
    finally { setBusy(false); }
  };
  useEffect(() => { if (open && page === 0) more(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={`全部评价（${total}）`} tall>
      <div className="m-reviews">{items.map((r) => <ReviewItem key={r.id} r={r} />)}</div>
      <div className="m-load-more">{busy ? <><Spin />加载中…</> : items.length < total ? <button type="button" className="btn btn-text" onClick={more}>加载更多</button> : items.length ? '— 没有更多了 —' : null}</div>
    </Sheet>
  );
}
