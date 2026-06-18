const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

// ── LEDGER GROUPS ────────────────────────────────────────────

// GET /api/erp/ledger-groups
router.get('/ledger-groups', async (req, res) => {
  const rows = await query(
    `SELECT lg.*, p.name AS parent_name
     FROM ledger_groups lg
     LEFT JOIN ledger_groups p ON p.id = lg.parent_id
     WHERE lg.mill_id = $1
     ORDER BY lg.nature, lg.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

// POST /api/erp/ledger-groups
router.post('/ledger-groups', requireRole('admin','manager','accountant'), validate(Joi.object({
  name:        Joi.string().max(150).required(),
  name_bn:     Joi.string().allow('',null),
  parent_id:   Joi.number().integer().allow(null),
  nature:      Joi.string().valid('assets','liabilities','income','expenses','capital').required(),
  group_type:  Joi.string().max(30).default('general'),
  description: Joi.string().allow('',null),
})), async (req, res) => {
  const { name, name_bn, parent_id, nature, group_type, description } = req.body;
  const r = await query(
    `INSERT INTO ledger_groups (mill_id, name, name_bn, parent_id, nature, group_type, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.millId, name, name_bn, parent_id || null, nature, group_type || 'general', description || null]
  );
  created(res, r.rows[0], 'Ledger group created');
});

// DELETE /api/erp/ledger-groups/:id
router.delete('/ledger-groups/:id', requireRole('admin'), async (req, res) => {
  const hasChildren = await query('SELECT 1 FROM ledger_groups WHERE parent_id=$1 LIMIT 1', [req.params.id]);
  if (hasChildren.rows.length) return res.status(400).json({ success:false, error:{code:'HAS_CHILDREN',message:'Delete child groups first'} });
  const hasLedgers = await query('SELECT 1 FROM ledgers WHERE group_id=$1 AND deleted_at IS NULL LIMIT 1', [req.params.id]);
  if (hasLedgers.rows.length) return res.status(400).json({ success:false, error:{code:'HAS_LEDGERS',message:'Delete or move ledgers in this group first'} });
  await query('DELETE FROM ledger_groups WHERE id=$1 AND mill_id=$2 AND is_system=FALSE', [req.params.id, req.user.millId]);
  success(res, null, 'Group deleted');
});

// PUT /api/erp/ledger-groups/:id
router.put('/ledger-groups/:id', requireRole('admin','manager','accountant'), async (req, res) => {
  const { name, name_bn, parent_id } = req.body;
  const r = await query(
    `UPDATE ledger_groups SET name=COALESCE($1,name), name_bn=COALESCE($2,name_bn), parent_id=COALESCE($3,parent_id)
     WHERE id=$4 AND mill_id=$5 AND is_system=FALSE RETURNING *`,
    [name, name_bn, parent_id, req.params.id, req.user.millId]
  );
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Group not found or system group'} });
  success(res, r.rows[0]);
});

// ── LEDGERS ──────────────────────────────────────────────────

