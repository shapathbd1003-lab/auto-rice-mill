import React, { useEffect, useState } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Alert,
  Paper, List, ListItem, ListItemText, Divider, Button,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, People, LocalShipping, AccountBalanceWallet, Warning,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

function KhataCard({ title, value, subtitle, icon, color, onClick }) {
  return (
    <Card onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : {} }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="medium">{title}</Typography>
          <Box sx={{ bgcolor: `${color}.100`, borderRadius: '50%', p: 0.7, display: 'flex' }}>{icon}</Box>
        </Box>
        <Typography variant="h5" fontWeight="bold" color={`${color}.main`}>{value}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

const TX_TYPE_LABELS = {
  sale: { label: 'Sale', color: 'success' },
  purchase: { label: 'Purchase', color: 'warning' },
  cash_in: { label: 'Cash In', color: 'success' },
  cash_out: { label: 'Cash Out', color: 'error' },
};

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/khata/summary')
      .then((r) => setData(r.data.data))
      .catch(() => {
        // fallback to old dashboard endpoint if khata not yet migrated
        api.get('/dashboard')
          .then((r) => setData(r.data.data))
          .catch(() => setError('Failed to load dashboard'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return null;

  const cards = [
    {
      title: "Today's Sales",
      value: fmt(data.todaySales?.total),
      subtitle: `${data.todaySales?.count || 0} invoices`,
      icon: <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />,
      color: 'success',
      path: '/khata/daily-sales',
    },
    {
      title: "Today's Purchases",
      value: fmt(data.todayPurchases?.total),
      subtitle: `${data.todayPurchases?.count || 0} entries`,
      icon: <TrendingDown sx={{ color: 'warning.main', fontSize: 20 }} />,
      color: 'warning',
      path: '/khata/daily-purchase',
    },
    {
      title: 'Customer Due',
      value: fmt(data.customerDue?.total),
      subtitle: `${data.customerDue?.count || 0} customers`,
      icon: <People sx={{ color: 'error.main', fontSize: 20 }} />,
      color: 'error',
      path: '/khata/customers',
    },
    {
      title: 'Supplier Due',
      value: fmt(data.supplierDue?.total),
      subtitle: `${data.supplierDue?.count || 0} suppliers`,
      icon: <LocalShipping sx={{ color: 'orange', fontSize: 20 }} />,
      color: 'warning',
      path: '/khata/suppliers',
    },
    {
      title: 'Cash Balance',
      value: fmt(data.cashBalance),
      subtitle: 'All accounts',
      icon: <AccountBalanceWallet sx={{ color: 'primary.main', fontSize: 20 }} />,
      color: 'primary',
      path: '/khata/cashbook',
    },
    {
      title: 'Low Stock',
      value: data.lowStockItems?.length || 0,
      subtitle: 'items below reorder',
      icon: <Warning sx={{ color: 'error.main', fontSize: 20 }} />,
      color: 'error',
      path: '/inventory',
    },
  ];

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          আস্সালামু আলাইকুম, {user?.name?.split(' ')[0] || 'Admin'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      {/* 6 KPI cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid item xs={6} sm={4} md={2} key={c.title}>
            <KhataCard {...c} onClick={() => navigate(c.path)} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Recent Transactions */}
        <Grid item xs={12} md={7}>
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">Recent Transactions</Typography>
            </Box>
            <List dense>
              {(data.recentTransactions || []).length === 0 ? (
                <ListItem><ListItemText secondary="No recent transactions" /></ListItem>
              ) : (data.recentTransactions || []).map((tx, i) => {
                const meta = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: 'default' };
                return (
                  <React.Fragment key={i}>
                    <ListItem>
                      <ListItemText
                        primary={<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={meta.label} size="small" color={meta.color} />
                            <Typography variant="body2">{tx.ref}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">{fmt(tx.amount)}</Typography>
                        </Box>}
                        secondary={new Date(tx.date).toLocaleDateString('en-IN')}
                      />
                    </ListItem>
                    {i < (data.recentTransactions?.length || 0) - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Quick Actions</Typography>
            <Grid container spacing={1}>
              {[
                { label: 'New Sale', path: '/khata/daily-sales', color: 'success' },
                { label: 'New Purchase', path: '/khata/daily-purchase', color: 'warning' },
                { label: 'Cash In', path: '/khata/cashbook', color: 'primary' },
                { label: 'Add Expense', path: '/khata/expenses', color: 'error' },
                { label: 'Customer Khata', path: '/khata/customers', color: 'inherit' },
                { label: 'Supplier Khata', path: '/khata/suppliers', color: 'inherit' },
              ].map((a) => (
                <Grid item xs={6} key={a.label}>
                  <Button fullWidth variant="outlined" color={a.color} size="small"
                    onClick={() => navigate(a.path)} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
                    {a.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Stock summary (if available) */}
          {(data.stockByCategory || []).length > 0 && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Stock Summary</Typography>
              {data.stockByCategory.map((row) => (
                <Box key={row.category} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{row.category}</Typography>
                  <Typography variant="body2" fontWeight="bold">{Number(row.total).toLocaleString()} kg</Typography>
                </Box>
              ))}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
