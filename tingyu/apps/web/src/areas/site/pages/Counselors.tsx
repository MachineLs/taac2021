import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ConsultMode, CounselorQuery } from '@tingyu/shared';
import { ISSUE_TAGS } from '@tingyu/shared';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { ErrorState, Empty } from '../../../components/states';
import { Icon } from '../components/Icon';
import { CounselorCard, CounselorCardSkeleton } from '../components/CounselorCard';

const PAGE_SIZE = 8;
const MODES: { v: ConsultMode; l: string }[] = [{ v: 'video', l: '视频' }, { v: 'voice', l: '语音' }, { v: 'text', l: '文字' }, { v: 'offline', l: '线下面询' }];
const PRICE_RANGES: { l: string; min?: number; max?: number }[] = [
  { l: '300 元以下', max: 300 }, { l: '300–500 元', min: 300, max: 500 }, { l: '500–700 元', min: 500, max: 700 }, { l: '700 元以上', min: 700 },
];
const CITIES = ['北京', '上海', '杭州', '深圳', '广州', '南京', '成都'];
const DAYS = [{ v: 1, l: '今天' }, { v: 3, l: '3 天内' }, { v: 7, l: '7 天内' }];
const SORTS: { v: NonNullable<CounselorQuery['sort']>; l: string }[] = [
  { v: 'recommended', l: '综合推荐' }, { v: 'rating', l: '好评优先' }, { v: 'soonest', l: '最快可约' }, { v: 'price_asc', l: '价格从低到高' }, { v: 'price_desc', l: '价格从高到低' },
];

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export default function Counselors() {
  const [sp, setSp] = useSearchParams();
  const query: CounselorQuery = {
    q: sp.get('q') || undefined,
    tag: sp.get('tag') || undefined,
    mode: (sp.get('mode') as ConsultMode) || undefined,
    priceMin: num(sp.get('priceMin')),
    priceMax: num(sp.get('priceMax')),
    gender: (sp.get('gender') as 'female' | 'male') || undefined,
    city: sp.get('city') || undefined,
    availableWithinDays: num(sp.get('availableWithinDays')),
    sort: (sp.get('sort') as CounselorQuery['sort']) || 'recommended',
    page: num(sp.get('page')) ?? 1,
    pageSize: PAGE_SIZE,
  };
  const key = sp.toString();
  const list = useAsync(() => api.counselors(query), [key]);
  const [q, setQ] = useState(query.q ?? '');
  useEffect(() => { setQ(sp.get('q') ?? ''); }, [sp]);
  useEffect(() => { document.title = '找咨询师 · 听屿心理'; }, []);

  /** Update URL params; any filter change resets the page. */
  const set = (patch: Record<string, string | number | undefined | null>, keepPage = false) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === '') next.delete(k); else next.set(k, String(v)); }
    if (!keepPage) next.delete('page');
    setSp(next);
    if (keepPage) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggle = (k: string, v: string | number) => set({ [k]: sp.get(k) === String(v) ? undefined : v });
  const priceOn = (r: { min?: number; max?: number }) => String(query.priceMin ?? '') === String(r.min ?? '') && String(query.priceMax ?? '') === String(r.max ?? '');
  const submit = (e: FormEvent) => { e.preventDefault(); set({ q: q.trim() || undefined }); };

  const active: { k: string; l: string; clear: Record<string, undefined> }[] = [];
  if (query.q) active.push({ k: 'q', l: `“${query.q}”`, clear: { q: undefined } });
  if (query.tag) active.push({ k: 'tag', l: query.tag, clear: { tag: undefined } });
  if (query.mode) active.push({ k: 'mode', l: MODES.find((m) => m.v === query.mode)?.l ?? query.mode, clear: { mode: undefined } });
  if (query.priceMin || query.priceMax) active.push({ k: 'price', l: `${query.priceMin ?? 0}–${query.priceMax ?? '∞'} 元`, clear: { priceMin: undefined, priceMax: undefined } });
  if (query.gender) active.push({ k: 'gender', l: query.gender === 'female' ? '女咨询师' : '男咨询师', clear: { gender: undefined } });
  if (query.city) active.push({ k: 'city', l: query.city, clear: { city: undefined } });
  if (query.availableWithinDays) active.push({ k: 'd', l: DAYS.find((d) => d.v === query.availableWithinDays)?.l ?? `${query.availableWithinDays} 天内`, clear: { availableWithinDays: undefined } });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = query.page ?? 1;

  return (
    <div className="site-wrap site-list-page">
      <div className="site-crumbs"><Link to="/">首页</Link><Icon name="right" size={12} /><span>找咨询师</span></div>
      <div className="site-list-head">
        <div><h1>找咨询师</h1><p className="muted">全部为平台审核通过的持证咨询师 · 点击时间直接预约</p></div>
        <form className="site-search" onSubmit={submit} role="search">
          <Icon name="search" />
          <input className="site-search-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索咨询师姓名、困扰或流派" aria-label="搜索咨询师" />
          <button className="btn btn-blue btn-sm" type="submit">搜索</button>
        </form>
      </div>

      <div className="site-list-grid">
        <aside className="site-filters" aria-label="筛选条件">
          <div className="site-fgroup"><h3>困扰方向</h3>
            <div className="site-fchips">{ISSUE_TAGS.map((t) => <button key={t} type="button" className={`chip ${query.tag === t ? 'on' : ''}`} aria-pressed={query.tag === t} onClick={() => toggle('tag', t)}>{t}</button>)}</div>
          </div>
          <div className="site-fgroup"><h3>咨询方式</h3>
            <div className="site-fchips">{MODES.map((m) => <button key={m.v} type="button" className={`chip ${query.mode === m.v ? 'on' : ''}`} aria-pressed={query.mode === m.v} onClick={() => toggle('mode', m.v)}>{m.l}</button>)}</div>
          </div>
          <div className="site-fgroup"><h3>价格区间</h3>
            <div className="site-fchips">{PRICE_RANGES.map((r) => <button key={r.l} type="button" className={`chip ${priceOn(r) ? 'on' : ''}`} aria-pressed={priceOn(r)} onClick={() => (priceOn(r) ? set({ priceMin: undefined, priceMax: undefined }) : set({ priceMin: r.min, priceMax: r.max }))}>{r.l}</button>)}</div>
          </div>
          <div className="site-fgroup"><h3>咨询师性别</h3>
            <div className="site-fchips">{[{ v: 'female', l: '女' }, { v: 'male', l: '男' }].map((g) => <button key={g.v} type="button" className={`chip ${query.gender === g.v ? 'on' : ''}`} aria-pressed={query.gender === g.v} onClick={() => toggle('gender', g.v)}>{g.l}</button>)}</div>
          </div>
          <div className="site-fgroup"><h3>可约时间</h3>
            <div className="site-fchips">{DAYS.map((d) => <button key={d.v} type="button" className={`chip ${query.availableWithinDays === d.v ? 'on' : ''}`} aria-pressed={query.availableWithinDays === d.v} onClick={() => toggle('availableWithinDays', d.v)}>{d.l}</button>)}</div>
          </div>
          <div className="site-fgroup"><h3>所在城市 <small className="muted">线下面询</small></h3>
            <select className="select" value={query.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })} aria-label="城市">
              <option value="">不限城市</option>{CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="site-fhelp">
            <b>不知道怎么选？</b>
            <span>和 AI 助理小屿聊 3 分钟，帮你梳理困扰并推荐合适的咨询师。</span>
            <Link className="btn btn-soft btn-sm" to="/intake"><Icon name="mic" size={15} />免费语音接待</Link>
          </div>
        </aside>

        <section className="site-results" aria-live="polite">
          <div className="site-rbar">
            <span className="site-rcount">{list.data ? <>共 <b className="num">{total}</b> 位咨询师</> : '正在查找…'}</span>
            <div className="site-active">
              {active.map((a) => <button key={a.k} type="button" className="site-afilter" onClick={() => set(a.clear)}>{a.l}<Icon name="close" size={12} /></button>)}
              {active.length > 0 && <button type="button" className="btn btn-text btn-sm" onClick={() => setSp(new URLSearchParams(query.sort && query.sort !== 'recommended' ? { sort: query.sort } : {}))}>清空筛选</button>}
            </div>
            <label className="site-sort">排序
              <select value={query.sort} onChange={(e) => set({ sort: e.target.value === 'recommended' ? undefined : e.target.value })}>
                {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
          </div>

          {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
            : list.loading && !list.data ? <div className="site-rlist">{[0, 1, 2].map((i) => <CounselorCardSkeleton key={i} />)}</div>
            : total === 0 ? <div className="card"><Empty title="没有找到符合条件的咨询师" hint="试试减少筛选条件，或让小屿帮你匹配" action={<div className="site-row-gap"><button className="btn btn-line" type="button" onClick={() => setSp(new URLSearchParams())}>清空筛选</button><Link className="btn btn-blue" to="/intake">让小屿帮我匹配</Link></div>} /></div>
            : <div className={`site-rlist ${list.loading ? 'site-dim' : ''}`}>{list.data?.items.map((c) => <CounselorCard key={c.id} c={c} days={Math.max(7, query.availableWithinDays ?? 7)} />)}</div>}

          {pages > 1 && (
            <nav className="site-pager" aria-label="分页">
              <button type="button" className="btn btn-line btn-sm" disabled={page <= 1} onClick={() => set({ page: page - 1 }, true)}><Icon name="left" size={14} />上一页</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" className={`site-pg ${p === page ? 'on' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => set({ page: p === 1 ? undefined : p }, true)}>{p}</button>
              ))}
              <button type="button" className="btn btn-line btn-sm" disabled={page >= pages} onClick={() => set({ page: page + 1 }, true)}>下一页<Icon name="right" size={14} /></button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
