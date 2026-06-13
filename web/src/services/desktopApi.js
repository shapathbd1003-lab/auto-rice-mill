/**
 * Desktop SQLite handler — intercepts axios requests when running in Electron.
 * Handles the same URL patterns as the Express backend.
 * Returns axios-compatible response objects: { data, status, headers, config }
 */
import { desktopDb } from './desktopAdapter';

function ok(data, pagination) {
  const body = pagination
    ? { success: true, data, pagination }
    : { success: true, data };
  return { data: body, status: 200, headers: {}, config: {} };
}

function paginate(rows, page, limit) {
  const p = Number(page) || 1;
  const l = Number(limit) || 20;
  const start = (p - 1) * l;
  return { rows: rows.slice(start, start + l), total: rows.length, page: p, limit: l };
}

// ── helpers ────────────────────────────────────────────────────────────────

function millId() {
  try { return JSON.parse(localStorage.getItem('user'))?.millId || 1; } catch { return 1; }
}

// ── route table ────────────────────────────────────────────────────────────

export async function handleDesktopRequest(method, url, data, params) {
  const mid = millId();
  const m = method.toUpperCase();
  const u = url.replace(/\?.*$/, '').replace(/\/+$/, '');
  const seg = u.split('/').filter(Boolean); // ['customers'], ['customers','5'], etc.

  // ── Customers ────────────────────────────────────────────────────────────
  if (seg[0] === 'customers') {
    if (m === 'GET' && !seg[1]) {
      let rows = await desktopDb.all(`SELECT * FROM customers WHERE mill_id=? AND deleted_at IS NULL ORDER BY name`, [mid]);
      if (params?.search) {
        const q = params.search.toLowerCase();
        rows = rows.filter(r => r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q) || r.phone?.includes(q));
      }
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO customers (mill_id,code,name,name_bn,phone,address,credit_limit,opening_balance,balance,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))`,
        [mid, data.code, data.name, data.name_bn||'', data.phone||'', data.address||'', data.credit_limit||0, data.opening_balance||0, data.opening_balance||0]
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
    if (m === 'PUT' && seg[1]) {
      await desktopDb.run(
        `UPDATE customers SET name=?,name_bn=?,phone=?,address=?,credit_limit=?,updated_at=datetime('now') WHERE id=? AND mill_id=?`,
        [data.name, data.name_bn||'', data.phone||'', data.address||'', data.credit_limit||0, seg[1], mid]
      );
      return ok(data);
    }
  }

  // ── Suppliers ────────────────────────────────────────────────────────────
  if (seg[0] === 'suppliers') {
    if (m === 'GET' && !seg[1]) {
      let rows = await desktopDb.all(`SELECT * FROM suppliers WHERE mill_id=? AND deleted_at IS NULL ORDER BY name`, [mid]);
      if (params?.search) {
        const q = params.search.toLowerCase();
        rows = rows.filter(r => r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q));
      }
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO suppliers (mill_id,code,name,name_bn,phone,address,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`,
        [mid, data.code, data.name, data.name_bn||'', data.phone||'', data.address||'']
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
    if (m === 'PUT' && seg[1]) {
      await desktopDb.run(
        `UPDATE suppliers SET name=?,name_bn=?,phone=?,address=?,updated_at=datetime('now') WHERE id=? AND mill_id=?`,
        [data.name, data.name_bn||'', data.phone||'', data.address||'', seg[1], mid]
      );
      return ok(data);
    }
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  if (seg[0] === 'inventory') {
    if (seg[1] === 'stock') {
      const rows = await desktopDb.all(`SELECT * FROM inventory_items WHERE mill_id=? AND is_active=1 ORDER BY category, name`, [mid]);
      return ok(rows);
    }
    if (m === 'GET' && !seg[1]) {
      let rows = await desktopDb.all(`SELECT * FROM inventory_items WHERE mill_id=? AND is_active=1 ORDER BY name`, [mid]);
      if (params?.search) {
        const q = params.search.toLowerCase();
        rows = rows.filter(r => r.name?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
      }
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO inventory_items (mill_id,code,name,category,unit,current_stock,reorder_level,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))`,
        [mid, data.code, data.name, data.category||'', data.unit||'kg', data.current_stock||0, data.reorder_level||0]
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
    if (m === 'PUT' && seg[1]) {
      await desktopDb.run(
        `UPDATE inventory_items SET name=?,category=?,unit=?,reorder_level=?,updated_at=datetime('now') WHERE id=? AND mill_id=?`,
        [data.name, data.category||'', data.unit||'kg', data.reorder_level||0, seg[1], mid]
      );
      return ok(data);
    }
  }

  // ── Purchases ────────────────────────────────────────────────────────────
  if (seg[0] === 'purchases') {
    if (m === 'GET' && !seg[1]) {
      const rows = await desktopDb.all(
        `SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
         WHERE p.mill_id=? AND p.deleted_at IS NULL ORDER BY p.date DESC`,
        [mid]
      );
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO purchases (mill_id,supplier_id,invoice_number,date,total_amount,paid_amount,payment_status,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [mid, data.supplier_id, data.invoice_number||'', data.date, data.total_amount||0, data.paid_amount||0, data.payment_status||'unpaid', data.notes||'']
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
  }

  // ── Sales ─────────────────────────────────────────────────────────────────
  if (seg[0] === 'sales') {
    if (m === 'GET' && !seg[1]) {
      const rows = await desktopDb.all(
        `SELECT so.*, c.name AS customer_name FROM sales_orders so LEFT JOIN customers c ON c.id=so.customer_id
         WHERE so.mill_id=? AND so.deleted_at IS NULL ORDER BY so.date DESC`,
        [mid]
      );
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO sales_orders (mill_id,customer_id,invoice_number,date,total_amount,paid_amount,payment_status,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [mid, data.customer_id, data.invoice_number||'', data.date, data.total_amount||0, data.paid_amount||0, data.payment_status||'unpaid', data.notes||'']
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
  }

  // ── Production ────────────────────────────────────────────────────────────
  if (seg[0] === 'production') {
    if (m === 'GET' && (!seg[1] || seg[1] === 'batches')) {
      const rows = await desktopDb.all(`SELECT * FROM production_batches WHERE mill_id=? ORDER BY date DESC`, [mid]);
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO production_batches (mill_id,batch_number,date,paddy_quantity,rice_quantity,bran_quantity,husk_quantity,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [mid, data.batch_number||'', data.date, data.paddy_quantity||0, data.rice_quantity||0, data.bran_quantity||0, data.husk_quantity||0, data.status||'pending']
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
  }

  // ── Employees ────────────────────────────────────────────────────────────
  if (seg[0] === 'employees') {
    if (seg[1] === 'salaries' && m === 'GET') {
      const rows = await desktopDb.all(
        `SELECT s.*, e.name AS employee_name, e.code AS employee_code FROM salaries s JOIN employees e ON e.id=s.employee_id
         WHERE s.mill_id=? AND s.month=? ORDER BY e.name`,
        [mid, params?.month || new Date().toISOString().slice(0,7)]
      );
      return ok(rows);
    }
    if (seg[1] === 'salaries' && seg[2] === 'generate' && m === 'POST') {
      return ok({ generated: true });
    }
    if (seg[1] === 'attendance' && m === 'GET') {
      const rows = await desktopDb.all(`SELECT * FROM attendance WHERE mill_id=? AND date=?`, [mid, params?.date]);
      return ok(rows);
    }
    if (seg[1] === 'attendance' && seg[2] === 'bulk' && m === 'POST') {
      const records = data.records || [];
      for (const rec of records) {
        await desktopDb.run(
          `INSERT INTO attendance (mill_id,employee_id,date,status,created_at,updated_at)
           VALUES (?,?,?,?,datetime('now'),datetime('now'))
           ON CONFLICT(employee_id,date) DO UPDATE SET status=excluded.status, updated_at=datetime('now')`,
          [mid, rec.employee_id, rec.date, rec.status]
        );
      }
      return ok({ saved: records.length });
    }
    if (m === 'GET' && !seg[1]) {
      let rows = await desktopDb.all(`SELECT * FROM employees WHERE mill_id=? AND is_active=1 ORDER BY name`, [mid]);
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST' && !seg[1]) {
      const r = await desktopDb.run(
        `INSERT INTO employees (mill_id,code,name,name_bn,phone,nid,designation,department,join_date,basic_salary,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))`,
        [mid, data.code, data.name, data.name_bn||'', data.phone||'', data.nid||'', data.designation||'', data.department||'', data.join_date||'', data.basic_salary||0]
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
    if (m === 'PUT' && seg[1]) {
      await desktopDb.run(
        `UPDATE employees SET name=?,name_bn=?,phone=?,designation=?,department=?,basic_salary=?,updated_at=datetime('now') WHERE id=? AND mill_id=?`,
        [data.name, data.name_bn||'', data.phone||'', data.designation||'', data.department||'', data.basic_salary||0, seg[1], mid]
      );
      return ok(data);
    }
  }

  // ── Vehicles ──────────────────────────────────────────────────────────────
  if (seg[0] === 'vehicles') {
    if (m === 'GET' && !seg[1]) {
      const rows = await desktopDb.all(`SELECT * FROM vehicles WHERE mill_id=? AND is_active=1 ORDER BY number`, [mid]);
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (m === 'POST') {
      const r = await desktopDb.run(
        `INSERT INTO vehicles (mill_id,registration_number,type,model,driver_name,driver_phone,is_active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`,
        [mid, data.registration_number, data.type||'', data.model||'', data.driver_name||'', data.driver_phone||'']
      );
      return ok({ id: r.lastInsertRowid, ...data });
    }
  }

  // ── Accounting ────────────────────────────────────────────────────────────
  if (seg[0] === 'accounting') {
    if (seg[1] === 'accounts') {
      const rows = await desktopDb.all(`SELECT * FROM accounts WHERE mill_id=? ORDER BY code`, [mid]);
      return ok(rows);
    }
    if (seg[1] === 'expenses') {
      const rows = await desktopDb.all(`SELECT * FROM expenses WHERE mill_id=? ORDER BY date DESC`, [mid]);
      const pg = paginate(rows, params?.page, params?.limit);
      return ok(pg.rows, { total: pg.total, page: pg.page, limit: pg.limit });
    }
    if (seg[1] === 'profit-loss') {
      const sales = await desktopDb.all(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_orders WHERE mill_id=?`, [mid]);
      const purchases = await desktopDb.all(`SELECT COALESCE(SUM(total_amount),0) AS total FROM purchases WHERE mill_id=?`, [mid]);
      const expenses = await desktopDb.all(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE mill_id=?`, [mid]);
      const revenue = sales[0]?.total || 0;
      const cost = (purchases[0]?.total || 0) + (expenses[0]?.total || 0);
      return ok({ revenue, cost, profit: revenue - cost });
    }
    if (m === 'GET' && !seg[1]) {
      return ok([]);
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (seg[0] === 'notifications') {
    if (m === 'GET') return ok([]);
    if (m === 'PUT') return ok(null);
  }

  // ── Dashboard (fallback) ──────────────────────────────────────────────────
  if (seg[0] === 'dashboard') {
    return ok({ todaySales: { total: 0, count: 0 }, todayProduction: { total: 0, count: 0 }, totalDue: 0, lowStockItems: [], stockByCategory: [] });
  }

  // ── Reports (stub) ────────────────────────────────────────────────────────
  if (seg[0] === 'reports') {
    return ok([]);
  }

  throw new Error(`Desktop: unhandled ${m} /api/${seg.join('/')}`);
}
