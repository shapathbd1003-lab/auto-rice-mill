import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, InputAdornment, Paper, Grid,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  Divider, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Avatar, Tabs, Tab, Table, TableBody,
  TableCell, TableHead, TableRow, useMediaQuery, useTheme,
} from '@mui/material';
import { ArrowBack, Search, Add, ArrowUpward, ArrowDownward, Phone, WhatsApp } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function DueChip({ balance, t }) {
  if (balance > 0) return <Chip label={`${t('common.due')} ${fmt(balance)}`} color="error" size="small" />;
  if (balance < 0) return <Chip label={`${t('common.advance')} ${fmt(-balance)}`} color="success" size="small" />;
  return <Chip label={t('common.clear')} color="default" size="small" variant="outlined" />;
}

function CustomerList({ onSelect, selected, t }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/customers', { params: { limit: 100, search } })
      .then((r) => setCustomers(r.data.data || []))
      .finally(() => setLoading(false));
  }, [search]);

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
          {customers.map((c) => (
            <React.Fragment key={c.id}>
              <ListItem button selected={selected?.id === c.id} onClick={() => onSelect(c)}
                sx={{ '&.Mui-selected': { bgcolor: 'primary.light', color: 'white' } }}>
                <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'primary.main', fontSize: 14 }}>
                  {c.name[0].toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={<Typography fontWeight="bold" variant="body2">{c.name}</Typography>}
                  secondary={c.phone || t('common.noPhone')}
                />
                <ListItemSecondaryAction>
                  <DueChip balance={c.balance} t={t} />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
          {customers.length === 0 && <ListItem><ListItemText secondary={t('customer.noFound')} /></ListItem>}
        </List>
      )}
    </Paper>
  );
}

