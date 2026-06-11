-- ============================================================
-- Auto Rice Mill — SQLite Schema (Desktop / Offline DB)
-- Mirrors PostgreSQL schema; uses INTEGER for IDs (SQLite)
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  name_bn    TEXT,
  address    TEXT,
  phone      TEXT,
  email      TEXT,
  logo_url   TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id     INTEGER,
  mill_id       INTEGER NOT NULL,
  name          TEXT    NOT NULL,
  name_bn       TEXT,
  email         TEXT,
  phone         TEXT,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id       INTEGER,
  mill_id         INTEGER NOT NULL,
  code            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  name_bn         TEXT,
  phone           TEXT,
  address         TEXT,
  credit_limit    REAL    NOT NULL DEFAULT 0,
  opening_balance REAL    NOT NULL DEFAULT 0,
  balance         REAL    NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_by      INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  customer_id    INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  description    TEXT,
  debit          REAL    NOT NULL DEFAULT 0,
  credit         REAL    NOT NULL DEFAULT 0,
  balance        REAL    NOT NULL,
  reference_type TEXT,
  reference_id   INTEGER,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id       INTEGER,
  mill_id         INTEGER NOT NULL,
  code            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  name_bn         TEXT,
  phone           TEXT,
  address         TEXT,
  opening_balance REAL    NOT NULL DEFAULT 0,
  balance         REAL    NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_by      INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS supplier_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  supplier_id    INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  description    TEXT,
  debit          REAL    NOT NULL DEFAULT 0,
  credit         REAL    NOT NULL DEFAULT 0,
  balance        REAL    NOT NULL,
  reference_type TEXT,
  reference_id   INTEGER,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id    INTEGER,
  mill_id      INTEGER NOT NULL,
  number       TEXT    NOT NULL,
  type         TEXT,
  driver_name  TEXT,
  driver_phone TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  invoice_number TEXT    NOT NULL,
  date           TEXT    NOT NULL,
  supplier_id    INTEGER NOT NULL,
  vehicle_id     INTEGER,
  gross_weight   REAL,
  tare_weight    REAL,
  net_weight     REAL,
  moisture_pct   REAL,
  unit_price     REAL,
  subtotal       REAL,
  transport_cost REAL    NOT NULL DEFAULT 0,
  other_cost     REAL    NOT NULL DEFAULT 0,
  total_amount   REAL    NOT NULL,
  paid_amount    REAL    NOT NULL DEFAULT 0,
  due_amount     REAL    NOT NULL DEFAULT 0,
  notes          TEXT,
  status         TEXT    NOT NULL DEFAULT 'pending',
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);

