const catalogRepo = require('./catalog.repo');
const ApiError = require('../../common/ApiError');

async function listBoards(includeInactive) {
  return catalogRepo.listBoards(includeInactive ? {} : { isActive: true });
}

async function listClassLevels(includeInactive) {
  return catalogRepo.listClassLevels(includeInactive ? {} : { isActive: true });
}

async function createBoard(data) {
  return catalogRepo.createBoard(data);
}

async function updateBoard(id, data) {
  const item = await catalogRepo.updateBoard(id, data);
  if (!item) throw new ApiError(404, 'Board not found');
  return item;
}

async function createClassLevel(data) {
  return catalogRepo.createClassLevel(data);
}

async function updateClassLevel(id, data) {
  const item = await catalogRepo.updateClassLevel(id, data);
  if (!item) throw new ApiError(404, 'Class level not found');
  return item;
}

module.exports = {
  listBoards,
  listClassLevels,
  createBoard,
  updateBoard,
  createClassLevel,
  updateClassLevel,
};
