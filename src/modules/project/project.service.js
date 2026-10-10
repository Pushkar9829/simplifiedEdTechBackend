const Project = require('./project.model');
const paymentRepo = require('../payment/payment.repo');
const parentRepo = require('../parent/parent.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const { storedFileUrl } = require('../../utils/mediaUrl');
const ApiError = require('../../common/ApiError');
const { PROJECT_STATUS, PAYMENT_STATUS, ROLES } = require('../../common/constants');
const { hideTutorContact, stripContact } = require('../../utils/tutorPrivacy');

const TRANSITIONS = {
  [PROJECT_STATUS.PROPOSED]: [PROJECT_STATUS.ACCEPTED, PROJECT_STATUS.CANCELLED],
  [PROJECT_STATUS.ACCEPTED]: [PROJECT_STATUS.IN_PROGRESS, PROJECT_STATUS.CANCELLED],
  [PROJECT_STATUS.IN_PROGRESS]: [PROJECT_STATUS.DELIVERED, PROJECT_STATUS.CANCELLED],
  [PROJECT_STATUS.DELIVERED]: [PROJECT_STATUS.COMPLETED, PROJECT_STATUS.IN_PROGRESS],
  [PROJECT_STATUS.COMPLETED]: [],
  [PROJECT_STATUS.CANCELLED]: [],
};

function filesFrom(list = []) {
  return list.map((f) => ({
    url: storedFileUrl(f),
    name: f.originalname || '',
    mimeType: f.mimetype || '',
  }));
}

function idOf(ref) {
  return (ref?._id || ref)?.toString();
}

async function assertCanView(user, project) {
  const studentId = idOf(project.studentUserId);
  const tutorId = idOf(project.tutorUserId);
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.TUTOR && user.id === tutorId) return;
  if (user.role === ROLES.STUDENT && user.id === studentId) return;
  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    if (link) return;
  }
  throw new ApiError(403, 'Not allowed');
}

async function list(user, query) {
  const filter = {};
  if (user.role === ROLES.TUTOR) filter.tutorUserId = user.id;
  if (user.role === ROLES.STUDENT) filter.studentUserId = user.id;
  if (user.role === ROLES.PARENT) {
    const ids = await parentRepo.listLinkedStudentIds(user.id);
    filter.studentUserId = { $in: ids };
  }
  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  const rows = await Project.find(filter)
    .populate('studentUserId', 'name phone')
    .populate('tutorUserId', 'name refCode')
    .populate('paymentId', 'status amount currency description')
    .sort({ deliveryDate: 1 });
  if (!hideTutorContact(user.role)) return rows;
  return rows.map((row) => {
    const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    if (next.tutorUserId) next.tutorUserId = stripContact(next.tutorUserId);
    return next;
  });
}

async function getById(user, id) {
  const project = await Project.findById(id)
    .populate('studentUserId', 'name phone')
    .populate('tutorUserId', 'name refCode')
    .populate('paymentId', 'status amount currency description');
  if (!project) throw new ApiError(404, 'Project not found');
  await assertCanView(user, project);
  if (!hideTutorContact(user.role)) return project;
  const next = typeof project.toObject === 'function' ? project.toObject() : { ...project };
  if (next.tutorUserId) next.tutorUserId = stripContact(next.tutorUserId);
  return next;
}

async function create(tutorUserId, body, files = []) {
  if (!(Number(body.price) > 0)) {
    throw new ApiError(400, 'Set the fee the student will pay you');
  }
  const openToJoin = body.openToJoin === true || body.openToJoin === 'true' || !body.studentUserId;
  const project = await Project.create({
    ...body,
    studentUserId: body.studentUserId || undefined,
    subjectId: body.subjectId || undefined,
    openToJoin,
    tutorUserId,
    attachments: filesFrom(files),
    status: PROJECT_STATUS.PROPOSED,
  });
  if (body.studentUserId) {
    await notificationService.notify(
      body.studentUserId,
      'New project fee',
      `${body.name} · your tutor charged a fee. Accept and pay to start. Students are not paid.`,
      'project',
      { projectId: project._id }
    );
  }
  return project;
}

