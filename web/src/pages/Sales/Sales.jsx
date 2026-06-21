import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Pagination, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, TextField, MenuItem, Autocomplete, CircularProgress,
  useMediaQuery, useTheme, Card, CardContent, CardActions, Stack, Divider,
} from '@mui/material';
import { Add, Visibility, Payment, Delete } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

export default function Sales() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    customerId: null, date: new Date().toISOString().slice(0, 10),
    saleType: 'retail', discount: 0, paidAmount: 0, accountId: null, notes: '',
    lines: [{ itemId: null, quantity: 1, unitPrice: 0 }],
  });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sales', { params: { page, limit } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/customers', { params: { limit: 200 } }).then((r) => setCustomers(r.data.data || []));
    api.get('/inventory/stock').then((r) => setItems(r.data.data || []));
    api.get('/accounting/accounts').then((r) => setAccounts(r.data.data || []));
  }, []);

  const subtotal = form.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const totalAmount = subtotal - (form.discount || 0);
  const dueAmount = Math.max(0, totalAmount - Number(form.paidAmount || 0));

  const handleAddLine = () => setForm({ ...form, lines: [...form.lines, { itemId: null, quantity: 1, unitPrice: 0 }] });
  const handleRemoveLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });
  const updateLine = (i, key, val) => {
    const lines = [...form.lines];
    lines[i] = { ...lines[i], [key]: val };
    if (key === 'itemId') {
      const item = items.find((x) => x.id === val);
      if (item?.sale_price) lines[i].unitPrice = item.sale_price;
    }
    setForm({ ...form, lines });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/sales', {
        ...form,
        items: form.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      setFormOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const statusColor = (s) => ({ active: 'success', returned: 'warning', cancelled: 'error' }[s] || 'default');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('sales.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? 'New' : t('sales.newSale')}
        </Button>
      </Box>

      {/* Mobile: card list */}
      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && rows.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>No sales found</Paper>
          )}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography fontWeight="bold" variant="body2">{row.invoice_number}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.customer_name}</Typography>
                    <Typography variant="caption" display="block" color="text.disabled">{row.date}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontWeight="bold" variant="body1" color="primary.main">{fmt(row.total_amount)}</Typography>
                    {row.due_amount > 0 && <Chip label={`Due ${fmt(row.due_amount)}`} color="error" size="small" />}
                    <Chip label={row.status} color={statusColor(row.status)} size="small" sx={{ ml: 0.5 }} />
                  </Box>
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0, pb: 1, px: 2, justifyContent: 'flex-end' }}>
                <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                {row.due_amount > 0 && <IconButton size="small" color="primary"><Payment fontSize="small" /></IconButton>}
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        /* Desktop: table */
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography variant="body2" fontWeight="bold">{row.invoice_number}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell><Chip label={row.sale_type} size="small" /></TableCell>
                  <TableCell align="right">{fmt(row.total_amount)}</TableCell>
                  <TableCell align="right">{fmt(row.paid_amount)}</TableCell>
                  <TableCell align="right">
                    {row.due_amount > 0 ? <Chip label={fmt(row.due_amount)} color="error" size="small" /> : '—'}
                  </TableCell>
                  <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                    {row.due_amount > 0 && <IconButton size="small" color="primary"><Payment fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} color="primary" size={isMobile ? 'small' : 'medium'} />
      </Box>

      {/* New Sale Dialog — fullScreen on mobile */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('sales.newSale')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {/* Customer + Date + Type */}
            <Grid item xs={12} sm={6}>
              <Autocomplete size="small" options={customers}
                getOptionLabel={(o) => `${o.code} - ${o.name}`}
                onChange={(_, v) => setForm({ ...form, customerId: v?.id || null })}
                renderInput={(p) => <TextField {...p} label="Customer" />} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" select label="Type" value={form.saleType}
                onChange={(e) => setForm({ ...form, saleType: e.target.value })}>
                <MenuItem value="retail">Retail</MenuItem>
                <MenuItem value="wholesale">Wholesale</MenuItem>
              </TextField>
            </Grid>

            {/* Line items — stacked on mobile */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Items</Typography>
              {form.lines.map((line, i) => (
                <Box key={i} sx={{ mb: 1.5, p: 1.5, border: '1px solid #eee', borderRadius: 1 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Autocomplete size="small" options={items}
                        getOptionLabel={(o) => `${o.name} (${Number(o.current_stock).toFixed(1)} ${o.unit})`}
                        onChange={(_, v) => updateLine(i, 'itemId', v?.id || null)}
                        renderInput={(p) => <TextField {...p} label="Item" />} />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField fullWidth size="small" label="Qty" type="number" value={line.quantity}
                        onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField fullWidth size="small" label="Price ৳" type="number" value={line.unitPrice}
                        onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} />
                    </Grid>
                    <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {fmt((line.quantity || 0) * (line.unitPrice || 0))}
                      </Typography>
                    </Grid>
                    <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton size="small" onClick={() => handleRemoveLine(i)} disabled={form.lines.length === 1}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Box>
              ))}
              <Button size="small" onClick={handleAddLine} startIcon={<Add />}>Add Item</Button>
            </Grid>

            {/* Discount / Paid / Account */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Discount ৳" type="number" value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Paid Amount ৳" type="number" value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" select label="Account" value={form.accountId || ''}
                onChange={(e) => setForm({ ...form, accountId: e.target.value || null })}>
                <MenuItem value="">None</MenuItem>
                {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Grid container spacing={1}>
                  {[
                    { label: 'Subtotal', value: fmt(subtotal) },
                    { label: 'Discount', value: fmt(form.discount || 0) },
                    { label: 'Total', value: fmt(totalAmount), bold: true },
                    { label: 'Due', value: fmt(dueAmount), color: dueAmount > 0 ? 'error.main' : 'success.main' },
                  ].map(({ label, value, bold, color }) => (
                    <Grid item xs={6} sm={3} key={label}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={bold ? 'bold' : 'normal'} color={color}>{value}</Typography>
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
