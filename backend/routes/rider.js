const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { checkPin, createRiderToken, riderOnly } = require('../auth');
const logHistory = require('../history');

const fails = new Map(); // phone -> { count, until }  (stops PIN guessing)

router.post('/login', wrap(async (req, res) => {
  const phone = String((req.body && req.body.phone) || '').trim();
  const pin = String((req.body && req.body.pin) || '');
  const f = fails.get(phone);
  if (f && f.until > Date.now()) return res.status(429).json({ error: 'Too many wrong attempts. Try again in 10 minutes.' });

  const [rows] = await pool.query('SELECT id, name, pin_hash FROM riders WHERE phone = ? AND active = TRUE', [phone]);
  const rider = rows[0];
  if (!rider || !checkPin(pin, rider.pin_hash)) {
    const count = ((f && f.count) || 0) + 1;
    fails.set(phone, { count, until: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0 });
    return res.status(401).json({ error: 'Wrong phone or PIN.' });
  }
  fails.delete(phone);
  res.json({ token: createRiderToken(rider), name: rider.name });
}));

// GET /api/rider/orders : only this rider's active orders (the delivery code is never sent)
router.get('/orders', riderOnly, wrap(async (req, res) => {
  const [orders] = await pool.query(
    "SELECT id, customer_name, phone, address, total, status FROM orders WHERE rider_id = ? AND status <> 'Delivered' ORDER BY id",
    [req.rider.id]
  );
  if (orders.length) {
    const [items] = await pool.query(
      `SELECT oi.order_id, m.name, oi.quantity FROM order_items oi
       JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id IN (?)`,
      [orders.map((o) => o.id)]
    );
    orders.forEach((o) => {
      o.items = items.filter((i) => i.order_id === o.id).map((i) => `${i.name} × ${i.quantity}`);
    });
  }
  const [[done]] = await pool.query(
    "SELECT COUNT(*) AS n FROM orders WHERE rider_id = ? AND status = 'Delivered' AND DATE(delivered_at) = CURDATE()",
    [req.rider.id]
  );
  res.json({ orders, delivered_today: done.n });
}));

router.post('/orders/:id/pickup', riderOnly, wrap(async (req, res) => {
  const [result] = await pool.query(
    "UPDATE orders SET status = 'On the way' WHERE id = ? AND rider_id = ? AND status IN ('Placed', 'Preparing')",
    [req.params.id, req.rider.id]
  );
  if (result.affectedRows === 0) return res.status(400).json({ error: 'You cannot pick up this order.' });
  await logHistory(pool, req.params.id, 'On the way', 'rider: ' + req.rider.name);
  res.json({ ok: true });
}));

// Delivered only works with the customer's 4-digit code (proof of delivery)
router.post('/orders/:id/deliver', riderOnly, wrap(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, delivery_code, code_attempts, status FROM orders WHERE id = ? AND rider_id = ?',
    [req.params.id, req.rider.id]
  );
  const o = rows[0];
  if (!o || o.status !== 'On the way') return res.status(400).json({ error: 'Mark the order as picked up first.' });
  if (o.code_attempts >= 5) return res.status(423).json({ error: 'Too many wrong codes. Contact the admin.' });

  if (String((req.body && req.body.code) || '').trim() !== o.delivery_code) {
    await pool.query('UPDATE orders SET code_attempts = code_attempts + 1 WHERE id = ?', [o.id]);
    return res.status(400).json({ error: 'Wrong code. Ask the customer again.' });
  }
  await pool.query("UPDATE orders SET status = 'Delivered', delivered_at = NOW() WHERE id = ?", [o.id]);
  await logHistory(pool, o.id, 'Delivered (code verified)', 'rider: ' + req.rider.name);
  res.json({ ok: true });
}));

module.exports = router;
