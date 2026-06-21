/**
 * Audit trail middleware
 * Records all CREATE/UPDATE/DELETE/APPROVE actions with old/new values
 */
const { query } = require('../config/database');

async function recordAudit(client, {
  millId, userId, userName, action, entityType, entityId, entityRef,
  oldData = null, newData = null, changedFields = null, ipAddress = null,
}) {
  try {
    await (client || { query: (...a) => query(...a) }).query(
      `INSERT INTO audit_trail
         (mill_id, user_id, user_name, action, entity_type, entity_id, entity_ref, old_data, new_data, changed_fields, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        millId, userId, userName, action, entityType, entityId || null,
        entityRef || null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        changedFields ? changedFields : null,
        ipAddress,
      ]
    );
  } catch (e) {
    // Audit failure must never block the main transaction
    console.error('[audit] Failed to record audit:', e.message);
  }
}

function getChangedFields(oldData, newData) {
  if (!oldData || !newData) return null;
  return Object.keys(newData).filter((k) => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));
}

module.exports = { recordAudit, getChangedFields };
