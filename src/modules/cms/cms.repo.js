const {
  Announcement,
  PlatformConfig,
  CampaignMetric,
  SupportTicket,
} = require('./cms.model');

async function createAnnouncement(data) {
  return Announcement.create(data);
}

async function updateAnnouncement(id, data) {
  return Announcement.findByIdAndUpdate(id, data, { new: true });
}

async function listAnnouncements(filter = {}) {
  return Announcement.find(filter).sort({ createdAt: -1 });
}

async function setConfig(key, value, description = '') {
  return PlatformConfig.findOneAndUpdate(
    { key },
    { key, value, description },
    { upsert: true, new: true }
  );
}

async function getConfig(key) {
  return PlatformConfig.findOne({ key });
}

async function listConfigs() {
  return PlatformConfig.find().sort({ key: 1 });
}

async function createCampaign(data) {
  return CampaignMetric.create(data);
}

async function updateCampaign(id, data) {
  return CampaignMetric.findByIdAndUpdate(id, data, { new: true });
}

async function listCampaigns() {
  return CampaignMetric.find().sort({ createdAt: -1 });
}

async function createTicket(data) {
  return SupportTicket.create(data);
}

async function updateTicket(id, data) {
  return SupportTicket.findByIdAndUpdate(id, data, { new: true });
}

async function listTickets(filter = {}) {
  return SupportTicket.find(filter)
    .populate('userId', 'name phone role')
    .sort({ createdAt: -1 });
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  listAnnouncements,
  setConfig,
  getConfig,
  listConfigs,
  createCampaign,
  updateCampaign,
  listCampaigns,
  createTicket,
  updateTicket,
  listTickets,
};
