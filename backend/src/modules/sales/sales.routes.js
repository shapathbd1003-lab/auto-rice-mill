const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const service = require('./sales.service');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

const saleSchema = Joi.object({
  customerId:  Joi.number().integer().required(),
  saleType:    Joi.string().valid('retail','wholesale').default('retail'),
  date:        Joi.string().isoDate().required(),
  items:       Joi.array().items(Joi.object({
    itemId:    Joi.number().integer().required(),
    quantity:  Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
  })).min(1).required(),
  discount:    Joi.number().min(0).default(0),
  paidAmount:  Joi.number().min(0).default(0),
  accountId:   Joi.number().integer().allow(null),
  notes:       Joi.string().allow('', null),
});

const paymentSchema = Joi.object({
  amount:      Joi.number().positive().required(),
  date:        Joi.string().isoDate().required(),
  accountId:   Joi.number().integer().allow(null),
  description: Joi.string().allow('', null),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const data = await service.listSales(req.user.millId, {
    limit, offset,
    startDate: req.query.startDate, endDate: req.query.endDate,
    customerId: req.query.customerId, status: req.query.status,
  });
  paginated(res, data.rows, data.total, page, limit);
});

router.post('/', requireRole('admin','manager','sales'), validate(saleSchema), async (req, res) => {
  const sale = await service.createSale(req.user.millId, req.body, req.user.id);
  created(res, sale, 'Sale created');
});

router.get('/:id', async (req, res) => {
  const sale = await service.getSaleById(req.user.millId, req.params.id);
  success(res, sale);
});

router.post('/:id/payment', requireRole('admin','manager','accountant','sales'), validate(paymentSchema), async (req, res) => {
  await service.recordPayment(req.user.millId, req.params.id, req.body, req.user.id);
  success(res, null, 'Payment recorded');
});

module.exports = router;
