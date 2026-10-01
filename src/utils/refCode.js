function makeRefCode(id) {
  const raw = String(id || '').replace(/[^a-fA-F0-9]/g, '');
  if (!raw) return 'SCH-------';
  return `SCH-${raw.slice(-6).toUpperCase()}`;
}

function publicRef(user) {
  if (!user) return '';
  return user.refCode || makeRefCode(user._id || user);
}

module.exports = { makeRefCode, publicRef };
