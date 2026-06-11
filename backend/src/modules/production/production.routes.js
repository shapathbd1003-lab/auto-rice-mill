const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { generateInvoiceNumber } = require('../../utils/invoiceNumber');
const { deductStock, addStock } = require('../inventory/inventory.service');

router.use(requireAuth);

router.get('/batches', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  let sql = `SELECT pb.*, u.name AS created_by_name FROM production_batches pb
             LEFT JOIN users u ON u.id=pb.created_by WHERE pb.mill_id=$1`;
  const params = [millId]; let idx = 2;
  if (req.query.startDate) { sql += ` AND pb.date>=$${idx}`; params.push(req.query.startDate); idx++; }
  if (req.query.endDate)   { sql += ` AND pb.date<=$${idx}`; params.push(req.query.endDate);   idx++; }
  if (req.query.status)    { sql += ` AND pb.status=$${idx}`; params.push(req.query.status);   idx++; }
  const cntRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM production_batches pb'), params);
  sql += ` ORDER BY pb.date DESC,pb.id DESC LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

const batchSchema = Joi.object({
  date:          Joi.string().isoDate().required(),
  paddyQuantity: Joi.number().positive().required(),
  paddySource:   Joi.string().valid('stock','direct_purchase').default('stock'),
  purchaseId:    Joi.number().integer().allow(null),
  paddyItemId:   Joi.number().integer().allow(null),
  notes:         Joi.string().allow('', null),
});

router.post('/batches', requireRole('admin','manager','operator'), validate(batchSchema), async (req, res) => {
  const millId = req.user.millId;
  const d = req.body;
  const batchNumber = await generateInvoiceNumber(millId, 'BAT');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Deduct paddy from stock if source is stock
    if (d.paddySource === 'stock' && d.paddyItemId) {
      await deductStock(client, millId, d.paddyItemId, d.paddyQuantity, 'production', null, req.user.id);
    }
    const r = await client.query(
      `INSERT INTO production_batches (mill_id,batch_number,date,paddy_quantity,paddy_source,purchase_id,status,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'in_progress',$7,$8) RETURNING *`,
      [millId, batchNumber, d.date, d.paddyQuantity, d.paddySource, d.purchaseId, d.notes, req.user.id]
    );
    await client.query('COMMIT');
    created(res, r.rows[0], 'Production batch created');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.get('/batches/:id', async (req, res) => {
  const r = await query('SELECT * FROM production_batches WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  if (!r.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } });
  const outputs = await query('SELECT * FROM production_outputs WHERE batch_id=$1', [req.params.id]);
  success(res, { ...r.rows[0], outputs: outputs.rows });
});

const completeSchema = Joi.object({
  outputs: Joi.array().items(Joi.object({
    productType: Joi.string().valid('rice','bran','husk','broken_rice').required(),
    quantity:    Joi.number().positive().required(),
    itemId:      Joi.number().integer().required(),
  })).min(1).required(),
});

router.post('/batches/:id/complete', requireRole('admin','manager','operator'), validate(completeSchema), async (req, res) => {
  const millId = req.user.millId;
  const batchRes = await query('SELECT * FROM production_batches WHERE id=$1 AND mill_id=$2', [req.params.id, millId]);
  const batch = batchRes.rows[0];
  if (!batch) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } });
  if (batch.status !== 'in_progress') return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Batch already completed' } });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const out of req.body.outputs) {
      const yieldPct = (out.quantity / batch.paddy_quantity) * 100;
      await client.query(
        'INSERT INTO production_outputs (batch_id,mill_id,product_type,quantity,yield_pct) VALUES ($1,$2,$3,$4,$5)',
        [batch.id, millId, out.productType, out.quantity, yieldPct]
      );
      await addStock(client, millId, out.itemId, out.quantity, null, 'production', batch.id, req.user.id);
    }
    await client.query('UPDATE production_batches SET status=\'completed\',updated_at=NOW() WHERE id=$1', [batch.id]);
    await client.query('COMMIT');
    success(res, null, 'Batch completed');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
