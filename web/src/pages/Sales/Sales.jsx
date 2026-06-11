import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Pagination, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, TextField, MenuItem, Autocomplete, IconButton as IB, CircularProgress,
} from '@mui/material';
import { Add, Visibility, Payment, Delete } from '@mui/icons-material';
import api from '../../services/api';

export default function Sales() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ customerId: null, date: new Date().toISOString().slice(0, 10), saleType: 'retail', discount: 0, paidAmount: 0, accountId: null, notes: '', lines: [{ itemId: null, quantity: 1, unitPrice: 0 }] });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sales', { params: { page, limit } }).then((r) => { setRows(r.data.data); setTotal(r.data.pagination.total); }).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/customers', { params: { limit: 200 } }).then((r) => setCustomers(r.data.data));
    api.get('/inventory/stock').then((r) => setItems(r.data.data));
    api.get('/accounting/accounts').then((r) => setAccounts(r.data.data));
  }, []);

  const subtotal = form.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const totalAmount = subtotal - (form.discount || 0);

  const handleAddLine = () => setForm({ ...form, lines: [...form.lines, { itemId: null, quantity: 1, unitPrice: 0 }] });
  const handleRemoveLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const updateLine = (i, key, val) => {
    const lines = [...form.lines];
    lines[i] = { ...lines[i], [key]: val };
    if (key === 'itemId') {
      const item = items.find((x) => x.id === val);
      if (item?.sale_price) lines[i].unitPrice = item.sale_price;
    }
    setForm({ ...form, lines });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/sales', { ...form, items: form.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) });
      setFormOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const statusColor = (s) => ({ active: 'success', returned: 'warning', cancelled: 'error' }[s] || 'default');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('sales.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>{t('sales.newSale')}</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('sales.invoice')}</TableCell>
              <TableCell>{t('common.date')}</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>{t('sales.retail')} / {t('sales.wholesale')}</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">{t('sales.paid')}</TableCell>
              <TableCell align="right">{t('sales.due')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography variant="body2" fontWeight="bold">{row.invoice_number}</Typography></TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell><Chip label={row.sale_type} size="small" /></TableCell>
                  <TableCell align="right">৳ {Number(row.total_amount).toLocaleString()}</TableCell>
                  <TableCell align="right">৳ {Number(row.paid_amount).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {row.due_amount > 0 ? <Chip label={`৳ ${Number(row.due_amount).toLocaleString()}`} color="error" size="small" /> : '—'}
                  </TableCell>
                  <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                    {row.due_amount > 0 && <IconButton size="small" color="primary"><Payment fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" />
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('sales.newSale')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <Autocomplete size="small" options={customers} getOptionLabel={(o) => `${o.code} - ${o.name}`}
                onChange={(_, v) => setForm({ ...form, customerId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label="Customer" />} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" select label="Type" value={form.saleType}
                onChange={(e) => setForm({ ...form, saleType: e.target.value })}>
                <MenuItem value="retail">{t('sales.retail')}</MenuItem>
                <MenuItem value="wholesale">{t('sales.wholesale')}</MenuItem>
              </TextField>
            </Grid>

            {/* Line items */}
            {form.lines.map((line, i) => (
              <Grid item xs={12} key={i}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete size="small" sx={{ flex: 2 }} options={items} getOptionLabel={(o) => `${o.name} (${Number(o.current_stock).toFixed(1)} ${o.unit})`}
                    onChange={(_, v) => updateLine(i, 'itemId', v?.id || null)}
                    renderInput={(p) => <TextField {...p} label="Item" />} />
                  <TextField size="small" sx={{ flex: 1 }} label="Qty" type="number" value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                  <TextField size="small" sx={{ flex: 1 }} label="Price ৳" type="number" value={line.unitPrice}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} />
                  <Typography sx={{ flex: 1, textAlign: 'right' }}>৳ {((line.quantity || 0) * (line.unitPrice || 0)).toLocaleString()}</Typography>
                  <IconButton size="small" onClick={() => handleRemoveLine(i)} disabled={form.lines.length === 1}><Delete fontSize="small" /></IconButton>
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Button size="small" onClick={handleAddLine} startIcon={<Add />}>Add Item</Button>
            </Grid>

            <Grid item xs={4}>
              <TextField fullWidth size="small" label={t('sales.discount')} type="number" value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth size="small" label={`${t('sales.paid')} Amount`} value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} type="number" />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth size="small" select label="Cash/Bank Account" value={form.accountId || ''}
                onChange={(e) => setForm({ ...form, accountId: e.target.value || null })}>
                <MenuItem value="">None</MenuItem>
                {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography>Subtotal: ৳ {subtotal.toLocaleString()} | Discount: ৳ {Number(form.discount || 0).toLocaleString()} | <strong>Total: ৳ {totalAmount.toLocaleString()}</strong> | Due: ৳ {Math.max(0, totalAmount - Number(form.paidAmount || 0)).toLocaleString()}</Typography>
              </Box>
            </Grid>
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
