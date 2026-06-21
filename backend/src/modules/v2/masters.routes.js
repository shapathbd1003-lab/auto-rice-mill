/**
 * Masters API — Tally ERP 9 style
 * Covers: Ledger Groups, Ledgers, Stock Groups, Stock Categories,
 *         Stock Items, Units, Godowns, Cost Centers, Voucher Types, Roles, Users
 */
const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { recordAudit } = require('../../middleware/auditTrail');
const bcrypt = require('bcrypt');

router.use(requireAuth);

const ip = (req) => req.ip || req.headers['x-forwarded-for'];
const who = (req) => ({ userId: req.user.id, userName: req.user.name || req.user.email, millId: req.user.millId, ipAddress: ip(req) });

// ══ ROLES ════════════════════════════════════════════════════

router.get('/roles', requirePermission('admin', 'can_view'), async (req, res) => {
  const rows = await query(
    `SELECT r.*, COUNT(ur.user_id)::int AS user_count
     FROM roles r LEFT JOIN user_roles ur ON ur.role_id=r.id
     WHERE r.mill_id=$1 GROUP BY r.id ORDER BY r.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

router.post('/roles', requirePermission('admin', 'can_create'), validate(Joi.object({
  name:        Joi.string().max(100).required(),
  description: Joi.string().allow('',null),
  permissions: Joi.array().items(Joi.object({
    module:     Joi.string().required(),
    can_view:   Joi.boolean().default(false),
    can_create: Joi.boolean().default(false),
    can_edit:   Joi.boolean().default(false),
    can_delete: Joi.boolean().default(false),
    can_approve:Joi.boolean().default(false),
  })).default([]),
})), async (req, res) => {
  const { name, description, permissions } = req.body;
  const millId = req.user.millId;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO roles (mill_id, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [millId, name, description]
    );
    const role = r.rows[0];
    for (const perm of permissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (role_id, module) DO UPDATE SET
         can_view=$3, can_create=$4, can_edit=$5, can_delete=$6, can_approve=$7`,
        [role.id, perm.module, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete, perm.can_approve]
      );
    }
    await recordAudit(client, { ...who(req), action:'CREATE', entityType:'role', entityId:role.id, entityRef:name, newData:role });
    await client.query('COMMIT');
    created(res, role, 'Role created');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

router.put('/roles/:id', requirePermission('admin', 'can_edit'), async (req, res) => {
  const { name, description, permissions } = req.body;
  const millId = req.user.millId;
  const old = await query('SELECT * FROM roles WHERE id=$1 AND mill_id=$2', [req.params.id, millId]);
  if (!old.rows[0] || old.rows[0].is_system) return res.status(400).json({ success:false, error:{code:'SYSTEM_ROLE',message:'Cannot modify system role'} });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE roles SET name=COALESCE($1,name), description=COALESCE($2,description) WHERE id=$3 RETURNING *`,
      [name, description, req.params.id]
    );
    if (permissions?.length) {
      await client.query('DELETE FROM role_permissions WHERE role_id=$1', [req.params.id]);
      for (const perm of permissions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, perm.module, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete, perm.can_approve]
        );
      }
    }
    await recordAudit(client, { ...who(req), action:'UPDATE', entityType:'role', entityId:Number(req.params.id), oldData:old.rows[0], newData:r.rows[0] });
    await client.query('COMMIT');
    success(res, r.rows[0], 'Role updated');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

router.delete('/roles/:id', requirePermission('admin', 'can_delete'), async (req, res) => {
  const r = await query('SELECT * FROM roles WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{code:'NOT_FOUND',message:'Role not found'} });
  if (r.rows[0].is_system) return res.status(400).json({ success:false, error:{code:'SYSTEM_ROLE',message:'Cannot delete system role'} });
  await query('DELETE FROM roles WHERE id=$1', [req.params.id]);
  success(res, null, 'Role deleted');
});

// ══ USERS ════════════════════════════════════════════════════

router.get('/users', requirePermission('admin', 'can_view'), async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login,
            array_agg(r.name ORDER BY r.name) FILTER (WHERE r.id IS NOT NULL) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     WHERE u.mill_id=$1 AND u.deleted_at IS NULL
     GROUP BY u.id ORDER BY u.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

router.post('/users', requirePermission('admin', 'can_create'), validate(Joi.object({
  name:     Joi.string().max(100).required(),
  email:    Joi.string().email().required(),
  username: Joi.string().max(50).allow('',null),
  phone:    Joi.string().allow('',null),
  password: Joi.string().min(4).required(),
  role_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
})), async (req, res) => {
  const { name, username, phone, password, role_ids } = req.body;
  const email = req.body.email?.toLowerCase().trim();
  const millId = req.user.millId;
  const hash = await bcrypt.hash(password, 10);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO users (mill_id, name, email, phone, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,'accountant') RETURNING id, name, email`,
      [millId, name, email, phone, hash]
    );
    const user = r.rows[0];
    for (const roleId of role_ids) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user.id, roleId]);
    }
    await recordAudit(client, { ...who(req), action:'CREATE', entityType:'user', entityId:user.id, entityRef:email, newData:{name,email} });
    await client.query('COMMIT');
    created(res, user, 'User created');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

