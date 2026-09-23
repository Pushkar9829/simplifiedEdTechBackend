const ApiError = require('../common/ApiError');

const LETTER_PERCENT = { 'A*': 95, A: 85, B: 75, C: 65, D: 55, E: 45, F: 30, U: 10 };

function round(n, dp = 1) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function percentToIb(pct) {
  if (pct >= 85) return 7;
  if (pct >= 72) return 6;
  if (pct >= 60) return 5;
  if (pct >= 48) return 4;
  if (pct >= 35) return 3;
  if (pct >= 20) return 2;
  return 1;
}

/**
 * Normalises a grade input into { scheme, value, maxScore, percentage, ibEquivalent, label }.
 * Accepts the structured object or a legacy free-text string.
 */
function normalizeGrade(input, scheme = 'ib_1_7', maxScore) {
  if (input == null || input === '') throw new ApiError(400, 'Grade is required');

  if (typeof input === 'string' && !scheme) {
    return { scheme: 'legacy', value: input, label: input };
  }

  const raw = typeof input === 'object' ? input.value : input;
  const s = (typeof input === 'object' && input.scheme) || scheme;
  const max = Number((typeof input === 'object' && input.maxScore) || maxScore) || undefined;

  switch (s) {
    case 'ib_1_7': {
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1 || v > 7) throw new ApiError(400, 'IB grade must be 1 to 7');
      const percentage = round((v / 7) * 100);
      return { scheme: s, value: v, maxScore: 7, percentage, ibEquivalent: v, label: `${v}/7` };
    }
    case 'percentage': {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > 100) throw new ApiError(400, 'Percentage must be 0 to 100');
      return {
        scheme: s,
        value: round(v),
        maxScore: 100,
        percentage: round(v),
        ibEquivalent: percentToIb(v),
        label: `${round(v)}%`,
      };
    }
    case 'marks': {
      const v = Number(raw);
      if (!max || max <= 0) throw new ApiError(400, 'Max score is required for marks grading');
      if (!Number.isFinite(v) || v < 0 || v > max) throw new ApiError(400, `Marks must be 0 to ${max}`);
      const percentage = round((v / max) * 100);
      return {
        scheme: s,
        value: v,
        maxScore: max,
        percentage,
        ibEquivalent: percentToIb(percentage),
        label: `${v}/${max} (${percentage}%)`,
      };
    }
    case 'letter': {
      const v = String(raw).trim().toUpperCase();
      if (!(v in LETTER_PERCENT)) {
        throw new ApiError(400, `Letter grade must be one of ${Object.keys(LETTER_PERCENT).join(', ')}`);
      }
      const percentage = LETTER_PERCENT[v];
      return { scheme: s, value: v, percentage, ibEquivalent: percentToIb(percentage), label: v };
    }
    case 'pass_fail': {
      const v = String(raw).trim().toLowerCase();
      if (!['pass', 'fail'].includes(v)) throw new ApiError(400, 'Grade must be pass or fail');
      const percentage = v === 'pass' ? 100 : 0;
      return {
        scheme: s,
        value: v,
        percentage,
        ibEquivalent: v === 'pass' ? 5 : 2,
        label: v === 'pass' ? 'Pass' : 'Fail',
      };
    }
    default:
      throw new ApiError(400, `Unknown grading scheme: ${s}`);
  }
}

function gradeLabel(grade) {
  if (!grade) return '';
  if (typeof grade === 'string') return grade;
  return grade.label || String(grade.value ?? '');
}

module.exports = { normalizeGrade, gradeLabel, percentToIb, LETTER_PERCENT };
