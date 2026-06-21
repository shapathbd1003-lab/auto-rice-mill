import React, { useEffect, useState } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Paper, Table, TableBody, TableRow, TableCell, Button, Chip, Alert,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, People, LocalShipping,
  AccountBalanceWallet, Assessment, ReceiptLong, Inventory2,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n||0).toLocaleString('en-IN')}`;

function KpiCard({ title, value, sub, icon, color, path }) {
  const navigate = useNavigate();
  return (
    <Card
      onClick={() => path && navigate(path)}
      sx={{ cursor:path?'pointer':'default', height:'100%', '&:hover':path?{boxShadow:4}:{}, borderTop:'3px solid', borderColor:`${color}.main` }}>
      <CardContent sx={{ pb:'8px !important', pt:1.5, px:{xs:1.5,sm:2} }}>
        <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.5 }}>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize:{xs:10,sm:12} }}>{title}</Typography>
          <Box sx={{ color:`${color}.main` }}>{icon}</Box>
        </Box>
        <Typography variant="h6" fontWeight="bold" color={`${color}.main`} noWrap sx={{ fontSize:{xs:'1rem',sm:'1.2rem'} }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize:10 }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// Role-based quick actions
const ROLE_ACTIONS = {
  Administrator: [
    ['Payment Voucher',  '/vouchers/payment',  'error'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Purchase Voucher', '/vouchers/purchase', 'warning'],
    ['Sales Voucher',    '/vouchers/sales',    'primary'],
    ['Journal Voucher',  '/vouchers/journal',  'secondary'],
    ['Production',       '/vouchers/production','info'],
  ],
  Manager: [
    ['Payment Voucher',  '/vouchers/payment',  'error'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Purchase Voucher', '/vouchers/purchase', 'warning'],
    ['Sales Voucher',    '/vouchers/sales',    'primary'],
    ['Journal Voucher',  '/vouchers/journal',  'secondary'],
    ['Production',       '/vouchers/production','info'],
  ],
  'Chief Accountant': [
    ['Payment Voucher',  '/vouchers/payment',  'error'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Journal Voucher',  '/vouchers/journal',  'secondary'],
    ['Trial Balance',    '/reports/trial-balance','primary'],
    ['Profit & Loss',    '/reports/profit-loss',  'success'],
    ['Day Book',         '/reports/day-book',     'info'],
  ],
  'Junior Accountant': [
    ['Payment Voucher',  '/vouchers/payment',  'error'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Journal Voucher',  '/vouchers/journal',  'secondary'],
    ['Ledger Statement', '/reports/ledger-statement', 'primary'],
  ],
  Cashier: [
    ['Payment Voucher',  '/vouchers/payment',  'error'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Contra Voucher',   '/vouchers/contra',   'warning'],
    ['Day Book',         '/reports/day-book',  'info'],
  ],
  'Store Keeper': [
    ['Purchase Voucher', '/vouchers/purchase', 'warning'],
    ['Stock Report',     '/reports/stock',     'primary'],
    ['Production',       '/vouchers/production','success'],
    ['Inventory',        '/inventory',          'info'],
  ],
  'Sales Executive': [
    ['Sales Voucher',    '/vouchers/sales',    'primary'],
    ['Receipt Voucher',  '/vouchers/receipt',  'success'],
    ['Customer Due',     '/reports/customer-due','error'],
  ],
  'Production Operator': [
    ['Production',       '/vouchers/production','success'],
    ['Stock Report',     '/reports/stock',     'primary'],
  ],
  Auditor: [
    ['Trial Balance',    '/reports/trial-balance','primary'],
    ['Day Book',         '/reports/day-book',     'info'],
    ['Profit & Loss',    '/reports/profit-loss',  'success'],
    ['General Ledger',   '/reports/general-ledger','secondary'],
  ],
};

function getQuickActions(roles) {
  if (!roles || roles.length === 0) return ROLE_ACTIONS.Cashier;
  const role = roles[0];
  return ROLE_ACTIONS[role] || ROLE_ACTIONS.Cashier;
}

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const navigate  = useNavigate();
  const isAdmin   = user?.isAdmin;
  // Deduplicate roles (in case of API returning duplicates)
  const userRoles = [...new Set(user?.roles || [])];
  const primaryRole = userRoles[0] || 'Staff';

  const [data, setData] = useState({ summary:{}, profit:{} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calls = [
      api.get('/erp/khata/summary').catch(() => ({ data:{ data:{} } })),
    ];
    // Only fetch P&L for admin/manager/accountant roles
    if (isAdmin || ['Manager','Chief Accountant','Junior Accountant','Auditor'].includes(primaryRole)) {
      calls.push(api.get('/v2/reports/profit-analysis').catch(() => ({ data:{ data:{} } })));
    }
    Promise.all(calls)
      .then(([s, p]) => setData({ summary:s?.data?.data||{}, profit:p?.data?.data||{} }))
      .catch(() => setData({ summary:{}, profit:{} }))
      .finally(() => setLoading(false));
  }, [isAdmin, primaryRole]);

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt:6 }}><CircularProgress /></Box>;

  const s = data?.summary || {};
  const p = data?.profit  || {};

  // Role-based KPI cards
  const adminKpis = [
    { title:"Today's Sales",     value:fmt(s.todaySales?.total),    sub:`${s.todaySales?.count||0} invoices`,    color:'success', icon:<TrendingUp fontSize="small"/>,           path:'/vouchers/sales' },
    { title:"Today's Purchases", value:fmt(s.todayPurchases?.total),sub:`${s.todayPurchases?.count||0} entries`, color:'warning', icon:<TrendingDown fontSize="small"/>,          path:'/vouchers/purchase' },
    { title:'Customer Due',      value:fmt(s.customerDue?.total),   sub:`${s.customerDue?.count||0} accounts`,  color:'error',   icon:<People fontSize="small"/>,                path:'/reports/customer-due' },
    { title:'Supplier Due',      value:fmt(s.supplierDue?.total),   sub:`${s.supplierDue?.count||0} accounts`,  color:'warning', icon:<LocalShipping fontSize="small"/>,         path:'/reports/supplier-due' },
    { title:'Cash Balance',      value:fmt(s.cashBalance),          sub:'All accounts',                          color:'primary', icon:<AccountBalanceWallet fontSize="small"/>,  path:'/reports/trial-balance' },
    { title:'Net Profit (FY)',   value:fmt(p.netProfit),            sub:p.margin?`${p.margin}% margin`:'',      color:p.netProfit>=0?'success':'error', icon:<Assessment fontSize="small"/>, path:'/reports/profit-analysis' },
  ];

  const salesKpis = [
    { title:"Today's Sales",  value:fmt(s.todaySales?.total),  sub:`${s.todaySales?.count||0} invoices`, color:'success', icon:<TrendingUp fontSize="small"/>,  path:'/vouchers/sales' },
    { title:'Customer Due',   value:fmt(s.customerDue?.total), sub:`${s.customerDue?.count||0} accounts`,color:'error',   icon:<People fontSize="small"/>,        path:'/reports/customer-due' },
  ];

  const storeKpis = [
    { title:"Today's Purchases", value:fmt(s.todayPurchases?.total), sub:`${s.todayPurchases?.count||0} entries`, color:'warning', icon:<TrendingDown fontSize="small"/>, path:'/vouchers/purchase' },
    { title:'Supplier Due',      value:fmt(s.supplierDue?.total),    sub:`${s.supplierDue?.count||0} accounts`,  color:'warning', icon:<LocalShipping fontSize="small"/>, path:'/reports/supplier-due' },
  ];

  const cashierKpis = [
    { title:'Cash Balance',  value:fmt(s.cashBalance), sub:'All accounts', color:'primary', icon:<AccountBalanceWallet fontSize="small"/>, path:'/reports/trial-balance' },
  ];

  const accountantKpis = [
    { title:"Today's Sales",     value:fmt(s.todaySales?.total),    sub:`${s.todaySales?.count||0} invoices`,    color:'success', icon:<TrendingUp fontSize="small"/>,          path:'/vouchers/sales' },
    { title:"Today's Purchases", value:fmt(s.todayPurchases?.total),sub:`${s.todayPurchases?.count||0} entries`, color:'warning', icon:<TrendingDown fontSize="small"/>,         path:'/vouchers/purchase' },
    { title:'Customer Due',      value:fmt(s.customerDue?.total),   sub:`${s.customerDue?.count||0} accounts`,  color:'error',   icon:<People fontSize="small"/>,               path:'/reports/customer-due' },
    { title:'Supplier Due',      value:fmt(s.supplierDue?.total),   sub:`${s.supplierDue?.count||0} accounts`,  color:'warning', icon:<LocalShipping fontSize="small"/>,        path:'/reports/supplier-due' },
    { title:'Cash Balance',      value:fmt(s.cashBalance),          sub:'All accounts',                          color:'primary', icon:<AccountBalanceWallet fontSize="small"/>, path:'/reports/trial-balance' },
    { title:'Net Profit (FY)',   value:fmt(p.netProfit),            sub:p.margin?`${p.margin}% margin`:'',      color:p.netProfit>=0?'success':'error', icon:<Assessment fontSize="small"/>, path:'/reports/profit-analysis' },
  ];

  // Pick KPIs based on role
  let kpis = adminKpis;
  if (!isAdmin) {
    if (['Chief Accountant','Junior Accountant','Auditor'].includes(primaryRole)) kpis = accountantKpis;
    else if (primaryRole === 'Sales Executive') kpis = salesKpis;
    else if (primaryRole === 'Store Keeper' || primaryRole === 'Production Operator') kpis = storeKpis;
    else if (primaryRole === 'Cashier') kpis = cashierKpis;
    else if (primaryRole === 'Manager') kpis = adminKpis;
    else kpis = adminKpis; // Unknown custom roles get full view — admin can restrict via permissions
  }

  const quickActions = getQuickActions(userRoles);

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb:3 }}>
        <Typography variant="h5" fontWeight="bold">Welcome, {user?.name}</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mt:0.5, flexWrap:'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </Typography>
          {userRoles.map((r) => <Chip key={r} label={r} size="small" sx={{ fontSize:10 }} color={r==='Administrator'?'error':'default'} />)}
        </Box>
      </Box>

      {/* Role-based KPI cards */}
      <Grid container spacing={{xs:1,sm:2}} sx={{ mb:3 }}>
        {kpis.map((k) => (
          <Grid item xs={6} sm={4} md={kpis.length <= 2 ? 6 : kpis.length <= 4 ? 3 : 2} key={k.title}>
            <KpiCard {...k}/>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* P&L — only for admin/accountant/manager */}
        {(isAdmin || ['Manager','Chief Accountant','Junior Accountant','Auditor'].includes(primaryRole)) && p.revenue !== undefined && (
          <Grid item xs={12} md={7}>
            <Paper>
              <Box sx={{ p:2, borderBottom:'1px solid #eee' }}>
                <Typography variant="subtitle1" fontWeight="bold">Profit & Loss Summary</Typography>
              </Box>
              <Table size="small">
                <TableBody>
                  {[
                    ['Revenue (Sales)',    fmt(p.revenue),     'success.main'],
                    ['Cost of Purchase',   fmt(p.cogs),        'error.main'],
                    ['Gross Profit',       fmt(p.grossProfit), 'primary.main'],
                    ['Operating Expenses', fmt(p.expenses),    'warning.main'],
                    ['Net Profit',         fmt(p.netProfit),   p.netProfit>=0?'success.main':'error.main'],
                  ].map(([l,v,c]) => (
                    <TableRow key={l} hover>
                      <TableCell sx={{ fontWeight:l.includes('Profit')?'bold':'normal' }}>{l}</TableCell>
                      <TableCell align="right" sx={{ color:c, fontWeight:'bold' }}>{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        )}

        {/* Quick Actions — role-based */}
        <Grid item xs={12} md={(isAdmin || ['Manager','Chief Accountant','Junior Accountant','Auditor'].includes(primaryRole)) ? 5 : 12}>
          <Paper sx={{ p:2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb:2 }}>Quick Actions</Typography>
            <Grid container spacing={1}>
              {quickActions.map(([l, path, c]) => (
                <Grid item xs={6} key={l}>
                  <Button fullWidth variant="outlined" color={c} size="small"
                    onClick={() => navigate(path)}
                    sx={{ textTransform:'none', fontSize:{xs:10,sm:12}, justifyContent:'flex-start' }}>
                    {l}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
