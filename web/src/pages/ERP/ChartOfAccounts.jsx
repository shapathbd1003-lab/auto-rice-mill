import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Collapse, List,
  ListItem, ListItemText, ListItemIcon, Divider, InputAdornment, Tabs, Tab,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, ExpandMore, ExpandLess, AccountTree,
  FolderOpen, Description,
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

const NATURE_COLORS = { assets: 'primary', liabilities: 'error', income: 'success', expenses: 'warning', capital: 'secondary' };
const NATURE_LABELS = { assets: 'Assets', liabilities: 'Liabilities', income: 'Income', expenses: 'Expenses', capital: 'Capital' };

function GroupNode({ group, onEditLedger, onAddLedger, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <Box>
      <ListItem sx={{ pl: depth * 2 + 1, cursor: 'pointer', bgcolor: depth === 0 ? 'grey.100' : 'transparent' }} onClick={() => setOpen(!open)}>
        <ListItemIcon sx={{ minWidth: 32 }}>{open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}</ListItemIcon>
        <ListItemText
          primary={<Typography variant={depth === 0 ? 'subtitle1' : 'body2'} fontWeight={depth === 0 ? 'bold' : 'medium'}>{group.name}</Typography>}
          secondary={group.name_bn}
        />
        <Chip label={NATURE_LABELS[group.nature]} color={NATURE_COLORS[group.nature]} size="small" sx={{ mr: 1 }} />
        <Button size="small" startIcon={<Add />} onClick={(e) => { e.stopPropagation(); onAddLedger(group); }}>Add Ledger</Button>
      </ListItem>

      <Collapse in={open}>
        {(group.children || []).map((child) => (
          <GroupNode key={child.id} group={child} onEditLedger={onEditLedger} onAddLedger={onAddLedger} depth={depth + 1} />
        ))}
        {(group.ledgers || []).map((l) => (
          <ListItem key={l.id} sx={{ pl: (depth + 1) * 2 + 1 }}>
            <ListItemIcon sx={{ minWidth: 32 }}><Description fontSize="small" color="action" /></ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2">{l.name}</Typography>}
              secondary={l.name_bn}
            />
            <Typography variant="body2" fontWeight="bold" sx={{ mr: 2 }}>
              {fmt(l.current_balance)} {l.balance_type}
            </Typography>
            <IconButton size="small" onClick={() => onEditLedger(l)}><Edit fontSize="small" /></IconButton>
          </ListItem>
        ))}
      </Collapse>
      <Divider />
    </Box>
  );
}

export default function ChartOfAccounts() {
  const [coa, setCoa] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editLedger, setEditLedger] = useState(null);
  const [preselectedGroup, setPreselectedGroup] = useState(null);
  const [form, setForm] = useState({ group_id: '', name: '', name_bn: '', code: '', opening_balance: 0, opening_type: 'Dr', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/erp/chart-of-accounts'),
      api.get('/erp/ledgers', { params: { limit: 500 } }),
      api.get('/erp/ledger-groups'),
    ]).then(([coaRes, ledRes, grpRes]) => {
      setCoa(coaRes.data.data || []);
      setLedgers(ledRes.data.data || []);
      setGroups(grpRes.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = (group = null) => {
    setEditLedger(null);
    setPreselectedGroup(group);
    setForm({ group_id: group?.id || '', name: '', name_bn: '', code: '', opening_balance: 0, opening_type: 'Dr', notes: '' });
    setError(''); setDialog(true);
  };

  const openEdit = (ledger) => {
    setEditLedger(ledger);
    setForm({ group_id: ledger.group_id, name: ledger.name, name_bn: ledger.name_bn || '', code: ledger.code || '', opening_balance: ledger.opening_balance, opening_type: ledger.opening_type, notes: ledger.notes || '' });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.group_id) { setError('Name and Group are required'); return; }
    setSaving(true); setError('');
    try {
      if (editLedger) await api.put(`/erp/ledgers/${editLedger.id}`, form);
      else await api.post('/erp/ledgers', { ...form, group_id: Number(form.group_id), opening_balance: Number(form.opening_balance) });
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ledger?')) return;
    try { await api.delete(`/erp/ledgers/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error?.message || 'Cannot delete'); }
  };

  const filtered = ledgers.filter((l) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Chart of Accounts</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => openAdd()}>New Ledger</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Account Tree" icon={<AccountTree />} iconPosition="start" />
        <Tab label="Ledger List" icon={<Description />} iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <Paper>
          {loading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box> : (
            <List dense>
              {coa.map((group) => (
                <GroupNode key={group.id} group={group} onEditLedger={openEdit} onAddLedger={openAdd} />
              ))}
            </List>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <>
          <Box sx={{ mb: 2 }}>
            <TextField size="small" placeholder="Search ledger..." value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }} />
          </Box>
          <Paper>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Code','Name','Group','Nature','Opening','Current Balance',''].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#666' }}>{l.code || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500 }}>{l.name}<br/><span style={{ fontSize: 11, color: '#888' }}>{l.name_bn}</span></td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{l.group_name}</td>
                      <td style={{ padding: '8px 12px' }}><Chip label={NATURE_LABELS[l.nature]} color={NATURE_COLORS[l.nature]} size="small" /></td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{fmt(l.opening_balance)} {l.opening_type}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 'bold' }}>{fmt(l.current_balance)} {l.balance_type}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <IconButton size="small" onClick={() => openEdit(l)}><Edit fontSize="small" /></IconButton>
                        {!l.is_system && <IconButton size="small" color="error" onClick={() => handleDelete(l.id)}><Delete fontSize="small" /></IconButton>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </>
      )}

      {/* Add/Edit Ledger Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editLedger ? 'Edit Ledger' : 'Create New Ledger'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Ledger Group *</InputLabel>
                <Select value={form.group_id} label="Ledger Group *" onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                  {groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {' '.repeat((g.parent_id ? 4 : 0))}{g.name} — <em style={{ fontSize: 11 }}>{g.nature}</em>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Ledger Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth size="small" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Name (Bengali)" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Opening Balance" type="number" value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={form.opening_type} label="Type" onChange={(e) => setForm({ ...form, opening_type: e.target.value })}>
                  <MenuItem value="Dr">Debit (Dr)</MenuItem>
                  <MenuItem value="Cr">Credit (Cr)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
