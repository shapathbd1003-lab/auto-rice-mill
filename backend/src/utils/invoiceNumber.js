const { query } = require('../config/database');

async function generateInvoiceNumber(millId, prefix) {
  const year = new Date().getFullYear();
  const tableMap = {
    INV: 'sales_orders',
    PUR: 'purchases',
    BAT: 'production_batches',
  };
  const table = tableMap[prefix];
  const col   = prefix === 'BAT' ? 'batch_number' : 'invoice_number';

  const result = await query(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE mill_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [millId, year]
  );
  const seq = String(parseInt(result.rows[0].cnt) + 1).padStart(5, '0');
  return `${prefix}-${year}-${seq}`;
}

module.exports = { generateInvoiceNumber };
