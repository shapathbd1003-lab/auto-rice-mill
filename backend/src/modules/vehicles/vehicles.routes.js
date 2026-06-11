const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const r = await query('SELECT * FROM vehicles WHERE mill_id=$1 AND is_active=TRUE ORDER BY number', [req.user.millId]);
  success(res, r.rows);
});

router.post('/', requireRole('admin','manager'), async (req, res) => {
  const { number, type, driver_name, driver_phone } = req.body;
  const r = await query(
    'INSERT INTO vehicles (mill_id,number,type,driver_name,driver_phone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.millId, number, type, driver_name, driver_phone]
  );
  created(res, r.rows[0], 'Vehicle added');
});

router.put('/:id', requireRole('admin','manager'), async (req, res) => {
  const fields = ['number','type','driver_name','driver_phone','is_active'];
  const updates = []; const params = []; let idx = 1;
  for (const f of fields) if (req.body[f] !== undefined) { updates.push(`${f}=$${idx++}`); params.push(req.body[f]); }
  updates.push('updated_at=NOW()');
  params.push(req.params.id, req.user.millId);
  const r = await query(`UPDATE vehicles SET ${updates.join(',')} WHERE id=$${idx} AND mill_id=$${idx+1} RETURNING *`, params);
  success(res, r.rows[0], 'Vehicle updated');
});

router.get('/:id/trips', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const r = await query('SELECT * FROM vehicle_trips WHERE vehicle_id=$1 AND mill_id=$2 ORDER BY date DESC LIMIT $3 OFFSET $4',
    [req.params.id, req.user.millId, limit, offset]);
  const cnt = await query('SELECT COUNT(*) AS total FROM vehicle_trips WHERE vehicle_id=$1', [req.params.id]);
  paginated(res, r.rows, parseInt(cnt.rows[0].total), page, limit);
});

router.post('/trips', requireRole('admin','manager','operator'), async (req, res) => {
  const { vehicleId, date, tripType, fromLocation, toLocation, distanceKm, fuelLiters, fuelCost = 0, driverCost = 0, otherCost = 0, notes } = req.body;
  const totalCost = fuelCost + driverCost + otherCost;
  const r = await query(
    `INSERT INTO vehicle_trips (mill_id,vehicle_id,date,trip_type,from_location,to_location,distance_km,fuel_liters,fuel_cost,driver_cost,other_cost,total_cost,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.user.millId, vehicleId, date, tripType, fromLocation, toLocation, distanceKm, fuelLiters, fuelCost, driverCost, otherCost, totalCost, notes, req.user.id]
  );
  created(res, r.rows[0], 'Trip recorded');
});

module.exports = router;
