// Area: site — see docs/PLAN.md for the owner and the page list.
import { Routes, Route } from 'react-router-dom';
import { Placeholder } from '../../components/states';

export default function SiteRoutes() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder title="site" />} />
    </Routes>
  );
}
