const { getClient, query } = require('../../config/database');
const { AppError } = require('../../middleware/errorHandler');
const { addLedgerEntry } = require('../customers/customers.repository');
const { deductStock } = require('../inventory/inventory.service');
const { generateInvoiceNumber } = require('../../utils/invoiceNumber');

async function createSale(millId, data, userId) {
  const { customerId, saleType = 'retail', items, discount = 0, paidAmount = 0, date, notes, accountId } = data;

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalAmount = subtotal - discount;
  const dueAmount = totalAmount - paidAmount;

  const invoiceNumber = await generateInvoiceNumber(millId, 'INV');
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Create order
    const orderResult = await client.query(
      `INSERT INTO sales_orders (mill_id, invoice_number, date, customer_id, sale_type, subtotal, discount, total_amount, paid_amount, due_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [millId, invoiceNumber, date, customerId, saleType, subtotal, discount, totalAmount, paidAmount, dueAmount, notes, userId]
    );
    const order = orderResult.rows[0];

    // Insert items + deduct stock
    for (const item of items) {
      await client.query(
        'INSERT INTO sale_items (order_id, item_id, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.itemId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
      );
      await deductStock(client, millId, item.itemId, item.quantity, 'sale', order.id, userId);
    }

    // Customer ledger
    await addLedgerEntry(client, {
      millId, customerId, date, description: `Sale Invoice ${invoiceNumber}`,
      debit: totalAmount, credit: paidAmount, referenceType: 'sale', referenceId: order.id, createdBy: userId,
    });

    // If paid, record in financial transactions
    if (paidAmount > 0 && accountId) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id, date, account_id, type, amount, description, reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,'payment_received',$4,$5,'sale',$6,$7)`,
        [millId, date, accountId, paidAmount, `Payment for Invoice ${invoiceNumber}`, order.id, userId]
      );
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [paidAmount, accountId]);
    }

    await client.query('COMMIT');
    return { ...order, items };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function recordPayment(millId, orderId, { amount, date, accountId, description }, userId) {
  const orderResult = await query('SELECT * FROM sales_orders WHERE id = $1 AND mill_id = $2', [orderId, millId]);
  const order = orderResult.rows[0];
  if (!order) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  if (amount > order.due_amount) throw new AppError('Payment exceeds due amount', 400, 'BAD_REQUEST');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE sales_orders SET paid_amount = paid_amount + $1, due_amount = due_amount - $1, updated_at = NOW() WHERE id = $2',
      [amount, orderId]
    );
    await addLedgerEntry(client, {
      millId, customerId: order.customer_id, date, description: description || `Payment for Invoice ${order.invoice_number}`,
      debit: 0, credit: amount, referenceType: 'payment', referenceId: orderId, createdBy: userId,
    });
    if (accountId) {
      await client.query(
        `INSERT INTO financial_transactions (mill_id, date, account_id, type, amount, description, reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,'payment_received',$4,$5,'sale',$6,$7)`,
        [millId, date, accountId, amount, description || `Payment Invoice ${order.invoice_number}`, orderId, userId]
      );
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, accountId]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function listSales(millId, opts = {}) {
  const { limit = 20, offset = 0, startDate, endDate, customerId, status } = opts;
  let sql = `SELECT so.*, c.name AS customer_name FROM sales_orders so
             JOIN customers c ON c.id = so.customer_id
             WHERE so.mill_id = $1 AND so.deleted_at IS NULL`;
  const params = [millId];
  let idx = 2;
  if (startDate)  { sql += ` AND so.date >= $${idx}`; params.push(startDate); idx++; }
  if (endDate)    { sql += ` AND so.date <= $${idx}`; params.push(endDate);   idx++; }
  if (customerId) { sql += ` AND so.customer_id = $${idx}`; params.push(customerId); idx++; }
  if (status)     { sql += ` AND so.status = $${idx}`;       params.push(status);    idx++; }
  const countResult = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM sales_orders so'), params);
  const total = parseInt(countResult.rows[0].total);
  sql += ` ORDER BY so.date DESC, so.id DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  return { rows: result.rows, total };
}

async function getSaleById(millId, id) {
  const orderResult = await query(
    `SELECT so.*, c.name AS customer_name FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = $1 AND so.mill_id = $2`,
    [id, millId]
  );
  const order = orderResult.rows[0];
  if (!order) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  const itemsResult = await query(
    'SELECT si.*, ii.name AS item_name, ii.unit FROM sale_items si JOIN inventory_items ii ON ii.id = si.item_id WHERE si.order_id = $1',
    [id]
  );
  return { ...order, items: itemsResult.rows };
}

module.exports = { createSale, recordPayment, listSales, getSaleById };
