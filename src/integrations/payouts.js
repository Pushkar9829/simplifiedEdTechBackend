const crypto = require('crypto');
const env = require('../config/env');

function provider() {
  const p = env.payouts;
  if (p.provider === 'razorpay' && p.razorpayKeyId && p.razorpayKeySecret && p.razorpayAccountNumber) {
    return 'razorpay';
  }
  if (p.provider === 'cashfree' && p.cashfreeClientId && p.cashfreeClientSecret) return 'cashfree';
  return 'demo';
}

function normaliseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(expected, actual) {
  const a = normaliseName(expected).split(' ').filter(Boolean);
  const b = normaliseName(actual).split(' ').filter(Boolean);
  if (!a.length || !b.length) return false;
  const shared = a.filter((w) => b.includes(w)).length;
  return shared / Math.min(a.length, b.length) >= 0.5;
}

function razorpayAuth() {
  const { razorpayKeyId, razorpayKeySecret } = env.payouts;
  return `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`;
}

async function razorpay(method, path, body) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: razorpayAuth(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.description || `Razorpay ${path} failed (${res.status})`);
  return json;
}

async function razorpayFundAccount({ holderName, accountNumber, ifsc, contactRef }) {
  const contact = await razorpay('POST', '/contacts', {
    name: holderName,
    type: 'vendor',
    reference_id: contactRef,
  });
  return razorpay('POST', '/fund_accounts', {
    contact_id: contact.id,
    account_type: 'bank_account',
    bank_account: { name: holderName, ifsc, account_number: accountNumber },
  });
}

async function cashfreeToken() {
  const { cashfreeBaseUrl, cashfreeClientId, cashfreeClientSecret } = env.payouts;
  const res = await fetch(`${cashfreeBaseUrl}/payout/v1/authorize`, {
    method: 'POST',
    headers: { 'X-Client-Id': cashfreeClientId, 'X-Client-Secret': cashfreeClientSecret },
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') throw new Error(json.message || 'Cashfree auth failed');
  return json.data.token;
}

/**
 * Rs 1 penny drop. Returns { status: verified|failed, registeredName, nameMatch, providerRef, provider, reason }.
 */
async function verifyBankAccount({ holderName, accountNumber, ifsc, reference }) {
  const p = provider();
  if (p === 'demo') {
    const ok = /^\d{9,18}$/.test(accountNumber) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
    return {
      status: ok ? 'verified' : 'failed',
      registeredName: ok ? holderName : '',
      nameMatch: ok,
      providerRef: `demo_${crypto.randomBytes(6).toString('hex')}`,
      provider: 'demo',
      reason: ok ? '' : 'Invalid account number or IFSC',
    };
  }

  if (p === 'razorpay') {
    const fund = await razorpayFundAccount({ holderName, accountNumber, ifsc, contactRef: reference });
    const validation = await razorpay('POST', '/fund_accounts/validations', {
      account_number: env.payouts.razorpayAccountNumber,
      fund_account: { id: fund.id },
      amount: 100,
      currency: 'INR',
      notes: { reference },
    });
    const registeredName = validation.results?.registered_name || '';
    const active = validation.results?.account_status === 'active';
    const nameMatch = namesMatch(holderName, registeredName);
    return {
      status: active && nameMatch ? 'verified' : validation.status === 'created' ? 'pending' : 'failed',
      registeredName,
      nameMatch,
      providerRef: validation.id,
      fundAccountId: fund.id,
      provider: 'razorpay',
      reason: !active ? 'Account not active' : nameMatch ? '' : 'Account holder name does not match',
    };
  }

  const token = await cashfreeToken();
  const url = new URL(`${env.payouts.cashfreeBaseUrl}/payout/v1.2/validation/bankDetails`);
  url.searchParams.set('name', holderName);
  url.searchParams.set('bankAccount', accountNumber);
  url.searchParams.set('ifsc', ifsc);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  const registeredName = json.data?.nameAtBank || '';
  const ok = json.status === 'SUCCESS' && json.accountStatus !== 'INVALID';
  const nameMatch = namesMatch(holderName, registeredName);
  return {
    status: ok && nameMatch ? 'verified' : 'failed',
    registeredName,
    nameMatch,
    providerRef: json.data?.refId ? String(json.data.refId) : '',
    provider: 'cashfree',
    reason: !ok ? json.message || 'Validation failed' : nameMatch ? '' : 'Account holder name does not match',
  };
}

/** Sends a withdrawal to the verified account. Returns { status, payoutRef, provider }. */
async function sendPayout({ amount, currency, holderName, accountNumber, ifsc, fundAccountId, reference }) {
  const p = provider();
  if (p === 'demo') {
    return { status: 'processed', payoutRef: `demo_payout_${crypto.randomBytes(6).toString('hex')}`, provider: 'demo' };
  }
  if (p === 'razorpay') {
    let fid = fundAccountId;
    if (!fid) {
      const fund = await razorpayFundAccount({ holderName, accountNumber, ifsc, contactRef: reference });
      fid = fund.id;
    }
    const payout = await razorpay('POST', '/payouts', {
      account_number: env.payouts.razorpayAccountNumber,
      fund_account_id: fid,
      amount: Math.round(Number(amount) * 100),
      currency: currency || 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      reference_id: reference,
    });
    return { status: payout.status, payoutRef: payout.id, provider: 'razorpay' };
  }
  const token = await cashfreeToken();
  const res = await fetch(`${env.payouts.cashfreeBaseUrl}/payout/v1/directTransfer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Number(amount),
      transferId: reference,
      transferMode: 'banktransfer',
      beneDetails: { bankAccount: accountNumber, ifsc, name: holderName },
    }),
  });
  const json = await res.json();
  if (json.status === 'ERROR') throw new Error(json.message || 'Cashfree payout failed');
  return { status: json.status, payoutRef: json.data?.referenceId || reference, provider: 'cashfree' };
}

module.exports = { payoutProvider: provider, verifyBankAccount, sendPayout, namesMatch };
