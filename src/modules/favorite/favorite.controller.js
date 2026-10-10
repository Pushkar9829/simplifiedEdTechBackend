const favoriteService = require('./favorite.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const data = await favoriteService.list(req.user.id, req.query.kind);
  return success(res, data);
});

const add = asyncHandler(async (req, res) => {
  const data = await favoriteService.add(req.user.id, req.body.kind, req.body.targetId);
  return created(res, data, 'Saved to favourites');
});

const remove = asyncHandler(async (req, res) => {
  const data = await favoriteService.remove(req.user.id, req.params.kind, req.params.targetId);
  return success(res, data, 'Removed from favourites');
});

module.exports = { list, add, remove };
