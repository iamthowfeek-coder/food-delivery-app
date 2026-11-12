// Writes one line to the order_history table (who changed what, and when).
module.exports = (db, orderId, status, by) =>
  db.query('INSERT INTO order_history (order_id, status, changed_by) VALUES (?, ?, ?)', [orderId, status, by]);