CREATE TABLE IF NOT EXISTS production_batches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  batch_number   TEXT    NOT NULL,
  date           TEXT    NOT NULL,
  paddy_quantity REAL    NOT NULL,
  paddy_source   TEXT,
  purchase_id    INTEGER,
  status         TEXT    NOT NULL DEFAULT 'in_progress',
  notes          TEXT,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS production_outputs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id    INTEGER,
  batch_id     INTEGER NOT NULL,
  mill_id      INTEGER NOT NULL,
  product_type TEXT    NOT NULL,
  quantity     REAL    NOT NULL,
  yield_pct    REAL,
  unit_cost    REAL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id     INTEGER,
  mill_id       INTEGER NOT NULL,
  code          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  name_bn       TEXT,
  category      TEXT    NOT NULL,
  unit          TEXT    NOT NULL,
  unit_weight   REAL,
  current_stock REAL    NOT NULL DEFAULT 0,
  reorder_level REAL    NOT NULL DEFAULT 0,
  sale_price    REAL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  item_id        INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  type           TEXT    NOT NULL,
  quantity       REAL    NOT NULL,
  balance_after  REAL    NOT NULL,
  unit_cost      REAL,
  reference_type TEXT,
  reference_id   INTEGER,
  notes          TEXT,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id       INTEGER,
  mill_id         INTEGER NOT NULL,
  invoice_number  TEXT    NOT NULL,
  date            TEXT    NOT NULL,
  customer_id     INTEGER NOT NULL,
  sale_type       TEXT    NOT NULL DEFAULT 'retail',
  subtotal        REAL    NOT NULL,
  discount        REAL    NOT NULL DEFAULT 0,
  total_amount    REAL    NOT NULL,
  paid_amount     REAL    NOT NULL DEFAULT 0,
  due_amount      REAL    NOT NULL DEFAULT 0,
  delivery_status TEXT    NOT NULL DEFAULT 'pending',
  notes           TEXT,
  status          TEXT    NOT NULL DEFAULT 'active',
  created_by      INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id  INTEGER,
  order_id   INTEGER NOT NULL,
  item_id    INTEGER NOT NULL,
  quantity   REAL    NOT NULL,
  unit_price REAL    NOT NULL,
  total      REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id  INTEGER,
  mill_id    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  name_bn    TEXT,
  type       TEXT    NOT NULL,
  bank_name  TEXT,
  account_no TEXT,
  balance    REAL    NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  account_id     INTEGER NOT NULL,
  type           TEXT    NOT NULL,
  category       TEXT,
  amount         REAL    NOT NULL,
  description    TEXT,
  reference_type TEXT,
  reference_id   INTEGER,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   INTEGER,
  mill_id     INTEGER NOT NULL,
  date        TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  description TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  account_id  INTEGER,
  receipt_url TEXT,
  created_by  INTEGER,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id    INTEGER,
  mill_id      INTEGER NOT NULL,
  code         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  name_bn      TEXT,
  phone        TEXT,
  nid          TEXT,
  designation  TEXT,
  department   TEXT,
  join_date    TEXT,
  basic_salary REAL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      INTEGER,
  mill_id        INTEGER NOT NULL,
  employee_id    INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  status         TEXT    NOT NULL,
  in_time        TEXT,
  out_time       TEXT,
  overtime_hours REAL    NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS salaries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id         INTEGER,
  mill_id           INTEGER NOT NULL,
  employee_id       INTEGER NOT NULL,
  month             TEXT    NOT NULL,
  basic_salary      REAL    NOT NULL DEFAULT 0,
  overtime_pay      REAL    NOT NULL DEFAULT 0,
  bonus             REAL    NOT NULL DEFAULT 0,
  deductions        REAL    NOT NULL DEFAULT 0,
  advance_deduction REAL    NOT NULL DEFAULT 0,
  net_salary        REAL    NOT NULL,
  paid_amount       REAL    NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'pending',
  paid_at           TEXT,
  created_by        INTEGER,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, month)
);

CREATE TABLE IF NOT EXISTS salary_advances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   INTEGER,
  mill_id     INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  date        TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  reason      TEXT,
  recovered   REAL    NOT NULL DEFAULT 0,
  balance     REAL    NOT NULL,
  created_by  INTEGER,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sync queue (local pending changes to push to server)
CREATE TABLE IF NOT EXISTS sync_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT    NOT NULL,
  entity_id     INTEGER,
  operation     TEXT    NOT NULL,
  payload       TEXT    NOT NULL,  -- JSON string
  device_id     TEXT,
  mill_id       INTEGER NOT NULL,
  user_id       INTEGER,
  is_synced     INTEGER NOT NULL DEFAULT 0,
  synced_at     TEXT,
  error_message TEXT,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sync metadata (last pull timestamp per entity type)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT    NOT NULL UNIQUE,
  last_pulled TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- App settings (local preferences)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sq_unsynced   ON sync_queue(mill_id, is_synced) WHERE is_synced = 0;
CREATE INDEX IF NOT EXISTS idx_sq_entity     ON sync_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_att_emp_date  ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_so_mill_date  ON sales_orders(mill_id, date);
CREATE INDEX IF NOT EXISTS idx_pur_mill_date ON purchases(mill_id, date);
