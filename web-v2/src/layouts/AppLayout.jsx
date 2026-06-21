import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Badge, Avatar, Menu, MenuItem,
  Divider, Chip, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard, People, LocalShipping, ShoppingCart, Factory, Inventory2,
  PointOfSale, AccountBalance, Badge as BadgeIcon, DirectionsCar,
  Assessment, Notifications, Menu as MenuIcon, Translate, ExitToApp,
  Person, Warning, AccountBalanceWallet, Receipt, ShoppingBag,
  AccountTree, ReceiptLong, BarChart, AccountBalanceRounded, Settings,
  Folder, SpaceDashboard,
} from '@mui/icons-material';
import { logout } from '../store/authSlice';
import { setNotifications } from '../store/notificationSlice';
import api from '../services/api';

const DRAWER_WIDTH = 240;

const navItems = [
  { key: 'dashboard', icon: <Dashboard />, path: '/' },
];

const khataNavItems = [
  { key: 'customerKhata',     icon: <People />,               path: '/khata/customers' },
  { key: 'supplierKhata',     icon: <LocalShipping />,        path: '/khata/suppliers' },
  { key: 'cashBook',          icon: <AccountBalanceWallet />, path: '/khata/cashbook' },
  { key: 'expenseBook',       icon: <Receipt />,              path: '/khata/expenses' },
  { key: 'dailySalesBook',    icon: <PointOfSale />,          path: '/khata/daily-sales' },
  { key: 'dailyPurchaseBook', icon: <ShoppingBag />,          path: '/khata/daily-purchase' },
];

const erpNavItems = [
  { key: 'accountsDashboard', icon: <SpaceDashboard />,        path: '/erp/accounts' },
  { key: 'ledgerGroups',      icon: <Folder />,                path: '/erp/ledger-groups' },
  { key: 'chartOfAccounts',   icon: <AccountTree />,           path: '/erp/chart-of-accounts' },
  { key: 'voucherEntry',      icon: <ReceiptLong />,           path: '/erp/vouchers' },
  { key: 'tallyReports',      icon: <BarChart />,              path: '/erp/tally-reports' },
  { key: 'banking',           icon: <AccountBalanceRounded />, path: '/erp/banking' },
  { key: 'companySettings',   icon: <Settings />,              path: '/erp/settings' },
];

const millNavItems = [
  { key: 'purchases',  icon: <ShoppingCart />,   path: '/purchases' },
  { key: 'production', icon: <Factory />,        path: '/production' },
  { key: 'inventory',  icon: <Inventory2 />,     path: '/inventory' },
  { key: 'sales',      icon: <PointOfSale />,    path: '/sales' },
  { key: 'accounting', icon: <AccountBalance />, path: '/accounting' },
  { key: 'employees',  icon: <BadgeIcon />,      path: '/employees' },
  { key: 'vehicles',   icon: <DirectionsCar />,  path: '/vehicles' },
  { key: 'reports',    icon: <Assessment />,     path: '/reports' },
];

// All nav items flattened for page title lookup
const allNavItems = [...navItems, ...khataNavItems, ...erpNavItems, ...millNavItems];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

  // Close mobile drawer when navigating
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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

  const langLabel = i18n.language === 'en' ? 'বাংলা' : 'EN';

  const currentNavKey = allNavItems.find(
    (n) => n.path === location.pathname || (n.path !== '/' && location.pathname.startsWith(n.path))
  )?.key || 'dashboard';

  const NavItem = ({ icon, path, label }) => (
    <ListItem disablePadding>
      <ListItemButton
        selected={location.pathname === path || (path !== '/' && location.pathname.startsWith(path))}
        onClick={() => { navigate(path); setMobileOpen(false); }}
        sx={{
          py: 0.75,
          '&.Mui-selected': { bgcolor: 'primary.light', color: 'white', '& .MuiSvgIcon-root': { color: 'white' } },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
        <ListItemText primary={<Typography variant="body2">{label}</Typography>} />
      </ListItemButton>
    </ListItem>
  );

  const SectionLabel = ({ label }) => (
    <Box sx={{ px: 2, pt: 0.75, pb: 0.25 }}>
      <Typography variant="caption" color="text.disabled" fontWeight="bold" letterSpacing={0.5}>{label}</Typography>
    </Box>
  );

  const drawer = (
    <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Brand header */}
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', minHeight: 64, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="subtitle1" fontWeight="bold" noWrap>{t('app.name')}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }} noWrap>{t('app.tagline')}</Typography>
      </Box>

      <List dense disablePadding>
        {navItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <SectionLabel label={t('nav.sections.khata')} />
      <List dense disablePadding>
        {khataNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <SectionLabel label={t('nav.sections.erp')} />
      <List dense disablePadding>
        {erpNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>

      <Divider />
      <SectionLabel label={t('nav.sections.mill')} />
      <List dense disablePadding>
        {millNavItems.map(({ key, icon, path }) => (
          <NavItem key={key} icon={icon} path={path} label={t(`nav.${key}`)} />
        ))}
      </List>
      <Box sx={{ height: 32 }} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: (th) => th.zIndex.drawer + 1, bgcolor: 'primary.dark' }}>
        <Toolbar variant={isMobile ? 'dense' : 'regular'} sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit" edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 1, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight="bold" noWrap sx={{ flexGrow: 1 }}>
            {t(`nav.${currentNavKey}`)}
          </Typography>

          {isOffline && (
            <Chip label="OFFLINE" size="small" color="warning" sx={{ mr: 1, fontSize: 10 }} />
          )}

          {/* Language toggle — always shows both */}
          <IconButton color="inherit" onClick={toggleLang} size="small" sx={{ mr: 0.5, borderRadius: 1, px: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: { xs: 10, sm: 12 }, fontWeight: 'bold', lineHeight: 1 }}>
              বাংলা
            </Typography>
            <Typography variant="caption" sx={{ fontSize: { xs: 9, sm: 11 }, mx: 0.3, opacity: 0.6 }}>|</Typography>
            <Typography variant="caption" sx={{ fontSize: { xs: 10, sm: 12 }, fontWeight: 'bold', lineHeight: 1 }}>
              EN
            </Typography>
          </IconButton>

          <IconButton color="inherit" onClick={() => navigate('/notifications')} size="small" sx={{ mr: 0.5 }}>
            <Badge badgeContent={unreadCount} color="error"><Notifications fontSize="small" /></Badge>
          </IconButton>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', fontSize: 13 }}>
              {user?.name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="body2" fontWeight="bold">{user?.name}</Typography>
              <Chip label={user?.role} size="small" sx={{ mt: 0.5 }} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ExitToApp fontSize="small" sx={{ mr: 1 }} />{t('auth.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100% - 64px)',
            overflowY: 'auto',
            overflowX: 'hidden',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, top: 0 },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          mt: { xs: '56px', sm: '64px' },
          minHeight: '100vh',
          bgcolor: 'background.default',
          width: { xs: '100%', sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          overflowX: 'hidden',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
