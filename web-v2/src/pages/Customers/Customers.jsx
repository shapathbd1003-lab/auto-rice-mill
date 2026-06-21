import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Pagination, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, CircularProgress, useMediaQuery, useTheme,
  Card, CardContent, CardActions, Stack,
} from '@mui/material';
import { Add, Search, Edit, Visibility } from '@mui/icons-material';
import api from '../../services/api';

export default function Customers() {
  const { t, i18n } = useTranslation();
  const isBn = i18n.language === 'bn';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditRow(null);
    setForm({ code: '', name: '', name_bn: '', phone: '', address: '', credit_limit: 0, opening_balance: 0 });
    setFormOpen(true);
  };
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('customer.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? 'Add' : t('customer.addNew')}
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField fullWidth size="small" placeholder={t('common.search')} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
      </Box>

      {/* Mobile: card list */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && rows.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>{t('common.noData')}</Paper>
          )}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography fontWeight="bold" variant="body1">{row.name}</Typography>
                    {isBn && row.name_bn && <Typography variant="caption" color="text.secondary">{row.name_bn}</Typography>}
                    {row.phone && <Typography variant="body2" color="text.secondary">{row.phone}</Typography>}
                    <Typography variant="caption" color="text.disabled">Code: {row.code}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    {row.balance > 0
                      ? <Chip label={`Due ৳${Number(row.balance).toLocaleString()}`} color="error" size="small" />
                      : <Chip label="Clear" color="success" size="small" variant="outlined" />}
                  </Box>
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0.5, pb: 1, px: 2, justifyContent: 'flex-end' }}>
                <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small"><Visibility fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop: table */
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
                  <TableCell>
                    <Typography fontWeight="bold" variant="body2">{row.name}</Typography>
                    {isBn && row.name_bn && <Typography variant="caption" display="block" color="text.secondary">{row.name_bn}</Typography>}
                  </TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell align="right">
                    {row.balance > 0
                      ? <Chip label={`৳ ${Number(row.balance).toLocaleString()}`} color="error" size="small" />
                      : <Chip label="৳ 0" color="success" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell><Chip label={row.is_active ? 'Active' : 'Inactive'} color={row.is_active ? 'success' : 'default'} size="small" /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" size={isMobile ? 'small' : 'medium'} />
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editRow ? t('common.edit') : t('customer.addNew')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('common.code')} value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('common.name')} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Name (Bengali)" value={form.name_bn || ''} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('common.phone')} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('common.address')} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('customer.creditLimit')} value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} type="number" size="small" />
            </Grid>
            {!editRow && (
              <Grid item xs={12} sm={6}>
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
