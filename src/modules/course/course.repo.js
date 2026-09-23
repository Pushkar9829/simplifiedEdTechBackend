const { Course, CourseEnrollment } = require('./course.model');

const populate = [
  { path: 'subjectId', select: 'name' },
  { path: 'countryId', select: 'name code currency' },
  { path: 'lessonPlanIds', select: 'title status objectives' },
  { path: 'tutorUserId', select: 'name' },
];

module.exports = {
  create: (data) => Course.create(data),
  updateById: (id, data) => Course.findByIdAndUpdate(id, data, { new: true }).populate(populate),
  findById: (id) => Course.findById(id).populate(populate),
  list: (filter) => Course.find(filter).populate(populate).sort({ updatedAt: -1 }),
  remove: (id, tutorUserId) => Course.findOneAndDelete({ _id: id, tutorUserId }),
  findEnrollment: (courseId, studentUserId) => CourseEnrollment.findOne({ courseId, studentUserId }),
  upsertEnrollment: (data) =>
    CourseEnrollment.findOneAndUpdate(
      { courseId: data.courseId, studentUserId: data.studentUserId },
      data,
      { upsert: true, new: true }
    ),
  listEnrollments: (filter) =>
    CourseEnrollment.find(filter)
      .populate({ path: 'courseId', populate })
      .populate('studentUserId', 'name')
      .sort({ createdAt: -1 }),
  activateByPayment: (paymentId) =>
    CourseEnrollment.findOneAndUpdate({ paymentId }, { status: 'active' }, { new: true }),
};
