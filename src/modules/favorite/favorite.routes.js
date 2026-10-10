const express = require('express');
const controller = require('./favorite.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { addFavoriteSchema } = require('./favorite.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, authorize(ROLES.STUDENT, ROLES.PARENT), controller.list);
router.post(
  '/',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(addFavoriteSchema),
  controller.add
);
router.delete(
  '/:kind/:targetId',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  controller.remove
);

module.exports = router;
