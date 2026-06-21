import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Typography, Button, Paper } from '@mui/material';

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

// Error boundary to catch crashes and show message instead of blank page
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p:3, display:'flex', justifyContent:'center', mt:6 }}>
          <Paper sx={{ p:4, maxWidth:500, textAlign:'center' }}>
            <Typography variant="h6" color="error" sx={{ mb:2 }}>Something went wrong</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:2, fontFamily:'monospace', fontSize:11 }}>
              {this.state.error?.message}
            </Typography>
            <Button variant="contained" onClick={() => { this.setState({ error:null }); window.location.replace(window.location.pathname + '#/'); }}>
              Go to Dashboard
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><AppLayoutV2 /></RequireAuth>}>
          <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="masters"       element={<ErrorBoundary><Masters /></ErrorBoundary>} />
          <Route path="masters/:type" element={<ErrorBoundary><Masters /></ErrorBoundary>} />
          <Route path="vouchers"              element={<ErrorBoundary><VoucherEntry /></ErrorBoundary>} />
          <Route path="vouchers/:type"        element={<ErrorBoundary><VoucherEntry /></ErrorBoundary>} />
          <Route path="reports"       element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="reports/:type" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="admin"           element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="admin/:section"  element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="inventory/*"  element={<Inventory />} />
          <Route path="production/*" element={<Production />} />
          <Route path="employees/*"  element={<Employees />} />
          <Route path="vehicles/*"   element={<Vehicles />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
