const Subject = require('./subject.model');

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
  const { page = 1, limit = 100, search } = options;
  const q = { ...filter };
  if (search) q.name = new RegExp(search, 'i');
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

module.exports = { create, updateById, findById, list, insertMany };
