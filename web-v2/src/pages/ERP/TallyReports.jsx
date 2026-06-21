import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, TextField, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  CircularProgress, Alert, Divider, Accordion, AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore, Print, GetApp } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const fyStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
};

const NATURE_COLORS = { assets: 'primary', liabilities: 'error', income: 'success', expenses: 'warning', capital: 'secondary' };

export default function TallyReports() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [params, setParams] = useState({ from: fyStart(), to: today(), as_of: today(), date: today(), ledger_id: '' });

  const TABS = ['Trial Balance', 'Profit & Loss', 'Balance Sheet', 'Day Book', 'Cash Flow', 'General Ledger'];
  const ENDPOINTS = [
    () => api.get('/erp/reports/trial-balance', { params: { as_of: params.as_of } }),
    () => api.get('/erp/reports/profit-loss', { params: { from: params.from, to: params.to } }),
    () => api.get('/erp/reports/balance-sheet', { params: { as_of: params.as_of } }),
    () => api.get('/erp/reports/day-book', { params: { date: params.date } }),
    () => api.get('/erp/reports/cash-flow', { params: { from: params.from, to: params.to } }),
    () => api.get('/erp/reports/general-ledger', { params: { from: params.from, to: params.to, ledger_id: params.ledger_id || undefined } }),
  ];

  const load = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await ENDPOINTS[tab]();
      setData(r.data.data);
    } catch (e) { setError(e.response?.data?.error?.message || 'Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const DateFilter = ({ showRange = true }) => (
    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      {showRange ? <>
        <TextField size="small" label="From" type="date" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="To" type="date" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} InputLabelProps={{ shrink: true }} />
      </> : <>
        <TextField size="small" label="As of Date" type="date" value={params.as_of} onChange={(e) => setParams({ ...params, as_of: e.target.value })} InputLabelProps={{ shrink: true }} />
      </>}
      <Button variant="contained" size="small" onClick={load}>Generate</Button>
      <Button variant="outlined" size="small" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Accounting Reports</Typography>
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setData(null); }} variant="scrollable" sx={{ mb: 2 }}>
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {/* Trial Balance */}
      {tab === 0 && <>
        <DateFilter showRange={false} />
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Paper>
            <Box sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" fontWeight="bold">Trial Balance — As of {new Date(params.as_of).toLocaleDateString('en-IN')}</Typography>
            </Box>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell>Nature</TableCell>
                <TableCell align="right">Opening Dr</TableCell><TableCell align="right">Opening Cr</TableCell>
                <TableCell align="right">Closing Dr</TableCell><TableCell align="right">Closing Cr</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(data.ledgers || []).map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell>{l.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{l.group_name}</TableCell>
                    <TableCell><Chip label={l.nature} color={NATURE_COLORS[l.nature]} size="small" /></TableCell>
                    <TableCell align="right">{l.openDr > 0 ? fmt(l.openDr) : ''}</TableCell>
                    <TableCell align="right">{l.openCr > 0 ? fmt(l.openCr) : ''}</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>{l.closingDr > 0 ? fmt(l.closingDr) : ''}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{l.closingCr > 0 ? fmt(l.closingCr) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(data.totals?.openDr)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(data.totals?.openCr)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{fmt(data.totals?.closingDr)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>{fmt(data.totals?.closingCr)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        )}
      </>}

      {/* Profit & Loss */}
      {tab === 1 && <>
        <DateFilter />
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper>
                <Box sx={{ p: 2, bgcolor: 'error.main', color: 'white' }}><Typography fontWeight="bold">Expenses</Typography></Box>
                <Table size="small">
                  <TableBody>
                    {(data.expenses || []).map((e, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{e.ledger_name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{e.group_name}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{fmt(Number(e.dr) - Number(e.cr))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total Expenses</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{fmt(data.totalExpenses)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: data.netProfit >= 0 ? 'success.50' : 'error.50' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>{data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: data.netProfit >= 0 ? 'success.main' : 'error.main' }}>{fmt(Math.abs(data.netProfit))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper>
                <Box sx={{ p: 2, bgcolor: 'success.main', color: 'white' }}><Typography fontWeight="bold">Income</Typography></Box>
                <Table size="small">
                  <TableBody>
                    {(data.income || []).map((e, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{e.ledger_name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{e.group_name}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>{fmt(Number(e.cr) - Number(e.dr))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total Income</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>{fmt(data.totalIncome)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>
        )}
      </>}

      {/* Balance Sheet */}
      {tab === 2 && <>
        <DateFilter showRange={false} />
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper>
                <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}><Typography fontWeight="bold">Assets — {fmt(data.totalAssets)}</Typography></Box>
                <Table size="small">
                  <TableBody>
                    {(data.assets || []).map((a, i) => (
                      <TableRow key={i} hover><TableCell>{a.ledger_name}</TableCell><TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{a.group_name}</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(Number(a.opening_balance) + Number(a.dr) - Number(a.cr))}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper>
                <Box sx={{ p: 2, bgcolor: 'error.main', color: 'white' }}><Typography fontWeight="bold">Liabilities & Capital — {fmt(data.totalLiabilities + data.totalCapital)}</Typography></Box>
                <Table size="small">
                  <TableBody>
                    {[...(data.liabilities || []), ...(data.capital || [])].map((l, i) => (
                      <TableRow key={i} hover><TableCell>{l.ledger_name}</TableCell><TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{l.group_name}</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(Math.abs(Number(l.opening_balance) + Number(l.cr) - Number(l.dr)))}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>
        )}
      </>}

      {/* Day Book */}
      {tab === 3 && <>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <TextField size="small" label="Date" type="date" value={params.date} onChange={(e) => setParams({ ...params, date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" size="small" onClick={load}>Load</Button>
        </Box>
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Box>
            {[
              { title: 'Sales', items: data.sales, cols: ['Invoice', 'Customer', 'Total', 'Paid', 'Due'], getRow: (r) => [r.invoice_number, r.customer_name, fmt(r.total_amount), fmt(r.paid_amount), fmt(r.due_amount)] },
              { title: 'Purchases', items: data.purchases, cols: ['Invoice', 'Supplier', 'Total', 'Paid', 'Due'], getRow: (r) => [r.invoice_number, r.supplier_name, fmt(r.total_amount), fmt(r.paid_amount), fmt(r.due_amount)] },
              { title: 'Cash Transactions', items: data.cashTransactions, cols: ['Category', 'Description', 'Cash In', 'Cash Out'], getRow: (r) => [r.category, r.description, r.type === 'in' ? fmt(r.amount) : '', r.type === 'out' ? fmt(r.amount) : ''] },
              { title: 'Expenses', items: data.expenses, cols: ['Category', 'Description', 'Amount'], getRow: (r) => [r.category, r.description, fmt(r.amount)] },
              { title: 'Vouchers', items: data.vouchers, cols: ['Voucher No.', 'Type', 'Narration', 'Amount'], getRow: (r) => [r.voucher_number, r.voucher_type, r.narration, fmt(r.total_amount)] },
            ].map(({ title, items, cols, getRow }) => items && items.length > 0 && (
              <Paper key={title} sx={{ mb: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: 'grey.100', fontWeight: 'bold' }}><Typography fontWeight="bold">{title} ({items.length})</Typography></Box>
                <Table size="small">
                  <TableHead><TableRow>{cols.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow></TableHead>
                  <TableBody>{items.map((r, i) => <TableRow key={i}>{getRow(r).map((v, j) => <TableCell key={j}>{v}</TableCell>)}</TableRow>)}</TableBody>
                </Table>
              </Paper>
            ))}
          </Box>
        )}
      </>}

      {/* Cash Flow */}
      {tab === 4 && <>
        <DateFilter />
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Paper sx={{ maxWidth: 600 }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}><Typography fontWeight="bold">Cash Flow Statement</Typography><Typography variant="caption">{new Date(params.from).toLocaleDateString('en-IN')} — {new Date(params.to).toLocaleDateString('en-IN')}</Typography></Box>
            <Table size="small">
              <TableBody>
                <TableRow sx={{ bgcolor: 'success.50' }}><TableCell sx={{ fontWeight: 'bold', color: 'success.main' }} colSpan={2}>INFLOWS</TableCell></TableRow>
                <TableRow><TableCell sx={{ pl: 4 }}>Sales Collection</TableCell><TableCell align="right">{fmt(data.salesCollection)}</TableCell></TableRow>
                <TableRow><TableCell sx={{ pl: 4 }}>Cash In</TableCell><TableCell align="right">{fmt(data.cashIn)}</TableCell></TableRow>
                <TableRow sx={{ bgcolor: 'grey.100' }}><TableCell sx={{ fontWeight: 'bold' }}>Total Inflow</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>{fmt(data.totalInflow)}</TableCell></TableRow>
                <TableRow sx={{ bgcolor: 'error.50' }}><TableCell sx={{ fontWeight: 'bold', color: 'error.main' }} colSpan={2}>OUTFLOWS</TableCell></TableRow>
                <TableRow><TableCell sx={{ pl: 4 }}>Purchase Payments</TableCell><TableCell align="right">{fmt(data.purchasePayments)}</TableCell></TableRow>
                <TableRow><TableCell sx={{ pl: 4 }}>Expenses</TableCell><TableCell align="right">{fmt(data.expenses)}</TableCell></TableRow>
                <TableRow><TableCell sx={{ pl: 4 }}>Cash Out</TableCell><TableCell align="right">{fmt(data.cashOut)}</TableCell></TableRow>
                <TableRow sx={{ bgcolor: 'grey.100' }}><TableCell sx={{ fontWeight: 'bold' }}>Total Outflow</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>{fmt(data.totalOutflow)}</TableCell></TableRow>
                <TableRow sx={{ bgcolor: data.netCashFlow >= 0 ? 'success.100' : 'error.100' }}>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: 16 }}>Net Cash Flow</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: 16, color: data.netCashFlow >= 0 ? 'success.dark' : 'error.dark' }}>{fmt(data.netCashFlow)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        )}
      </>}

      {/* General Ledger */}
      {tab === 5 && <>
        <DateFilter />
        {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : data && (
          <Paper>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Ledger</TableCell>
                <TableCell>Group</TableCell><TableCell align="right">Dr</TableCell><TableCell align="right">Cr</TableCell><TableCell align="right">Balance</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(data.postings || []).length === 0
                  ? <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>No postings in this period</TableCell></TableRow>
                  : (data.postings || []).map((p, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{new Date(p.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.voucher_number}</TableCell>
                      <TableCell>{p.ledger_name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{p.group_name}</TableCell>
                      <TableCell align="right" sx={{ color: 'primary.main' }}>{p.entry_type === 'Dr' ? fmt(p.amount) : ''}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{p.entry_type === 'Cr' ? fmt(p.amount) : ''}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(Math.abs(p.balance))} {p.balance >= 0 ? 'Dr' : 'Cr'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </>}
    </Box>
  );
}
