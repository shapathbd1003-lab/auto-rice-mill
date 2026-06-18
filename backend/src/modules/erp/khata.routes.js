/**
 * Universal Khata API
 * Any ledger group can act as a Khata (Customer/Supplier/Employee/Bank/Custom).
 * Transactions are posted as vouchers into the double-entry system.
 */
const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { postToLedger } = require('./vouchers.routes');

router.use(requireAuth);

// ── GET /api/erp/khata/groups — all groups with ledger counts ─
router.get('/groups', async (req, res) => {
  const rows = await query(
    `SELECT lg.*,
            p.name AS parent_name,
            COUNT(l.id) AS ledger_count,
            COALESCE(SUM(l.current_balance),0) AS total_balance
     FROM ledger_groups lg
     LEFT JOIN ledger_groups p ON p.id = lg.parent_id
     LEFT JOIN ledgers l ON l.group_id = lg.id AND l.deleted_at IS NULL AND l.mill_id = lg.mill_id
     WHERE lg.mill_id = $1
     GROUP BY lg.id, p.name
     ORDER BY lg.nature, lg.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

// ── GET /api/erp/khata/groups/:groupId/ledgers ────────────────
router.get('/groups/:groupId/ledgers', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { search } = req.query;
  const millId = req.user.millId;

  const params = [millId, req.params.groupId];
  let where = 'l.mill_id=$1 AND l.group_id=$2 AND l.deleted_at IS NULL';
  if (search) { params.push(`%${search}%`); where += ` AND (l.name ILIKE $${params.length} OR l.phone ILIKE $${params.length})`; }

  const [rows, cnt] = await Promise.all([
    query(`SELECT l.*, lg.name AS group_name, lg.group_type, lg.nature
           FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
           WHERE ${where} ORDER BY l.name
           LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM ledgers l WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

// ── GET /api/erp/khata/ledgers/:ledgerId — ledger detail + balance ─
router.get('/ledgers/:ledgerId', async (req, res) => {
  const r = await query(
    `SELECT l.*, lg.name AS group_name, lg.group_type, lg.nature
     FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE l.id=$1 AND l.mill_id=$2 AND l.deleted_at IS NULL`,
    [req.params.ledgerId, req.user.millId]
  );
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Ledger not found'} });
  success(res, r.rows[0]);
});

// ── GET /api/erp/khata/ledgers/:ledgerId/transactions ─────────
router.get('/ledgers/:ledgerId/transactions', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { from, to } = req.query;
  const millId = req.user.millId;

  const params = [req.params.ledgerId, millId];
  let where = 'lp.ledger_id=$1 AND lp.mill_id=$2';
  if (from) { params.push(from); where += ` AND lp.date>=$${params.length}`; }
  if (to)   { params.push(to);   where += ` AND lp.date<=$${params.length}`; }

  const [rows, cnt, summary] = await Promise.all([
    query(`SELECT lp.*, v.voucher_number, v.voucher_type, v.narration, v.reference
           FROM ledger_postings lp JOIN vouchers v ON v.id=lp.voucher_id
           WHERE ${where} ORDER BY lp.date DESC, lp.id DESC
           LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM ledger_postings lp WHERE ${where}`, params),
    query(`SELECT
             COALESCE(SUM(CASE WHEN lp.entry_type='Dr' THEN lp.amount ELSE 0 END),0) AS total_dr,
             COALESCE(SUM(CASE WHEN lp.entry_type='Cr' THEN lp.amount ELSE 0 END),0) AS total_cr
           FROM ledger_postings lp WHERE ${where}`, params),
  ]);

  res.json({
    success: true,
    data: rows.rows,
    pagination: { page, limit, total: parseInt(cnt.rows[0].total) },
    summary: {
      totalDr: Number(summary.rows[0].total_dr),
      totalCr: Number(summary.rows[0].total_cr),
    },
  });
});

// ── POST /api/erp/khata/ledgers/:ledgerId/add-due ─────────────
// Quick "Add Due" — posts a debit to the ledger via a journal voucher
router.post('/ledgers/:ledgerId/add-due', requireRole('admin','manager','accountant','sales'), validate(Joi.object({
  amount:      Joi.number().positive().required(),
  date:        Joi.string().required(),
  description: Joi.string().required(),
  counter_ledger_id: Joi.number().integer().allow(null), // which income/asset to credit
})), async (req, res) => {
  const { amount, date, description, counter_ledger_id } = req.body;
  const millId = req.user.millId;

  // Determine counter ledger: default to "Rice Sales" or first income ledger
  let counterLedgerId = counter_ledger_id;
  if (!counterLedgerId) {
    const def = await query(
      `SELECT l.id FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND lg.nature='income' AND l.deleted_at IS NULL ORDER BY l.id LIMIT 1`,
      [millId]
    );
    counterLedgerId = def.rows[0]?.id;
  }
  if (!counterLedgerId) return res.status(400).json({ success:false, error:{code:'NO_COUNTER_LEDGER',message:'No income ledger found. Create one first.'} });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const seq = (await client.query(`SELECT COUNT(*)+1 AS n FROM vouchers WHERE mill_id=$1 AND voucher_type='journal' AND EXTRACT(YEAR FROM date)=$2`, [millId, new Date(date).getFullYear()])).rows[0].n;
    const vno = `JV-${new Date(date).getFullYear()}-${String(seq).padStart(4,'0')}`;

    const vRes = await client.query(
      `INSERT INTO vouchers (mill_id, voucher_type, voucher_number, date, narration, total_amount, status, is_posted, created_by)
       VALUES ($1,'journal',$2,$3,$4,$5,'approved',TRUE,$6) RETURNING *`,
      [millId, vno, date, description, amount, req.user.id]
    );
    const vid = vRes.rows[0].id;

    const [vi1, vi2] = await Promise.all([
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount, narration) VALUES ($1,$2,'Dr',$3,$4) RETURNING id`, [vid, req.params.ledgerId, amount, description]),
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount, narration) VALUES ($1,$2,'Cr',$3,$4) RETURNING id`, [vid, counterLedgerId, amount, description]),
    ]);

    await postToLedger(client, millId, vid, vi1.rows[0].id, Number(req.params.ledgerId), 'Dr', amount, date);
    await postToLedger(client, millId, vid, vi2.rows[0].id, counterLedgerId, 'Cr', amount, date);

    await client.query('COMMIT');
    success(res, { voucher_number: vno }, 'Due added');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
});

