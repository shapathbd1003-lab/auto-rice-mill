import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, TextField, MenuItem, Autocomplete, CircularProgress,
  useMediaQuery, useTheme, Card, CardContent, Stack,
} from '@mui/material';
import { Add, CheckCircle, Visibility } from '@mui/icons-material';
import api from '../../services/api';

const OUTPUT_TYPES = ['rice', 'bran', 'husk', 'broken_rice'];

export default function Production() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [paddyItems, setPaddyItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), paddyQuantity: '', paddySource: 'stock', paddyItemId: null });
  const [outputs, setOutputs] = useState(OUTPUT_TYPES.map((type) => ({ productType: type, quantity: 0, itemId: null })));
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/production/batches').then((r) => setRows(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/inventory/stock').then((r) => {
      const all = r.data.data || [];
      setAllItems(all);
      setPaddyItems(all.filter((i) => i.category === 'paddy'));
    });
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try { await api.post('/production/batches', form); setFormOpen(false); load(); }
    finally { setSaving(false); }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api.post(`/production/batches/${selected.id}/complete`, { outputs: outputs.filter((o) => o.quantity > 0 && o.itemId) });
      setCompleteOpen(false); load();
    } finally { setSaving(false); }
  };

  const statusColor = { in_progress: 'warning', completed: 'success', cancelled: 'error' };
  const totalOutput = outputs.reduce((s, o) => s + Number(o.quantity || 0), 0);
  const yieldPct = selected?.paddy_quantity > 0 ? ((totalOutput / selected.paddy_quantity) * 100).toFixed(1) : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('production.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? t('common.new') : t('production.newBatch')}
        </Button>
      </Box>

      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography fontWeight="bold">{row.batch_number}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.date}</Typography>
                    <Typography variant="body2">{Number(row.paddy_quantity).toLocaleString()} {t('unit.kg')}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={row.status.replace('_', ' ')} color={statusColor[row.status]} size="small" />
                    {row.status === 'in_progress' && (
                      <IconButton size="small" color="success" sx={{ display: 'block', ml: 'auto', mt: 1 }}
                        onClick={() => { setSelected(row); setOutputs(OUTPUT_TYPES.map((type) => ({ productType: type, quantity: 0, itemId: null }))); setCompleteOpen(true); }}>
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('production.batchNo')}</TableCell>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell align="right">{t('production.paddyQty')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={5} align="center">{t('common.noData')}</TableCell></TableRow>
                : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Typography fontWeight="bold">{row.batch_number}</Typography></TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell align="right">{Number(row.paddy_quantity).toLocaleString()} {t('unit.kg')}</TableCell>
                    <TableCell><Chip label={row.status.replace('_', ' ')} color={statusColor[row.status]} size="small" /></TableCell>
                    <TableCell align="center">
                      {row.status === 'in_progress' && (
                        <IconButton size="small" color="success"
                          onClick={() => { setSelected(row); setOutputs(OUTPUT_TYPES.map((type) => ({ productType: type, quantity: 0, itemId: null }))); setCompleteOpen(true); }}>
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* New Batch Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('production.newBatch')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label={t('common.date')} type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label={t('production.paddyQty')} type="number"
                value={form.paddyQuantity} onChange={(e) => setForm({ ...form, paddyQuantity: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" select label={t('production.fromStock')} value={form.paddySource}
                onChange={(e) => setForm({ ...form, paddySource: e.target.value })}>
                <MenuItem value="stock">{t('production.fromStock')}</MenuItem>
                <MenuItem value="direct_purchase">{t('production.directPurchase')}</MenuItem>
              </TextField>
            </Grid>
            {form.paddySource === 'stock' && (
              <Grid item xs={6}>
                <Autocomplete size="small" options={paddyItems}
                  getOptionLabel={(o) => `${o.name} (${o.current_stock} ${t('unit.kg')})`}
                  onChange={(_, v) => setForm({ ...form, paddyItemId: v?.id || null })}
                  renderInput={(p) => <TextField {...p} label={t('production.paddyStockItem')} />} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('production.createBatch')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Batch Dialog */}
      <Dialog open={completeOpen} onClose={() => setCompleteOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('production.completeBatch')} — {selected?.batch_number}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('production.paddyQty')}: <strong>{selected?.paddy_quantity} {t('unit.kg')}</strong>
          </Typography>
          {outputs.map((out, i) => (
            <Box key={out.productType} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <Typography sx={{ width: 90, fontSize: 13 }}>{t(`production.${out.productType}`) || out.productType}</Typography>
              <TextField size="small" label={t('production.qtyKg')} type="number" value={out.quantity} sx={{ flex: 1 }}
                onChange={(e) => { const o = [...outputs]; o[i].quantity = Number(e.target.value); setOutputs(o); }} />
              <Autocomplete size="small" sx={{ flex: 2 }}
                options={allItems.filter((x) => x.category === out.productType || x.name.toLowerCase().includes(out.productType.split('_')[0]))}
                getOptionLabel={(o) => o.name}
                onChange={(_, v) => { const o = [...outputs]; o[i].itemId = v?.id || null; setOutputs(o); }}
                renderInput={(p) => <TextField {...p} label={t('production.stockItem')} />} />
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            {t('production.totalOutput')}: {totalOutput.toFixed(1)} {t('unit.kg')} | {t('production.yield')}: {yieldPct}%
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="success" onClick={handleComplete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('production.completeBatch')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
