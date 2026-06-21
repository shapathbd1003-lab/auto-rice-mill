import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Alert, Paper, Table, TableBody, TableRow, TableCell, Button, Chip } from '@mui/material';
import { TrendingUp, TrendingDown, People, LocalShipping, AccountBalanceWallet, Assessment } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n||0).toLocaleString('en-IN')}`;

function KpiCard({ title, value, sub, icon, color, path }) {
  const navigate = useNavigate();
  return (
    <Card onClick={() => path && navigate(path)} sx={{ cursor:path?'pointer':'default', height:'100%', '&:hover':path?{boxShadow:4}:{}, borderTop:'3px solid', borderColor:`${color}.main` }}>
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

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/erp/khata/summary').catch(() => ({ data:{ data:{} } })),
      api.get('/v2/reports/profit-analysis').catch(() => ({ data:{ data:{} } })),
    ]).then(([s, p]) => setData({ summary: s.data.data, profit: p.data.data }))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt:6 }}><CircularProgress /></Box>;

  const s = data?.summary || {};
  const p = data?.profit  || {};

  const kpis = [
    { title:"Today's Sales",     value:fmt(s.todaySales?.total),    sub:`${s.todaySales?.count||0} invoices`,    color:'success', icon:<TrendingUp fontSize="small"/>,          path:'/vouchers/sales' },
    { title:"Today's Purchases", value:fmt(s.todayPurchases?.total),sub:`${s.todayPurchases?.count||0} entries`, color:'warning', icon:<TrendingDown fontSize="small"/>,         path:'/vouchers/purchase' },
    { title:'Customer Due',      value:fmt(s.customerDue?.total),   sub:`${s.customerDue?.count||0} accounts`,  color:'error',   icon:<People fontSize="small"/>,               path:'/reports/customer-due' },
    { title:'Supplier Due',      value:fmt(s.supplierDue?.total),   sub:`${s.supplierDue?.count||0} accounts`,  color:'warning', icon:<LocalShipping fontSize="small"/>,        path:'/reports/supplier-due' },
    { title:'Cash Balance',      value:fmt(s.cashBalance),          sub:'All accounts',                          color:'primary', icon:<AccountBalanceWallet fontSize="small"/>, path:'/reports/trial-balance' },
    { title:'Net Profit (FY)',   value:fmt(p.netProfit),            sub:p.margin?`${p.margin}% margin`:'',      color:p.netProfit>=0?'success':'error', icon:<Assessment fontSize="small"/>, path:'/reports/profit-analysis' },
  ];

  return (
    <Box>
      <Box sx={{ mb:3 }}>
        <Typography variant="h5" fontWeight="bold">Welcome, {user?.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          {(user?.roles||[]).map((r) => <Chip key={r} label={r} size="small" sx={{ ml:0.5, fontSize:10 }} />)}
        </Typography>
      </Box>

      <Grid container spacing={{xs:1,sm:2}} sx={{ mb:3 }}>
        {kpis.map((k) => <Grid item xs={6} sm={4} md={2} key={k.title}><KpiCard {...k}/></Grid>)}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper>
            <Box sx={{ p:2, borderBottom:'1px solid #eee' }}><Typography variant="subtitle1" fontWeight="bold">Profit & Loss Summary</Typography></Box>
            <Table size="small">
              <TableBody>
                {[['Revenue',fmt(p.revenue),'success.main'],['Cost of Purchase',fmt(p.cogs),'error.main'],['Gross Profit',fmt(p.grossProfit),'primary.main'],['Expenses',fmt(p.expenses),'warning.main'],['Net Profit',fmt(p.netProfit),p.netProfit>=0?'success.main':'error.main']].map(([l,v,c]) => (
                  <TableRow key={l} hover><TableCell sx={{ fontWeight:l.includes('Profit')?'bold':'normal' }}>{l}</TableCell><TableCell align="right" sx={{ color:c, fontWeight:'bold' }}>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p:2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb:2 }}>Quick Voucher Entry</Typography>
            <Grid container spacing={1}>
              {[['Payment Voucher','/vouchers/payment','error'],['Receipt Voucher','/vouchers/receipt','success'],['Purchase Voucher','/vouchers/purchase','warning'],['Sales Voucher','/vouchers/sales','primary'],['Journal Voucher','/vouchers/journal','secondary'],['Production','/vouchers/production','info']].map(([l,path,c]) => (
                <Grid item xs={6} key={l}><Button fullWidth variant="outlined" color={c} size="small" onClick={() => navigate(path)} sx={{ textTransform:'none', fontSize:{xs:10,sm:12} }}>{l}</Button></Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
