# Mithila Auto Rice Mill — System Architecture

**Version:** 1.0  
**Date:** June 2026  
**Live URL:** https://auto-rice-mill-production.up.railway.app

---

## 1. Overview

A full-stack ERP system for rice mill management in Bangladesh. Combines:
- **TallyKhata-style bookkeeping** (simple khata ledgers for daily use)
- **Tally ERP-style accounting** (double-entry vouchers, trial balance, P&L)
- **Rice Mill operations** (paddy purchase → production → inventory → sales)

Runs as a **web application** (cloud-hosted) and supports future **Windows desktop** (offline-first, SQLite).

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│                                                              │
│   Browser (Mobile/Desktop)        Windows Desktop App        │
│   React 18 + MUI v5               Electron + React           │
│   react-router-dom v6             SQLite (offline-first)     │
│   Redux Toolkit + i18next         SyncManager (30s push/pull)│
└───────────────────┬──────────────────────────────────────────┘
                    │ HTTPS / REST API
                    │
┌───────────────────▼──────────────────────────────────────────┐
│                   BACKEND (Railway Cloud)                    │
│                                                              │
│   Node.js 18 + Express 4.18                                  │
│   JWT Auth (15m access / 7d refresh)                         │
│   RBAC middleware (admin/manager/accountant/storekeeper/     │
│                    operator/sales)                           │
│   Rate limiting (300 req/min general, 20 req/15min auth)     │
│   Helmet (security headers) + CORS                           │
└───────────────────┬──────────────────────────────────────────┘
                    │ pg driver (node-postgres 8.11)
                    │
┌───────────────────▼──────────────────────────────────────────┐
│              DATABASE (Railway PostgreSQL 16)                 │
│                                                              │
│   38 tables across 6 migrations                              │
│   Multi-tenant (mill_id on every table)                      │
│   Soft deletes (deleted_at) on all master tables             │
│   Audit logs for all mutations                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18.2.0 |
| UI library | Material UI | 5.14.20 |
| State management | Redux Toolkit | 2.0.1 |
| Routing | react-router-dom | 6.20.1 |
| HTTP client | Axios | 1.6.2 |
| Internationalization | i18next + react-i18next | 23.7.6 |
| Build tool | Vite | 5.0.7 |
| Backend framework | Express | 4.18.2 |
| Runtime | Node.js | ≥18.0.0 |
| ORM / DB driver | node-postgres (pg) | 8.11.3 |
| Database | PostgreSQL | 16 |
| Authentication | JWT (jsonwebtoken) | 9.0.2 |
| Password hashing | bcrypt | 5.1.1 |
| Validation | Joi | 17.11.0 |
| PDF generation | pdfkit | 0.14.0 |
| Logging | winston + morgan | 3.11.0 |
| Scheduling | node-cron | 3.0.3 |
| Hosting | Railway | — |

---

## 4. Backend Module Structure

```
backend/
├── server.js                    # Entry point — connects DB, runs migrations, starts server
├── src/
│   ├── app.js                   # Express app — all 22 route modules mounted
│   ├── config/
│   │   ├── database.js          # PostgreSQL pool (pg)
│   │   ├── migrate.js           # Auto-migration runner on startup
│   │   └── scheduler.js         # node-cron daily jobs
│   ├── middleware/
│   │   ├── auth.js              # JWT verify → req.user
│   │   ├── errorHandler.js      # Global error → standard JSON envelope
│   │   └── validate.js          # Joi schema validation factory
│   ├── modules/
│   │   ├── auth/                # Login, refresh, logout, change-password
│   │   ├── dashboard/           # KPI summary
│   │   ├── customers/           # CRUD + ledger + payment + due
│   │   ├── suppliers/           # CRUD + ledger + payment + due
│   │   ├── purchases/           # Invoice creation, stock intake
│   │   ├── production/          # Batch creation, completion, yield
│   │   ├── inventory/           # Items, stock adjust, low-stock
│   │   ├── sales/               # Invoice, line items, returns
│   │   ├── accounting/          # Accounts, expenses, P&L, daily close
│   │   ├── employees/           # CRUD, attendance, salary, advances
│   │   ├── vehicles/            # Fleet, trips, fuel tracking
│   │   ├── reports/             # PDF generators (invoice, salary slip, statement)
│   │   ├── notifications/       # Read/unread notification management
│   │   ├── sync/                # Desktop offline push/pull endpoints
│   │   ├── khata/               # Legacy Khata (cashbook, summary)
│   │   └── erp/
│   │       ├── ledgers.routes.js        # Chart of Accounts + Ledger CRUD
│   │       ├── vouchers.routes.js       # Double-entry vouchers (8 types)
│   │       ├── khata.routes.js          # Universal Khata (any ledger group)
│   │       ├── financial-years.routes.js # FY management, lock/unlock
│   │       ├── banking.routes.js        # Bank accounts, deposits, cheques
│   │       ├── erp-reports.routes.js    # Trial Balance, P&L, Balance Sheet
│   │       └── company-settings.routes.js # Company info, user management
│   └── utils/
│       ├── response.js          # success() / paginated() / created() helpers
│       ├── pagination.js        # page/limit/offset from query params
│       ├── invoiceNumber.js     # Auto-increment invoice numbering
│       └── logger.js            # Winston logger
├── migrations/
│   ├── 001_init.sql             # 29 core tables + seed data
│   ├── 002_fix_admin_password.sql
│   ├── 003_khata.sql            # cash_transactions table
│   ├── 004_erp_core.sql         # 9 ERP tables (vouchers, ledgers, FY, bank)
│   ├── 005_dynamic_khata.sql    # contact fields, khata groups, data bridges
│   └── 006_rename_mill.sql      # Mill name update
```