// GET /api/erp/ledgers
router.get('/ledgers', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  const { group_id, nature, search } = req.query;

  const params = [millId];
  let where = 'l.mill_id=$1 AND l.deleted_at IS NULL';
  if (group_id) { params.push(group_id); where += ` AND l.group_id=$${params.length}`; }
  if (nature)   { params.push(nature);   where += ` AND lg.nature=$${params.length}`; }
  if (search)   { params.push(`%${search}%`); where += ` AND (l.name ILIKE $${params.length} OR l.code ILIKE $${params.length})`; }

  const [rows, cnt] = await Promise.all([
    query(`SELECT l.*, lg.name AS group_name, lg.nature
           FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
           WHERE ${where} ORDER BY lg.nature, lg.name, l.name
           LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

// POST /api/erp/ledgers
router.post('/ledgers', requireRole('admin','manager','accountant'), validate(Joi.object({
  group_id:        Joi.number().integer().required(),
  name:            Joi.string().max(200).required(),
  name_bn:         Joi.string().allow('',null),
  code:            Joi.string().max(20).allow('',null),
  opening_balance: Joi.number().default(0),
  opening_type:    Joi.string().valid('Dr','Cr').default('Dr'),
  notes:           Joi.string().allow('',null),
  phone:           Joi.string().max(30).allow('',null),
  email:           Joi.string().email().allow('',null),
  address:         Joi.string().allow('',null),
  contact_person:  Joi.string().max(150).allow('',null),
})), async (req, res) => {
  const { group_id, name, name_bn, code, opening_balance, opening_type, notes, phone, email, address, contact_person } = req.body;
  const r = await query(
    `INSERT INTO ledgers (mill_id, group_id, name, name_bn, code, opening_balance, opening_type,
       current_balance, balance_type, notes, phone, email, address, contact_person, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [req.user.millId, group_id, name, name_bn, code, opening_balance || 0, opening_type || 'Dr',
     notes, phone, email, address, contact_person, req.user.id]
  );
  created(res, r.rows[0], 'Ledger created');
});

// GET /api/erp/ledgers/:id
router.get('/ledgers/:id', async (req, res) => {
  const r = await query(
    `SELECT l.*, lg.name AS group_name, lg.nature
     FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE l.id=$1 AND l.mill_id=$2 AND l.deleted_at IS NULL`,
    [req.params.id, req.user.millId]
  );
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Ledger not found'} });
  success(res, r.rows[0]);
});

// PUT /api/erp/ledgers/:id
router.put('/ledgers/:id', requireRole('admin','manager','accountant'), async (req, res) => {
  const allowed = ['name','name_bn','code','notes','is_active','phone','email','address','contact_person'];
  const sets = []; const params = []; let idx=1;
  for (const f of allowed) if (req.body[f] !== undefined) { sets.push(`${f}=$${idx++}`); params.push(req.body[f]); }
  if (!sets.length) return res.status(400).json({ success:false, error:{code:'BAD_REQUEST',message:'Nothing to update'} });
  sets.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  const r = await query(
    `UPDATE ledgers SET ${sets.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1} AND is_system=FALSE RETURNING *`,
    params
  );
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Ledger not found or system ledger'} });
  success(res, r.rows[0]);
});

// DELETE /api/erp/ledgers/:id
router.delete('/ledgers/:id', requireRole('admin'), async (req, res) => {
  const check = await query(
    'SELECT id FROM ledger_postings WHERE ledger_id=$1 LIMIT 1', [req.params.id]
  );
  if (check.rows.length) return res.status(400).json({ success:false, error:{code:'HAS_TRANSACTIONS',message:'Cannot delete ledger with posted transactions'} });
  await query(
    'UPDATE ledgers SET deleted_at=NOW() WHERE id=$1 AND mill_id=$2 AND is_system=FALSE',
    [req.params.id, req.user.millId]
  );
  success(res, null, 'Ledger deleted');
});

// GET /api/erp/ledgers/:id/statement — ledger statement with running balance
router.get('/ledgers/:id/statement', async (req, res) => {
  const { from, to } = req.query;
  const params = [req.params.id, req.user.millId];
  let where = 'lp.ledger_id=$1 AND lp.mill_id=$2';
  if (from) { params.push(from); where += ` AND lp.date>=$${params.length}`; }
  if (to)   { params.push(to);   where += ` AND lp.date<=$${params.length}`; }

  const [ledger, postings] = await Promise.all([
    query('SELECT l.*, lg.name AS group_name, lg.nature FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id WHERE l.id=$1 AND l.mill_id=$2', [req.params.id, req.user.millId]),
    query(`SELECT lp.*, v.voucher_number, v.voucher_type, v.narration
           FROM ledger_postings lp JOIN vouchers v ON v.id=lp.voucher_id
           WHERE ${where} ORDER BY lp.date ASC, lp.id ASC`, params),
  ]);
  if (!ledger.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Ledger not found'} });
  success(res, { ledger: ledger.rows[0], postings: postings.rows });
});

// GET /api/erp/chart-of-accounts — full tree for display
router.get('/chart-of-accounts', async (req, res) => {
  const millId = req.user.millId;
  const [groups, ledgers] = await Promise.all([
    query('SELECT * FROM ledger_groups WHERE mill_id=$1 ORDER BY nature,name', [millId]),
    query(`SELECT l.*, lg.nature FROM ledgers l JOIN ledger_groups lg ON lg.id=l.group_id
           WHERE l.mill_id=$1 AND l.deleted_at IS NULL ORDER BY l.name`, [millId]),
  ]);

  const groupMap = {};
  groups.rows.forEach((g) => { groupMap[g.id] = { ...g, children: [], ledgers: [] }; });
  groups.rows.forEach((g) => { if (g.parent_id && groupMap[g.parent_id]) groupMap[g.parent_id].children.push(groupMap[g.id]); });
  ledgers.rows.forEach((l) => { if (groupMap[l.group_id]) groupMap[l.group_id].ledgers.push(l); });

  const roots = groups.rows.filter((g) => !g.parent_id).map((g) => groupMap[g.id]);
  success(res, roots);
});

module.exports = router;
