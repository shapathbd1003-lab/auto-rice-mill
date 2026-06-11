const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  let sql = `SELECT id,code,name,name_bn,phone,address,balance,is_active FROM suppliers WHERE mill_id=$1 AND deleted_at IS NULL`;
  const params = [millId];
  if (req.query.search) { sql += ` AND (name ILIKE $2 OR code ILIKE $2 OR phone ILIKE $2)`; params.push(`%${req.query.search}%`); }
  const countRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM'), params);
  const total = parseInt(countRes.rows[0].total);
  sql += ` ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
  const result = await query(sql, params);
  paginated(res, result.rows, total, page, limit);
});

router.post('/', requireRole('admin','manager'), validate(Joi.object({
  code:            Joi.string().max(20).required(),
  name:            Joi.string().max(150).required(),
  name_bn:         Joi.string().allow('', null),
  phone:           Joi.string().allow('', null),
  address:         Joi.string().allow('', null),
  opening_balance: Joi.number().default(0),
})), async (req, res) => {
  const { code, name, name_bn, phone, address, opening_balance = 0 } = req.body;
  const r = await query(
    `INSERT INTO suppliers (mill_id,code,name,name_bn,phone,address,opening_balance,balance,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8) RETURNING *`,
    [req.user.millId, code, name, name_bn, phone, address, opening_balance, req.user.id]
  );
  created(res, r.rows[0], 'Supplier created');
});

router.get('/:id', async (req, res) => {
  const r = await query('SELECT * FROM suppliers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
  if (!r.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
  success(res, r.rows[0]);
});

router.put('/:id', requireRole('admin','manager'), async (req, res) => {
  const allowed = ['name','name_bn','phone','address','is_active'];
  const updates = []; const params = []; let idx = 1;
  for (const f of allowed) if (req.body[f] !== undefined) { updates.push(`${f}=$${idx++}`); params.push(req.body[f]); }
  updates.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  const r = await query(`UPDATE suppliers SET ${updates.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1} RETURNING *`, params);
  success(res, r.rows[0], 'Supplier updated');
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  await query('UPDATE suppliers SET deleted_at=NOW() WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  success(res, null, 'Supplier deleted');
});

router.get('/:id/ledger', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const r = await query(`SELECT * FROM supplier_ledger WHERE supplier_id=$1 AND mill_id=$2 ORDER BY date DESC,id DESC LIMIT $3 OFFSET $4`,
    [req.params.id, req.user.millId, limit, offset]);
  const cnt = await query('SELECT COUNT(*) AS total FROM supplier_ledger WHERE supplier_id=$1', [req.params.id]);
  paginated(res, r.rows, parseInt(cnt.rows[0].total), page, limit);
});

router.post('/:id/payment', requireRole('admin','manager','accountant'), async (req, res) => {
  const { amount, date, description, accountId } = req.body;
  const millId = req.user.millId;
  const suppRes = await query('SELECT balance FROM suppliers WHERE id=$1 AND mill_id=$2', [req.params.id, millId]);
  const supp = suppRes.rows[0];
  if (!supp) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const prev = await client.query('SELECT balance FROM supplier_ledger WHERE supplier_id=$1 ORDER BY id DESC LIMIT 1', [req.params.id]);
    const prevBal = prev.rows[0]?.balance ?? supp.balance;
    const newBal = prevBal - amount;
    await client.query(
      `INSERT INTO supplier_ledger (mill_id,supplier_id,date,description,debit,credit,balance,reference_type,created_by)
       VALUES ($1,$2,$3,$4,$5,0,$6,'payment',$7)`,
      [millId, req.params.id, date, description || 'Payment made', amount, newBal, req.user.id]
    );
    await client.query('UPDATE suppliers SET balance=$1,updated_at=NOW() WHERE id=$2', [newBal, req.params.id]);
    if (accountId) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id,date,account_id,type,amount,description,reference_type,created_by) VALUES ($1,$2,$3,'payment_made',$4,$5,'supplier_payment',$6)`,
        [millId, date, accountId, amount, description || 'Supplier payment', req.user.id]
      );
      await client.query('UPDATE accounts SET balance=balance-$1 WHERE id=$2', [amount, accountId]);
    }
    await client.query('COMMIT');
    success(res, null, 'Payment recorded');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
