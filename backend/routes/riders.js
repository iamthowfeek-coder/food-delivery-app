const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');
const { adminOnly, hashPin } = require('../auth');

router.get('/', adminOnly, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, phone FROM riders WHERE active = TRUE ORDER BY name');
  res.json(rows);
}));

router.post('/', adminOnly, wrap(async (req, res) => {
  const { name, phone, pin } = req.body || {};
  const n = String(name || '').trim();
  const ph = String(phone || '').trim();
  const p = String(pin || '');
  if (!n || !/^[0-9]{10}$/.test(ph) || !/^[0-9]{4,6}$/.test(p)) {
    return res.status(400).json({ error: 'Enter a name, a 10-digit phone and a 4 to 6 digit PIN.' });
  }
  try {
    const [r] = await pool.query('INSERT INTO riders (name, phone, pin_hash) VALUES (?, ?, ?)', [n, ph, hashPin(p)]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A rider with this phone already exists.' });
    throw err;
  }
}));

module.exports = router;
