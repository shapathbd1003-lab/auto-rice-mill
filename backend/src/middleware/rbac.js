/**
 * Tally ERP 9 style RBAC middleware
 * - Role-based module permissions
 * - Row-level ledger security
 * - Auto-loads permissions from DB on each request (cached per token)
 */
const { query } = require('../config/database');
const { AppError } = require('./errorHandler');

// Load user's effective permissions from DB
async function loadUserPermissions(userId, millId) {
  const [perms, ledgerPerms] = await Promise.all([
    query(
      `SELECT DISTINCT rp.module, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete, rp.can_approve
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id=$1 AND r.mill_id=$2`,
      [userId, millId]
    ),
    query(
      `SELECT ledger_id, can_view, can_post FROM ledger_permissions WHERE user_id=$1 AND mill_id=$2`,
      [userId, millId]
    ),
  ]);

  // Merge: if multiple roles, take max permission
  const modulePerms = {};
  for (const row of perms.rows) {
    if (!modulePerms[row.module]) {
      modulePerms[row.module] = { can_view: false, can_create: false, can_edit: false, can_delete: false, can_approve: false };
    }
    const m = modulePerms[row.module];
    m.can_view    = m.can_view    || row.can_view;
    m.can_create  = m.can_create  || row.can_create;
    m.can_edit    = m.can_edit    || row.can_edit;
    m.can_delete  = m.can_delete  || row.can_delete;
    m.can_approve = m.can_approve || row.can_approve;
  }

  const ledgerSet = {};
  for (const row of ledgerPerms.rows) {
    ledgerSet[row.ledger_id] = { can_view: row.can_view, can_post: row.can_post };
  }

  return { modules: modulePerms, ledgers: ledgerSet };
}

// Middleware: require module permission
function requirePermission(module, action = 'can_view') {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      // Admin bypass (role === 'admin' kept for backward compat)
      if (req.user.role === 'admin' || req.user.isAdmin) return next();

      const perms = await loadUserPermissions(req.user.id, req.user.millId);
      req.user.permissions = perms;

      const modulePerm = perms.modules[module];
      if (!modulePerm || !modulePerm[action]) {
        throw new AppError(`Permission denied: ${module}.${action}`, 403, 'FORBIDDEN');
      }
      next();
    } catch (e) { next(e); }
  };
}

// Middleware: check row-level ledger access
async function filterLedgerAccess(req, ledgerIds) {
  if (!req.user) return ledgerIds;
  if (req.user.role === 'admin' || req.user.isAdmin) return ledgerIds;

  const perms = req.user.permissions || await loadUserPermissions(req.user.id, req.user.millId);
  const allowedLedgers = Object.keys(perms.ledgers).map(Number);

  // If no ledger permissions set, user sees all (open access)
  if (allowedLedgers.length === 0) return ledgerIds;

  return ledgerIds.filter((id) => allowedLedgers.includes(Number(id)));
}

// Middleware: attach permissions to req
async function attachPermissions(req, _res, next) {
  try {
    if (req.user && !req.user.permissions) {
      if (req.user.role !== 'admin') {
        req.user.permissions = await loadUserPermissions(req.user.id, req.user.millId);
        req.user.isAdmin = false;
      } else {
        req.user.isAdmin = true;
      }
    }
    next();
  } catch { next(); }
}

module.exports = { requirePermission, filterLedgerAccess, attachPermissions, loadUserPermissions };
