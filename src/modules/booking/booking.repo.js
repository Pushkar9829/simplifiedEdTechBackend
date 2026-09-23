const Booking = require('./booking.model');

async function create(data) {
  return Booking.create(data);
}

async function createMany(docs) {
  return Booking.insertMany(docs);
}

async function findById(id) {
  return Booking.findById(id)
    .populate('subjectId')
    .populate('studentUserId', 'name phone role')
    .populate('tutorUserId', 'name phone role');
}

async function updateById(id, data) {
  return Booking.findByIdAndUpdate(id, data, { new: true });
}

async function findOverlap(tutorUserId, startAt, endAt, excludeId = null) {
  const q = {
    tutorUserId,
    status: { $nin: ['cancelled'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };
  if (excludeId) q._id = { $ne: excludeId };
  return Booking.findOne(q);
}

async function list(filter, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate('subjectId')
      .populate('studentUserId', 'name phone role')
      .populate('tutorUserId', 'name phone role')
      .sort({ startAt: 1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function countByStatus() {
  return Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
}

module.exports = {
  create,
  createMany,
  findById,
  updateById,
  findOverlap,
  list,
  countByStatus,
};
