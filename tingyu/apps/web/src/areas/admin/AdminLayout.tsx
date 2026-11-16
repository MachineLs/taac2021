// Admin console shell: left navigation + top bar + content (F4).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { IconAlert, IconChart, IconClose, IconLogout, IconMegaphone, IconMenu, IconReceipt, IconShield } from './icons';

interface AdminShell { openCrisis: number | null; refreshCrisis: () => void }
const ShellCtx = createContext<AdminShell>({ openCrisis: null, refreshCrisis: () => {} });
export const useAdminShell = () => useContext(ShellCtx);

const NAV = [
  { to: '/admin', end: true, label: '运营总览', icon: <IconChart /> },
  { to: '/admin/crisis', label: '危机预警', icon: <IconAlert />, crisis: true },
  { to: '/admin/counselors', label: '咨询师审核', icon: <IconShield /> },
  { to: '/admin/appointments', label: '订单管理', icon: <IconReceipt /> },
  { to: '/admin/creators', label: '达人合作', icon: <IconMegaphone /> },
];
const TITLES: Record<string, string> = {
  '/admin': '运营总览', '/admin/crisis': '危机预警', '/admin/counselors': '咨询师审核', '/admin/appointments': '订单管理', '/admin/creators': '达人合作',
};

export function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [openCrisis, setOpenCrisis] = useState<number | null>(null);

  const refreshCrisis = useCallback(() => {
    api.adminCrisis('open').then((list) => setOpenCrisis(list.length)).catch(() => { /* badge is best-effort */ });
  }, []);
  useEffect(() => {
    refreshCrisis();
    const t = window.setInterval(refreshCrisis, 30000);
    return () => window.clearInterval(t);
  }, [refreshCrisis]);
  useEffect(() => { setMenu(false); }, [loc.pathname]);

  const title = TITLES[loc.pathname.replace(/\/$/, '')] ?? '运营后台';
  const onLogout = () => { logout(); nav('/login?next=%2Fadmin', { replace: true }); };

  return (
    <ShellCtx.Provider value={{ openCrisis, refreshCrisis }}>
      <div className={`adm${menu ? ' adm-menu-open' : ''}`}>
        <aside className="adm-side" aria-label="后台导航">
          <div className="adm-brand">
            <Link to="/admin" className="adm-logo"><span className="adm-logo-mark">屿</span><span><b>听屿</b><small>运营后台</small></span></Link>
            <button type="button" className="adm-icon-btn adm-side-close" onClick={() => setMenu(false)} aria-label="关闭菜单"><IconClose /></button>
          </div>
          <nav className="adm-nav">
            <span className="adm-nav-group">工作台</span>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `adm-nav-item${isActive ? ' on' : ''}`}>
                {n.icon}<span>{n.label}</span>
                {n.crisis && openCrisis ? <em className="adm-nav-count" aria-label={`${openCrisis} 条未处理`}>{openCrisis}</em> : null}
              </NavLink>
            ))}
          </nav>
          <div className="adm-side-foot">
            <p className="adm-side-note">AI 只做接待、初筛与匹配，不做诊断与治疗。危机预警须 3 分钟内响应。</p>
            <a className="adm-side-link" href="/">返回官网</a>
          </div>
        </aside>
        {menu && <div className="adm-scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
        <div className="adm-main">
          <header className="adm-top">
            <button type="button" className="adm-icon-btn adm-menu-btn" onClick={() => setMenu(true)} aria-label="打开菜单"><IconMenu /></button>
            <h1 className="adm-top-title">{title}</h1>
            <div className="adm-top-right">
              {openCrisis ? (
                <Link to="/admin/crisis" className="adm-top-alert"><span className="adm-pulse" aria-hidden="true" />{openCrisis} 条危机待处理</Link>
              ) : null}
              <div className="adm-me">
                {user?.avatar ? <img className="avatar" src={user.avatar} alt="" width={30} height={30} /> : <span className="adm-me-ph" aria-hidden="true">{user?.name?.slice(0, 1)}</span>}
                <span className="adm-me-name">{user?.name}</span>
              </div>
              <button type="button" className="btn btn-line btn-sm" onClick={onLogout}><IconLogout /><span className="adm-hide-sm">退出</span></button>
            </div>
          </header>
          <main className="adm-content">
            <Outlet />
          </main>
        </div>
      </div>
    </ShellCtx.Provider>
  );
}
