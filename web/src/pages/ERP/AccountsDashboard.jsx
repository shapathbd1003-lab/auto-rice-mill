import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, CircularProgress, Alert,
  Card, CardContent, CardActionArea, Table, TableBody, TableCell,
  TableHead, TableRow, Divider, Button,
} from '@mui/material';
import {
  People, LocalShipping, AccountBalanceWallet, TrendingUp, TrendingDown,
  Warning, ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

const NATURE_COLORS = {
  assets: '#1976d2', liabilities: '#d32f2f', income: '#388e3c',
  expenses: '#f57c00', capital: '#7b1fa2',
};
const GROUP_TYPE_ICONS = {
  customer: <People fontSize="small" />,
  supplier: <LocalShipping fontSize="small" />,
  bank:     <AccountBalanceWallet fontSize="small" />,
  employee: <People fontSize="small" />,
  general:  <AccountBalanceWallet fontSize="small" />,
};

export default function AccountsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/erp/khata/summary')
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load accounts summary'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt:6 }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return null;

  const topGroups = (data.groups || []).filter((g) => Number(g.total_balance) !== 0 || Number(g.count) > 0);
  const byNature  = ['assets','liabilities','income','expenses','capital'].map((n) => ({
    nature: n,
    groups: topGroups.filter((g) => g.nature === n),
    total:  topGroups.filter((g) => g.nature === n).reduce((s, g) => s + Number(g.total_balance), 0),
  }));

  return (
    <Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Typography variant="h5" fontWeight="bold">Accounts — Overview</Typography>
        <Button variant="outlined" size="small" onClick={() => navigate('/erp/ledger-groups')}>Manage Groups</Button>
      </Box>

      {/* 6 KPI cards */}
      <Grid container spacing={2} sx={{ mb:3 }}>
        {[
          { label:"Today's Sales",     value: fmt(data.todaySales?.total),    sub:`${data.todaySales?.count||0} invoices`,    color:'success', icon:<TrendingUp /> },
          { label:"Today's Purchases", value: fmt(data.todayPurchases?.total),sub:`${data.todayPurchases?.count||0} entries`,  color:'warning', icon:<TrendingDown /> },
          { label:'Customer Due',      value: fmt(data.customerDue?.total),   sub:`${data.customerDue?.count||0} accounts`,   color:'error',   icon:<People /> },
          { label:'Supplier Due',      value: fmt(data.supplierDue?.total),   sub:`${data.supplierDue?.count||0} accounts`,   color:'warning', icon:<LocalShipping /> },
          { label:'Cash Balance',      value: fmt(data.cashBalance),          sub:'All cash & bank',                          color:'primary', icon:<AccountBalanceWallet /> },
          { label:'Due Alert',
            value: (data.customerDue?.total||0) > 0 ? 'Has Dues' : 'Clear',
            sub: 'Customer outstanding',
            color: (data.customerDue?.total||0) > 0 ? 'error' : 'success',
            icon: <Warning /> },
        ].map((c) => (
          <Grid item xs={6} sm={4} md={2} key={c.label}>
            <Paper sx={{ p:1.5, borderTop:`3px solid`, borderColor:`${c.color}.main`, height:'100%' }}>
              <Box sx={{ display:'flex', alignItems:'center', mb:0.5, color:`${c.color}.main` }}>
                {c.icon}
                <Typography variant="caption" sx={{ ml:0.5 }}>{c.label}</Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold" color={`${c.color}.main`}>{c.value}</Typography>
              <Typography variant="caption" color="text.secondary">{c.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Group breakdown by nature */}
      <Grid container spacing={2}>
        {byNature.filter((n) => n.groups.length > 0).map(({ nature, groups, total }) => (
          <Grid item xs={12} md={6} key={nature}>
            <Paper>
              <Box sx={{ p:1.5, display:'flex', justifyContent:'space-between', alignItems:'center',
                borderLeft:`4px solid ${NATURE_COLORS[nature]}`, pl:2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ textTransform:'capitalize' }}>{nature}</Typography>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: NATURE_COLORS[nature] }}>{fmt(total)}</Typography>
              </Box>
              <Divider />
              <Table size="small">
                <TableBody>
                  {groups.map((g) => (
                    <TableRow
                      key={g.id} hover sx={{ cursor:'pointer' }}
                      onClick={() => navigate(`/erp/khata/${g.id}`, { state: { group: g } })}
                    >
                      <TableCell>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          {GROUP_TYPE_ICONS[g.group_type] || GROUP_TYPE_ICONS.general}
                          <Box>
                            <Typography variant="body2" fontWeight="medium">{g.name}</Typography>
                            {g.parent_name && <Typography variant="caption" color="text.secondary">{g.parent_name}</Typography>}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={`${g.count} ledgers`} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" sx={{ color: NATURE_COLORS[g.nature] }}>
                          {fmt(g.total_balance)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width:32, pr:1 }}>
                        <ArrowForward fontSize="small" color="action" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
