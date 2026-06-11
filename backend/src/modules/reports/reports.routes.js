const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');
const { generateDailyReportPDF } = require('./generators/dailyReport.pdf');
const { generateInvoicePDF }     = require('./generators/invoice.pdf');
const { generateSalarySlipPDF }  = require('./generators/salarySlip.pdf');
const { generateStatementPDF }   = require('./generators/statement.pdf');

router.use(requireAuth);
router.use(requireRole('admin', 'manager', 'accountant'));

// ── JSON Reports ────────────────────────────────────────────────────────────

router.get('/daily', async (req, res) => {
  const millId = req.user.millId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const [salesRes, purchRes, prodRes, expRes] = await Promise.all([
    query(`SELECT so.*, c.name AS customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id
           WHERE so.mill_id=$1 AND so.date=$2 AND so.deleted_at IS NULL`, [millId, date]),
    query(`SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
           WHERE p.mill_id=$1 AND p.date=$2 AND p.deleted_at IS NULL`, [millId, date]),
    query(`SELECT * FROM production_batches WHERE mill_id=$1 AND date=$2`, [millId, date]),
    query(`SELECT * FROM expenses WHERE mill_id=$1 AND date=$2`, [millId, date]),
  ]);

  success(res, {
    date,
    sales:      { items: salesRes.rows,  total: salesRes.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0) },
    purchases:  { items: purchRes.rows,  total: purchRes.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0) },
    production: { items: prodRes.rows,   total: prodRes.rows.reduce((s, r) => s + parseFloat(r.paddy_quantity || 0), 0) },
    expenses:   { items: expRes.rows,    total: expRes.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0) },
  });
});

router.get('/customer-due', async (req, res) => {
  const r = await query(
    `SELECT c.id, c.code, c.name, c.phone, c.balance AS due_amount
     FROM customers c WHERE c.mill_id=$1 AND c.balance > 0 AND c.deleted_at IS NULL ORDER BY c.balance DESC`,
    [req.user.millId]
  );
  success(res, r.rows);
});

router.get('/supplier-due', async (req, res) => {
  const r = await query(
    `SELECT s.id, s.code, s.name, s.phone, s.balance AS due_amount
     FROM suppliers s WHERE s.mill_id=$1 AND s.balance > 0 AND s.deleted_at IS NULL ORDER BY s.balance DESC`,
    [req.user.millId]
  );
  success(res, r.rows);
});

router.get('/inventory', async (req, res) => {
  const r = await query(
    `SELECT category, name, code, unit, current_stock, reorder_level, sale_price,
            current_stock * COALESCE(sale_price,0) AS stock_value
     FROM inventory_items WHERE mill_id=$1 AND is_active=TRUE ORDER BY category, name`,
    [req.user.millId]
  );
  success(res, r.rows);
});

router.get('/production', async (req, res) => {
  const millId = req.user.millId;
  const { startDate = new Date().toISOString().slice(0, 7) + '-01', endDate = new Date().toISOString().slice(0, 10) } = req.query;
  const r = await query(
    `SELECT pb.*, json_agg(po.*) AS outputs FROM production_batches pb
     LEFT JOIN production_outputs po ON po.batch_id=pb.id
     WHERE pb.mill_id=$1 AND pb.date BETWEEN $2 AND $3
     GROUP BY pb.id ORDER BY pb.date DESC`,
    [millId, startDate, endDate]
  );
  success(res, r.rows);
});

router.get('/employee-salary', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const r = await query(
    `SELECT s.*, e.name AS employee_name, e.code AS employee_code, e.designation, e.department, e.phone, e.join_date
     FROM salaries s JOIN employees e ON e.id=s.employee_id
     WHERE s.mill_id=$1 AND s.month=$2 ORDER BY e.name`,
    [req.user.millId, month]
  );
  success(res, r.rows);
});

// ── PDF Exports ─────────────────────────────────────────────────────────────

