/**
 * V2 Reports — Tally ERP 9 style
 * Trial Balance, P&L, Balance Sheet, Cash Flow, Day Book,
 * Ledger Statement, Rice Mill specific reports
 */
const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

const today = () => new Date().toISOString().slice(0, 10);
const fyStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
};

// ── TRIAL BALANCE ─────────────────────────────────────────────
router.get('/trial-balance', async (req, res) => {
  const millId = req.user.millId;
  const asOf = req.query.as_of || today();
  const rows = await query(
    `SELECT l.id, l.name, l.code, l.opening_balance, l.opening_type,
            lg.name AS group_name, lg.nature,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS total_dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS total_cr
     FROM ledgers l
     JOIN ledger_groups lg ON lg.id=l.group_id
     LEFT JOIN ledger_postings lp ON lp.ledger_id=l.id AND lp.mill_id=$1
     WHERE l.mill_id=$1 AND l.deleted_at IS NULL
     GROUP BY l.id, l.name, l.code, l.opening_balance, l.opening_type, lg.name, lg.nature
     ORDER BY lg.nature, lg.name, l.name`,
    [millId, asOf]
  );
  const ledgers = rows.rows.map((r) => {
    const openDr = r.opening_type==='Dr' ? Number(r.opening_balance) : 0;
    const openCr = r.opening_type==='Cr' ? Number(r.opening_balance) : 0;
    const netDr = openDr + Number(r.total_dr);
    const netCr = openCr + Number(r.total_cr);
    return { ...r, openDr, openCr, netDr, netCr, closingDr: netDr>netCr?netDr-netCr:0, closingCr: netCr>netDr?netCr-netDr:0 };
  });
  const totals = ledgers.reduce((a,l) => ({ openDr:a.openDr+l.openDr, openCr:a.openCr+l.openCr, netDr:a.netDr+l.netDr, netCr:a.netCr+l.netCr, closingDr:a.closingDr+l.closingDr, closingCr:a.closingCr+l.closingCr }), {openDr:0,openCr:0,netDr:0,netCr:0,closingDr:0,closingCr:0});
  success(res, { ledgers, totals, as_of: asOf });
});

// ── PROFIT & LOSS ─────────────────────────────────────────────
router.get('/profit-loss', async (req, res) => {
  const millId = req.user.millId;
  const from = req.query.from || fyStart();
  const to   = req.query.to   || today();
  const rows = await query(
    `SELECT lg.nature, lg.name AS group_name, l.name AS ledger_name,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' THEN lp.amount ELSE 0 END),0) AS dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' THEN lp.amount ELSE 0 END),0) AS cr
     FROM ledger_postings lp
     JOIN ledgers l ON l.id=lp.ledger_id
     JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE lp.mill_id=$1 AND lp.date>=$2 AND lp.date<=$3 AND lg.nature IN ('income','expenses')
     GROUP BY lg.nature, lg.name, l.name ORDER BY lg.nature DESC, lg.name, l.name`,
    [millId, from, to]
  );
  const income   = rows.rows.filter((r) => r.nature==='income');
  const expenses = rows.rows.filter((r) => r.nature==='expenses');
  const totalIncome   = income.reduce((s,r) => s+(Number(r.cr)-Number(r.dr)), 0);
  const totalExpenses = expenses.reduce((s,r) => s+(Number(r.dr)-Number(r.cr)), 0);
  success(res, { from, to, income, expenses, totalIncome, totalExpenses, netProfit: totalIncome-totalExpenses });
});

