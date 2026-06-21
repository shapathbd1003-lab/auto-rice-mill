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
  // Get user basic info first
  const result = await query(
    `SELECT u.*, m.name AS mill_name
     FROM users u JOIN mills m ON m.id=u.mill_id
     WHERE (LOWER(u.email)=LOWER($1) OR u.phone=$1) AND u.deleted_at IS NULL AND u.is_active=TRUE
     LIMIT 1`,
    [username]
  );

  const user = result.rows[0];
  if (!user) throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');

  await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

  // Fetch roles separately to avoid JOIN duplication
  const rolesResult = await query(
    `SELECT DISTINCT ro.name, bool_or(ro.name='Administrator') OVER() AS is_admin
     FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id
     WHERE ur.user_id=$1 ORDER BY ro.name`,
    [user.id]
  );
  const roleNames = rolesResult.rows.map((r) => r.name);
  const isAdmin   = rolesResult.rows.some((r) => r.name === 'Administrator');

  const payload = {
    id:      user.id,
    millId:  user.mill_id,
    role:    isAdmin ? 'admin' : 'staff',
    email:   user.email,
    isAdmin: isAdmin,
    roles:   roleNames,
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
      roles:    roleNames,
      isAdmin:  isAdmin,
    },
  }, 'Login successful');
});

// POST /api/v2/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400, 'BAD_REQUEST');
  const r = await query(
    `SELECT rt.*, u.id AS uid, u.mill_id, u.email, u.name AS user_name
     FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id
     WHERE rt.token=$1 AND rt.expires_at>NOW() LIMIT 1`,
    [refreshToken]
  );
  const row = r.rows[0];
  if (!row) throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
  // Fetch roles separately
  const refreshRoles = await query(
    `SELECT DISTINCT ro.name FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id WHERE ur.user_id=$1 ORDER BY ro.name`,
    [row.uid]
  );
  const refreshRoleNames = refreshRoles.rows.map((r) => r.name);
  const refreshIsAdmin   = refreshRoleNames.includes('Administrator');
  row.role_names = refreshRoleNames;
  row.is_admin   = refreshIsAdmin;
  // Include roles in JWT so frontend stays in sync after refresh
  const payload = {
    id:      row.uid,
    millId:  row.mill_id,
    role:    row.is_admin ? 'admin' : 'staff',
    email:   row.email,
    isAdmin: row.is_admin,
    roles:   row.role_names || [],
  };
  const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const newRefresh = uuidv4();
  await query('INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)', [row.uid, newRefresh, new Date(Date.now()+7*24*60*60*1000)]);
  // Fetch user name for response
  const userInfo = await query('SELECT name, mill_id FROM users WHERE id=$1', [row.uid]);
  success(res, {
    token: newToken,
    refreshToken: newRefresh,
    user: {
      id:      row.uid,
      email:   row.email,
      name:    userInfo.rows[0]?.name || '',
      millId:  row.mill_id,
      roles:   row.role_names || [],
      isAdmin: row.is_admin,
    },
  });
});

// POST /api/v2/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
  success(res, null, 'Logged out');
});

// GET /api/v2/auth/me
router.get('/me', requireAuth, async (req, res) => {
  // Separate queries to avoid JOIN multiplication of roles
  const [userRow, rolesRow] = await Promise.all([
    query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login,
              m.name AS mill_name, bool_or(ro.name='Administrator') AS is_admin
       FROM users u JOIN mills m ON m.id=u.mill_id
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles ro ON ro.id=ur.role_id
       WHERE u.id=$1 GROUP BY u.id, m.name`,
      [req.user.id]
    ),
    query(
      `SELECT DISTINCT ro.name
       FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id
       WHERE ur.user_id=$1 ORDER BY ro.name`,
      [req.user.id]
    ),
  ]);
  const user = userRow.rows[0];
  if (!user) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'User not found' } });
  const roles = rolesRow.rows.map((r) => r.name);
  success(res, { ...user, roles, isAdmin: user.is_admin });
});

module.exports = router;
