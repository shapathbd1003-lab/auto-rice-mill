import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Pagination, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress,
} from '@mui/material';
import { Add, Search, Edit } from '@mui/icons-material';
import api from '../../services/api';

export default function Suppliers() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', name_bn: '', phone: '', address: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/suppliers', { params: { page, limit, search } })
      .then((r) => { setRows(r.data.data); setTotal(r.data.pagination.total); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditRow(null); setForm({ code: '', name: '', name_bn: '', phone: '', address: '', opening_balance: 0 }); setFormOpen(true); };
  const openEdit = (row) => { setEditRow(row); setForm(row); setFormOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRow) await api.put(`/suppliers/${editRow.id}`, form);
      else await api.post('/suppliers', form);
      setFormOpen(false); load();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('supplier.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>{t('supplier.addNew')}</Button>
      </Box>
      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} sx={{ width: 300 }} />
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.code')}</TableCell>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('common.phone')}</TableCell>
              <TableCell align="right">Balance Due</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.code}</TableCell>
                  <TableCell><Typography fontWeight="bold">{row.name}</Typography>{row.name_bn && <Typography variant="caption" display="block">{row.name_bn}</Typography>}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell align="right">
                    {row.balance > 0 ? <Chip label={`৳ ${Number(row.balance).toLocaleString()}`} color="warning" size="small" /> : <Chip label="৳ 0" color="success" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
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
        <DialogTitle>{editRow ? t('common.edit') : t('supplier.addNew')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {['code', 'name', 'name_bn', 'phone', 'address'].map((f) => (
              <Grid item xs={f === 'address' ? 12 : 6} key={f}>
                <TextField fullWidth size="small" label={f} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </Grid>
            ))}
            {!editRow && <Grid item xs={6}><TextField fullWidth size="small" label="Opening Balance" type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Grid>}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={20} /> : t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