// ── POST /api/erp/khata/ledgers/:ledgerId/receive-payment ─────
// Quick "Receive Payment" — posts a credit to the ledger via receipt voucher
router.post('/ledgers/:ledgerId/receive-payment', requireRole('admin','manager','accountant','sales'), validate(Joi.object({
  amount:      Joi.number().positive().required(),
  date:        Joi.string().required(),
  description: Joi.string().required(),
  cash_ledger_id: Joi.number().integer().allow(null),
})), async (req, res) => {
  const { amount, date, description, cash_ledger_id } = req.body;
  const millId = req.user.millId;

  let cashLedgerId = cash_ledger_id;
  if (!cashLedgerId) {
    const def = await query(
      `SELECT l.id FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND (l.name ILIKE '%cash%' OR lg.name ILIKE '%cash%') AND l.deleted_at IS NULL
       ORDER BY l.id LIMIT 1`, [millId]
    );
    cashLedgerId = def.rows[0]?.id;
  }
  if (!cashLedgerId) return res.status(400).json({ success:false, error:{code:'NO_CASH_LEDGER',message:'No cash ledger found.'} });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const seq = (await client.query(`SELECT COUNT(*)+1 AS n FROM vouchers WHERE mill_id=$1 AND voucher_type='receipt' AND EXTRACT(YEAR FROM date)=$2`, [millId, new Date(date).getFullYear()])).rows[0].n;
    const vno = `RV-${new Date(date).getFullYear()}-${String(seq).padStart(4,'0')}`;

    const vRes = await client.query(
      `INSERT INTO vouchers (mill_id, voucher_type, voucher_number, date, narration, total_amount, status, is_posted, created_by)
       VALUES ($1,'receipt',$2,$3,$4,$5,'approved',TRUE,$6) RETURNING *`,
      [millId, vno, date, description, amount, req.user.id]
    );
    const vid = vRes.rows[0].id;

    const [vi1, vi2] = await Promise.all([
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount) VALUES ($1,$2,'Dr',$3) RETURNING id`, [vid, cashLedgerId, amount]),
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount) VALUES ($1,$2,'Cr',$3) RETURNING id`, [vid, req.params.ledgerId, amount]),
    ]);

    await postToLedger(client, millId, vid, vi1.rows[0].id, cashLedgerId, 'Dr', amount, date);
    await postToLedger(client, millId, vid, vi2.rows[0].id, Number(req.params.ledgerId), 'Cr', amount, date);

    await client.query('COMMIT');
    success(res, { voucher_number: vno }, 'Payment received');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
});

