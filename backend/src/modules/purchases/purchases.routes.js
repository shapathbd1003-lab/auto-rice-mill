const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query, getClient } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { generateInvoiceNumber } = require('../../utils/invoiceNumber');
const { addStock } = require('../inventory/inventory.service');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  let sql = `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
             WHERE p.mill_id=$1 AND p.deleted_at IS NULL`;
  const params = [millId]; let idx = 2;
  if (req.query.supplierId) { sql += ` AND p.supplier_id=$${idx}`; params.push(req.query.supplierId); idx++; }
  if (req.query.startDate)  { sql += ` AND p.date>=$${idx}`;        params.push(req.query.startDate);  idx++; }
  if (req.query.endDate)    { sql += ` AND p.date<=$${idx}`;        params.push(req.query.endDate);    idx++; }
  if (req.query.status)     { sql += ` AND p.status=$${idx}`;       params.push(req.query.status);     idx++; }
  const cntRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM purchases p'), params);
  const total = parseInt(cntRes.rows[0].total);
  sql += ` ORDER BY p.date DESC,p.id DESC LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, total, page, limit);
});

const purchaseSchema = Joi.object({
  supplierId:    Joi.number().integer().required(),
  vehicleId:     Joi.number().integer().allow(null),
  date:          Joi.string().isoDate().required(),
  grossWeight:   Joi.number().positive().allow(null),
  tareWeight:    Joi.number().min(0).allow(null),
  netWeight:     Joi.number().positive().allow(null),
  moisturePct:   Joi.number().min(0).max(100).allow(null),
  unitPrice:     Joi.number().positive().allow(null),
  transportCost: Joi.number().min(0).default(0),
  otherCost:     Joi.number().min(0).default(0),
  totalAmount:   Joi.number().positive().required(),
  paidAmount:    Joi.number().min(0).default(0),
  paddyItemId:   Joi.number().integer().allow(null),
  notes:         Joi.string().allow('', null),
});

router.post('/', requireRole('admin','manager','storekeeper'), validate(purchaseSchema), async (req, res) => {
  const millId = req.user.millId;
  const d = req.body;
  const invoiceNumber = await generateInvoiceNumber(millId, 'PUR');
  const dueAmount = d.totalAmount - (d.paidAmount || 0);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO purchases (mill_id,invoice_number,date,supplier_id,vehicle_id,gross_weight,tare_weight,net_weight,moisture_pct,unit_price,
         transport_cost,other_cost,total_amount,paid_amount,due_amount,notes,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'received',$17) RETURNING *`,
      [millId, invoiceNumber, d.date, d.supplierId, d.vehicleId, d.grossWeight, d.tareWeight,
       d.netWeight, d.moisturePct, d.unitPrice, d.transportCost, d.otherCost,
       d.totalAmount, d.paidAmount, dueAmount, d.notes, req.user.id]
    );
    const purchase = r.rows[0];

    // Update supplier ledger
    const suppRes = await client.query('SELECT balance FROM supplier_ledger WHERE supplier_id=$1 ORDER BY id DESC LIMIT 1', [d.supplierId]);
    const prevBal = suppRes.rows[0]?.balance ?? 0;
    const newBal = prevBal + d.totalAmount - (d.paidAmount || 0);
    await client.query(
      `INSERT INTO supplier_ledger (mill_id,supplier_id,date,description,debit,credit,balance,reference_type,reference_id,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'purchase',$8,$9)`,
      [millId, d.supplierId, d.date, `Purchase ${invoiceNumber}`, d.paidAmount || 0, d.totalAmount, newBal, purchase.id, req.user.id]
    );
    await client.query('UPDATE suppliers SET balance=$1,updated_at=NOW() WHERE id=$2', [newBal, d.supplierId]);

    // Add to paddy stock if item specified
    if (d.paddyItemId && d.netWeight) {
      const unitCost = d.netWeight > 0 ? d.totalAmount / d.netWeight : 0;
      await addStock(client, millId, d.paddyItemId, d.netWeight, unitCost, 'purchase', purchase.id, req.user.id);
    }

    await client.query('COMMIT');
    created(res, purchase, 'Purchase created');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  const r = await query(
    `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=$1 AND p.mill_id=$2`,
    [req.params.id, req.user.millId]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase not found' } });
  success(res, r.rows[0]);
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  await query('UPDATE purchases SET deleted_at=NOW() WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  success(res, null, 'Purchase deleted');
});

module.exports = router;
