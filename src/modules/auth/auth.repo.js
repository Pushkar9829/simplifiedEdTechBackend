const OtpSession = require('./auth.model');

async function upsertOtp(phone, code, expiresAt) {
  return OtpSession.findOneAndUpdate(
    { phone },
    { phone, code, expiresAt },
    { upsert: true, new: true }
  );
}

async function findOtp(phone) {
  return OtpSession.findOne({ phone });
}

async function deleteOtp(phone) {
  return OtpSession.deleteMany({ phone });
}

module.exports = { upsertOtp, findOtp, deleteOtp };
