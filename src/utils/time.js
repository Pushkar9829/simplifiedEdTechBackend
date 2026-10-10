const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const EXPLICIT_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

function toUtc(date, tz = 'UTC') {
  if (date instanceof Date || (typeof date === 'string' && EXPLICIT_OFFSET.test(date.trim()))) {
    return dayjs(date).utc().toDate();
  }
  return dayjs.tz(date, tz).utc().toDate();
}

function formatInTz(date, tz = 'UTC', format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(date).tz(tz).format(format);
}

module.exports = { dayjs, toUtc, formatInTz };
