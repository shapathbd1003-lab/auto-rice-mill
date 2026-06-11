const service = require('./customers.service');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { rows, total } = await service.list(req.user.millId, {
    limit, offset,
    search: req.query.search,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
  });
  paginated(res, rows, total, page, limit);
}

async function getById(req, res) {
  const customer = await service.getById(req.user.millId, req.params.id);
  success(res, customer);
}

async function create(req, res) {
  const customer = await service.create(req.user.millId, req.body, req.user.id);
  created(res, customer, 'Customer created');
}

async function update(req, res) {
  const customer = await service.update(req.user.millId, req.params.id, req.body);
  success(res, customer, 'Customer updated');
}

async function remove(req, res) {
  await service.remove(req.user.millId, req.params.id);
  success(res, null, 'Customer deleted');
}

async function getLedger(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { rows, total } = await service.getLedger(req.user.millId, req.params.id, {
    limit, offset,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  paginated(res, rows, total, page, limit);
}

async function recordPayment(req, res) {
  await service.recordPayment(req.user.millId, req.params.id, req.body, req.user.id);
  success(res, null, 'Payment recorded');
}

module.exports = { list, getById, create, update, remove, getLedger, recordPayment };