function LedgerPanel({ customer, onRefresh, t }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [dueDialog, setDueDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [form, setForm] = useState({ amount: '', date: today(), description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!customer) return;
    setLoading(true);
    api.get(`/customers/${customer.id}/ledger`, { params: { limit: 50 } })
      .then((r) => setLedger(r.data.data || []))
      .finally(() => setLoading(false));
  }, [customer]);

  useEffect(() => { load(); setTab(0); }, [load]);

  const reset = () => setForm({ amount: '', date: today(), description: '' });

  const handleAddDue = async () => {
    if (!form.amount || form.amount <= 0) { setError(t('common.amount')); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/customers/${customer.id}/due`, { amount: Number(form.amount), date: form.date, description: form.description || t('customer.addDue') });
      setDueDialog(false); reset(); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!form.amount || form.amount <= 0) { setError(t('common.amount')); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/customers/${customer.id}/payment`, { amount: Number(form.amount), date: form.date, description: form.description || t('customer.receivePayment') });
      setPayDialog(false); reset(); load(); onRefresh();
    } catch (e) { setError(e.response?.data?.error?.message || t('common.noData')); }
    finally { setSaving(false); }
  };

  const openWhatsApp = () => {
    if (!customer.phone) return;
    const msg = `${customer.name}, ${t('customer.totalDue')}: ${fmt(customer.balance)}`;
    window.open(`https://wa.me/880${customer.phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!customer) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>{t('customer.selectToView')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{customer.name}</Typography>
            {customer.name_bn && <Typography variant="body2" color="text.secondary">{customer.name_bn}</Typography>}
            {customer.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Phone fontSize="small" sx={{ mr: 0.5, color: 'text.secondary', fontSize: 14 }} />
                <Typography variant="body2">{customer.phone}</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">{t('customer.totalDue')}</Typography>
            <Typography variant="h5" fontWeight="bold" color={customer.balance > 0 ? 'error.main' : 'success.main'}>
              {fmt(Math.abs(customer.balance))}
            </Typography>
            {customer.balance > 0 && <Typography variant="caption" color="error">{t('customer.owesYou')}</Typography>}
            {customer.balance < 0 && <Typography variant="caption" color="success.main">{t('customer.youOwe')}</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" color="error" startIcon={<ArrowUpward />} size="small"
            onClick={() => { setError(''); reset(); setDueDialog(true); }}>
            {t('customer.addDue')}
          </Button>
          <Button variant="contained" color="success" startIcon={<ArrowDownward />} size="small"
            onClick={() => { setError(''); reset(); setPayDialog(true); }}>
            {t('customer.receivePayment')}
          </Button>
          {customer.phone && (
            <Button variant="outlined" color="success" startIcon={<WhatsApp />} size="small" onClick={openWhatsApp}>
              WhatsApp
            </Button>
          )}
        </Box>
      </Paper>

      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #eee' }}>
          <Tab label={t('customer.txHistory')} />
          <Tab label={t('customer.statement')} />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ overflowY: 'auto', overflowX: 'auto', flexGrow: 1 }}>
            {loading ? <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> : (
              <Table size="small" stickyHeader sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.date')}</TableCell>
                    <TableCell>{t('common.description')}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{t('customer.dueDr')}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{t('customer.paidCr')}</TableCell>
                    <TableCell align="right">{t('common.balance')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center">{t('customer.noTx')}</TableCell></TableRow>
                  ) : ledger.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell align="right" sx={{ color: row.debit > 0 ? 'error.main' : 'text.disabled' }}>
                        {row.debit > 0 ? fmt(row.debit) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: row.credit > 0 ? 'success.main' : 'text.disabled' }}>
                        {row.credit > 0 ? fmt(row.credit) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: row.balance > 0 ? 'error.main' : 'success.main' }}>
                        {fmt(Math.abs(row.balance))} {row.balance > 0 ? t('common.dr') : t('common.cr')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Button variant="outlined" size="small" sx={{ mt: 1 }}
              onClick={() => window.open(`/api/reports/customer-statement/${customer.id}`, '_blank')}>
              {t('khata.viewStatement')}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Add Due Dialog */}
      <Dialog open={dueDialog} onClose={() => setDueDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>{t('customer.addDueDialog')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.notes')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" placeholder={t('customer.notePlaceholder')} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDueDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleAddDue} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('customer.addDue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receive Payment Dialog */}
      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>{t('customer.receivePaymentDialog')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.amount')} (৳)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.notes')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" placeholder={t('customer.paymentPlaceholder')} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="success" onClick={handlePayment} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('customer.receivePayment')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function CustomerKhata() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', address: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  const handleAddCustomer = async () => {
    setSaving(true);
    try {
      const code = 'C' + Date.now().toString().slice(-6);
      await api.post('/customers', { ...newForm, code, opening_balance: Number(newForm.opening_balance) });
      setAddDialog(false);
      setNewForm({ name: '', phone: '', address: '', opening_balance: 0 });
      setRefreshKey((k) => k + 1);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ height: { xs: 'auto', sm: 'calc(100vh - 80px)' }, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        {isMobile && showDetail ? (
          <Button startIcon={<ArrowBack />} onClick={() => setShowDetail(false)} size="small">{t('common.back')}</Button>
        ) : (
          <Typography variant="h5" fontWeight="bold">{t('customer.khata')}</Typography>
        )}
        <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setAddDialog(true)}>
          {isMobile ? t('common.add') : t('customer.addNew')}
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {(!isMobile || !showDetail) && (
          <Grid item xs={12} sm={4} md={3} sx={{ height: { xs: 'auto', sm: '100%' } }}>
            <CustomerList key={refreshKey} onSelect={(c) => { setSelected(c); if (isMobile) setShowDetail(true); }} selected={selected} t={t} />
          </Grid>
        )}
        {(!isMobile || showDetail) && (
          <Grid item xs={12} sm={8} md={9} sx={{ height: { xs: 'auto', sm: '100%' } }}>
            <LedgerPanel customer={selected} onRefresh={() => setRefreshKey((k) => k + 1)} t={t} />
          </Grid>
        )}
      </Grid>

      {/* Add Customer Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t('customer.addNew2')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.name')} *`} value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} size="small" autoFocus /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.phone')} value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('common.address')} value={newForm.address} onChange={(e) => setNewForm({ ...newForm, address: e.target.value })} size="small" /></Grid>
            <Grid item xs={12}><TextField fullWidth label={`${t('common.openingBalance')} (৳)`} type="number" value={newForm.opening_balance} onChange={(e) => setNewForm({ ...newForm, opening_balance: e.target.value })} size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddCustomer} disabled={saving || !newForm.name}>
            {saving ? <CircularProgress size={20} /> : t('customer.addNew')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