router.get('/daily/pdf', async (req, res) => {
  const millId   = req.user.millId;
  const millName = req.user.millName || 'Auto Rice Mill';
  const date     = req.query.date || new Date().toISOString().slice(0, 10);

  const [salesRes, purchRes, prodRes, expRes] = await Promise.all([
    query(`SELECT so.*, c.name AS customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id
           WHERE so.mill_id=$1 AND so.date=$2 AND so.deleted_at IS NULL`, [millId, date]),
    query(`SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
           WHERE p.mill_id=$1 AND p.date=$2 AND p.deleted_at IS NULL`, [millId, date]),
    query(`SELECT * FROM production_batches WHERE mill_id=$1 AND date=$2`, [millId, date]),
    query(`SELECT * FROM expenses WHERE mill_id=$1 AND date=$2`, [millId, date]),
  ]);

  const data = {
    date,
    sales:      { items: salesRes.rows,  total: salesRes.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0) },
    purchases:  { items: purchRes.rows,  total: purchRes.rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0) },
    production: { items: prodRes.rows,   total: prodRes.rows.reduce((s, r) => s + parseFloat(r.paddy_quantity || 0), 0) },
    expenses:   { items: expRes.rows,    total: expRes.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0) },
  };

  const buf = await generateDailyReportPDF(data, millName);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="daily-report-${date}.pdf"` });
  res.send(buf);
});

router.get('/invoice/:orderId/pdf', async (req, res) => {
  const millName = req.user.millName || 'Auto Rice Mill';
  const orderRes = await query(
    `SELECT so.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM sales_orders so JOIN customers c ON c.id=so.customer_id
     WHERE so.id=$1 AND so.mill_id=$2 AND so.deleted_at IS NULL`,
    [req.params.orderId, req.user.millId]
  );
  if (!orderRes.rows.length) return res.status(404).json({ success: false, error: { message: 'Order not found' } });

  const order = orderRes.rows[0];
  const itemsRes = await query(
    `SELECT soi.*, ii.name AS item_name, ii.unit FROM sales_order_items soi
     JOIN inventory_items ii ON ii.id=soi.item_id WHERE soi.order_id=$1`,
    [order.id]
  );
  order.items = itemsRes.rows;

  const buf = await generateInvoicePDF(order, millName);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${order.invoice_number}.pdf"` });
  res.send(buf);
});

router.get('/salary-slip/:salaryId/pdf', async (req, res) => {
  const millName = req.user.millName || 'Auto Rice Mill';
  const r = await query(
    `SELECT s.*, e.name AS employee_name, e.code AS employee_code, e.designation, e.department, e.phone, e.join_date
     FROM salaries s JOIN employees e ON e.id=s.employee_id
     WHERE s.id=$1 AND s.mill_id=$2`,
    [req.params.salaryId, req.user.millId]
  );
  if (!r.rows.length) return res.status(404).json({ success: false, error: { message: 'Salary record not found' } });

  const buf = await generateSalarySlipPDF(r.rows[0], millName);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="salary-slip-${r.rows[0].employee_code}-${r.rows[0].month}.pdf"` });
  res.send(buf);
});

router.get('/customer-statement/:customerId/pdf', async (req, res) => {
  const millName = req.user.millName || 'Auto Rice Mill';
  const { startDate = new Date().toISOString().slice(0, 7) + '-01', endDate = new Date().toISOString().slice(0, 10) } = req.query;

  const custRes = await query('SELECT * FROM customers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.customerId, req.user.millId]);
  if (!custRes.rows.length) return res.status(404).json({ success: false, error: { message: 'Customer not found' } });

  const txRes = await query(
    `SELECT date, reference_number AS reference, description, debit_amount AS debit, credit_amount AS credit
     FROM ledger_entries WHERE party_type='customer' AND party_id=$1 AND mill_id=$2 AND date BETWEEN $3 AND $4
     ORDER BY date, id`,
    [req.params.customerId, req.user.millId, startDate, endDate]
  );

  const buf = await generateStatementPDF({ type: 'customer', party: custRes.rows[0], transactions: txRes.rows, startDate, endDate }, millName);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="customer-statement-${custRes.rows[0].code}-${startDate}.pdf"` });
  res.send(buf);
});

router.get('/supplier-statement/:supplierId/pdf', async (req, res) => {
  const millName = req.user.millName || 'Auto Rice Mill';
  const { startDate = new Date().toISOString().slice(0, 7) + '-01', endDate = new Date().toISOString().slice(0, 10) } = req.query;

  const suppRes = await query('SELECT * FROM suppliers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.supplierId, req.user.millId]);
  if (!suppRes.rows.length) return res.status(404).json({ success: false, error: { message: 'Supplier not found' } });

  const txRes = await query(
    `SELECT date, reference_number AS reference, description, debit_amount AS debit, credit_amount AS credit
     FROM ledger_entries WHERE party_type='supplier' AND party_id=$1 AND mill_id=$2 AND date BETWEEN $3 AND $4
     ORDER BY date, id`,
    [req.params.supplierId, req.user.millId, startDate, endDate]
  );

  const buf = await generateStatementPDF({ type: 'supplier', party: suppRes.rows[0], transactions: txRes.rows, startDate, endDate }, millName);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="supplier-statement-${suppRes.rows[0].code}-${startDate}.pdf"` });
  res.send(buf);
});

module.exports = router;
