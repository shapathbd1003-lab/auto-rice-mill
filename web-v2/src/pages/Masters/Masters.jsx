import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, CardActionArea,
} from '@mui/material';
import { Add, Edit, Delete, AccountTree, Inventory2, Scale, Warehouse, CenterFocusStrong, ReceiptLong } from '@mui/icons-material';
import api from '../../services/api';

const MASTER_TYPES = [
  { key:'ledger-groups',  label:'Ledger Groups',  icon:<AccountTree/>,       apiPath:'/erp/ledger-groups' },
  { key:'ledgers',        label:'Ledgers',         icon:<AccountTree/>,       apiPath:'/erp/ledgers' },
  { key:'stock-groups',   label:'Stock Groups',    icon:<Inventory2/>,        apiPath:'/v2/masters/stock-groups' },
  { key:'units',          label:'Units',           icon:<Scale/>,             apiPath:'/v2/masters/units' },
  { key:'cost-centers',   label:'Cost Centers',    icon:<CenterFocusStrong/>, apiPath:'/v2/masters/cost-centers' },
  { key:'voucher-types',  label:'Voucher Types',   icon:<ReceiptLong/>,       apiPath:'/v2/masters/voucher-types' },
];

export default function Masters() {
  const { type } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const master = MASTER_TYPES.find((m) => m.key === type);

  const load = useCallback(() => {
    if (!master) return;
    setLoading(true);
    api.get(master.apiPath, { params:{ limit:500 } })
      .then((r) => setRows(r.data.data || []))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); setForm({}); }, [load]);

  if (!type) {
    return (
      <Box>
        <Typography variant="h5" fontWeight="bold" sx={{ mb:3 }}>Masters</Typography>
        <Grid container spacing={2}>
          {MASTER_TYPES.map((m) => (
            <Grid item xs={12} sm={6} md={4} key={m.key}>
              <Card>
                <CardActionArea onClick={() => navigate(`/masters/${m.key}`)} sx={{ p:2 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                    <Box sx={{ color:'#1B5E20' }}>{m.icon}</Box>
                    <Typography fontWeight="bold">{m.label}</Typography>
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

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api.post(master.apiPath, form);
      setDialog(false); setForm({}); load();
    } catch(e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const DISPLAY_COLS = {
    'ledger-groups': ['name','nature','parent_name'],
    'ledgers':       ['name','group_name','nature','current_balance','balance_type'],
    'stock-groups':  ['name','parent_name'],
    'units':         ['name','abbreviation'],
    'cost-centers':  ['name','parent_name'],
    'voucher-types': ['name','abbreviation','nature','affects_stock','affects_ledger'],
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
        <Button variant="contained" startIcon={<Add/>} onClick={() => { setForm({}); setError(''); setDialog(true); }}
          sx={{ bgcolor:'#1B5E20' }}>
          Add New
        </Button>
      </Box>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor:'grey.100' }}>
              {cols.map((c) => <TableCell key={c} sx={{ fontWeight:'bold', textTransform:'capitalize' }}>{c.replace(/_/g,' ')}</TableCell>)}
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? <TableRow><TableCell colSpan={cols.length+1} align="center"><CircularProgress size={24}/></TableCell></TableRow>
              : rows.length === 0
              ? <TableRow><TableCell colSpan={cols.length+1} align="center" sx={{ color:'text.secondary', py:4 }}>No {master.label} found. Add one to get started.</TableCell></TableRow>
              : rows.map((row) => (
                <TableRow key={row.id} hover>
                  {cols.map((c) => (
                    <TableCell key={c}>
                      {typeof row[c] === 'boolean' ? (row[c] ? 'Yes' : 'No') : (row[c] || '—')}
                    </TableCell>
                  ))}
                  <TableCell align="center">
                    <IconButton size="small"><Edit fontSize="small"/></IconButton>
                    {!row.is_system && <IconButton size="small" color="error"><Delete fontSize="small"/></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add {master.label}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Name *" value={form.name||''} autoFocus
                onChange={(e) => setForm({...form, name:e.target.value})} />
            </Grid>
            {type === 'units' && (
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
                    <Select value={form.nature||'assets'} label="Nature *" onChange={(e) => setForm({...form, nature:e.target.value})}>
                      {['assets','liabilities','income','expenses','capital'].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Parent Group</InputLabel>
                    <Select value={form.parent_id||''} label="Parent Group" onChange={(e) => setForm({...form, parent_id:e.target.value||null})}>
                      <MenuItem value="">None</MenuItem>
                      {rows.filter((r) => r.nature===form.nature).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
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
                    {rows.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {type === 'voucher-types' && (
              <>
                <Grid item xs={4}>
                  <TextField fullWidth size="small" label="Abbreviation *" value={form.abbreviation||''}
                    onChange={(e) => setForm({...form, abbreviation:e.target.value})} />
                </Grid>
                <Grid item xs={4}>
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
            {saving ? <CircularProgress size={20}/> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
