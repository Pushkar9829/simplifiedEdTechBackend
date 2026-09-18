const cmsRepo = require('./cms.repo');
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
  if (query.activeOnly !== 'false') filter.isActive = true;
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

async function createTicket(userId, body) {
  return cmsRepo.createTicket({ ...body, userId });
}

async function updateTicket(id, body) {
  const item = await cmsRepo.updateTicket(id, body);
  if (!item) throw new ApiError(404, 'Ticket not found');
  return item;
}

async function listTickets(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return cmsRepo.listTickets(filter);
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  listAnnouncements,
  setConfig,
  listConfigs,
  createCampaign,
  updateCampaign,
  listCampaigns,
  createTicket,
  updateTicket,
  listTickets,
};
