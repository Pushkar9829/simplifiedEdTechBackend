const ApiError = require('../common/ApiError');

function looksLikeJson(value) {
  return (
    typeof value === 'string' &&
    ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']')))
  );
}

// Multipart forms send everything as strings, so coerce booleans/JSON there only.
// JSON bodies already carry real types; free text like "true" or "[note]" must stay text.
function normalizeBody(value, { coerce = false } = {}) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => normalizeBody(v, { coerce }));
  if (typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (raw === undefined) continue;
      out[key] = normalizeBody(raw, { coerce });
    }
    return out;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!coerce) return trimmed;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (looksLikeJson(trimmed)) {
      try {
        return normalizeBody(JSON.parse(trimmed), { coerce });
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return value;
}

// Remove '' at the given paths (fields whose schema does not accept an empty string).
function dropEmptyAt(body, paths) {
  for (const path of paths) {
    let node = body;
    for (let i = 0; i < path.length - 1 && node != null; i += 1) node = node[path[i]];
    const last = path[path.length - 1];
    if (node != null && node[last] === '') {
      if (Array.isArray(node)) node.splice(last, 1);
      else delete node[last];
    }
  }
}

const JOI_OPTIONS = { abortEarly: false, stripUnknown: true, convert: true };

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const coerce = property === 'body' && Boolean(req.is && req.is('multipart/form-data'));
    const input = normalizeBody(req[property], { coerce });
    let { error, value } = schema.validate(input, JOI_OPTIONS);

    // '' is how forms clear a field. Keep it where the schema allows it (e.g. `.allow('')`),
    // and treat it as "not sent" for fields that reject it (dates, numbers, ids, enums).
    if (error) {
      const emptyPaths = error.details
        .filter((d) => d.context && d.context.value === '')
        .map((d) => d.path);
      if (emptyPaths.length) {
        dropEmptyAt(input, emptyPaths);
        ({ error, value } = schema.validate(input, JOI_OPTIONS));
      }
    }

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
