const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { adminOnly } = require('../auth');

router.get('/', adminOnly, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.order_id, c.reason, c.details, c.status, c.created_at, o.customer_name, r.name AS rider_name
     FROM complaints c JOIN orders o ON o.id = c.order_id LEFT JOIN riders r ON r.id = o.rider_id
     ORDER BY c.status = 'Resolved', c.id DESC LIMIT 50`
  );
  if (rows.length) {
    const [history] = await pool.query(
      'SELECT order_id, status, changed_by, changed_at FROM order_history WHERE order_id IN (?) ORDER BY id',
      [rows.map((c) => c.order_id)]
    );
    rows.forEach((c) => { c.history = history.filter((h) => h.order_id === c.order_id); });
  }
  res.json(rows);
}));

router.patch('/:id', adminOnly, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['Open', 'Resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const [result] = await pool.query('UPDATE complaints SET status = ? WHERE id = ?', [status, req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Complaint not found.' });
  res.json({ ok: true });
}));

module.exports = router;
