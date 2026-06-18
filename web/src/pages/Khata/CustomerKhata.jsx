import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Paper, Grid,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Divider, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Avatar, Tabs, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Search, Add, ArrowUpward, ArrowDownward, Person, Phone,
  Edit, Delete, Visibility, WhatsApp,
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function DueChip({ balance }) {
  if (balance > 0) return <Chip label={`Due ${fmt(balance)}`} color="error" size="small" />;
  if (balance < 0) return <Chip label={`Advance ${fmt(-balance)}`} color="success" size="small" />;
  return <Chip label="Clear" color="default" size="small" variant="outlined" />;
}

function CustomerList({ onSelect, selected }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/customers', { params: { limit: 100, search } })
      .then((r) => setCustomers(r.data.data || []))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
        <TextField fullWidth size="small" placeholder="Search customer..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
      </Box>
      {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
        <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {customers.map((c) => (
            <React.Fragment key={c.id}>
              <ListItem
                button
                selected={selected?.id === c.id}
                onClick={() => onSelect(c)}
                sx={{ '&.Mui-selected': { bgcolor: 'primary.light', color: 'white' } }}
              >
                <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'primary.main', fontSize: 14 }}>
                  {c.name[0].toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={<Typography fontWeight="bold" variant="body2">{c.name}</Typography>}
                  secondary={c.phone || 'No phone'}
                />
                <ListItemSecondaryAction>
                  <DueChip balance={c.balance} />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
          {customers.length === 0 && <ListItem><ListItemText secondary="No customers found" /></ListItem>}
        </List>
      )}
    </Paper>
  );
}

function LedgerPanel({ customer, onRefresh }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [dueDialog, setDueDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [form, setForm] = useState({ amount: '', date: today(), description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!customer) return;
    setLoading(true);
    api.get(`/customers/${customer.id}/ledger`, { params: { limit: 50 } })
      .then((r) => setLedger(r.data.data || []))
      .finally(() => setLoading(false));
  }, [customer]);

  useEffect(() => { load(); setTab(0); }, [load]);

  const handleAddDue = async () => {
    if (!form.amount || form.amount <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/customers/${customer.id}/due`, {
        amount: Number(form.amount),
        date: form.date,
        description: form.description || 'Due added',
      });
      setDueDialog(false);
      setForm({ amount: '', date: today(), description: '' });
      load(); onRefresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!form.amount || form.amount <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/customers/${customer.id}/payment`, {
        amount: Number(form.amount),
        date: form.date,
        description: form.description || 'Payment received',
      });
      setPayDialog(false);
      setForm({ amount: '', date: today(), description: '' });
      load(); onRefresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const openWhatsApp = () => {
    if (!customer.phone) return;
    const msg = `Dear ${customer.name}, your current due amount is ${fmt(customer.balance)}. Please contact us. Thank you.`;
    window.open(`https://wa.me/880${customer.phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!customer) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>Select a customer to view khata</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Customer header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{customer.name}</Typography>
            {customer.name_bn && <Typography variant="body2" color="text.secondary">{customer.name_bn}</Typography>}
            {customer.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Phone fontSize="small" sx={{ mr: 0.5, color: 'text.secondary', fontSize: 14 }} />
                <Typography variant="body2">{customer.phone}</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Total Due</Typography>
            <Typography variant="h5" fontWeight="bold" color={customer.balance > 0 ? 'error.main' : 'success.main'}>
              {fmt(Math.abs(customer.balance))}
            </Typography>
            {customer.balance > 0 && <Typography variant="caption" color="error">Customer owes you</Typography>}
            {customer.balance < 0 && <Typography variant="caption" color="success.main">You owe customer</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" color="error" startIcon={<ArrowUpward />}
            size="small" onClick={() => { setError(''); setForm({ amount: '', date: today(), description: '' }); setDueDialog(true); }}>
            Add Due
          </Button>
          <Button variant="contained" color="success" startIcon={<ArrowDownward />}
            size="small" onClick={() => { setError(''); setForm({ amount: '', date: today(), description: '' }); setPayDialog(true); }}>
            Receive Payment
          </Button>
          {customer.phone && (
            <Button variant="outlined" color="success" startIcon={<WhatsApp />} size="small" onClick={openWhatsApp}>
              WhatsApp
            </Button>
          )}
        </Box>
      </Paper>

      {/* Ledger */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #eee' }}>
          <Tab label="Transaction History" />
          <Tab label="Statement" />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
            {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>Due (Dr)</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>Paid (Cr)</TableCell>
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
                      <TableCell align="right" sx={{ color: row.debit > 0 ? 'error.main' : 'text.disabled' }}>
                        {row.debit > 0 ? fmt(row.debit) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: row.credit > 0 ? 'success.main' : 'text.disabled' }}>
                        {row.credit > 0 ? fmt(row.credit) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: row.balance > 0 ? 'error.main' : 'success.main' }}>
                        {fmt(Math.abs(row.balance))} {row.balance > 0 ? 'Dr' : 'Cr'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">PDF statement generation available after backend is connected.</Typography>
            <Button variant="outlined" size="small" sx={{ mt: 1 }}
              onClick={() => window.open(`/api/reports/customer-statement/${customer.id}`, '_blank')}>
              Download PDF Statement
            </Button>
          </Box>
        )}
      </Paper>

      {/* Add Due Dialog */}
      <Dialog open={dueDialog} onClose={() => setDueDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>Add Customer Due</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount (৳)" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Note (optional)" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small"
                placeholder="e.g. Rice sold on credit" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDueDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleAddDue} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Add Due'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receive Payment Dialog */}
      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>Receive Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount Received (৳)" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Note (optional)" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} size="small"
                placeholder="e.g. Cash payment" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Receive Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function CustomerKhata() {
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', address: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  const handleAddCustomer = async () => {
    setSaving(true);
    try {
      const code = 'C' + Date.now().toString().slice(-6);
      await api.post('/customers', { ...newForm, code, opening_balance: Number(newForm.opening_balance) });
      setAddDialog(false);
      setNewForm({ name: '', phone: '', address: '', opening_balance: 0 });
      setRefreshKey((k) => k + 1);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Customer Khata</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialog(true)}>Add Customer</Button>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Grid item xs={12} sm={4} md={3} sx={{ height: '100%' }}>
          <CustomerList key={refreshKey} onSelect={setSelected} selected={selected} />
        </Grid>
        <Grid item xs={12} sm={8} md={9} sx={{ height: '100%' }}>
          <LedgerPanel customer={selected} onRefresh={() => setRefreshKey((k) => k + 1)} />
        </Grid>
      </Grid>

      {/* Add Customer Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Customer Name *" value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} size="small" autoFocus />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Mobile Number" value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Address" value={newForm.address}
                onChange={(e) => setNewForm({ ...newForm, address: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Opening Balance (৳)" type="number" value={newForm.opening_balance}
                onChange={(e) => setNewForm({ ...newForm, opening_balance: e.target.value })} size="small"
                helperText="Enter if customer already has a due" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCustomer} disabled={saving || !newForm.name}>
            {saving ? <CircularProgress size={20} /> : 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
