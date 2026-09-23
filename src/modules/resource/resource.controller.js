const resourceService = require('./resource.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const data = await resourceService.list(req.query, req.user);
  return success(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await resourceService.getById(req.params.id, req.user);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await resourceService.create(req.user.id, req.body, req.file);
  return created(res, data, 'Resource created');
});

const update = asyncHandler(async (req, res) => {
  const data = await resourceService.update(req.params.id, req.body, req.user, req.file);
  return success(res, data, 'Resource updated');
});

const remove = asyncHandler(async (req, res) => {
  const data = await resourceService.remove(req.params.id, req.user);
  return success(res, data, 'Resource deleted');
});

const bookmark = asyncHandler(async (req, res) => {
  const data = await resourceService.bookmark(req.user.id, req.params.id);
  return success(res, data, 'Bookmarked');
});

const unbookmark = asyncHandler(async (req, res) => {
  const data = await resourceService.unbookmark(req.user.id, req.params.id);
  return success(res, data, 'Bookmark removed');
});

const myBookmarks = asyncHandler(async (req, res) => {
  const data = await resourceService.myBookmarks(req.user.id);
  return success(res, data);
});

const purchase = asyncHandler(async (req, res) => {
  const data = await resourceService.purchase(req.user, req.params.id);
  return created(res, data, 'Invoice created. Pay to unlock the download.');
});

const download = asyncHandler(async (req, res) => {
  const data = await resourceService.download(req.user, req.params.id);
  return success(res, data);
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  bookmark,
  unbookmark,
  myBookmarks,
  purchase,
  download,
};
