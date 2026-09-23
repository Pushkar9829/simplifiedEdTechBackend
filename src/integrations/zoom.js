const crypto = require('crypto');
const env = require('../config/env');

let cachedToken = null;

function zoomEnabled() {
  const { accountId, clientId, clientSecret } = env.zoom;
  return Boolean(accountId && clientId && clientSecret);
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { accountId, clientId, clientSecret } = env.zoom;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  );
  if (!res.ok) throw new Error(`Zoom auth failed (${res.status})`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function zoomRequest(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Zoom ${method} ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

function demoMeeting(seed) {
  const id = String(parseInt(crypto.createHash('md5').update(String(seed)).digest('hex').slice(0, 10), 16))
    .padEnd(11, '0')
    .slice(0, 11);
  const password = crypto.createHash('sha1').update(`pw${seed}`).digest('hex').slice(0, 6);
  return {
    meetingId: id,
    joinUrl: `https://zoom.us/j/${id}?pwd=${password}`,
    startUrl: `https://zoom.us/s/${id}?pwd=${password}`,
    password,
    provider: 'demo',
  };
}

/**
 * Creates a scheduled meeting. Returns { meetingId, joinUrl, startUrl, password, provider }.
 */
async function createMeeting({ topic, startAt, endAt, timezone, seed }) {
  if (!zoomEnabled()) return demoMeeting(seed || `${topic}-${startAt}`);
  const duration = Math.max(15, Math.round((new Date(endAt) - new Date(startAt)) / 60000));
  const json = await zoomRequest('POST', '/users/me/meetings', {
    topic: topic || 'Tutoring session',
    type: 2,
    start_time: new Date(startAt).toISOString(),
    duration,
    timezone: timezone || 'UTC',
    settings: { join_before_host: false, waiting_room: true },
  });
  return {
    meetingId: String(json.id),
    joinUrl: json.join_url,
    startUrl: json.start_url,
    password: json.password || '',
    provider: 'zoom',
  };
}

async function updateMeeting(meetingId, { startAt, endAt, timezone }) {
  if (!zoomEnabled() || !meetingId) return null;
  const duration = Math.max(15, Math.round((new Date(endAt) - new Date(startAt)) / 60000));
  await zoomRequest('PATCH', `/meetings/${meetingId}`, {
    start_time: new Date(startAt).toISOString(),
    duration,
    timezone: timezone || 'UTC',
  });
  return true;
}

async function deleteMeeting(meetingId) {
  if (!zoomEnabled() || !meetingId) return null;
  await zoomRequest('DELETE', `/meetings/${meetingId}`);
  return true;
}

module.exports = { zoomEnabled, createMeeting, updateMeeting, deleteMeeting, demoMeeting };
