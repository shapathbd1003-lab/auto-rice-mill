import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

// V2 pages
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Masters from './pages/Masters/Masters';
import VoucherEntry from './pages/Vouchers/VoucherEntry';
import ReportsPage from './pages/ReportsV2/Reports';
import Admin from './pages/Admin/Admin';

// Keep existing pages for Mill Operations
import Production from './pages/Production/Production';
import Inventory from './pages/Inventory/Inventory';
import Employees from './pages/Employees/Employees';
import Vehicles from './pages/Vehicles/Vehicles';
import Notifications from './pages/Notifications/Notifications';

// V2 Layout (new sidebar)
import AppLayoutV2 from './layouts/AppLayoutV2';

function RequireAuth({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><AppLayoutV2 /></RequireAuth>}>
        <Route index element={<Dashboard />} />

        {/* Masters */}
        <Route path="masters"      element={<Masters />} />
        <Route path="masters/:type" element={<Masters />} />

        {/* Vouchers — all types */}
        <Route path="vouchers"              element={<VoucherEntry />} />
        <Route path="vouchers/:type"        element={<VoucherEntry />} />

        {/* Reports */}
        <Route path="reports"       element={<ReportsPage />} />
        <Route path="reports/:type" element={<ReportsPage />} />

        {/* Administration */}
        <Route path="admin"           element={<Admin />} />
        <Route path="admin/:section"  element={<Admin />} />

        {/* Mill Operations (kept from v1) */}
        <Route path="inventory/*"  element={<Inventory />} />
        <Route path="production/*" element={<Production />} />
        <Route path="employees/*"  element={<Employees />} />
        <Route path="vehicles/*"   element={<Vehicles />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
