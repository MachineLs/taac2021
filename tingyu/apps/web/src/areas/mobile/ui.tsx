// Shared building blocks of the mobile app: nav bar, tab bar, sheets, fixed bottom bars, small hooks.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ConsultMode } from '@tingyu/shared';
import { MODE_LABEL } from '@tingyu/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Icon, type IconName } from './icons';

/** Human readable Chinese error message for any thrown value. */
export function errMsg(e: unknown, fallback = '操作失败，请稍后再试'): string {
  if (e instanceof ApiError) {
    if (e.status === 404 && e.code === 'not_found' && /接口不存在/.test(e.message)) return '服务暂未开放，请稍后再试';
    return e.message || fallback;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** "视频咨询" / "语音咨询" / "文字咨询" / "线下面询" */
export const modeFull = (m: ConsultMode) => (m === 'offline' ? '线下面询' : `${MODE_LABEL[m]}咨询`);

/* ---------- top navigation bar ---------- */
export function NavBar({ title, back = true, right, tone = 'plain', onBack, className = '' }: {
  title?: ReactNode; back?: boolean | string; right?: ReactNode; tone?: 'plain' | 'clear' | 'dark'; onBack?: () => void; className?: string;
}) {
  const nav = useNavigate();
  const goBack = () => {
    if (onBack) return onBack();
    if (typeof back === 'string') return nav(back);
    if (window.history.length > 1 && (window.history.state?.idx ?? 0) > 0) nav(-1); else nav('/m');
  };
  return (
    <header className={`m-nav m-nav-${tone} ${className}`}>
      <div className="m-nav-in">
        <div className="m-nav-l">{back !== false && <button type="button" className="m-nav-btn" aria-label="返回" onClick={goBack}><Icon name="back" size={22} /></button>}</div>
        <h1 className="m-nav-t">{title}</h1>
        <div className="m-nav-r">{right}</div>
      </div>
    </header>
  );
}

/* ---------- unread counter (shared by tab bar and home bell) ---------- */
type Unread = { messages: number; notifications: number };
let unreadCache: { at: number; userId: string; v: Unread } | null = null;
const unreadSubs = new Set<(v: Unread) => void>();
export function invalidateUnread() { unreadCache = null; }
export function useUnread(): Unread {
  const { user } = useAuth();
  const [v, setV] = useState<Unread>(unreadCache && user && unreadCache.userId === user.id ? unreadCache.v : { messages: 0, notifications: 0 });
  useEffect(() => {
    if (!user) { setV({ messages: 0, notifications: 0 }); return; }
    unreadSubs.add(setV);
    if (!unreadCache || unreadCache.userId !== user.id || Date.now() - unreadCache.at > 20000) {
      const uid = user.id;
      unreadCache = { at: Date.now(), userId: uid, v: unreadCache?.userId === uid ? unreadCache.v : { messages: 0, notifications: 0 } };
      Promise.allSettled([api.conversations(), api.notifications()]).then(([c, n]) => {
        const nv = {
          messages: c.status === 'fulfilled' ? c.value.reduce((s, x) => s + (x.unread || 0), 0) : 0,
          notifications: n.status === 'fulfilled' ? n.value.filter((x) => !x.readAt).length : 0,
        };
        unreadCache = { at: Date.now(), userId: uid, v: nv };
        unreadSubs.forEach((f) => f(nv));
      });
    } else setV(unreadCache.v);
    return () => { unreadSubs.delete(setV); };
  }, [user]);
  return v;
}

/* ---------- bottom tab bar (first-level pages) ---------- */
const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/m', label: '首页', icon: 'home', end: true },
  { to: '/m/counselors', label: '找咨询师', icon: 'people' },
  { to: '/m/voice', label: 'AI 助理', icon: 'mic' },
  { to: '/m/messages', label: '消息', icon: 'chat' },
  { to: '/m/me', label: '我的', icon: 'user' },
];
export function TabBar() {
  const u = useUnread();
  const n = u.messages + u.notifications;
  return (
    <nav className="m-tabbar" aria-label="主导航">
      {TABS.map((t) => t.icon === 'mic' ? (
        <Link key={t.to} to={t.to} className="m-tab m-tab-mid" aria-label="AI 助理小屿"><span className="m-tab-orb"><Icon name="mic" size={24} /></span>{t.label}</Link>
      ) : (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `m-tab${isActive ? ' on' : ''}`}>
          <Icon name={t.icon} size={24} />{t.label}
          {t.icon === 'chat' && n > 0 && <span className="m-tab-n num">{n > 99 ? '99+' : n}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
/** First-level page: content + tab bar. */
export function TabPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`m-tabpage ${className}`}>{children}<TabBar /></div>;
}

/* ---------- fixed bottom action bar ---------- */
export function BottomBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <><div className="m-bbar-space" aria-hidden="true" /><div className={`m-bbar ${className}`}>{children}</div></>;
}

/* ---------- bottom sheet ---------- */
export function Sheet({ open, onClose, title, children, footer, tall }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean;
}) {
  const [show, setShow] = useState(open);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (open) { setShow(true); const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true))); return () => cancelAnimationFrame(r); }
    setAnim(false); const t = window.setTimeout(() => setShow(false), 220); return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!show) return null;
  return (
    <div className={`m-sheet-wrap${anim ? ' in' : ''}`} onClick={onClose}>
      <div className={`m-sheet${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="m-sheet-h">
          <span className="m-sheet-grip" aria-hidden="true" />
          {title && <h2>{title}</h2>}
          <button type="button" className="m-sheet-x" aria-label="关闭" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div className="m-sheet-b">{children}</div>
        {footer && <div className="m-sheet-f">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation sheet with a destructive/primary action. */
export function ConfirmSheet({ open, onClose, title, body, confirm = '确定', tone = 'blue', busy, onConfirm }: {
  open: boolean; onClose: () => void; title: string; body?: ReactNode; confirm?: string; tone?: 'blue' | 'danger'; busy?: boolean; onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={<div className="m-row2"><button type="button" className="btn btn-line btn-lg" onClick={onClose}>再想想</button>
        <button type="button" className={`btn btn-lg ${tone === 'danger' ? 'm-btn-danger' : 'btn-blue'}`} disabled={busy} onClick={onConfirm}>{busy ? <Spin /> : null}{confirm}</button></div>}>
      {body && <div className="m-confirm-b">{body}</div>}
    </Sheet>
  );
}

export const Spin = () => <span className="m-spin" aria-hidden="true" />;

/** Prompt shown inside first-level pages when signed out. */
export function LoginPrompt({ title = '登录后查看', hint = '登录后可以查看预约、消息和测评记录' }: { title?: string; hint?: string }) {
  const loc = useLocation();
  return (
    <div className="m-login-prompt">
      <span className="m-login-ic"><Icon name="lock" size={26} /></span>
      <b>{title}</b><span>{hint}</span>
      <Link className="btn btn-blue btn-pill" to={`/m/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}>手机号登录</Link>
    </div>
  );
}

