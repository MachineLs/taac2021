import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../../auth/AuthContext';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/Layout';

const MENU = [
  { to: '/account', end: true, icon: 'calendar', l: '我的预约' },
  { to: '/account/messages', icon: 'chat', l: '消息' },
  { to: '/account/assessments', icon: 'clipboard', l: '心理测评' },
  { to: '/account/mood', icon: 'smile', l: '情绪记录' },
  { to: '/account/notifications', icon: 'bell', l: '通知' },
];

export default function AccountLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="site-wrap site-account">
      <aside className="site-acc-side">
        <div className="card site-acc-user">
          <UserAvatar src={user.avatar} name={user.name} size={52} />
          <div><b>{user.name}</b><span className="num muted">{user.phone}</span></div>
        </div>
        <nav className="card site-acc-menu" aria-label="个人中心">
          {MENU.map((m) => <NavLink key={m.to} to={m.to} end={m.end}><Icon name={m.icon} size={18} />{m.l}<Icon name="right" size={14} className="site-acc-arr" /></NavLink>)}
        </nav>
        <NavLink to="/intake" className="site-acc-ai"><span className="site-orb-sm"><Icon name="mic" size={15} /></span><span><b>和小屿聊聊</b><small>3 分钟梳理困扰，匹配咨询师</small></span></NavLink>
      </aside>
      <section className="site-acc-main"><Outlet /></section>
    </div>
  );
}
