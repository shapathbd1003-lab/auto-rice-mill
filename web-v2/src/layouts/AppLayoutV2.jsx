import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Badge, Avatar, Menu,
  MenuItem, Divider, Chip, useMediaQuery, useTheme, Collapse,
} from '@mui/material';
import {
  Dashboard, Menu as MenuIcon, Notifications, ExitToApp, Person,
  AccountTree, ReceiptLong, Assessment, Inventory2, ExpandLess, ExpandMore,
  Factory, Badge as BadgeIcon, DirectionsCar, Security, Grain, Settings,
} from '@mui/icons-material';
import { logout } from '../store/authSlice';
import api from '../services/api';

const DRAWER_WIDTH = 260;

const NAV = [
  { label:'Dashboard', icon:<Dashboard/>, path:'/' },
  {
    label:'Masters', icon:<AccountTree/>, children:[
      { label:'Ledger Groups',   path:'/masters/ledger-groups' },
      { label:'Ledgers',         path:'/masters/ledgers' },
      { label:'Stock Groups',    path:'/masters/stock-groups' },
      { label:'Units',           path:'/masters/units' },
      { label:'Cost Centers',    path:'/masters/cost-centers' },
      { label:'Voucher Types',   path:'/masters/voucher-types' },
    ],
  },
  {
    label:'Vouchers', icon:<ReceiptLong/>, children:[
      { label:'Payment Voucher', path:'/vouchers/payment' },
      { label:'Receipt Voucher', path:'/vouchers/receipt' },
      { label:'Contra Voucher',  path:'/vouchers/contra' },
      { label:'Journal Voucher', path:'/vouchers/journal' },
      { label:'Purchase Voucher',path:'/vouchers/purchase' },
      { label:'Sales Voucher',   path:'/vouchers/sales' },
      { label:'Debit Note',      path:'/vouchers/debit-note' },
      { label:'Credit Note',     path:'/vouchers/credit-note' },
      { label:'Production',      path:'/vouchers/production' },
      { label:'All Vouchers',    path:'/vouchers' },
    ],
  },
  {
    label:'Reports', icon:<Assessment/>, children:[
      { label:'Trial Balance',   path:'/reports/trial-balance' },
      { label:'Profit & Loss',   path:'/reports/profit-loss' },
      { label:'Balance Sheet',   path:'/reports/balance-sheet' },
      { label:'Day Book',        path:'/reports/day-book' },
      { label:'Customer Due',    path:'/reports/customer-due' },
      { label:'Supplier Due',    path:'/reports/supplier-due' },
      { label:'Paddy Purchase',  path:'/reports/paddy-purchase' },
      { label:'Production',      path:'/reports/production' },
      { label:'Stock Report',    path:'/reports/stock' },
      { label:'Profit Analysis', path:'/reports/profit-analysis' },
    ],
  },
  {
    label:'Mill Operations', icon:<Factory/>, children:[
      { label:'Inventory',       path:'/inventory' },
      { label:'Production',      path:'/production' },
      { label:'Employees',       path:'/employees' },
      { label:'Vehicles',        path:'/vehicles' },
    ],
  },
  {
    label:'Administration', icon:<Security/>, adminOnly:true, children:[
      { label:'Roles',           path:'/admin/roles' },
      { label:'Users',           path:'/admin/users' },
      { label:'Audit Trail',     path:'/admin/audit-trail' },
    ],
  },
];

function NavItem({ item, level=0 }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useSelector((s) => s.auth);
  const [open, setOpen] = useState(false);

  if (item.adminOnly && !user?.isAdmin) return null;

  const isActive = item.path
    ? location.pathname === item.path
    : item.children?.some((c) => location.pathname.startsWith(c.path));

  useEffect(() => { if (isActive && item.children) setOpen(true); }, [location.pathname]);

  if (item.children) {
    return (
      <>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setOpen(!open)} sx={{ pl:level*2+1.5, bgcolor:isActive?'rgba(27,94,32,0.08)':'transparent' }}>
            {item.icon && <ListItemIcon sx={{ minWidth:34, color:'#2E7D32' }}>{item.icon}</ListItemIcon>}
            <ListItemText primary={<Typography variant="body2" fontWeight={isActive?'bold':'normal'} fontSize={13}>{item.label}</Typography>}/>
            {open ? <ExpandLess fontSize="small"/> : <ExpandMore fontSize="small"/>}
          </ListItemButton>
        </ListItem>
        <Collapse in={open}>
          <List dense disablePadding>
            {item.children.map((c) => <NavItem key={c.path} item={c} level={level+1}/>)}
          </List>
        </Collapse>
      </>
    );
  }

  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={() => navigate(item.path)}
        selected={location.pathname === item.path}
        sx={{ pl:level*2+1.5, '&.Mui-selected':{ bgcolor:'rgba(27,94,32,0.14)', borderRight:'3px solid #1B5E20' } }}>
        {item.icon && <ListItemIcon sx={{ minWidth:34, color:'#2E7D32' }}>{item.icon}</ListItemIcon>}
        <ListItemText primary={<Typography variant="body2" fontSize={13} fontWeight={location.pathname===item.path?'bold':'normal'}>{item.label}</Typography>}/>
      </ListItemButton>
    </ListItem>
  );
}

