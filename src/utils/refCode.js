const crypto = require('crypto');

// attempt > 0 adds a random suffix to get past a last-6-hex collision.
function makeRefCode(id, attempt = 0) {
  const raw = String(id || '').replace(/[^a-fA-F0-9]/g, '');
  if (!raw) return 'SCH-------';
  const base = `SCH-${raw.slice(-6).toUpperCase()}`;
  return attempt > 0 ? `${base}${crypto.randomBytes(2).toString('hex').toUpperCase()}` : base;
}

function isDuplicateRefCode(err) {
  return err?.code === 11000 && Boolean(err.keyPattern?.refCode || /refCode/.test(err.message || ''));
}

function publicRef(user) {
  if (!user) return '';
  return user.refCode || makeRefCode(user._id || user);
}

module.exports = { makeRefCode, isDuplicateRefCode, publicRef };
