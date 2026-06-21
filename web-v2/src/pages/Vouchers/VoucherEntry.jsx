import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Grid, TextField, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Autocomplete, Divider, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Add, Delete, Check, Close, Visibility } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n||0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0,10);

const NATURE_TO_TYPE = {
  payment:      'Payment Voucher',
  receipt:      'Receipt Voucher',
  contra:       'Contra Voucher',
  journal:      'Journal Voucher',
  purchase:     'Purchase Voucher',
  sales:        'Sales Voucher',
  debit_note:   'Debit Note',
  credit_note:  'Credit Note',
  production:   'Rice Production Voucher',
  consumption:  'Paddy Consumption Voucher',
};

const URL_TO_NATURE = {
  payment:'payment', receipt:'receipt', contra:'contra', journal:'journal',
  purchase:'purchase', sales:'sales', 'debit-note':'debit_note', 'credit-note':'credit_note',
  production:'production',
};

function VoucherForm({ voucherType, ledgers, onSaved }) {
  const [form, setForm] = useState({
    date: today(), narration: '', reference: '', status: 'approved',
    cost_center_id: null,
    items: [
      { ledger: null, ledger_name: '', ledger_group: '', entry_type: 'Dr', amount: '' },
      { ledger: null, ledger_name: '', ledger_group: '', entry_type: 'Cr', amount: '' },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDr = form.items.filter((i) => i.entry_type==='Dr').reduce((s,i) => s+Number(i.amount||0), 0);
  const totalCr = form.items.filter((i) => i.entry_type==='Cr').reduce((s,i) => s+Number(i.amount||0), 0);
  const balanced = Math.abs(totalDr-totalCr) < 0.01;

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field==='ledger' && value) { items[idx].ledger_name=value.name; items[idx].ledger_group=value.group_name; }
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ledger:null, ledger_name:'', ledger_group:'', entry_type:'Dr', amount:'' }] });
  const removeItem = (idx) => { if (form.items.length>2) setForm({ ...form, items: form.items.filter((_,i) => i!==idx) }); };

  const handleSave = async () => {
    if (form.items.some((i) => !i.ledger && !i.ledger_name)) { setError('Each line needs a ledger'); return; }
    if (!balanced) { setError(`Not balanced: Dr ${fmt(totalDr)} ≠ Cr ${fmt(totalCr)}`); return; }
    setSaving(true); setError('');
    try {
      await api.post('/v2/vouchers', {
        voucher_type_master_id: voucherType.id,
        date: form.date, narration: form.narration, reference: form.reference,
        status: form.status,
        items: form.items.map((i) => ({
          ledger_id:   i.ledger?.id || null,
          ledger_name: i.ledger ? null : i.ledger_name,
          ledger_group:i.ledger ? null : i.ledger_group,
          entry_type:  i.entry_type,
          amount:      Number(i.amount),
        })),
      });
      setForm({ date:today(), narration:'', reference:'', status:'approved', cost_center_id:null, items:[{ ledger:null,ledger_name:'',ledger_group:'',entry_type:'Dr',amount:'' },{ ledger:null,ledger_name:'',ledger_group:'',entry_type:'Cr',amount:'' }] });
      onSaved();
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Paper sx={{ p:2 }}>
      <Grid container spacing={2} sx={{ mb:2 }}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Date" type="date" value={form.date}
            onChange={(e) => setForm({...form,date:e.target.value})} InputLabelProps={{ shrink:true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="Reference No." value={form.reference}
            onChange={(e) => setForm({...form,reference:e.target.value})} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status" onChange={(e) => setForm({...form,status:e.target.value})}>
              <MenuItem value="approved">Post Now</MenuItem>
              <MenuItem value="draft">Save as Draft</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Table size="small" sx={{ mb:1 }}>
        <TableHead>
          <TableRow sx={{ bgcolor:'grey.100' }}>
            <TableCell sx={{ width:'45%' }}>Ledger Account</TableCell>
            <TableCell sx={{ width:'20%' }}>Dr / Cr</TableCell>
            <TableCell align="right" sx={{ width:'25%' }}>Amount (৳)</TableCell>
            <TableCell sx={{ width:'10%' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {form.items.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Autocomplete size="small"
                  options={ledgers}
                  getOptionLabel={(o) => `${o.name} [${o.group_name||''}]`}
                  value={item.ledger}
                  onChange={(_, v) => updateItem(idx, 'ledger', v)}
                  freeSolo
                  onInputChange={(_, v, reason) => { if (reason==='input') updateItem(idx,'ledger_name',v); }}
                  renderInput={(p) => <TextField {...p} placeholder="Select or type new ledger name..." />}
                />
              </TableCell>
              <TableCell>
                <FormControl fullWidth size="small">
                  <Select value={item.entry_type} onChange={(e) => updateItem(idx,'entry_type',e.target.value)}>
                    <MenuItem value="Dr"><span style={{ color:'#1976d2', fontWeight:'bold' }}>Dr (Debit)</span></MenuItem>
                    <MenuItem value="Cr"><span style={{ color:'#388e3c', fontWeight:'bold' }}>Cr (Credit)</span></MenuItem>
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell>
                <TextField fullWidth size="small" type="number" value={item.amount}
                  onChange={(e) => updateItem(idx,'amount',e.target.value)}
                  inputProps={{ style:{ textAlign:'right' } }} />
              </TableCell>
              <TableCell>
                <IconButton size="small" color="error" onClick={() => removeItem(idx)} disabled={form.items.length<=2}>
                  <Delete fontSize="small"/>
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mb:2, alignItems:'center' }}>
        <Button size="small" onClick={addItem} startIcon={<Add/>}>Add Line</Button>
        <Box sx={{ ml:'auto', display:'flex', gap:2, alignItems:'center' }}>
          <Typography variant="body2">Dr: <strong style={{ color:'#1976d2' }}>{fmt(totalDr)}</strong></Typography>
          <Typography variant="body2">Cr: <strong style={{ color:'#388e3c' }}>{fmt(totalCr)}</strong></Typography>
          <Chip label={balanced?'Balanced ✓':'Not Balanced'} color={balanced?'success':'error'} size="small"/>
        </Box>
      </Box>

      <TextField fullWidth size="small" label="Narration" value={form.narration}
        onChange={(e) => setForm({...form,narration:e.target.value})} multiline rows={2} sx={{ mb:1 }} />

      {error && <Alert severity="error" sx={{ mb:1 }}>{error}</Alert>}

      <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
        <Button variant="contained" onClick={handleSave} disabled={saving||!balanced}
          sx={{ bgcolor:'#1B5E20' }}>
          {saving ? <CircularProgress size={20}/> : `Save ${voucherType?.name||'Voucher'}`}
        </Button>
      </Box>
    </Paper>
  );
}

export default function VoucherEntry() {
  const { type } = useParams();
  const navigate  = useNavigate();
  const [tab, setTab] = useState(0);
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers]   = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState({ from: today().slice(0,7)+'-01', to: today() });

  const nature = URL_TO_NATURE[type] || null;
  const voucherType = voucherTypes.find((v) => v.nature===nature) || voucherTypes[0];

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...filter, limit:100 };
    if (nature) params.nature = nature;
    api.get('/v2/vouchers', { params })
      .then((r) => setVouchers(r.data.data||[]))
      .finally(() => setLoading(false));
  }, [filter, nature]);

  useEffect(() => {
    load();
    api.get('/erp/ledgers', { params:{ limit:500 } }).then((r) => setLedgers(r.data.data||[]));
    api.get('/v2/masters/voucher-types').then((r) => setVoucherTypes(r.data.data||[]));
  }, [load]);

  const [viewDialog, setViewDialog] = useState(null);

  const handleApprove = async (id) => {
    try { await api.post(`/v2/vouchers/${id}/approve`); load(); } catch(e) { alert(e.response?.data?.error?.message||'Failed'); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb:2 }}>
        {nature ? NATURE_TO_TYPE[nature]||'Voucher Entry' : 'All Vouchers'}
      </Typography>

      <Tabs value={tab} onChange={(_,v) => setTab(v)} sx={{ mb:2 }}>
        <Tab label="New Voucher"/>
        <Tab label="Voucher List"/>
      </Tabs>

      {tab===0 && voucherType && (
        <VoucherForm voucherType={voucherType} ledgers={ledgers} onSaved={() => { load(); setTab(1); }}/>
      )}

      {tab===1 && (
        <>
          <Box sx={{ display:'flex', gap:1, mb:2, flexWrap:'wrap' }}>
            <TextField size="small" label="From" type="date" value={filter.from}
              onChange={(e) => setFilter({...filter,from:e.target.value})} InputLabelProps={{ shrink:true }} sx={{ width:{ xs:'100%', sm:160 } }}/>
            <TextField size="small" label="To" type="date" value={filter.to}
              onChange={(e) => setFilter({...filter,to:e.target.value})} InputLabelProps={{ shrink:true }} sx={{ width:{ xs:'100%', sm:160 } }}/>
          </Box>
          <Paper sx={{ overflowX:'auto' }}>
            <Table size="small" sx={{ minWidth:500 }}>
              <TableHead>
                <TableRow sx={{ bgcolor:'grey.100' }}>
                  <TableCell sx={{ whiteSpace:'nowrap' }}>Date</TableCell>
                  <TableCell sx={{ whiteSpace:'nowrap' }}>Voucher No.</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Narration</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                  : vouchers.length===0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ color:'text.secondary' }}>No vouchers found</TableCell></TableRow>
                  : vouchers.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell>{new Date(v.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell sx={{ fontFamily:'monospace', fontWeight:'bold' }}>{v.voucher_number}</TableCell>
                      <TableCell><Chip label={v.voucher_type_name} size="small"/></TableCell>
                      <TableCell sx={{ maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.narration||'—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(v.total_amount)}</TableCell>
                      <TableCell><Chip label={v.status} color={v.status==='approved'?'success':v.status==='cancelled'?'error':'default'} size="small"/></TableCell>
                      <TableCell align="center">
                        {v.status==='draft' && <IconButton size="small" color="success" onClick={() => handleApprove(v.id)} title="Approve"><Check fontSize="small"/></IconButton>}
                        {v.status==='draft' && <IconButton size="small" color="error" title="Cancel" onClick={async () => { try { await api.post(`/v2/vouchers/${v.id}/cancel`); load(); } catch(e) { alert(e.response?.data?.error?.message||'Failed'); } }}><Close fontSize="small"/></IconButton>}
                        <IconButton size="small" title="View" onClick={() => api.get(`/v2/vouchers/${v.id}`).then((r) => setViewDialog(r.data.data))}><Visibility fontSize="small"/></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* View Voucher Dialog */}
      {viewDialog && (
        <Dialog open={Boolean(viewDialog)} onClose={() => setViewDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{viewDialog.voucher_type_name} — {viewDialog.voucher_number}</DialogTitle>
          <DialogContent>
            <Grid container spacing={1} sx={{ mb:2 }}>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body2">{new Date(viewDialog.date).toLocaleDateString('en-IN')}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Status</Typography><br/><Chip label={viewDialog.status} color={viewDialog.status==='approved'?'success':'default'} size="small"/></Grid>
              {viewDialog.narration && <Grid item xs={12}><Typography variant="caption" color="text.secondary">Narration</Typography><Typography variant="body2">{viewDialog.narration}</Typography></Grid>}
            </Grid>
            <Divider sx={{ mb:1 }}/>
            <Table size="small">
              <TableHead><TableRow><TableCell>Ledger</TableCell><TableCell align="right" sx={{ color:'primary.main' }}>Dr</TableCell><TableCell align="right" sx={{ color:'success.main' }}>Cr</TableCell></TableRow></TableHead>
              <TableBody>
                {(viewDialog.items||[]).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.ledger_name}</TableCell>
                    <TableCell align="right" sx={{ color:'primary.main', fontWeight:'bold' }}>{item.entry_type==='Dr' ? fmt(item.amount) : ''}</TableCell>
                    <TableCell align="right" sx={{ color:'success.main', fontWeight:'bold' }}>{item.entry_type==='Cr' ? fmt(item.amount) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor:'grey.50' }}>
                  <TableCell sx={{ fontWeight:'bold' }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(viewDialog.total_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(viewDialog.total_amount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions><Button onClick={() => setViewDialog(null)}>Close</Button></DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