// ── BALANCE SHEET ─────────────────────────────────────────────
router.get('/balance-sheet', async (req, res) => {
  const millId = req.user.millId;
  const asOf = req.query.as_of || today();
  const rows = await query(
    `SELECT lg.nature, lg.name AS group_name, l.name AS ledger_name, l.opening_balance, l.opening_type,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS cr
     FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
     LEFT JOIN ledger_postings lp ON lp.ledger_id=l.id AND lp.mill_id=$1
     WHERE l.mill_id=$1 AND l.deleted_at IS NULL AND lg.nature IN ('assets','liabilities','capital')
     GROUP BY lg.nature, lg.name, l.name, l.opening_balance, l.opening_type ORDER BY lg.nature, lg.name, l.name`,
    [millId, asOf]
  );
  const calc = (r) => (Number(r.opening_type==='Dr'?r.opening_balance:0) + Number(r.dr)) - (Number(r.opening_type==='Cr'?r.opening_balance:0) + Number(r.cr));
  const assets      = rows.rows.filter((r) => r.nature==='assets');
  const liabilities = rows.rows.filter((r) => r.nature==='liabilities');
  const capital     = rows.rows.filter((r) => r.nature==='capital');
  success(res, {
    as_of: asOf, assets, liabilities, capital,
    totalAssets:      assets.reduce((s,r) => s+calc(r), 0),
    totalLiabilities: liabilities.reduce((s,r) => s+Math.abs(calc(r)), 0),
    totalCapital:     capital.reduce((s,r) => s+Math.abs(calc(r)), 0),
  });
});

// ── DAY BOOK ──────────────────────────────────────────────────
router.get('/day-book', async (req, res) => {
  const millId = req.user.millId;
  const date = req.query.date || today();
  const vouchers = await query(
    `SELECT v.*, vtm.name AS type_name, vtm.nature,
            array_agg(json_build_object('ledger',l.name,'type',vi.entry_type,'amount',vi.amount)) AS entries
     FROM vouchers v
     JOIN voucher_type_masters vtm ON vtm.id=v.voucher_type_master_id
     JOIN voucher_items vi ON vi.voucher_id=v.id
     JOIN ledgers l ON l.id=vi.ledger_id
     WHERE v.mill_id=$1 AND v.date=$2 AND v.deleted_at IS NULL AND v.status='approved'
     GROUP BY v.id, vtm.name, vtm.nature ORDER BY v.id`,
    [millId, date]
  );
  success(res, { date, vouchers: vouchers.rows, count: vouchers.rows.length });
});

