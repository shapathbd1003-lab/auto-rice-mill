const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

const CASH_IN_CATEGORIES  = ['sales_income','payment_received','other_income'];
const CASH_OUT_CATEGORIES = ['paddy_purchase','salary','transport','electricity','maintenance','packaging','fuel','miscellaneous'];

// GET /api/khata/cashbook?date=&from=&to=&type=&page=
router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  const { from, to, type, date } = req.query;

  const params = [millId];
  let where = 'mill_id=$1 AND deleted_at IS NULL';
  if (date)  { params.push(date);  where += ` AND date=$${params.length}`; }
  if (from)  { params.push(from);  where += ` AND date>=$${params.length}`; }
  if (to)    { params.push(to);    where += ` AND date<=$${params.length}`; }
  if (type)  { params.push(type);  where += ` AND type=$${params.length}`; }

  const [rows, cnt, summary] = await Promise.all([
    query(`SELECT * FROM cash_transactions WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM cash_transactions WHERE ${where}`, params),
    query(`SELECT type, COALESCE(SUM(amount),0) AS total FROM cash_transactions WHERE ${where} GROUP BY type`, params),
  ]);

  const cashIn  = summary.rows.find((r) => r.type === 'in')?.total  || 0;
  const cashOut = summary.rows.find((r) => r.type === 'out')?.total || 0;

  res.json({
    success: true,
    data: rows.rows,
    pagination: { page, limit, total: parseInt(cnt.rows[0].total) },
    summary: { cashIn: Number(cashIn), cashOut: Number(cashOut), balance: Number(cashIn) - Number(cashOut) },
  });
});

// GET /api/khata/cashbook/balance — running cash balance from accounts table
router.get('/balance', async (req, res) => {
  const r = await query(
    `SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE mill_id=$1 AND type='cash' AND is_active=TRUE`,
    [req.user.millId]
  );
  success(res, { balance: Number(r.rows[0].total) });
});

// POST /api/khata/cashbook — add cash in / cash out
router.post('/', requireRole('admin','manager','accountant'), validate(Joi.object({
  date:        Joi.string().required(),
  type:        Joi.string().valid('in','out').required(),
  category:    Joi.string().max(50).required(),
  description: Joi.string().max(300).required(),
  amount:      Joi.number().positive().required(),
  account_id:  Joi.number().integer().optional(),
})), async (req, res) => {
  const { date, type, category, description, amount, account_id } = req.body;
  const millId = req.user.millId;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      `INSERT INTO cash_transactions (mill_id,date,type,category,description,amount,account_id,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [millId, date, type, category, description, amount, account_id || null, req.user.id]
    );

    // update account balance
    if (account_id) {
      const delta = type === 'in' ? amount : -amount;
      await client.query('UPDATE accounts SET balance=balance+$1, updated_at=NOW() WHERE id=$2', [delta, account_id]);
    }

    await client.query('COMMIT');
    created(res, r.rows[0], `Cash ${type === 'in' ? 'In' : 'Out'} recorded`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// PUT /api/khata/cashbook/:id
router.put('/:id', requireRole('admin','manager','accountant'), async (req, res) => {
  const millId = req.user.millId;
  const existing = await query('SELECT * FROM cash_transactions WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, millId]);
  if (!existing.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });

  const old = existing.rows[0];
  const { description, amount, category, date } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE cash_transactions SET description=$1,amount=$2,category=$3,date=$4,updated_at=NOW() WHERE id=$5`,
      [description ?? old.description, amount ?? old.amount, category ?? old.category, date ?? old.date, old.id]
    );

    // adjust account balance for amount change
    if (old.account_id && amount !== undefined) {
      const oldDelta = old.type === 'in' ? old.amount : -old.amount;
      const newDelta = old.type === 'in' ? amount       : -amount;
      await client.query('UPDATE accounts SET balance=balance+$1, updated_at=NOW() WHERE id=$2', [newDelta - oldDelta, old.account_id]);
    }

    await client.query('COMMIT');
    success(res, null, 'Transaction updated');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// DELETE /api/khata/cashbook/:id
router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  const millId = req.user.millId;
  const existing = await query('SELECT * FROM cash_transactions WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, millId]);
  if (!existing.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });

  const old = existing.rows[0];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE cash_transactions SET deleted_at=NOW() WHERE id=$1', [old.id]);
    if (old.account_id) {
      const delta = old.type === 'in' ? -old.amount : old.amount;
      await client.query('UPDATE accounts SET balance=balance+$1, updated_at=NOW() WHERE id=$2', [delta, old.account_id]);
    }
    await client.query('COMMIT');
    success(res, null, 'Transaction deleted');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// GET /api/khata/cashbook/categories
router.get('/categories', (_req, res) => {
  success(res, { cashIn: CASH_IN_CATEGORIES, cashOut: CASH_OUT_CATEGORIES });
});

module.exports = router;
