const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

// GET /api/erp/company
router.get('/company', async (req, res) => {
  const [mill, settings, fy] = await Promise.all([
    query('SELECT * FROM mills WHERE id=$1', [req.user.millId]),
    query('SELECT * FROM company_settings WHERE mill_id=$1', [req.user.millId]),
    query('SELECT * FROM financial_years WHERE mill_id=$1 AND is_active=TRUE LIMIT 1', [req.user.millId]),
  ]);
  success(res, {
    mill: mill.rows[0],
    settings: settings.rows[0],
    activeFY: fy.rows[0],
  });
});

// PUT /api/erp/company
router.put('/company', requireRole('admin'), validate(Joi.object({
  name:            Joi.string().max(200).allow('',null),
  name_bn:         Joi.string().allow('',null),
  address:         Joi.string().allow('',null),
  phone:           Joi.string().allow('',null),
  email:           Joi.string().email().allow('',null),
  trade_name:      Joi.string().allow('',null),
  trade_license:   Joi.string().allow('',null),
  bin_number:      Joi.string().allow('',null),
  tin_number:      Joi.string().allow('',null),
  vat_registered:  Joi.boolean(),
  vat_number:      Joi.string().allow('',null),
  currency:        Joi.string().allow('',null),
  currency_symbol: Joi.string().allow('',null),
  invoice_prefix:  Joi.string().max(10).allow('',null),
  voucher_prefix:  Joi.string().max(10).allow('',null),
  low_stock_alert: Joi.boolean(),
  due_alert_days:  Joi.number().integer().min(1).max(365),
})), async (req, res) => {
  const millId = req.user.millId;
  const { name, name_bn, address, phone, email, ...settingsFields } = req.body;

  if (name || name_bn || address || phone || email) {
    const updates = []; const params = []; let idx = 1;
    for (const [k, v] of Object.entries({ name, name_bn, address, phone, email })) {
      if (v !== undefined) { updates.push(`${k}=$${idx++}`); params.push(v); }
    }
    if (updates.length) {
      updates.push('updated_at=NOW()');
      params.push(millId);
      await query(`UPDATE mills SET ${updates.join(',')} WHERE id=$${idx}`, params);
    }
  }

  if (Object.keys(settingsFields).length) {
    const sets = []; const params = []; let idx = 1;
    for (const [k, v] of Object.entries(settingsFields)) {
      if (v !== undefined) { sets.push(`${k}=$${idx++}`); params.push(v); }
    }
    if (sets.length) {
      sets.push('updated_at=NOW()');
      params.push(millId);
      await query(
        `INSERT INTO company_settings (mill_id) VALUES ($${idx}) ON CONFLICT (mill_id) DO UPDATE SET ${sets.join(',')}`,
        [...params, millId]
      );
    }
  }

  success(res, null, 'Company settings updated');
});

// GET /api/erp/users — user management
router.get('/users', requireRole('admin','manager'), async (req, res) => {
  const r = await query(
    `SELECT id, name, name_bn, email, phone, role, is_active, last_login, created_at
     FROM users WHERE mill_id=$1 AND deleted_at IS NULL ORDER BY name`,
    [req.user.millId]
  );
  success(res, r.rows);
});

// POST /api/erp/users
router.post('/users', requireRole('admin'), validate(Joi.object({
  name:     Joi.string().max(100).required(),
  name_bn:  Joi.string().allow('',null),
  email:    Joi.string().email().required(),
  phone:    Joi.string().allow('',null),
  role:     Joi.string().valid('admin','manager','accountant','storekeeper','operator','sales').required(),
  password: Joi.string().min(6).required(),
})), async (req, res) => {
  const bcrypt = require('bcrypt');
  const { name, name_bn, email, phone, role, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO users (mill_id, name, name_bn, email, phone, password_hash, role)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, role`,
    [req.user.millId, name, name_bn, email, phone, hash, role]
  );
  success(res, r.rows[0], 'User created');
});

// PUT /api/erp/users/:id
router.put('/users/:id', requireRole('admin'), async (req, res) => {
  const allowed = ['name','name_bn','phone','role','is_active'];
  const sets = []; const params = []; let idx = 1;
  for (const f of allowed) if (req.body[f] !== undefined) { sets.push(`${f}=$${idx++}`); params.push(req.body[f]); }
  if (req.body.password) {
    const bcrypt = require('bcrypt');
    sets.push(`password_hash=$${idx++}`);
    params.push(await bcrypt.hash(req.body.password, 10));
  }
  if (!sets.length) return res.status(400).json({ success:false, error:{code:'BAD_REQUEST',message:'Nothing to update'} });
  sets.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  await query(`UPDATE users SET ${sets.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1}`, params);
  success(res, null, 'User updated');
});

module.exports = router;
