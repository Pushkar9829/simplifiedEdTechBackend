const express = require('express');
const controller = require('./catalog.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { countrySchema, boardSchema, classLevelSchema, lookupSchema } = require('./catalog.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];

router.get('/lookups', controller.lookups);
router.post('/lookups', ...adminOnly, validate(lookupSchema), controller.createLookup);
router.patch('/lookups/:id', ...adminOnly, controller.updateLookup);
router.delete('/lookups/:id', ...adminOnly, controller.deleteLookup);

router.get('/countries', controller.countries);
router.get('/currencies', controller.currencies);
router.post('/countries', ...adminOnly, validate(countrySchema), controller.createCountry);
router.patch('/countries/:id', ...adminOnly, controller.updateCountry);
router.delete('/countries/:id', ...adminOnly, controller.deleteCountry);

router.get('/boards', controller.boards);
router.get('/class-levels', controller.classLevels);
router.post('/boards', ...adminOnly, validate(boardSchema), controller.createBoard);
router.patch('/boards/:id', ...adminOnly, controller.updateBoard);
router.delete('/boards/:id', ...adminOnly, controller.deleteBoard);
router.post('/class-levels', ...adminOnly, validate(classLevelSchema), controller.createClassLevel);
router.patch('/class-levels/:id', ...adminOnly, controller.updateClassLevel);
router.delete('/class-levels/:id', ...adminOnly, controller.deleteClassLevel);

module.exports = router;
