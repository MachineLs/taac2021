// Workbench shell: left navigation + top bar + content. Collapses to a top menu on narrow screens.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { CounselorDetail } from '@tingyu/shared';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { monthDay, weekday } from '../../lib/format';
import { Avatar, Icon } from './ui';

const NAV = [
  { to: '/desk', end: true, icon: 'today', label: '今日' },
  { to: '/desk/appointments', icon: 'list', label: '来访' },
  { to: '/desk/schedule', icon: 'grid', label: '排班' },
  { to: '/desk/messages', icon: 'chat', label: '消息' },
  { to: '/desk/earnings', icon: 'wallet', label: '收入' },
];
const TITLES: [RegExp, string][] = [
  [/^\/desk\/?$/, '今日安排'], [/^\/desk\/appointments\/[^/]+/, '来访者简报'], [/^\/desk\/appointments/, '来访列表'],
  [/^\/desk\/schedule/, '排班管理'], [/^\/desk\/messages/, '消息'], [/^\/desk\/earnings/, '收入'],
];

export function Logo({ sub = '咨询师工作台' }: { sub?: string }) {
  return (
    <Link to="/desk" className="desk-logo">
      <i>屿</i><span>听屿<small>{sub}</small></span>
    </Link>
  );
}

export default function DeskLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [profile, setProfile] = useState<CounselorDetail | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    let alive = true;
    const load = () => api.conversations().then((cs) => { if (alive) setUnread(cs.reduce((s, c) => s + c.unread, 0)); }).catch(() => {});
    load();
    const t = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(t); };
  }, [loc.pathname]);

  useEffect(() => {
    if (!user?.counselorId) return;
    api.counselor(user.counselorId).then(setProfile).catch(() => setProfileMissing(true));
  }, [user?.counselorId]);

  const title = TITLES.find(([re]) => re.test(loc.pathname))?.[1] ?? '工作台';
  const nowIso = new Date().toISOString();
  const name = profile?.name ?? user?.name ?? '咨询师';
  const pending = profile ? profile.status !== 'approved' : profileMissing;

  return (
    <div className="desk">
      <aside className={`desk-side${open ? ' open' : ''}`}>
        <div className="desk-side-top">
          <Logo />
          <button className="desk-menu-btn" type="button" aria-label={open ? '收起菜单' : '展开菜单'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
        <nav className="desk-nav" aria-label="工作台导航">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `desk-nav-item${isActive ? ' on' : ''}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.icon === 'chat' && unread > 0 && <em className="desk-nav-badge num">{unread > 99 ? '99+' : unread}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="desk-side-foot">
          <div className="desk-side-note">
            <Icon name="shield" size={16} />
            <span>AI 小屿只做接待与初筛，咨询与诊断由您完成。</span>
          </div>
          <div className="desk-me">
            <Avatar src={profile?.avatar ?? user?.avatar} name={name} size={36} />
            <div><b>{name}</b><small>{profile?.title ?? '咨询师'}</small></div>
            <button type="button" className="desk-icon-btn" aria-label="退出登录" title="退出登录" onClick={() => { logout(); nav('/login?next=/desk'); }}>
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="desk-main">
        <header className="desk-top">
          <div className="desk-top-title">{title}</div>
          <div className="desk-top-right">
            <span className="desk-top-date">{monthDay(nowIso)} {weekday(nowIso)}</span>
            <a className="desk-top-link" href="/" target="_blank" rel="noreferrer">访问官网</a>
            <span className="desk-online"><i />在线接诊</span>
          </div>
        </header>
        {pending && (
          <div className="desk-pending-bar">
            <Icon name="clock" size={16} />
            <span>你的入驻资料正在审核中，审核通过后来访者才能看到你的主页并预约。</span>
            <Link to="/desk/apply">查看申请</Link>
          </div>
        )}
        <main className="desk-content"><Outlet /></main>
      </div>
    </div>
  );
}

export function DeskBare({ children }: { children: ReactNode }) {
  return (
    <div className="desk-bare">
      <header className="desk-bare-top"><Logo sub="咨询师入驻" /><a className="desk-top-link" href="/">返回官网</a></header>
      <main className="desk-bare-main">{children}</main>
    </div>
  );
}