// ── POST /api/erp/khata/ledgers/:ledgerId/make-payment ────────
// Quick "Make Payment" — pay a supplier/expense ledger
router.post('/ledgers/:ledgerId/make-payment', requireRole('admin','manager','accountant'), validate(Joi.object({
  amount:         Joi.number().positive().required(),
  date:           Joi.string().required(),
  description:    Joi.string().required(),
  cash_ledger_id: Joi.number().integer().allow(null),
})), async (req, res) => {
  const { amount, date, description, cash_ledger_id } = req.body;
  const millId = req.user.millId;

  let cashLedgerId = cash_ledger_id;
  if (!cashLedgerId) {
    const def = await query(
      `SELECT l.id FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND (l.name ILIKE '%cash%') AND l.deleted_at IS NULL ORDER BY l.id LIMIT 1`, [millId]
    );
    cashLedgerId = def.rows[0]?.id;
  }
  if (!cashLedgerId) return res.status(400).json({ success:false, error:{code:'NO_CASH_LEDGER',message:'No cash ledger found.'} });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const seq = (await client.query(`SELECT COUNT(*)+1 AS n FROM vouchers WHERE mill_id=$1 AND voucher_type='payment' AND EXTRACT(YEAR FROM date)=$2`, [millId, new Date(date).getFullYear()])).rows[0].n;
    const vno = `PMT-${new Date(date).getFullYear()}-${String(seq).padStart(4,'0')}`;

    const vRes = await client.query(
      `INSERT INTO vouchers (mill_id, voucher_type, voucher_number, date, narration, total_amount, status, is_posted, created_by)
       VALUES ($1,'payment',$2,$3,$4,$5,'approved',TRUE,$6) RETURNING *`,
      [millId, vno, date, description, amount, req.user.id]
    );
    const vid = vRes.rows[0].id;

    const [vi1, vi2] = await Promise.all([
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount) VALUES ($1,$2,'Dr',$3) RETURNING id`, [vid, req.params.ledgerId, amount]),
      client.query(`INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount) VALUES ($1,$2,'Cr',$3) RETURNING id`, [vid, cashLedgerId, amount]),
    ]);

    await postToLedger(client, millId, vid, vi1.rows[0].id, Number(req.params.ledgerId), 'Dr', amount, date);
    await postToLedger(client, millId, vid, vi2.rows[0].id, cashLedgerId, 'Cr', amount, date);

    await client.query('COMMIT');
    success(res, { voucher_number: vno }, 'Payment made');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
});

// ── GET /api/erp/khata/summary — accounts dashboard ──────────
router.get('/summary', async (req, res) => {
  const millId = req.user.millId;
  const today  = new Date().toISOString().slice(0, 10);

  const [groups, dueCustomers, dueSuppliers, todaySales, todayPurchases, cashBal] = await Promise.all([
    query(
      `SELECT lg.name, lg.group_type, lg.nature,
              COUNT(l.id) AS count,
              COALESCE(SUM(l.current_balance),0) AS total_balance
       FROM ledger_groups lg
       LEFT JOIN ledgers l ON l.group_id=lg.id AND l.mill_id=lg.mill_id AND l.deleted_at IS NULL
       WHERE lg.mill_id=$1
       GROUP BY lg.id ORDER BY lg.nature, lg.name`,
      [millId]
    ),
    query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(l.current_balance),0) AS total
       FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND lg.group_type='customer' AND l.current_balance>0 AND l.deleted_at IS NULL`,
      [millId]
    ),
    query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(l.current_balance),0) AS total
       FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND lg.group_type='supplier' AND l.current_balance>0 AND l.deleted_at IS NULL`,
      [millId]
    ),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM sales_orders WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL AND status='active'`, [millId, today]),
    query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM purchases WHERE mill_id=$1 AND date=$2 AND deleted_at IS NULL`, [millId, today]),
    query(
      `SELECT COALESCE(SUM(l.current_balance),0) AS total
       FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
       WHERE l.mill_id=$1 AND (lg.name ILIKE '%cash%' OR lg.group_type='bank') AND l.deleted_at IS NULL`,
      [millId]
    ),
  ]);

  success(res, {
    groups: groups.rows,
    customerDue:    { count: Number(dueCustomers.rows[0].count), total: Number(dueCustomers.rows[0].total) },
    supplierDue:    { count: Number(dueSuppliers.rows[0].count), total: Number(dueSuppliers.rows[0].total) },
    todaySales:     { count: Number(todaySales.rows[0].count),   total: Number(todaySales.rows[0].total) },
    todayPurchases: { count: Number(todayPurchases.rows[0].count), total: Number(todayPurchases.rows[0].total) },
    cashBalance:    Number(cashBal.rows[0].total),
  });
});

// ── GET /api/erp/khata/due-report — due list for any group type ─
router.get('/due-report', async (req, res) => {
  const { group_type, min_balance } = req.query;
  const millId = req.user.millId;
  const params = [millId];
  let where = 'l.mill_id=$1 AND l.deleted_at IS NULL AND l.current_balance != 0';
  if (group_type) { params.push(group_type); where += ` AND lg.group_type=$${params.length}`; }
  if (min_balance) { params.push(min_balance); where += ` AND ABS(l.current_balance)>=$${params.length}`; }

  const rows = await query(
    `SELECT l.id, l.name, l.phone, l.current_balance, l.balance_type, lg.name AS group_name, lg.group_type
     FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE ${where}
     ORDER BY ABS(l.current_balance) DESC`,
    params
  );
  success(res, rows.rows);
});

module.exports = router;
