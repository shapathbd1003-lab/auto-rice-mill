import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, CardActionArea, useMediaQuery, useTheme, Stack, Chip,
} from '@mui/material';
import { Add, Edit, Delete, AccountTree, Inventory2, Scale, CenterFocusStrong, ReceiptLong } from '@mui/icons-material';
import api from '../../services/api';

const MASTER_TYPES = [
  { key:'ledger-groups',  label:'Ledger Groups',  icon:<AccountTree/>,       apiPath:'/erp/ledger-groups',         deletePath:'/erp/ledger-groups' },
  { key:'ledgers',        label:'Ledgers',         icon:<AccountTree/>,       apiPath:'/erp/ledgers',               deletePath:'/erp/ledgers' },
  { key:'stock-groups',   label:'Stock Groups',    icon:<Inventory2/>,        apiPath:'/v2/masters/stock-groups',   deletePath:'/v2/masters/stock-groups' },
  { key:'units',          label:'Units',           icon:<Scale/>,             apiPath:'/v2/masters/units',          deletePath:'/v2/masters/units' },
  { key:'cost-centers',   label:'Cost Centers',    icon:<CenterFocusStrong/>, apiPath:'/v2/masters/cost-centers',   deletePath:'/v2/masters/cost-centers' },
  { key:'voucher-types',  label:'Voucher Types',   icon:<ReceiptLong/>,       apiPath:'/v2/masters/voucher-types',  deletePath:'/v2/masters/voucher-types' },
];

