const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/database');
const { success } = require('../../utils/response');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const r = await query(
    `SELECT * FROM notifications WHERE mill_id=$1 AND (user_id=$2 OR user_id IS NULL) ORDER BY created_at DESC LIMIT 50`,
    [req.user.millId, req.user.id]
  );
  success(res, r.rows);
});

router.put('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND mill_id=$2', [req.params.id, req.user.millId]);
  success(res, null, 'Marked as read');
});

router.put('/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE mill_id=$1 AND (user_id=$2 OR user_id IS NULL)', [req.user.millId, req.user.id]);
  success(res, null, 'All notifications marked as read');
});

module.exports = router;
