const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const ctrl = require('./customers.controller');

const createSchema = Joi.object({
  code:            Joi.string().max(20).required(),
  name:            Joi.string().max(150).required(),
  name_bn:         Joi.string().max(150).allow('', null),
  phone:           Joi.string().max(20).allow('', null),
  address:         Joi.string().allow('', null),
  credit_limit:    Joi.number().min(0).default(0),
  opening_balance: Joi.number().default(0),
});

const updateSchema = createSchema.fork(Object.keys(createSchema.describe().keys), (s) => s.optional());

const paymentSchema = Joi.object({
  amount:      Joi.number().positive().required(),
  date:        Joi.string().isoDate().required(),
  description: Joi.string().allow('', null),
  accountId:   Joi.number().integer().allow(null),
});

router.use(requireAuth);

router.get('/',               ctrl.list);
router.post('/',              requireRole('admin','manager','sales'), validate(createSchema), ctrl.create);
router.get('/:id',            ctrl.getById);
router.put('/:id',            requireRole('admin','manager','sales'), validate(updateSchema), ctrl.update);
router.delete('/:id',         requireRole('admin','manager'), ctrl.remove);
router.get('/:id/ledger',     ctrl.getLedger);
router.post('/:id/payment',   requireRole('admin','manager','accountant','sales'), validate(paymentSchema), ctrl.recordPayment);
router.post('/:id/due',       requireRole('admin','manager','accountant','sales'), validate(paymentSchema), ctrl.recordDue);

module.exports = router;
