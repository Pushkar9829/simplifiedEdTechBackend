const catalogService = require('./catalog.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const boards = asyncHandler(async (req, res) => {
  const data = await catalogService.listBoards(req.query.includeInactive === 'true');
  return success(res, data);
});

const classLevels = asyncHandler(async (req, res) => {
  const data = await catalogService.listClassLevels(req.query.includeInactive === 'true');
  return success(res, data);
});

const createBoard = asyncHandler(async (req, res) => {
  const data = await catalogService.createBoard(req.body);
  return created(res, data, 'Board created');
});

const updateBoard = asyncHandler(async (req, res) => {
  const data = await catalogService.updateBoard(req.params.id, req.body);
  return success(res, data, 'Board updated');
});

const createClassLevel = asyncHandler(async (req, res) => {
  const data = await catalogService.createClassLevel(req.body);
  return created(res, data, 'Class level created');
});

const updateClassLevel = asyncHandler(async (req, res) => {
  const data = await catalogService.updateClassLevel(req.params.id, req.body);
  return success(res, data, 'Class level updated');
});

module.exports = {
  boards,
  classLevels,
  createBoard,
  updateBoard,
  createClassLevel,
  updateClassLevel,
};
