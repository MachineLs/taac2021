// Area: mobile (F2) — the 听屿 App / H5, mounted at /m/*. Paths below are relative.
import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth } from '../../components/states';
import { captureRefFromUrl } from '../../lib/ref';
import './mobile.css';
import './pages.css';
import './voice.css';
import Home from './pages/Home';
import Voice from './pages/Voice';
import IntakeResult from './pages/IntakeResult';
import Intakes from './pages/Intakes';
import Counselors from './pages/Counselors';
import CounselorDetail from './pages/CounselorDetail';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Room from './pages/Room';
import Messages from './pages/Messages';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import Me from './pages/Me';
import Mood from './pages/Mood';
import Assess from './pages/Assess';
import AssessTake from './pages/AssessTake';
import AssessResult from './pages/AssessResult';
import Coupons from './pages/Coupons';
import Login from './pages/Login';
import Landing from './pages/Landing';
import { NavBar } from './ui';

const Auth = ({ children }: { children: ReactNode }) => <RequireAuth loginPath="/m/login">{children}</RequireAuth>;

function ScrollTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <>
      <NavBar title="页面不存在" />
      <div className="st st-full"><b>页面走丢了</b><span>链接可能已失效</span><Link className="btn btn-blue btn-pill" to="/m">回到首页</Link></div>
    </>
  );
}

export default function MobileRoutes() {
  useEffect(() => { captureRefFromUrl(); }, []);
  return (
    <div className="m-root">
      <div className="m-app">
        <ScrollTop />
        <Routes>
          <Route index element={<Home />} />
          <Route path="voice" element={<Voice />} />
          <Route path="intake/:id" element={<IntakeResult />} />
          <Route path="intakes" element={<Auth><Intakes /></Auth>} />
          <Route path="counselors" element={<Counselors />} />
          <Route path="counselors/:id" element={<CounselorDetail />} />
          <Route path="checkout/:id" element={<Auth><Checkout /></Auth>} />
          <Route path="orders" element={<Auth><Orders /></Auth>} />
          <Route path="orders/:id" element={<Auth><OrderDetail /></Auth>} />
          <Route path="room/:id" element={<Auth><Room /></Auth>} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Auth><Chat /></Auth>} />
          <Route path="notifications" element={<Auth><Notifications /></Auth>} />
          <Route path="me" element={<Me />} />
          <Route path="mood" element={<Auth><Mood /></Auth>} />
          <Route path="assess" element={<Assess />} />
          <Route path="assess/result/:id" element={<Auth><AssessResult /></Auth>} />
          <Route path="assess/:scale" element={<Auth><AssessTake /></Auth>} />
          <Route path="coupons" element={<Auth><Coupons /></Auth>} />
          <Route path="login" element={<Login />} />
          <Route path="r/:refCode" element={<Landing />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}
