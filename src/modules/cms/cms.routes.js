const express = require('express');
const controller = require('./cms.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/announcements', authenticate, controller.listAnnouncements);
router.post(
  '/announcements',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.createAnnouncement
);
router.patch(
  '/announcements/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.updateAnnouncement
);

router.get('/configs', authenticate, authorize(ROLES.ADMIN), controller.listConfigs);
router.post('/configs', authenticate, authorize(ROLES.ADMIN), controller.setConfig);

router.get('/campaigns', authenticate, authorize(ROLES.ADMIN), controller.listCampaigns);
router.post('/campaigns', authenticate, authorize(ROLES.ADMIN), controller.createCampaign);
router.patch('/campaigns/:id', authenticate, authorize(ROLES.ADMIN), controller.updateCampaign);

router.post('/tickets', authenticate, controller.createTicket);
router.get('/tickets', authenticate, authorize(ROLES.ADMIN), controller.listTickets);
router.patch('/tickets/:id', authenticate, authorize(ROLES.ADMIN), controller.updateTicket);

module.exports = router;
