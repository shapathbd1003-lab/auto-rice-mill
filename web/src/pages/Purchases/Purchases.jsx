import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Pagination, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TextField, Autocomplete, CircularProgress,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import api from '../../services/api';

export default function Purchases() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [paddyItems, setPaddyItems] = useState([]);
  const [form, setForm] = useState({ supplierId: null, vehicleId: null, date: new Date().toISOString().slice(0, 10), grossWeight: '', tareWeight: '', moisturePct: '', unitPrice: '', transportCost: 0, otherCost: 0, paidAmount: 0, paddyItemId: null, notes: '' });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const netWeight = Math.max(0, (Number(form.grossWeight) || 0) - (Number(form.tareWeight) || 0));
  const totalAmount = netWeight * (Number(form.unitPrice) || 0) + Number(form.transportCost || 0) + Number(form.otherCost || 0);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/purchases', { params: { page, limit } }).then((r) => { setRows(r.data.data); setTotal(r.data.pagination.total); }).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } }).then((r) => setSuppliers(r.data.data));
    api.get('/vehicles').then((r) => setVehicles(r.data.data));
    api.get('/inventory/stock').then((r) => setPaddyItems(r.data.data.filter((i) => i.category === 'paddy')));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/purchases', { ...form, netWeight: netWeight.toFixed(3), totalAmount: totalAmount.toFixed(2) });
      setFormOpen(false); load();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('purchase.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>{t('purchase.addNew')}</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('purchase.invoice')}</TableCell>
              <TableCell>{t('common.date')}</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell align="right">Net Weight (kg)</TableCell>
              <TableCell align="right">Total ৳</TableCell>
              <TableCell align="right">Paid ৳</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography fontWeight="bold">{row.invoice_number}</Typography></TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.supplier_name}</TableCell>
                  <TableCell align="right">{Number(row.net_weight || 0).toLocaleString()}</TableCell>
                  <TableCell align="right">৳ {Number(row.total_amount).toLocaleString()}</TableCell>
                  <TableCell align="right">৳ {Number(row.paid_amount).toLocaleString()}</TableCell>
                  <TableCell><Chip label={row.status} size="small" color={row.status === 'received' ? 'success' : 'default'} /></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" />
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('purchase.addNew')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <Autocomplete size="small" options={suppliers} getOptionLabel={(o) => `${o.code} - ${o.name}`}
                onChange={(_, v) => setForm({ ...form, supplierId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label="Supplier *" />} />
            </Grid>
            <Grid item xs={3}>
              <TextField fullWidth size="small" label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={3}>
              <Autocomplete size="small" options={vehicles} getOptionLabel={(o) => o.number}
                onChange={(_, v) => setForm({ ...form, vehicleId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label="Vehicle" />} />
            </Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label={t('purchase.grossWeight')} type="number" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label={t('purchase.tareWeight')} type="number" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label="Net Weight (kg)" value={netWeight.toFixed(3)} InputProps={{ readOnly: true }} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label={t('purchase.moisture')} type="number" value={form.moisturePct} onChange={(e) => setForm({ ...form, moisturePct: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label={t('purchase.unitPrice')} type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label={t('purchase.transport')} type="number" value={form.transportCost} onChange={(e) => setForm({ ...form, transportCost: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label="Other Cost" type="number" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} /></Grid>
            <Grid item xs={3}><TextField fullWidth size="small" label="Paid Amount ৳" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></Grid>
            <Grid item xs={3}>
              <Autocomplete size="small" options={paddyItems} getOptionLabel={(o) => o.name}
                onChange={(_, v) => setForm({ ...form, paddyItemId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label="Add to Paddy Stock" />} />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography>Net: {netWeight.toFixed(3)} kg | <strong>Total: ৳ {totalAmount.toFixed(2)}</strong> | Due: ৳ {Math.max(0, totalAmount - Number(form.paidAmount || 0)).toFixed(2)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={20} /> : t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
