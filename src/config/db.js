const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');

function isSrvLookupError(err) {
  return (
    err?.syscall === 'querySrv' ||
    err?.code === 'ECONNREFUSED' ||
    /querySrv/i.test(err?.message || '')
  );
}

function parseMongoUri(uri) {
  const parsed = new URL(uri);
  return {
    isSrv: parsed.protocol === 'mongodb+srv:',
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    hostname: parsed.hostname,
    pathname: parsed.pathname || '/test',
    search: parsed.search,
  };
}

function standardUriFromSrv(parsed, hosts) {
  const auth =
    parsed.username || parsed.password
      ? `${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@`
      : '';
  const hostList = hosts.map((h) => `${h.name}:${h.port || 27017}`).join(',');
  const params = new URLSearchParams(parsed.search);
  if (!params.has('ssl')) params.set('ssl', 'true');
  if (!params.has('tls')) params.set('tls', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');
  return `mongodb://${auth}${hostList}${parsed.pathname}?${params.toString()}`;
}

async function resolveSrvHosts(hostname) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  return dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
}

async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* Node < 17 */
  }

  const opts = { family: 4, serverSelectionTimeoutMS: 20000 };
  try {
    await mongoose.connect(env.mongoUri, opts);
  } catch (err) {
    const parsed = parseMongoUri(env.mongoUri);
    if (!parsed.isSrv || !isSrvLookupError(err)) throw err;
    console.warn('MongoDB SRV DNS failed; resolving hosts via public DNS…');
    const hosts = await resolveSrvHosts(parsed.hostname);
    await mongoose.connect(standardUriFromSrv(parsed, hosts), opts);
  }
  console.log('MongoDB connected');
}

module.exports = { connectDb };