export default function AppLayoutV2() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));
  const { user }  = useSelector((s) => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl]     = useState(null);

  const handleLogout = async () => {
    try { await api.post('/v2/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }); } catch {}
    dispatch(logout()); navigate('/login');
  };

  const drawer = (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', bgcolor:'#fff' }}>
      <Box sx={{ p:1.5, bgcolor:'#1B5E20', color:'white', display:'flex', alignItems:'center', gap:1 }}>
        <Grain sx={{ fontSize:24 }}/>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" noWrap fontSize={13}>Mithila Auto Rice Mill</Typography>
          <Typography variant="caption" sx={{ opacity:0.8, fontSize:10 }}>ERP v2.0 — Tally Style</Typography>
        </Box>
      </Box>
      <List dense sx={{ flexGrow:1, overflowY:'auto', py:0.5 }}>
        {NAV.map((item) => <NavItem key={item.label} item={item}/>)}
      </List>
      <Divider/>
      <Box sx={{ p:1.5, bgcolor:'#f5f5f5' }}>
        <Typography variant="caption" fontWeight="bold" color="text.secondary">{user?.name}</Typography>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5, mt:0.3 }}>
          {(user?.roles||[]).slice(0,2).map((r) => <Chip key={r} label={r} size="small" sx={{ fontSize:9, height:16 }}/>)}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display:'flex' }}>
      <AppBar position="fixed" sx={{ zIndex:(t) => t.zIndex.drawer+1, bgcolor:'#1B5E20', boxShadow:1 }}>
        <Toolbar variant={isMobile?'dense':'regular'} sx={{ minHeight:{ xs:52, sm:60 } }}>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr:1, display:{ sm:'none' } }}>
            <MenuIcon/>
          </IconButton>
          <Typography variant={isMobile?'body1':'h6'} fontWeight="bold" noWrap sx={{ flexGrow:1, fontSize:{ xs:14, sm:16 } }}>
            Mithila Auto Rice Mill ERP
          </Typography>
          <IconButton color="inherit" size="small" sx={{ mr:1 }}>
            <Badge badgeContent={0} color="error"><Notifications fontSize="small"/></Badge>
          </IconButton>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width:28, height:28, bgcolor:'#4CAF50', fontSize:13 }}>
              {user?.name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Person fontSize="small" sx={{ mr:1 }}/>
              {user?.name}
              {user?.isAdmin && <Chip label="Admin" size="small" color="error" sx={{ ml:1 }}/>}
            </MenuItem>
            <Divider/>
            <MenuItem onClick={handleLogout}><ExitToApp fontSize="small" sx={{ mr:1 }}/>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ display:{ xs:'none', sm:'block' }, width:DRAWER_WIDTH, flexShrink:0, '& .MuiDrawer-paper':{ width:DRAWER_WIDTH, boxSizing:'border-box', top:60, height:'calc(100% - 60px)', overflowY:'auto', borderRight:'1px solid #e0e0e0' } }}>
        {drawer}
      </Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted:true }} sx={{ display:{ xs:'block', sm:'none' }, '& .MuiDrawer-paper':{ width:DRAWER_WIDTH } }}>
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow:1, p:{ xs:1.5, sm:2, md:3 }, mt:{ xs:'52px', sm:'60px' }, minHeight:'100vh', bgcolor:'#f8f9fa', width:{ xs:'100%', sm:`calc(100% - ${DRAWER_WIDTH}px)` }, overflowX:'hidden' }}>
        <Outlet/>
      </Box>
    </Box>
  );
}
