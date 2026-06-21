import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, CircularProgress,
  Alert, Tabs, Tab, Divider, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
} from '@mui/material';
import { Edit, Add, Business, People, Settings, CalendarMonth } from '@mui/icons-material';
import api from '../../services/api';

const ROLES = ['admin', 'manager', 'accountant', 'storekeeper', 'operator', 'sales'];
const ROLE_COLORS = { admin: 'error', manager: 'warning', accountant: 'primary', storekeeper: 'info', operator: 'secondary', sales: 'success' };

export default function CompanySettings() {
  const [tab, setTab] = useState(0);
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({});
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', role: 'accountant', password: '' });
  const [fyDialog, setFyDialog] = useState(false);
  const [fyForm, setFyForm] = useState({ name: '', start_date: '', end_date: '' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/erp/company'),
      api.get('/erp/users'),
      api.get('/erp/financial-years'),
    ]).then(([cRes, uRes, fyRes]) => {
      const d = cRes.data.data;
      setCompany(d);
      setForm({ ...(d.mill || {}), ...(d.settings || {}) });
      setUsers(uRes.data.data || []);
      setFinancialYears(fyRes.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveCompany = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/erp/company', form);
      setSuccess('Company settings saved successfully');
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSaveUser = async () => {
    setSaving(true); setError('');
    try {
      if (editUser) await api.put(`/erp/users/${editUser.id}`, userForm);
      else await api.post('/erp/users', userForm);
      setUserDialog(false);
      const r = await api.get('/erp/users');
      setUsers(r.data.data || []);
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to save user'); }
    finally { setSaving(false); }
  };

  const handleSaveFY = async () => {
    setSaving(true);
    try {
      await api.post('/erp/financial-years', fyForm);
      setFyDialog(false);
      const r = await api.get('/erp/financial-years');
      setFinancialYears(r.data.data || []);
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Company Settings</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Company Info" icon={<Business />} iconPosition="start" />
        <Tab label="Users & Roles" icon={<People />} iconPosition="start" />
        <Tab label="Financial Years" icon={<CalendarMonth />} iconPosition="start" />
        <Tab label="Preferences" icon={<Settings />} iconPosition="start" />
      </Tabs>

      {/* Company Info */}
      {tab === 0 && (
        <Paper sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}><Typography variant="subtitle1" fontWeight="bold" color="primary">Basic Information</Typography><Divider sx={{ mb: 1 }} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Company Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Company Name (Bengali)" value={form.name_bn || ''} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} multiline rows={2} /></Grid>

            <Grid item xs={12} sx={{ mt: 1 }}><Typography variant="subtitle1" fontWeight="bold" color="primary">Tax & Legal</Typography><Divider sx={{ mb: 1 }} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Trade License No." value={form.trade_license || ''} onChange={(e) => setForm({ ...form, trade_license: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="TIN Number" value={form.tin_number || ''} onChange={(e) => setForm({ ...form, tin_number: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="BIN Number" value={form.bin_number || ''} onChange={(e) => setForm({ ...form, bin_number: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={<Switch checked={Boolean(form.vat_registered)} onChange={(e) => setForm({ ...form, vat_registered: e.target.checked })} />}
                label="VAT Registered"
              />
            </Grid>
            {form.vat_registered && (
              <Grid item xs={6}><TextField fullWidth size="small" label="VAT Number" value={form.vat_number || ''} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></Grid>
            )}

            <Grid item xs={12} sx={{ mt: 1 }}><Typography variant="subtitle1" fontWeight="bold" color="primary">Invoice Settings</Typography><Divider sx={{ mb: 1 }} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Invoice Prefix" value={form.invoice_prefix || 'INV'} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} helperText="e.g. INV, BILL, SL" /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Voucher Prefix" value={form.voucher_prefix || 'VCH'} onChange={(e) => setForm({ ...form, voucher_prefix: e.target.value })} /></Grid>
            <Grid item xs={4}>
              <TextField fullWidth size="small" label="Due Alert (days)" type="number" value={form.due_alert_days || 7} onChange={(e) => setForm({ ...form, due_alert_days: e.target.value })} />
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={handleSaveCompany} disabled={saving}>
                {saving ? <CircularProgress size={20} /> : 'Save Company Settings'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Users */}
      {tab === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditUser(null); setUserForm({ name: '', email: '', phone: '', role: 'accountant', password: '' }); setError(''); setUserDialog(true); }}>Add User</Button>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Paper>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Phone</TableCell>
                <TableCell>Role</TableCell><TableCell>Last Login</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone || '—'}</TableCell>
                    <TableCell><Chip label={u.role} color={ROLE_COLORS[u.role] || 'default'} size="small" /></TableCell>
                    <TableCell>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</TableCell>
                    <TableCell><Chip label={u.is_active ? 'Active' : 'Inactive'} color={u.is_active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => { setEditUser(u); setUserForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, password: '' }); setError(''); setUserDialog(true); }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Financial Years */}
      {tab === 2 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setFyDialog(true)}>New Financial Year</Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Year Name</TableCell><TableCell>Start Date</TableCell><TableCell>End Date</TableCell>
                <TableCell>Active</TableCell><TableCell>Locked</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {financialYears.map((fy) => (
                  <TableRow key={fy.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{fy.name}</TableCell>
                    <TableCell>{new Date(fy.start_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{new Date(fy.end_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell><Chip label={fy.is_active ? 'Active' : 'Inactive'} color={fy.is_active ? 'success' : 'default'} size="small" /></TableCell>
                    <TableCell><Chip label={fy.is_locked ? 'Locked' : 'Open'} color={fy.is_locked ? 'error' : 'success'} size="small" /></TableCell>
                    <TableCell align="center">
                      {!fy.is_active && <Button size="small" onClick={() => api.put(`/erp/financial-years/${fy.id}/activate`).then(() => api.get('/erp/financial-years').then((r) => setFinancialYears(r.data.data || [])))}>Activate</Button>}
                      {!fy.is_locked && fy.is_active && <Button size="small" color="error" onClick={() => api.put(`/erp/financial-years/${fy.id}/lock`).then(() => api.get('/erp/financial-years').then((r) => setFinancialYears(r.data.data || [])))}>Lock</Button>}
                      {fy.is_locked && <Button size="small" onClick={() => api.put(`/erp/financial-years/${fy.id}/unlock`).then(() => api.get('/erp/financial-years').then((r) => setFinancialYears(r.data.data || [])))}>Unlock</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Preferences */}
      {tab === 3 && (
        <Paper sx={{ p: 3 }}>
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}><Typography variant="subtitle1" fontWeight="bold" color="primary">System Preferences</Typography><Divider sx={{ mb: 1 }} /></Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={<Switch checked={Boolean(form.low_stock_alert)} onChange={(e) => setForm({ ...form, low_stock_alert: e.target.checked })} />}
                label="Low Stock Alert"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Due Alert Days" type="number" value={form.due_alert_days || 7} onChange={(e) => setForm({ ...form, due_alert_days: e.target.value })} helperText="Alert X days before due" />
            </Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Currency Code" value={form.currency || 'BDT'} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Currency Symbol" value={form.currency_symbol || '৳'} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} /></Grid>
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={handleSaveCompany} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save Preferences'}</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* User Dialog */}
      <Dialog open={userDialog} onClose={() => setUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editUser ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}><TextField fullWidth size="small" label="Full Name *" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Email *" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Role *</InputLabel>
                <Select value={userForm.role} label="Role *" onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  {ROLES.map((r) => <MenuItem key={r} value={r}><Chip label={r} color={ROLE_COLORS[r]} size="small" sx={{ mr: 1 }} />{r.charAt(0).toUpperCase() + r.slice(1)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label={editUser ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveUser} disabled={saving}>{saving ? <CircularProgress size={20} /> : editUser ? 'Update User' : 'Create User'}</Button>
        </DialogActions>
      </Dialog>

      {/* Financial Year Dialog */}
      <Dialog open={fyDialog} onClose={() => setFyDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Financial Year</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth size="small" label="Year Name" value={fyForm.name} onChange={(e) => setFyForm({ ...fyForm, name: e.target.value })} placeholder="e.g. 2025-2026" /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Start Date" type="date" value={fyForm.start_date} onChange={(e) => setFyForm({ ...fyForm, start_date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="End Date" type="date" value={fyForm.end_date} onChange={(e) => setFyForm({ ...fyForm, end_date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFyDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFY} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
