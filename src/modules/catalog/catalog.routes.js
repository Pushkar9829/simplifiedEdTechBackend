const express = require('express');
const controller = require('./catalog.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { countrySchema, boardSchema, classLevelSchema } = require('./catalog.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];

router.get('/countries', controller.countries);
router.get('/currencies', controller.currencies);
router.post('/countries', ...adminOnly, validate(countrySchema), controller.createCountry);
router.patch('/countries/:id', ...adminOnly, controller.updateCountry);

router.get('/boards', controller.boards);
router.get('/class-levels', controller.classLevels);
router.post('/boards', ...adminOnly, validate(boardSchema), controller.createBoard);
router.patch('/boards/:id', ...adminOnly, controller.updateBoard);
router.post('/class-levels', ...adminOnly, validate(classLevelSchema), controller.createClassLevel);
router.patch('/class-levels/:id', ...adminOnly, controller.updateClassLevel);

module.exports = router;
