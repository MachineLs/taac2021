// /m/counselors — search, filter chips, filter sheet, sort, infinite list.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ConsultMode, CounselorQuery, CounselorSummary } from '@tingyu/shared';
import { ISSUE_TAGS, MODE_LABEL } from '@tingyu/shared';
import { api } from '../../../api/client';
import { Empty, ErrorState } from '../../../components/states';
import { Icon } from '../icons';
import { CardSkeleton, CounselorCard } from '../CounselorCard';
import { errMsg, modeFull, Sheet, Spin, TabPage } from '../ui';

const PAGE_SIZE = 8;
const SORTS: { v: NonNullable<CounselorQuery['sort']>; label: string }[] = [
  { v: 'recommended', label: '综合' }, { v: 'rating', label: '好评优先' }, { v: 'soonest', label: '最快可约' }, { v: 'price_asc', label: '价格低' }, { v: 'price_desc', label: '价格高' },
];
const PRICES = [{ label: '不限', min: '', max: '' }, { label: '300 以下', min: '', max: '300' }, { label: '300–500', min: '300', max: '500' }, { label: '500 以上', min: '500', max: '' }];
const CITIES = ['北京', '上海', '杭州', '深圳', '广州', '南京', '成都'];
const AVAIL = [{ label: '不限', v: '' }, { label: '今天', v: '1' }, { label: '3 天内', v: '3' }, { label: '7 天内', v: '7' }];
const FILTER_KEYS = ['mode', 'priceMin', 'priceMax', 'gender', 'city', 'avail'] as const;

export default function Counselors() {
  const [sp, setSp] = useSearchParams();
  const [items, setItems] = useState<CounselorSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const key = sp.toString();
  const seq = useRef(0);

  const query = useMemo<CounselorQuery>(() => ({
    q: sp.get('q') || undefined, tag: sp.get('tag') || undefined, mode: (sp.get('mode') as ConsultMode) || undefined,
    priceMin: sp.get('priceMin') ? Number(sp.get('priceMin')) : undefined, priceMax: sp.get('priceMax') ? Number(sp.get('priceMax')) : undefined,
    gender: (sp.get('gender') as 'female' | 'male') || undefined, city: sp.get('city') || undefined,
    availableWithinDays: sp.get('avail') ? Number(sp.get('avail')) : undefined, sort: (sp.get('sort') as CounselorQuery['sort']) || 'recommended',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);

  const load = useCallback(async (p: number) => {
    const n = ++seq.current;
    setLoading(true); setError(null);
    try {
      const res = await api.counselors({ ...query, page: p, pageSize: PAGE_SIZE });
      if (n !== seq.current) return;
      setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items.filter((x) => !prev.some((y) => y.id === x.id))]));
      setTotal(res.total); setPage(p);
    } catch (e) { if (n === seq.current) setError(e as Error); }
    finally { if (n === seq.current) setLoading(false); }
  }, [query]);

  useEffect(() => { setItems([]); load(1); setQ(sp.get('q') ?? ''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);

  const hasMore = items.length < total;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || error) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) load(page + 1); }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, error, page, load]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setSp(next, { replace: true });
  };
  const tag = sp.get('tag') ?? '';
  const sort = sp.get('sort') ?? 'recommended';
  const nFilters = FILTER_KEYS.filter((k) => sp.get(k)).length - (sp.get('priceMin') && sp.get('priceMax') ? 1 : 0);
  const clearAll = () => setSp(new URLSearchParams(), { replace: true });

  return (
    <TabPage className="m-list-page">
      <div className="m-cl-head">
        <h1 className="m-cl-title">找咨询师</h1>
        <form className="m-search m-search-flat" role="search" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); (document.activeElement as HTMLElement | null)?.blur(); }}>
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索咨询师、困扰或话题" aria-label="搜索" enterKeyHint="search" />
          {q && <button type="button" className="m-search-x" aria-label="清除" onClick={() => { setQ(''); set({ q: null }); }}><Icon name="close" size={16} /></button>}
          <button type="submit">搜索</button>
        </form>
        <div className="m-chips" role="group" aria-label="按困扰筛选">
          <button type="button" className={`chip${!tag ? ' on' : ''}`} onClick={() => set({ tag: null })}>全部</button>
          {ISSUE_TAGS.map((t) => <button key={t} type="button" className={`chip${tag === t ? ' on' : ''}`} onClick={() => set({ tag: tag === t ? null : t })}>{t}</button>)}
        </div>
        <div className="m-sortbar">
          {SORTS.slice(0, 4).map((s) => (
            <button key={s.v} type="button" className={sort === s.v || (s.v === 'price_asc' && sort === 'price_desc') ? 'on' : ''}
              onClick={() => set({ sort: s.v === 'price_asc' && sort === 'price_asc' ? 'price_desc' : s.v === 'recommended' ? null : s.v })}>
              {s.v === 'price_asc' ? (sort === 'price_desc' ? '价格 ↓' : '价格 ↑') : s.label}
            </button>
          ))}
          <button type="button" className={`m-filter-btn${nFilters ? ' on' : ''}`} onClick={() => setFilterOpen(true)}><Icon name="filter" size={16} />筛选{nFilters > 0 && <span className="num">{nFilters}</span>}</button>
        </div>
      </div>

      {(sp.get('q') || nFilters > 0 || tag) && !error && (
        <div className="m-cl-meta"><span>{loading && !items.length ? '搜索中…' : `共 ${total} 位咨询师`}{sp.get('q') ? ` · “${sp.get('q')}”` : ''}</span><button type="button" onClick={clearAll}>清空条件</button></div>
      )}

      <div className="m-cl-list">
        {error && !items.length ? <ErrorState error={new Error(errMsg(error, '加载失败'))} onRetry={() => load(1)} />
          : loading && !items.length ? <CardSkeleton n={3} />
          : !items.length ? <Empty title="没有找到合适的咨询师" hint="试试放宽筛选条件，或者让小屿帮你匹配" action={<div className="m-row-gap"><button type="button" className="btn btn-line btn-pill" onClick={clearAll}>清空条件</button><Link className="btn btn-blue btn-pill" to="/m/voice">让小屿匹配</Link></div>} />
          : items.map((c) => <CounselorCard key={c.id} c={c} />)}
        <div ref={sentinel} />
        {items.length > 0 && (
          <div className="m-load-more">
            {loading ? <><Spin />加载中…</> : error ? <button type="button" className="btn btn-text" onClick={() => load(page + 1)}>加载失败，点击重试</button> : hasMore ? <button type="button" className="btn btn-text" onClick={() => load(page + 1)}>加载更多</button> : '— 已经到底了 —'}
          </div>
        )}
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} sp={sp} onApply={(patch) => { set(patch); setFilterOpen(false); }} />
    </TabPage>
  );
}

