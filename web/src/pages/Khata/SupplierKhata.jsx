import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Paper, Grid,
  List, ListItem, ListItemText, ListItemSecondaryAction, Divider, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Avatar, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Search, Add, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function SupplierList({ onSelect, selected, refreshKey }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/suppliers', { params: { limit: 100, search } })
      .then((r) => setSuppliers(r.data.data || []))
      .finally(() => setLoading(false));
  }, [search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
        <TextField fullWidth size="small" placeholder="Search supplier..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
      </Box>
      {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
        <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {suppliers.map((s) => (
            <React.Fragment key={s.id}>
              <ListItem button selected={selected?.id === s.id} onClick={() => onSelect(s)}
                sx={{ '&.Mui-selected': { bgcolor: 'warning.light' } }}>
                <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'warning.main', fontSize: 14 }}>
                  {s.name[0].toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={<Typography fontWeight="bold" variant="body2">{s.name}</Typography>}
                  secondary={s.phone || 'No phone'}
                />
                <ListItemSecondaryAction>
                  {s.balance > 0
                    ? <Chip label={`Due ${fmt(s.balance)}`} color="warning" size="small" />
                    : <Chip label="Clear" color="default" size="small" variant="outlined" />}
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
          {suppliers.length === 0 && <ListItem><ListItemText secondary="No suppliers found" /></ListItem>}
        </List>
      )}
    </Paper>
  );
}

function SupplierLedgerPanel({ supplier, onRefresh }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dueDialog, setDueDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [form, setForm] = useState({ amount: '', date: today(), description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!supplier) return;
    setLoading(true);
    api.get(`/suppliers/${supplier.id}/ledger`, { params: { limit: 50 } })
      .then((r) => setLedger(r.data.data || []))
      .finally(() => setLoading(false));
  }, [supplier]);

  useEffect(() => { load(); }, [load]);

  const openDialog = (type) => {
    setError(''); setForm({ amount: '', date: today(), description: '' });
    type === 'due' ? setDueDialog(true) : setPayDialog(true);
  };

  const handleDue = async () => {
    if (!form.amount || form.amount <= 0) { setError('Enter valid amount'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/suppliers/${supplier.id}/due`, {
        amount: Number(form.amount), date: form.date,
        description: form.description || 'Purchase due added',
      });
      setDueDialog(false); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!form.amount || form.amount <= 0) { setError('Enter valid amount'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/suppliers/${supplier.id}/payment`, {
        amount: Number(form.amount), date: form.date,
        description: form.description || 'Payment made to supplier',
      });
      setPayDialog(false); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (!supplier) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>Select a supplier to view khata</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{supplier.name}</Typography>
            {supplier.phone && <Typography variant="body2" color="text.secondary">{supplier.phone}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Total Due to Supplier</Typography>
            <Typography variant="h5" fontWeight="bold" color={supplier.balance > 0 ? 'warning.dark' : 'success.main'}>
              {fmt(Math.abs(supplier.balance))}
            </Typography>
            {supplier.balance > 0 && <Typography variant="caption" color="warning.dark">You owe supplier</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" color="warning" startIcon={<ArrowUpward />} size="small" onClick={() => openDialog('due')}>
            Add Purchase Due
          </Button>
          <Button variant="contained" color="success" startIcon={<ArrowDownward />} size="small" onClick={() => openDialog('pay')}>
            Pay Supplier
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle2" fontWeight="bold">Transaction History</Typography>
        </Box>
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.dark' }}>Due (Cr)</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>Paid (Dr)</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">No transactions yet</TableCell></TableRow>
                ) : ledger.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right" sx={{ color: row.credit > 0 ? 'warning.dark' : 'text.disabled' }}>
                      {row.credit > 0 ? fmt(row.credit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.debit > 0 ? 'success.main' : 'text.disabled' }}>
                      {row.debit > 0 ? fmt(row.debit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: row.balance > 0 ? 'warning.dark' : 'success.main' }}>
                      {fmt(Math.abs(row.balance))} {row.balance > 0 ? 'Due' : 'Adv'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>

      {/* Add Due Dialog */}
      <Dialog open={dueDialog} onClose={() => setDueDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>Add Purchase Due</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label="Amount (৳)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Note (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDueDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleDue} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Add Due'}</Button>
        </DialogActions>
      </Dialog>

      {/* Pay Supplier Dialog */}
      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>Pay Supplier</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label="Amount Paid (৳)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Note (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Pay Supplier'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function SupplierKhata() {
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const handleAddSupplier = async () => {
    setSaving(true);
    try {
      const code = 'S' + Date.now().toString().slice(-6);
      await api.post('/suppliers', { ...newForm, code });
      setAddDialog(false);
      setNewForm({ name: '', phone: '', address: '' });
      setRefreshKey((k) => k + 1);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Supplier Khata</Typography>
        <Button variant="contained" color="warning" startIcon={<Add />} onClick={() => setAddDialog(true)}>Add Supplier</Button>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Grid item xs={12} sm={4} md={3} sx={{ height: '100%' }}>
          <SupplierList onSelect={setSelected} selected={selected} refreshKey={refreshKey} />
        </Grid>
        <Grid item xs={12} sm={8} md={9} sx={{ height: '100%' }}>
          <SupplierLedgerPanel supplier={selected} onRefresh={() => setRefreshKey((k) => k + 1)} />
        </Grid>
      </Grid>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Supplier</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Supplier Name *" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Mobile Number" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Address" value={newForm.address} onChange={(e) => setNewForm({ ...newForm, address: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSupplier} disabled={saving || !newForm.name}>
            {saving ? <CircularProgress size={20} /> : 'Add Supplier'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
