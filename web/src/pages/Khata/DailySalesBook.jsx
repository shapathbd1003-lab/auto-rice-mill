import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Select, MenuItem, FormControl,
  InputLabel, Autocomplete, IconButton, Divider,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function DailySalesBook() {
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
    paid_amount: 0,
    lines: [{ item: null, quantity: '', unit_price: '' }],
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sales', { params: { from: filterDate, to: filterDate, limit: 100 } })
      .then((r) => {
        const data = r.data.data || [];
        setOrders(data);
        const totals = data.reduce((acc, o) => ({
          sales: acc.sales + Number(o.total_amount || 0),
          paid:  acc.paid  + Number(o.paid_amount  || 0),
          due:   acc.due   + Number(o.due_amount   || 0),
        }), { sales: 0, paid: 0, due: 0 });
        setDayTotal(totals);
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

  const subtotal = form.lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unit_price || 0)), 0);
  const dueAmount = Math.max(0, subtotal - Number(form.paid_amount || 0));

  const handleSave = async () => {
    if (!form.customer) { setError('Select a customer'); return; }
    if (form.lines.some((l) => !l.item || !l.quantity || !l.unit_price)) { setError('Fill all product lines'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/sales', {
        customer_id: form.customer.id,
        date: form.date,
        sale_type: form.sale_type,
        notes: form.notes,
        paid_amount: Number(form.paid_amount),
        items: form.lines.map((l) => ({
          item_id: l.item.id, quantity: Number(l.quantity), unit_price: Number(l.unit_price),
        })),
      });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to save sale'); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Daily Sales Book</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openDialog}>New Sale</Button>
      </Box>

      {/* Day summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Today\'s Sales', value: dayTotal.sales, color: 'success' },
          { label: 'Collected', value: dayTotal.paid, color: 'primary' },
          { label: 'Due Created', value: dayTotal.due, color: 'error' },
        ].map((c) => (
          <Grid item xs={12} sm={4} key={c.label}>
            <Paper sx={{ p: 2, borderLeft: `4px solid`, borderColor: `${c.color}.main`, bgcolor: `${c.color}.50` || '#f5f5f5' }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight="bold" color={`${c.color}.main`}>{fmt(c.value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Date filter */}
      <Box sx={{ mb: 2 }}>
        <TextField size="small" type="date" label="Date" value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)} sx={{ width: 180 }} InputLabelProps={{ shrink: true }} />
      </Box>

      {/* Sales table */}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Invoice</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>No sales for this date</TableCell></TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>{o.invoice_number}</TableCell>
                <TableCell>{o.customer_name || `#${o.customer_id}`}</TableCell>
                <TableCell><Chip label={o.sale_type} size="small" /></TableCell>
                <TableCell align="right">{fmt(o.total_amount)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(o.paid_amount)}</TableCell>
                <TableCell align="right" sx={{ color: o.due_amount > 0 ? 'error.main' : 'text.secondary' }}>
                  {o.due_amount > 0 ? fmt(o.due_amount) : '—'}
                </TableCell>
                <TableCell>
                  <Chip label={o.status} color={o.status === 'active' ? 'success' : 'default'} size="small" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* New Sale Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Sale Entry</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete size="small" options={customers} getOptionLabel={(o) => `${o.name}${o.phone ? ' — ' + o.phone : ''}`}
                value={form.customer} onChange={(_, v) => setForm({ ...form, customer: v })}
                renderInput={(p) => <TextField {...p} label="Customer *" />} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={form.sale_type} label="Type" onChange={(e) => setForm({ ...form, sale_type: e.target.value })}>
                  <MenuItem value="retail">Retail</MenuItem>
                  <MenuItem value="wholesale">Wholesale</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Product lines */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Products</Typography>
              {form.lines.map((line, idx) => (
                <Grid container spacing={1} key={idx} sx={{ mb: 1, alignItems: 'center' }}>
                  <Grid item xs={12} sm={5}>
                    <Autocomplete size="small" options={items} getOptionLabel={(o) => `${o.name} (${o.current_stock} ${o.unit})`}
                      value={line.item} onChange={(_, v) => updateLine(idx, 'item', v)}
                      renderInput={(p) => <TextField {...p} label="Product" />} />
                  </Grid>
                  <Grid item xs={5} sm={2}>
                    <TextField fullWidth size="small" label="Qty" type="number" value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
                  </Grid>
                  <Grid item xs={5} sm={2}>
                    <TextField fullWidth size="small" label="Price (৳)" type="number" value={line.unit_price}
                      onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} />
                  </Grid>
                  <Grid item xs={2} sm={2}>
                    <Typography variant="body2" fontWeight="bold" sx={{ mt: 1 }}>
                      {fmt(Number(line.quantity || 0) * Number(line.unit_price || 0))}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    {form.lines.length > 1 && (
                      <Button size="small" color="error" onClick={() => removeLine(idx)}>✕</Button>
                    )}
                  </Grid>
                </Grid>
              ))}
              <Button size="small" onClick={addLine}>+ Add Product</Button>
            </Grid>

            <Grid item xs={12}><Divider /></Grid>

            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Subtotal" value={fmt(subtotal)} disabled />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Paid (৳)" type="number" value={form.paid_amount}
                onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Due" value={fmt(dueAmount)} disabled
                inputProps={{ style: { color: dueAmount > 0 ? 'red' : 'green', fontWeight: 'bold' } }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Notes (optional)" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save Sale'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
