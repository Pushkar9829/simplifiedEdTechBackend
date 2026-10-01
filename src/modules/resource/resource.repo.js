const {
  Resource,
  ResourceBookmark,
  ResourcePurchase,
  ResourceSuggestion,
  ResourceReview,
} = require('./resource.model');

async function create(data) {
  return Resource.create(data);
}

async function updateById(id, data) {
  return Resource.findByIdAndUpdate(id, data, { new: true });
}

async function findById(id) {
  return Resource.findById(id).populate('subjectId');
}

async function list(filter, options = {}) {
  const { page = 1, limit = 20, search } = options;
  const q = { ...filter };
  if (search) q.$text = { $search: search };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Resource.find(q).populate('subjectId').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Resource.countDocuments(q),
  ]);
  return { items, total, page, limit };
}

async function bookmark(userId, resourceId) {
  return ResourceBookmark.findOneAndUpdate(
    { userId, resourceId },
    { userId, resourceId },
    { upsert: true, new: true }
  );
}

async function unbookmark(userId, resourceId) {
  return ResourceBookmark.findOneAndDelete({ userId, resourceId });
}

async function listBookmarks(userId) {
  return ResourceBookmark.find({ userId }).populate({
    path: 'resourceId',
    populate: { path: 'subjectId' },
  });
}

async function deleteById(id) {
  await ResourceBookmark.deleteMany({ resourceId: id });
  await ResourcePurchase.deleteMany({ resourceId: id });
  await ResourceSuggestion.deleteMany({ resourceId: id });
  return Resource.findByIdAndDelete(id);
}

async function addSuggestion(data) {
  return ResourceSuggestion.create(data);
}

async function listSuggestions(resourceId) {
  return ResourceSuggestion.find({ resourceId })
    .populate('userId', 'name refCode')
    .sort({ createdAt: -1 });
}

async function listSuggestionsFor(resourceIds) {
  if (!resourceIds?.length) return [];
  return ResourceSuggestion.find({ resourceId: { $in: resourceIds } })
    .populate('userId', 'name refCode')
    .sort({ createdAt: -1 });
}

async function findPurchase(userId, resourceId) {
  return ResourcePurchase.findOne({ userId, resourceId });
}

async function upsertPurchase(data) {
  return ResourcePurchase.findOneAndUpdate(
    { userId: data.userId, resourceId: data.resourceId },
    data,
    { upsert: true, new: true }
  );
}

async function listPurchases(userId) {
  return ResourcePurchase.find({ userId }).select('resourceId');
}

module.exports = {
  create,
  updateById,
  findById,
  list,
  bookmark,
  unbookmark,
  listBookmarks,
  deleteById,
  findPurchase,
  upsertPurchase,
  listPurchases,
  addSuggestion,
  listSuggestions,
  listSuggestionsFor,
  upsertReview: (data) =>
    ResourceReview.findOneAndUpdate(
      { resourceId: data.resourceId, userId: data.userId },
      data,
      { upsert: true, returnDocument: 'after' }
    ),
  listReviewsFor: (resourceIds) =>
    resourceIds?.length
      ? ResourceReview.find({ resourceId: { $in: resourceIds } })
          .populate('userId', 'name refCode')
          .sort({ createdAt: -1 })
      : [],
};
