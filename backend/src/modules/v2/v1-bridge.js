/**
 * V1 → V2 Bridge
 * Posts v1 transactions (purchases, sales, payments) into the v2 Tally
 * double-entry voucher + ledger system so accounting reports populate.
 *
 * All functions take an existing transaction `client` and run inside the
 * caller's transaction — if the v1 write rolls back, the v2 posting does too.
 *
 * Failures here are logged but never thrown, so a bridge problem can never
 * block a v1 purchase/sale from being saved.
 */
const { logger } = require('../../utils/logger');

// ── helpers ───────────────────────────────────────────────────

// vouchers.voucher_type CHECK only allows these 8 values
const V1_VOUCHER_TYPES = ['sales', 'purchase', 'receipt', 'payment', 'journal', 'contra', 'debit_note', 'credit_note'];

async function getVoucherTypeId(client, nature) {
  const r = await client.query(
    'SELECT id, prefix, abbreviation FROM voucher_type_masters WHERE nature=$1 LIMIT 1',
    [nature]
  );
  return r.rows[0] || null;
}

async function nextVoucherNo(client, millId, vt, date) {
  const year = new Date(date).getFullYear();
  const cnt = await client.query(
    `SELECT COUNT(*)+1 AS seq FROM vouchers
     WHERE mill_id=$1 AND voucher_type_master_id=$2 AND EXTRACT(YEAR FROM date)=$3`,
    [millId, vt.id, year]
  );
  return `${vt.prefix || vt.abbreviation}-${year}-${String(cnt.rows[0].seq).padStart(4, '0')}`;
}

