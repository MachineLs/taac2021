// Area: creator (F4) — 达人后台, mounted at /creator/*.
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '../../components/states';
import Dashboard from './Dashboard';
import './creator.css';

export default function CreatorRoutes() {
  return (
    <RequireAuth role="creator">
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/creator" replace />} />
      </Routes>
    </RequireAuth>
  );
}
