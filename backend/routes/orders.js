const crypto = require('crypto');
const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { adminOnly } = require('../auth');
const logHistory = require('../history');

const STATUSES = ['Placed', 'Preparing', 'On the way', 'Delivered'];
const REASONS = ['Order not received', 'Wrong or missing items', 'Late delivery', 'Food quality', 'Other'];

// POST /api/orders : place an order (prices come from the database, never from the client)
router.post('/', wrap(async (req, res) => {
  const { customer_name, phone, address, items } = req.body || {};
  const name = String(customer_name || '').trim();
  const addr = String(address || '').trim();
  const ph = String(phone || '').trim();

  if (!name || !addr || !/^[0-9]{10}$/.test(ph)) {
    return res.status(400).json({ error: 'Enter a valid name, a 10-digit phone number and an address.' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }
  for (const i of items) {
    if (!Number.isInteger(i.id) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20) {
      return res.status(400).json({ error: 'Invalid cart items.' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, price FROM menu_items WHERE available = TRUE AND id IN (?)',
      [items.map((i) => i.id)]
    );
    const prices = new Map(rows.map((r) => [r.id, Number(r.price)]));
    if (items.some((i) => !prices.has(i.id))) {
      await conn.rollback();
      return res.status(400).json({ error: 'Some items are no longer available.' });
    }

    const total = items.reduce((sum, i) => sum + prices.get(i.id) * i.quantity, 0);
    const code = String(crypto.randomInt(0, 10000)).padStart(4, '0'); // proof-of-delivery code
    const [result] = await conn.query(
      'INSERT INTO orders (customer_name, phone, address, total, delivery_code) VALUES (?, ?, ?, ?, ?)',
      [name, ph, addr, total, code]
    );
    const orderId = result.insertId;
    await conn.query(
      'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES ?',
      [items.map((i) => [orderId, i.id, i.quantity, prices.get(i.id)])]
    );
    await logHistory(conn, orderId, 'Placed', 'customer');
    await conn.commit();
    res.status(201).json({ order_id: orderId, total, delivery_code: code });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/orders : recent orders for the admin page
router.get('/', adminOnly, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.id, o.customer_name, o.total, o.status, o.rider_id, r.name AS rider_name
     FROM orders o LEFT JOIN riders r ON r.id = o.rider_id ORDER BY o.id DESC LIMIT 50`
  );
  res.json(rows);
}));

// GET /api/orders/summary : totals for the admin page (must stay above /:id)
router.get('/summary', adminOnly, wrap(async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_revenue FROM orders'
  );
  res.json({ order_count: row.order_count, total_revenue: Number(row.total_revenue) });
}));

// GET /api/orders/:id?phone= : customer tracks one order (order id + phone must match)
router.get('/:id', wrap(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.id, o.customer_name, o.address, o.total, o.status, o.created_at, o.delivered_at,
            o.phone, o.delivery_code, r.name AS rider_name
     FROM orders o LEFT JOIN riders r ON r.id = o.rider_id WHERE o.id = ?`,
    [req.params.id]
  );
  const order = orders[0];
  if (!order || String(req.query.phone || '').trim() !== order.phone) {
    return res.status(404).json({ error: 'Order not found. Check the order number and phone.' });
  }
  const [items] = await pool.query(
    `SELECT m.name, oi.quantity, oi.unit_price
     FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ?`,
    [order.id]
  );
  delete order.phone;
  if (order.status === 'Delivered') delete order.delivery_code; // code is only useful before delivery
  res.json({ ...order, items });
}));

// POST /api/orders/:id/complaints : customer reports a problem
router.post('/:id/complaints', wrap(async (req, res) => {
  const { phone, reason, details } = req.body || {};
  const [orders] = await pool.query('SELECT phone FROM orders WHERE id = ?', [req.params.id]);
  if (!orders[0] || String(phone || '').trim() !== orders[0].phone) {
    return res.status(404).json({ error: 'Order not found. Check the order number and phone.' });
  }
  if (!REASONS.includes(reason)) return res.status(400).json({ error: 'Choose a reason.' });
  const [open] = await pool.query("SELECT id FROM complaints WHERE order_id = ? AND status = 'Open'", [req.params.id]);
  if (open.length) return res.status(409).json({ error: 'You already have an open complaint for this order.' });
  await pool.query('INSERT INTO complaints (order_id, reason, details) VALUES (?, ?, ?)', [
    req.params.id, reason, String(details || '').trim().slice(0, 500),
  ]);
  res.status(201).json({ ok: true });
}));

// PATCH /api/orders/:id/status : admin override
router.patch('/:id/status', adminOnly, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const [result] = await pool.query(
    "UPDATE orders SET status = ?, delivered_at = IF(? = 'Delivered', NOW(), delivered_at) WHERE id = ?",
    [status, status, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found.' });
  await logHistory(pool, req.params.id, status, 'admin');
  res.json({ id: Number(req.params.id), status });
}));

// PATCH /api/orders/:id/rider : admin assigns (or unassigns) a rider
router.patch('/:id/rider', adminOnly, wrap(async (req, res) => {
  const riderId = req.body && req.body.rider_id ? Number(req.body.rider_id) : null;
  let label = 'Unassigned';
  if (riderId) {
    const [r] = await pool.query('SELECT name FROM riders WHERE id = ? AND active = TRUE', [riderId]);
    if (!r[0]) return res.status(400).json({ error: 'Rider not found.' });
    label = 'Assigned to ' + r[0].name;
  }
  const [result] = await pool.query('UPDATE orders SET rider_id = ? WHERE id = ?', [riderId, req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found.' });
  await logHistory(pool, req.params.id, label, 'admin');
  res.json({ ok: true });
}));

module.exports = router;
