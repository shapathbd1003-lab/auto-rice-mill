import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Select, MenuItem, FormControl,
  InputLabel, Tabs, Tab, IconButton, useMediaQuery, useTheme,
  Card, CardContent, CardActions, Stack,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const CAT_VALUES = ['labor', 'transport', 'fuel', 'packaging', 'electricity', 'maintenance', 'salary', 'other'];

const COLORS = {
  labor: 'primary', transport: 'warning', fuel: 'error', packaging: 'info',
  electricity: 'secondary', maintenance: 'warning', salary: 'success', other: 'default',
};

export default function ExpenseBook() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getCatLabel = (v) => t(`expensebook.categories.${v}`) || v;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [filterDate, setFilterDate] = useState(today());
  const [filterMonth, setFilterMonth] = useState(thisMonth());
  const [dialog, setDialog] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ date: today(), category: '', description: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [monthTotal, setMonthTotal] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    const params = tab === 0
      ? { from: filterDate, to: filterDate, limit: 100 }
      : { from: `${filterMonth}-01`, to: `${filterMonth}-31`, limit: 200 };
    api.get('/accounting/expenses', { params })
      .then((r) => {
        const data = r.data.data || [];
        setRows(data);
        setMonthTotal(data.reduce((s, r) => s + Number(r.amount || 0), 0));
      })
      .finally(() => setLoading(false));
  }, [tab, filterDate, filterMonth]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditRow(null); setForm({ date: today(), category: '', description: '', amount: '' }); setError(''); setDialog(true); };
  const openEdit = (row) => { setEditRow(row); setForm({ date: row.date?.slice(0, 10), category: row.category, description: row.description, amount: row.amount }); setError(''); setDialog(true); };

  const handleSave = async () => {
    if (!form.amount || !form.category || !form.description) { setError(t('common.noData')); return; }
    setSaving(true); setError('');
    try {
      if (editRow) await api.put(`/accounting/expenses/${editRow.id}`, { ...form, amount: Number(form.amount) });
      else await api.post('/accounting/expenses', { ...form, amount: Number(form.amount) });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirm'))) return;
    try { await api.delete(`/accounting/expenses/${id}`); load(); }
    catch (e) { alert(t('common.noData')); }
  };

  const byCategory = CAT_VALUES.map((v) => ({
    value: v, label: getCatLabel(v),
    total: rows.filter((r) => r.category === v).reduce((s, r) => s + Number(r.amount || 0), 0),
  })).filter((c) => c.total > 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('expensebook.title')}</Typography>
        <Button variant="contained" color="error" startIcon={<Add />} onClick={openAdd} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? t('expensebook.add') : t('expensebook.addExpense')}
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('expensebook.dailyExpenses')} />
        <Tab label={t('expensebook.monthlyExpenses')} />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ mb: 2 }}>
          <TextField size="small" type="date" label={t('common.date')} value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 180 } }} InputLabelProps={{ shrink: true }} />
        </Box>
      )}
      {tab === 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField size="small" type="month" label={t('report.monthLabel')} value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)} sx={{ width: { xs: '100%', sm: 180 } }} InputLabelProps={{ shrink: true }} />
          <Paper sx={{ px: 3, py: 1, bgcolor: 'error.light' }}>
            <Typography variant="caption">{t('expensebook.monthTotal')}</Typography>
            <Typography variant="h6" fontWeight="bold" color="error.dark">{fmt(monthTotal)}</Typography>
          </Paper>
        </Box>
      )}

      {tab === 1 && byCategory.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {byCategory.map((c) => (
            <Grid item xs={6} sm={4} md={3} key={c.value}>
              <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                <Chip label={c.label} color={COLORS[c.value]} size="small" />
                <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>{fmt(c.total)}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Mobile: cards */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && rows.length === 0 && <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>{t('expensebook.noFound')}</Paper>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0, pt: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Chip label={getCatLabel(row.category)} size="small" color={COLORS[row.category] || 'default'} variant="outlined" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{row.description}</Typography>
                    <Typography variant="caption" color="text.disabled">{new Date(row.date).toLocaleDateString('en-IN')}</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color="error.main" sx={{ flexShrink: 0 }}>{fmt(row.amount)}</Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0, pb: 1, px: 2, justifyContent: 'flex-end' }}>
                <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('common.category')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>{t('expensebook.noFound')}</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell><Chip label={getCatLabel(row.category)} size="small" color={COLORS[row.category] || 'default'} variant="outlined" /></TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{fmt(row.amount)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          {editRow ? t('expensebook.editExpense') : t('expensebook.addExpense')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField fullWidth label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.category')}</InputLabel>
                <Select value={form.category} label={t('common.category')} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CAT_VALUES.map((v) => <MenuItem key={v} value={v}>{getCatLabel(v)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('common.description')} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small"
                placeholder={t('expensebook.placeholder')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editRow ? t('common.update') : t('expensebook.saveExpense')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
