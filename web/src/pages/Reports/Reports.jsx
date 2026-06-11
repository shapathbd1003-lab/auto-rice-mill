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

const REPORT_TYPES = [
  { key: 'daily',          label: 'Daily Report',       icon: <Assessment color="primary" />,   hasDate: true,  hasPdf: true,  pdfKey: 'daily/pdf' },
  { key: 'customer-due',   label: 'Customer Due',        icon: <PeopleAlt color="error" />,      hasDate: false, hasPdf: false },
  { key: 'supplier-due',   label: 'Supplier Due',        icon: <LocalShipping color="warning" />,hasDate: false, hasPdf: false },
  { key: 'inventory',      label: 'Inventory Report',    icon: <Inventory color="info" />,       hasDate: false, hasPdf: false },
  { key: 'production',     label: 'Production Report',   icon: <TrendingUp color="success" />,   hasDate: true,  hasPdf: false },
  { key: 'employee-salary',label: 'Salary Report',       icon: <Person color="secondary" />,     hasDate: false, hasPdf: false },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [endDate, setEndDate]     = useState(new Date().toISOString().slice(0, 10));
  const [data, setData]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]   = useState('');

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
      setError(e.response?.data?.error?.message || 'Failed to load report');
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    if (!selected?.hasPdf) return;
    setPdfLoading(true); setError('');
    try {
      const params = selected.key === 'daily' ? { date } : {};
      const r = await api.get(`/reports/${selected.pdfKey}`, { params, responseType: 'blob' });
      downloadBlob(r.data, `${selected.key}-report-${date}.pdf`);
    } catch {
      setError('PDF generation failed');
    } finally { setPdfLoading(false); }
  };

  const downloadSalarySlip = async (salaryId, empCode) => {
    setPdfLoading(true);
    try {
      const r = await api.get(`/reports/salary-slip/${salaryId}/pdf`, { responseType: 'blob' });
      downloadBlob(r.data, `salary-slip-${empCode}-${month}.pdf`);
    } catch { setError('PDF generation failed'); }
    finally { setPdfLoading(false); }
  };

  const downloadStatement = async (type, id, code) => {
    setPdfLoading(true);
    try {
      const r = await api.get(`/reports/${type}-statement/${id}/pdf`, { params: { startDate, endDate }, responseType: 'blob' });
      downloadBlob(r.data, `${type}-statement-${code}.pdf`);
    } catch { setError('PDF generation failed'); }
    finally { setPdfLoading(false); }
  };

  const fmt = (n) => `৳ ${Number(n || 0).toLocaleString()}`;

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>{t('report.title')}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Date / Range controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="End Date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
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
          {/* Header row with export buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{selected?.label}</Typography>
            <ButtonGroup size="small" variant="outlined">
              {selected?.hasPdf && (
                <Button startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdf />}
                  onClick={downloadPdf} disabled={pdfLoading} color="error">
                  Download PDF
                </Button>
              )}
              <Button startIcon={<TableChart />} onClick={() => exportCSV(data, selected?.key)}>
                Export CSV
              </Button>
            </ButtonGroup>
          </Box>

          {/* ── Customer / Supplier Due ── */}
          {Array.isArray(data) && data[0]?.due_amount !== undefined && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Phone</TableCell>
                    <TableCell align="right">Due Amount</TableCell>
                    <TableCell align="center">Statement</TableCell>
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

          {/* ── Inventory ── */}
          {Array.isArray(data) && data[0]?.current_stock !== undefined && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Category</TableCell>
                    <TableCell align="right">Stock</TableCell><TableCell align="right">Reorder</TableCell>
                    <TableCell align="right">Value</TableCell><TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.code} hover sx={{ bgcolor: Number(r.current_stock) <= Number(r.reorder_level) ? '#fff3e0' : 'inherit' }}>
                      <TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.category}</TableCell>
                      <TableCell align="right">{Number(r.current_stock).toLocaleString()} {r.unit}</TableCell>
                      <TableCell align="right">{Number(r.reorder_level).toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(r.stock_value)}</TableCell>
                      <TableCell>
                        {Number(r.current_stock) <= Number(r.reorder_level)
                          ? <Chip label="Low Stock" size="small" color="warning" />
                          : <Chip label="OK" size="small" color="success" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── Daily Report ── */}
          {data.sales && (
            <Grid container spacing={2}>
              {[
                ['Sales',      data.sales,      'primary'],
                ['Purchases',  data.purchases,  'warning'],
                ['Production', data.production, 'success'],
                ['Expenses',   data.expenses,   'error'],
              ].map(([label, section, color]) => (
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
                              <TableCell sx={{ py: 0.5 }}>{item.invoice_number || item.batch_number || item.description || '-'}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{fmt(item.total_amount || item.paddy_quantity || item.amount)}</TableCell>
                            </TableRow>
                          ))}
                          {(section.items?.length ?? 0) > 8 && (
                            <TableRow><TableCell colSpan={2} sx={{ color: 'text.secondary', fontSize: 12 }}>+{section.items.length - 8} more</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* ── Salary Report ── */}
          {Array.isArray(data) && data[0]?.net_salary !== undefined && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell><TableCell>Designation</TableCell>
                    <TableCell align="right">Basic</TableCell><TableCell align="right">OT</TableCell>
                    <TableCell align="right">Net Salary</TableCell><TableCell>Status</TableCell>
                    <TableCell align="center">Slip</TableCell>
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
                        <Button size="small" startIcon={<PictureAsPdf />} color="error"
                          onClick={() => downloadSalarySlip(r.id, r.employee_code)}>
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── Production ── */}
          {Array.isArray(data) && data[0]?.paddy_quantity !== undefined && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Batch</TableCell><TableCell>Date</TableCell>
                    <TableCell align="right">Paddy (kg)</TableCell><TableCell align="right">Rice Out (kg)</TableCell>
                    <TableCell>Status</TableCell>
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

function exportCSV(data, key) {
  if (!data) return;
  const rows = Array.isArray(data) ? data : Object.entries(data).flatMap(([section, val]) =>
    Array.isArray(val?.items) ? val.items.map((r) => ({ section, ...r })) : []
  );
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${key}-report.csv`; a.click();
  URL.revokeObjectURL(url);
}