router.put('/users/:id', requirePermission('admin', 'can_edit'), async (req, res) => {
  const { name, phone, password, role_ids, is_active } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sets = ['updated_at=NOW()']; const params = [];
    if (name)      { sets.push(`name=$${params.length+1}`);     params.push(name); }
    if (phone)     { sets.push(`phone=$${params.length+1}`);    params.push(phone); }
    if (is_active !== undefined) { sets.push(`is_active=$${params.length+1}`); params.push(is_active); }
    if (password)  { const h = await bcrypt.hash(password, 10); sets.push(`password_hash=$${params.length+1}`); params.push(h); }
    params.push(req.params.id, req.user.millId);
    if (sets.length > 1) await client.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${params.length-1} AND mill_id=$${params.length}`, params);
    if (role_ids) {
      await client.query('DELETE FROM user_roles WHERE user_id=$1', [req.params.id]);
      for (const r of role_ids) await client.query('INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, r]);
    }
    await client.query('COMMIT');
    success(res, null, 'User updated');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

router.delete('/users/:id', requirePermission('admin', 'can_delete'), async (req, res) => {
  const millId = req.user.millId;
  // Prevent deleting yourself
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ success:false, error:{ code:'SELF_DELETE', message:'Cannot delete your own account' } });
  }
  const r = await query('SELECT id FROM users WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, millId]);
  if (!r.rows[0]) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'User not found' } });
  await query('UPDATE users SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [req.params.id]);
  await recordAudit(null, { ...who(req), action:'DELETE', entityType:'user', entityId:Number(req.params.id) });
  success(res, null, 'User deleted');
});

// ══ LEDGER PERMISSIONS ═══════════════════════════════════════

router.get('/ledger-permissions/:userId', requirePermission('admin', 'can_view'), async (req, res) => {
  const rows = await query(
    `SELECT lp.*, l.name AS ledger_name, lg.name AS group_name
     FROM ledger_permissions lp
     JOIN ledgers l ON l.id=lp.ledger_id
     JOIN ledger_groups lg ON lg.id=l.group_id
     WHERE lp.user_id=$1 AND lp.mill_id=$2`,
    [req.params.userId, req.user.millId]
  );
  success(res, rows.rows);
});

router.post('/ledger-permissions', requirePermission('admin', 'can_create'), async (req, res) => {
  const { user_id, ledger_ids, can_view = true, can_post = false } = req.body;
  const millId = req.user.millId;
  for (const ledger_id of ledger_ids) {
    await query(
      `INSERT INTO ledger_permissions (mill_id, user_id, ledger_id, can_view, can_post, granted_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, ledger_id) DO UPDATE SET can_view=$4, can_post=$5`,
      [millId, user_id, ledger_id, can_view, can_post, req.user.id]
    );
  }
  success(res, null, 'Ledger permissions updated');
});

router.delete('/ledger-permissions/:userId/:ledgerId', requirePermission('admin', 'can_delete'), async (req, res) => {
  await query('DELETE FROM ledger_permissions WHERE user_id=$1 AND ledger_id=$2 AND mill_id=$3',
    [req.params.userId, req.params.ledgerId, req.user.millId]);
  success(res, null, 'Permission removed');
});

// ══ VOUCHER TYPES ════════════════════════════════════════════

router.get('/voucher-types', async (req, res) => {
  const rows = await query('SELECT * FROM voucher_type_masters WHERE mill_id=$1 ORDER BY name', [req.user.millId]);
  success(res, rows.rows);
});

router.post('/voucher-types', requirePermission('admin', 'can_create'), validate(Joi.object({
  name:           Joi.string().max(100).required(),
  abbreviation:   Joi.string().max(10).required(),
  nature:         Joi.string().valid('payment','receipt','contra','journal','purchase','sales','debit_note','credit_note','stock_transfer','production','consumption').required(),
  affects_stock:  Joi.boolean().default(false),
  affects_ledger: Joi.boolean().default(true),
  prefix:         Joi.string().max(10).allow('',null),
})), async (req, res) => {
  const r = await query(
    `INSERT INTO voucher_type_masters (mill_id, name, abbreviation, nature, affects_stock, affects_ledger, prefix)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.millId, req.body.name, req.body.abbreviation, req.body.nature, req.body.affects_stock, req.body.affects_ledger, req.body.prefix]
  );
  created(res, r.rows[0], 'Voucher type created');
});

