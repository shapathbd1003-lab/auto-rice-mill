/**
 * V2 Voucher System — Tally ERP 9 style
 * Supports all 11 voucher types with:
 * - Auto ledger creation
 * - Double-entry validation
 * - Stock movements
 * - Cost center allocation
 * - Approval workflow
 * - Full audit trail
 */
const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { recordAudit } = require('../../middleware/auditTrail');

router.use(requireAuth);

const ip = (req) => req.ip || req.headers['x-forwarded-for'];
const who = (req) => ({ userId: req.user.id, userName: req.user.name || req.user.email, millId: req.user.millId, ipAddress: ip(req) });

// Auto-number voucher
async function nextVoucherNo(client, millId, voucherTypeMasterId, date) {
  const vtRes = await client.query('SELECT * FROM voucher_type_masters WHERE id=$1', [voucherTypeMasterId]);
  const vt = vtRes.rows[0];
  if (!vt) throw new Error('Voucher type not found');
  const year = new Date(date).getFullYear();
  const cnt = await client.query(
    `SELECT COUNT(*)+1 AS seq FROM vouchers WHERE mill_id=$1 AND voucher_type_master_id=$2 AND EXTRACT(YEAR FROM date)=$3`,
    [millId, voucherTypeMasterId, year]
  );
  return `${vt.prefix || vt.abbreviation}-${year}-${String(cnt.rows[0].seq).padStart(4,'0')}`;
}

// Post to ledger (double-entry)
async function postToLedger(client, millId, voucherId, viId, ledgerId, entryType, amount, date) {
  const prev = await client.query('SELECT balance FROM ledger_postings WHERE ledger_id=$1 ORDER BY id DESC LIMIT 1', [ledgerId]);
  const ledger = await client.query('SELECT balance_type FROM ledgers WHERE id=$1', [ledgerId]);
  const normalType = ledger.rows[0]?.balance_type || 'Dr';
  const prevBal = Number(prev.rows[0]?.balance ?? 0);
  const newBal = entryType === normalType ? prevBal + amount : prevBal - amount;
  await client.query(
    `INSERT INTO ledger_postings (mill_id, ledger_id, voucher_id, voucher_item_id, date, entry_type, amount, balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [millId, ledgerId, voucherId, viId, date, entryType, amount, newBal]
  );
  // Store signed balance — positive = Dr balance, negative = Cr balance
  await client.query('UPDATE ledgers SET current_balance=$1, updated_at=NOW() WHERE id=$2', [newBal, ledgerId]);
  return newBal;
}

// Auto-create ledger if not exists
async function findOrCreateLedger(client, millId, name, groupName, userId) {
  const existing = await client.query(
    `SELECT l.id FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE l.mill_id=$1 AND LOWER(l.name)=LOWER($2) AND l.deleted_at IS NULL LIMIT 1`,
    [millId, name]
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };

  const group = await client.query(
    `SELECT id FROM ledger_groups WHERE mill_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
    [millId, groupName]
  );
  if (!group.rows[0]) throw new Error(`Ledger group '${groupName}' not found`);

  const r = await client.query(
    `INSERT INTO ledgers (mill_id, group_id, name, opening_balance, opening_type, current_balance, balance_type, created_by)
     VALUES ($1,$2,$3,0,'Dr',0,'Dr',$4) RETURNING id`,
    [millId, group.rows[0].id, name, userId]
  );
  return { id: r.rows[0].id, created: true };
}

