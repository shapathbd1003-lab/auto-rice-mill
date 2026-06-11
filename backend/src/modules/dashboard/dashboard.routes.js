const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const millId = req.user.millId;
  const today = new Date().toISOString().slice(0, 10);

  const [salesRes, prodRes, stockRes, dueRes, lowStockRes] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
           FROM sales_orders WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [millId, today]),
    query(`SELECT COALESCE(SUM(paddy_quantity),0) AS total, COUNT(*) AS count
           FROM production_batches WHERE mill_id=$1 AND date=$2`, [millId, today]),
    query(`SELECT category, COALESCE(SUM(current_stock),0) AS total
           FROM inventory_items WHERE mill_id=$1 AND is_active=TRUE GROUP BY category`, [millId]),
    query(`SELECT COALESCE(SUM(due_amount),0) AS total FROM sales_orders WHERE mill_id=$1 AND due_amount>0 AND deleted_at IS NULL`, [millId]),
    query(`SELECT id, code, name, current_stock, reorder_level, unit FROM inventory_items
           WHERE mill_id=$1 AND current_stock <= reorder_level AND is_active=TRUE`, [millId]),
  ]);

  success(res, {
    todaySales:     { total: parseFloat(salesRes.rows[0].total), count: parseInt(salesRes.rows[0].count) },
    todayProduction:{ total: parseFloat(prodRes.rows[0].total), count: parseInt(prodRes.rows[0].count) },
    stockByCategory: stockRes.rows,
    totalDue:       parseFloat(dueRes.rows[0].total),
    lowStockItems:  lowStockRes.rows,
  });
});

module.exports = router;
