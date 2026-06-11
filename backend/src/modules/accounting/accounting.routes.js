const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

// Accounts (Cash/Bank)
router.get('/accounts', async (req, res) => {
  const r = await query('SELECT * FROM accounts WHERE mill_id=$1 AND is_active=TRUE ORDER BY type,name', [req.user.millId]);
  success(res, r.rows);
});

router.post('/accounts', requireRole('admin','accountant'), async (req, res) => {
  const { name, name_bn, type, bank_name, account_no } = req.body;
  const r = await query(
    'INSERT INTO accounts (mill_id,name,name_bn,type,bank_name,account_no) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.user.millId, name, name_bn, type, bank_name, account_no]
  );
  created(res, r.rows[0], 'Account created');
});

router.get('/accounts/:id/transactions', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  let sql = `SELECT * FROM financial_transactions WHERE account_id=$1 AND mill_id=$2`;
  const params = [req.params.id, req.user.millId]; let idx = 3;
  if (req.query.startDate) { sql += ` AND date>=$${idx}`; params.push(req.query.startDate); idx++; }
  if (req.query.endDate)   { sql += ` AND date<=$${idx}`; params.push(req.query.endDate);   idx++; }
  const cntRes = await query(sql.replace('SELECT *', 'SELECT COUNT(*) AS total'), params);
  sql += ` ORDER BY date DESC,id DESC LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

// Expenses
router.get('/expenses', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  let sql = `SELECT * FROM expenses WHERE mill_id=$1`;
  const params = [req.user.millId]; let idx = 2;
  if (req.query.startDate) { sql += ` AND date>=$${idx}`; params.push(req.query.startDate); idx++; }
  if (req.query.endDate)   { sql += ` AND date<=$${idx}`; params.push(req.query.endDate);   idx++; }
  if (req.query.category)  { sql += ` AND category=$${idx}`; params.push(req.query.category); idx++; }
  const cntRes = await query(sql.replace('SELECT *', 'SELECT COUNT(*) AS total'), params);
  sql += ` ORDER BY date DESC,id DESC LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

router.post('/expenses', requireRole('admin','manager','accountant'), async (req, res) => {
  const { date, category, description, amount, account_id } = req.body;
  const client = await (require('../../config/database').getClient)();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      'INSERT INTO expenses (mill_id,date,category,description,amount,account_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.millId, date, category, description, amount, account_id, req.user.id]
    );
    if (account_id) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id,date,account_id,type,category,amount,description,reference_type,reference_id,created_by)
         VALUES ($1,$2,$3,'expense',$4,$5,$6,'expense',$7,$8)`,
        [req.user.millId, date, account_id, category, amount, description, r.rows[0].id, req.user.id]
      );
      await client.query('UPDATE accounts SET balance=balance-$1 WHERE id=$2', [amount, account_id]);
    }
    await client.query('COMMIT');
    created(res, r.rows[0], 'Expense added');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// Daily Closing
router.get('/daily-closing', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  const r = await query('SELECT * FROM daily_closing WHERE mill_id=$1 AND date=$2', [req.user.millId, date]);
  success(res, r.rows[0] || null);
});

router.post('/daily-closing', requireRole('admin','manager','accountant'), async (req, res) => {
  const millId = req.user.millId;
  const date = req.body.date || new Date().toISOString().slice(0,10);
  const [salesRes, expRes, purRes] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM sales_orders WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [millId, date]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=$1 AND date=$2`, [millId, date]),
    query(`SELECT COALESCE(SUM(paid_amount),0) AS paid FROM purchases WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [millId, date]),
  ]);
  const cashRes = await query(`SELECT COALESCE(SUM(balance),0) AS bal FROM accounts WHERE mill_id=$1 AND type='cash' AND is_active=TRUE`, [millId]);
  const r = await query(
    `INSERT INTO daily_closing (mill_id,date,total_sales,total_expenses,total_payments_in,total_payments_out,closing_cash,closed_by,closed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (mill_id,date) DO UPDATE SET closing_cash=$7,closed_by=$8,closed_at=NOW() RETURNING *`,
    [millId, date,
     parseFloat(salesRes.rows[0].total), parseFloat(expRes.rows[0].total),
     parseFloat(salesRes.rows[0].paid), parseFloat(purRes.rows[0].paid),
     parseFloat(cashRes.rows[0].bal), req.user.id]
  );
  created(res, r.rows[0], 'Day closed');
});

// P&L summary
router.get('/profit-loss', async (req, res) => {
  const millId = req.user.millId;
  const { startDate = new Date().toISOString().slice(0,7)+'-01', endDate = new Date().toISOString().slice(0,10) } = req.query;
  const [revenueRes, expRes, purRes] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_orders WHERE mill_id=$1 AND date BETWEEN $2 AND $3 AND deleted_at IS NULL`, [millId, startDate, endDate]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=$1 AND date BETWEEN $2 AND $3`, [millId, startDate, endDate]),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM purchases WHERE mill_id=$1 AND date BETWEEN $2 AND $3 AND deleted_at IS NULL`, [millId, startDate, endDate]),
  ]);
  const revenue = parseFloat(revenueRes.rows[0].total);
  const expenses = parseFloat(expRes.rows[0].total);
  const purchases = parseFloat(purRes.rows[0].total);
  const grossProfit = revenue - purchases;
  const netProfit = grossProfit - expenses;
  success(res, { startDate, endDate, revenue, purchases, grossProfit, expenses, netProfit });
});

module.exports = router;
