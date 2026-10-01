const { Country, Board, ClassLevel, LookupOption } = require('./catalog.model');

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
  deleteCountry: (id) => Country.findByIdAndDelete(id),
  deleteBoard: (id) => Board.findByIdAndDelete(id),
  deleteClassLevel: (id) => ClassLevel.findByIdAndDelete(id),
  listLookups: (filter = {}) => LookupOption.find(filter).sort({ group: 1, sortOrder: 1, label: 1 }),
  createLookup: (data) => LookupOption.create(data),
  updateLookup: (id, data) => LookupOption.findByIdAndUpdate(id, data, { new: true }),
  deleteLookup: (id) => LookupOption.findByIdAndDelete(id),
  findLookup: (filter) => LookupOption.findOne(filter),
  Country,
  Board,
  ClassLevel,
  LookupOption,
};
