const { query, getClient } = require('../../config/database');
const { AppError } = require('../../middleware/errorHandler');

async function listItems(millId, opts = {}) {
  const { limit = 50, offset = 0, search, category } = opts;
  let sql = `SELECT * FROM inventory_items WHERE mill_id = $1 AND is_active = TRUE`;
  const params = [millId];
  let idx = 2;
  if (search)   { sql += ` AND (name ILIKE $${idx} OR code ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  if (category) { sql += ` AND category = $${idx}`; params.push(category); idx++; }
  const countResult = await query(sql.replace('SELECT *', 'SELECT COUNT(*) AS total'), params);
  const total = parseInt(countResult.rows[0].total);
  sql += ` ORDER BY category, name LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  return { rows: result.rows, total };
}

async function getStockSummary(millId) {
  const result = await query(
    `SELECT id, code, name, name_bn, category, unit, current_stock, reorder_level, sale_price,
            CASE WHEN current_stock <= reorder_level THEN TRUE ELSE FALSE END AS low_stock
     FROM inventory_items WHERE mill_id = $1 AND is_active = TRUE ORDER BY category, name`,
    [millId]
  );
  return result.rows;
}

async function adjustStock(millId, itemId, quantity, notes, userId) {
  const item = await query('SELECT * FROM inventory_items WHERE id = $1 AND mill_id = $2', [itemId, millId]);
  if (!item.rows[0]) throw new AppError('Item not found', 404, 'NOT_FOUND');

  const newStock = item.rows[0].current_stock + quantity;
  if (newStock < 0) throw new AppError('Insufficient stock', 400, 'INSUFFICIENT_STOCK');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE inventory_items SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, itemId]);
    await client.query(
      `INSERT INTO stock_transactions (mill_id, item_id, date, type, quantity, balance_after, notes, created_by)
       VALUES ($1, $2, CURRENT_DATE, 'adjustment', $3, $4, $5, $6)`,
      [millId, itemId, quantity, newStock, notes, userId]
    );
    await client.query('COMMIT');
    return { itemId, adjustment: quantity, newStock };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deductStock(client, millId, itemId, quantity, referenceType, referenceId, userId) {
  const item = await client.query('SELECT current_stock FROM inventory_items WHERE id = $1 AND mill_id = $2 FOR UPDATE', [itemId, millId]);
  if (!item.rows[0]) throw new AppError(`Item ${itemId} not found`, 404, 'NOT_FOUND');
  const newStock = item.rows[0].current_stock - quantity;
  if (newStock < 0) throw new AppError(`Insufficient stock for item ${itemId}`, 400, 'INSUFFICIENT_STOCK');
  await client.query('UPDATE inventory_items SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, itemId]);
  await client.query(
    `INSERT INTO stock_transactions (mill_id, item_id, date, type, quantity, balance_after, reference_type, reference_id, created_by)
     VALUES ($1,$2,CURRENT_DATE,'out',$3,$4,$5,$6,$7)`,
    [millId, itemId, -quantity, newStock, referenceType, referenceId, userId]
  );
  return newStock;
}

async function addStock(client, millId, itemId, quantity, unitCost, referenceType, referenceId, userId) {
  const item = await client.query('SELECT current_stock FROM inventory_items WHERE id = $1 AND mill_id = $2 FOR UPDATE', [itemId, millId]);
  if (!item.rows[0]) throw new AppError(`Item ${itemId} not found`, 404, 'NOT_FOUND');
  const newStock = item.rows[0].current_stock + quantity;
  await client.query('UPDATE inventory_items SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, itemId]);
  await client.query(
    `INSERT INTO stock_transactions (mill_id, item_id, date, type, quantity, balance_after, unit_cost, reference_type, reference_id, created_by)
     VALUES ($1,$2,CURRENT_DATE,'in',$3,$4,$5,$6,$7,$8)`,
    [millId, itemId, quantity, newStock, unitCost, referenceType, referenceId, userId]
  );
  return newStock;
}

async function getTransactions(millId, opts = {}) {
  const { limit = 50, offset = 0, itemId, startDate, endDate } = opts;
  let sql = `SELECT st.*, ii.name AS item_name, ii.unit FROM stock_transactions st
             JOIN inventory_items ii ON ii.id = st.item_id
             WHERE st.mill_id = $1`;
  const params = [millId];
  let idx = 2;
  if (itemId)    { sql += ` AND st.item_id = $${idx}`; params.push(itemId); idx++; }
  if (startDate) { sql += ` AND st.date >= $${idx}`;   params.push(startDate); idx++; }
  if (endDate)   { sql += ` AND st.date <= $${idx}`;   params.push(endDate); idx++; }
  const countResult = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM stock_transactions st'), params);
  const total = parseInt(countResult.rows[0].total);
  sql += ` ORDER BY st.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  return { rows: result.rows, total };
}

module.exports = { listItems, getStockSummary, adjustStock, deductStock, addStock, getTransactions };