// ── LEDGER STATEMENT ──────────────────────────────────────────
router.get('/ledger-statement/:ledgerId', async (req, res) => {
  const millId = req.user.millId;
  const { from, to } = req.query;
  const params = [req.params.ledgerId, millId];
  let where = 'lp.ledger_id=$1 AND lp.mill_id=$2';
  if (from) { params.push(from); where += ` AND lp.date>=$${params.length}`; }
  if (to)   { params.push(to);   where += ` AND lp.date<=$${params.length}`; }
  const [ledger, postings] = await Promise.all([
    query(`SELECT l.*, lg.name AS group_name, lg.nature FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id WHERE l.id=$1 AND l.mill_id=$2`, [req.params.ledgerId, millId]),
    query(`SELECT lp.*, v.voucher_number, vtm.name AS voucher_type, v.narration FROM ledger_postings lp JOIN vouchers v ON v.id=lp.voucher_id JOIN voucher_type_masters vtm ON vtm.id=v.voucher_type_master_id WHERE ${where} ORDER BY lp.date, lp.id`, params),
  ]);
  if (!ledger.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Ledger not found'} });
  success(res, { ledger: ledger.rows[0], postings: postings.rows });
});

// ── RICE MILL REPORTS ─────────────────────────────────────────

// Paddy Purchase Report
router.get('/paddy-purchase', async (req, res) => {
  const millId = req.user.millId;
  const { from, to } = req.query;
  const rows = await query(
    `SELECT p.*, s.name AS supplier_name FROM purchases p
     JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.mill_id=$1 AND p.deleted_at IS NULL
     ${from ? 'AND p.date>=$2' : ''} ${to ? `AND p.date<=$${from?3:2}` : ''}
     ORDER BY p.date DESC`,
    [millId, ...(from?[from]:[]), ...(to?[to]:[])]
  );
  const total = rows.rows.reduce((s,r) => ({ qty: s.qty+Number(r.net_weight||0), amount: s.amount+Number(r.total_amount||0) }), {qty:0,amount:0});
  success(res, { rows: rows.rows, total });
});

// Production Report
router.get('/production', async (req, res) => {
  const millId = req.user.millId;
  const { from, to } = req.query;
  const [batches, outputs] = await Promise.all([
    query(`SELECT pb.*, COUNT(po.id) AS output_count FROM production_batches pb LEFT JOIN production_outputs po ON po.batch_id=pb.id WHERE pb.mill_id=$1 ${from?'AND pb.date>=$2':''} ${to?`AND pb.date<=$${from?3:2}`:''} GROUP BY pb.id ORDER BY pb.date DESC`, [millId, ...(from?[from]:[]), ...(to?[to]:[])]),
    query(`SELECT product_type, SUM(quantity) AS total FROM production_outputs po JOIN production_batches pb ON pb.id=po.batch_id WHERE pb.mill_id=$1 ${from?'AND pb.date>=$2':''} ${to?`AND pb.date<=$${from?3:2}`:''} GROUP BY product_type`, [millId, ...(from?[from]:[]), ...(to?[to]:[])]),
  ]);
  success(res, { batches: batches.rows, outputSummary: outputs.rows });
});

// Customer Due Report
router.get('/customer-due', async (req, res) => {
  const millId = req.user.millId;
  const rows = await query(
    `SELECT c.id, c.code, c.name, c.phone, c.balance AS due_amount
     FROM customers c WHERE c.mill_id=$1 AND c.balance>0 AND c.deleted_at IS NULL
     ORDER BY c.balance DESC`,
    [millId]
  );
  const total = rows.rows.reduce((s,r) => s+Number(r.due_amount), 0);
  success(res, { rows: rows.rows, total });
});

// Supplier Due Report
router.get('/supplier-due', async (req, res) => {
  const millId = req.user.millId;
  const rows = await query(
    `SELECT s.id, s.code, s.name, s.phone, s.balance AS due_amount
     FROM suppliers s WHERE s.mill_id=$1 AND s.balance>0 AND s.deleted_at IS NULL
     ORDER BY s.balance DESC`,
    [millId]
  );
  const total = rows.rows.reduce((s,r) => s+Number(r.due_amount), 0);
  success(res, { rows: rows.rows, total });
});

// Stock / Inventory Report
router.get('/stock', async (req, res) => {
  const millId = req.user.millId;
  const rows = await query(
    `SELECT i.*, sg.name AS stock_group FROM inventory_items i
     LEFT JOIN stock_groups sg ON sg.id=i.group_id AND sg.mill_id=$1
     WHERE i.mill_id=$1 AND i.is_active=TRUE ORDER BY i.category, i.name`,
    [millId]
  );
  const summary = {};
  for (const r of rows.rows) {
    if (!summary[r.category]) summary[r.category] = 0;
    summary[r.category] += Number(r.current_stock || 0);
  }
  success(res, { items: rows.rows, summary });
});

// Profit Analysis
router.get('/profit-analysis', async (req, res) => {
  const millId = req.user.millId;
  const from = req.query.from || fyStart();
  const to   = req.query.to   || today();
  const [salesData, purchaseData, expenseData] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM sales_orders WHERE mill_id=$1 AND date>=$2 AND date<=$3 AND deleted_at IS NULL AND status='active'`, [millId, from, to]),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM purchases WHERE mill_id=$1 AND date>=$2 AND date<=$3 AND deleted_at IS NULL`, [millId, from, to]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=$1 AND date>=$2 AND date<=$3`, [millId, from, to]),
  ]);
  const revenue     = Number(salesData.rows[0].total);
  const cogs        = Number(purchaseData.rows[0].total);
  const expenses    = Number(expenseData.rows[0].total);
  const grossProfit = revenue - cogs;
  const netProfit   = grossProfit - expenses;
  success(res, { from, to, revenue, cogs, grossProfit, expenses, netProfit, margin: revenue>0 ? ((netProfit/revenue)*100).toFixed(2) : 0 });
});

module.exports = router;
