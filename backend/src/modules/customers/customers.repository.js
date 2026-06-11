const { query } = require('../../config/database');

async function findAll(millId, { limit, offset, search, isActive }) {
  let sql = `SELECT id, code, name, name_bn, phone, address, credit_limit, balance, is_active, created_at
             FROM customers WHERE mill_id = $1 AND deleted_at IS NULL`;
  const params = [millId];
  let idx = 2;

  if (search) {
    sql += ` AND (name ILIKE $${idx} OR code ILIKE $${idx} OR phone ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }
  if (isActive !== undefined) {
    sql += ` AND is_active = $${idx}`;
    params.push(isActive); idx++;
  }

  const countResult = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM'), params);
  const total = parseInt(countResult.rows[0].total);

  sql += ` ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return { rows: result.rows, total };
}

async function findById(millId, id) {
  const result = await query(
    'SELECT * FROM customers WHERE id = $1 AND mill_id = $2 AND deleted_at IS NULL',
    [id, millId]
  );
  return result.rows[0];
}

async function create(millId, data, createdBy) {
  const { code, name, name_bn, phone, address, credit_limit = 0, opening_balance = 0 } = data;
  const result = await query(
    `INSERT INTO customers (mill_id, code, name, name_bn, phone, address, credit_limit, opening_balance, balance, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) RETURNING *`,
    [millId, code, name, name_bn, phone, address, credit_limit, opening_balance, createdBy]
  );
  return result.rows[0];
}

async function update(millId, id, data) {
  const fields = [];
  const params = [];
  let idx = 1;
  const allowed = ['name', 'name_bn', 'phone', 'address', 'credit_limit', 'is_active'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      params.push(data[key]);
      idx++;
    }
  }
  if (!fields.length) return findById(millId, id);
  fields.push(`updated_at = NOW()`);
  params.push(id, millId);
  const result = await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${idx} AND mill_id = $${idx + 1} RETURNING *`,
    params
  );
  return result.rows[0];
}

async function softDelete(millId, id) {
  await query('UPDATE customers SET deleted_at = NOW() WHERE id = $1 AND mill_id = $2', [id, millId]);
}

async function getLedger(millId, customerId, { limit, offset, startDate, endDate }) {
  let sql = `SELECT * FROM customer_ledger WHERE mill_id = $1 AND customer_id = $2`;
  const params = [millId, customerId];
  let idx = 3;
  if (startDate) { sql += ` AND date >= $${idx}`; params.push(startDate); idx++; }
  if (endDate)   { sql += ` AND date <= $${idx}`; params.push(endDate);   idx++; }

  const countResult = await query(sql.replace('SELECT *', 'SELECT COUNT(*) AS total'), params);
  const total = parseInt(countResult.rows[0].total);

  sql += ` ORDER BY date DESC, id DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  return { rows: result.rows, total };
}

async function addLedgerEntry(client, { millId, customerId, date, description, debit, credit, referenceType, referenceId, createdBy }) {
  const prev = await client.query(
    'SELECT balance FROM customer_ledger WHERE customer_id = $1 ORDER BY id DESC LIMIT 1',
    [customerId]
  );
  const prevBalance = prev.rows[0]?.balance ?? 0;
  const balance = prevBalance + debit - credit;

  const result = await client.query(
    `INSERT INTO customer_ledger (mill_id, customer_id, date, description, debit, credit, balance, reference_type, reference_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [millId, customerId, date, description, debit, credit, balance, referenceType, referenceId, createdBy]
  );
  await client.query('UPDATE customers SET balance = $1, updated_at = NOW() WHERE id = $2', [balance, customerId]);
  return result.rows[0];
}

module.exports = { findAll, findById, create, update, softDelete, getLedger, addLedgerEntry };
