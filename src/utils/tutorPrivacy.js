function toPlain(doc) {
  if (!doc) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  if (doc._doc) return { ...doc._doc };
  return { ...doc };
}

const { publicRef } = require('./refCode');

function stripContact(user) {
  if (!user) return user;
  const o = toPlain(user);
  o.refCode = publicRef(o);
  delete o.name;
  delete o.phone;
  delete o.email;
  delete o.googleId;
  return o;
}

function hideTutorContact(role) {
  return role === 'student' || role === 'parent';
}

function stripSensitiveProfile(profile) {
  if (!profile) return profile;
  const o = toPlain(profile);
  delete o.identity;
  delete o.gst;
  delete o.emergencyContact;
  delete o.addresses;
  delete o.currentAddress;
  delete o.permanentAddress;
  delete o.dateOfBirth;
  delete o.whatsappNumber;
  return o;
}

function sanitizeTutorPayload(data, role, viewerId) {
  if (!data) return data;
  const next = { ...data };
  if (next.profile) next.profile = stripSensitiveProfile(next.profile);
  const ownerId = next.profile?.userId?._id || next.profile?.userId;
  const isOwner = viewerId && ownerId && String(viewerId) === String(ownerId);
  if (next.verification && role !== 'admin' && !isOwner) {
    next.verification = {
      _id: next.verification._id,
      status: next.verification.status,
      reviewedAt: next.verification.reviewedAt,
    };
  }
  if (!hideTutorContact(role)) return next;
  if (next.profile?.userId) {
    next.profile = { ...toPlain(next.profile), userId: stripContact(next.profile.userId) };
  }
  return next;
}

function sanitizeTutorSearchItems(items, role) {
  return (items || []).map((item) => {
    const profile = stripSensitiveProfile(item.profile);
    if (hideTutorContact(role) && profile?.userId) profile.userId = stripContact(profile.userId);
    return { ...item, profile };
  });
}

function sanitizeBookingItems(items, role) {
  if (!hideTutorContact(role) || !items) return items;
  return items.map((b) => {
    const row = toPlain(b);
    if (row.tutorUserId) row.tutorUserId = stripContact(row.tutorUserId);
    return row;
  });
}

function sanitizeAssignment(assignment, role) {
  if (!assignment || !hideTutorContact(role)) return assignment;
  const row = toPlain(assignment);
  if (row.tutorUserId) row.tutorUserId = stripContact(row.tutorUserId);
  return row;
}

module.exports = {
  stripContact,
  hideTutorContact,
  sanitizeTutorPayload,
  sanitizeTutorSearchItems,
  sanitizeBookingItems,
  sanitizeAssignment,
};
