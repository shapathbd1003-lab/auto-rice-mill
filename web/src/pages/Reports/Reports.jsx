import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Grid, Card, CardContent, CardActionArea, TextField,
  Button, ButtonGroup, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Alert,
} from '@mui/material';
import {
  Assessment, PeopleAlt, LocalShipping, Inventory, TrendingUp, Person,
  PictureAsPdf, TableChart,
} from '@mui/icons-material';
import api from '../../services/api';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data, key) {
  if (!data) return;
  const rows = Array.isArray(data) ? data : Object.entries(data).flatMap(([section, val]) =>
    Array.isArray(val?.items) ? val.items.map((r) => ({ section, ...r })) : []
  );
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `${key}-report.csv`);
}

export default function Reports() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [endDate, setEndDate]     = useState(new Date().toISOString().slice(0, 10));
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]       = useState('');

  const REPORT_TYPES = [
    { key: 'daily',          label: t('report.daily'),       icon: <Assessment color="primary" />,    hasDate: true,  hasPdf: true,  pdfKey: 'daily/pdf' },
    { key: 'customer-due',   label: t('report.customerDue'), icon: <PeopleAlt color="error" />,       hasDate: false, hasPdf: false },
    { key: 'supplier-due',   label: t('report.supplierDue'), icon: <LocalShipping color="warning" />, hasDate: false, hasPdf: false },
    { key: 'inventory',      label: t('report.inventory'),   icon: <Inventory color="info" />,        hasDate: false, hasPdf: false },
    { key: 'production',     label: t('report.production'),  icon: <TrendingUp color="success" />,    hasDate: true,  hasPdf: false },
    { key: 'employee-salary',label: t('report.salary'),      icon: <Person color="secondary" />,      hasDate: false, hasPdf: false },
  ];

  const generate = async (type) => {
    setSelected(type); setLoading(true); setData(null); setError('');
    try {
      const params = {};
      if (type.key === 'daily') params.date = date;
      if (type.key === 'production') { params.startDate = startDate; params.endDate = endDate; }
      if (type.key === 'employee-salary') params.month = month;
      const r = await api.get(`/reports/${type.key}`, { params });
      setData(r.data.data);
    } catch (e) {
      setError(e.response?.data?.error?.message || t('common.noData'));
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    if (!selected?.hasPdf) return;
    setPdfLoading(true); setError('');
    try {
      const params = selected.key === 'daily' ? { date } : {};
      const r = await api.get(`/reports/${selected.pdfKey}`, { params, responseType: 'blob' });
      downloadBlob(r.data, `${selected.key}-report-${date}.pdf`);
    } catch { setError(t('common.noData')); }
    finally { setPdfLoading(false); }
  };

  const downloadStatement = async (type, id, code) => {
    setPdfLoading(true);
    try {
      const r = await api.get(`/reports/${type}-statement/${id}/pdf`, { params: { startDate, endDate }, responseType: 'blob' });
      downloadBlob(r.data, `${type}-statement-${code}.pdf`);
    } catch { setError(t('common.noData')); }
    finally { setPdfLoading(false); }
  };

  const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;

  const dailySections = data?.sales ? [
    { label: t('sales.title'),       data: data.sales,      color: 'primary' },
    { label: t('purchase.title'),    data: data.purchases,  color: 'warning' },
    { label: t('production.title'),  data: data.production, color: 'success' },
    { label: t('accounting.expenses'),data: data.expenses,  color: 'error'   },
  ] : [];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>{t('report.title')}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Date / Range controls */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" type="date" label={t('report.dateLabel')} value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="month" label={t('report.monthLabel')} value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label={t('report.startDate')} value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label={t('report.endDate')} value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Box>

      {/* Report type cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {REPORT_TYPES.map((rt) => (
          <Grid item xs={12} sm={6} md={4} key={rt.key}>
            <Card sx={{ border: selected?.key === rt.key ? '2px solid #1B5E20' : '1px solid #e0e0e0' }}>
              <CardActionArea onClick={() => generate(rt)}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {rt.icon}
                  <Box>
                    <Typography fontWeight="bold">{rt.label}</Typography>
                    {rt.hasPdf && <Chip label="PDF" size="small" icon={<PictureAsPdf />} color="success" sx={{ mt: 0.5 }} />}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">{selected?.label}</Typography>
            <ButtonGroup size="small" variant="outlined">
              {selected?.hasPdf && (
                <Button startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdf />}
                  onClick={downloadPdf} disabled={pdfLoading} color="error">
                  {t('report.download')}
                </Button>
              )}
              <Button startIcon={<TableChart />} onClick={() => exportCSV(data, selected?.key)}>
                {t('report.exportCsv')}
              </Button>
            </ButtonGroup>
          </Box>

          {/* Customer / Supplier Due */}
          {Array.isArray(data) && data[0]?.due_amount !== undefined && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.code')}</TableCell>
                    <TableCell>{t('common.name')}</TableCell>
                    <TableCell>{t('common.phone')}</TableCell>
                    <TableCell align="right">{t('report.dueAmount')}</TableCell>
                    <TableCell align="center">{t('customer.statement')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell align="right"><Typography color="error.main" fontWeight="bold">{fmt(r.due_amount)}</Typography></TableCell>
                      <TableCell align="center">
                        <Button size="small" startIcon={<PictureAsPdf />} color="error"
                          onClick={() => downloadStatement(selected.key === 'customer-due' ? 'customer' : 'supplier', r.id, r.code)}>
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Inventory */}
          {Array.isArray(data) && data[0]?.current_stock !== undefined && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.code')}</TableCell>
                    <TableCell>{t('common.name')}</TableCell>
                    <TableCell>{t('inventory.category')}</TableCell>
                    <TableCell align="right">{t('inventory.currentStock')}</TableCell>
                    <TableCell align="right">{t('inventory.reorderLevel')}</TableCell>
                    <TableCell align="right">{t('report.value')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.code} hover sx={{ bgcolor: Number(r.current_stock) <= Number(r.reorder_level) ? '#fff3e0' : 'inherit' }}>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell align="right">{Number(r.current_stock).toLocaleString()} {r.unit}</TableCell>
                      <TableCell align="right">{Number(r.reorder_level).toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(r.stock_value)}</TableCell>
                      <TableCell>
                        {Number(r.current_stock) <= Number(r.reorder_level)
                          ? <Chip label={t('report.lowStock')} size="small" color="warning" />
                          : <Chip label={t('report.ok')} size="small" color="success" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Daily Report */}
          {data?.sales && (
            <Grid container spacing={2}>
              {dailySections.map(({ label, data: section, color }) => (
                <Grid item xs={12} md={6} key={label}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">{label}</Typography>
                        <Chip label={fmt(section.total)} color={color} size="small" />
                      </Box>
                      <Table size="small">
                        <TableBody>
                          {(section.items || []).slice(0, 8).map((item, i) => (
                            <TableRow key={i} hover>
                              <TableCell sx={{ py: 0.5 }}>{item.invoice_number || item.batch_number || item.description || '—'}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{fmt(item.total_amount || item.paddy_quantity || item.amount)}</TableCell>
                            </TableRow>
                          ))}
                          {(section.items?.length ?? 0) > 8 && (
                            <TableRow><TableCell colSpan={2} sx={{ color: 'text.secondary', fontSize: 12 }}>+{section.items.length - 8}</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Salary Report */}
          {Array.isArray(data) && data[0]?.net_salary !== undefined && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('employee.title')}</TableCell>
                    <TableCell>{t('employee.designation')}</TableCell>
                    <TableCell align="right">{t('employee.basic')}</TableCell>
                    <TableCell align="right">{t('employee.otPay')}</TableCell>
                    <TableCell align="right">{t('employee.netSalary')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell align="center">{t('employee.slip')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.employee_name}</TableCell>
                      <TableCell>{r.designation}</TableCell>
                      <TableCell align="right">{fmt(r.basic_salary)}</TableCell>
                      <TableCell align="right">{fmt(r.overtime_pay)}</TableCell>
                      <TableCell align="right"><Typography fontWeight="bold">{fmt(r.net_salary)}</Typography></TableCell>
                      <TableCell><Chip label={r.status} size="small" color={r.status === 'paid' ? 'success' : 'warning'} /></TableCell>
                      <TableCell align="center">
                        <Button size="small" startIcon={<PictureAsPdf />} color="error">PDF</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Production Report */}
          {Array.isArray(data) && data[0]?.paddy_quantity !== undefined && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('report.batch')}</TableCell>
                    <TableCell>{t('common.date')}</TableCell>
                    <TableCell align="right">{t('report.paddyKg')}</TableCell>
                    <TableCell align="right">{t('report.riceOut')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.batch_number}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell align="right">{Number(r.paddy_quantity).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(r.rice_output || 0).toLocaleString()}</TableCell>
                      <TableCell><Chip label={r.status} size="small" color={r.status === 'completed' ? 'success' : 'info'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
}
