// Area: desk (F3 · counselor workbench) — see docs/PLAN.md.
import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from '../../components/states';
import DeskLayout from './DeskLayout';
import Today from './pages/Today';
import Appointments from './pages/Appointments';
import Brief from './pages/Brief';
import Schedule from './pages/Schedule';
import Messages from './pages/Messages';
import Earnings from './pages/Earnings';
import Room from './pages/Room';
import Apply from './pages/Apply';
import { Empty } from '../../components/states';
import './desk.css';

export default function DeskRoutes() {
  return (
    <Routes>
      <Route path="apply" element={<RequireAuth><Apply /></RequireAuth>} />
      <Route path="room/:id" element={<RequireAuth role="counselor"><Room /></RequireAuth>} />
      <Route element={<RequireAuth role="counselor"><DeskLayout /></RequireAuth>}>
        <Route index element={<Today />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="appointments/:id" element={<Brief />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="messages" element={<Messages />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="*" element={<Empty title="页面不存在" hint="请从左侧导航进入" />} />
      </Route>
    </Routes>
  );
}
