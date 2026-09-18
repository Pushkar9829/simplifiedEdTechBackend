const ParentStudentLink = require('../modules/parent/parent.model');
const notificationService = require('../modules/notification/notification.service');

async function notifyParentsOfStudent(studentUserId, title, body, type = 'academic', meta = {}) {
  const links = await ParentStudentLink.find({
    studentUserId,
    status: 'active',
  }).select('parentUserId');

  if (!links.length) return [];

  return notificationService.notifyMany(
    links.map((link) => ({
      userId: link.parentUserId,
      title,
      body,
      type,
      meta: { ...meta, studentUserId: String(studentUserId) },
    }))
  );
}

module.exports = { notifyParentsOfStudent };
