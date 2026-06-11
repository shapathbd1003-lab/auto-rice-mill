import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Alert } from '@mui/material';
import { TrendingUp, Inventory, Warning, AccountBalance } from '@mui/icons-material';
import api from '../../services/api';

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ bgcolor: `${color}.light`, borderRadius: 2, p: 1, mr: 2 }}>{icon}</Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
        <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>{value}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then((r) => setData(r.data.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        {t('dashboard.todaySales')} — {new Date().toLocaleDateString('en-IN')}
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.todaySales')} value={fmt(data.todaySales?.total)}
            subtitle={`${data.todaySales?.count} invoices`} icon={<TrendingUp sx={{ color: 'success.main' }} />} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.todayProduction')} value={`${Number(data.todayProduction?.total || 0).toLocaleString()} kg`}
            subtitle={`${data.todayProduction?.count} batches`} icon={<Inventory sx={{ color: 'primary.main' }} />} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.totalDue')} value={fmt(data.totalDue)}
            icon={<AccountBalance sx={{ color: 'warning.main' }} />} color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.lowStock')} value={data.lowStockItems?.length || 0}
            subtitle="items below reorder level" icon={<Warning sx={{ color: 'error.main' }} />} color="error" />
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>{t('dashboard.stockSummary')}</Typography>
              {(data.stockByCategory || []).map((row) => (
                <Box key={row.category} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{row.category}</Typography>
                  <Typography variant="body2" fontWeight="bold">{Number(row.total).toLocaleString()} kg</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {(data.lowStockItems || []).length > 0 && (
          <Grid item xs={12} md={6}>
            <Card sx={{ border: '1px solid #ffcdd2' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" color="error" sx={{ mb: 2 }}>
                  <Warning fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {t('dashboard.lowStock')}
                </Typography>
                {data.lowStockItems.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                    <Typography variant="body2">{item.name}</Typography>
                    <Chip label={`${item.current_stock} ${item.unit}`} size="small" color="error" variant="outlined" />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
