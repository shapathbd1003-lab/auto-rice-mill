import React, { useEffect, useState, useCallback } from 'react';
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

const CATEGORIES = [
  { value: 'labor',       label: 'Labor' },
  { value: 'transport',   label: 'Transport' },
  { value: 'fuel',        label: 'Fuel' },
  { value: 'packaging',   label: 'Packaging' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salary',      label: 'Salary' },
  { value: 'other',       label: 'Other' },
];

const COLORS = {
  labor: 'primary', transport: 'warning', fuel: 'error', packaging: 'info',
  electricity: 'secondary', maintenance: 'warning', salary: 'success', other: 'default',
};

export default function ExpenseBook() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0); // 0=daily, 1=monthly
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

  const openAdd = () => {
    setEditRow(null); setForm({ date: today(), category: '', description: '', amount: '' });
    setError(''); setDialog(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setForm({ date: row.date?.slice(0, 10), category: row.category, description: row.description, amount: row.amount });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.category || !form.description) { setError('All fields required'); return; }
    setSaving(true); setError('');
    try {
      if (editRow) await api.put(`/accounting/expenses/${editRow.id}`, { ...form, amount: Number(form.amount) });
      else await api.post('/accounting/expenses', { ...form, amount: Number(form.amount) });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.delete(`/accounting/expenses/${id}`); load(); }
    catch (e) { alert('Delete failed'); }
  };

  // Group by category for monthly view
  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    total: rows.filter((r) => r.category === c.value).reduce((s, r) => s + Number(r.amount || 0), 0),
  })).filter((c) => c.total > 0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Expense Book</Typography>
        <Button variant="contained" color="error" startIcon={<Add />} onClick={openAdd} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? 'Add' : 'Add Expense'}
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Daily Expenses" />
        <Tab label="Monthly Expenses" />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ mb: 2 }}>
          <TextField size="small" type="date" label="Date" value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 180 } }} InputLabelProps={{ shrink: true }} />
        </Box>
      )}
      {tab === 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField size="small" type="month" label="Month" value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)} sx={{ width: 180 }} InputLabelProps={{ shrink: true }} />
          <Paper sx={{ px: 3, py: 1, bgcolor: 'error.light' }}>
            <Typography variant="caption">Month Total</Typography>
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
          {!loading && rows.length === 0 && <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>No expenses found</Paper>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0, pt: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Chip label={CATEGORIES.find((c) => c.value === row.category)?.label || row.category}
                      size="small" color={COLORS[row.category] || 'default'} variant="outlined" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{row.description}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {new Date(row.date).toLocaleDateString('en-IN')}
                    </Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color="error.main" sx={{ flexShrink: 0 }}>
                    {fmt(row.amount)}
                  </Typography>
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
        /* Desktop: table */
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No expenses found</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell><Chip label={CATEGORIES.find((c) => c.value === row.category)?.label || row.category} size="small" color={COLORS[row.category] || 'default'} variant="outlined" /></TableCell>
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

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>{editRow ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
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
                  {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small"
                placeholder="e.g. Diesel for generator" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount (৳)" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editRow ? 'Update' : 'Save Expense'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
