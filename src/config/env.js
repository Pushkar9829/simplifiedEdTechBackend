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
};
