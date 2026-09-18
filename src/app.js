const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const subjectRoutes = require('./modules/subject/subject.routes');
const tutorRoutes = require('./modules/tutor/tutor.routes');
const bookingRoutes = require('./modules/booking/booking.routes');
const resourceRoutes = require('./modules/resource/resource.routes');
const homeworkRoutes = require('./modules/homework/homework.routes');
const progressRoutes = require('./modules/progress/progress.routes');
const parentRoutes = require('./modules/parent/parent.routes');
const messageRoutes = require('./modules/message/message.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const cmsRoutes = require('./modules/cms/cms.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const studentRoutes = require('./modules/student/student.routes');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'IBDP Tutoring API is healthy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/wallets', walletRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
