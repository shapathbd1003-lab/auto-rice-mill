-- ============================================================
-- Migration 003: Khata (Bookkeeping) Enhancements
-- Adds cash_transactions table for direct Cash In/Out entries
-- All other khata data uses existing tables (customer_ledger,
-- supplier_ledger, expenses, financial_transactions, sales_orders, purchases)
-- ============================================================

-- cash_transactions: direct Cash In / Cash Out entries (khata-style)
-- Separate from financial_transactions which is account-based
CREATE TABLE IF NOT EXISTS cash_transactions (
  id          BIGSERIAL    PRIMARY KEY,
  mill_id     BIGINT       NOT NULL REFERENCES mills(id),
  date        DATE         NOT NULL,
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('in','out')),
  category    VARCHAR(50)  NOT NULL,
  description TEXT         NOT NULL,
  amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  account_id  BIGINT       REFERENCES accounts(id),
  reference_type VARCHAR(30),
  reference_id   BIGINT,
  created_by  BIGINT       REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_tx_mill_date ON cash_transactions(mill_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cash_tx_type      ON cash_transactions(mill_id, type, date) WHERE deleted_at IS NULL;
