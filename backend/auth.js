const crypto = require('crypto');

// ----- admin: one shared key from .env -----
exports.adminOnly = (req, res, next) => {
  if (!process.env.ADMIN_KEY || req.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Admin key required' });
  }
  next();
};

// ----- rider PINs are stored hashed (scrypt + random salt), never as plain text -----
exports.hashPin = (pin) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pin, salt, 32).toString('hex');
};
exports.checkPin = (pin, stored) => {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(pin, salt, 32), Buffer.from(hash, 'hex'));
};

// ----- rider login tokens (kept in memory: server restart = riders log in again) -----
const tokens = new Map();
exports.createRiderToken = (rider) => {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { id: rider.id, name: rider.name, expires: Date.now() + 12 * 3600 * 1000 });
  return token;
};
exports.riderOnly = (req, res, next) => {
  const session = tokens.get(req.get('x-rider-token'));
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Please log in again.' });
  req.rider = session;
  next();
};
