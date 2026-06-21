import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, CircularProgress, useMediaQuery, useTheme,
  Card, CardContent, CardActions, Stack,
} from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import api from '../../services/api';

export default function Vehicles() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ number: '', type: '', driver_name: '', driver_phone: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/vehicles').then((r) => setRows(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditRow(null); setForm({ number: '', type: '', driver_name: '', driver_phone: '' }); setFormOpen(true); };
  const openEdit = (row) => { setEditRow(row); setForm(row); setFormOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRow) await api.put(`/vehicles/${editRow.id}`, form);
      else await api.post('/vehicles', form);
      setFormOpen(false); load();
    } finally { setSaving(false); }
  };

  const FIELDS = [
    { key: 'number',       label: t('vehicle.vehicleNumber') },
    { key: 'type',         label: t('common.type')           },
    { key: 'driver_name',  label: t('vehicle.driver')        },
    { key: 'driver_phone', label: t('vehicle.driverPhone')   },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">{t('vehicle.title')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? t('common.add') : t('vehicle.addVehicle')}
        </Button>
      </Box>

      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ pb: 0 }}>
                <Typography fontWeight="bold">{row.number}</Typography>
                <Typography variant="body2" color="text.secondary">{row.type}</Typography>
                <Typography variant="body2">{row.driver_name} · {row.driver_phone}</Typography>
              </CardContent>
              <CardActions sx={{ pt: 0, pb: 1, px: 2, justifyContent: 'flex-end' }}>
                <IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('vehicle.number')}</TableCell>
                <TableCell>{t('common.type')}</TableCell>
                <TableCell>{t('vehicle.driver')}</TableCell>
                <TableCell>{t('vehicle.driverPhone')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={5} align="center">{t('common.noData')}</TableCell></TableRow>
                : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Typography fontWeight="bold">{row.number}</Typography></TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.driver_name}</TableCell>
                    <TableCell>{row.driver_phone}</TableCell>
                    <TableCell align="center"><IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editRow ? t('vehicle.editVehicle') : t('vehicle.addVehicle')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {FIELDS.map(({ key, label }) => (
              <Grid item xs={6} key={key}>
                <TextField fullWidth size="small" label={label} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </Grid>
            ))}
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
