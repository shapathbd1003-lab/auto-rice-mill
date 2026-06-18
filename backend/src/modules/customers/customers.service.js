const repo = require('./customers.repository');
const { getClient } = require('../../config/database');
const { AppError } = require('../../middleware/errorHandler');

async function list(millId, opts) {
  return repo.findAll(millId, opts);
}

async function getById(millId, id) {
  const customer = await repo.findById(millId, id);
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  return customer;
}

async function create(millId, data, createdBy) {
  return repo.create(millId, data, createdBy);
}

async function update(millId, id, data) {
  await getById(millId, id);
  return repo.update(millId, id, data);
}

async function remove(millId, id) {
  await getById(millId, id);
  await repo.softDelete(millId, id);
}

async function getLedger(millId, customerId, opts) {
  await getById(millId, customerId);
  return repo.getLedger(millId, customerId, opts);
}

async function recordPayment(millId, customerId, { amount, date, description, accountId }, userId) {
  await getById(millId, customerId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await repo.addLedgerEntry(client, {
      millId, customerId, date, description: description || 'Payment received',
      debit: 0, credit: amount, referenceType: 'payment', referenceId: null, createdBy: userId,
    });
    if (accountId) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id, date, account_id, type, amount, description, reference_type, created_by)
         VALUES ($1,$2,$3,'payment_received',$4,$5,'customer_payment',$6)`,
        [millId, date, accountId, amount, description || `Payment from customer #${customerId}`, userId]
      );
      await client.query('UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2', [amount, accountId]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function recordDue(millId, customerId, { amount, date, description }, userId) {
  await getById(millId, customerId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await repo.addLedgerEntry(client, {
      millId, customerId, date, description: description || 'Due added',
      debit: amount, credit: 0, referenceType: 'due', referenceId: null, createdBy: userId,
    });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, update, remove, getLedger, recordPayment, recordDue };
