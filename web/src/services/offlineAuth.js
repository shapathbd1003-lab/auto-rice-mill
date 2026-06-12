/**
 * Desktop offline authentication against local SQLite.
 * Checks credentials in the local users table, returns a minimal user object.
 * No JWT is issued — the desktop trusts the local session stored in electron-store.
 */
import { isDesktop, desktopDb } from './desktopAdapter';

export async function desktopLogin({ email, password, millId }) {
  if (!isDesktop) throw new Error('Not running in desktop mode');

  // bcrypt is not available in renderer — use a simple hash check stored during sync
  // The sync manager stores a password_hash from the server. We compare using SubtleCrypto.
  const user = await desktopDb.get(
    `SELECT u.*, m.name AS mill_name FROM users u
     JOIN mills m ON m.id = u.mill_id
     WHERE u.email = ? AND u.mill_id = ? AND u.is_active = 1`,
    [email, Number(millId)]
  );

  if (!user) throw new Error('Invalid credentials');

  // Verify password hash using Web Crypto (SHA-256 of password compared to stored hash)
  const stored = user.password_hash || '';
  const match  = await verifySha256(password, stored) || stored === password;
  if (!match) throw new Error('Invalid credentials');

  return {
    user: {
      id:        user.id,
      email:     user.email,
      name:      user.name,
      role:      user.role,
      millId:    user.mill_id,
      millName:  user.mill_name,
    },
    token: 'offline',
    refreshToken: 'offline',
    isOffline: true,
  };
}

async function verifySha256(plaintext, storedHash) {
  try {
    const enc  = new TextEncoder();
    const buf  = await crypto.subtle.digest('SHA-256', enc.encode(plaintext));
    const hex  = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === storedHash;
  } catch {
    return false;
  }
}
