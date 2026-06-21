import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Alert,
  Paper, List, ListItem, ListItemText, Divider, Button,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, People, LocalShipping, AccountBalanceWallet, Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

function KhataCard({ title, value, subtitle, icon, color, onClick }) {
  return (
    <Card onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : {}, height: '100%' }}>
      <CardContent sx={{ pb: '8px !important', pt: 1.5, px: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight="medium" noWrap sx={{ fontSize: { xs: 10, sm: 12 } }}>
            {title}
          </Typography>
          <Box sx={{ bgcolor: `${color}.100`, borderRadius: '50%', p: 0.5, display: 'flex', flexShrink: 0, ml: 0.5 }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h6" fontWeight="bold" color={`${color}.main`} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} noWrap>
          {value}
        </Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/khata/summary')
      .then((r) => setData(r.data.data))
      .catch(() => {
        api.get('/dashboard')
          .then((r) => setData(r.data.data))
          .catch(() => setError(t('common.noData')));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return null;

  const TX_TYPE_LABELS = {
    sale:     { label: t('sales.title'),    color: 'success' },
    purchase: { label: t('purchase.title'), color: 'warning' },
    cash_in:  { label: t('cashbook.cashIn'),  color: 'success' },
    cash_out: { label: t('cashbook.cashOut'), color: 'error'   },
  };

  const cards = [
    {
      title: t('dashboard.todaySales'),
      value: fmt(data.todaySales?.total),
      subtitle: `${data.todaySales?.count || 0} ${t('dashboard.invoices')}`,
      icon: <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />,
      color: 'success', path: '/khata/daily-sales',
    },
    {
      title: t('dashboard.todayPurchases'),
      value: fmt(data.todayPurchases?.total),
      subtitle: `${data.todayPurchases?.count || 0} ${t('dashboard.entries')}`,
      icon: <TrendingDown sx={{ color: 'warning.main', fontSize: 20 }} />,
      color: 'warning', path: '/khata/daily-purchase',
    },
    {
      title: t('dashboard.totalDue'),
      value: fmt(data.customerDue?.total),
      subtitle: `${data.customerDue?.count || 0} ${t('dashboard.accounts')}`,
      icon: <People sx={{ color: 'error.main', fontSize: 20 }} />,
      color: 'error', path: '/khata/customers',
    },
    {
      title: t('dashboard.supplierDue'),
      value: fmt(data.supplierDue?.total),
      subtitle: `${data.supplierDue?.count || 0} ${t('dashboard.accounts')}`,
      icon: <LocalShipping sx={{ color: 'warning.main', fontSize: 20 }} />,
      color: 'warning', path: '/khata/suppliers',
    },
    {
      title: t('dashboard.cashBalance'),
      value: fmt(data.cashBalance),
      subtitle: t('dashboard.allAccounts'),
      icon: <AccountBalanceWallet sx={{ color: 'primary.main', fontSize: 20 }} />,
      color: 'primary', path: '/khata/cashbook',
    },
    {
      title: t('dashboard.lowStock'),
      value: data.lowStockItems?.length || 0,
      subtitle: t('dashboard.itemsBelowReorder'),
      icon: <Warning sx={{ color: 'error.main', fontSize: 20 }} />,
      color: 'error', path: '/inventory',
    },
  ];

  const quickActions = [
    { label: t('sales.newSale'),     path: '/khata/daily-sales',    color: 'success' },
    { label: t('purchase.addNew'),   path: '/khata/daily-purchase',  color: 'warning' },
    { label: t('cashbook.cashIn'),   path: '/khata/cashbook',        color: 'primary' },
    { label: t('accounting.addExpense'), path: '/khata/expenses',    color: 'error'   },
    { label: t('customer.title'),    path: '/khata/customers',       color: 'inherit' },
    { label: t('supplier.title'),    path: '/khata/suppliers',       color: 'inherit' },
  ];

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('dashboard.welcome')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      {/* 6 KPI cards */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
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
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">{t('dashboard.recentTransactions')}</Typography>
            </Box>
            <List dense>
              {(data.recentTransactions || []).length === 0 ? (
                <ListItem><ListItemText secondary={t('dashboard.noRecentTx')} /></ListItem>
              ) : (data.recentTransactions || []).map((tx, i) => {
                const meta = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: 'default' };
                return (
                  <React.Fragment key={i}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={meta.label} size="small" color={meta.color} />
                              <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{tx.ref}</Typography>
                            </Box>
                            <Typography variant="body2" fontWeight="bold">{fmt(tx.amount)}</Typography>
                          </Box>
                        }
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
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>{t('dashboard.quickActions')}</Typography>
            <Grid container spacing={1}>
              {quickActions.map((a) => (
                <Grid item xs={6} key={a.label}>
                  <Button fullWidth variant="outlined" color={a.color} size="small"
                    onClick={() => navigate(a.path)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: { xs: 11, sm: 13 } }}>
                    {a.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {(data.stockByCategory || []).length > 0 && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>{t('dashboard.stockSummary')}</Typography>
              {data.stockByCategory.map((row) => (
                <Box key={row.category} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{row.category}</Typography>
                  <Typography variant="body2" fontWeight="bold">{Number(row.total).toLocaleString()} {t('unit.kg')}</Typography>
                </Box>
              ))}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
