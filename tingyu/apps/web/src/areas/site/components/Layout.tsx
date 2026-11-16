import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Icon } from './Icon';

export function Logo({ sub = true, to = '/' }: { sub?: boolean; to?: string }) {
  return (
    <Link className="site-logo" to={to} aria-label="听屿心理首页">
      <i>屿</i>
      <span>听屿心理{sub && <small>持证咨询师 · 在线预约</small>}</span>
    </Link>
  );
}

export function UserAvatar({ src, name, size = 32 }: { src: string | null | undefined; name: string; size?: number }) {
  if (src) return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  return <span className="site-ava-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{(name || '听').slice(0, 1)}</span>;
}

function UserMenu() {
  const { user, logout, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!user) return null;
  return (
    <div className="site-usermenu" ref={ref}>
      <button type="button" className="site-userbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <UserAvatar src={user.avatar} name={user.name} size={30} />
        <span className="site-username">{user.name}</span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="site-menu" role="menu" onClick={() => setOpen(false)}>
          <Link role="menuitem" to="/account"><Icon name="calendar" size={16} />我的预约</Link>
          <Link role="menuitem" to="/account/messages"><Icon name="chat" size={16} />消息</Link>
          <Link role="menuitem" to="/account/assessments"><Icon name="clipboard" size={16} />心理测评</Link>
          <Link role="menuitem" to="/account/mood"><Icon name="smile" size={16} />情绪记录</Link>
          {hasRole('counselor') && <a role="menuitem" href="/desk"><Icon name="case" size={16} />咨询师工作台</a>}
          {hasRole('creator') && <a role="menuitem" href="/creator"><Icon name="sparkle" size={16} />达人后台</a>}
          {hasRole('admin') && <a role="menuitem" href="/admin"><Icon name="shield" size={16} />运营后台</a>}
          <button role="menuitem" type="button" onClick={() => { logout(); nav('/'); }}><Icon name="logout" size={16} />退出登录</button>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  const next = encodeURIComponent(loc.pathname + loc.search);
  return (
    <>
      <div className="site-util">
        <div className="site-wrap">
          <span>需要紧急帮助？全国心理援助热线 <b>12356</b>（7×24 小时免费）</span>
          <nav aria-label="辅助导航">
            <a href="/desk">咨询师入驻</a>
            <a href="/creator">达人合作</a>
            <Link to="/m">手机版</Link>
          </nav>
        </div>
      </div>
      <header className="site-header">
        <div className="site-wrap">
          <Logo />
          <nav aria-label="主导航">
            <NavLink to="/" end>首页</NavLink>
            <NavLink to="/counselors">找咨询师</NavLink>
            <NavLink to="/intake">AI 语音接待<em>免费</em></NavLink>
            <NavLink to="/account/assessments">心理测评</NavLink>
            <NavLink to="/account/mood">情绪记录</NavLink>
          </nav>
          <div className="site-acts">
            <a className="btn btn-line site-hide-sm" href="/m">下载 App</a>
            {!ready ? <span className="site-acts-ph" /> : user ? <UserMenu /> : <Link className="btn btn-blue" to={`/login?next=${next}`}>登录 / 注册</Link>}
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap">
        <div className="site-fgrid">
          <div className="site-about">
            <Logo sub={false} />
            <p>AI 助理负责接待与匹配，持证咨询师负责专业咨询。让每一个想找人聊聊的人，都能找到对的人。</p>
            <span className="site-crisis-pill">危机求助 <b>12356</b> · 24 小时免费</span>
          </div>
          <div><h4>找咨询师</h4><ul>
            <li><Link to="/counselors?tag=焦虑">焦虑与压力</Link></li>
            <li><Link to="/counselors?tag=亲密关系">情感与婚姻</Link></li>
            <li><Link to="/counselors?tag=亲子">亲子与家庭</Link></li>
            <li><Link to="/counselors?tag=失眠">失眠与睡眠</Link></li>
            <li><Link to="/counselors?mode=offline">线下面询</Link></li>
          </ul></div>
          <div><h4>服务</h4><ul>
            <li><Link to="/counselors">心理咨询</Link></li>
            <li><Link to="/intake">AI 语音接待</Link></li>
            <li><Link to="/account/assessments">心理测评</Link></li>
            <li><Link to="/account/mood">情绪记录</Link></li>
          </ul></div>
          <div><h4>合作</h4><ul>
            <li><a href="/desk">咨询师入驻</a></li>
            <li><a href="/creator">达人后台</a></li>
            <li><span>企业 EAP</span></li>
          </ul></div>
          <div><h4>帮助</h4><ul>
            <li><span>退款规则</span></li>
            <li><span>隐私政策</span></li>
            <li><span>用户协议</span></li>
          </ul></div>
        </div>
        <div className="site-legal">
          <span>© 2026 听屿心理 · 京 ICP 备 XXXXXXXX 号（示意）</span>
          <span>AI 助理不提供诊断与治疗；如遇紧急情况请拨打 12356、120 或 110</span>
        </div>
      </div>
    </footer>
  );
}

/** Standard page chrome: util bar + header + content + footer. */
export function SiteLayout() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="site">
      <SiteHeader />
      <main className="site-main"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}

export function Modal({ title, onClose, children, width }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal site-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="site-modal-h"><h3>{title}</h3><button type="button" className="site-x" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  );
}
