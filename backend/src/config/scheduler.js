const cron = require('node-cron');
const { query } = require('./database');
const { logger } = require('../utils/logger');

// Runs every day at 08:00 local time
const DAILY_CRON = '0 8 * * *';

async function insertNotification(millId, userId, type, title, message) {
  try {
    await query(
      `INSERT INTO notifications (mill_id, user_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
      [millId, userId, type, title, message]
    );
  } catch (err) {
    logger.error(`Notification insert failed [mill=${millId}]: ${err.message}`);
  }
}

async function notifyAllAdmins(millId, type, title, message) {
  const admins = await query(
    `SELECT id FROM users WHERE mill_id=$1 AND role IN ('admin','manager') AND is_active=TRUE`,
    [millId]
  );
  await Promise.all(admins.rows.map((u) => insertNotification(millId, u.id, type, title, message)));
}

// ── Low stock alert ─────────────────────────────────────────────────────────
async function checkLowStock() {
  const mills = await query('SELECT DISTINCT mill_id FROM inventory_items WHERE is_active=TRUE');
  for (const { mill_id } of mills.rows) {
    const r = await query(
      `SELECT name, current_stock, reorder_level, unit FROM inventory_items
       WHERE mill_id=$1 AND is_active=TRUE AND current_stock <= reorder_level`,
      [mill_id]
    );
    if (!r.rows.length) continue;
    const itemList = r.rows.map((i) => `${i.name} (${i.current_stock} ${i.unit})`).join(', ');
    await notifyAllAdmins(
      mill_id, 'LOW_STOCK',
      `Low Stock Alert — ${r.rows.length} item(s)`,
      `The following items are at or below reorder level: ${itemList}`
    );
    logger.info(`[cron] low-stock alert sent for mill ${mill_id}: ${r.rows.length} items`);
  }
}

// ── Overdue customer payments ───────────────────────────────────────────────
async function checkOverduePayments() {
  const mills = await query('SELECT DISTINCT mill_id FROM sales_orders');
  for (const { mill_id } of mills.rows) {
    const r = await query(
      `SELECT c.name, so.invoice_number, so.total_amount, so.date
       FROM sales_orders so JOIN customers c ON c.id=so.customer_id
       WHERE so.mill_id=$1 AND so.payment_status IN ('unpaid','partial')
         AND so.date < NOW() - INTERVAL '30 days' AND so.deleted_at IS NULL`,
      [mill_id]
    );
    if (!r.rows.length) continue;
    const list = r.rows.slice(0, 5).map((o) => `${o.name} — Invoice ${o.invoice_number}`).join('; ');
    const more = r.rows.length > 5 ? ` (+${r.rows.length - 5} more)` : '';
    await notifyAllAdmins(
      mill_id, 'OVERDUE_PAYMENT',
      `Overdue Payments — ${r.rows.length} invoice(s)`,
      `Invoices overdue 30+ days: ${list}${more}`
    );
    logger.info(`[cron] overdue-payment alert sent for mill ${mill_id}: ${r.rows.length} invoices`);
  }
}

// ── Pending salary disbursement ─────────────────────────────────────────────
async function checkSalaryDisbursement() {
  const today = new Date();
  // Alert on the 25th of each month
  if (today.getDate() !== 25) return;

  const currentMonth = today.toISOString().slice(0, 7);
  const mills = await query('SELECT DISTINCT mill_id FROM employees WHERE is_active=TRUE');
  for (const { mill_id } of mills.rows) {
    const undisbursed = await query(
      `SELECT COUNT(*) AS cnt FROM employees e
       WHERE e.mill_id=$1 AND e.is_active=TRUE
         AND NOT EXISTS (SELECT 1 FROM salaries s WHERE s.employee_id=e.id AND s.month=$2)`,
      [mill_id, currentMonth]
    );
    const cnt = parseInt(undisbursed.rows[0].cnt, 10);
    if (!cnt) continue;
    await notifyAllAdmins(
      mill_id, 'SALARY_REMINDER',
      `Salary Reminder — ${cnt} employee(s) not processed`,
      `Salary for ${currentMonth} has not been processed for ${cnt} employee(s). Please process before month end.`
    );
    logger.info(`[cron] salary reminder sent for mill ${mill_id}: ${cnt} employees`);
  }
}

// ── Daily summary ───────────────────────────────────────────────────────────
async function sendDailySummary() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const mills = await query('SELECT id FROM rice_mills WHERE is_active=TRUE');
  for (const { id: mill_id } of mills.rows) {
    const [sales, purch, prod] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_orders WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [mill_id, yesterday]),
      query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM purchases WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [mill_id, yesterday]),
      query(`SELECT COALESCE(SUM(paddy_quantity),0) AS total FROM production_batches WHERE mill_id=$1 AND date=$2`, [mill_id, yesterday]),
    ]);
    const salesAmt = parseFloat(sales.rows[0].total).toLocaleString('en-BD');
    const purchAmt = parseFloat(purch.rows[0].total).toLocaleString('en-BD');
    const paddyKg  = parseFloat(prod.rows[0].total).toLocaleString('en-BD');
    await notifyAllAdmins(
      mill_id, 'DAILY_SUMMARY',
      `Daily Summary — ${yesterday}`,
      `Sales: BDT ${salesAmt}  |  Purchases: BDT ${purchAmt}  |  Paddy Processed: ${paddyKg} kg`
    );
  }
  logger.info(`[cron] daily summary sent for ${mills.rows.length} mill(s)`);
}

function startScheduler() {
  logger.info('[cron] Scheduler starting — daily job at 08:00');

  cron.schedule(DAILY_CRON, async () => {
    logger.info('[cron] Running daily tasks...');
    try { await sendDailySummary();       } catch (e) { logger.error('[cron] sendDailySummary failed', e); }
    try { await checkLowStock();          } catch (e) { logger.error('[cron] checkLowStock failed', e); }
    try { await checkOverduePayments();   } catch (e) { logger.error('[cron] checkOverduePayments failed', e); }
    try { await checkSalaryDisbursement();} catch (e) { logger.error('[cron] checkSalaryDisbursement failed', e); }
    logger.info('[cron] Daily tasks complete');
  }, { timezone: 'Asia/Dhaka' });
}

module.exports = { startScheduler };