// GET /api/v2/vouchers
router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { from, to, nature, status, party_id } = req.query;
  const millId = req.user.millId;
  const params = [millId];
  let where = 'v.mill_id=$1 AND v.deleted_at IS NULL';
  if (nature)    { params.push(nature);    where += ` AND vtm.nature=$${params.length}`; }
  if (status)    { params.push(status);    where += ` AND v.status=$${params.length}`; }
  if (party_id)  { params.push(party_id);  where += ` AND v.party_id=$${params.length}`; }
  if (from)      { params.push(from);      where += ` AND v.date>=$${params.length}`; }
  if (to)        { params.push(to);        where += ` AND v.date<=$${params.length}`; }
  const [rows, cnt] = await Promise.all([
    query(`SELECT v.*, vtm.name AS voucher_type_name, vtm.nature, vtm.abbreviation
           FROM vouchers v JOIN voucher_type_masters vtm ON vtm.id=v.voucher_type_master_id
           WHERE ${where} ORDER BY v.date DESC, v.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM vouchers v JOIN voucher_type_masters vtm ON vtm.id=v.voucher_type_master_id WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

// GET /api/v2/vouchers/:id
router.get('/:id', async (req, res) => {
  const [v, items] = await Promise.all([
    query(`SELECT v.*, vtm.name AS voucher_type_name, vtm.nature FROM vouchers v
           JOIN voucher_type_masters vtm ON vtm.id=v.voucher_type_master_id
           WHERE v.id=$1 AND v.mill_id=$2 AND v.deleted_at IS NULL`, [req.params.id, req.user.millId]),
    query(`SELECT vi.*, l.name AS ledger_name, lg.name AS group_name, lg.nature
           FROM voucher_items vi JOIN ledgers l ON l.id=vi.ledger_id
           JOIN ledger_groups lg ON lg.id=l.group_id
           WHERE vi.voucher_id=$1 ORDER BY vi.id`, [req.params.id]),
  ]);
  if (!v.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Voucher not found'} });
  success(res, { ...v.rows[0], items: items.rows });
});

// POST /api/v2/vouchers — create voucher
router.post('/', requirePermission('vouchers', 'can_create'), validate(Joi.object({
  voucher_type_master_id: Joi.number().integer().required(),
  date:          Joi.string().required(),
  narration:     Joi.string().allow('',null),
  reference:     Joi.string().allow('',null),
  party_ledger_name: Joi.string().allow('',null), // for auto-create
  party_group:   Joi.string().allow('',null),      // for auto-create
  cost_center_id:Joi.number().integer().allow(null),
  status:        Joi.string().valid('draft','approved').default('draft'),
  items: Joi.array().items(Joi.object({
    ledger_id:   Joi.number().integer().allow(null),
    ledger_name: Joi.string().allow('',null),  // for auto-create
    ledger_group:Joi.string().allow('',null),
    entry_type:  Joi.string().valid('Dr','Cr').required(),
    amount:      Joi.number().positive().required(),
    narration:   Joi.string().allow('',null),
  })).min(2).required(),
})), async (req, res) => {
  const { voucher_type_master_id, date, narration, reference, party_ledger_name, party_group, cost_center_id, status, items } = req.body;
  const millId = req.user.millId;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Resolve ledger IDs (auto-create if needed)
    const resolvedItems = [];
    const autoCreated = [];
    for (const item of items) {
      let ledgerId = item.ledger_id;
      if (!ledgerId && item.ledger_name) {
        const result = await findOrCreateLedger(client, millId, item.ledger_name, item.ledger_group || 'Operating Expenses', req.user.id);
        ledgerId = result.id;
        if (result.created) autoCreated.push({ name: item.ledger_name, group: item.ledger_group });
      }
      if (!ledgerId) throw new Error(`Ledger ID or name required for each item`);
      resolvedItems.push({ ...item, ledger_id: ledgerId });
    }

    // Validate double-entry balance
    const totalDr = resolvedItems.filter((i) => i.entry_type === 'Dr').reduce((s, i) => s + i.amount, 0);
    const totalCr = resolvedItems.filter((i) => i.entry_type === 'Cr').reduce((s, i) => s + i.amount, 0);
    if (Math.abs(totalDr - totalCr) > 0.01) {
      throw new Error(`Voucher not balanced: Dr=${totalDr} Cr=${totalCr}`);
    }

    const vno = await nextVoucherNo(client, millId, voucher_type_master_id, date);
    const fyRes = await client.query('SELECT id FROM financial_years WHERE mill_id=$1 AND is_active=TRUE LIMIT 1', [millId]);

    const vRes = await client.query(
      `INSERT INTO vouchers (mill_id, financial_year_id, voucher_type_master_id, voucher_number, date,
         narration, reference, party_id, party_type, total_amount, status, is_posted, cost_center_id,
         auto_created_ledgers, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [millId, fyRes.rows[0]?.id, voucher_type_master_id, vno, date, narration, reference,
       totalDr, status, status==='approved', cost_center_id||null,
       autoCreated.length ? JSON.stringify(autoCreated) : null, req.user.id]
    );
    const voucher = vRes.rows[0];

    // Insert line items and post if approved
    for (const item of resolvedItems) {
      const viRes = await client.query(
        `INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount, narration)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [voucher.id, item.ledger_id, item.entry_type, item.amount, item.narration]
      );
      if (status === 'approved') {
        await postToLedger(client, millId, voucher.id, viRes.rows[0].id, item.ledger_id, item.entry_type, item.amount, date);
      }
    }

    await recordAudit(client, { ...who(req), action:'CREATE', entityType:'voucher', entityId:voucher.id, entityRef:vno, newData:{ vno, status, totalDr } });
    await client.query('COMMIT');
    created(res, { ...voucher, items: resolvedItems, autoCreated }, 'Voucher created');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/v2/vouchers/:id/approve
router.post('/:id/approve', requirePermission('vouchers', 'can_approve'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const vRes = await client.query('SELECT * FROM vouchers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
    const v = vRes.rows[0];
    if (!v) throw new Error('Voucher not found');
    if (v.status === 'approved') throw new Error('Already approved');
    const items = await client.query('SELECT * FROM voucher_items WHERE voucher_id=$1', [v.id]);
    for (const item of items.rows) {
      await postToLedger(client, v.mill_id, v.id, item.id, item.ledger_id, item.entry_type, Number(item.amount), v.date);
    }
    await client.query(`UPDATE vouchers SET status='approved', is_posted=TRUE, approved_by=$1, approved_at=NOW() WHERE id=$2`, [req.user.id, v.id]);
    await recordAudit(client, { ...who(req), action:'APPROVE', entityType:'voucher', entityId:v.id, entityRef:v.voucher_number });
    await client.query('COMMIT');
    success(res, null, 'Voucher approved');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/v2/vouchers/:id/cancel
router.post('/:id/cancel', requirePermission('vouchers', 'can_edit'), async (req, res) => {
  const v = await query('SELECT * FROM vouchers WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
  if (!v.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Not found'} });
  if (v.rows[0].status === 'approved') return res.status(400).json({ success:false, error:{code:'APPROVED',message:'Cannot cancel approved voucher'} });
  await query(`UPDATE vouchers SET status='cancelled' WHERE id=$1`, [req.params.id]);
  success(res, null, 'Voucher cancelled');
});

module.exports = router;
module.exports.postToLedger = postToLedger;
module.exports.findOrCreateLedger = findOrCreateLedger;