/* ---------- hooks ---------- */
/** Seconds remaining until `iso` (ticks every second). */
export function useCountdown(iso: string | null | undefined) {
  const calc = useCallback(() => (iso ? Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)) : 0), [iso]);
  const [left, setLeft] = useState(calc);
  useEffect(() => { setLeft(calc()); if (!iso) return; const t = window.setInterval(() => setLeft(calc()), 1000); return () => window.clearInterval(t); }, [iso, calc]);
  return left;
}
export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export function hms(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} 天 ${h} 小时 ${m} 分`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Calls fn every `ms` while the page is visible. */
export function usePoll(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') ref.current(); }, ms);
    return () => window.clearInterval(t);
  }, [ms, enabled]);
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="m-stars" aria-label={`${value} 星`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} fill={i <= Math.round(value)} className={i <= Math.round(value) ? 'on' : ''} />)}
    </span>
  );
}

/** Rating 0..5 → "98%" style positive rate as shown in the design. */
export const goodRate = (rating: number) => `${Math.min(100, Math.round((rating / 5) * 100))}%`;

/* ---------- small session stores ---------- */
const INTAKE_KEY = 'tingyu.m.intake';
const LAST_INTAKE_KEY = 'tingyu.m.lastIntake';
export const intakeStore = {
  get: () => { try { return sessionStorage.getItem(INTAKE_KEY); } catch { return null; } },
  set: (id: string | null) => { try { id ? sessionStorage.setItem(INTAKE_KEY, id) : sessionStorage.removeItem(INTAKE_KEY); } catch { /* ignore */ } },
  last: () => { try { return localStorage.getItem(LAST_INTAKE_KEY); } catch { return null; } },
  setLast: (id: string) => { try { localStorage.setItem(LAST_INTAKE_KEY, id); } catch { /* ignore */ } },
};
