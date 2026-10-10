const Subject = require('./subject.model');
const { escapeRegex } = require('../../utils/regex');

async function create(data) {
  return Subject.create(data);
}

async function updateById(id, data) {
  return Subject.findByIdAndUpdate(id, data, { new: true });
}

async function findById(id) {
  return Subject.findById(id);
}

async function list(filter = {}, options = {}) {
  const { search } = options;
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  const limit = Math.min(500, Math.max(1, Math.floor(Number(options.limit)) || 100));
  const q = { ...filter };
  if (search) q.name = new RegExp(escapeRegex(search), 'i');
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Subject.find(q).sort({ name: 1 }).skip(skip).limit(limit),
    Subject.countDocuments(q),
  ]);
  return { items, total, page, limit };
}

async function insertMany(docs) {
  return Subject.insertMany(docs, { ordered: false });
}

async function deleteById(id) {
  return Subject.findByIdAndDelete(id);
}

module.exports = { create, updateById, findById, list, insertMany, deleteById };
