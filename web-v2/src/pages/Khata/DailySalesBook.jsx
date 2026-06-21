import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Select, MenuItem, FormControl,
  InputLabel, Autocomplete, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function DailySalesBook() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [dialog, setDialog] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dayTotal, setDayTotal] = useState({ sales: 0, paid: 0, due: 0 });

  const [form, setForm] = useState({
    customer: null, date: today(), sale_type: 'retail', notes: '',
    paid_amount: 0, lines: [{ item: null, quantity: '', unit_price: '' }],
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sales', { params: { from: filterDate, to: filterDate, limit: 100 } })
      .then((r) => {
        const data = r.data.data || [];
        setOrders(data);
        setDayTotal(data.reduce((acc, o) => ({
          sales: acc.sales + Number(o.total_amount || 0),
          paid:  acc.paid  + Number(o.paid_amount  || 0),
          due:   acc.due   + Number(o.due_amount   || 0),
        }), { sales: 0, paid: 0, due: 0 }));
      })
      .finally(() => setLoading(false));
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  const openDialog = async () => {
    setError('');
    setForm({ customer: null, date: today(), sale_type: 'retail', notes: '', paid_amount: 0, lines: [{ item: null, quantity: '', unit_price: '' }] });
    const [custRes, itemRes] = await Promise.all([
      api.get('/customers', { params: { limit: 200 } }),
      api.get('/inventory/items', { params: { limit: 200, isActive: true } }),
    ]);
    setCustomers(custRes.data.data || []);
    setItems(itemRes.data.data || []);
    setDialog(true);
  };

  const updateLine = (idx, field, value) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    if (field === 'item' && value?.sale_price) lines[idx].unit_price = value.sale_price;
    setForm({ ...form, lines });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { item: null, quantity: '', unit_price: '' }] });
  const removeLine = (idx) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });

  const subtotal  = form.lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unit_price || 0)), 0);
  const dueAmount = Math.max(0, subtotal - Number(form.paid_amount || 0));

  const handleSave = async () => {
    if (!form.customer) { setError(t('sales.customerSelect')); return; }
    if (form.lines.some((l) => !l.item || !l.quantity || !l.unit_price)) { setError(t('sales.products')); return; }
    setSaving(true); setError('');
    try {
      await api.post('/sales', {
        customerId:  form.customer.id,
        date:        form.date,
        saleType:    form.sale_type,
        notes:       form.notes,
        paidAmount:  Number(form.paid_amount),
        items:       form.lines.map((l) => ({ itemId: l.item.id, quantity: Number(l.quantity), unitPrice: Number(l.unit_price) })),
      });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const summaryCards = [
    { label: t('dashboard.todaySales'), value: dayTotal.sales, color: 'success' },
    { label: t('sales.collected'),      value: dayTotal.paid,  color: 'primary' },
    { label: t('sales.dueCreated'),     value: dayTotal.due,   color: 'error'   },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('nav.dailySalesBook')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openDialog} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? t('common.new') : t('sales.newSale')}
        </Button>
      </Box>

      {/* Day summary */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
        {summaryCards.map((c) => (
          <Grid item xs={12} sm={4} key={c.label}>
            <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderLeft: `4px solid`, borderColor: `${c.color}.main` }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight="bold" color={`${c.color}.main`}>{fmt(c.value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Date filter */}
      <Box sx={{ mb: 2 }}>
        <TextField size="small" type="date" label={t('common.date')} value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          sx={{ width: { xs: '100%', sm: 180 } }} InputLabelProps={{ shrink: true }} />
      </Box>

      {/* Sales table */}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>{t('purchase.invoice')}</TableCell>
              <TableCell>{t('common.customer')}</TableCell>
              {!isMobile && <TableCell>{t('common.type')}</TableCell>}
              <TableCell align="right">{t('common.total')}</TableCell>
              <TableCell align="right">{t('common.paid')}</TableCell>
              <TableCell align="right">{t('common.due')}</TableCell>
              {!isMobile && <TableCell>{t('common.status')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>{t('sales.noSalesDate')}</TableCell></TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 12 }}>{o.invoice_number}</TableCell>
                <TableCell>{o.customer_name || `#${o.customer_id}`}</TableCell>
                {!isMobile && <TableCell><Chip label={o.sale_type === 'retail' ? t('sales.retail') : t('sales.wholesale')} size="small" /></TableCell>}
                <TableCell align="right">{fmt(o.total_amount)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(o.paid_amount)}</TableCell>
                <TableCell align="right" sx={{ color: o.due_amount > 0 ? 'error.main' : 'text.secondary' }}>
                  {o.due_amount > 0 ? fmt(o.due_amount) : '—'}
                </TableCell>
                {!isMobile && <TableCell><Chip label={o.status} color={o.status === 'active' ? 'success' : 'default'} size="small" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* New Sale Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('sales.newSaleEntry')}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete size="small" options={customers}
                getOptionLabel={(o) => `${o.name}${o.phone ? ' — ' + o.phone : ''}`}
                value={form.customer} onChange={(_, v) => setForm({ ...form, customer: v })}
                renderInput={(p) => <TextField {...p} label={t('sales.customerSelect')} />} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.type')}</InputLabel>
                <Select value={form.sale_type} label={t('common.type')} onChange={(e) => setForm({ ...form, sale_type: e.target.value })}>
                  <MenuItem value="retail">{t('sales.retail')}</MenuItem>
                  <MenuItem value="wholesale">{t('sales.wholesale')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Product lines */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('sales.products')}</Typography>
              {form.lines.map((line, idx) => (
                <Box key={idx} sx={{ mb: 1, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Autocomplete size="small" options={items}
                        getOptionLabel={(o) => `${o.name} (${o.current_stock} ${o.unit})`}
                        value={line.item} onChange={(_, v) => updateLine(idx, 'item', v)}
                        renderInput={(p) => <TextField {...p} label={t('sales.addProduct')} />} />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField fullWidth size="small" label={t('sales.qty')} type="number"
                        value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField fullWidth size="small" label={t('sales.price')} type="number"
                        value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} />
                    </Grid>
                    <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {fmt(Number(line.quantity || 0) * Number(line.unit_price || 0))}
                      </Typography>
                    </Grid>
                    <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                      {form.lines.length > 1 && (
                        <Button size="small" color="error" onClick={() => removeLine(idx)}>✕</Button>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              ))}
              <Button size="small" onClick={addLine}>+ {t('sales.addProduct')}</Button>
            </Grid>

            <Grid item xs={12}><Divider /></Grid>

            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('sales.subtotal')} value={fmt(subtotal)} disabled />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('sales.paidAmount')} type="number"
                value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('common.due')} value={fmt(dueAmount)} disabled
                inputProps={{ style: { color: dueAmount > 0 ? 'red' : 'green', fontWeight: 'bold' } }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('common.notes')} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('sales.newSale')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
