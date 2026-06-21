import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, Pagination, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TextField, Autocomplete, CircularProgress,
  useMediaQuery, useTheme, Card, CardContent, Stack,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../../services/api';

export default function Purchases() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [paddyItems, setPaddyItems] = useState([]);
  const [form, setForm] = useState({
    supplierId: null, vehicleId: null,
    date: new Date().toISOString().slice(0, 10),
    grossWeight: '', tareWeight: '', moisturePct: '', unitPrice: '',
    transportCost: 0, otherCost: 0, paidAmount: 0, paddyItemId: null, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const netWeight  = Math.max(0, (Number(form.grossWeight) || 0) - (Number(form.tareWeight) || 0));
  const subtotal   = netWeight * (Number(form.unitPrice) || 0);
  const totalAmount = subtotal + Number(form.transportCost || 0) + Number(form.otherCost || 0);
  const dueAmount  = Math.max(0, totalAmount - Number(form.paidAmount || 0));

  const load = useCallback(() => {
    setLoading(true);
    api.get('/purchases', { params: { page, limit } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } }).then((r) => setSuppliers(r.data.data || []));
    api.get('/vehicles').then((r) => setVehicles(r.data.data || []));
    api.get('/inventory/stock').then((r) => setPaddyItems((r.data.data || []).filter((i) => i.category === 'paddy')));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/purchases', { ...form, netWeight: netWeight.toFixed(3), totalAmount: totalAmount.toFixed(2) });
      setFormOpen(false); load();
    } finally { setSaving(false); }
  };

  const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

  const statusColor = (s) => ({ received: 'success', pending: 'default', cancelled: 'error' }[s] || 'default');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('purchase.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? t('common.new') : t('purchase.addNew')}
        </Button>
      </Box>

      {/* Mobile: cards */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && rows.length === 0 && <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>{t('common.noData')}</Paper>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography fontWeight="bold" variant="body2">{row.invoice_number}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.supplier_name}</Typography>
                    <Typography variant="caption" display="block" color="text.disabled">{row.date}</Typography>
                    <Typography variant="body2">{t('purchase.netWeight')}: {Number(row.net_weight || 0).toLocaleString()} {t('unit.kg')}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontWeight="bold" color="primary.main">{fmt(row.total_amount)}</Typography>
                    <Typography variant="caption" color="success.main">{t('common.paid')}: {fmt(row.paid_amount)}</Typography>
                    {row.due_amount > 0 && <Typography variant="caption" display="block" color="error.main">{t('common.due')}: {fmt(row.due_amount)}</Typography>}
                    <Chip label={t(`common.${row.status}`) || row.status} size="small" color={statusColor(row.status)} sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop: table */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('purchase.invoice')}</TableCell>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('common.supplier')}</TableCell>
                <TableCell align="right">{t('purchase.netWeight')}</TableCell>
                <TableCell align="right">{t('common.total')}</TableCell>
                <TableCell align="right">{t('common.paid')}</TableCell>
                <TableCell align="right">{t('common.due')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                : rows.length === 0
                ? <TableRow><TableCell colSpan={8} align="center">{t('common.noData')}</TableCell></TableRow>
                : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Typography fontWeight="bold" variant="body2">{row.invoice_number}</Typography></TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.supplier_name}</TableCell>
                    <TableCell align="right">{Number(row.net_weight || 0).toLocaleString()} {t('unit.kg')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(row.total_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(row.paid_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: row.due_amount > 0 ? 'error.main' : 'text.secondary' }}>
                      {row.due_amount > 0 ? fmt(row.due_amount) : '—'}
                    </TableCell>
                    <TableCell><Chip label={row.status} size="small" color={statusColor(row.status)} /></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" size={isMobile ? 'small' : 'medium'} />
      </Box>

      {/* New Purchase Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('purchase.addNew')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete size="small" options={suppliers} getOptionLabel={(o) => `${o.code} - ${o.name}`}
                onChange={(_, v) => setForm({ ...form, supplierId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label={t('purchase.supplierLabel')} />} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <Autocomplete size="small" options={vehicles} getOptionLabel={(o) => o.number}
                onChange={(_, v) => setForm({ ...form, vehicleId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label={t('purchase.vehicleLabel')} />} />
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.grossWeightLabel')} type="number"
                value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.tareWeightLabel')} type="number"
                value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.netWeightLabel')} value={netWeight.toFixed(3)}
                InputProps={{ readOnly: true }} inputProps={{ style: { fontWeight: 'bold', color: '#1976d2' } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.moisture')} type="number"
                value={form.moisturePct} onChange={(e) => setForm({ ...form, moisturePct: e.target.value })} />
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.rateLabel')} type="number"
                value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.transportLabel')} type="number"
                value={form.transportCost} onChange={(e) => setForm({ ...form, transportCost: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.otherCost')} type="number"
                value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label={t('purchase.paidNowLabel')} type="number"
                value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete size="small" options={paddyItems} getOptionLabel={(o) => o.name}
                onChange={(_, v) => setForm({ ...form, paddyItemId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label={t('purchase.addToPaddyStock')} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('common.notes')} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Grid container spacing={1}>
                  {[
                    { label: t('purchase.netWeightLabel'), value: `${netWeight.toFixed(3)} ${t('unit.kg')}` },
                    { label: t('purchase.subtotalLabel'),  value: fmt(subtotal) },
                    { label: t('purchase.totalLabel'),     value: fmt(totalAmount), bold: true, color: 'primary.main' },
                    { label: t('purchase.dueLabel'),       value: fmt(dueAmount),   bold: true, color: dueAmount > 0 ? 'error.main' : 'success.main' },
                  ].map(({ label, value, bold, color }) => (
                    <Grid item xs={6} sm={3} key={label}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={bold ? 'bold' : 'normal'} color={color || 'text.primary'}>{value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
