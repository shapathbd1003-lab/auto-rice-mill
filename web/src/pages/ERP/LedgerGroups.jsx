import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Grid, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Table, TableBody,
  TableCell, TableHead, TableRow, Divider,
} from '@mui/material';
import { Add, Edit, Delete, AccountTree } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const NATURE_OPTIONS = [
  { value:'assets',      label:'Assets',      color:'primary' },
  { value:'liabilities', label:'Liabilities', color:'error'   },
  { value:'income',      label:'Income',      color:'success' },
  { value:'expenses',    label:'Expenses',    color:'warning' },
  { value:'capital',     label:'Capital',     color:'secondary'},
];

const GROUP_TYPE_OPTIONS = [
  { value:'general',  label:'General' },
  { value:'customer', label:'Customer Khata' },
  { value:'supplier', label:'Supplier Khata' },
  { value:'employee', label:'Employee Khata' },
  { value:'bank',     label:'Bank Khata'     },
  { value:'loan',     label:'Loan Khata'     },
];

export default function LedgerGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [form, setForm] = useState({ name:'', name_bn:'', nature:'assets', parent_id:'', group_type:'general', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/erp/khata/groups')
      .then((r) => setGroups(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditGroup(null);
    setForm({ name:'', name_bn:'', nature:'assets', parent_id:'', group_type:'general', description:'' });
    setError(''); setDialog(true);
  };

  const openEdit = (g) => {
    setEditGroup(g);
    setForm({ name:g.name, name_bn:g.name_bn||'', nature:g.nature, parent_id:g.parent_id||'', group_type:g.group_type||'general', description:g.description||'' });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.nature) { setError('Name and Nature are required'); return; }
    setSaving(true); setError('');
    try {
      if (editGroup) {
        await api.put(`/erp/ledger-groups/${editGroup.id}`, { name:form.name, name_bn:form.name_bn, parent_id:form.parent_id||null });
      } else {
        await api.post('/erp/ledger-groups', { ...form, parent_id: form.parent_id||null });
      }
      setDialog(false); load();
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this group? All ledgers must be removed first.')) return;
    try { await api.delete(`/erp/ledger-groups/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error?.message || 'Cannot delete'); }
  };

  const grouped = NATURE_OPTIONS.map((n) => ({
    ...n,
    groups: groups.filter((g) => g.nature === n.value),
  }));

  return (
    <Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
        <Typography variant="h5" fontWeight="bold">Ledger Groups</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>New Group</Button>
      </Box>
      <Alert severity="info" sx={{ mb:2 }}>
        Create any custom Khata group here. Example: "Machine Maintenance Khata", "Dealer Khata", "Agent Khata" — no code changes needed.
      </Alert>

      {loading ? <Box sx={{ textAlign:'center', mt:4 }}><CircularProgress /></Box> : (
        <Grid container spacing={2}>
          {grouped.map(({ value:nature, label, color, groups:grps }) => (
            <Grid item xs={12} md={6} key={nature}>
              <Paper>
                <Box sx={{ p:1.5, display:'flex', justifyContent:'space-between', alignItems:'center', bgcolor:`${color}.50`||'grey.50' }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                    <AccountTree fontSize="small" color={color} />
                    <Typography variant="subtitle1" fontWeight="bold">{label}</Typography>
                  </Box>
                  <Chip label={`${grps.length} groups`} size="small" color={color} variant="outlined" />
                </Box>
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor:'grey.50' }}>
                      <TableCell>Group Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Ledgers</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grps.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ color:'text.secondary', py:2 }}>No groups</TableCell></TableRow>
                    ) : grps.map((g) => (
                      <TableRow key={g.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium"
                            sx={{ cursor:'pointer', color:'primary.main', '&:hover':{ textDecoration:'underline' } }}
                            onClick={() => navigate(`/erp/khata/${g.id}`, { state:{ group:g } })}>
                            {g.name}
                          </Typography>
                          {g.name_bn && <Typography variant="caption" color="text.secondary">{g.name_bn}</Typography>}
                          {g.parent_name && <Typography variant="caption" display="block" color="text.disabled">↳ {g.parent_name}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip label={GROUP_TYPE_OPTIONS.find((t) => t.value===g.group_type)?.label || g.group_type}
                            size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{g.ledger_count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight:'bold' }}>
                          ৳ {Number(g.total_balance).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell align="center">
                          {!g.is_system && <IconButton size="small" onClick={() => openEdit(g)}><Edit fontSize="small" /></IconButton>}
                          {!g.is_system && <IconButton size="small" color="error" onClick={() => handleDelete(g.id)}><Delete fontSize="small" /></IconButton>}
                          {g.is_system && <Chip label="System" size="small" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editGroup ? `Edit: ${editGroup.name}` : 'Create New Ledger Group'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mb:2 }}>
            You can create any custom group — e.g. "Machine Maintenance Khata", "Transport Contractor Khata". No developer needed.
          </Alert>
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Group Name *" value={form.name}
                onChange={(e) => setForm({ ...form, name:e.target.value })}
                placeholder="e.g. Machine Maintenance Khata" />
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small" disabled={!!editGroup}>
                <InputLabel>Nature *</InputLabel>
                <Select value={form.nature} label="Nature *" onChange={(e) => setForm({ ...form, nature:e.target.value })}>
                  {NATURE_OPTIONS.map((n) => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Group Name (Bengali)" value={form.name_bn}
                onChange={(e) => setForm({ ...form, name_bn:e.target.value })} />
            </Grid>
            {!editGroup && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Group Type</InputLabel>
                    <Select value={form.group_type} label="Group Type" onChange={(e) => setForm({ ...form, group_type:e.target.value })}>
                      {GROUP_TYPE_OPTIONS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Parent Group</InputLabel>
                    <Select value={form.parent_id} label="Parent Group" onChange={(e) => setForm({ ...form, parent_id:e.target.value })}>
                      <MenuItem value="">None (root level)</MenuItem>
                      {groups.filter((g) => g.nature === form.nature).map((g) => (
                        <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description (optional)" value={form.description}
                onChange={(e) => setForm({ ...form, description:e.target.value })} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editGroup ? 'Update Group' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
