const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

// GET /api/khata/summary — TallyKhata dashboard numbers
router.get('/summary', async (req, res) => {
  const millId = req.user.millId;
  const today  = new Date().toISOString().slice(0, 10);

  const [
    todaySales,
    todayPurchases,
    customerDue,
    supplierDue,
    cashBalance,
    recentTx,
  ] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sales_orders WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL AND status='active'`,
      [millId, today]
    ),
    query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM purchases WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`,
      [millId, today]
    ),
    query(
      `SELECT COALESCE(SUM(balance),0) AS total, COUNT(*) AS count
       FROM customers WHERE mill_id=$1 AND balance > 0 AND deleted_at IS NULL`,
      [millId]
    ),
    query(
      `SELECT COALESCE(SUM(balance),0) AS total, COUNT(*) AS count
       FROM suppliers WHERE mill_id=$1 AND balance > 0 AND deleted_at IS NULL`,
      [millId]
    ),
    query(
      `SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE mill_id=$1 AND is_active=TRUE`,
      [millId]
    ),
    // last 10 transactions across sales, purchases, cash_transactions
    query(
      `(SELECT 'sale' AS type, invoice_number AS ref, total_amount AS amount, date, created_at
          FROM sales_orders WHERE mill_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5)
       UNION ALL
       (SELECT 'purchase' AS type, invoice_number AS ref, total_amount AS amount, date, created_at
          FROM purchases WHERE mill_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5)
       UNION ALL
       (SELECT CONCAT('cash_',type) AS type, category AS ref, amount, date, created_at
          FROM cash_transactions WHERE mill_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5)
       ORDER BY created_at DESC LIMIT 10`,
      [millId]
    ),
  ]);

  success(res, {
    todaySales:     { total: Number(todaySales.rows[0].total),     count: Number(todaySales.rows[0].count) },
    todayPurchases: { total: Number(todayPurchases.rows[0].total), count: Number(todayPurchases.rows[0].count) },
    customerDue:    { total: Number(customerDue.rows[0].total),    count: Number(customerDue.rows[0].count) },
    supplierDue:    { total: Number(supplierDue.rows[0].total),    count: Number(supplierDue.rows[0].count) },
    cashBalance:    Number(cashBalance.rows[0].total),
    recentTransactions: recentTx.rows,
  });
});

module.exports = router;