---

## 5. API Routes (22 modules)

| Prefix | Module | Key Endpoints |
|---|---|---|
| `/api/auth` | Authentication | POST login, POST refresh, POST logout, GET me |
| `/api/dashboard` | KPI Dashboard | GET / |
| `/api/customers` | Customers | CRUD, GET ledger, POST payment, POST due |
| `/api/suppliers` | Suppliers | CRUD, GET ledger, POST payment, POST due |
| `/api/purchases` | Purchases | CRUD, invoice auto-number |
| `/api/production` | Production | POST batch, POST complete |
| `/api/inventory` | Inventory | CRUD items, GET stock, POST adjust |
| `/api/sales` | Sales | CRUD, POST payment, POST return |
| `/api/accounting` | Accounting | GET/POST accounts, expenses, daily close |
| `/api/employees` | Employees | CRUD, POST attendance bulk, salary generate |
| `/api/vehicles` | Vehicles | CRUD, POST trips |
| `/api/reports` | Reports | GET all report types (PDF/JSON) |
| `/api/notifications` | Notifications | GET, PUT read, PUT read-all |
| `/api/sync` | Desktop Sync | POST push, GET pull |
| `/api/khata` | Khata Summary | GET summary |
| `/api/khata/cashbook` | Cash Book | CRUD cash in/out |
| `/api/erp` | Ledger Groups + CoA | GET ledger-groups, CRUD ledgers, GET chart |
| `/api/erp/khata` | Universal Khata | GET groups, ledgers, transactions, add-due, payments |
| `/api/erp/vouchers` | Vouchers | CRUD 8 voucher types, POST approve, POST cancel |
| `/api/erp/financial-years` | Financial Years | CRUD, activate, lock/unlock |
| `/api/erp/banking` | Banking | Bank accounts, deposits/withdrawals, cheques |
| `/api/erp/reports` | ERP Reports | Trial Balance, P&L, Balance Sheet, Day Book, Cash Flow, General Ledger |

---

## 6. Frontend Route Map (27 pages)

```
/login                          Public login page

/ (protected layout)
├── /                           Dashboard (6 KPI cards, recent transactions)
│
├── KHATA BOOK
│   ├── /khata/customers        Customer Khata (split panel, ledger, due/payment)
│   ├── /khata/suppliers        Supplier Khata (split panel, ledger, due/payment)
│   ├── /khata/cashbook         Cash Book (daily cash in/out, categories)
│   ├── /khata/expenses         Expense Book (daily/monthly, categories)
│   ├── /khata/daily-sales      Daily Sales Book (invoice list + new sale)
│   └── /khata/daily-purchase   Daily Purchase Book (purchase list + new purchase)
│
├── TALLY ERP
│   ├── /erp/accounts           Accounts Dashboard (nature breakdown)
│   ├── /erp/ledger-groups      Ledger Group management (create custom khatas)
│   ├── /erp/chart-of-accounts  Chart of Accounts (tree + list)
│   ├── /erp/khata/:groupId     Universal Khata (works for any group)
│   ├── /erp/vouchers           Voucher Entry (8 types, Dr/Cr, approve workflow)
│   ├── /erp/tally-reports      Accounting Reports (6 report types)
│   ├── /erp/banking            Banking (accounts, transactions, cheques)
│   └── /erp/settings           Company Settings (info, users, FY, preferences)
│
└── RICE MILL
    ├── /purchases              Paddy purchase management
    ├── /production             Production batch tracking
    ├── /inventory              Stock management
    ├── /sales                  Rice sales management
    ├── /accounting             General accounting
    ├── /employees              Payroll & attendance
    ├── /vehicles               Fleet management
    ├── /reports                Business reports
    └── /notifications          Notification center
```

---

## 7. Database Schema

### Core Tables (Migration 001)

