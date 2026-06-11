const { query } = require('../config/database');
const { logger } = require('../utils/logger');

function auditLog(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (body?.success && req.user) {
        query(
          `INSERT INTO audit_logs (mill_id, user_id, action, entity_type, entity_id, new_data, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.millId,
            req.user.id,
            action,
            entityType,
            body.data?.id || req.params?.id || null,
            JSON.stringify(body.data),
            req.ip,
          ]
        ).catch((e) => logger.error('Audit log failed', e));
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog };
