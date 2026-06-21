-- ============================================================
-- Migration 007: Tally ERP 9 Style Architecture
-- Dynamic RBAC, Row-level ledger security, Dynamic voucher types,
-- Cost centers, Stock groups/categories, full audit trail
-- ============================================================

-- ── ROLES & PERMISSIONS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id          BIGSERIAL    PRIMARY KEY,
  role_id     BIGINT       NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module      VARCHAR(50)  NOT NULL,  -- masters|vouchers|reports|admin|purchase|sales|production|inventory
  can_view    BOOLEAN      NOT NULL DEFAULT FALSE,
  can_create  BOOLEAN      NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN      NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN      NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, module)
);

-- Assign roles to users (replaces single role column)
CREATE TABLE IF NOT EXISTS user_roles (
  id       BIGSERIAL PRIMARY KEY,
  user_id  BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id  BIGINT    NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

-- Row-level ledger permissions per user
CREATE TABLE IF NOT EXISTS ledger_permissions (
  id        BIGSERIAL PRIMARY KEY,
  mill_id   BIGINT    NOT NULL,
  user_id   BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ledger_id BIGINT    NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  can_view  BOOLEAN   NOT NULL DEFAULT TRUE,
  can_post  BOOLEAN   NOT NULL DEFAULT FALSE,
  granted_by BIGINT   REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ledger_id)
);

-- ── VOUCHER TYPES (dynamic, configurable) ────────────────────

