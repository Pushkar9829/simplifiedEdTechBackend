const resourceRepo = require('./resource.repo');
const paymentRepo = require('../payment/payment.repo');
const ApiError = require('../../common/ApiError');
const { storedFileUrl } = require('../../utils/mediaUrl');
const { RESOURCE_ACCESS, PAYMENT_STATUS, ROLES } = require('../../common/constants');

function canSeeFile(resource, user, purchased) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (resource.createdBy && resource.createdBy.toString() === user.id) return true;
  if (resource.accessType !== RESOURCE_ACCESS.PAID) return true;
  return Boolean(purchased);
}

function downloadOpen(resource) {
  if (resource.isDownloadable === false) return false;
  if (resource.downloadableUntil && new Date(resource.downloadableUntil) < new Date()) return false;
  return true;
}

function shape(resource, user, purchasedIds) {
  const row = typeof resource.toObject === 'function' ? resource.toObject() : { ...resource };
  const purchased = purchasedIds?.has(row._id.toString());
  row.purchased = Boolean(purchased);
  row.downloadOpen = downloadOpen(row);
  if (!canSeeFile(row, user, purchased)) row.fileUrl = '';
  return row;
}

async function purchasedSet(user) {
  if (!user || user.role === ROLES.ADMIN) return new Set();
  const rows = await resourceRepo.listPurchases(user.id);
  return new Set(rows.map((r) => r.resourceId.toString()));
}

async function list(query, user) {
  const filter = {};
  if (query.includeInactive !== 'true') filter.isActive = true;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.level) filter.level = query.level;
  if (query.type) filter.type = query.type;
  if (query.topic) filter.topic = new RegExp(query.topic, 'i');
  if (query.chapter) filter.chapter = new RegExp(query.chapter, 'i');
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.createdBy) filter.createdBy = query.createdBy;
  if (query.accessType) filter.accessType = query.accessType;

  const page = await resourceRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
    search: query.search,
  });
  const bought = await purchasedSet(user);
  const items = page.items.map((item) => shape(item, user, bought));
  const suggestions = await resourceRepo.listSuggestionsFor(items.map((i) => i._id));
  const byResource = {};
  for (const s of suggestions) {
    const key = String(s.resourceId);
    if (!byResource[key]) byResource[key] = [];
    byResource[key].push(s);
  }
  const reviews = await resourceRepo.listReviewsFor(items.map((i) => i._id));
  const reviewsBy = {};
  for (const r of reviews) {
    const key = String(r.resourceId);
    if (!reviewsBy[key]) reviewsBy[key] = [];
    reviewsBy[key].push(r);
  }
  items.forEach((item) => {
    item.suggestions = byResource[String(item._id)] || [];
    item.reviews = reviewsBy[String(item._id)] || [];
  });
  return { ...page, items };
}

async function getById(id, user) {
  const item = await resourceRepo.findById(id);
  if (!item) throw new ApiError(404, 'Resource not found');
  const bought = await purchasedSet(user);
  return shape(item, user, bought);
}

async function create(userId, body, file) {
  const fileUrl = storedFileUrl(file) || body.fileUrl || '';
  return resourceRepo.create({
    ...body,
    fileUrl,
    createdBy: userId,
    downloadableUntil: body.downloadableUntil || undefined,
    accessType: body.accessType || RESOURCE_ACCESS.FREE,
    isDownloadable: body.isDownloadable !== false && body.isDownloadable !== 'false',
    price: body.accessType === RESOURCE_ACCESS.PAID ? Number(body.price || 0) : 0,
  });
}

async function update(id, body, user, file) {
  const existing = await resourceRepo.findById(id);
  if (!existing) throw new ApiError(404, 'Resource not found');
  if (user.role !== ROLES.ADMIN && existing.createdBy?.toString() !== user.id) {
    throw new ApiError(403, 'Not allowed');
  }
  const patch = { ...body };
  if (file) patch.fileUrl = storedFileUrl(file);
  if (patch.downloadableUntil === '') patch.downloadableUntil = undefined;
  if (patch.isDownloadable === 'false') patch.isDownloadable = false;
  if (patch.isDownloadable === 'true') patch.isDownloadable = true;
  if (patch.accessType === RESOURCE_ACCESS.FREE) patch.price = 0;
  return resourceRepo.updateById(id, patch);
}

