import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, InputAdornment, Paper, Grid,
  List, ListItem, ListItemText, ListItemSecondaryAction, Divider, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Search, Add, ArrowUpward, ArrowDownward, ArrowBack } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function SupplierList({ onSelect, selected, refreshKey, t }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/suppliers', { params: { limit: 100, search } })
      .then((r) => setSuppliers(r.data.data || []))
      .finally(() => setLoading(false));
  }, [search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
        <TextField fullWidth size="small" placeholder={t('common.search')}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
      </Box>
      {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
        <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {suppliers.map((s) => (
            <React.Fragment key={s.id}>
              <ListItem button selected={selected?.id === s.id} onClick={() => onSelect(s)}
                sx={{ '&.Mui-selected': { bgcolor: 'warning.light' } }}>
                <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'warning.main', fontSize: 14 }}>
                  {s.name[0].toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={<Typography fontWeight="bold" variant="body2">{s.name}</Typography>}
                  secondary={s.phone || t('common.noPhone')}
                />
                <ListItemSecondaryAction>
                  {s.balance > 0
                    ? <Chip label={`${t('common.due')} ${fmt(s.balance)}`} color="warning" size="small" />
                    : <Chip label={t('common.clear')} color="default" size="small" variant="outlined" />}
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
          {suppliers.length === 0 && <ListItem><ListItemText secondary={t('supplier.noFound')} /></ListItem>}
        </List>
      )}
    </Paper>
  );
}

function SupplierLedgerPanel({ supplier, onRefresh, t }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dueDialog, setDueDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [form, setForm] = useState({ amount: '', date: today(), description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!supplier) return;
    setLoading(true);
    api.get(`/suppliers/${supplier.id}/ledger`, { params: { limit: 50 } })
      .then((r) => setLedger(r.data.data || []))
      .finally(() => setLoading(false));
  }, [supplier]);

  useEffect(() => { load(); }, [load]);

  const reset = () => setForm({ amount: '', date: today(), description: '' });

  const handleDue = async () => {
    if (!form.amount || form.amount <= 0) { setError(t('common.amount')); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/suppliers/${supplier.id}/due`, { amount: Number(form.amount), date: form.date, description: form.description || t('supplier.addDue') });
      setDueDialog(false); reset(); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!form.amount || form.amount <= 0) { setError(t('common.amount')); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/suppliers/${supplier.id}/payment`, { amount: Number(form.amount), date: form.date, description: form.description || t('supplier.paySupplier') });
      setPayDialog(false); reset(); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  if (!supplier) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>{t('supplier.selectToView')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{supplier.name}</Typography>
            {supplier.phone && <Typography variant="body2" color="text.secondary">{supplier.phone}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">{t('supplier.totalDue')}</Typography>
            <Typography variant="h5" fontWeight="bold" color={supplier.balance > 0 ? 'warning.dark' : 'success.main'}>
              {fmt(Math.abs(supplier.balance))}
            </Typography>
            {supplier.balance > 0 && <Typography variant="caption" color="warning.dark">{t('supplier.youOwe')}</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" color="warning" startIcon={<ArrowUpward />} size="small" onClick={() => { reset(); setDueDialog(true); }}>
            {t('supplier.addDue')}
          </Button>
          <Button variant="contained" color="success" startIcon={<ArrowDownward />} size="small" onClick={() => { reset(); setPayDialog(true); }}>
            {t('supplier.paySupplier')}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle2" fontWeight="bold">{t('supplier.txHistory')}</Typography>
        </Box>
        <Box sx={{ overflowY: 'auto', overflowX: 'auto', flexGrow: 1 }}>
          {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
            <Table size="small" stickyHeader sx={{ minWidth: 400 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.date')}</TableCell>
                  <TableCell>{t('common.description')}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.dark' }}>{t('supplier.dueCr')}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{t('supplier.paidDr')}</TableCell>
                  <TableCell align="right">{t('common.balance')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">{t('supplier.noTx')}</TableCell></TableRow>
                ) : ledger.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right" sx={{ color: row.credit > 0 ? 'warning.dark' : 'text.disabled' }}>
                      {row.credit > 0 ? fmt(row.credit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.debit > 0 ? 'success.main' : 'text.disabled' }}>
                      {row.debit > 0 ? fmt(row.debit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: row.balance > 0 ? 'warning.dark' : 'success.main' }}>
                      {fmt(Math.abs(row.balance))} {row.balance > 0 ? t('common.due') : t('common.advance')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>

      <Dialog open={dueDialog} onClose={() => setDueDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>{t('supplier.addDue')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.notes')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDueDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="warning" onClick={handleDue} disabled={saving}>{saving ? <CircularProgress size={20} /> : t('supplier.addDue')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>{t('supplier.paySupplier')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.notes')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={saving}>{saving ? <CircularProgress size={20} /> : t('supplier.paySupplier')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function SupplierKhata() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const handleAddSupplier = async () => {
    setSaving(true);
    try {
      const code = 'S' + Date.now().toString().slice(-6);
      await api.post('/suppliers', { ...newForm, code });
      setAddDialog(false);
      setNewForm({ name: '', phone: '', address: '' });
      setRefreshKey((k) => k + 1);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ height: { xs: 'auto', sm: 'calc(100vh - 80px)' }, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        {isMobile && showDetail ? (
          <Button startIcon={<ArrowBack />} onClick={() => setShowDetail(false)} size="small">{t('common.back')}</Button>
        ) : (
          <Typography variant="h5" fontWeight="bold">{t('supplier.khata')}</Typography>
        )}
        <Button variant="contained" color="warning" startIcon={<Add />} size="small" onClick={() => setAddDialog(true)}>
          {isMobile ? t('common.add') : t('supplier.addNew')}
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {(!isMobile || !showDetail) && (
          <Grid item xs={12} sm={4} md={3} sx={{ height: { xs: 'auto', sm: '100%' } }}>
            <SupplierList onSelect={(s) => { setSelected(s); if (isMobile) setShowDetail(true); }} selected={selected} refreshKey={refreshKey} t={t} />
          </Grid>
        )}
        {(!isMobile || showDetail) && (
          <Grid item xs={12} sm={8} md={9} sx={{ height: { xs: 'auto', sm: '100%' } }}>
            <SupplierLedgerPanel supplier={selected} onRefresh={() => setRefreshKey((k) => k + 1)} t={t} />
          </Grid>
        )}
      </Grid>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('supplier.addNew2')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.name')} *`} value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.phone')} value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.address')} value={newForm.address} onChange={(e) => setNewForm({ ...newForm, address: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddSupplier} disabled={saving || !newForm.name}>
            {saving ? <CircularProgress size={20} /> : t('supplier.addNew')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
