// Desk-local UI bits: icons, avatars, badges, confirm dialog, page header.
import { useEffect, useState, type ReactNode } from 'react';
import type { AppointmentStatus, ConsultMode } from '@tingyu/shared';
import { STATUS_LABEL, modeLabel } from '../../lib/format';
import { STATUS_TONE } from './lib';

const PATHS: Record<string, string> = {
  today: 'M3 10h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm4 10 2 2 4-4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  grid: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16M15 4v16',
  chat: 'M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.4A8 8 0 1 1 21 12Z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm13 7h.01',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  video: 'M15 10l5-3v10l-5-3M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  videoOff: 'M3 3l18 18M15 10l5-3v10l-2-1.2M10.5 5H13a2 2 0 0 1 2 2v2.5M15 15v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 1.2-1.8',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v3',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.8M19 12a7 7 0 0 1-1.1 3.8M5 12a7 7 0 0 0 10.6 6M12 19v3',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5',
  note: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4Z',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  panel: 'M3 4h18v16H3zM15 4v16',
};
export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

export function Avatar({ src, name, size = 36 }: { src: string | null | undefined; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} />;
  return <span className="avatar desk-avatar-txt" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">{(name || '?').slice(0, 1)}</span>;
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`desk-status desk-status-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
export function ModeTag({ mode }: { mode: ConsultMode }) {
  const icon = mode === 'video' ? 'video' : mode === 'voice' ? 'phone' : mode === 'text' ? 'chat' : 'home';
  return <span className="desk-mode"><Icon name={icon} size={13} />{modeLabel(mode)}</span>;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="desk-pagehead">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div className="desk-pagehead-actions">{actions}</div>}
    </div>
  );
}

export function Confirm({ title, body, confirmText = '确认', danger, busy, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmText?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [busy, onClose]);
  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <div className="modal desk-confirm" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="desk-confirm-body">{body}</div>
        <div className="desk-confirm-actions">
          <button className="btn btn-line" type="button" onClick={onClose} disabled={busy}>取消</button>
          <button className={`btn ${danger ? 'desk-btn-red' : 'btn-blue'}`} type="button" onClick={onConfirm} disabled={busy}>
            {busy && <span className="desk-btn-spin" aria-hidden="true" />}{confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Spin() { return <span className="desk-btn-spin" aria-hidden="true" />; }

/** Re-renders every `ms` milliseconds; returns Date.now(). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

/** Error message in Chinese for display. */
export const errMsg = (e: unknown, fallback = '操作失败，请稍后再试') => {
  const m = (e as Error | null)?.message;
  return m && /[一-龥]/.test(m) ? m : fallback;
};

export const RISK_LABEL = { low: '低风险', medium: '中风险', high: '高风险' } as const;
