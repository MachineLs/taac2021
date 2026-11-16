// Area: site (F1) — desktop website + user center, mounted at /*.
import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from '../../components/states';
import { SiteLayout } from './components/Layout';
import Home from './pages/Home';
import Counselors from './pages/Counselors';
import CounselorDetail from './pages/CounselorDetail';
import Checkout from './pages/Checkout';
import Intake from './pages/Intake';
import Login from './pages/Login';
import Room from './pages/Room';
import CreatorLanding from './pages/CreatorLanding';
import NotFound from './pages/NotFound';
import AccountLayout from './pages/account/AccountLayout';
import Appointments from './pages/account/Appointments';
import Messages from './pages/account/Messages';
import Assessments from './pages/account/Assessments';
import Mood from './pages/account/Mood';
import Notifications from './pages/account/Notifications';
import './site.css';
import './site-pages.css';
import './site-intake.css';
import './site-account.css';

export default function SiteRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="room/:id" element={<RequireAuth><div className="site"><Room /></div></RequireAuth>} />
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="counselors" element={<Counselors />} />
        <Route path="counselors/:id" element={<CounselorDetail />} />
        <Route path="checkout/:id" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="intake" element={<Intake />} />
        <Route path="r/:refCode" element={<CreatorLanding />} />
        <Route path="account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
          <Route index element={<Appointments />} />
          <Route path="messages" element={<Messages />} />
          <Route path="assessments" element={<Assessments />} />
          <Route path="mood" element={<Mood />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
