import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, TextField, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  CircularProgress, Alert, Card, CardActionArea, CardContent,
} from '@mui/material';
import { Assessment, PeopleAlt, LocalShipping, Inventory, TrendingUp, AccountBalance, Print } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => `৳ ${Number(n||0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0,10);
const fyStart = () => { const now = new Date(); const yr = now.getMonth()>=6?now.getFullYear():now.getFullYear()-1; return `${yr}-07-01`; };

const REPORTS = [
  { key:'trial-balance',   label:'Trial Balance',    icon:<AccountBalance color="primary"/>,    hasDate:true,  asOf:true },
  { key:'profit-loss',     label:'Profit & Loss',    icon:<TrendingUp color="success"/>,        hasDate:true },
  { key:'balance-sheet',   label:'Balance Sheet',    icon:<Assessment color="primary"/>,        hasDate:true,  asOf:true },
  { key:'day-book',        label:'Day Book',         icon:<Assessment color="secondary"/>,      hasDate:true,  singleDate:true },
  { key:'customer-due',    label:'Customer Due',     icon:<PeopleAlt color="error"/>,           hasDate:false },
  { key:'supplier-due',    label:'Supplier Due',     icon:<LocalShipping color="warning"/>,     hasDate:false },
  { key:'paddy-purchase',  label:'Paddy Purchase',   icon:<Inventory color="info"/>,            hasDate:true },
  { key:'production',      label:'Production',       icon:<Assessment color="success"/>,        hasDate:true },
  { key:'stock',           label:'Stock Report',     icon:<Inventory color="primary"/>,         hasDate:false },
  { key:'profit-analysis', label:'Profit Analysis',  icon:<TrendingUp color="success"/>,        hasDate:true },
];

const NATURE_COLORS = { assets:'primary', liabilities:'error', income:'success', expenses:'warning', capital:'secondary' };

export default function ReportsPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [from, setFrom]         = useState(fyStart());
  const [to, setTo]             = useState(today());
  const [asOf, setAsOf]         = useState(today());
  const [date, setDate]         = useState(today());

  const generate = async (rpt) => {
    setSelected(rpt); setLoading(true); setData(null); setError('');
    try {
      const params = {};
      if (rpt.asOf)       params.as_of = asOf;
      else if (rpt.singleDate) params.date = date;
      else if (rpt.hasDate)    { params.from = from; params.to = to; }
      const r = await api.get(`/v2/reports/${rpt.key}`, { params });
      setData(r.data.data);
    } catch(e) { setError(e.response?.data?.error?.message||'Failed to load report'); }
    finally { setLoading(false); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb:3 }}>Accounting & Mill Reports</Typography>

      {/* Date controls — responsive */}
      <Grid container spacing={1} sx={{ mb:3 }}>
        <Grid item xs={6} sm="auto">
          <TextField fullWidth size="small" label="From" type="date" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink:true }}
            sx={{ width:{ xs:'100%', sm:160 } }}/>
        </Grid>
        <Grid item xs={6} sm="auto">
          <TextField fullWidth size="small" label="To" type="date" value={to}
            onChange={(e) => { if (e.target.value < from) { setError('To date must be after From date'); return; } setTo(e.target.value); setError(''); }}
            InputLabelProps={{ shrink:true }} sx={{ width:{ xs:'100%', sm:160 } }}/>
        </Grid>
        <Grid item xs={6} sm="auto">
          <TextField fullWidth size="small" label="As of Date" type="date" value={asOf}
            onChange={(e) => setAsOf(e.target.value)} InputLabelProps={{ shrink:true }}
            sx={{ width:{ xs:'100%', sm:170 } }}/>
        </Grid>
        <Grid item xs={6} sm="auto">
          <TextField fullWidth size="small" label="Day Book Date" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink:true }}
            sx={{ width:{ xs:'100%', sm:180 } }}/>
        </Grid>
      </Grid>

      {/* Report cards */}
      <Grid container spacing={2} sx={{ mb:4 }}>
        {REPORTS.map((r) => (
          <Grid item xs={12} sm={6} md={3} key={r.key}>
            <Card sx={{ border: selected?.key===r.key ? '2px solid #1B5E20' : '1px solid #e0e0e0' }}>
              <CardActionArea onClick={() => generate(r)} sx={{ p:2 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                  {r.icon}
                  <Typography variant="body2" fontWeight="bold">{r.label}</Typography>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading && <Box sx={{ textAlign:'center', mt:3 }}><CircularProgress/></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Trial Balance */}
      {data && selected?.key==='trial-balance' && (
        <Paper>
          <Box sx={{ p:2, display:'flex', justifyContent:'space-between' }}>
            <Typography variant="h6" fontWeight="bold">Trial Balance — As of {new Date(asOf).toLocaleDateString('en-IN')}</Typography>
            <Button startIcon={<Print/>} size="small" onClick={() => window.print()}>Print</Button>
          </Box>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}>
              <TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell>Nature</TableCell>
              <TableCell align="right">Closing Dr</TableCell><TableCell align="right">Closing Cr</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(data.ledgers||[]).map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell>{l.name}</TableCell>
                  <TableCell sx={{ color:'text.secondary', fontSize:12 }}>{l.group_name}</TableCell>
                  <TableCell><Chip label={l.nature} color={NATURE_COLORS[l.nature]||'default'} size="small"/></TableCell>
                  <TableCell align="right" sx={{ color:'primary.main', fontWeight:'bold' }}>{l.closingDr>0?fmt(l.closingDr):''}</TableCell>
                  <TableCell align="right" sx={{ color:'success.main', fontWeight:'bold' }}>{l.closingCr>0?fmt(l.closingCr):''}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor:'grey.100' }}>
                <TableCell colSpan={3} sx={{ fontWeight:'bold' }}>TOTAL</TableCell>
                <TableCell align="right" sx={{ fontWeight:'bold', color:'primary.main' }}>{fmt(data.totals?.closingDr)}</TableCell>
                <TableCell align="right" sx={{ fontWeight:'bold', color:'success.main' }}>{fmt(data.totals?.closingCr)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* P&L */}
      {data && selected?.key==='profit-loss' && (
        <Grid container spacing={2}>
          {[
            { title:'Income',   rows:data.income,   color:'success', getValue:(r) => Math.abs(Number(r.cr)-Number(r.dr)), total:data.totalIncome },
            { title:'Expenses', rows:data.expenses, color:'error',   getValue:(r) => Math.abs(Number(r.dr)-Number(r.cr)), total:data.totalExpenses },
          ].map(({ title, rows, color, getValue, total }) => (
            <Grid item xs={12} md={6} key={title}>
              <Paper>
                <Box sx={{ p:2, bgcolor:`${color}.main`, color:'white' }}>
                  <Typography fontWeight="bold">{title}</Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor:'grey.50' }}>
                      <TableCell>Ledger</TableCell>
                      <TableCell sx={{ color:'text.secondary', fontSize:12 }}>Group</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(rows||[]).length === 0
                      ? <TableRow><TableCell colSpan={3} align="center" sx={{ color:'text.secondary' }}>No {title.toLowerCase()} entries</TableCell></TableRow>
                      : (rows||[]).map((r, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{r.ledger_name}</TableCell>
                          <TableCell sx={{ color:'text.secondary', fontSize:12 }}>{r.group_name}</TableCell>
                          <TableCell align="right" sx={{ fontWeight:'bold', color:`${color}.main` }}>{fmt(getValue(r))}</TableCell>
                        </TableRow>
                      ))}
                    <TableRow sx={{ bgcolor:'grey.100' }}>
                      <TableCell colSpan={2} sx={{ fontWeight:'bold' }}>Total {title}</TableCell>
                      <TableCell align="right" sx={{ fontWeight:'bold', color:`${color}.main` }}>{fmt(total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          ))}
          {/* Net Profit/Loss row */}
          <Grid item xs={12}>
            <Paper sx={{ p:2, bgcolor: data.netProfit >= 0 ? 'success.50' : 'error.50', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Typography variant="h6" fontWeight="bold">{data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</Typography>
              <Typography variant="h6" fontWeight="bold" color={data.netProfit >= 0 ? 'success.main' : 'error.main'}>{fmt(Math.abs(data.netProfit))}</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Customer/Supplier Due */}
      {data && (selected?.key==='customer-due'||selected?.key==='supplier-due') && (
        <Paper>
          <Box sx={{ p:2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Typography variant="h6" fontWeight="bold">{selected.label} — Total: {fmt(data.total)}</Typography>
          </Box>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell align="right">Due Amount</TableCell></TableRow></TableHead>
            <TableBody>
              {(data.rows||[]).map((r) => <TableRow key={r.id} hover><TableCell>{r.code}</TableCell><TableCell fontWeight="bold">{r.name}</TableCell><TableCell>{r.phone}</TableCell><TableCell align="right" sx={{ color:'error.main', fontWeight:'bold' }}>{fmt(r.due_amount)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Balance Sheet */}
      {data && selected?.key==='balance-sheet' && (
        <Grid container spacing={2}>
          {[
            { title:'Assets',               rows:data.assets,      color:'primary' },
            { title:'Liabilities & Capital', rows:[...(data.liabilities||[]),...(data.capital||[])], color:'error' },
          ].map(({ title, rows, color }) => (
            <Grid item xs={12} md={6} key={title}>
              <Paper>
                <Box sx={{ p:2, bgcolor:`${color}.main`, color:'white', display:'flex', justifyContent:'space-between' }}>
                  <Typography fontWeight="bold">{title}</Typography>
                  <Typography fontWeight="bold">{fmt(title==='Assets'?data.totalAssets:(data.totalLiabilities+data.totalCapital))}</Typography>
                </Box>
                <Table size="small">
                  <TableHead><TableRow sx={{ bgcolor:'grey.50' }}><TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                  <TableBody>
                    {(rows||[]).length===0
                      ? <TableRow><TableCell colSpan={3} align="center" sx={{ color:'text.secondary' }}>No entries</TableCell></TableRow>
                      : (rows||[]).map((r,i) => {
                        const val = (Number(r.opening_type==='Dr'?r.opening_balance:0)+Number(r.dr))-(Number(r.opening_type==='Cr'?r.opening_balance:0)+Number(r.cr));
                        return (
                          <TableRow key={i} hover>
                            <TableCell>{r.ledger_name}</TableCell>
                            <TableCell sx={{ color:'text.secondary', fontSize:12 }}>{r.group_name}</TableCell>
                            <TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(Math.abs(val))}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Paper sx={{ p:2, display:'flex', justifyContent:'space-between', bgcolor:'grey.50' }}>
              <Typography fontWeight="bold">As of {new Date(data.as_of||asOf).toLocaleDateString('en-IN')}</Typography>
              <Typography variant="body2" color={Math.abs(data.totalAssets-(data.totalLiabilities+data.totalCapital))<1?'success.main':'error.main'}>
                {Math.abs(data.totalAssets-(data.totalLiabilities+data.totalCapital))<1?'✓ Balanced':'⚠ Not Balanced'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Day Book */}
      {data && selected?.key==='day-book' && (
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ mb:2 }}>Day Book — {new Date(data.date||date).toLocaleDateString('en-IN')}</Typography>
          {(data.vouchers||[]).length===0 && (data.cashTransactions||[]).length===0 && (data.expenses||[]).length===0
            ? <Paper sx={{ p:3, textAlign:'center', color:'text.secondary' }}>No transactions for this date</Paper>
            : <>
              {(data.vouchers||[]).length > 0 && (
                <Paper sx={{ mb:2 }}>
                  <Box sx={{ p:1.5, bgcolor:'grey.100' }}><Typography fontWeight="bold">Vouchers ({data.vouchers.length})</Typography></Box>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Voucher No.</TableCell><TableCell>Type</TableCell><TableCell>Narration</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                    <TableBody>
                      {data.vouchers.map((v,i) => <TableRow key={i} hover><TableCell sx={{ fontFamily:'monospace' }}>{v.voucher_number}</TableCell><TableCell>{v.type_name}</TableCell><TableCell>{v.narration||'—'}</TableCell><TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(v.total_amount)}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </Paper>
              )}
              {(data.cashTransactions||[]).length > 0 && (
                <Paper sx={{ mb:2 }}>
                  <Box sx={{ p:1.5, bgcolor:'grey.100' }}><Typography fontWeight="bold">Cash Transactions ({data.cashTransactions.length})</Typography></Box>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Description</TableCell><TableCell align="right">Cash In</TableCell><TableCell align="right">Cash Out</TableCell></TableRow></TableHead>
                    <TableBody>
                      {data.cashTransactions.map((t,i) => <TableRow key={i} hover><TableCell>{t.category}</TableCell><TableCell>{t.description}</TableCell><TableCell align="right" sx={{ color:'success.main' }}>{t.type==='in'?fmt(t.amount):''}</TableCell><TableCell align="right" sx={{ color:'error.main' }}>{t.type==='out'?fmt(t.amount):''}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </Paper>
              )}
              {(data.expenses||[]).length > 0 && (
                <Paper sx={{ mb:2 }}>
                  <Box sx={{ p:1.5, bgcolor:'grey.100' }}><Typography fontWeight="bold">Expenses ({data.expenses.length})</Typography></Box>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Description</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                    <TableBody>
                      {data.expenses.map((e,i) => <TableRow key={i} hover><TableCell>{e.category}</TableCell><TableCell>{e.description}</TableCell><TableCell align="right" sx={{ color:'error.main', fontWeight:'bold' }}>{fmt(e.amount)}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </>}
        </Box>
      )}

      {/* Paddy Purchase Report */}
      {data && selected?.key==='paddy-purchase' && (
        <Paper>
          <Box sx={{ p:2, display:'flex', justifyContent:'space-between' }}>
            <Typography variant="h6" fontWeight="bold">Paddy Purchase Report</Typography>
            <Typography fontWeight="bold" color="warning.main">Total: {fmt(data.total?.amount)} | {Number(data.total?.qty||0).toFixed(1)} kg</Typography>
          </Box>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Invoice</TableCell><TableCell>Date</TableCell><TableCell>Supplier</TableCell><TableCell align="right">Net Weight (kg)</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Due</TableCell></TableRow></TableHead>
            <TableBody>
              {(data.rows||[]).length===0
                ? <TableRow><TableCell colSpan={7} align="center" sx={{ color:'text.secondary' }}>No purchases found</TableCell></TableRow>
                : (data.rows||[]).map((r) => <TableRow key={r.id} hover><TableCell sx={{ fontFamily:'monospace' }}>{r.invoice_number}</TableCell><TableCell>{r.date}</TableCell><TableCell>{r.supplier_name}</TableCell><TableCell align="right">{Number(r.net_weight||0).toLocaleString()}</TableCell><TableCell align="right" sx={{ fontWeight:'bold' }}>{fmt(r.total_amount)}</TableCell><TableCell align="right" sx={{ color:'success.main' }}>{fmt(r.paid_amount)}</TableCell><TableCell align="right" sx={{ color:r.due_amount>0?'error.main':'text.secondary' }}>{r.due_amount>0?fmt(r.due_amount):'—'}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Production Report */}
      {data && selected?.key==='production' && (
        <Box>
          {(data.outputSummary||[]).length > 0 && (
            <Grid container spacing={2} sx={{ mb:2 }}>
              {data.outputSummary.map((o,i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Paper sx={{ p:2, textAlign:'center', borderTop:'3px solid', borderColor:'success.main' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform:'capitalize' }}>{o.product_type}</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">{Number(o.total).toLocaleString()} kg</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
          <Paper>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Batch No.</TableCell><TableCell>Date</TableCell><TableCell align="right">Paddy (kg)</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {(data.batches||[]).length===0
                  ? <TableRow><TableCell colSpan={4} align="center" sx={{ color:'text.secondary' }}>No production batches</TableCell></TableRow>
                  : (data.batches||[]).map((r) => <TableRow key={r.id} hover><TableCell sx={{ fontFamily:'monospace' }}>{r.batch_number}</TableCell><TableCell>{r.date}</TableCell><TableCell align="right">{Number(r.paddy_quantity).toLocaleString()}</TableCell><TableCell><Chip label={r.status} size="small" color={r.status==='completed'?'success':'warning'}/></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* Profit Analysis */}
      {data && selected?.key==='profit-analysis' && (
        <Paper sx={{ maxWidth:500 }}>
          <Box sx={{ p:2, bgcolor:'#1B5E20', color:'white' }}><Typography fontWeight="bold">Profit Analysis</Typography><Typography variant="caption">{new Date(data.from).toLocaleDateString('en-IN')} — {new Date(data.to).toLocaleDateString('en-IN')}</Typography></Box>
          <Table size="small">
            <TableBody>
              {[['Revenue (Sales)', data.revenue, 'success.main'],['Cost of Purchase', data.cogs, 'error.main'],['Gross Profit', data.grossProfit, 'primary.main'],['Operating Expenses', data.expenses, 'warning.main'],['Net Profit', data.netProfit, data.netProfit>=0?'success.main':'error.main'],['Profit Margin', `${data.margin}%`, data.netProfit>=0?'success.main':'error.main']].map(([l,v,c]) => (
                <TableRow key={l} sx={{ bgcolor:l.includes('Net')?'grey.50':'inherit' }}>
                  <TableCell sx={{ fontWeight:l.includes('Net')||l.includes('Gross')?'bold':'normal' }}>{l}</TableCell>
                  <TableCell align="right" sx={{ fontWeight:'bold', color:c }}>{typeof v==='string'?v:fmt(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Stock Report */}
      {data && selected?.key==='stock' && (
        <Paper>
          <Box sx={{ p:2 }}><Typography variant="h6" fontWeight="bold">Stock Report</Typography></Box>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Category</TableCell><TableCell align="right">Stock</TableCell><TableCell align="right">Reorder</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {(data.items||[]).map((r) => <TableRow key={r.id} hover sx={{ bgcolor:Number(r.current_stock)<=Number(r.reorder_level)?'#fff3e0':'inherit' }}><TableCell>{r.code}</TableCell><TableCell fontWeight="bold">{r.name}</TableCell><TableCell>{r.category}</TableCell><TableCell align="right">{Number(r.current_stock).toLocaleString()} {r.unit}</TableCell><TableCell align="right">{Number(r.reorder_level).toLocaleString()}</TableCell><TableCell><Chip label={Number(r.current_stock)<=Number(r.reorder_level)?'Low Stock':'OK'} size="small" color={Number(r.current_stock)<=Number(r.reorder_level)?'warning':'success'}/></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
