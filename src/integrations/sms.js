const crypto = require('crypto');
const env = require('../config/env');

function smsEnabled() {
  const s = env.sms;
  if (s.provider === 'msg91') return Boolean(s.msg91AuthKey && s.msg91TemplateId);
  if (s.provider === 'twilio') return Boolean(s.twilioAccountSid && s.twilioAuthToken && s.twilioFrom);
  return false;
}

function generateOtp() {
  if (!smsEnabled()) return env.demoOtp;
  return String(crypto.randomInt(100000, 1000000));
}

async function sendMsg91(phone, code) {
  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: env.sms.msg91AuthKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: env.sms.msg91TemplateId,
      mobile: phone.replace(/\D/g, ''),
      otp: code,
    }),
  });
  if (!res.ok) throw new Error(`MSG91 send failed (${res.status})`);
}

async function sendTwilio(phone, code) {
  const { twilioAccountSid, twilioAuthToken, twilioFrom } = env.sms;
  const basic = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: `Your IBDP Tutoring verification code is ${code}`,
      }),
    }
  );
  if (!res.ok) throw new Error(`Twilio send failed (${res.status})`);
}

/** Sends the code and returns { code, provider, demo }. */
async function sendOtp(phone) {
  const code = generateOtp();
  if (!smsEnabled()) return { code, provider: 'demo', demo: true };
  if (env.sms.provider === 'msg91') await sendMsg91(phone, code);
  else await sendTwilio(phone, code);
  return { code, provider: env.sms.provider, demo: false };
}

module.exports = { smsEnabled, sendOtp };
