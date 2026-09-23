const ApiError = require('../common/ApiError');

function looksLikeJson(value) {
  return (
    typeof value === 'string' &&
    ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']')))
  );
}

function normalizeBody(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(normalizeBody);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (raw === '' || raw === undefined) continue;
      out[key] = normalizeBody(raw);
    }
    return out;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (looksLikeJson(trimmed)) {
      try {
        return normalizeBody(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return value;
}

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(normalizeBody(req[property]), {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ApiError(400, 'Validation failed', errors));
    }
    req[property] = value;
    next();
  };
}

module.exports = { validate, normalizeBody };