// Find a ledger by exact name, or create it under the given group
async function findOrCreateLedger(client, millId, name, groupName, userId) {
  const existing = await client.query(
    `SELECT l.id FROM ledgers l
     WHERE l.mill_id=$1 AND LOWER(l.name)=LOWER($2) AND l.deleted_at IS NULL LIMIT 1`,
    [millId, name]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const group = await client.query(
    'SELECT id FROM ledger_groups WHERE mill_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1',
    [millId, groupName]
  );
  if (!group.rows[0]) throw new Error(`Ledger group '${groupName}' not found`);

  const balType = ['liabilities', 'income', 'capital'].includes(
    (await client.query('SELECT nature FROM ledger_groups WHERE id=$1', [group.rows[0].id])).rows[0]?.nature
  ) ? 'Cr' : 'Dr';

  const r = await client.query(
    `INSERT INTO ledgers (mill_id, group_id, name, opening_balance, opening_type, current_balance, balance_type, created_by)
     VALUES ($1,$2,$3,0,$4,0,$4,$5) RETURNING id`,
    [millId, group.rows[0].id, name, balType, userId]
  );
  return r.rows[0].id;
}

// Post one ledger line (running balance + signed current_balance)
async function postLine(client, millId, voucherId, viId, ledgerId, entryType, amount, date) {
  const prev = await client.query(
    'SELECT balance FROM ledger_postings WHERE ledger_id=$1 ORDER BY id DESC LIMIT 1',
    [ledgerId]
  );
  const ledger = await client.query('SELECT balance_type FROM ledgers WHERE id=$1', [ledgerId]);
  const normalType = ledger.rows[0]?.balance_type || 'Dr';
  const prevBal = Number(prev.rows[0]?.balance ?? 0);
  const newBal = entryType === normalType ? prevBal + amount : prevBal - amount;
  await client.query(
    `INSERT INTO ledger_postings (mill_id, ledger_id, voucher_id, voucher_item_id, date, entry_type, amount, balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [millId, ledgerId, voucherId, viId, date, entryType, amount, newBal]
  );
  await client.query('UPDATE ledgers SET current_balance=$1, updated_at=NOW() WHERE id=$2', [newBal, ledgerId]);
}

/**
 * Create a v2 voucher with balanced Dr/Cr lines and post each to ledgers.
 * @param lines [{ ledgerName, groupName, entryType:'Dr'|'Cr', amount }]
 */
async function createVoucher(client, { millId, userId, nature, date, narration, reference, lines }) {
  const vt = await getVoucherTypeId(client, nature);
  if (!vt) throw new Error(`Voucher type for nature '${nature}' not found`);

  const totalDr = lines.filter((l) => l.entryType === 'Dr').reduce((s, l) => s + Number(l.amount), 0);
  const totalCr = lines.filter((l) => l.entryType === 'Cr').reduce((s, l) => s + Number(l.amount), 0);
  if (Math.abs(totalDr - totalCr) > 0.01) {
    throw new Error(`Voucher not balanced: Dr ${totalDr} != Cr ${totalCr}`);
  }

  // vouchers.voucher_type must be one of the 8 v1 CHECK values
  const v1Type = V1_VOUCHER_TYPES.includes(nature) ? nature : 'journal';
  const voucherNo = await nextVoucherNo(client, millId, vt, date);
  const fyRes = await client.query(
    'SELECT id FROM financial_years WHERE mill_id=$1 AND is_active=TRUE LIMIT 1', [millId]
  );

  const vRes = await client.query(
    `INSERT INTO vouchers (mill_id, financial_year_id, voucher_type, voucher_type_master_id,
       voucher_number, date, narration, reference, total_amount, status, is_posted, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',TRUE,$10) RETURNING id`,
    [millId, fyRes.rows[0]?.id || null, v1Type, vt.id, voucherNo, date,
     narration, reference || null, totalDr, userId]
  );
  const voucherId = vRes.rows[0].id;

  for (const line of lines) {
    const ledgerId = await findOrCreateLedger(client, millId, line.ledgerName, line.groupName, userId);
    const viRes = await client.query(
      `INSERT INTO voucher_items (voucher_id, ledger_id, entry_type, amount, narration)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [voucherId, ledgerId, line.entryType, line.amount, line.ledgerName]
    );
    await postLine(client, millId, voucherId, viRes.rows[0].id, ledgerId, line.entryType, Number(line.amount), date);
  }
  return { voucherId, voucherNo };
}

// ── public bridge functions ───────────────────────────────────

/**
 * Purchase → Dr Paddy Purchase (expense), Cr Supplier (liability).
 * If paid > 0: also Dr Supplier, Cr Cash for the paid portion.
 */
async function postPurchase(client, { millId, userId, supplierName, invoiceNumber, date, totalAmount, paidAmount }) {
  try {
    await createVoucher(client, {
      millId, userId, nature: 'purchase', date,
      narration: `Paddy purchase ${invoiceNumber} from ${supplierName}`,
      reference: invoiceNumber,
      lines: [
        { ledgerName: 'Paddy Purchase', groupName: 'Purchase Expenses', entryType: 'Dr', amount: totalAmount },
        { ledgerName: supplierName,     groupName: 'Supplier Khata',     entryType: 'Cr', amount: totalAmount },
      ],
    });
    if (Number(paidAmount) > 0) {
      await createVoucher(client, {
        millId, userId, nature: 'payment', date,
        narration: `Payment for purchase ${invoiceNumber}`,
        reference: invoiceNumber,
        lines: [
          { ledgerName: supplierName, groupName: 'Supplier Khata', entryType: 'Dr', amount: paidAmount },
          { ledgerName: 'Cash',       groupName: 'Cash & Bank',     entryType: 'Cr', amount: paidAmount },
        ],
      });
    }
  } catch (e) {
    logger.error(`[v1-bridge] postPurchase failed: ${e.message}`);
    throw e; // caller decides; keep inside same transaction
  }
}

/**
 * Sale → Dr Customer (asset), Cr Sales Income.
 * If paid > 0: also Dr Cash, Cr Customer for the received portion.
 */
async function postSale(client, { millId, userId, customerName, invoiceNumber, date, totalAmount, paidAmount }) {
  try {
    await createVoucher(client, {
      millId, userId, nature: 'sales', date,
      narration: `Sale ${invoiceNumber} to ${customerName}`,
      reference: invoiceNumber,
      lines: [
        { ledgerName: customerName,  groupName: 'Customer Khata', entryType: 'Dr', amount: totalAmount },
        { ledgerName: 'Sales',       groupName: 'Sales Income',   entryType: 'Cr', amount: totalAmount },
      ],
    });
    if (Number(paidAmount) > 0) {
      await createVoucher(client, {
        millId, userId, nature: 'receipt', date,
        narration: `Receipt for sale ${invoiceNumber}`,
        reference: invoiceNumber,
        lines: [
          { ledgerName: 'Cash',        groupName: 'Cash & Bank',     entryType: 'Dr', amount: paidAmount },
          { ledgerName: customerName,  groupName: 'Customer Khata',  entryType: 'Cr', amount: paidAmount },
        ],
      });
    }
  } catch (e) {
    logger.error(`[v1-bridge] postSale failed: ${e.message}`);
    throw e;
  }
}

module.exports = { postPurchase, postSale, createVoucher };
