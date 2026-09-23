require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ibdp_tutoring',
  jwtSecret: process.env.JWT_SECRET || 'ibdp_dev_jwt_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  demoOtp: process.env.DEMO_OTP || '123456',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  s3: {
    region: process.env.AWS_REGION || process.env.S3_REGION || '',
    bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    publicBaseUrl:
      process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN || '',
    keyPrefix: process.env.S3_KEY_PREFIX || 'ibdp',
  },
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID || '',
    clientId: process.env.ZOOM_CLIENT_ID || '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  },
  sms: {
    provider: (process.env.SMS_PROVIDER || '').toLowerCase(),
    msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID || '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_FROM || '',
  },
  payouts: {
    provider: (process.env.PAYOUT_PROVIDER || '').toLowerCase(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    razorpayAccountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER || '',
    cashfreeClientId: process.env.CASHFREE_CLIENT_ID || '',
    cashfreeClientSecret: process.env.CASHFREE_CLIENT_SECRET || '',
    cashfreeBaseUrl: process.env.CASHFREE_BASE_URL || 'https://payout-gamma.cashfree.com',
  },
  bankEncryptionKey: process.env.BANK_ENCRYPTION_KEY || process.env.JWT_SECRET || 'ibdp_dev_bank_key',
};
