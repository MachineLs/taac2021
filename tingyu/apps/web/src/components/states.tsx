// Loading / error / empty states and guards shared by every area. Owned by the lead.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@tingyu/shared';
import { useAuth } from '../auth/AuthContext';

export function Loading({ full, label = '加载中…' }: { full?: boolean; label?: string }) {
  return <div className={full ? 'st st-full' : 'st'} role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}
export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return <div className="st st-err" role="alert"><b>出错了</b><span>{error?.message ?? '请稍后再试'}</span>{onRetry && <button className="btn btn-line btn-sm" type="button" onClick={onRetry}>重试</button>}</div>;
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="st st-empty"><b>{title}</b>{hint && <span>{hint}</span>}{action}</div>;
}
export function Placeholder({ title }: { title: string }) {
  return <div className="st st-full"><b>{title}</b><span>页面开发中</span></div>;
}
/** Redirects to `loginPath?next=…` when signed out; shows 403 when the role is missing. */
export function RequireAuth({ children, role, loginPath = '/login' }: { children: ReactNode; role?: Role; loginPath?: string }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading full />;
  if (!user) return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (role && !user.roles.includes(role)) return <div className="st st-full"><b>没有访问权限</b><span>当前账号不是{role === 'counselor' ? '咨询师' : role === 'admin' ? '管理员' : role === 'creator' ? '合作达人' : '该角色'}账号。</span></div>;
  return <>{children}</>;
}
