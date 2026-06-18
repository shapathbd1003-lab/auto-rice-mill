import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Table, TableBody,
  TableCell, TableHead, TableRow, Tabs, Tab, Autocomplete, Divider,
} from '@mui/material';
import { Add, Delete, Check, Close, Visibility } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

const VOUCHER_TYPES = [
  { value: 'sales',       label: 'Sales Voucher',    color: 'success' },
  { value: 'purchase',    label: 'Purchase Voucher',  color: 'warning' },
  { value: 'receipt',     label: 'Receipt Voucher',   color: 'primary' },
  { value: 'payment',     label: 'Payment Voucher',   color: 'error' },
  { value: 'journal',     label: 'Journal Voucher',   color: 'secondary' },
  { value: 'contra',      label: 'Contra Voucher',    color: 'default' },
  { value: 'debit_note',  label: 'Debit Note',        color: 'warning' },
  { value: 'credit_note', label: 'Credit Note',        color: 'info' },
];

function VoucherForm({ ledgers, onSaved, defaultType }) {
  const [form, setForm] = useState({
    voucher_type: defaultType || 'receipt',
    date: today(), narration: '', reference: '', status: 'approved',
    items: [{ ledger: null, entry_type: 'Dr', amount: '' }, { ledger: null, entry_type: 'Cr', amount: '' }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDr = form.items.filter((i) => i.entry_type === 'Dr').reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalCr = form.items.filter((i) => i.entry_type === 'Cr').reduce((s, i) => s + Number(i.amount || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ledger: null, entry_type: 'Dr', amount: '' }] });
  const removeItem = (idx) => { if (form.items.length > 2) setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); };

  const handleSave = async () => {
    if (form.items.some((i) => !i.ledger || !i.amount)) { setError('Fill all ledger entries'); return; }
    if (!balanced) { setError(`Debit (${fmt(totalDr)}) must equal Credit (${fmt(totalCr)})`); return; }
    setSaving(true); setError('');
    try {
      await api.post('/erp/vouchers', {
        voucher_type: form.voucher_type,
        date: form.date, narration: form.narration, reference: form.reference,
        status: form.status,
        items: form.items.map((i) => ({ ledger_id: i.ledger.id, entry_type: i.entry_type, amount: Number(i.amount) })),
      });
      setForm({ voucher_type: defaultType || 'receipt', date: today(), narration: '', reference: '', status: 'approved',
        items: [{ ledger: null, entry_type: 'Dr', amount: '' }, { ledger: null, entry_type: 'Cr', amount: '' }] });
      onSaved();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to save voucher'); }
    finally { setSaving(false); }
  };

  const vMeta = VOUCHER_TYPES.find((v) => v.value === form.voucher_type);

  return (
    <Paper sx={{ p: 2 }}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Voucher Type</InputLabel>
            <Select value={form.voucher_type} label="Voucher Type" onChange={(e) => setForm({ ...form, voucher_type: e.target.value })}>
              {VOUCHER_TYPES.map((v) => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Date" type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Reference No." value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status" onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <MenuItem value="approved">Post Now</MenuItem>
              <MenuItem value="draft">Save as Draft</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Ledger entries */}
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell sx={{ width: '45%' }}>Ledger Account</TableCell>
            <TableCell sx={{ width: '20%' }}>Dr / Cr</TableCell>
            <TableCell align="right" sx={{ width: '25%' }}>Amount (৳)</TableCell>
            <TableCell sx={{ width: '10%' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {form.items.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Autocomplete size="small" options={ledgers} getOptionLabel={(o) => `${o.name}${o.group_name ? ' ['+o.group_name+']' : ''}`}
                  value={item.ledger} onChange={(_, v) => updateItem(idx, 'ledger', v)}
                  renderInput={(p) => <TextField {...p} placeholder="Select ledger..." />} />
              </TableCell>
              <TableCell>
                <FormControl fullWidth size="small">
                  <Select value={item.entry_type} onChange={(e) => updateItem(idx, 'entry_type', e.target.value)}>
                    <MenuItem value="Dr"><span style={{ color: '#1976d2', fontWeight: 'bold' }}>Dr (Debit)</span></MenuItem>
                    <MenuItem value="Cr"><span style={{ color: '#388e3c', fontWeight: 'bold' }}>Cr (Credit)</span></MenuItem>
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell>
                <TextField fullWidth size="small" type="number" value={item.amount}
                  onChange={(e) => updateItem(idx, 'amount', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} />
              </TableCell>
              <TableCell>
                <IconButton size="small" color="error" onClick={() => removeItem(idx)} disabled={form.items.length <= 2}>
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
        <Button size="small" onClick={addItem} startIcon={<Add />}>Add Line</Button>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 3 }}>
          <Typography variant="body2">Dr Total: <strong style={{ color: '#1976d2' }}>{fmt(totalDr)}</strong></Typography>
          <Typography variant="body2">Cr Total: <strong style={{ color: '#388e3c' }}>{fmt(totalCr)}</strong></Typography>
          <Chip label={balanced ? 'Balanced' : 'Not Balanced'} color={balanced ? 'success' : 'error'} size="small" />
        </Box>
      </Box>

      <TextField fullWidth size="small" label="Narration (description)" value={form.narration}
        onChange={(e) => setForm({ ...form, narration: e.target.value })} sx={{ mt: 2 }} multiline rows={2} />

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" color={vMeta?.color || 'primary'} onClick={handleSave} disabled={saving || !balanced}>
          {saving ? <CircularProgress size={20} /> : `Save ${vMeta?.label || 'Voucher'}`}
        </Button>
      </Box>
    </Paper>
  );
}

export default function VoucherEntry() {
  const [tab, setTab] = useState(0);
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ type: '', from: today().slice(0,7) + '-01', to: today() });
  const [viewDialog, setViewDialog] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/erp/vouchers', { params: { ...filter, limit: 100 } }),
      api.get('/erp/ledgers', { params: { limit: 500 } }),
    ]).then(([vRes, lRes]) => {
      setVouchers(vRes.data.data || []);
      setLedgers(lRes.data.data || []);
    }).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try { await api.post(`/erp/vouchers/${id}/approve`); load(); }
    catch (e) { alert(e.response?.data?.error?.message || 'Failed'); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this voucher?')) return;
    try { await api.post(`/erp/vouchers/${id}/cancel`); load(); }
    catch (e) { alert(e.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Voucher Entry</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="New Voucher" />
        <Tab label="Voucher List" />
      </Tabs>

      {tab === 0 && <VoucherForm ledgers={ledgers} onSaved={() => { load(); setTab(1); }} />}

      {tab === 1 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ width: 180 }}>
              <InputLabel>Type</InputLabel>
              <Select value={filter.type} label="Type" onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
                <MenuItem value="">All Types</MenuItem>
                {VOUCHER_TYPES.map((v) => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="From" type="date" value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField size="small" label="To" type="date" value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Voucher No.</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Narration</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                ) : vouchers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>No vouchers found</TableCell></TableRow>
                ) : vouchers.map((v) => {
                  const meta = VOUCHER_TYPES.find((t) => t.value === v.voucher_type);
                  return (
                    <TableRow key={v.id} hover>
                      <TableCell>{new Date(v.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{v.voucher_number}</TableCell>
                      <TableCell><Chip label={meta?.label || v.voucher_type} color={meta?.color || 'default'} size="small" /></TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.narration || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(v.total_amount)}</TableCell>
                      <TableCell>
                        <Chip label={v.status} color={v.status === 'approved' ? 'success' : v.status === 'cancelled' ? 'error' : 'default'} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => api.get(`/erp/vouchers/${v.id}`).then((r) => setViewDialog(r.data.data))}><Visibility fontSize="small" /></IconButton>
                        {v.status === 'draft' && <>
                          <IconButton size="small" color="success" onClick={() => handleApprove(v.id)}><Check fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleCancel(v.id)}><Close fontSize="small" /></IconButton>
                        </>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* View Voucher Dialog */}
      <Dialog open={Boolean(viewDialog)} onClose={() => setViewDialog(null)} maxWidth="sm" fullWidth>
        {viewDialog && <>
          <DialogTitle>
            {VOUCHER_TYPES.find((t) => t.value === viewDialog.voucher_type)?.label} — {viewDialog.voucher_number}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}><Typography variant="caption">Date</Typography><Typography>{new Date(viewDialog.date).toLocaleDateString('en-IN')}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption">Status</Typography><Typography><Chip label={viewDialog.status} color={viewDialog.status === 'approved' ? 'success' : 'default'} size="small" /></Typography></Grid>
              {viewDialog.narration && <Grid item xs={12}><Typography variant="caption">Narration</Typography><Typography>{viewDialog.narration}</Typography></Grid>}
            </Grid>
            <Divider sx={{ mb: 1 }} />
            <Table size="small">
              <TableHead><TableRow><TableCell>Ledger</TableCell><TableCell align="right">Dr</TableCell><TableCell align="right">Cr</TableCell></TableRow></TableHead>
              <TableBody>
                {(viewDialog.items || []).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.ledger_name}</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>{item.entry_type === 'Dr' ? fmt(item.amount) : ''}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{item.entry_type === 'Cr' ? fmt(item.amount) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(viewDialog.total_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(viewDialog.total_amount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions><Button onClick={() => setViewDialog(null)}>Close</Button></DialogActions>
        </>}
      </Dialog>
    </Box>
  );
}
