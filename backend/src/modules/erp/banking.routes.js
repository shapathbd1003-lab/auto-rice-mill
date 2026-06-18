const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

// ── BANK ACCOUNTS ────────────────────────────────────────────

router.get('/accounts', async (req, res) => {
  const r = await query(
    'SELECT * FROM bank_accounts WHERE mill_id=$1 AND is_active=TRUE ORDER BY bank_name',
    [req.user.millId]
  );
  success(res, r.rows);
});

router.post('/accounts', requireRole('admin','manager','accountant'), validate(Joi.object({
  bank_name:      Joi.string().max(150).required(),
  account_name:   Joi.string().max(150).required(),
  account_number: Joi.string().max(50).required(),
  branch:         Joi.string().allow('',null),
  ifsc:           Joi.string().allow('',null),
  opening_balance:Joi.number().default(0),
})), async (req, res) => {
  const { bank_name, account_name, account_number, branch, ifsc, opening_balance } = req.body;
  const r = await query(
    `INSERT INTO bank_accounts (mill_id, bank_name, account_name, account_number, branch, ifsc, opening_balance, current_balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [req.user.millId, bank_name, account_name, account_number, branch, ifsc, opening_balance || 0]
  );
  created(res, r.rows[0], 'Bank account created');
});

router.put('/accounts/:id', requireRole('admin','manager','accountant'), async (req, res) => {
  const { bank_name, account_name, branch, ifsc, is_active } = req.body;
  const r = await query(
    `UPDATE bank_accounts SET
       bank_name=COALESCE($1,bank_name), account_name=COALESCE($2,account_name),
       branch=COALESCE($3,branch), ifsc=COALESCE($4,ifsc),
       is_active=COALESCE($5,is_active), updated_at=NOW()
     WHERE id=$6 AND mill_id=$7 RETURNING *`,
    [bank_name, account_name, branch, ifsc, is_active, req.params.id, req.user.millId]
  );
  success(res, r.rows[0]);
});

// ── BANK TRANSACTIONS ────────────────────────────────────────

router.get('/accounts/:id/transactions', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { from, to } = req.query;
  const params = [req.params.id, req.user.millId];
  let where = 'account_id=$1 AND mill_id=$2';
  if (from) { params.push(from); where += ` AND date>=$${params.length}`; }
  if (to)   { params.push(to);   where += ` AND date<=$${params.length}`; }

  const [rows, cnt] = await Promise.all([
    query(`SELECT * FROM financial_transactions WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM financial_transactions WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

// POST bank deposit / withdrawal
router.post('/accounts/:id/transaction', requireRole('admin','manager','accountant'), validate(Joi.object({
  date:        Joi.string().required(),
  type:        Joi.string().valid('deposit','withdrawal','transfer').required(),
  amount:      Joi.number().positive().required(),
  description: Joi.string().required(),
  to_account_id: Joi.number().integer().allow(null),
})), async (req, res) => {
  const { date, type, amount, description, to_account_id } = req.body;
  const millId = req.user.millId;

  const acct = await query('SELECT * FROM bank_accounts WHERE id=$1 AND mill_id=$2', [req.params.id, millId]);
  if (!acct.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Account not found'} });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const delta = (type === 'deposit') ? amount : -amount;

    await client.query(
      `INSERT INTO financial_transactions (mill_id, date, account_id, type, amount, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [millId, date, req.params.id, type, amount, description, req.user.id]
    );
    await client.query(
      'UPDATE bank_accounts SET current_balance=current_balance+$1, updated_at=NOW() WHERE id=$2',
      [delta, req.params.id]
    );

    if (type === 'transfer' && to_account_id) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id, date, account_id, type, amount, description, created_by)
         VALUES ($1,$2,$3,'deposit',$4,$5,$6)`,
        [millId, date, to_account_id, amount, `Transfer from account #${req.params.id}`, req.user.id]
      );
      await client.query(
        'UPDATE bank_accounts SET current_balance=current_balance+$1, updated_at=NOW() WHERE id=$2',
        [amount, to_account_id]
      );
    }

    await client.query('COMMIT');
    success(res, null, `${type} recorded`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ── CHEQUES ──────────────────────────────────────────────────

router.get('/cheques', async (req, res) => {
  const { status, type } = req.query;
  const params = [req.user.millId];
  let where = 'mill_id=$1';
  if (status) { params.push(status); where += ` AND status=$${params.length}`; }
  if (type)   { params.push(type);   where += ` AND type=$${params.length}`; }
  const r = await query(`SELECT c.*, ba.bank_name, ba.account_number FROM cheques c JOIN bank_accounts ba ON ba.id=c.bank_account_id WHERE ${where} ORDER BY date DESC`, params);
  success(res, r.rows);
});

router.post('/cheques', requireRole('admin','manager','accountant'), validate(Joi.object({
  bank_account_id: Joi.number().integer().required(),
  cheque_number:   Joi.string().max(30).required(),
  date:            Joi.string().required(),
  amount:          Joi.number().positive().required(),
  payee:           Joi.string().allow('',null),
  type:            Joi.string().valid('issued','received').required(),
  notes:           Joi.string().allow('',null),
})), async (req, res) => {
  const { bank_account_id, cheque_number, date, amount, payee, type, notes } = req.body;
  const r = await query(
    `INSERT INTO cheques (mill_id, bank_account_id, cheque_number, date, amount, payee, type, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.millId, bank_account_id, cheque_number, date, amount, payee, type, notes, req.user.id]
  );
  created(res, r.rows[0], 'Cheque recorded');
});

router.put('/cheques/:id/status', requireRole('admin','manager','accountant'), async (req, res) => {
  const { status, cleared_date } = req.body;
  await query(
    'UPDATE cheques SET status=$1, cleared_date=$2 WHERE id=$3 AND mill_id=$4',
    [status, cleared_date || null, req.params.id, req.user.millId]
  );
  success(res, null, 'Cheque status updated');
});

// GET summary balance
router.get('/summary', async (req, res) => {
  const millId = req.user.millId;
  const [accounts, pendingCheques] = await Promise.all([
    query('SELECT bank_name, account_name, account_number, current_balance FROM bank_accounts WHERE mill_id=$1 AND is_active=TRUE', [millId]),
    query(`SELECT type, COALESCE(SUM(amount),0) AS total FROM cheques WHERE mill_id=$1 AND status='pending' GROUP BY type`, [millId]),
  ]);
  const totalBalance = accounts.rows.reduce((s, a) => s + Number(a.current_balance), 0);
  success(res, {
    accounts: accounts.rows,
    totalBalance,
    pendingCheques: pendingCheques.rows,
  });
});

module.exports = router;
