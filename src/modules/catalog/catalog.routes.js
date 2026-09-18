const express = require('express');
const controller = require('./catalog.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { boardSchema, classLevelSchema } = require('./catalog.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/boards', controller.boards);
router.get('/class-levels', controller.classLevels);
router.post('/boards', authenticate, authorize(ROLES.ADMIN), validate(boardSchema), controller.createBoard);
router.patch('/boards/:id', authenticate, authorize(ROLES.ADMIN), controller.updateBoard);
router.post(
  '/class-levels',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(classLevelSchema),
  controller.createClassLevel
);
router.patch('/class-levels/:id', authenticate, authorize(ROLES.ADMIN), controller.updateClassLevel);

module.exports = router;
