const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query } = require('../../config/database');
const service = require('./inventory.service');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

router.get('/items', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const data = await service.listItems(req.user.millId, { limit, offset, search: req.query.search, category: req.query.category });
  paginated(res, data.rows, data.total, page, limit);
});

router.post('/items', requireRole('admin','manager','storekeeper'), async (req, res) => {
  const r = await query(
    `INSERT INTO inventory_items (mill_id, code, name, name_bn, category, unit, unit_weight, reorder_level, sale_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.millId, req.body.code, req.body.name, req.body.name_bn, req.body.category,
     req.body.unit, req.body.unit_weight, req.body.reorder_level || 0, req.body.sale_price]
  );
  created(res, r.rows[0], 'Item created');
});

router.put('/items/:id', requireRole('admin','manager','storekeeper'), async (req, res) => {
  const fields = ['name','name_bn','unit','unit_weight','reorder_level','sale_price','is_active'];
  const updates = []; const params = [];
  let idx = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${idx}`); params.push(req.body[f]); idx++; }
  }
  updates.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  const r = await query(`UPDATE inventory_items SET ${updates.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1} RETURNING *`, params);
  success(res, r.rows[0], 'Item updated');
});

router.get('/stock', async (req, res) => {
  const data = await service.getStockSummary(req.user.millId);
  success(res, data);
});

router.post('/stock/adjust', requireRole('admin','manager','storekeeper'), validate(Joi.object({
  itemId:   Joi.number().integer().required(),
  quantity: Joi.number().required(),
  notes:    Joi.string().allow('', null),
})), async (req, res) => {
  const data = await service.adjustStock(req.user.millId, req.body.itemId, req.body.quantity, req.body.notes, req.user.id);
  success(res, data, 'Stock adjusted');
});

router.get('/transactions', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const data = await service.getTransactions(req.user.millId, {
    limit, offset,
    itemId: req.query.itemId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  paginated(res, data.rows, data.total, page, limit);
});

module.exports = router;
