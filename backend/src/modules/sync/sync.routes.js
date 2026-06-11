const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

// Desktop pushes its local changes
router.post('/push', async (req, res) => {
  const { items, deviceId } = req.body;
  const millId = req.user.millId;
  let processed = 0;
  let errors = 0;

  for (const item of items || []) {
    try {
      // Insert into sync_queue for processing
      await query(
        `INSERT INTO sync_queue (entity_type,entity_id,operation,payload,device_id,mill_id,user_id,is_synced,synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
         ON CONFLICT DO NOTHING`,
        [item.entityType, item.entityId, item.operation, JSON.stringify(item.payload), deviceId, millId, req.user.id]
      );
      processed++;
    } catch {
      errors++;
    }
  }
  success(res, { processed, errors }, 'Sync push complete');
});

// Desktop pulls server changes since timestamp
router.get('/pull', async (req, res) => {
  const since = req.query.since || '1970-01-01T00:00:00Z';
  const millId = req.user.millId;

  const tables = [
    'customers', 'suppliers', 'vehicles', 'purchases', 'inventory_items',
    'sales_orders', 'production_batches', 'employees',
  ];

  const changes = {};
  for (const table of tables) {
    const r = await query(
      `SELECT * FROM ${table} WHERE mill_id=$1 AND updated_at > $2 ORDER BY updated_at ASC LIMIT 500`,
      [millId, since]
    );
    if (r.rows.length) changes[table] = r.rows;
  }

  success(res, { changes, serverTime: new Date().toISOString() });
});

router.get('/status', async (req, res) => {
  const r = await query(
    'SELECT COUNT(*) AS pending FROM sync_queue WHERE mill_id=$1 AND is_synced=FALSE',
    [req.user.millId]
  );
  success(res, { pendingItems: parseInt(r.rows[0].pending), serverTime: new Date().toISOString() });
});

module.exports = router;