```
mills               — Multi-tenant root (mill_id FK on all tables)
users               — Roles: admin|manager|accountant|storekeeper|operator|sales
refresh_tokens      — JWT refresh token rotation
audit_logs          — All mutation logs with old/new data

customers           — Customer master + running balance
customer_ledger     — Customer transaction history (Dr/Cr/Balance)
suppliers           — Supplier master + running balance
supplier_ledger     — Supplier transaction history

vehicles            — Vehicle fleet
purchases           — Paddy purchase invoices (weight, moisture, cost)
production_batches  — Milling sessions (paddy input)
production_outputs  — Outputs: rice/bran/husk/broken_rice
inventory_items     — Product catalog (paddy/rice/bran/husk/packaging)
stock_transactions  — All stock movements with running balance

sales_orders        — Rice sale invoices
sale_items          — Line items per sale
sale_returns        — Return transactions
sale_return_items   — Return line items

accounts            — Cash/bank account master
financial_transactions — All financial movements
expenses            — Expense ledger
daily_closing       — End-of-day cash position

employees           — Employee master
attendance          — Daily attendance per employee
salaries            — Monthly salary records
salary_advances     — Advance salary tracking

vehicle_trips       — Trip cost tracking (fuel, driver)
sync_queue          — Offline desktop sync queue
notifications       — System notifications
```

### ERP Tables (Migration 004)

```
financial_years     — Fiscal year master (lock/unlock)
ledger_groups       — Chart of Accounts hierarchy (parent_id self-ref)
ledgers             — Ledger accounts (leaf nodes with balance)
vouchers            — Double-entry transaction header
voucher_items       — Dr/Cr lines per voucher
ledger_postings     — Running balance per ledger (audit trail)
godowns             — Warehouse locations
bank_accounts       — Bank account register
cheques             — Cheque register (issued/received)
company_settings    — ERP configuration per mill
```

### Dynamic Khata (Migration 005)

```
ledger_groups.group_type  — customer|supplier|employee|bank|loan|general
ledgers.phone/email/address/contact_person — Contact info on any ledger

Default Khata Groups (seeded):
  Customer Khata → under Accounts Receivable
  Supplier Khata → under Accounts Payable
  Employee Khata → under Operating Expenses
  Bank Khata     → under Cash & Bank
  Loan Khata     → under Loans
  Farmer Khata   → under Supplier Khata
  Dealer Khata   → under Customer Khata
  Transport Khata → under Operating Expenses
```

---

## 8. Authentication & Security

```
Login flow:
  POST /api/auth/login → { token (15m JWT), refreshToken (7d) }
  Token stored: sessionStorage (access) + localStorage (refresh)
  Auto-refresh: axios interceptor catches 401, calls /api/auth/refresh

RBAC:
  requireAuth   — verifies JWT, attaches req.user
  requireRole() — factory middleware, e.g. requireRole('admin','manager')

Role permissions:
  admin       — full access to everything
  manager     — all except user management
  accountant  — financial + reports
  storekeeper — inventory + production
  operator    — production only
  sales       — customers + sales

Security headers: helmet (XSS, HSTS, CSP, etc.)
Rate limits: 20 req/15min on auth, 300 req/min on all API
```

---

## 9. Internationalization

- **Languages:** English (en) + Bengali (bn)
- **Library:** i18next + react-i18next
- **Default:** English
- **Toggle:** বাংলা | EN button in top bar
- **Persistence:** localStorage('lang')
- **Coverage:** All nav, buttons, table headers, dialogs, empty states, categories

---

## 10. Deployment

```
Platform: Railway (railway.app)
Services:
  auto-rice-mill  → React frontend (Node/Express static server)
                    URL: auto-rice-mill-production.up.railway.app
  backend         → Express API
                    URL: backend-production-1b9e.up.railway.app
  Postgres-8efc   → PostgreSQL 16 database

Auto-deploy: GitHub push to master branch → Railway rebuilds both services
Migrations: run automatically on backend startup via runMigrations()

Environment variables (backend):
  DATABASE_URL      — PostgreSQL connection string
  JWT_SECRET        — 64+ char random secret
  PORT              — 3000 (Railway default)
  NODE_ENV          — production
  ALLOWED_ORIGINS   — frontend URL

Default credentials:
  Email:    admin@ricemill.com
  Password: Admin@1234
  (Change immediately after first login)
```

---

## 11. Offline Desktop (Future)

Desktop app scaffold exists at `desktop/` using:
- Electron (main process + preload with contextBridge)
- better-sqlite3 (local SQLite database, WAL mode)
- SyncManager (30s background push/pull to cloud API)
- Auto-backup (daily SQLite backup to %APPDATA%)
- Conflict resolution: last-write-wins by updated_at; server wins for financial records