async function remove(id, user) {
  const existing = await resourceRepo.findById(id);
  if (!existing) throw new ApiError(404, 'Resource not found');
  if (user.role !== ROLES.ADMIN && existing.createdBy?.toString() !== user.id) {
    throw new ApiError(403, 'Not allowed');
  }
  return resourceRepo.deleteById(id);
}

async function bookmark(userId, resourceId) {
  return resourceRepo.bookmark(userId, resourceId);
}

async function unbookmark(userId, resourceId) {
  const item = await resourceRepo.unbookmark(userId, resourceId);
  if (!item) throw new ApiError(404, 'Bookmark not found');
  return item;
}

async function myBookmarks(userId) {
  return resourceRepo.listBookmarks(userId);
}

async function purchase(user, resourceId) {
  const resource = await resourceRepo.findById(resourceId);
  if (!resource) throw new ApiError(404, 'Resource not found');
  if (resource.accessType !== RESOURCE_ACCESS.PAID) {
    throw new ApiError(400, 'This resource is free');
  }
  const existing = await resourceRepo.findPurchase(user.id, resourceId);
  if (existing) throw new ApiError(400, 'Already purchased');
  const payment = await paymentRepo.createPayment({
    payerUserId: user.id,
    beneficiaryUserId: resource.createdBy,
    resourceId,
    amount: resource.price,
    currency: resource.currency,
    method: 'manual',
    status: PAYMENT_STATUS.PENDING,
    description: `Resource: ${resource.title}`,
  });
  return { payment };
}

async function recordPurchase(userId, resourceId, paymentId) {
  return resourceRepo.upsertPurchase({ userId, resourceId, paymentId });
}

async function download(user, id) {
  const resource = await resourceRepo.findById(id);
  if (!resource) throw new ApiError(404, 'Resource not found');
  const bought = await purchasedSet(user);
  if (!canSeeFile(resource, user, bought.has(resource._id.toString()))) {
    throw new ApiError(403, 'Purchase this resource to download it');
  }
  if (!downloadOpen(resource) && user.role !== ROLES.ADMIN && resource.createdBy?.toString() !== user.id) {
    throw new ApiError(403, 'The download window for this resource has ended');
  }
  if (!resource.fileUrl) throw new ApiError(404, 'No file attached');
  return { fileUrl: resource.fileUrl, title: resource.title };
}

async function suggestChange(user, resourceId, body) {
  const resource = await resourceRepo.findById(resourceId);
  if (!resource) throw new ApiError(404, 'Resource not found');
  const text = String(body.body || body.suggestion || '').trim();
  if (text.length < 8) throw new ApiError(400, 'Write a short note about the change');
  return resourceRepo.addSuggestion({
    resourceId,
    userId: user.id,
    body: text.slice(0, 2000),
  });
}

async function reviewResource(user, resourceId, body) {
  const resource = await resourceRepo.findById(resourceId);
  if (!resource) throw new ApiError(404, 'Resource not found');
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) throw new ApiError(400, 'Give a rating from 1 to 5');
  const review = await resourceRepo.upsertReview({
    resourceId,
    userId: user.id,
    rating,
    comment: String(body.comment || '').trim().slice(0, 2000),
  });
  const note = String(body.suggestion || body.body || '').trim();
  if (note.length >= 8) {
    await resourceRepo.addSuggestion({ resourceId, userId: user.id, body: note.slice(0, 2000) });
  }
  return review;
}

async function suggestions(resourceId) {
  const resource = await resourceRepo.findById(resourceId);
  if (!resource) throw new ApiError(404, 'Resource not found');
  return resourceRepo.listSuggestions(resourceId);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  bookmark,
  unbookmark,
  myBookmarks,
  purchase,
  recordPurchase,
  download,
  suggestChange,
  reviewResource,
  suggestions,
};
