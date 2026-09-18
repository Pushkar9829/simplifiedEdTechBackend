const app = require('./app');
const env = require('./config/env');
const { connectDb } = require('./config/db');

const { s3Enabled } = require('./utils/s3');

async function start() {
  await connectDb();
  app.listen(env.port, () => {
    console.log(`IBDP API listening on port ${env.port}`);
    console.log(`Demo OTP: ${env.demoOtp}`);
    console.log(
      s3Enabled()
        ? `Media uploads: S3 bucket ${env.s3.bucket} (${env.s3.region})`
        : 'Media uploads: local disk (set S3_BUCKET + AWS_REGION to use S3)'
    );
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
