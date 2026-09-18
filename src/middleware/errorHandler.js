const ApiError = require('../common/ApiError');

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || [];

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.isOperational ? message : 'Internal server error',
    errors,
  });
}

function notFound(_req, _res, next) {
  next(new ApiError(404, 'Route not found'));
}

module.exports = { errorHandler, notFound };
