const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

// ── TRIAL BALANCE ─────────────────────────────────────────────
router.get('/trial-balance', async (req, res) => {
  const millId = req.user.millId;
  const { as_of } = req.query; // optional date filter
  const asOf = as_of || new Date().toISOString().slice(0, 10);

  const rows = await query(
    `SELECT l.id, l.name, l.name_bn, l.opening_balance, l.opening_type,
            lg.name AS group_name, lg.nature,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS total_dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS total_cr
     FROM ledgers l
     JOIN ledger_groups lg ON lg.id=l.group_id
     LEFT JOIN ledger_postings lp ON lp.ledger_id=l.id AND lp.mill_id=$1
     WHERE l.mill_id=$1 AND l.deleted_at IS NULL
     GROUP BY l.id, l.name, l.name_bn, l.opening_balance, l.opening_type, lg.name, lg.nature
     ORDER BY lg.nature, lg.name, l.name`,
    [millId, asOf]
  );

  const ledgers = rows.rows.map((r) => {
    const openDr = r.opening_type === 'Dr' ? Number(r.opening_balance) : 0;
    const openCr = r.opening_type === 'Cr' ? Number(r.opening_balance) : 0;
    const netDr = openDr + Number(r.total_dr);
    const netCr = openCr + Number(r.total_cr);
    const closingDr = netDr > netCr ? netDr - netCr : 0;
    const closingCr = netCr > netDr ? netCr - netDr : 0;
    return { ...r, openDr, openCr, netDr, netCr, closingDr, closingCr };
  });

  const totals = ledgers.reduce((acc, l) => ({
    openDr:    acc.openDr    + l.openDr,
    openCr:    acc.openCr    + l.openCr,
    netDr:     acc.netDr     + l.netDr,
    netCr:     acc.netCr     + l.netCr,
    closingDr: acc.closingDr + l.closingDr,
    closingCr: acc.closingCr + l.closingCr,
  }), { openDr:0, openCr:0, netDr:0, netCr:0, closingDr:0, closingCr:0 });

  success(res, { ledgers, totals, as_of: asOf });
});

// ── PROFIT & LOSS ─────────────────────────────────────────────
router.get('/profit-loss', async (req, res) => {
  const millId = req.user.millId;
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), 6, 1).toISOString().slice(0,10);
  const toDate   = to   || new Date().toISOString().slice(0, 10);

  const rows = await query(
    `SELECT lg.nature, lg.name AS group_name, l.name AS ledger_name, l.name_bn,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' THEN lp.amount ELSE 0 END),0) AS dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' THEN lp.amount ELSE 0 END),0) AS cr
     FROM ledger_postings lp
     JOIN ledgers l ON l.id=lp.ledger_id
     JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE lp.mill_id=$1 AND lp.date>=$2 AND lp.date<=$3
       AND lg.nature IN ('income','expenses')
     GROUP BY lg.nature, lg.name, l.name, l.name_bn
     ORDER BY lg.nature DESC, lg.name, l.name`,
    [millId, fromDate, toDate]
  );

  // Also include sales orders and expenses from main tables as fallback
  const [salesFallback, expFallback] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_orders WHERE mill_id=$1 AND date>=$2 AND date<=$3 AND deleted_at IS NULL AND status='active'`, [millId, fromDate, toDate]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=$1 AND date>=$2 AND date<=$3`, [millId, fromDate, toDate]),
  ]);

  const income   = rows.rows.filter((r) => r.nature === 'income');
  const expenses = rows.rows.filter((r) => r.nature === 'expenses');

  const totalIncome  = income.reduce((s, r) => s + (Number(r.cr) - Number(r.dr)), 0) || Number(salesFallback.rows[0].total);
  const totalExpenses= expenses.reduce((s, r) => s + (Number(r.dr) - Number(r.cr)), 0) || Number(expFallback.rows[0].total);
  const netProfit    = totalIncome - totalExpenses;

  success(res, { from: fromDate, to: toDate, income, expenses, totalIncome, totalExpenses, netProfit });
});

// ── BALANCE SHEET ─────────────────────────────────────────────
router.get('/balance-sheet', async (req, res) => {
  const millId = req.user.millId;
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);

  const rows = await query(
    `SELECT lg.nature, lg.name AS group_name, l.name AS ledger_name, l.name_bn,
            l.opening_balance, l.opening_type,
            COALESCE(SUM(CASE WHEN lp.entry_type='Dr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS dr,
            COALESCE(SUM(CASE WHEN lp.entry_type='Cr' AND lp.date<=$2 THEN lp.amount ELSE 0 END),0) AS cr
     FROM ledgers l
     JOIN ledger_groups lg ON lg.id=l.group_id
     LEFT JOIN ledger_postings lp ON lp.ledger_id=l.id AND lp.mill_id=$1
     WHERE l.mill_id=$1 AND l.deleted_at IS NULL
       AND lg.nature IN ('assets','liabilities','capital')
     GROUP BY lg.nature, lg.name, l.name, l.name_bn, l.opening_balance, l.opening_type
     ORDER BY lg.nature, lg.name, l.name`,
    [millId, asOf]
  );

  const assets      = rows.rows.filter((r) => r.nature === 'assets');
  const liabilities = rows.rows.filter((r) => r.nature === 'liabilities');
  const capital     = rows.rows.filter((r) => r.nature === 'capital');

  const calcBalance = (r) => {
    const openDr = r.opening_type === 'Dr' ? Number(r.opening_balance) : 0;
    const openCr = r.opening_type === 'Cr' ? Number(r.opening_balance) : 0;
    return (openDr + Number(r.dr)) - (openCr + Number(r.cr));
  };

  const totalAssets      = assets.reduce((s, r) => s + calcBalance(r), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + Math.abs(calcBalance(r)), 0);
  const totalCapital     = capital.reduce((s, r) => s + Math.abs(calcBalance(r)), 0);

  success(res, { as_of: asOf, assets, liabilities, capital, totalAssets, totalLiabilities, totalCapital });
});

