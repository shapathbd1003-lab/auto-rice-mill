-- ============================================================
-- Migration 005: Dynamic Khata / Universal Ledger Architecture
-- Extends ledgers table with contact info so ANY ledger can
-- act as a Customer/Supplier/Employee/Bank khata.
-- Adds group_type hint so UI knows how to render each group.
-- Bridges existing customers & suppliers into the ledger system.
-- ============================================================

-- ── Extend ledger_groups with group_type hint ──────────────
ALTER TABLE ledger_groups
  ADD COLUMN IF NOT EXISTS group_type VARCHAR(30) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ── Extend ledgers with contact info ─────────────────────────
ALTER TABLE ledgers
  ADD COLUMN IF NOT EXISTS phone     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS address   TEXT,
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150);

-- ── Seed Khata Groups ────────────────────────────────────────
-- Customer Khata (under Current Assets → Accounts Receivable)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Customer Khata', 'কাস্টমার খাতা', 'assets',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Accounts Receivable' LIMIT 1),
  'customer', TRUE
ON CONFLICT (mill_id, name) DO UPDATE SET group_type='customer';

-- Supplier Khata (under Current Liabilities → Accounts Payable)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Supplier Khata', 'সাপ্লায়ার খাতা', 'liabilities',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Accounts Payable' LIMIT 1),
  'supplier', TRUE
ON CONFLICT (mill_id, name) DO UPDATE SET group_type='supplier';

-- Employee Khata (under Operating Expenses)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Employee Khata', 'কর্মচারী খাতা', 'expenses',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Operating Expenses' LIMIT 1),
  'employee', TRUE
ON CONFLICT (mill_id, name) DO UPDATE SET group_type='employee';

-- Bank Khata (under Cash & Bank)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Bank Khata', 'ব্যাংক খাতা', 'assets',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Cash & Bank' LIMIT 1),
  'bank', TRUE
ON CONFLICT (mill_id, name) DO UPDATE SET group_type='bank';

-- Loan Khata (under Loans)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Loan Khata', 'ঋণ খাতা', 'liabilities',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Loans' LIMIT 1),
  'loan', FALSE
ON CONFLICT (mill_id, name) DO UPDATE SET group_type='loan';

-- Transport Khata (under Operating Expenses)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Transport Khata', 'পরিবহন খাতা', 'expenses',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Operating Expenses' LIMIT 1),
  'general', FALSE
ON CONFLICT (mill_id, name) DO NOTHING;

-- Farmer Khata (under Supplier Khata)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Farmer Khata', 'কৃষক খাতা', 'liabilities',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Supplier Khata' LIMIT 1),
  'supplier', FALSE
ON CONFLICT (mill_id, name) DO NOTHING;

-- Dealer Khata (under Customer Khata)
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, group_type, is_system)
SELECT 1, 'Dealer Khata', 'ডিলার খাতা', 'assets',
  (SELECT id FROM ledger_groups WHERE mill_id=1 AND name='Customer Khata' LIMIT 1),
  'customer', FALSE
ON CONFLICT (mill_id, name) DO NOTHING;

-- ── Bridge: sync existing customers into ledgers ──────────────
-- Each customer becomes a ledger under Customer Khata group.
-- Only inserts if not already there (idempotent).
INSERT INTO ledgers (mill_id, group_id, name, opening_balance, opening_type,
                     current_balance, balance_type, phone, address, notes, created_at)
SELECT
  c.mill_id,
  (SELECT id FROM ledger_groups WHERE mill_id=c.mill_id AND name='Customer Khata' LIMIT 1),
  c.name,
  c.opening_balance,
  'Dr',
  c.balance,
  'Dr',
  c.phone,
  c.address,
  CONCAT('Synced from customer #', c.id),
  c.created_at
FROM customers c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ledgers l
    WHERE l.mill_id = c.mill_id
      AND l.name = c.name
      AND l.group_id = (SELECT id FROM ledger_groups WHERE mill_id=c.mill_id AND name='Customer Khata' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- ── Bridge: sync existing suppliers into ledgers ──────────────
INSERT INTO ledgers (mill_id, group_id, name, opening_balance, opening_type,
                     current_balance, balance_type, phone, address, notes, created_at)
SELECT
  s.mill_id,
  (SELECT id FROM ledger_groups WHERE mill_id=s.mill_id AND name='Supplier Khata' LIMIT 1),
  s.name,
  s.opening_balance,
  'Cr',
  s.balance,
  'Cr',
  s.phone,
  s.address,
  CONCAT('Synced from supplier #', s.id),
  s.created_at
FROM suppliers s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ledgers l
    WHERE l.mill_id = s.mill_id
      AND l.name = s.name
      AND l.group_id = (SELECT id FROM ledger_groups WHERE mill_id=s.mill_id AND name='Supplier Khata' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- ── Bridge: sync existing employees into ledgers ──────────────
INSERT INTO ledgers (mill_id, group_id, name, opening_balance, opening_type,
                     current_balance, balance_type, phone, notes, created_at)
SELECT
  e.mill_id,
  (SELECT id FROM ledger_groups WHERE mill_id=e.mill_id AND name='Employee Khata' LIMIT 1),
  e.name,
  COALESCE(e.basic_salary, 0),
  'Dr',
  0,
  'Dr',
  e.phone,
  CONCAT('Synced from employee #', e.id, ' — ', COALESCE(e.designation,'')),
  e.created_at
FROM employees e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ledgers l
    WHERE l.mill_id = e.mill_id
      AND l.name = e.name
      AND l.group_id = (SELECT id FROM ledger_groups WHERE mill_id=e.mill_id AND name='Employee Khata' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- ── Voucher entries table: add explicit debit/credit columns ──
-- The existing voucher_items uses entry_type + amount.
-- Add convenience view so reports can query debit_amount/credit_amount directly.
CREATE OR REPLACE VIEW voucher_entries AS
SELECT
  vi.id,
  vi.voucher_id,
  vi.ledger_id,
  CASE WHEN vi.entry_type='Dr' THEN vi.amount ELSE 0 END AS debit_amount,
  CASE WHEN vi.entry_type='Cr' THEN vi.amount ELSE 0 END AS credit_amount,
  vi.narration,
  vi.created_at,
  v.voucher_type,
  v.voucher_number,
  v.date,
  v.mill_id,
  l.name AS ledger_name,
  lg.name AS group_name,
  lg.nature
FROM voucher_items vi
JOIN vouchers v ON v.id = vi.voucher_id
JOIN ledgers l ON l.id = vi.ledger_id
JOIN ledger_groups lg ON lg.id = l.group_id;

-- ── Indexes for performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ledgers_group_mill ON ledgers(mill_id, group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledgers_name_mill  ON ledgers(mill_id, name)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_groups_type ON ledger_groups(mill_id, group_type);
CREATE INDEX IF NOT EXISTS idx_lp_date_ledger     ON ledger_postings(ledger_id, date DESC);