async function listOpen(user, query = {}) {
  const filter = { openToJoin: true };
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.kind) filter.kind = query.kind;
  if (query.paid === 'free') filter.price = 0;
  if (query.paid === 'paid') filter.price = { $gt: 0 };
  if (query.minPrice) filter.price = { ...(typeof filter.price === 'object' ? filter.price : {}), $gte: Number(query.minPrice) };
  if (query.maxPrice) filter.price = { ...(typeof filter.price === 'object' ? filter.price : {}), $lte: Number(query.maxPrice) };
  if (query.search) {
    const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(escaped, 'i') }, { description: new RegExp(escaped, 'i') }];
  }
  const FavoriteItem = require('../favorite/favorite.model');
  if (query.favorites === 'true' && user?.id) {
    const favs = await FavoriteItem.find({ userId: user.id, kind: 'project' }).select('targetId');
    filter._id = { $in: favs.map((f) => f.targetId) };
    if (!favs.length) return [];
  }
  const rows = await Project.find(filter)
    .populate('tutorUserId', 'name refCode')
    .populate('subjectId', 'name category')
    .sort({ deliveryDate: 1 });
  const favIds = user?.id
    ? new Set(
        (await FavoriteItem.find({ userId: user.id, kind: 'project' }).select('targetId')).map((f) =>
          String(f.targetId)
        )
      )
    : new Set();
  return rows.map((row) => {
    const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    if (next.tutorUserId && hideTutorContact(user?.role)) next.tutorUserId = stripContact(next.tutorUserId);
    next.favorite = favIds.has(String(next._id));
    return next;
  });
}

async function join(user, id, studentUserId) {
  const source = await Project.findById(id);
  if (!source || !source.openToJoin) throw new ApiError(404, 'Project is not open to join');
  const sid = user.role === ROLES.STUDENT ? user.id : studentUserId;
  if (!sid) throw new ApiError(400, 'studentUserId is required');
  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, sid);
    if (!link) throw new ApiError(403, 'Student not linked to this parent');
  } else if (user.role !== ROLES.STUDENT) {
    throw new ApiError(403, 'Not allowed');
  }
  const existing = await Project.findOne({ sourceProjectId: source._id, studentUserId: sid });
  if (existing) return getById(user, existing._id);

  const clone = await Project.create({
    tutorUserId: source.tutorUserId,
    studentUserId: sid,
    subjectId: source.subjectId,
    openToJoin: false,
    sourceProjectId: source._id,
    kind: source.kind,
    name: source.name,
    description: source.description,
    status: PROJECT_STATUS.PROPOSED,
    price: source.price,
    currency: source.currency,
    deliveryDate: source.deliveryDate,
    attachments: source.attachments,
  });

  if (Number(clone.price) > 0) {
    const payment = await paymentRepo.createPayment({
      payerUserId: sid,
      beneficiaryUserId: clone.tutorUserId,
      projectId: clone._id,
      amount: clone.price,
      currency: clone.currency,
      method: 'manual',
      status: PAYMENT_STATUS.PENDING,
      description: `Project fee: ${clone.name}`,
    });
    clone.paymentId = payment._id;
    await clone.save();
    await notificationService.notify(
      sid,
      'Project fee due',
      `Pay ${clone.name} so your tutor can start. Students do not get paid for projects.`,
      'payment',
      { paymentId: payment._id, projectId: clone._id }
    );
  }
  await notificationService.notify(
    clone.tutorUserId,
    'Student joined project',
    `A student joined ${clone.name}.`,
    'project',
    { projectId: clone._id }
  );
  const row = await getById(user, clone._id);
  const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
  next.payNow = Number(clone.price) > 0;
  return next;
}

