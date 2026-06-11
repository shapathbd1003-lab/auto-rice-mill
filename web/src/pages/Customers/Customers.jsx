import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Pagination, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, CircularProgress,
} from '@mui/material';
import { Add, Search, Edit, Visibility, Payment } from '@mui/icons-material';
import api from '../../services/api';

export default function Customers() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', name_bn: '', phone: '', address: '', credit_limit: 0, opening_balance: 0 });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/customers', { params: { page, limit, search } })
      .then((r) => { setRows(r.data.data); setTotal(r.data.pagination.total); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditRow(null); setForm({ code: '', name: '', name_bn: '', phone: '', address: '', credit_limit: 0, opening_balance: 0 }); setFormOpen(true); };
  const openEdit = (row) => { setEditRow(row); setForm(row); setFormOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRow) await api.put(`/customers/${editRow.id}`, form);
      else await api.post('/customers', form);
      setFormOpen(false);
      load();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('customer.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>{t('customer.addNew')}</Button>
      </Box>
      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder={t('common.search')} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          sx={{ width: 300 }} />
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.code')}</TableCell>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('common.phone')}</TableCell>
              <TableCell align="right">{t('customer.due')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">{t('common.noData')}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.code}</TableCell>
                <TableCell><Typography fontWeight="bold">{row.name}</Typography>{row.name_bn && <Typography variant="caption" display="block">{row.name_bn}</Typography>}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell align="right">
                  {row.balance > 0 ? <Chip label={`৳ ${Number(row.balance).toLocaleString()}`} color="error" size="small" /> : <Chip label="৳ 0" color="success" size="small" variant="outlined" />}
                </TableCell>
                <TableCell><Chip label={row.is_active ? 'Active' : 'Inactive'} color={row.is_active ? 'success' : 'default'} size="small" /></TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => window.open(`/customers/${row.id}/ledger`, '_blank')}><Visibility fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" />
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? t('common.edit') : t('customer.addNew')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {['code', 'name', 'name_bn', 'phone', 'address'].map((f) => (
              <Grid item xs={f === 'address' ? 12 : 6} key={f}>
                <TextField fullWidth label={t(`common.${f}`) || f} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} size="small" />
              </Grid>
            ))}
            <Grid item xs={6}>
              <TextField fullWidth label={t('customer.creditLimit')} value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} type="number" size="small" />
            </Grid>
            {!editRow && (
              <Grid item xs={6}>
                <TextField fullWidth label="Opening Balance" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} type="number" size="small" />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
