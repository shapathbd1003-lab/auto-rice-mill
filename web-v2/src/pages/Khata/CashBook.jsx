import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Select, MenuItem, FormControl,
  InputLabel, ToggleButton, ToggleButtonGroup, IconButton,
  useMediaQuery, useTheme, Card, CardContent, CardActions, Stack,
} from '@mui/material';
import { Add, ArrowUpward, ArrowDownward, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

const CASH_IN_CATS  = ['sales_income', 'payment_received', 'other_income'];
const CASH_OUT_CATS = ['paddy_purchase', 'salary', 'transport', 'electricity', 'maintenance', 'packaging', 'fuel', 'miscellaneous'];

export default function CashBook() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ cashIn: 0, cashOut: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [typeFilter, setTypeFilter] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [type, setType] = useState('in');
  const [form, setForm] = useState({ date: today(), category: '', description: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Category labels using t()
  const getCatLabel = (key) => t(`cashbook.categories.${key}`) || key;

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterDate) params.date = filterDate;
    if (typeFilter) params.type = typeFilter;
    api.get('/khata/cashbook', { params })
      .then((r) => { setRows(r.data.data || []); setSummary(r.data.summary || {}); })
      .finally(() => setLoading(false));
  }, [filterDate, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openAdd = (typ) => {
    setEditRow(null); setType(typ);
    setForm({ date: today(), category: '', description: '', amount: '' });
    setError(''); setDialog(true);
  };

  const openEdit = (row) => {
    setEditRow(row); setType(row.type);
    setForm({ date: row.date?.slice(0, 10), category: row.category, description: row.description, amount: row.amount });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.category || !form.description) { setError(t('common.noData')); return; }
    setSaving(true); setError('');
    try {
      if (editRow) await api.put(`/khata/cashbook/${editRow.id}`, form);
      else await api.post('/khata/cashbook', { ...form, type, amount: Number(form.amount) });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/khata/cashbook/${id}`); setDeleteConfirm(null); load(); }
    catch (e) { alert(e.response?.data?.error?.message || t('common.noData')); }
  };

  const cats = type === 'in' ? CASH_IN_CATS : CASH_OUT_CATS;

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>{t('cashbook.title')}</Typography>

      {/* Summary cards */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #4caf50', bgcolor: '#f1f8e9' }}>
            <Typography variant="caption" color="text.secondary">{t('cashbook.cashIn')}</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">{fmt(summary.cashIn)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #f44336', bgcolor: '#fce4ec' }}>
            <Typography variant="caption" color="text.secondary">{t('cashbook.cashOut')}</Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">{fmt(summary.cashOut)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #1976d2', bgcolor: '#e3f2fd' }}>
            <Typography variant="caption" color="text.secondary">{t('cashbook.balance')}</Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main">{fmt(summary.balance)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Actions + filters */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" color="success" startIcon={<ArrowDownward />} size="small" onClick={() => openAdd('in')}>{t('cashbook.cashIn')}</Button>
        <Button variant="contained" color="error" startIcon={<ArrowUpward />} size="small" onClick={() => openAdd('out')}>{t('cashbook.cashOut')}</Button>
        <TextField size="small" type="date" label={t('common.date')} value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)} sx={{ width: { xs: '100%', sm: 150 } }} InputLabelProps={{ shrink: true }} />
        <ToggleButtonGroup size="small" value={typeFilter} exclusive onChange={(_, v) => setTypeFilter(v || '')}>
          <ToggleButton value="" sx={{ fontSize: 11, px: 1 }}>{t('cashbook.allFilter')}</ToggleButton>
          <ToggleButton value="in" sx={{ fontSize: 11, px: 1 }}>{t('cashbook.inFilter')}</ToggleButton>
          <ToggleButton value="out" sx={{ fontSize: 11, px: 1 }}>{t('cashbook.outFilter')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Mobile: card list */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>}
          {!loading && rows.length === 0 && <Paper sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>{t('cashbook.noTx')}</Paper>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0, pt: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Chip label={getCatLabel(row.category)} size="small" color={row.type === 'in' ? 'success' : 'error'} variant="outlined" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{row.description}</Typography>
                    <Typography variant="caption" color="text.disabled">{new Date(row.date).toLocaleDateString('en-IN')}</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color={row.type === 'in' ? 'success.main' : 'error.main'}>
                    {fmt(row.amount)}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0, pb: 1, px: 2, justifyContent: 'flex-end' }}>
                <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row.id)}><Delete fontSize="small" /></IconButton>
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
                <TableCell align="right" sx={{ color: 'success.main' }}>{t('cashbook.cashIn')}</TableCell>
                <TableCell align="right" sx={{ color: 'error.main' }}>{t('cashbook.cashOut')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>{t('cashbook.noTxDate')}</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell><Chip label={getCatLabel(row.category)} size="small" color={row.type === 'in' ? 'success' : 'error'} variant="outlined" /></TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{row.type === 'in' ? fmt(row.amount) : '—'}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>{row.type === 'out' ? fmt(row.amount) : '—'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: editRow ? 'grey.800' : type === 'in' ? 'success.main' : 'error.main', color: 'white' }}>
          {editRow ? t('cashbook.editTx') : type === 'in' ? t('cashbook.cashIn') : t('cashbook.cashOut')}
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
                  {cats.map((c) => <MenuItem key={c} value={c}>{getCatLabel(c)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('common.description')} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color={type === 'in' ? 'success' : 'error'} onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editRow ? t('common.update') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>{t('cashbook.deleteTx')}</DialogTitle>
        <DialogContent><Typography>{t('cashbook.deleteConfirm')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm)}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
