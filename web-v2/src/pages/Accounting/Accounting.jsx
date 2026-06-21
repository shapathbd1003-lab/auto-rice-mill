import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, MenuItem, CircularProgress, Card, CardContent,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../../services/api';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function Accounting() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pl, setPl] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    date: new Date().toISOString().slice(0, 10), category: 'other',
    description: '', amount: '', account_id: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/accounting/accounts').then((r) => setAccounts(r.data.data || []));
    api.get('/accounting/expenses').then((r) => setExpenses(r.data.data || []));
    api.get('/accounting/profit-loss').then((r) => setPl(r.data.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddExpense = async () => {
    setSaving(true);
    try { await api.post('/accounting/expenses', expForm); setExpOpen(false); load(); }
    finally { setSaving(false); }
  };

  const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

  const EXP_CATEGORIES = ['salary', 'fuel', 'maintenance', 'utility', 'rent', 'other'];
  const getCatLabel = (c) => t(`expensebook.categories.${c}`) || c;

  const plRows = pl ? [
    [t('accounting.revenue'),          pl.revenue,     'success.main'],
    [t('accounting.costOfPurchases'),  pl.purchases,   'error.main'],
    [t('accounting.grossProfit'),      pl.grossProfit, 'primary.main'],
    [t('accounting.operatingExpenses'),pl.expenses,    'warning.main'],
    [pl?.netProfit >= 0 ? t('accounting.netProfit') : t('accounting.netLoss'), pl.netProfit, pl?.netProfit >= 0 ? 'success.main' : 'error.main'],
  ] : [];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>{t('accounting.title')}</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={t('accounting.accounts')} />
        <Tab label={t('accounting.expenses')} />
        <Tab label={t('accounting.profitLoss')} />
      </Tabs>

      {/* Accounts tab */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {accounts.map((acc) => (
            <Card key={acc.id} sx={{ minWidth: 200 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {acc.type === 'bank' ? `🏦 ${acc.bank_name || ''}` : `💵 ${t('cashbook.cashIn').split(' ')[0]}`}
                </Typography>
                <Typography variant="h6" fontWeight="bold">{acc.name}</Typography>
                <Typography variant="h5" color={acc.balance >= 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                  {fmt(acc.balance)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </TabPanel>

      {/* Expenses tab */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setExpOpen(true)}>
            {t('accounting.addExpense')}
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('common.category')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.length === 0
                ? <TableRow><TableCell colSpan={4} align="center">{t('common.noData')}</TableCell></TableRow>
                : expenses.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{getCatLabel(row.category)}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">৳ {Number(row.amount).toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* P&L tab */}
      <TabPanel value={tab} index={2}>
        {pl && (
          <Box sx={{ maxWidth: 500 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('accounting.profitLoss')} — {pl.startDate} {t('common.to')} {pl.endDate}
            </Typography>
            {plRows.map(([label, val, color]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0f0f0' }}>
                <Typography fontWeight={label.includes(t('accounting.netProfit').split(' ')[0]) ? 'bold' : 'normal'}>{label}</Typography>
                <Typography fontWeight="bold" color={color}>৳ {Number(val || 0).toLocaleString('en-IN')}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Add Expense Dialog */}
      <Dialog open={expOpen} onClose={() => setExpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('accounting.addExpense')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label={t('common.date')} type="date" value={expForm.date}
                onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" select label={t('common.category')} value={expForm.category}
                onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>
                {EXP_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{getCatLabel(c)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label={t('common.description')} value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label={`${t('common.amount')} ৳`} type="number" value={expForm.amount}
                onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" select label={t('accounting.accounts')} value={expForm.account_id}
                onChange={(e) => setExpForm({ ...expForm, account_id: e.target.value })}>
                <MenuItem value="">{t('sales.noneAccount')}</MenuItem>
                {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddExpense} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
