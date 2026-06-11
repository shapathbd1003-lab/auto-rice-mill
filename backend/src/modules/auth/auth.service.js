const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const { AppError } = require('../../middleware/errorHandler');

async function login(email, password, millId) {
  const result = await query(
    `SELECT u.*, m.name AS mill_name FROM users u
     JOIN mills m ON m.id = u.mill_id
     WHERE u.email = $1 AND u.mill_id = $2 AND u.deleted_at IS NULL`,
    [email.toLowerCase(), millId]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const payload = { id: user.id, millId: user.mill_id, role: user.role, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      millId: user.mill_id,
      millName: user.mill_name,
    },
  };
}

async function refresh(refreshToken) {
  const result = await query(
    'SELECT rt.*, u.id AS uid, u.mill_id, u.role, u.email FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = $1 AND rt.expires_at > NOW()',
    [refreshToken]
  );
  const row = result.rows[0];
  if (!row) throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');

  await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

  const payload = { id: row.uid, millId: row.mill_id, role: row.role, email: row.email };
  const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const newRefresh = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [row.uid, newRefresh, expiresAt]);

  return { token: newToken, refreshToken: newRefresh };
}

async function logout(refreshToken) {
  await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
}

async function changePassword(userId, oldPassword, newPassword) {
  const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new AppError('Current password is incorrect', 400, 'BAD_REQUEST');

  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
}

module.exports = { login, refresh, logout, changePassword };
