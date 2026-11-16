// Area: admin — see docs/PLAN.md for the owner and the page list.
import { Routes, Route } from 'react-router-dom';
import { Placeholder } from '../../components/states';

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder title="admin" />} />
    </Routes>
  );
}
