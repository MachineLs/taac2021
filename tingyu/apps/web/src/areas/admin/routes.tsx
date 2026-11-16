// Area: admin (F4) — 运营后台, mounted at /admin/*.
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '../../components/states';
import { AdminLayout } from './AdminLayout';
import Overview from './pages/Overview';
import Counselors from './pages/Counselors';
import Appointments from './pages/Appointments';
import Crisis from './pages/Crisis';
import Creators from './pages/Creators';
import './admin.css';

export default function AdminRoutes() {
  return (
    <RequireAuth role="admin">
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="counselors" element={<Counselors />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="crisis" element={<Crisis />} />
          <Route path="creators" element={<Creators />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </RequireAuth>
  );
}
