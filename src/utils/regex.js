// Escape user input before building a RegExp (prevents 500s and ReDoS).
function escapeRegex(value, maxLength = 100) {
  return String(value ?? '')
    .slice(0, maxLength)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
