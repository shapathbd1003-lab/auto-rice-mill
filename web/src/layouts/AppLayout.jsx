import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Badge, Avatar, Menu, MenuItem,
  Divider, Chip,
} from '@mui/material';
import {
  Dashboard, People, LocalShipping, ShoppingCart, Factory, Inventory2,
  PointOfSale, AccountBalance, Badge as BadgeIcon, DirectionsCar,
  Assessment, Notifications, Menu as MenuIcon, Translate, ExitToApp,
  Person, Warning, MenuBook, AccountBalanceWallet, Receipt, ShoppingBag,
  AccountTree, ReceiptLong, BarChart, AccountBalanceRounded, Settings,
  Folder, SpaceDashboard,
} from '@mui/icons-material';
import { logout } from '../store/authSlice';
import { setNotifications } from '../store/notificationSlice';
import api from '../services/api';

const DRAWER_WIDTH = 240;

const navItems = [
  { key: 'dashboard',  icon: <Dashboard />,       path: '/' },
];

const khataNavItems = [
  { key: 'customerKhata',    icon: <People />,                  path: '/khata/customers' },
  { key: 'supplierKhata',    icon: <LocalShipping />,           path: '/khata/suppliers' },
  { key: 'cashBook',         icon: <AccountBalanceWallet />,    path: '/khata/cashbook' },
  { key: 'expenseBook',      icon: <Receipt />,                 path: '/khata/expenses' },
  { key: 'dailySalesBook',   icon: <PointOfSale />,             path: '/khata/daily-sales' },
  { key: 'dailyPurchaseBook',icon: <ShoppingBag />,             path: '/khata/daily-purchase' },
];

const erpNavItems = [
  { key: 'accountsDashboard', icon: <SpaceDashboard />,       path: '/erp/accounts' },
  { key: 'ledgerGroups',      icon: <Folder />,               path: '/erp/ledger-groups' },
  { key: 'chartOfAccounts',   icon: <AccountTree />,          path: '/erp/chart-of-accounts' },
  { key: 'voucherEntry',      icon: <ReceiptLong />,          path: '/erp/vouchers' },
  { key: 'tallyReports',      icon: <BarChart />,             path: '/erp/tally-reports' },
  { key: 'banking',           icon: <AccountBalanceRounded />, path: '/erp/banking' },
  { key: 'companySettings',   icon: <Settings />,             path: '/erp/settings' },
];

const millNavItems = [
  { key: 'purchases',  icon: <ShoppingCart />,     path: '/purchases' },
  { key: 'production', icon: <Factory />,          path: '/production' },
  { key: 'inventory',  icon: <Inventory2 />,       path: '/inventory' },
  { key: 'sales',      icon: <PointOfSale />,      path: '/sales' },
  { key: 'accounting', icon: <AccountBalance />,   path: '/accounting' },
  { key: 'employees',  icon: <BadgeIcon />,        path: '/employees' },
  { key: 'vehicles',   icon: <DirectionsCar />,    path: '/vehicles' },
  { key: 'reports',    icon: <Assessment />,       path: '/reports' },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, isOffline } = useSelector((s) => s.auth);
  const { unreadCount } = useSelector((s) => s.notifications);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const fetchNotifications = useCallback(() => {
    if (isOffline) return;
    api.get('/notifications').then((r) => dispatch(setNotifications(r.data.data || []))).catch(() => {});
  }, [dispatch, isOffline]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleLogout = async () => {
    const rt = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken: rt }); } catch {}
    dispatch(logout());
    navigate('/login');
  };

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'bn' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  const NavItem = ({ icon, path, label }) => (
    <ListItem disablePadding>
      <ListItemButton
        selected={location.pathname === path || (path !== '/' && location.pathname.startsWith(path))}
        onClick={() => { navigate(path); setMobileOpen(false); }}
        sx={{ '&.Mui-selected': { bgcolor: 'primary.light', color: 'white', '& .MuiSvgIcon-root': { color: 'white' } } }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
        <ListItemText primary={label} />
      </ListItemButton>
    </ListItem>
  );

  const drawer = (
    <Box>
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6" fontWeight="bold">{t('app.name')}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('app.tagline')}</Typography>
      </Box>
      <List dense>
        {navItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <Box sx={{ px: 2, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">KHATA BOOK</Typography>
      </Box>
      <List dense>
        {khataNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <Box sx={{ px: 2, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">TALLY ERP</Typography>
      </Box>
      <List dense>
        {erpNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <Box sx={{ px: 2, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">RICE MILL</Typography>
      </Box>
      <List dense>
        {millNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'primary.dark' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t(`nav.${navItems.find((n) => n.path === location.pathname || (n.path !== '/' && location.pathname.startsWith(n.path)))?.key || 'dashboard'}`)}
          </Typography>
          {isOffline && (
            <Chip label="OFFLINE" size="small" color="warning" icon={<Warning />} sx={{ mr: 1, fontWeight: 'bold' }} />
          )}
          <IconButton color="inherit" onClick={toggleLang} size="small">
            <Translate fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>{i18n.language.toUpperCase()}</Typography>
          </IconButton>
          <IconButton color="inherit" onClick={() => navigate('/notifications')} sx={{ mx: 1 }}>
            <Badge badgeContent={unreadCount} color="error"><Notifications /></Badge>
          </IconButton>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled><Person fontSize="small" sx={{ mr: 1 }} />{user?.name} <Chip label={user?.role} size="small" sx={{ ml: 1 }} /></MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}><ExitToApp fontSize="small" sx={{ mr: 1 }} />{t('auth.logout')}</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', mt: '64px' } }}>
        {drawer}
      </Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: '64px', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
