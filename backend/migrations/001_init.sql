-- ============================================================
-- Auto Rice Mill Management System
-- Migration 001: Initial Schema
-- PostgreSQL 14+
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CORE / AUTH
-- ────────────────────────────────────────────────────────────

CREATE TABLE mills (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  name_bn    VARCHAR(200),
  address    TEXT,
  phone      VARCHAR(20),
  email      VARCHAR(150),
  logo_url   TEXT,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            BIGSERIAL   PRIMARY KEY,
  mill_id       BIGINT      NOT NULL REFERENCES mills(id),
  name          VARCHAR(100) NOT NULL,
  name_bn       VARCHAR(100),
  email         VARCHAR(150),
  phone         VARCHAR(20),
  password_hash TEXT        NOT NULL,
  role          VARCHAR(30) NOT NULL CHECK (role IN ('admin','manager','accountant','storekeeper','operator','sales')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE(mill_id, email)
);

CREATE TABLE refresh_tokens (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  device_id  VARCHAR(100),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id          BIGSERIAL   PRIMARY KEY,
  mill_id     BIGINT      NOT NULL,
  user_id     BIGINT,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   BIGINT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CUSTOMERS & SUPPLIERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  code            VARCHAR(20)  NOT NULL,
  name            VARCHAR(150) NOT NULL,
  name_bn         VARCHAR(150),
  phone           VARCHAR(20),
  address         TEXT,
  credit_limit    DECIMAL(15,2) NOT NULL DEFAULT 0,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(mill_id, code)
);

CREATE TABLE customer_ledger (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL,
  customer_id    BIGINT       NOT NULL REFERENCES customers(id),
  date           DATE         NOT NULL,
  description    TEXT,
  debit          DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit         DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance        DECIMAL(15,2) NOT NULL,
  reference_type VARCHAR(30),
  reference_id   BIGINT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE suppliers (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  code            VARCHAR(20)  NOT NULL,
  name            VARCHAR(150) NOT NULL,
  name_bn         VARCHAR(150),
  phone           VARCHAR(20),
  address         TEXT,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(mill_id, code)
);

CREATE TABLE supplier_ledger (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL,
  supplier_id    BIGINT       NOT NULL REFERENCES suppliers(id),
  date           DATE         NOT NULL,
  description    TEXT,
  debit          DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit         DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance        DECIMAL(15,2) NOT NULL,
  reference_type VARCHAR(30),
  reference_id   BIGINT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- PURCHASES
-- ────────────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id           BIGSERIAL    PRIMARY KEY,
  mill_id      BIGINT       NOT NULL REFERENCES mills(id),
  number       VARCHAR(30)  NOT NULL,
  type         VARCHAR(50),
  driver_name  VARCHAR(100),
  driver_phone VARCHAR(20),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, number)
);

CREATE TABLE purchases (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL REFERENCES mills(id),
  invoice_number VARCHAR(30)  NOT NULL,
  date           DATE         NOT NULL,
  supplier_id    BIGINT       NOT NULL REFERENCES suppliers(id),
  vehicle_id     BIGINT REFERENCES vehicles(id),
  gross_weight   DECIMAL(10,3),
  tare_weight    DECIMAL(10,3),
  net_weight     DECIMAL(10,3),
  moisture_pct   DECIMAL(5,2),
  unit_price     DECIMAL(10,2),
  subtotal       DECIMAL(15,2),
  transport_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  other_cost     DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(15,2) NOT NULL,
  paid_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE(mill_id, invoice_number)
);

-- ────────────────────────────────────────────────────────────
-- PRODUCTION
-- ────────────────────────────────────────────────────────────

CREATE TABLE production_batches (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL REFERENCES mills(id),
  batch_number   VARCHAR(30)  NOT NULL,
  date           DATE         NOT NULL,
  paddy_quantity DECIMAL(12,3) NOT NULL,
  paddy_source   VARCHAR(20)  CHECK (paddy_source IN ('stock','direct_purchase')),
  purchase_id    BIGINT REFERENCES purchases(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes          TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, batch_number)
);

CREATE TABLE production_outputs (
  id           BIGSERIAL    PRIMARY KEY,
  batch_id     BIGINT       NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  mill_id      BIGINT       NOT NULL,
  product_type VARCHAR(30)  NOT NULL CHECK (product_type IN ('rice','bran','husk','broken_rice')),
  quantity     DECIMAL(12,3) NOT NULL,
  yield_pct    DECIMAL(5,2),
  unit_cost    DECIMAL(10,4),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────

CREATE TABLE inventory_items (
  id            BIGSERIAL    PRIMARY KEY,
  mill_id       BIGINT       NOT NULL REFERENCES mills(id),
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(150) NOT NULL,
  name_bn       VARCHAR(150),
  category      VARCHAR(30)  NOT NULL CHECK (category IN ('paddy','rice','bran','husk','broken_rice','packaging')),
  unit          VARCHAR(20)  NOT NULL,
  unit_weight   DECIMAL(10,3),
  current_stock DECIMAL(15,3) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(15,3) NOT NULL DEFAULT 0,
  sale_price    DECIMAL(10,2),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, code)
);

CREATE TABLE stock_transactions (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL,
  item_id        BIGINT       NOT NULL REFERENCES inventory_items(id),
  date           DATE         NOT NULL,
  type           VARCHAR(20)  NOT NULL CHECK (type IN ('in','out','adjustment','transfer')),
  quantity       DECIMAL(15,3) NOT NULL,
  balance_after  DECIMAL(15,3) NOT NULL,
  unit_cost      DECIMAL(10,4),
  reference_type VARCHAR(30),
  reference_id   BIGINT,
  notes          TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SALES
-- ────────────────────────────────────────────────────────────

CREATE TABLE sales_orders (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  invoice_number  VARCHAR(30)  NOT NULL,
  date            DATE         NOT NULL,
  customer_id     BIGINT       NOT NULL REFERENCES customers(id),
  sale_type       VARCHAR(20)  NOT NULL DEFAULT 'retail' CHECK (sale_type IN ('retail','wholesale')),
  subtotal        DECIMAL(15,2) NOT NULL,
  discount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(15,2) NOT NULL,
  paid_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  delivery_status VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','partial')),
  notes           TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','cancelled')),
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(mill_id, invoice_number)
);

CREATE TABLE sale_items (
  id         BIGSERIAL    PRIMARY KEY,
  order_id   BIGINT       NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_id    BIGINT       NOT NULL REFERENCES inventory_items(id),
  quantity   DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total      DECIMAL(15,2) NOT NULL
);

CREATE TABLE sale_returns (
  id           BIGSERIAL    PRIMARY KEY,
  mill_id      BIGINT       NOT NULL,
  order_id     BIGINT       NOT NULL REFERENCES sales_orders(id),
  date         DATE         NOT NULL,
  reason       TEXT,
  total_amount DECIMAL(15,2) NOT NULL,
  created_by   BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE sale_return_items (
  id         BIGSERIAL    PRIMARY KEY,
  return_id  BIGINT       NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  item_id    BIGINT       NOT NULL REFERENCES inventory_items(id),
  quantity   DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total      DECIMAL(15,2) NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- ACCOUNTING
-- ────────────────────────────────────────────────────────────

CREATE TABLE accounts (
  id         BIGSERIAL    PRIMARY KEY,
  mill_id    BIGINT       NOT NULL REFERENCES mills(id),
  name       VARCHAR(100) NOT NULL,
  name_bn    VARCHAR(100),
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('cash','bank')),
  bank_name  VARCHAR(100),
  account_no VARCHAR(50),
  balance    DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_transactions (
  id             BIGSERIAL    PRIMARY KEY,
  mill_id        BIGINT       NOT NULL,
  date           DATE         NOT NULL,
  account_id     BIGINT       NOT NULL REFERENCES accounts(id),
  type           VARCHAR(30)  NOT NULL CHECK (type IN ('income','expense','transfer','payment_received','payment_made')),
  category       VARCHAR(50),
  amount         DECIMAL(15,2) NOT NULL,
  description    TEXT,
  reference_type VARCHAR(30),
  reference_id   BIGINT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL,
  date        DATE         NOT NULL,
  category    VARCHAR(50)  NOT NULL,
  description TEXT         NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  account_id  BIGINT REFERENCES accounts(id),
  receipt_url TEXT,
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_closing (
  id                 BIGSERIAL    PRIMARY KEY,
  mill_id            BIGINT       NOT NULL,
  date               DATE         NOT NULL,
  opening_cash       DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_sales        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_purchases    DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_expenses     DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_payments_in  DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_payments_out DECIMAL(15,2) NOT NULL DEFAULT 0,
  closing_cash       DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes              TEXT,
  closed_by          BIGINT REFERENCES users(id),
  closed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, date)
);

-- ────────────────────────────────────────────────────────────
-- EMPLOYEES
-- ────────────────────────────────────────────────────────────

CREATE TABLE employees (
  id           BIGSERIAL    PRIMARY KEY,
  mill_id      BIGINT       NOT NULL REFERENCES mills(id),
  code         VARCHAR(20)  NOT NULL,
  name         VARCHAR(150) NOT NULL,
  name_bn      VARCHAR(150),
  phone        VARCHAR(20),
  nid          VARCHAR(30),
  designation  VARCHAR(100),
  department   VARCHAR(50),
  join_date    DATE,
  basic_salary DECIMAL(12,2),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE(mill_id, code)
);

CREATE TABLE attendance (
  id             BIGSERIAL   PRIMARY KEY,
  mill_id        BIGINT      NOT NULL,
  employee_id    BIGINT      NOT NULL REFERENCES employees(id),
  date           DATE        NOT NULL,
  status         VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','half_day','holiday','leave')),
  in_time        TIME,
  out_time       TIME,
  overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE TABLE salaries (
  id                BIGSERIAL    PRIMARY KEY,
  mill_id           BIGINT       NOT NULL,
  employee_id       BIGINT       NOT NULL REFERENCES employees(id),
  month             VARCHAR(7)   NOT NULL,
  basic_salary      DECIMAL(12,2) NOT NULL DEFAULT 0,
  overtime_pay      DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus             DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions        DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary        DECIMAL(12,2) NOT NULL,
  paid_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid')),
  paid_at           TIMESTAMPTZ,
  created_by        BIGINT REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, month)
);

CREATE TABLE salary_advances (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL,
  employee_id BIGINT       NOT NULL REFERENCES employees(id),
  date        DATE         NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  reason      TEXT,
  recovered   DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance     DECIMAL(12,2) NOT NULL,
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- VEHICLES (TRIPS)
-- ────────────────────────────────────────────────────────────

CREATE TABLE vehicle_trips (
  id            BIGSERIAL    PRIMARY KEY,
  mill_id       BIGINT       NOT NULL,
  vehicle_id    BIGINT       NOT NULL REFERENCES vehicles(id),
  date          DATE         NOT NULL,
  trip_type     VARCHAR(20)  CHECK (trip_type IN ('purchase','delivery','other')),
  reference_id  BIGINT,
  from_location TEXT,
  to_location   TEXT,
  distance_km   DECIMAL(8,2),
  fuel_liters   DECIMAL(8,2),
  fuel_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
  driver_cost   DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SYNC & NOTIFICATIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE sync_queue (
  id            BIGSERIAL    PRIMARY KEY,
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     BIGINT,
  operation     VARCHAR(10)  NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
  payload       JSONB        NOT NULL,
  device_id     VARCHAR(100),
  mill_id       BIGINT       NOT NULL,
  user_id       BIGINT,
  is_synced     BOOLEAN      NOT NULL DEFAULT FALSE,
  synced_at     TIMESTAMPTZ,
  error_message TEXT,
  retry_count   INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id         BIGSERIAL    PRIMARY KEY,
  mill_id    BIGINT       NOT NULL,
  user_id    BIGINT REFERENCES users(id),
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  data       JSONB,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_users_mill        ON users(mill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_mill    ON customers(mill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_mill    ON suppliers(mill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchases_mill_date ON purchases(mill_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_batches_mill_date ON production_batches(mill_id, date);
CREATE INDEX idx_sales_orders_mill_date ON sales_orders(mill_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_stock_tx_item_date ON stock_transactions(item_id, date);
CREATE INDEX idx_stock_tx_mill_date ON stock_transactions(mill_id, date);
CREATE INDEX idx_customer_ledger_cust ON customer_ledger(customer_id, date);
CREATE INDEX idx_supplier_ledger_supp ON supplier_ledger(supplier_id, date);
CREATE INDEX idx_attendance_emp_date  ON attendance(employee_id, date);
CREATE INDEX idx_salaries_emp_month   ON salaries(employee_id, month);
CREATE INDEX idx_fin_tx_mill_date     ON financial_transactions(mill_id, date);
CREATE INDEX idx_audit_logs_mill      ON audit_logs(mill_id, created_at DESC);
CREATE INDEX idx_sync_queue_unsynced  ON sync_queue(mill_id, is_synced, created_at) WHERE is_synced = FALSE;
CREATE INDEX idx_notifications_user   ON notifications(user_id, is_read, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- SEED: default mill + admin user  (password: Admin@1234)
-- ────────────────────────────────────────────────────────────

INSERT INTO mills (name, name_bn, phone) VALUES
  ('Auto Rice Mill', 'অটো রাইস মিল', '01700000000');

-- bcrypt hash for "Admin@1234"
INSERT INTO users (mill_id, name, email, password_hash, role)
VALUES (1, 'System Admin', 'admin@ricemill.com',
        '$2b$10$rOzJqiZ8gJ9K4nVf3b5xIeCxLt6zG3KjM1qY7dRpN2wSvAuoHlkOG',
        'admin');

-- default cash account
INSERT INTO accounts (mill_id, name, name_bn, type)
VALUES (1, 'Main Cash', 'প্রধান নগদ', 'cash');
