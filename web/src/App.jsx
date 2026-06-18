import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Customers from './pages/Customers/Customers';
import Suppliers from './pages/Suppliers/Suppliers';
import Purchases from './pages/Purchases/Purchases';
import Production from './pages/Production/Production';
import Inventory from './pages/Inventory/Inventory';
import Sales from './pages/Sales/Sales';
import Accounting from './pages/Accounting/Accounting';
import Employees from './pages/Employees/Employees';
import Vehicles from './pages/Vehicles/Vehicles';
import Reports from './pages/Reports/Reports';
import Notifications from './pages/Notifications/Notifications';
import CustomerKhata from './pages/Khata/CustomerKhata';
import SupplierKhata from './pages/Khata/SupplierKhata';
import CashBook from './pages/Khata/CashBook';
import ExpenseBook from './pages/Khata/ExpenseBook';
import DailySalesBook from './pages/Khata/DailySalesBook';
import DailyPurchaseBook from './pages/Khata/DailyPurchaseBook';
import ChartOfAccounts from './pages/ERP/ChartOfAccounts';
import VoucherEntry from './pages/ERP/VoucherEntry';
import TallyReports from './pages/ERP/TallyReports';
import Banking from './pages/ERP/Banking';
import CompanySettings from './pages/ERP/CompanySettings';

function RequireAuth({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index         element={<Dashboard />} />
        <Route path="customers/*"  element={<Customers />} />
        <Route path="suppliers/*"  element={<Suppliers />} />
        <Route path="purchases/*"  element={<Purchases />} />
        <Route path="production/*" element={<Production />} />
        <Route path="inventory/*"  element={<Inventory />} />
        <Route path="sales/*"      element={<Sales />} />
        <Route path="accounting/*" element={<Accounting />} />
        <Route path="employees/*"  element={<Employees />} />
        <Route path="vehicles/*"   element={<Vehicles />} />
        <Route path="reports/*"        element={<Reports />} />
        <Route path="notifications"    element={<Notifications />} />
        <Route path="khata/customers"     element={<CustomerKhata />} />
        <Route path="khata/suppliers"     element={<SupplierKhata />} />
        <Route path="khata/cashbook"      element={<CashBook />} />
        <Route path="khata/expenses"      element={<ExpenseBook />} />
        <Route path="khata/daily-sales"   element={<DailySalesBook />} />
        <Route path="khata/daily-purchase" element={<DailyPurchaseBook />} />
        <Route path="erp/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="erp/vouchers"           element={<VoucherEntry />} />
        <Route path="erp/tally-reports"      element={<TallyReports />} />
        <Route path="erp/banking"            element={<Banking />} />
        <Route path="erp/settings"           element={<CompanySettings />} />
      </Route>
    </Routes>
  );
}
