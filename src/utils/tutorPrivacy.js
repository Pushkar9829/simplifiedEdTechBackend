function toPlain(doc) {
  if (!doc) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  if (doc._doc) return { ...doc._doc };
  return { ...doc };
}

function stripContact(user) {
  if (!user) return user;
  const o = toPlain(user);
  delete o.phone;
  delete o.email;
  delete o.googleId;
  return o;
}

function hideTutorContact(role) {
  return role === 'student' || role === 'parent';
}

function sanitizeTutorPayload(data, role) {
  if (!data || !hideTutorContact(role)) return data;
  const next = { ...data };
  if (next.profile?.userId) {
    next.profile = { ...toPlain(next.profile), userId: stripContact(next.profile.userId) };
  }
  if (next.verification) {
    next.verification = {
      _id: next.verification._id,
      status: next.verification.status,
      reviewedAt: next.verification.reviewedAt,
    };
  }
  return next;
}

function sanitizeTutorSearchItems(items, role) {
  if (!hideTutorContact(role)) return items;
  return (items || []).map((item) => {
    const profile = toPlain(item.profile);
    if (profile?.userId) profile.userId = stripContact(profile.userId);
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
