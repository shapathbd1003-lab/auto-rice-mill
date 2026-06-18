-- ============================================================
-- Migration 004: Full ERP Core — Tally-style accounting layer
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FINANCIAL YEARS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_years (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(50)  NOT NULL,           -- e.g. "2024-2025"
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_locked   BOOLEAN      NOT NULL DEFAULT FALSE,
  locked_by   BIGINT       REFERENCES users(id),
  locked_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

-- Seed current financial year for mill 1
INSERT INTO financial_years (mill_id, name, start_date, end_date, is_active)
VALUES (1, '2025-2026', '2025-07-01', '2026-06-30', TRUE)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- LEDGER GROUPS (Chart of Accounts hierarchy)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_groups (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(150) NOT NULL,
  name_bn     VARCHAR(150),
  parent_id   BIGINT       REFERENCES ledger_groups(id),
  nature      VARCHAR(20)  NOT NULL CHECK (nature IN ('assets','liabilities','income','expenses','capital')),
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

-- Seed default groups for mill 1
INSERT INTO ledger_groups (mill_id, name, name_bn, nature, is_system) VALUES
  (1,'Assets','সম্পদ','assets',TRUE),
  (1,'Liabilities','দায়','liabilities',TRUE),
  (1,'Income','আয়','income',TRUE),
  (1,'Expenses','ব্যয়','expenses',TRUE),
  (1,'Capital','মূলধন','capital',TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Cash & Bank','নগদ ও ব্যাংক','assets',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Assets'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Current Assets','চলতি সম্পদ','assets',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Assets'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Fixed Assets','স্থায়ী সম্পদ','assets',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Assets'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Accounts Receivable','প্রাপ্য হিসাব','assets',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Current Assets'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Inventory','ইনভেন্টরি','assets',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Current Assets'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Current Liabilities','চলতি দায়','liabilities',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Liabilities'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Accounts Payable','প্রদেয় হিসাব','liabilities',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Current Liabilities'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Loans','ঋণ','liabilities',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Liabilities'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Tax Liabilities','কর দায়','liabilities',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Current Liabilities'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Sales Income','বিক্রয় আয়','income',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Income'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Other Income','অন্যান্য আয়','income',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Income'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Purchase Expenses','ক্রয় ব্যয়','expenses',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Expenses'
ON CONFLICT DO NOTHING;

INSERT INTO ledger_groups (mill_id, name, name_bn, nature, parent_id, is_system)
SELECT 1,'Operating Expenses','পরিচালন ব্যয়','expenses',id,TRUE FROM ledger_groups WHERE mill_id=1 AND name='Expenses'
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- LEDGERS (Chart of Accounts leaf nodes)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledgers (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  group_id        BIGINT       NOT NULL REFERENCES ledger_groups(id),
  code            VARCHAR(20),
  name            VARCHAR(200) NOT NULL,
  name_bn         VARCHAR(200),
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  opening_type    VARCHAR(2)   NOT NULL DEFAULT 'Dr' CHECK (opening_type IN ('Dr','Cr')),
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance_type    VARCHAR(2)   NOT NULL DEFAULT 'Dr' CHECK (balance_type IN ('Dr','Cr')),
  is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_by      BIGINT       REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(mill_id, name)
);

-- Seed default ledgers for mill 1
INSERT INTO ledgers (mill_id, group_id, name, name_bn, opening_balance, opening_type, current_balance, balance_type, is_system)
SELECT 1, g.id, 'Main Cash', 'প্রধান নগদ', 0, 'Dr', 0, 'Dr', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Cash & Bank' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Rice Sales', 'চাল বিক্রয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Sales Income' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Bran Sales', 'তুষের ভুষি বিক্রয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Sales Income' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Husk Sales', 'তুষ বিক্রয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Sales Income' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Paddy Purchase', 'ধান ক্রয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Purchase Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Salary Expense', 'বেতন ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Transport Expense', 'পরিবহন ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Electricity Expense', 'বিদ্যুৎ ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Fuel Expense', 'জ্বালানি ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Packaging Expense', 'প্যাকেজিং ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

INSERT INTO ledgers (mill_id, group_id, name, name_bn, is_system)
SELECT 1, g.id, 'Maintenance Expense', 'রক্ষণাবেক্ষণ ব্যয়', TRUE
FROM ledger_groups g WHERE g.mill_id=1 AND g.name='Operating Expenses' ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- VOUCHERS (Tally-style double-entry)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  financial_year_id BIGINT     REFERENCES financial_years(id),
  voucher_type    VARCHAR(20)  NOT NULL CHECK (voucher_type IN (
                    'sales','purchase','receipt','payment','journal',
                    'contra','debit_note','credit_note')),
  voucher_number  VARCHAR(30)  NOT NULL,
  date            DATE         NOT NULL,
  narration       TEXT,
  reference       VARCHAR(100),
  party_id        BIGINT,           -- customer_id or supplier_id
  party_type      VARCHAR(20),      -- 'customer' | 'supplier'
  total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  is_posted       BOOLEAN      NOT NULL DEFAULT FALSE,
  approved_by     BIGINT       REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  created_by      BIGINT       REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(mill_id, voucher_type, voucher_number)
);

-- Voucher line items (double-entry ledger postings)
CREATE TABLE IF NOT EXISTS voucher_items (
  id          BIGSERIAL    PRIMARY KEY,
  voucher_id  BIGINT       NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  ledger_id   BIGINT       NOT NULL REFERENCES ledgers(id),
  entry_type  VARCHAR(2)   NOT NULL CHECK (entry_type IN ('Dr','Cr')),
  amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  narration   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ledger postings (running balance per ledger)
CREATE TABLE IF NOT EXISTS ledger_postings (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL,
  ledger_id   BIGINT       NOT NULL REFERENCES ledgers(id),
  voucher_id  BIGINT       NOT NULL REFERENCES vouchers(id),
  voucher_item_id BIGINT   REFERENCES voucher_items(id),
  date        DATE         NOT NULL,
  entry_type  VARCHAR(2)   NOT NULL CHECK (entry_type IN ('Dr','Cr')),
  amount      DECIMAL(15,2) NOT NULL,
  balance     DECIMAL(15,2) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- GODOWNS / WAREHOUSES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS godowns (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(150) NOT NULL,
  name_bn     VARCHAR(150),
  location    TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

INSERT INTO godowns (mill_id, name, name_bn, location)
VALUES (1, 'Main Godown', 'প্রধান গুদাম', 'Mill Premises')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- BANK ACCOUNTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  ledger_id       BIGINT       REFERENCES ledgers(id),
  bank_name       VARCHAR(150) NOT NULL,
  account_name    VARCHAR(150) NOT NULL,
  account_number  VARCHAR(50)  NOT NULL,
  branch          VARCHAR(100),
  ifsc            VARCHAR(20),
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CHEQUES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cheques (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  bank_account_id BIGINT       NOT NULL REFERENCES bank_accounts(id),
  cheque_number   VARCHAR(30)  NOT NULL,
  date            DATE         NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  payee           VARCHAR(200),
  type            VARCHAR(10)  NOT NULL CHECK (type IN ('issued','received')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','bounced','cancelled')),
  cleared_date    DATE,
  voucher_id      BIGINT       REFERENCES vouchers(id),
  notes           TEXT,
  created_by      BIGINT       REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- COMPANY SETTINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id) UNIQUE,
  trade_name      VARCHAR(200),
  trade_name_bn   VARCHAR(200),
  trade_license   VARCHAR(100),
  bin_number      VARCHAR(50),
  tin_number      VARCHAR(50),
  vat_registered  BOOLEAN      NOT NULL DEFAULT FALSE,
  vat_number      VARCHAR(50),
  currency        VARCHAR(10)  NOT NULL DEFAULT 'BDT',
  currency_symbol VARCHAR(5)   NOT NULL DEFAULT '৳',
  date_format     VARCHAR(20)  NOT NULL DEFAULT 'DD/MM/YYYY',
  fiscal_year_start VARCHAR(5) NOT NULL DEFAULT '07-01',
  invoice_prefix  VARCHAR(10)  NOT NULL DEFAULT 'INV',
  voucher_prefix  VARCHAR(10)  NOT NULL DEFAULT 'VCH',
  low_stock_alert BOOLEAN      NOT NULL DEFAULT TRUE,
  due_alert_days  INT          NOT NULL DEFAULT 7,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO company_settings (mill_id, trade_name, trade_name_bn)
VALUES (1, 'Auto Rice Mill', 'অটো রাইস মিল')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vouchers_mill_date     ON vouchers(mill_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_type_mill     ON vouchers(mill_id, voucher_type, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_items_voucher  ON voucher_items(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_ledger ON ledger_postings(ledger_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_mill   ON ledger_postings(mill_id, date);
CREATE INDEX IF NOT EXISTS idx_ledgers_group          ON ledgers(group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledgers_mill           ON ledgers(mill_id) WHERE deleted_at IS NULL;