// ── DAY BOOK ──────────────────────────────────────────────────
router.get('/day-book', async (req, res) => {
  const millId = req.user.millId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const [vouchers, cashTx, expenses, sales, purchases] = await Promise.all([
    query(
      `SELECT v.*, array_agg(json_build_object('ledger',l.name,'type',vi.entry_type,'amount',vi.amount)) AS entries
       FROM vouchers v
       JOIN voucher_items vi ON vi.voucher_id=v.id
       JOIN ledgers l ON l.id=vi.ledger_id
       WHERE v.mill_id=$1 AND v.date=$2 AND v.deleted_at IS NULL AND v.status='approved'
       GROUP BY v.id ORDER BY v.id`, [millId, date]
    ),
    query('SELECT * FROM cash_transactions WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL ORDER BY id', [millId, date]),
    query('SELECT * FROM expenses WHERE mill_id=$1 AND date=$2 ORDER BY id', [millId, date]),
    query(`SELECT s.*, c.name AS customer_name FROM sales_orders s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.mill_id=$1 AND s.date=$2 AND s.deleted_at IS NULL ORDER BY s.id`, [millId, date]),
    query(`SELECT p.*, sp.name AS supplier_name FROM purchases p LEFT JOIN suppliers sp ON sp.id=p.supplier_id WHERE p.mill_id=$1 AND p.date=$2 AND p.deleted_at IS NULL ORDER BY p.id`, [millId, date]),
  ]);

  success(res, { date, vouchers: vouchers.rows, cashTransactions: cashTx.rows, expenses: expenses.rows, sales: sales.rows, purchases: purchases.rows });
});

// ── GENERAL LEDGER ────────────────────────────────────────────
router.get('/general-ledger', async (req, res) => {
  const millId = req.user.millId;
  const { from, to, ledger_id } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), 6, 1).toISOString().slice(0,10);
  const toDate   = to   || new Date().toISOString().slice(0, 10);

  const params = [millId, fromDate, toDate];
  let where = 'lp.mill_id=$1 AND lp.date>=$2 AND lp.date<=$3';
  if (ledger_id) { params.push(ledger_id); where += ` AND lp.ledger_id=$${params.length}`; }

  const postings = await query(
    `SELECT lp.*, l.name AS ledger_name, lg.name AS group_name, lg.nature,
            v.voucher_number, v.voucher_type, v.narration
     FROM ledger_postings lp
     JOIN ledgers l ON l.id=lp.ledger_id
     JOIN ledger_groups lg ON lg.id=l.group_id
     JOIN vouchers v ON v.id=lp.voucher_id
     WHERE ${where}
     ORDER BY lp.ledger_id, lp.date, lp.id`,
    params
  );

  success(res, { from: fromDate, to: toDate, postings: postings.rows });
});

// ── CASH FLOW ─────────────────────────────────────────────────
router.get('/cash-flow', async (req, res) => {
  const millId = req.user.millId;
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), 6, 1).toISOString().slice(0,10);
  const toDate   = to   || new Date().toISOString().slice(0, 10);

  const [cashIn, cashOut, salesIncome, purchaseOut, expOut] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_transactions WHERE mill_id=$1 AND type='in' AND date>=$2 AND date<=$3 AND deleted_at IS NULL`, [millId, fromDate, toDate]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_transactions WHERE mill_id=$1 AND type='out' AND date>=$2 AND date<=$3 AND deleted_at IS NULL`, [millId, fromDate, toDate]),
    query(`SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales_orders WHERE mill_id=$1 AND date>=$2 AND date<=$3 AND deleted_at IS NULL`, [millId, fromDate, toDate]),
    query(`SELECT COALESCE(SUM(paid_amount),0) AS total FROM purchases WHERE mill_id=$1 AND date>=$2 AND date<=$3 AND deleted_at IS NULL`, [millId, fromDate, toDate]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=$1 AND date>=$2 AND date<=$3`, [millId, fromDate, toDate]),
  ]);

  const totalIn  = Number(cashIn.rows[0].total) + Number(salesIncome.rows[0].total);
  const totalOut = Number(cashOut.rows[0].total) + Number(purchaseOut.rows[0].total) + Number(expOut.rows[0].total);

  success(res, {
    from: fromDate, to: toDate,
    cashIn: Number(cashIn.rows[0].total),
    salesCollection: Number(salesIncome.rows[0].total),
    totalInflow: totalIn,
    cashOut: Number(cashOut.rows[0].total),
    purchasePayments: Number(purchaseOut.rows[0].total),
    expenses: Number(expOut.rows[0].total),
    totalOutflow: totalOut,
    netCashFlow: totalIn - totalOut,
  });
});

module.exports = router;
