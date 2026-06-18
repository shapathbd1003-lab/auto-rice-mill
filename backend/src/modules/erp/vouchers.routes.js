const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

const VOUCHER_PREFIXES = {
  sales: 'SV', purchase: 'PV', receipt: 'RV', payment: 'PMT',
  journal: 'JV', contra: 'CV', debit_note: 'DN', credit_note: 'CN',
};

async function nextVoucherNumber(client, millId, voucherType, date) {
  const year = new Date(date).getFullYear();
  const prefix = VOUCHER_PREFIXES[voucherType] || 'VCH';
  const r = await client.query(
    `SELECT COUNT(*) AS cnt FROM vouchers WHERE mill_id=$1 AND voucher_type=$2
     AND EXTRACT(YEAR FROM date)=$3 AND deleted_at IS NULL`,
    [millId, voucherType, year]
  );
  const seq = String(parseInt(r.rows[0].cnt) + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

// GET /api/erp/vouchers
router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  const { from, to, type, status, party_id } = req.query;

  const params = [millId];
  let where = 'mill_id=$1 AND deleted_at IS NULL';
  if (type)     { params.push(type);     where += ` AND voucher_type=$${params.length}`; }
  if (status)   { params.push(status);   where += ` AND status=$${params.length}`; }
  if (party_id) { params.push(party_id); where += ` AND party_id=$${params.length}`; }
  if (from)     { params.push(from);     where += ` AND date>=$${params.length}`; }
  if (to)       { params.push(to);       where += ` AND date<=$${params.length}`; }

  const [rows, cnt] = await Promise.all([
    query(`SELECT * FROM vouchers WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM vouchers WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

// GET /api/erp/vouchers/:id
router.get('/:id', async (req, res) => {
  const [v, items] = await Promise.all([
    query('SELECT * FROM vouchers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]),
    query(`SELECT vi.*, l.name AS ledger_name, lg.nature
           FROM voucher_items vi
           JOIN ledgers l ON l.id=vi.ledger_id
           JOIN ledger_groups lg ON lg.id=l.group_id
           WHERE vi.voucher_id=$1 ORDER BY vi.id`, [req.params.id]),
  ]);
  if (!v.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Voucher not found'} });
  success(res, { ...v.rows[0], items: items.rows });
});

// POST /api/erp/vouchers — create voucher (double-entry)
router.post('/', requireRole('admin','manager','accountant'), validate(Joi.object({
  voucher_type: Joi.string().valid('sales','purchase','receipt','payment','journal','contra','debit_note','credit_note').required(),
  date:         Joi.string().required(),
  narration:    Joi.string().allow('',null),
  reference:    Joi.string().allow('',null),
  party_id:     Joi.number().integer().allow(null),
  party_type:   Joi.string().valid('customer','supplier').allow(null),
  status:       Joi.string().valid('draft','approved').default('draft'),
  items:        Joi.array().items(Joi.object({
    ledger_id:  Joi.number().integer().required(),
    entry_type: Joi.string().valid('Dr','Cr').required(),
    amount:     Joi.number().positive().required(),
    narration:  Joi.string().allow('',null),
  })).min(2).required(),
})), async (req, res) => {
  const { voucher_type, date, narration, reference, party_id, party_type, status, items } = req.body;
  const millId = req.user.millId;

  // Validate double-entry balance
  const totalDr = items.filter((i) => i.entry_type === 'Dr').reduce((s, i) => s + i.amount, 0);
  const totalCr = items.filter((i) => i.entry_type === 'Cr').reduce((s, i) => s + i.amount, 0);
  if (Math.abs(totalDr - totalCr) > 0.01) {
    return res.status(400).json({ success:false, error:{code:'UNBALANCED',message:`Debit (${totalDr}) must equal Credit (${totalCr})`} });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const vno = await nextVoucherNumber(client, millId, voucher_type, date);
    const fyRes = await client.query('SELECT id FROM financial_years WHERE mill_id=$1 AND is_active=TRUE LIMIT 1', [millId]);
    const fyId = fyRes.rows[0]?.id || null;

    const vRes = await client.query(
      `INSERT INTO vouchers (mill_id, financial_year_id, voucher_type, voucher_number, date, narration, reference, party_id, party_type, total_amount, status, is_posted, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [millId, fyId, voucher_type, vno, date, narration, reference, party_id||null, party_type||null, totalDr, status, status==='approved', req.user.id]
    );
    const voucher = vRes.rows[0];

    // Insert line items + post to ledger if approved
    for (const item of items) {
      const viRes = await client.query(
        `INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount, narration)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [voucher.id, item.ledger_id, item.entry_type, item.amount, item.narration]
      );

      if (status === 'approved') {
        await postToLedger(client, millId, voucher.id, viRes.rows[0].id, item.ledger_id, item.entry_type, item.amount, date);
      }
    }

    await client.query('COMMIT');
    created(res, { ...voucher, items }, 'Voucher created');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

async function postToLedger(client, millId, voucherId, voucherItemId, ledgerId, entryType, amount, date) {
  const prev = await client.query(
    'SELECT balance, balance_type FROM ledger_postings WHERE ledger_id=$1 ORDER BY id DESC LIMIT 1',
    [ledgerId]
  );
  const ledger = await client.query('SELECT balance_type FROM ledgers WHERE id=$1', [ledgerId]);
  const normalType = ledger.rows[0]?.balance_type || 'Dr';

  let prevBal = prev.rows[0]?.balance ?? 0;
  let newBal;
  if (entryType === normalType) {
    newBal = prevBal + amount;
  } else {
    newBal = prevBal - amount;
  }

  await client.query(
    `INSERT INTO ledger_postings (mill_id, ledger_id, voucher_id, voucher_item_id, date, entry_type, amount, balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [millId, ledgerId, voucherId, voucherItemId, date, entryType, amount, newBal]
  );
  await client.query(
    'UPDATE ledgers SET current_balance=$1, updated_at=NOW() WHERE id=$2',
    [Math.abs(newBal), ledgerId]
  );
}

// POST /api/erp/vouchers/:id/approve
router.post('/:id/approve', requireRole('admin','manager','accountant'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const vRes = await client.query('SELECT * FROM vouchers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
    const v = vRes.rows[0];
    if (!v) throw Object.assign(new Error('Not found'), { status: 404 });
    if (v.status === 'approved') throw Object.assign(new Error('Already approved'), { status: 400 });

    const items = await client.query('SELECT * FROM voucher_items WHERE voucher_id=$1', [v.id]);
    for (const item of items.rows) {
      await postToLedger(client, v.mill_id, v.id, item.id, item.ledger_id, item.entry_type, item.amount, v.date);
    }

    await client.query(
      `UPDATE vouchers SET status='approved', is_posted=TRUE, approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2`,
      [req.user.id, v.id]
    );
    await client.query('COMMIT');
    success(res, null, 'Voucher approved and posted');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// POST /api/erp/vouchers/:id/cancel
router.post('/:id/cancel', requireRole('admin','manager'), async (req, res) => {
  await query(
    `UPDATE vouchers SET status='cancelled', updated_at=NOW() WHERE id=$1 AND mill_id=$2 AND status='draft'`,
    [req.params.id, req.user.millId]
  );
  success(res, null, 'Voucher cancelled');
});

// DELETE /api/erp/vouchers/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const v = await query('SELECT * FROM vouchers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
  if (!v.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Voucher not found'} });
  if (v.rows[0].status === 'approved') return res.status(400).json({ success:false, error:{code:'APPROVED',message:'Cannot delete approved voucher'} });
  await query('UPDATE vouchers SET deleted_at=NOW() WHERE id=$1', [req.params.id]);
  success(res, null, 'Voucher deleted');
});

module.exports = router;
module.exports.postToLedger = postToLedger;
