// Top-level routing. Owned by the lead. Each area owns everything under its own folder.
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loading } from './components/states';

const SiteRoutes = lazy(() => import('./areas/site/routes'));       // F1 · desktop website + user center   → /*
const MobileRoutes = lazy(() => import('./areas/mobile/routes'));   // F2 · mobile app / H5                 → /m/*
const DeskRoutes = lazy(() => import('./areas/desk/routes'));       // F3 · counselor workbench             → /desk/*
const AdminRoutes = lazy(() => import('./areas/admin/routes'));     // F4 · admin console                   → /admin/*
const CreatorRoutes = lazy(() => import('./areas/creator/routes')); // F4 · creator (达人) dashboard          → /creator/*

export default function App() {
  return (
    <Suspense fallback={<Loading full />}>
      <Routes>
        <Route path="/m/*" element={<MobileRoutes />} />
        <Route path="/desk/*" element={<DeskRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/creator/*" element={<CreatorRoutes />} />
        <Route path="/*" element={<SiteRoutes />} />
      </Routes>
    </Suspense>
  );
}
