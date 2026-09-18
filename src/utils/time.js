const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

function toUtc(date, tz = 'UTC') {
  return dayjs.tz(date, tz).utc().toDate();
}

function formatInTz(date, tz = 'UTC', format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(date).tz(tz).format(format);
}

module.exports = { dayjs, toUtc, formatInTz };
