const cmsService = require('./cms.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const listAnnouncements = asyncHandler(async (req, res) => {
  const data = await cmsService.listAnnouncements(req.query, req.user?.role);
  return success(res, data);
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const data = await cmsService.createAnnouncement(req.user.id, req.body);
  return created(res, data);
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  const data = await cmsService.updateAnnouncement(req.params.id, req.body);
  return success(res, data);
});

const listConfigs = asyncHandler(async (_req, res) => {
  const data = await cmsService.listConfigs();
  return success(res, data);
});

const setConfig = asyncHandler(async (req, res) => {
  const data = await cmsService.setConfig(req.body);
  return success(res, data, 'Config saved');
});

const listCampaigns = asyncHandler(async (_req, res) => {
  const data = await cmsService.listCampaigns();
  return success(res, data);
});

const createCampaign = asyncHandler(async (req, res) => {
  const data = await cmsService.createCampaign(req.user.id, req.body);
  return created(res, data);
});

const updateCampaign = asyncHandler(async (req, res) => {
  const data = await cmsService.updateCampaign(req.params.id, req.body);
  return success(res, data);
});

const createTicket = asyncHandler(async (req, res) => {
  const data = await cmsService.createTicket(req.user.id, req.body);
  return created(res, data, 'Ticket created');
});

const listTickets = asyncHandler(async (req, res) => {
  const data = await cmsService.listTickets(req.query);
  return success(res, data);
});

const updateTicket = asyncHandler(async (req, res) => {
  const data = await cmsService.updateTicket(req.params.id, req.body);
  return success(res, data);
});

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  listConfigs,
  setConfig,
  listCampaigns,
  createCampaign,
  updateCampaign,
  createTicket,
  listTickets,
  updateTicket,
};