export default function Masters() {
  const { type } = useParams();
  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const master = MASTER_TYPES.find((m) => m.key === type);

  const load = useCallback(() => {
    if (!master) return;
    setLoading(true);
    api.get(master.apiPath, { params:{ limit:500 } })
      .then((r) => setRows(r.data.data || []))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); setForm({}); setEditRow(null); }, [load]);

  if (!type) {
    return (
      <Box>
        <Typography variant="h5" fontWeight="bold" sx={{ mb:3 }}>Masters</Typography>
        <Grid container spacing={2}>
          {MASTER_TYPES.map((m) => (
            <Grid item xs={6} sm={4} key={m.key}>
              <Card>
                <CardActionArea onClick={() => navigate(`/masters/${m.key}`)} sx={{ p:2 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                    <Box sx={{ color:'#1B5E20' }}>{m.icon}</Box>
                    <Typography fontWeight="bold" variant="body2">{m.label}</Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!master) return <Alert severity="error">Unknown master type: {type}</Alert>;

  const openAdd = () => { setEditRow(null); setForm({}); setError(''); setDialog(true); };
  const openEdit = (row) => {
    setEditRow(row);
    setForm({ name: row.name, abbreviation: row.abbreviation, prefix: row.prefix, nature: row.nature, parent_id: row.parent_id });
    setError(''); setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (editRow) {
        await api.put(`${master.apiPath}/${editRow.id}`, form);
      } else {
        await api.post(master.apiPath, form);
      }
      setDialog(false); setForm({}); setEditRow(null); load();
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`${master.deletePath}/${id}`);
      setDeleteConfirm(null); load();
    } catch(e) { alert(e.response?.data?.error?.message || 'Cannot delete — may have dependencies'); }
  };

  const DISPLAY_COLS = {
    'ledger-groups': ['name','nature','parent_name'],
    'ledgers':       ['name','group_name','nature','current_balance','balance_type'],
    'stock-groups':  ['name','parent_name'],
    'units':         ['name','abbreviation'],
    'cost-centers':  ['name','parent_name'],
    'voucher-types': ['name','abbreviation','nature'],
  };
  const cols = DISPLAY_COLS[type] || ['name'];

  return (
    <Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ cursor:'pointer' }} onClick={() => navigate('/masters')}>
            ← Masters
          </Typography>
          <Typography variant="h5" fontWeight="bold">{master.label}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add/>} onClick={openAdd} sx={{ bgcolor:'#1B5E20' }}>
          {isMobile ? 'Add' : `Add ${master.label}`}
        </Button>
      </Box>

      {/* Mobile: cards */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign:'center', py:3 }}><CircularProgress size={24}/></Box>}
          {!loading && rows.length === 0 && <Paper sx={{ p:3, textAlign:'center', color:'text.secondary' }}>No {master.label} found</Paper>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb:1 }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <Box sx={{ flex:1 }}>
                    <Typography fontWeight="bold" variant="body2">{row.name}</Typography>
                    {row.nature && <Chip label={row.nature} size="small" sx={{ mt:0.5 }}/>}
                    {row.parent_name && <Typography variant="caption" color="text.secondary" display="block">{row.parent_name}</Typography>}
                    {row.abbreviation && <Typography variant="caption" color="text.secondary">({row.abbreviation})</Typography>}
                  </Box>
                  <Box sx={{ display:'flex', gap:0.5 }}>
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small"/></IconButton>
                    {!row.is_system && <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}><Delete fontSize="small"/></IconButton>}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop: table */
        <Paper sx={{ overflowX:'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow sx={{ bgcolor:'grey.100' }}>
                {cols.map((c) => <TableCell key={c} sx={{ fontWeight:'bold', textTransform:'capitalize', whiteSpace:'nowrap' }}>{c.replace(/_/g,' ')}</TableCell>)}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? <TableRow><TableCell colSpan={cols.length+1} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                : rows.length === 0
                ? <TableRow><TableCell colSpan={cols.length+1} align="center" sx={{ color:'text.secondary', py:4 }}>No {master.label} found. Click Add to create one.</TableCell></TableRow>
                : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {cols.map((c) => (
                      <TableCell key={c}>
                        {typeof row[c] === 'boolean' ? (row[c] ? 'Yes' : 'No') : (row[c] || '—')}
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small"/></IconButton>
                      {!row.is_system && <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}><Delete fontSize="small"/></IconButton>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editRow ? `Edit ${master.label}` : `Add ${master.label}`}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Name *" value={form.name||''} autoFocus
                onChange={(e) => setForm({...form, name:e.target.value})} />
            </Grid>
            {(type === 'units') && (
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Abbreviation *" value={form.abbreviation||''}
                  onChange={(e) => setForm({...form, abbreviation:e.target.value})} />
              </Grid>
            )}
            {type === 'ledger-groups' && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Nature *</InputLabel>
                    <Select value={form.nature||'assets'} label="Nature *" onChange={(e) => setForm({...form, nature:e.target.value, parent_id:null})}>
                      {['assets','liabilities','income','expenses','capital'].map((n) => <MenuItem key={n} value={n} sx={{ textTransform:'capitalize' }}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Parent Group</InputLabel>
                    <Select value={form.parent_id||''} label="Parent Group" onChange={(e) => setForm({...form, parent_id:e.target.value||null})}>
                      <MenuItem value="">None</MenuItem>
                      {rows.filter((r) => r.nature===form.nature && r.id !== editRow?.id).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            {(type === 'stock-groups' || type === 'cost-centers') && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Parent (optional)</InputLabel>
                  <Select value={form.parent_id||''} label="Parent (optional)" onChange={(e) => setForm({...form, parent_id:e.target.value||null})}>
                    <MenuItem value="">None</MenuItem>
                    {rows.filter((r) => r.id !== editRow?.id).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {type === 'voucher-types' && (
              <>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Abbreviation *" value={form.abbreviation||''}
                    onChange={(e) => setForm({...form, abbreviation:e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Prefix" value={form.prefix||''}
                    onChange={(e) => setForm({...form, prefix:e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Nature *</InputLabel>
                    <Select value={form.nature||'journal'} label="Nature *" onChange={(e) => setForm({...form, nature:e.target.value})}>
                      {['payment','receipt','contra','journal','purchase','sales','debit_note','credit_note','stock_transfer','production','consumption'].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving||!form.name} sx={{ bgcolor:'#1B5E20' }}>
            {saving ? <CircularProgress size={20}/> : editRow ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete {master.label}?</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm?.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