function FilterSheet({ open, onClose, sp, onApply }: { open: boolean; onClose: () => void; sp: URLSearchParams; onApply: (p: Record<string, string | null>) => void }) {
  const init = () => ({ mode: sp.get('mode') ?? '', priceMin: sp.get('priceMin') ?? '', priceMax: sp.get('priceMax') ?? '', gender: sp.get('gender') ?? '', city: sp.get('city') ?? '', avail: sp.get('avail') ?? '' });
  const [d, setD] = useState(init);
  useEffect(() => { if (open) setD(init()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const pick = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: x[k] === v ? '' : v }));
  const chip = (on: boolean, label: string, onClick: () => void) => <button key={label} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>{label}</button>;
  return (
    <Sheet open={open} onClose={onClose} title="筛选"
      footer={<div className="m-row2">
        <button type="button" className="btn btn-line btn-lg" onClick={() => setD({ mode: '', priceMin: '', priceMax: '', gender: '', city: '', avail: '' })}>重置</button>
        <button type="button" className="btn btn-blue btn-lg" onClick={() => onApply({ ...d })}>查看结果</button>
      </div>}>
      <div className="m-sheet-sec"><h3>咨询方式</h3><div className="m-chips-wrap">
        {chip(!d.mode, '不限', () => setD((x) => ({ ...x, mode: '' })))}
        {(Object.keys(MODE_LABEL) as ConsultMode[]).map((m) => chip(d.mode === m, modeFull(m), () => pick('mode', m)))}
      </div></div>
      <div className="m-sheet-sec"><h3>价格<small>每次 50 分钟</small></h3><div className="m-chips-wrap">
        {PRICES.map((p) => chip(d.priceMin === p.min && d.priceMax === p.max, p.label, () => setD((x) => ({ ...x, priceMin: p.min, priceMax: p.max }))))}
      </div></div>
      <div className="m-sheet-sec"><h3>咨询师性别</h3><div className="m-chips-wrap">
        {chip(!d.gender, '不限', () => setD((x) => ({ ...x, gender: '' })))}{chip(d.gender === 'female', '女', () => pick('gender', 'female'))}{chip(d.gender === 'male', '男', () => pick('gender', 'male'))}
      </div></div>
      <div className="m-sheet-sec"><h3>可约时间</h3><div className="m-chips-wrap">
        {AVAIL.map((a) => chip(d.avail === a.v, a.label, () => setD((x) => ({ ...x, avail: a.v }))))}
      </div></div>
      <div className="m-sheet-sec"><h3>城市<small>线下面询时参考</small></h3><div className="m-chips-wrap">
        {chip(!d.city, '不限', () => setD((x) => ({ ...x, city: '' })))}
        {CITIES.map((c) => chip(d.city === c, c, () => pick('city', c)))}
      </div></div>
    </Sheet>
  );
}
