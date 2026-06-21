/**
 * V2 Auth — username+password login, no mill ID selection
 * Role is auto-loaded from user_roles table
 */
const router = require('express').Router();
const { validate, Joi } = require('../../middleware/validate');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');
const { AppError } = require('../../middleware/errorHandler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../../middleware/auth');
const { recordAudit } = require('../../middleware/auditTrail');

// POST /api/v2/auth/login — username or email + password
router.post('/login', validate(Joi.object({
  username: Joi.string().required(),  // accepts email OR username
  password: Joi.string().required(),
})), async (req, res) => {
  const { username, password } = req.body;

  // Find user by email (username field accepts email for now)
  const result = await query(
    `SELECT u.*, m.name AS mill_name,
            array_agg(r.name ORDER BY r.name) FILTER (WHERE r.id IS NOT NULL) AS role_names,
            bool_or(r.name='Administrator') AS is_admin
     FROM users u
     JOIN mills m ON m.id=u.mill_id
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     WHERE (u.email=LOWER($1) OR u.phone=$1) AND u.deleted_at IS NULL AND u.is_active=TRUE
     GROUP BY u.id, m.name`,
    [username]
  );

  const user = result.rows[0];
  if (!user) throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');

  await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

  const payload = {
    id:      user.id,
    millId:  user.mill_id,
    role:    user.is_admin ? 'admin' : 'staff',
    email:   user.email,
    isAdmin: user.is_admin,
    roles:   user.role_names || [],
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
  await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [user.id, refreshToken, expiresAt]);

  await recordAudit(null, {
    millId: user.mill_id, userId: user.id, userName: user.name,
    action: 'LOGIN', entityType: 'user', entityId: user.id, entityRef: user.email,
  });

  success(res, {
    token, refreshToken,
    user: {
      id:       user.id,
      name:     user.name,
      email:    user.email,
      millId:   user.mill_id,
      millName: user.mill_name,
      roles:    user.role_names || [],
      isAdmin:  user.is_admin,
    },
  }, 'Login successful');
});

// POST /api/v2/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400, 'BAD_REQUEST');
  const r = await query(
    `SELECT rt.*, u.id AS uid, u.mill_id, u.email,
            bool_or(ro.name='Administrator') AS is_admin,
            array_agg(ro.name) FILTER (WHERE ro.id IS NOT NULL) AS role_names
     FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles ro ON ro.id=ur.role_id
     WHERE rt.token=$1 AND rt.expires_at>NOW()
     GROUP BY rt.id, u.id`,
    [refreshToken]
  );
  const row = r.rows[0];
  if (!row) throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
  const payload = { id:row.uid, millId:row.mill_id, role:row.is_admin?'admin':'staff', email:row.email, isAdmin:row.is_admin };
  const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const newRefresh = uuidv4();
  await query('INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)', [row.uid, newRefresh, new Date(Date.now()+7*24*60*60*1000)]);
  success(res, { token: newToken, refreshToken: newRefresh });
});

// POST /api/v2/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
  success(res, null, 'Logged out');
});

// GET /api/v2/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const r = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login, m.name AS mill_name,
            array_agg(ro.name ORDER BY ro.name) FILTER (WHERE ro.id IS NOT NULL) AS roles,
            array_agg(json_build_object('module',rp.module,'can_view',rp.can_view,'can_create',rp.can_create,
              'can_edit',rp.can_edit,'can_delete',rp.can_delete,'can_approve',rp.can_approve))
            FILTER (WHERE rp.module IS NOT NULL) AS permissions
     FROM users u JOIN mills m ON m.id=u.mill_id
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles ro ON ro.id=ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id=ur.role_id
     WHERE u.id=$1 GROUP BY u.id, m.name`,
    [req.user.id]
  );
  success(res, r.rows[0]);
});

module.exports = router;
