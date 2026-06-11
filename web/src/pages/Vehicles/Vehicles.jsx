import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, CircularProgress,
} from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import api from '../../services/api';

export default function Vehicles() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ number: '', type: '', driver_name: '', driver_phone: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/vehicles').then((r) => setRows(r.data.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRow) await api.put(`/vehicles/${editRow.id}`, form);
      else await api.post('/vehicles', form);
      setFormOpen(false); load();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t('vehicle.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditRow(null); setForm({ number: '', type: '', driver_name: '', driver_phone: '' }); setFormOpen(true); }}>Add Vehicle</Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>{t('vehicle.number')}</TableCell><TableCell>Type</TableCell><TableCell>{t('vehicle.driver')}</TableCell><TableCell>Driver Phone</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography fontWeight="bold">{row.number}</Typography></TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.driver_name}</TableCell>
                  <TableCell>{row.driver_phone}</TableCell>
                  <TableCell align="center"><IconButton size="small" onClick={() => { setEditRow(row); setForm(row); setFormOpen(true); }}><Edit fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editRow ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {[['number','Vehicle Number *'],['type','Type'],['driver_name','Driver Name'],['driver_phone','Driver Phone']].map(([f,l]) => (
              <Grid item xs={6} key={f}><TextField fullWidth size="small" label={l} value={form[f]||''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
