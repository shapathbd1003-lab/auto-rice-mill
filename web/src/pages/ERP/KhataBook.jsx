/**
 * Universal KhataBook — works for ANY ledger group.
 * Customer Khata, Supplier Khata, Employee Khata, Bank Khata, or any custom group.
 * Reads group_type from the group to adapt UI labels and quick-action buttons.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Paper, Grid,
  List, ListItem, ListItemText, ListItemSecondaryAction, Divider, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Autocomplete, Tabs, Tab,
  IconButton,
} from '@mui/material';
import { Search, Add, ArrowUpward, ArrowDownward, WhatsApp, Phone } from '@mui/icons-material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

// Adapt labels based on group type
const LABELS = {
  customer: { addDue:'Add Due', receivePayment:'Receive Payment', balance:'Customer Due', drLabel:'Due (Dr)', crLabel:'Paid (Cr)' },
  supplier: { addDue:'Add Purchase Due', receivePayment:'Pay Supplier', balance:'Supplier Due', drLabel:'Purchase (Cr)', crLabel:'Payment (Dr)' },
  employee: { addDue:'Add Salary Due', receivePayment:'Pay Salary', balance:'Salary Due', drLabel:'Salary (Dr)', crLabel:'Paid (Cr)' },
  bank:     { addDue:'Deposit', receivePayment:'Withdrawal', balance:'Bank Balance', drLabel:'Credit (Dr)', crLabel:'Debit (Cr)' },
  general:  { addDue:'Add Due', receivePayment:'Make Payment', balance:'Balance', drLabel:'Debit (Dr)', crLabel:'Credit (Cr)' },
};

function BalanceChip({ balance, groupType }) {
  const pos = balance > 0;
  const label = pos ? `Due ${fmt(balance)}` : balance < 0 ? `Advance ${fmt(-balance)}` : 'Clear';
  const color = pos ? 'error' : balance < 0 ? 'success' : 'default';
  return <Chip label={label} color={color} size="small" variant={balance === 0 ? 'outlined' : 'filled'} />;
}

function LedgerList({ groupId, onSelect, selected, refreshKey }) {
  const [ledgers, setLedgers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!groupId) return;
    setLoading(true);
    api.get(`/erp/khata/groups/${groupId}/ledgers`, { params: { limit:200, search } })
      .then((r) => setLedgers(r.data.data || []))
      .finally(() => setLoading(false));
  }, [groupId, search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  return (
    <Paper sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <Box sx={{ p:1.5, borderBottom:'1px solid #eee' }}>
        <TextField fullWidth size="small" placeholder="Search..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment:<InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
      </Box>
      {loading ? <Box sx={{ p:2, textAlign:'center' }}><CircularProgress size={24} /></Box> : (
        <List dense sx={{ overflowY:'auto', flexGrow:1 }}>
          {ledgers.length === 0 && <ListItem><ListItemText secondary="No ledgers in this group" /></ListItem>}
          {ledgers.map((l) => (
            <React.Fragment key={l.id}>
              <ListItem button selected={selected?.id === l.id} onClick={() => onSelect(l)}
                sx={{ '&.Mui-selected':{ bgcolor:'primary.light', color:'white' } }}>
                <Avatar sx={{ width:32, height:32, mr:1.5, bgcolor:'primary.main', fontSize:14 }}>
                  {l.name[0]?.toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight="bold" noWrap>{l.name}</Typography>}
                  secondary={l.phone || (l.email ? l.email : 'No contact')}
                />
                <ListItemSecondaryAction>
                  <BalanceChip balance={l.current_balance} />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
}

function LedgerDetail({ ledger, groupType, onRefresh, allLedgers }) {
  const labels = LABELS[groupType] || LABELS.general;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dueDialog, setDueDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [form, setForm] = useState({ amount:'', date:today(), description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    if (!ledger) return;
    setLoading(true);
    api.get(`/erp/khata/ledgers/${ledger.id}/transactions`, { params:{ limit:50 } })
      .then((r) => setTransactions(r.data.data || []))
      .finally(() => setLoading(false));
  }, [ledger]);

  useEffect(() => { load(); setTab(0); }, [load]);

  const resetForm = () => setForm({ amount:'', date:today(), description:'' });

  const handleDue = async () => {
    if (!form.amount || !form.description) { setError('Amount and description required'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/erp/khata/ledgers/${ledger.id}/add-due`, { amount:Number(form.amount), date:form.date, description:form.description });
      setDueDialog(false); resetForm(); load(); onRefresh();
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!form.amount || !form.description) { setError('Amount and description required'); return; }
    setSaving(true); setError('');
    try {
      const endpoint = (groupType === 'supplier' || groupType === 'employee')
        ? `/erp/khata/ledgers/${ledger.id}/make-payment`
        : `/erp/khata/ledgers/${ledger.id}/receive-payment`;
      await api.post(endpoint, { amount:Number(form.amount), date:form.date, description:form.description });
      setPayDialog(false); resetForm(); load(); onRefresh();
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const whatsApp = () => {
    if (!ledger.phone) return;
    const msg = `Dear ${ledger.name}, your current balance is ${fmt(Math.abs(ledger.current_balance))}. Please contact us.`;
    window.open(`https://wa.me/880${ledger.phone.replace(/^0/,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!ledger) return (
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'text.secondary' }}>
      <Typography>Select a ledger to view transactions</Typography>
    </Box>
  );

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Ledger header */}
      <Paper sx={{ p:2, mb:2 }}>
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{ledger.name}</Typography>
            {ledger.name_bn && <Typography variant="body2" color="text.secondary">{ledger.name_bn}</Typography>}
            {ledger.phone && (
              <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mt:0.5 }}>
                <Phone fontSize="small" sx={{ color:'text.secondary', fontSize:14 }} />
                <Typography variant="body2">{ledger.phone}</Typography>
              </Box>
            )}
            {ledger.address && <Typography variant="caption" color="text.secondary">{ledger.address}</Typography>}
          </Box>
          <Box sx={{ textAlign:'right' }}>
            <Typography variant="caption" color="text.secondary">{labels.balance}</Typography>
            <Typography variant="h5" fontWeight="bold" color={ledger.current_balance > 0 ? 'error.main' : ledger.current_balance < 0 ? 'success.main' : 'text.secondary'}>
              {fmt(Math.abs(ledger.current_balance))}
            </Typography>
            <Typography variant="caption" color={ledger.current_balance > 0 ? 'error.main' : 'success.main'}>
              {ledger.current_balance > 0 ? `${ledger.balance_type} balance` : ledger.current_balance < 0 ? 'Advance' : 'Clear'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display:'flex', gap:1, mt:2, flexWrap:'wrap' }}>
          <Button variant="contained" color="error" size="small" startIcon={<ArrowUpward />}
            onClick={() => { setError(''); resetForm(); setDueDialog(true); }}>
            {labels.addDue}
          </Button>
          <Button variant="contained" color="success" size="small" startIcon={<ArrowDownward />}
            onClick={() => { setError(''); resetForm(); setPayDialog(true); }}>
            {labels.receivePayment}
          </Button>
          {ledger.phone && (
            <Button variant="outlined" color="success" size="small" startIcon={<WhatsApp />} onClick={whatsApp}>
              WhatsApp
            </Button>
          )}
        </Box>
      </Paper>

      {/* Transactions */}
      <Paper sx={{ flexGrow:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <Tabs value={tab} onChange={(_,v) => setTab(v)} sx={{ borderBottom:'1px solid #eee' }}>
          <Tab label="Transaction History" />
          <Tab label="Statement" />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ overflowY:'auto', flexGrow:1 }}>
            {loading ? <Box sx={{ p:2, textAlign:'center' }}><CircularProgress size={24} /></Box> : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Voucher</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right" sx={{ color:'error.main' }}>{labels.drLabel}</TableCell>
                    <TableCell align="right" sx={{ color:'success.main' }}>{labels.crLabel}</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0
                    ? <TableRow><TableCell colSpan={6} align="center">No transactions yet</TableCell></TableRow>
                    : transactions.map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ whiteSpace:'nowrap' }}>{new Date(t.date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell sx={{ fontFamily:'monospace', fontSize:12 }}>{t.voucher_number}</TableCell>
                        <TableCell>{t.narration || '—'}</TableCell>
                        <TableCell align="right" sx={{ color:t.entry_type==='Dr'?'error.main':'text.disabled' }}>
                          {t.entry_type==='Dr' ? fmt(t.amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ color:t.entry_type==='Cr'?'success.main':'text.disabled' }}>
                          {t.entry_type==='Cr' ? fmt(t.amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight:'bold', color:t.balance>0?'error.main':'success.main' }}>
                          {fmt(Math.abs(t.balance))} {t.balance>=0?'Dr':'Cr'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p:3, textAlign:'center', color:'text.secondary' }}>
            <Typography variant="body2" sx={{ mb:1 }}>
              Opening Balance: <strong>{fmt(ledger.opening_balance)} {ledger.opening_type}</strong>
            </Typography>
            <Typography variant="body2" sx={{ mb:1 }}>
              Current Balance: <strong style={{ color: ledger.current_balance > 0 ? '#d32f2f' : '#388e3c' }}>
                {fmt(Math.abs(ledger.current_balance))} {ledger.balance_type}
              </strong>
            </Typography>
            <Button variant="outlined" size="small" sx={{ mt:1 }}
              href={`/api/erp/ledgers/${ledger.id}/statement`} target="_blank">
              View Full Statement
            </Button>
          </Box>
        )}
      </Paper>

      {/* Add Due Dialog */}
      <Dialog open={dueDialog} onClose={() => setDueDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor:'error.main', color:'white' }}>{labels.addDue}</DialogTitle>
        <DialogContent sx={{ pt:2 }}>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Amount (৳) *" type="number" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})} autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Date" type="date" value={form.date} onChange={(e) => setForm({...form,date:e.target.value})} InputLabelProps={{ shrink:true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Description *" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} placeholder="e.g. Rice sold on credit" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDueDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDue} disabled={saving}>{saving?<CircularProgress size={20}/>:labels.addDue}</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor:'success.main', color:'white' }}>{labels.receivePayment}</DialogTitle>
        <DialogContent sx={{ pt:2 }}>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Amount (৳) *" type="number" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})} autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Date" type="date" value={form.date} onChange={(e) => setForm({...form,date:e.target.value})} InputLabelProps={{ shrink:true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Description *" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} placeholder="e.g. Cash received" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={saving}>{saving?<CircularProgress size={20}/>:labels.receivePayment}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function KhataBook() {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [group, setGroup] = useState(location.state?.group || null);
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [allLedgers, setAllLedgers] = useState([]);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', contact_person:'', opening_balance:0, opening_type:'Dr', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load group info if not passed via state
  useEffect(() => {
    if (!group && groupId) {
      api.get('/erp/khata/groups')
        .then((r) => {
          const found = (r.data.data || []).find((g) => String(g.id) === String(groupId));
          if (found) setGroup(found);
        });
    }
    api.get('/erp/ledgers', { params:{ limit:500 } }).then((r) => setAllLedgers(r.data.data || []));
  }, [groupId]);

  const groupType = group?.group_type || 'general';
  const labels = LABELS[groupType] || LABELS.general;
  const defaultOpeningType = (groupType === 'supplier') ? 'Cr' : 'Dr';

  const handleAdd = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/erp/ledgers', {
        ...form,
        group_id: Number(groupId),
        opening_balance: Number(form.opening_balance),
        opening_type: form.opening_type || defaultOpeningType,
      });
      setAddDialog(false);
      setForm({ name:'', phone:'', email:'', address:'', contact_person:'', opening_balance:0, opening_type:defaultOpeningType, notes:'' });
      setRefreshKey((k) => k+1);
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const addLabel = {
    customer:'Add Customer', supplier:'Add Supplier', employee:'Add Employee',
    bank:'Add Bank Account', general:'Add Ledger',
  }[groupType] || 'Add Ledger';

  return (
    <Box sx={{ height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {group?.name || 'Khata Book'}
          </Typography>
          {group?.name_bn && <Typography variant="caption" color="text.secondary">{group.name_bn}</Typography>}
        </Box>
        <Box sx={{ display:'flex', gap:1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/erp/ledger-groups')}>All Groups</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setError(''); setForm({ name:'', phone:'', email:'', address:'', contact_person:'', opening_balance:0, opening_type:defaultOpeningType, notes:'' }); setAddDialog(true); }}>
            {addLabel}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow:1, overflow:'hidden' }}>
        <Grid item xs={12} sm={4} md={3} sx={{ height:'100%' }}>
          <LedgerList groupId={groupId} onSelect={setSelected} selected={selected} refreshKey={refreshKey} />
        </Grid>
        <Grid item xs={12} sm={8} md={9} sx={{ height:'100%' }}>
          <LedgerDetail
            ledger={selected}
            groupType={groupType}
            onRefresh={() => setRefreshKey((k) => k+1)}
            allLedgers={allLedgers}
          />
        </Grid>
      </Grid>

      {/* Add Ledger Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{addLabel} — {group?.name}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Name *" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} autoFocus /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Mobile Number" value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Email" value={form.email} onChange={(e) => setForm({...form,email:e.target.value})} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Address" value={form.address} onChange={(e) => setForm({...form,address:e.target.value})} /></Grid>
            {groupType !== 'bank' && <Grid item xs={12}><TextField fullWidth size="small" label="Contact Person" value={form.contact_person} onChange={(e) => setForm({...form,contact_person:e.target.value})} /></Grid>}
            <Grid item xs={6}><TextField fullWidth size="small" label="Opening Balance" type="number" value={form.opening_balance} onChange={(e) => setForm({...form,opening_balance:e.target.value})} /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Balance Type</InputLabel>
                <Select value={form.opening_type} label="Balance Type" onChange={(e) => setForm({...form,opening_type:e.target.value})}>
                  <MenuItem value="Dr">Debit (Dr) — receivable</MenuItem>
                  <MenuItem value="Cr">Credit (Cr) — payable</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(e) => setForm({...form,notes:e.target.value})} multiline rows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}>{saving?<CircularProgress size={20}/>:'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
