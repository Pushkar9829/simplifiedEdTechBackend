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
  const project = await Project.create({
    ...body,
    tutorUserId,
    attachments: filesFrom(files),
    status: PROJECT_STATUS.PROPOSED,
  });
  await notificationService.notify(
    body.studentUserId,
    'New project fee',
    `${body.name} · your tutor charged a fee. Accept and pay to start. Students are not paid.`,
    'project',
    { projectId: project._id }
  );
  return project;
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
  const allowed = ['name', 'description', 'kind', 'price', 'currency', 'deliveryDate'];
  allowed.forEach((key) => {
    if (body[key] !== undefined) project[key] = body[key];
  });
  await project.save();
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
  const project = await Project.findOneAndUpdate(
    { paymentId },
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

module.exports = { list, getById, create, update, setStatus, deliver, acceptPaid };
