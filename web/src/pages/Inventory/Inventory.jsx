import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, MenuItem, LinearProgress, CircularProgress,
} from '@mui/material';
import { Add, Tune } from '@mui/icons-material';
import api from '../../services/api';

const CATEGORIES = ['paddy', 'rice', 'bran', 'husk', 'broken_rice', 'packaging'];

export default function Inventory() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', name_bn: '', category: 'rice', unit: 'kg', reorder_level: 0, sale_price: '' });
  const [adjustForm, setAdjustForm] = useState({ quantity: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/inventory/stock').then((r) => setItems(r.data.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true);
    try { await api.post('/inventory/items', form); setAddOpen(false); load(); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    setSaving(true);
    try { await api.post('/inventory/stock/adjust', { itemId: selectedItem.id, ...adjustForm }); setAdjustOpen(false); load(); }
    finally { setSaving(false); }
  };

  const stockPct = (item) => item.reorder_level > 0 ? Math.min(100, (item.current_stock / (item.reorder_level * 3)) * 100) : 100;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('inventory.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add Item</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.code')}</TableCell>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('inventory.category')}</TableCell>
              <TableCell align="right">{t('inventory.currentStock')}</TableCell>
              <TableCell sx={{ width: 120 }}>{t('inventory.reorderLevel')}</TableCell>
              <TableCell align="right">Sale Price ৳</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              : items.map((row) => (
                <TableRow key={row.id} hover sx={{ bgcolor: row.low_stock ? '#fff8e1' : 'inherit' }}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{row.name}</Typography>
                    {row.name_bn && <Typography variant="caption" display="block">{row.name_bn}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={row.category} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold" color={row.low_stock ? 'error.main' : 'inherit'}>
                      {Number(row.current_stock).toLocaleString()} {row.unit}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={stockPct(row)} color={row.low_stock ? 'error' : 'success'} sx={{ height: 6, borderRadius: 3 }} />
                    <Typography variant="caption">{row.reorder_level} {row.unit}</Typography>
                  </TableCell>
                  <TableCell align="right">{row.sale_price ? `৳ ${row.sale_price}` : '—'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => { setSelectedItem(row); setAdjustForm({ quantity: 0, notes: '' }); setAdjustOpen(true); }}>
                      <Tune fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Inventory Item</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}><TextField fullWidth size="small" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Name (EN)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="নাম (বাংলা)" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} /></Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {['kg', 'bag', 'piece', 'liter'].map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Sale Price ৳" type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust Stock — {selectedItem?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>Current: <strong>{selectedItem?.current_stock} {selectedItem?.unit}</strong></Typography>
          <TextField fullWidth label="Adjustment (+/-)" type="number" value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} sx={{ mb: 2 }} helperText="Use positive to add, negative to deduct" />
          <TextField fullWidth label="Notes" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdjust} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Adjust'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
