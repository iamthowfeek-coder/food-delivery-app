const router = require('express').Router();
const pool = require('../db');
const wrap = require('../wrap');

// GET /api/menu : all available items
router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, description, price, category, emoji FROM menu_items WHERE available = TRUE ORDER BY category, name'
  );
  res.json(rows);
}));

module.exports = router;
