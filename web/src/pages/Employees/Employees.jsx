import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, TextField, Pagination, CircularProgress, ToggleButton,
  ToggleButtonGroup, Alert, Tooltip, useMediaQuery, useTheme,
  Card, CardContent, Stack,
} from '@mui/material';
import { Add, Edit, CheckCircle, Cancel, WatchLater, PictureAsPdf } from '@mui/icons-material';
import api from '../../services/api';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const STATUS_COLORS = { present: 'success', absent: 'error', half_day: 'warning', leave: 'info' };
const STATUS_ICONS  = { present: <CheckCircle />, absent: <Cancel />, half_day: <WatchLater />, leave: <WatchLater /> };

export default function Employees() {
  const { t, i18n } = useTranslation();
  const isBn = i18n.language === 'bn';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab]         = useState(0);
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm]       = useState({ code:'', name:'', name_bn:'', phone:'', nid:'', designation:'', department:'', join_date:'', basic_salary:'' });
  const [salaries, setSalaries]   = useState([]);
  const [month, setMonth]         = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]         = useState('');

  const [attDate, setAttDate]         = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance]   = useState({});
  const [attEmployees, setAttEmployees] = useState([]);
  const [attLoading, setAttLoading]   = useState(false);
  const [attSaving, setAttSaving]     = useState(false);
  const [attSaved, setAttSaved]       = useState(false);

  const limit = 20;

  const loadEmployees = useCallback(() => {
    setLoading(true);
    api.get('/employees', { params: { page, limit } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.pagination?.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  const loadSalaries = useCallback(() => {
    api.get('/employees/salaries', { params: { month } }).then((r) => setSalaries(r.data.data || []));
  }, [month]);

  const loadAttendance = useCallback(() => {
    setAttLoading(true);
    Promise.all([
      api.get('/employees', { params: { page: 1, limit: 200 } }),
      api.get('/employees/attendance', { params: { date: attDate } }).catch(() => ({ data: { data: [] } })),
    ]).then(([empRes, attRes]) => {
      setAttEmployees(empRes.data.data || []);
      const map = {};
      (attRes.data.data || []).forEach((a) => { map[a.employee_id] = a.status; });
      setAttendance(map);
    }).finally(() => setAttLoading(false));
  }, [attDate]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { if (tab === 1) loadSalaries(); }, [tab, loadSalaries]);
  useEffect(() => { if (tab === 2) loadAttendance(); }, [tab, attDate, loadAttendance]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRow) await api.put(`/employees/${editRow.id}`, form);
      else         await api.post('/employees', form);
      setFormOpen(false); loadEmployees();
    } finally { setSaving(false); }
  };

  const handleGenerateSalary = async () => {
    await api.post('/employees/salaries/generate', { month });
    loadSalaries();
  };

  const handleAttendanceChange = (empId, status) => {
    setAttendance((prev) => ({ ...prev, [empId]: status }));
    setAttSaved(false);
  };

  const handleMarkAll = (status) => {
    const map = {};
    attEmployees.forEach((e) => { map[e.id] = status; });
    setAttendance(map);
    setAttSaved(false);
  };

  const handleSaveAttendance = async () => {
    setAttSaving(true); setError('');
    try {
      const records = attEmployees.map((e) => ({ employee_id: e.id, date: attDate, status: attendance[e.id] || 'absent' }));
      await api.post('/employees/attendance/bulk', { records });
      setAttSaved(true);
    } catch (e) {
      setError(e.response?.data?.error?.message || t('common.noData'));
    } finally { setAttSaving(false); }
  };

  const downloadSalarySlip = async (salaryId, empCode) => {
    setPdfLoading(true);
    try {
      const r = await api.get(`/reports/salary-slip/${salaryId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = `salary-slip-${empCode}-${month}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError(t('common.noData')); }
    finally { setPdfLoading(false); }
  };

  const presentCount = attEmployees.filter((e) => attendance[e.id] === 'present').length;
  const absentCount  = attEmployees.filter((e) => attendance[e.id] === 'absent' || !attendance[e.id]).length;
  const halfCount    = attEmployees.filter((e) => attendance[e.id] === 'half_day').length;

  const FORM_FIELDS = [
    { key:'code',         label: t('employee.codeLabel'),    type:'text' },
    { key:'name',         label: t('employee.nameEn'),       type:'text' },
    { key:'name_bn',      label: t('employee.nameBn'),       type:'text' },
    { key:'phone',        label: t('common.phone'),          type:'text' },
    { key:'nid',          label: t('employee.nid'),          type:'text' },
    { key:'designation',  label: t('employee.designation'),  type:'text' },
    { key:'department',   label: t('employee.department'),   type:'text' },
    { key:'join_date',    label: t('employee.joinDate'),     type:'date' },
    { key:'basic_salary', label: t('employee.basicSalary'),  type:'number' },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>{t('employee.title')}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }} variant={isMobile ? 'scrollable' : 'standard'}>
        <Tab label={t('employee.title')} />
        <Tab label={t('employee.salary')} />
        <Tab label={t('employee.attendance')} />
      </Tabs>

      {/* ── Employees Tab ── */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<Add />}
            onClick={() => { setEditRow(null); setForm({ code:'',name:'',name_bn:'',phone:'',nid:'',designation:'',department:'',join_date:'',basic_salary:'' }); setFormOpen(true); }}>
            {t('employee.addEmployee')}
          </Button>
        </Box>

        {isMobile ? (
          <Stack spacing={1}>
            {rows.map((row) => (
              <Card key={row.id} variant="outlined">
                <CardContent sx={{ pb: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography fontWeight="bold">{row.name}</Typography>
                      {isBn && row.name_bn && <Typography variant="caption" color="text.secondary">{row.name_bn}</Typography>}
                      <Typography variant="body2" color="text.secondary">{row.designation}</Typography>
                      <Typography variant="body2" color="text.secondary">{row.phone}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography fontWeight="bold" color="primary.main">৳ {Number(row.basic_salary || 0).toLocaleString('en-IN')}</Typography>
                      <IconButton size="small" onClick={() => { setEditRow(row); setForm(row); setFormOpen(true); }}>
                        <Edit fontSize="small" />
                      </IconButton>
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
                  <TableCell>{t('common.code')}</TableCell>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('common.phone')}</TableCell>
                  <TableCell>{t('employee.designation')}</TableCell>
                  <TableCell align="right">{t('employee.basicSalary')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                  : rows.length === 0
                  ? <TableRow><TableCell colSpan={6} align="center">{t('common.noData')}</TableCell></TableRow>
                  : rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" variant="body2">{row.name}</Typography>
                        {row.name_bn && <Typography variant="caption" display="block" color="text.secondary">{row.name_bn}</Typography>}
                      </TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.designation}</TableCell>
                      <TableCell align="right">৳ {Number(row.basic_salary || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => { setEditRow(row); setForm(row); setFormOpen(true); }}>
                          <Edit fontSize="small" />
                        </IconButton>
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
      </TabPanel>

      {/* ── Salary Tab ── */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" type="month" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} label={t('employee.month')} sx={{ width: { xs: '100%', sm: 'auto' } }} />
          <Button variant="outlined" onClick={handleGenerateSalary}>{t('employee.generateSalary')}</Button>
        </Box>
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('employee.title')}</TableCell>
                <TableCell align="right">{t('employee.basic')}</TableCell>
                {!isMobile && <TableCell align="right">{t('employee.otPay')}</TableCell>}
                {!isMobile && <TableCell align="right">{t('employee.deductions')}</TableCell>}
                <TableCell align="right">{t('employee.netSalary')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="center">{t('employee.slip')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salaries.length === 0
                ? <TableRow><TableCell colSpan={7} align="center">{t('common.noData')}</TableCell></TableRow>
                : salaries.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.employee_name}</TableCell>
                    <TableCell align="right">৳ {Number(row.basic_salary).toLocaleString('en-IN')}</TableCell>
                    {!isMobile && <TableCell align="right">৳ {Number(row.overtime_pay).toLocaleString('en-IN')}</TableCell>}
                    {!isMobile && <TableCell align="right">৳ {Number(row.advance_deduction).toLocaleString('en-IN')}</TableCell>}
                    <TableCell align="right"><Typography fontWeight="bold">৳ {Number(row.net_salary).toLocaleString('en-IN')}</Typography></TableCell>
                    <TableCell><Chip label={row.status} size="small" color={row.status === 'paid' ? 'success' : 'warning'} /></TableCell>
                    <TableCell align="center">
                      <Tooltip title={t('employee.downloadSlip')}>
                        <IconButton size="small" color="error" disabled={pdfLoading}
                          onClick={() => downloadSalarySlip(row.id, row.employee_code)}>
                          <PictureAsPdf fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* ── Attendance Tab ── */}
      <TabPanel value={tab} index={2}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" type="date" label={t('common.date')} value={attDate}
            onChange={(e) => { setAttDate(e.target.value); setAttSaved(false); }}
            InputLabelProps={{ shrink: true }} />
          <Button size="small" variant="outlined" color="success" onClick={() => handleMarkAll('present')}>
            {t('employee.allPresent')}
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={() => handleMarkAll('absent')}>
            {t('employee.allAbsent')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${t('employee.present')}: ${presentCount}`} color="success" size="small" />
            <Chip label={`${t('employee.halfDay')}: ${halfCount}`}   color="warning" size="small" />
            <Chip label={`${t('employee.absent')}: ${absentCount}`}  color="error"   size="small" />
          </Box>
          <Button variant="contained" disabled={attSaving} onClick={handleSaveAttendance}
            startIcon={attSaving ? <CircularProgress size={16} /> : null}>
            {attSaving ? t('employee.saving') : t('common.save')}
          </Button>
        </Box>

        {attSaved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAttSaved(false)}>{t('employee.attendanceSaved')} {attDate}</Alert>}

        {attLoading
          ? <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
          : (
            <TableContainer component={Paper}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('common.code')}</TableCell>
                    <TableCell>{t('common.name')}</TableCell>
                    {!isMobile && <TableCell>{t('employee.designation')}</TableCell>}
                    <TableCell>{t('common.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attEmployees.map((emp) => {
                    const status = attendance[emp.id] || 'absent';
                    return (
                      <TableRow key={emp.id} hover
                        sx={{ bgcolor: status === 'present' ? '#f1f8e9' : status === 'absent' ? '#fce4ec' : status === 'half_day' ? '#fff8e1' : '#e3f2fd' }}>
                        <TableCell>{emp.code}</TableCell>
                        <TableCell>
                          <Typography fontWeight="bold" variant="body2">{emp.name}</Typography>
                          {isBn && emp.name_bn && <Typography variant="caption" color="text.secondary">{emp.name_bn}</Typography>}
                        </TableCell>
                        {!isMobile && <TableCell>{emp.designation}</TableCell>}
                        <TableCell>
                          <ToggleButtonGroup value={status} exclusive size="small"
                            onChange={(_, val) => { if (val) handleAttendanceChange(emp.id, val); }}>
                            {[
                              { val: 'present',  label: t('employee.present'),  color: 'success' },
                              { val: 'half_day', label: t('employee.halfDay'),  color: 'warning' },
                              { val: 'absent',   label: t('employee.absent'),   color: 'error' },
                            ].map(({ val, label, color }) => (
                              <ToggleButton key={val} value={val} color={color} sx={{ px: { xs: 0.5, sm: 1.5 }, fontSize: { xs: 10, sm: 12 } }}>
                                {React.cloneElement(STATUS_ICONS[val], { sx: { fontSize: 14, mr: 0.5 } })}
                                {!isMobile && label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
      </TabPanel>

      {/* ── Employee Form Dialog ── */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editRow ? t('employee.editEmployee') : t('employee.addEmployee')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {FORM_FIELDS.map(({ key, label, type }) => (
              <Grid item xs={12} sm={6} key={key}>
                <TextField fullWidth size="small" label={label} value={form[key] || ''}
                  type={type} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  InputLabelProps={type === 'date' ? { shrink: true } : undefined} />
              </Grid>
            ))}
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
