// Area: mobile — see docs/PLAN.md for the owner and the page list.
import { Routes, Route } from 'react-router-dom';
import { Placeholder } from '../../components/states';

export default function MobileRoutes() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder title="mobile" />} />
    </Routes>
  );
}
