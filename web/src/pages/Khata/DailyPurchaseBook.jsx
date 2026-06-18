import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Autocomplete,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function DailyPurchaseBook() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [dialog, setDialog] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dayTotal, setDayTotal] = useState({ purchases: 0, paid: 0, due: 0 });

  const [form, setForm] = useState({
    supplier: null, date: today(), gross_weight: '', tare_weight: '',
    unit_price: '', transport_cost: 0, paid_amount: 0, notes: '',
  });

  const netWeight = Math.max(0, Number(form.gross_weight || 0) - Number(form.tare_weight || 0));
  const subtotal  = netWeight * Number(form.unit_price || 0);
  const total     = subtotal + Number(form.transport_cost || 0);
  const due       = Math.max(0, total - Number(form.paid_amount || 0));

  const load = useCallback(() => {
    setLoading(true);
    api.get('/purchases', { params: { from: filterDate, to: filterDate, limit: 100 } })
      .then((r) => {
        const data = r.data.data || [];
        setPurchases(data);
        const totals = data.reduce((acc, p) => ({
          purchases: acc.purchases + Number(p.total_amount || 0),
          paid:      acc.paid      + Number(p.paid_amount  || 0),
          due:       acc.due       + Number(p.due_amount   || 0),
        }), { purchases: 0, paid: 0, due: 0 });
        setDayTotal(totals);
      })
      .finally(() => setLoading(false));
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  const openDialog = async () => {
    setError('');
    setForm({ supplier: null, date: today(), gross_weight: '', tare_weight: '', unit_price: '', transport_cost: 0, paid_amount: 0, notes: '' });
    const r = await api.get('/suppliers', { params: { limit: 200 } });
    setSuppliers(r.data.data || []);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.supplier) { setError('Select a supplier'); return; }
    if (!form.gross_weight || !form.unit_price) { setError('Enter weight and price'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/purchases', {
        supplier_id:    form.supplier.id,
        date:           form.date,
        gross_weight:   Number(form.gross_weight),
        tare_weight:    Number(form.tare_weight || 0),
        net_weight:     netWeight,
        unit_price:     Number(form.unit_price),
        subtotal,
        transport_cost: Number(form.transport_cost || 0),
        other_cost:     0,
        total_amount:   total,
        paid_amount:    Number(form.paid_amount || 0),
        due_amount:     due,
        notes:          form.notes,
      });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to save purchase'); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Daily Purchase Book</Typography>
        <Button variant="contained" color="warning" startIcon={<Add />} onClick={openDialog}>New Purchase</Button>
      </Box>

      {/* Day summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Today\'s Purchases', value: dayTotal.purchases, color: 'warning' },
          { label: 'Paid', value: dayTotal.paid, color: 'success' },
          { label: 'Due to Suppliers', value: dayTotal.due, color: 'error' },
        ].map((c) => (
          <Grid item xs={12} sm={4} key={c.label}>
            <Paper sx={{ p: 2, borderLeft: '4px solid', borderColor: `${c.color}.main` }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight="bold" color={`${c.color}.main`}>{fmt(c.value)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 2 }}>
        <TextField size="small" type="date" label="Date" value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)} sx={{ width: 180 }} InputLabelProps={{ shrink: true }} />
      </Box>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Invoice</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell align="right">Net Weight (kg)</TableCell>
              <TableCell align="right">Rate (৳/kg)</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>No purchases for this date</TableCell></TableRow>
            ) : purchases.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>{p.invoice_number}</TableCell>
                <TableCell>{p.supplier_name || `#${p.supplier_id}`}</TableCell>
                <TableCell align="right">{Number(p.net_weight || 0).toLocaleString()} kg</TableCell>
                <TableCell align="right">{fmt(p.unit_price)}</TableCell>
                <TableCell align="right">{fmt(p.total_amount)}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(p.paid_amount)}</TableCell>
                <TableCell align="right" sx={{ color: p.due_amount > 0 ? 'error.main' : 'text.secondary' }}>
                  {p.due_amount > 0 ? fmt(p.due_amount) : '—'}
                </TableCell>
                <TableCell><Chip label={p.status} size="small" color={p.status === 'received' ? 'success' : 'default'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>New Paddy Purchase</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={8}>
              <Autocomplete size="small" options={suppliers} getOptionLabel={(o) => `${o.name}${o.phone ? ' — ' + o.phone : ''}`}
                value={form.supplier} onChange={(_, v) => setForm({ ...form, supplier: v })}
                renderInput={(p) => <TextField {...p} label="Supplier *" />} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Gross Weight (kg)" type="number" value={form.gross_weight}
                onChange={(e) => setForm({ ...form, gross_weight: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Tare Weight (kg)" type="number" value={form.tare_weight}
                onChange={(e) => setForm({ ...form, tare_weight: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Net Weight (kg)" value={netWeight.toFixed(2)} disabled size="small"
                inputProps={{ style: { fontWeight: 'bold' } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Rate per kg (৳)" type="number" value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Subtotal (৳)" value={fmt(subtotal)} disabled size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Transport Cost (৳)" type="number" value={form.transport_cost}
                onChange={(e) => setForm({ ...form, transport_cost: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Total Amount (৳)" value={fmt(total)} disabled size="small"
                inputProps={{ style: { fontWeight: 'bold', color: '#1976d2' } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Paid Now (৳)" type="number" value={form.paid_amount}
                onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Due Amount (৳)" value={fmt(due)} disabled size="small"
                inputProps={{ style: { fontWeight: 'bold', color: due > 0 ? 'red' : 'green' } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes (optional)" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save Purchase'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