// ══ UNITS ════════════════════════════════════════════════════

router.get('/units', async (req, res) => {
  const rows = await query('SELECT * FROM units WHERE mill_id=$1 ORDER BY name', [req.user.millId]);
  success(res, rows.rows);
});

router.post('/units', requirePermission('masters', 'can_create'), validate(Joi.object({
  name:         Joi.string().max(30).required(),
  abbreviation: Joi.string().max(10).required(),
})), async (req, res) => {
  const r = await query(
    `INSERT INTO units (mill_id, name, abbreviation) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.millId, req.body.name, req.body.abbreviation]
  );
  created(res, r.rows[0], 'Unit created');
});

// ══ STOCK GROUPS ═════════════════════════════════════════════

router.get('/stock-groups', async (req, res) => {
  const rows = await query(
    `SELECT sg.*, p.name AS parent_name FROM stock_groups sg
     LEFT JOIN stock_groups p ON p.id=sg.parent_id
     WHERE sg.mill_id=$1 ORDER BY sg.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

router.post('/stock-groups', requirePermission('masters', 'can_create'), validate(Joi.object({
  name:      Joi.string().max(150).required(),
  parent_id: Joi.number().integer().allow(null),
})), async (req, res) => {
  const r = await query(
    `INSERT INTO stock_groups (mill_id, name, parent_id) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.millId, req.body.name, req.body.parent_id || null]
  );
  created(res, r.rows[0], 'Stock group created');
});

// ══ COST CENTERS ═════════════════════════════════════════════

router.get('/cost-centers', async (req, res) => {
  const rows = await query(
    `SELECT cc.*, p.name AS parent_name FROM cost_centers cc
     LEFT JOIN cost_centers p ON p.id=cc.parent_id
     WHERE cc.mill_id=$1 ORDER BY cc.name`,
    [req.user.millId]
  );
  success(res, rows.rows);
});

router.post('/cost-centers', requirePermission('masters', 'can_create'), validate(Joi.object({
  name:      Joi.string().max(150).required(),
  parent_id: Joi.number().integer().allow(null),
})), async (req, res) => {
  const r = await query(
    `INSERT INTO cost_centers (mill_id, name, parent_id) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.millId, req.body.name, req.body.parent_id || null]
  );
  created(res, r.rows[0], 'Cost center created');
});

// ══ AUDIT TRAIL ══════════════════════════════════════════════

router.get('/audit-trail', requirePermission('admin', 'can_view'), async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { entity_type, user_id, from, to } = req.query;
  const millId = req.user.millId;
  const params = [millId];
  let where = 'mill_id=$1';
  if (entity_type) { params.push(entity_type); where += ` AND entity_type=$${params.length}`; }
  if (user_id)     { params.push(user_id);      where += ` AND user_id=$${params.length}`; }
  if (from)        { params.push(from);          where += ` AND created_at>=$${params.length}`; }
  if (to)          { params.push(to);            where += ` AND created_at<=$${params.length}`; }
  const [rows, cnt] = await Promise.all([
    query(`SELECT * FROM audit_trail WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM audit_trail WHERE ${where}`, params),
  ]);
  paginated(res, rows.rows, parseInt(cnt.rows[0].total), page, limit);
});

module.exports = router;
