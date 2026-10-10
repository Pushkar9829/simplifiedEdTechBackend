const ApiError = require('../common/ApiError');

// Mongoose/BSON input errors are client mistakes (bad id, bad field), not server faults.
function fromMongoose(err) {
  if (err.name === 'CastError' || err.name === 'BSONError') {
    return new ApiError(400, `Invalid value for ${err.path || 'id'}`);
  }
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(400, 'Validation failed', errors);
  }
  if (err.code === 11000) {
    return new ApiError(409, 'Duplicate value');
  }
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'Malformed JSON body');
  }
  if (err.name === 'MulterError') {
    return new ApiError(400, err.message);
  }
  return err;
}

function errorHandler(rawErr, _req, res, _next) {
  const err = rawErr.isOperational ? rawErr : fromMongoose(rawErr);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const errors = Array.isArray(err.errors) ? err.errors : [];

  if (statusCode >= 500) {
    console.error(rawErr);
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
