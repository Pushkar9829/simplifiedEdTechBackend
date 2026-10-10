const cmsRepo = require('./cms.repo');
const notificationService = require('../notification/notification.service');
const ApiError = require('../../common/ApiError');

async function createAnnouncement(userId, body) {
  return cmsRepo.createAnnouncement({ ...body, createdBy: userId });
}

async function updateAnnouncement(id, body) {
  const item = await cmsRepo.updateAnnouncement(id, body);
  if (!item) throw new ApiError(404, 'Announcement not found');
  return item;
}

async function listAnnouncements(query, role) {
  const filter = {};
  if (query.activeOnly !== 'false' || role !== 'admin') filter.isActive = true;
  if (role && role !== 'admin') {
    filter.audience = { $in: ['all', role] };
  }
  return cmsRepo.listAnnouncements(filter);
}

async function setConfig(body) {
  return cmsRepo.setConfig(body.key, body.value, body.description || '');
}

async function listConfigs() {
  return cmsRepo.listConfigs();
}

async function deleteConfig(key) {
  const item = await cmsRepo.deleteConfig(key);
  if (!item) throw new ApiError(404, 'Config not found');
  return item;
}

async function createCampaign(userId, body) {
  return cmsRepo.createCampaign({ ...body, createdBy: userId });
}

async function updateCampaign(id, body) {
  const item = await cmsRepo.updateCampaign(id, body);
  if (!item) throw new ApiError(404, 'Campaign metric not found');
  return item;
}

async function listCampaigns() {
  return cmsRepo.listCampaigns();
}

async function createTicket(userId, body = {}) {
  const subject = String(body.subject || '').trim();
  const description = String(body.description || '').trim();
  if (!subject || !description) {
    throw new ApiError(400, 'Subject and description are required');
  }
  const data = { userId, subject, description };
  if (body.category) data.category = String(body.category).trim();
  return cmsRepo.createTicket(data);
}

async function updateTicket(id, body = {}) {
  const existing = await cmsRepo.findTicketById(id);
  if (!existing) throw new ApiError(404, 'Ticket not found');
  const patch = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.adminNote !== undefined) patch.adminNote = String(body.adminNote);
  const item = await cmsRepo.updateTicket(id, patch);
  if (!item) throw new ApiError(404, 'Ticket not found');
  if (patch.status && patch.status !== existing.status) {
    await notificationService.notify(
      existing.userId,
      'Support ticket updated',
      `Your ticket is now ${item.status}`,
      'support',
      { ticketId: item._id }
    );
  }
  return item;
}

async function listTickets(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return cmsRepo.listTickets(filter);
}

async function listMyTickets(userId, query = {}) {
  const filter = { userId };
  if (query.status) filter.status = query.status;
  return cmsRepo.listTickets(filter);
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  listAnnouncements,
  setConfig,
  listConfigs,
  deleteConfig,
  createCampaign,
  updateCampaign,
  listCampaigns,
  createTicket,
  updateTicket,
  listTickets,
  listMyTickets,
};
