import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Table, TableBody,
  TableCell, TableHead, TableRow, Tabs, Tab, Card, CardContent,
} from '@mui/material';
import { Add, Edit, AccountBalance, SwapHoriz, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Banking() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(null); // 'account' | 'txn' | 'cheque'
  const [txnType, setTxnType] = useState('deposit');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/erp/banking/summary'),
      api.get('/erp/banking/accounts'),
      api.get('/erp/banking/cheques'),
    ]).then(([sRes, aRes, cRes]) => {
      setSummary(sRes.data.data);
      setAccounts(aRes.data.data || []);
      setCheques(cRes.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadTransactions = useCallback(async (acctId) => {
    if (!acctId) return;
    const r = await api.get(`/erp/banking/accounts/${acctId}/transactions`, { params: { limit: 100 } });
    setTransactions(r.data.data || []);
  }, []);

  useEffect(() => { if (selectedAccount) loadTransactions(selectedAccount.id); }, [selectedAccount, loadTransactions]);

  const openAccountDialog = () => {
    setForm({ bank_name: '', account_name: '', account_number: '', branch: '', opening_balance: 0 });
    setError(''); setDialog('account');
  };

  const openTxnDialog = (type) => {
    if (!selectedAccount) { alert('Select an account first'); return; }
    setTxnType(type);
    setForm({ date: today(), amount: '', description: '', to_account_id: '' });
    setError(''); setDialog('txn');
  };

  const openChequeDialog = () => {
    setForm({ bank_account_id: selectedAccount?.id || '', cheque_number: '', date: today(), amount: '', payee: '', type: 'issued', notes: '' });
    setError(''); setDialog('cheque');
  };

  const handleSaveAccount = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/erp/banking/accounts', { ...form, opening_balance: Number(form.opening_balance) });
      setDialog(null); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleSaveTxn = async () => {
    setSaving(true); setError('');
    try {
      await api.post(`/erp/banking/accounts/${selectedAccount.id}/transaction`, {
        ...form, type: txnType, amount: Number(form.amount),
        to_account_id: form.to_account_id ? Number(form.to_account_id) : null,
      });
      setDialog(null); load(); loadTransactions(selectedAccount.id);
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleSaveCheque = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/erp/banking/cheques', { ...form, amount: Number(form.amount), bank_account_id: Number(form.bank_account_id) });
      setDialog(null); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const updateChequeStatus = async (id, status) => {
    try { await api.put(`/erp/banking/cheques/${id}/status`, { status, cleared_date: status === 'cleared' ? today() : null }); load(); }
    catch (e) { alert('Failed'); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Banking</Typography>

      {/* Summary cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, borderLeft: '4px solid #1976d2' }}>
              <Typography variant="caption" color="text.secondary">Total Bank Balance</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">{fmt(summary.totalBalance)}</Typography>
            </Paper>
          </Grid>
          {(summary.accounts || []).map((a) => (
            <Grid item xs={12} sm={4} key={a.account_number}>
              <Card sx={{ cursor: 'pointer', border: selectedAccount?.account_number === a.account_number ? '2px solid #1976d2' : '1px solid #e0e0e0' }}
                onClick={() => { setSelectedAccount(a); setTab(1); }}>
                <CardContent sx={{ pb: '8px !important' }}>
                  <Typography variant="caption" color="text.secondary">{a.bank_name}</Typography>
                  <Typography variant="body2" fontWeight="bold">{a.account_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.account_number}</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">{fmt(a.current_balance)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openAccountDialog}>Add Bank Account</Button>
        <Button variant="outlined" color="success" startIcon={<ArrowDownward />} onClick={() => openTxnDialog('deposit')}>Deposit</Button>
        <Button variant="outlined" color="error" startIcon={<ArrowUpward />} onClick={() => openTxnDialog('withdrawal')}>Withdrawal</Button>
        <Button variant="outlined" startIcon={<SwapHoriz />} onClick={() => openTxnDialog('transfer')}>Transfer</Button>
        <Button variant="outlined" startIcon={<Add />} onClick={openChequeDialog}>Add Cheque</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All Accounts" />
        <Tab label="Transactions" />
        <Tab label="Cheques" />
      </Tabs>

      {tab === 0 && (
        <Paper>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Bank</TableCell><TableCell>Account Name</TableCell><TableCell>Account No.</TableCell>
              <TableCell>Branch</TableCell><TableCell align="right">Balance</TableCell><TableCell>Status</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {accounts.length === 0
                ? <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>No bank accounts added yet</TableCell></TableRow>
                : accounts.map((a) => (
                  <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedAccount(a); setTab(1); }}>
                    <TableCell fontWeight="bold">{a.bank_name}</TableCell>
                    <TableCell>{a.account_name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{a.account_number}</TableCell>
                    <TableCell>{a.branch || '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{fmt(a.current_balance)}</TableCell>
                    <TableCell><Chip label="Active" color="success" size="small" /></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && (
        <>
          {selectedAccount ? (
            <Paper>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', bgcolor: 'primary.light', color: 'white' }}>
                <Box>
                  <Typography fontWeight="bold">{selectedAccount.bank_name} — {selectedAccount.account_name}</Typography>
                  <Typography variant="caption">{selectedAccount.account_number}</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold">{fmt(selectedAccount.current_balance)}</Typography>
              </Box>
              <Table size="small">
                <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Description</TableCell>
                  <TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {transactions.length === 0
                    ? <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No transactions</TableCell></TableRow>
                    : transactions.map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell>{new Date(t.date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell><Chip label={t.type} size="small" color={t.type === 'deposit' ? 'success' : 'error'} variant="outlined" /></TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>{t.type === 'withdrawal' ? fmt(t.amount) : ''}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{t.type === 'deposit' ? fmt(t.amount) : ''}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Paper>
          ) : <Alert severity="info">Click on a bank account card above to view transactions</Alert>}
        </>
      )}

      {tab === 2 && (
        <Paper>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Bank</TableCell><TableCell>Cheque No.</TableCell><TableCell>Date</TableCell>
              <TableCell>Payee</TableCell><TableCell>Type</TableCell><TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell><TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {cheques.length === 0
                ? <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>No cheques recorded</TableCell></TableRow>
                : cheques.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.bank_name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{c.cheque_number}</TableCell>
                    <TableCell>{new Date(c.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{c.payee || '—'}</TableCell>
                    <TableCell><Chip label={c.type} size="small" color={c.type === 'issued' ? 'warning' : 'info'} /></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(c.amount)}</TableCell>
                    <TableCell>
                      <Chip label={c.status} size="small" color={c.status === 'cleared' ? 'success' : c.status === 'bounced' ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      {c.status === 'pending' && <>
                        <Button size="small" color="success" onClick={() => updateChequeStatus(c.id, 'cleared')}>Clear</Button>
                        <Button size="small" color="error" onClick={() => updateChequeStatus(c.id, 'bounced')}>Bounce</Button>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add Bank Account Dialog */}
      <Dialog open={dialog === 'account'} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Bank Account</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Bank Name *" value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Account Name *" value={form.account_name || ''} onChange={(e) => setForm({ ...form, account_name: e.target.value })} /></Grid>
            <Grid item xs={8}><TextField fullWidth size="small" label="Account Number *" value={form.account_number || ''} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Opening Balance" type="number" value={form.opening_balance || 0} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Branch" value={form.branch || ''} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccount} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={dialog === 'txn'} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: txnType === 'deposit' ? 'success.main' : txnType === 'withdrawal' ? 'error.main' : 'primary.main', color: 'white', textTransform: 'capitalize' }}>{txnType}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Date" type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Amount (৳)" type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Grid>
            {txnType === 'transfer' && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Transfer To Account</InputLabel>
                  <Select value={form.to_account_id || ''} label="Transfer To Account" onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}>
                    {accounts.filter((a) => a.id !== selectedAccount?.id).map((a) => <MenuItem key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" color={txnType === 'deposit' ? 'success' : txnType === 'withdrawal' ? 'error' : 'primary'} onClick={handleSaveTxn} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Cheque Dialog */}
      <Dialog open={dialog === 'cheque'} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Cheque</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank Account *</InputLabel>
                <Select value={form.bank_account_id || ''} label="Bank Account *" onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
                  {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Cheque No. *" value={form.cheque_number || ''} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Date" type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Amount (৳)" type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={form.type || 'issued'} label="Type" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <MenuItem value="issued">Issued (Given)</MenuItem>
                  <MenuItem value="received">Received</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Payee Name" value={form.payee || ''} onChange={(e) => setForm({ ...form, payee: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCheque} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save Cheque'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
