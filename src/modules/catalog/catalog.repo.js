const { Board, ClassLevel } = require('./catalog.model');

function listFactory(Model) {
  return async function list(filter = {}) {
    return Model.find(filter).sort({ sortOrder: 1, name: 1 });
  };
}

module.exports = {
  listBoards: listFactory(Board),
  listClassLevels: listFactory(ClassLevel),
  createBoard: (data) => Board.create(data),
  updateBoard: (id, data) => Board.findByIdAndUpdate(id, data, { new: true }),
  createClassLevel: (data) => ClassLevel.create(data),
  updateClassLevel: (id, data) => ClassLevel.findByIdAndUpdate(id, data, { new: true }),
  Board,
  ClassLevel,
};