CREATE TABLE IF NOT EXISTS voucher_type_masters (
  id              BIGSERIAL    PRIMARY KEY,
  mill_id         BIGINT       NOT NULL REFERENCES mills(id),
  name            VARCHAR(100) NOT NULL,
  abbreviation    VARCHAR(10)  NOT NULL,
  nature          VARCHAR(20)  NOT NULL CHECK (nature IN (
                    'payment','receipt','contra','journal',
                    'purchase','sales','debit_note','credit_note',
                    'stock_transfer','production','consumption')),
  affects_stock   BOOLEAN      NOT NULL DEFAULT FALSE,
  affects_ledger  BOOLEAN      NOT NULL DEFAULT TRUE,
  auto_number     BOOLEAN      NOT NULL DEFAULT TRUE,
  prefix          VARCHAR(10),
  is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

-- ── COST CENTERS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cost_centers (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(150) NOT NULL,
  parent_id   BIGINT       REFERENCES cost_centers(id),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

-- ── STOCK GROUPS & CATEGORIES ────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_groups (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(150) NOT NULL,
  parent_id   BIGINT       REFERENCES stock_groups(id),
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

CREATE TABLE IF NOT EXISTS stock_categories (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  name        VARCHAR(150) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, name)
);

CREATE TABLE IF NOT EXISTS units (
  id           BIGSERIAL   PRIMARY KEY,
  mill_id      BIGINT      NOT NULL REFERENCES mills(id),
  name         VARCHAR(30) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  is_system    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mill_id, abbreviation)
);

-- ── ENHANCED AUDIT TRAIL ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_trail (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL,
  user_id     BIGINT       REFERENCES users(id),
  user_name   VARCHAR(100),
  action      VARCHAR(20)  NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','APPROVE','CANCEL')),
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   BIGINT,
  entity_ref  VARCHAR(50),
  old_data    JSONB,
  new_data    JSONB,
  changed_fields TEXT[],
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── VOUCHER ENHANCEMENTS ─────────────────────────────────────

-- Add voucher_type_master_id and cost_center to existing vouchers
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS voucher_type_master_id BIGINT REFERENCES voucher_type_masters(id),
  ADD COLUMN IF NOT EXISTS cost_center_id         BIGINT REFERENCES cost_centers(id),
  ADD COLUMN IF NOT EXISTS auto_created_ledgers    JSONB;  -- track auto-created ledgers

-- ── SEED DEFAULT ROLES ───────────────────────────────────────

-- Roles for mill 1
INSERT INTO roles (mill_id, name, description, is_system) VALUES
  (1, 'Administrator',      'Full system access',           TRUE),
  (1, 'Manager',            'All modules except admin',     TRUE),
  (1, 'Chief Accountant',   'All vouchers, ledgers, reports, approval', FALSE),
  (1, 'Junior Accountant',  'Voucher entry and ledger view', FALSE),
  (1, 'Cashier',            'Cash book, receipt, payment',  FALSE),
  (1, 'Store Keeper',       'Stock and inventory only',     FALSE),
  (1, 'Sales Executive',    'Sales vouchers and customer ledgers', FALSE),
  (1, 'Production Operator','Production vouchers only',     FALSE),
  (1, 'Auditor',            'Read-only access to all',      FALSE)
ON CONFLICT (mill_id, name) DO NOTHING;

-- Admin role gets all permissions
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, m.module, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles r
CROSS JOIN (VALUES
  ('masters'),('vouchers'),('reports'),('admin'),
  ('purchase'),('sales'),('production'),('inventory'),
  ('accounting'),('employees'),('banking')
) AS m(module)
WHERE r.mill_id=1 AND r.name='Administrator'
ON CONFLICT (role_id, module) DO NOTHING;

-- Chief Accountant
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, m.module, TRUE, TRUE, TRUE, FALSE, TRUE
FROM roles r
CROSS JOIN (VALUES ('vouchers'),('reports'),('accounting'),('purchase'),('sales'),('inventory')) AS m(module)
WHERE r.mill_id=1 AND r.name='Chief Accountant'
ON CONFLICT (role_id, module) DO NOTHING;

-- Cashier
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, m.module, TRUE, TRUE, FALSE, FALSE, FALSE
FROM roles r
CROSS JOIN (VALUES ('vouchers'),('accounting')) AS m(module)
WHERE r.mill_id=1 AND r.name='Cashier'
ON CONFLICT (role_id, module) DO NOTHING;

-- Auditor (read-only everything)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, m.module, TRUE, FALSE, FALSE, FALSE, FALSE
FROM roles r
CROSS JOIN (VALUES
  ('masters'),('vouchers'),('reports'),('purchase'),
  ('sales'),('production'),('inventory'),('accounting')
) AS m(module)
WHERE r.mill_id=1 AND r.name='Auditor'
ON CONFLICT (role_id, module) DO NOTHING;

-- ── SEED VOUCHER TYPES ───────────────────────────────────────

INSERT INTO voucher_type_masters (mill_id, name, abbreviation, nature, affects_stock, affects_ledger, prefix, is_system) VALUES
  (1, 'Payment Voucher',          'PMT', 'payment',     FALSE, TRUE,  'PMT', TRUE),
  (1, 'Receipt Voucher',          'RCV', 'receipt',     FALSE, TRUE,  'RCV', TRUE),
  (1, 'Contra Voucher',           'CON', 'contra',      FALSE, TRUE,  'CON', TRUE),
  (1, 'Journal Voucher',          'JNL', 'journal',     FALSE, TRUE,  'JNL', TRUE),
  (1, 'Purchase Voucher',         'PUR', 'purchase',    TRUE,  TRUE,  'PUR', TRUE),
  (1, 'Sales Voucher',            'SAL', 'sales',       TRUE,  TRUE,  'SAL', TRUE),
  (1, 'Debit Note',               'DN',  'debit_note',  FALSE, TRUE,  'DN',  TRUE),
  (1, 'Credit Note',              'CN',  'credit_note', FALSE, TRUE,  'CN',  TRUE),
  (1, 'Stock Transfer Voucher',   'STR', 'stock_transfer', TRUE, FALSE, 'STR', TRUE),
  (1, 'Paddy Consumption Voucher','PCN', 'consumption', TRUE,  FALSE, 'PCN', TRUE),
  (1, 'Rice Production Voucher',  'RPR', 'production',  TRUE,  FALSE, 'RPR', TRUE)
ON CONFLICT (mill_id, name) DO NOTHING;

-- ── SEED STOCK GROUPS ────────────────────────────────────────

INSERT INTO stock_groups (mill_id, name, is_system) VALUES
  (1, 'Raw Materials', TRUE),
  (1, 'Finished Goods', TRUE),
  (1, 'By-Products', TRUE),
  (1, 'Packaging Materials', TRUE)
ON CONFLICT (mill_id, name) DO NOTHING;

-- ── SEED UNITS ───────────────────────────────────────────────

INSERT INTO units (mill_id, name, abbreviation, is_system) VALUES
  (1, 'Kilogram', 'kg',  TRUE),
  (1, 'Bag',      'bag', TRUE),
  (1, 'Piece',    'pcs', TRUE),
  (1, 'Liter',    'ltr', TRUE),
  (1, 'Ton',      'ton', TRUE)
ON CONFLICT (mill_id, abbreviation) DO NOTHING;

-- ── SEED COST CENTERS ────────────────────────────────────────

INSERT INTO cost_centers (mill_id, name) VALUES
  (1, 'Mill Operations'),
  (1, 'Sales Department'),
  (1, 'Administration')
ON CONFLICT (mill_id, name) DO NOTHING;

-- ── ASSIGN ADMIN USER TO ADMINISTRATOR ROLE ──────────────────

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.mill_id=1 AND u.email='admin@ricemill.com'
  AND r.mill_id=1 AND r.name='Administrator'
ON CONFLICT DO NOTHING;

-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_roles_mill          ON roles(mill_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_role     ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user     ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_perms_user   ON ledger_permissions(user_id, ledger_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_mill    ON audit_trail(mill_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity  ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_voucher_type_mill   ON voucher_type_masters(mill_id) WHERE is_active=TRUE;
