const { Country, Board, ClassLevel } = require('./catalog.model');

function listFactory(Model) {
  return async function list(filter = {}) {
    return Model.find(filter).populate('countryId', 'name code currency').sort({ sortOrder: 1, name: 1 });
  };
}

module.exports = {
  listCountries: (filter = {}) => Country.find(filter).sort({ name: 1 }),
  findCountryById: (id) => Country.findById(id),
  findBoardById: (id) => Board.findById(id),
  findClassLevelById: (id) => ClassLevel.findById(id),
  createCountry: (data) => Country.create(data),
  updateCountry: (id, data) => Country.findByIdAndUpdate(id, data, { new: true }),
  listBoards: listFactory(Board),
  listClassLevels: listFactory(ClassLevel),
  createBoard: (data) => Board.create(data),
  updateBoard: (id, data) => Board.findByIdAndUpdate(id, data, { new: true }),
  createClassLevel: (data) => ClassLevel.create(data),
  updateClassLevel: (id, data) => ClassLevel.findByIdAndUpdate(id, data, { new: true }),
  Country,
  Board,
  ClassLevel,
};