async function setStatus(user, id, status) {
  const project = await getById(user, id);
  const allowed = TRANSITIONS[project.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot move from ${project.status} to ${status}`);
  }
  if (status === PROJECT_STATUS.ACCEPTED && user.role !== ROLES.STUDENT && user.role !== ROLES.PARENT) {
    throw new ApiError(403, 'Only the student or parent can accept a project');
  }
  if (status === PROJECT_STATUS.DELIVERED && user.role !== ROLES.TUTOR) {
    throw new ApiError(403, 'Only the tutor can mark delivery');
  }
  if (status === PROJECT_STATUS.COMPLETED && user.role === ROLES.TUTOR) {
    throw new ApiError(403, 'The student or parent confirms completion');
  }

  if (status === PROJECT_STATUS.ACCEPTED && Number(project.price) > 0) {
    let payment = project.paymentId
      ? await paymentRepo.findPaymentById(idOf(project.paymentId))
      : null;
    if (!payment) {
      payment = await paymentRepo.createPayment({
        payerUserId: idOf(project.studentUserId),
        beneficiaryUserId: idOf(project.tutorUserId),
        projectId: project._id,
        amount: project.price,
        currency: project.currency,
        method: 'manual',
        status: PAYMENT_STATUS.PENDING,
        description: `Project fee: ${project.name}`,
      });
      await Project.findByIdAndUpdate(id, { paymentId: payment._id });
    }
    if (payment.status !== PAYMENT_STATUS.PAID) {
      const studentId = idOf(project.studentUserId);
      await notificationService.notify(
        studentId,
        'Project fee due',
        `Pay ${project.name} so your tutor can start. Students do not get paid for projects.`,
        'payment',
        { paymentId: payment._id, projectId: id }
      );
      await notifyParentsOfStudent(
        studentId,
        'Project fee due',
        `Pay the tutor fee for ${project.name}. The tutor charges the student; the student is not paid.`,
        'payment',
        { paymentId: payment._id, projectId: id }
      );
      const pending = await getById(user, id);
      const row = typeof pending.toObject === 'function' ? pending.toObject() : { ...pending };
      row.payNow = true;
      return row;
    }
  }

  const patch = { status };
  const updated = await Project.findByIdAndUpdate(id, patch, { returnDocument: 'after' });
  if (status === PROJECT_STATUS.CANCELLED && project.paymentId) {
    const { Payment } = require('../payment/payment.model');
    await Payment.updateMany(
      { _id: idOf(project.paymentId), status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] } },
      { status: PAYMENT_STATUS.CANCELLED }
    );
  }
  await notificationService.notify(
    user.role === ROLES.TUTOR ? idOf(project.studentUserId) : idOf(project.tutorUserId),
    'Project update',
    `${project.name} is now ${status.replace('_', ' ')}`,
    'project',
    { projectId: id }
  );
  return updated;
}

async function update(tutorUserId, id, body) {
  const project = await Project.findById(id);
  if (!project || project.tutorUserId.toString() !== tutorUserId) {
    throw new ApiError(404, 'Project not found');
  }
  if (![PROJECT_STATUS.PROPOSED, PROJECT_STATUS.ACCEPTED].includes(project.status)) {
    throw new ApiError(400, 'Only open projects can be edited');
  }
  if (body.price !== undefined && !(Number(body.price) > 0)) {
    throw new ApiError(400, 'Set the fee the student will pay you');
  }
  const priceChanged =
    (body.price !== undefined && Number(body.price) !== Number(project.price)) ||
    (body.currency !== undefined && body.currency !== project.currency);
  let invoice = null;
  if (priceChanged && project.paymentId) {
    invoice = await paymentRepo.findPaymentById(idOf(project.paymentId));
    if (invoice && ![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED].includes(invoice.status)) {
      throw new ApiError(400, 'The fee is already paid or being confirmed; it can no longer change');
    }
  }
  const allowed = ['name', 'description', 'kind', 'price', 'currency', 'deliveryDate', 'openToJoin', 'subjectId'];
  allowed.forEach((key) => {
    if (body[key] !== undefined) project[key] = body[key];
  });
  await project.save();
  // Keep the open invoice in step with the new fee.
  if (invoice) {
    await paymentRepo.updatePayment(invoice._id, { amount: project.price, currency: project.currency });
  }
  return project;
}

async function deliver(tutorUserId, id, files = []) {
  const project = await Project.findById(id);
  if (!project || project.tutorUserId.toString() !== tutorUserId) {
    throw new ApiError(404, 'Project not found');
  }
  if (![PROJECT_STATUS.ACCEPTED, PROJECT_STATUS.IN_PROGRESS, PROJECT_STATUS.DELIVERED].includes(project.status)) {
    throw new ApiError(400, 'Project is not in a deliverable state');
  }
  project.deliverables.push(...filesFrom(files));
  project.status = PROJECT_STATUS.DELIVERED;
  await project.save();
  await notificationService.notify(
    project.studentUserId,
    'Project delivered',
    `${project.name} is ready for review`,
    'project',
    { projectId: id }
  );
  return project;
}

async function acceptPaid(paymentId) {
  // Only a still-proposed project starts on payment; never revive a cancelled or later-stage one.
  const project = await Project.findOneAndUpdate(
    { paymentId, status: PROJECT_STATUS.PROPOSED },
    { status: PROJECT_STATUS.ACCEPTED },
    { returnDocument: 'after' }
  );
  if (project) {
    await notificationService.notify(
      project.tutorUserId,
      'Project fee paid',
      `${project.name} is paid. You can start the work.`,
      'project',
      { projectId: project._id }
    );
  }
  return project;
}

module.exports = { list, listOpen, join, getById, create, update, setStatus, deliver, acceptPaid };
