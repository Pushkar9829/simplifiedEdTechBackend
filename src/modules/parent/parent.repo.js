const ParentStudentLink = require('./parent.model');

async function link(data) {
  return ParentStudentLink.findOneAndUpdate(
    { parentUserId: data.parentUserId, studentUserId: data.studentUserId },
    data,
    { upsert: true, new: true }
  );
}

async function listLinks(parentUserId) {
  return ParentStudentLink.find({ parentUserId, status: 'active' }).populate(
    'studentUserId',
    'name phone'
  );
}

async function findLink(parentUserId, studentUserId) {
  return ParentStudentLink.findOne({ parentUserId, studentUserId, status: 'active' });
}

async function listLinkedStudentIds(parentUserId) {
  const links = await ParentStudentLink.find({ parentUserId, status: 'active' }).select(
    'studentUserId'
  );
  return links.map((l) => l.studentUserId);
}

module.exports = { link, listLinks, findLink, listLinkedStudentIds };
