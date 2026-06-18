import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Alert, Select, MenuItem, FormControl,
  InputLabel, ToggleButton, ToggleButtonGroup, IconButton, Divider,
} from '@mui/material';
import { Add, ArrowUpward, ArrowDownward, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

const CASH_IN_CATS  = ['sales_income', 'payment_received', 'other_income'];
const CASH_OUT_CATS = ['paddy_purchase', 'salary', 'transport', 'electricity', 'maintenance', 'packaging', 'fuel', 'miscellaneous'];

const CAT_LABELS = {
  sales_income: 'Sales Income', payment_received: 'Payment Received', other_income: 'Other Income',
  paddy_purchase: 'Paddy Purchase', salary: 'Salary', transport: 'Transport',
  electricity: 'Electricity', maintenance: 'Maintenance', packaging: 'Packaging',
  fuel: 'Fuel', miscellaneous: 'Miscellaneous Expense',
};

export default function CashBook() {
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

  const openAdd = (t) => {
    setEditRow(null); setType(t);
    setForm({ date: today(), category: '', description: '', amount: '' });
    setError(''); setDialog(true);
  };

  const openEdit = (row) => {
    setEditRow(row); setType(row.type);
    setForm({ date: row.date?.slice(0, 10), category: row.category, description: row.description, amount: row.amount });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.category || !form.description) { setError('All fields are required'); return; }
    setSaving(true); setError('');
    try {
      if (editRow) {
        await api.put(`/khata/cashbook/${editRow.id}`, form);
      } else {
        await api.post('/khata/cashbook', { ...form, type, amount: Number(form.amount) });
      }
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/khata/cashbook/${id}`); setDeleteConfirm(null); load(); }
    catch (e) { alert(e.response?.data?.error?.message || 'Delete failed'); }
  };

  const cats = type === 'in' ? CASH_IN_CATS : CASH_OUT_CATS;

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Cash Book</Typography>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #4caf50', bgcolor: '#f1f8e9' }}>
            <Typography variant="caption" color="text.secondary">Cash In</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">{fmt(summary.cashIn)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #f44336', bgcolor: '#fce4ec' }}>
            <Typography variant="caption" color="text.secondary">Cash Out</Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">{fmt(summary.cashOut)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid #1976d2', bgcolor: '#e3f2fd' }}>
            <Typography variant="caption" color="text.secondary">Balance</Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main">{fmt(summary.balance)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Actions + filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" color="success" startIcon={<ArrowDownward />} onClick={() => openAdd('in')}>Cash In</Button>
        <Button variant="contained" color="error"   startIcon={<ArrowUpward />}   onClick={() => openAdd('out')}>Cash Out</Button>
        <TextField size="small" type="date" label="Date" value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
        <ToggleButtonGroup size="small" value={typeFilter} exclusive onChange={(_, v) => setTypeFilter(v || '')}>
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="in">Cash In</ToggleButton>
          <ToggleButton value="out">Cash Out</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Table */}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right" sx={{ color: 'success.main' }}>Cash In</TableCell>
              <TableCell align="right" sx={{ color: 'error.main' }}>Cash Out</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>No transactions for this date</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                <TableCell><Chip label={CAT_LABELS[row.category] || row.category} size="small" color={row.type === 'in' ? 'success' : 'error'} variant="outlined" /></TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                  {row.type === 'in' ? fmt(row.amount) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                  {row.type === 'out' ? fmt(row.amount) : '—'}
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row.id)}><Delete fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: editRow ? 'grey.800' : type === 'in' ? 'success.main' : 'error.main', color: 'white' }}>
          {editRow ? 'Edit Transaction' : type === 'in' ? 'Cash In' : 'Cash Out'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {cats.map((c) => <MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small"
                placeholder={type === 'in' ? 'e.g. Rice sale payment' : 'e.g. Driver salary'} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount (৳)" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" color={type === 'in' ? 'success' : 'error'} onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editRow ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete Transaction?</DialogTitle>
        <DialogContent><Typography>This will reverse the cash balance. Are you sure?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
