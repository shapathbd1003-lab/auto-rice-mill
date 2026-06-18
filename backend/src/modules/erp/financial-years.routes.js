const router = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validate, Joi } = require('../../middleware/validate');
const { query } = require('../../config/database');
const { success, created } = require('../../utils/response');

router.use(requireAuth);

// GET /api/erp/financial-years
router.get('/', async (req, res) => {
  const r = await query(
    'SELECT * FROM financial_years WHERE mill_id=$1 ORDER BY start_date DESC',
    [req.user.millId]
  );
  success(res, r.rows);
});

// POST /api/erp/financial-years
router.post('/', requireRole('admin'), validate(Joi.object({
  name:       Joi.string().max(50).required(),
  start_date: Joi.string().required(),
  end_date:   Joi.string().required(),
})), async (req, res) => {
  const { name, start_date, end_date } = req.body;
  const r = await query(
    `INSERT INTO financial_years (mill_id, name, start_date, end_date, is_active)
     VALUES ($1,$2,$3,$4,FALSE) RETURNING *`,
    [req.user.millId, name, start_date, end_date]
  );
  created(res, r.rows[0], 'Financial year created');
});

// PUT /api/erp/financial-years/:id/activate
router.put('/:id/activate', requireRole('admin'), async (req, res) => {
  await query('UPDATE financial_years SET is_active=FALSE WHERE mill_id=$1', [req.user.millId]);
  await query('UPDATE financial_years SET is_active=TRUE WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  success(res, null, 'Financial year activated');
});

// PUT /api/erp/financial-years/:id/lock
router.put('/:id/lock', requireRole('admin'), async (req, res) => {
  await query(
    `UPDATE financial_years SET is_locked=TRUE, locked_by=$1, locked_at=NOW() WHERE id=$2 AND mill_id=$3`,
    [req.user.id, req.params.id, req.user.millId]
  );
  success(res, null, 'Financial year locked');
});

// PUT /api/erp/financial-years/:id/unlock
router.put('/:id/unlock', requireRole('admin'), async (req, res) => {
  await query(
    'UPDATE financial_years SET is_locked=FALSE, locked_by=NULL, locked_at=NULL WHERE id=$1 AND mill_id=$2',
    [req.params.id, req.user.millId]
  );
  success(res, null, 'Financial year unlocked');
});

module.exports = router;
