const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const millId = req.user.millId;
  let sql = `SELECT id,code,name,name_bn,phone,designation,department,join_date,basic_salary,is_active FROM employees WHERE mill_id=$1 AND deleted_at IS NULL`;
  const params = [millId];
  if (req.query.search) { sql += ` AND (name ILIKE $2 OR code ILIKE $2)`; params.push(`%${req.query.search}%`); }
  const cntRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM'), params);
  sql += ` ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

router.post('/', requireRole('admin','manager'), async (req, res) => {
  const { code, name, name_bn, phone, nid, designation, department, join_date, basic_salary } = req.body;
  const r = await query(
    `INSERT INTO employees (mill_id,code,name,name_bn,phone,nid,designation,department,join_date,basic_salary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.millId, code, name, name_bn, phone, nid, designation, department, join_date, basic_salary]
  );
  created(res, r.rows[0], 'Employee created');
});

router.get('/:id', async (req, res) => {
  const r = await query('SELECT * FROM employees WHERE id=$1 AND mill_id=$2 AND deleted_at IS NULL', [req.params.id, req.user.millId]);
  if (!r.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } });
  success(res, r.rows[0]);
});

router.put('/:id', requireRole('admin','manager'), async (req, res) => {
  const fields = ['name','name_bn','phone','designation','department','basic_salary','is_active'];
  const updates = []; const params = []; let idx = 1;
  for (const f of fields) if (req.body[f] !== undefined) { updates.push(`${f}=$${idx++}`); params.push(req.body[f]); }
  updates.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  const r = await query(`UPDATE employees SET ${updates.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1} RETURNING *`, params);
  success(res, r.rows[0], 'Employee updated');
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await query('UPDATE employees SET deleted_at=NOW() WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  success(res, null, 'Employee deleted');
});

// Attendance — bulk upsert; records can carry per-row date or use a top-level date field
router.post('/attendance/bulk', requireRole('admin','manager','operator'), async (req, res) => {
  const { date: topDate, records } = req.body;
  const millId = req.user.millId;
  for (const rec of records) {
    const rowDate = rec.date || topDate;
    const empId   = rec.employee_id || rec.employeeId;
    await query(
      `INSERT INTO attendance (mill_id,employee_id,date,status,in_time,out_time,overtime_hours,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (employee_id,date) DO UPDATE SET status=$4, overtime_hours=$7, updated_at=NOW()`,
      [millId, empId, rowDate, rec.status, rec.in_time || rec.inTime || null,
       rec.out_time || rec.outTime || null, rec.overtime_hours || rec.overtimeHours || 0, req.user.id]
    );
  }
  success(res, { saved: records.length }, 'Attendance recorded');
});

router.get('/attendance', async (req, res) => {
  const millId = req.user.millId;
  // When fetching by specific date return all records for that day (no pagination needed)
  if (req.query.date) {
    const r = await query(
      `SELECT a.*, e.name AS employee_name FROM attendance a JOIN employees e ON e.id=a.employee_id
       WHERE a.mill_id=$1 AND a.date=$2 ORDER BY e.name`,
      [millId, req.query.date]
    );
    return success(res, r.rows);
  }
  const { page, limit, offset } = getPagination(req.query);
  let sql = `SELECT a.*, e.name AS employee_name FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.mill_id=$1`;
  const params = [millId]; let idx = 2;
  if (req.query.employeeId) { sql += ` AND a.employee_id=$${idx}`; params.push(req.query.employeeId); idx++; }
  if (req.query.month)      { sql += ` AND TO_CHAR(a.date,'YYYY-MM')=$${idx}`; params.push(req.query.month); idx++; }
  const cntRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM attendance a'), params);
  sql += ` ORDER BY a.date DESC LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

// Salaries
router.get('/salaries', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  let sql = `SELECT s.*, e.name AS employee_name FROM salaries s JOIN employees e ON e.id=s.employee_id WHERE s.mill_id=$1`;
  const params = [req.user.millId]; let idx = 2;
  if (req.query.month) { sql += ` AND s.month=$${idx}`; params.push(req.query.month); idx++; }
  const cntRes = await query(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) AS total FROM salaries s'), params);
  sql += ` ORDER BY s.month DESC,e.name LIMIT $${idx} OFFSET $${idx+1}`;
  params.push(limit, offset);
  const result = await query(sql, params);
  paginated(res, result.rows, parseInt(cntRes.rows[0].total), page, limit);
});

router.post('/salaries/generate', requireRole('admin','manager','accountant'), async (req, res) => {
  const { month } = req.body;
  const millId = req.user.millId;
  const employees = await query('SELECT * FROM employees WHERE mill_id=$1 AND is_active=TRUE AND deleted_at IS NULL', [millId]);
  const generated = [];
  for (const emp of employees.rows) {
    const attRes = await query(
      `SELECT COUNT(*) FILTER (WHERE status='present') AS present,
              SUM(overtime_hours) AS overtime
       FROM attendance WHERE employee_id=$1 AND TO_CHAR(date,'YYYY-MM')=$2`,
      [emp.id, month]
    );
    const presentDays = parseInt(attRes.rows[0].present) || 0;
    const overtimeHours = parseFloat(attRes.rows[0].overtime) || 0;
    const workingDays = 26;
    const dailyRate = (emp.basic_salary || 0) / workingDays;
    const basicEarned = dailyRate * presentDays;
    const overtimePay = (dailyRate / 8) * overtimeHours * 1.5;
    const advRes = await query('SELECT COALESCE(SUM(balance),0) AS adv FROM salary_advances WHERE employee_id=$1 AND balance>0', [emp.id]);
    const advDeduction = Math.min(parseFloat(advRes.rows[0].adv) || 0, basicEarned * 0.5);
    const netSalary = basicEarned + overtimePay - advDeduction;
    const r = await query(
      `INSERT INTO salaries (mill_id,employee_id,month,basic_salary,overtime_pay,advance_deduction,net_salary,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (employee_id,month) DO NOTHING RETURNING *`,
      [millId, emp.id, month, basicEarned, overtimePay, advDeduction, netSalary, req.user.id]
    );
    if (r.rows[0]) generated.push(r.rows[0]);
  }
  success(res, { generated: generated.length }, `${generated.length} salary records generated`);
});

router.post('/salaries/:id/pay', requireRole('admin','manager','accountant'), async (req, res) => {
  const { amount, accountId } = req.body;
  const r = await query('UPDATE salaries SET paid_amount=paid_amount+$1, status=CASE WHEN paid_amount+$1>=net_salary THEN \'paid\' ELSE \'partial\' END, paid_at=NOW() WHERE id=$2 AND mill_id=$3 RETURNING *',
    [amount, req.params.id, req.user.millId]);
  success(res, r.rows[0], 'Salary paid');
});

router.post('/salary-advances', requireRole('admin','manager'), async (req, res) => {
  const { employeeId, date, amount, reason } = req.body;
  const r = await query(
    'INSERT INTO salary_advances (mill_id,employee_id,date,amount,reason,balance,created_by) VALUES ($1,$2,$3,$4,$5,$4,$6) RETURNING *',
    [req.user.millId, employeeId, date, amount, reason, req.user.id]
  );
  created(res, r.rows[0], 'Advance issued');
});

module.exports = router;
