const subjectRepo = require('./subject.repo');
const userRepo = require('../user/user.repo');
const mongoose = require('mongoose');
const ApiError = require('../../common/ApiError');
const Booking = require('../booking/booking.model');
const { TutorSubject } = require('../tutor/tutor.model');
const { Resource } = require('../resource/resource.model');

async function listSubjects(query) {
  const filter = {};
  if (query.includeInactive !== 'true') filter.isActive = true;
  if (query.category) filter.category = query.category;
  return subjectRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 100,
    search: query.search,
  });
}

async function createSubject(data) {
  return subjectRepo.create(data);
}

async function updateSubject(id, data) {
  const item = await subjectRepo.updateById(id, data);
  if (!item) throw new ApiError(404, 'Subject not found');
  return item;
}

async function selectSubjects(studentUserId, subjectIds) {
  const profile = await userRepo.updateStudentProfile(studentUserId, { subjectIds });
  return profile;
}

async function getSubject(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Subject not found');
  const item = await subjectRepo.findById(id);
  if (!item) throw new ApiError(404, 'Subject not found');
  return item;
}

async function deleteSubject(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Subject not found');
  const [bookings, offerings, resources] = await Promise.all([
    Booking.countDocuments({ subjectId: id }),
    TutorSubject.countDocuments({ subjectId: id }),
    Resource.countDocuments({ subjectId: id }),
  ]);
  if (bookings || offerings || resources) {
    const parts = [
      bookings && `${bookings} booking(s)`,
      offerings && `${offerings} tutor offering(s)`,
      resources && `${resources} resource(s)`,
    ].filter(Boolean);
    throw new ApiError(
      409,
      `Subject is in use by ${parts.join(', ')}. Deactivate it instead of deleting.`
    );
  }
  const item = await subjectRepo.deleteById(id);
  if (!item) throw new ApiError(404, 'Subject not found');
  return item;
}

module.exports = {
  getSubject,
  listSubjects,
  createSubject,
  updateSubject,
  selectSubjects,
  deleteSubject,
};
