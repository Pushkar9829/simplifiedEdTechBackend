const catalogRepo = require('./catalog.repo');
const ApiError = require('../../common/ApiError');

function scopedFilter(includeInactive, countryId) {
  const filter = includeInactive ? {} : { isActive: true };
  // Items without a country apply everywhere.
  if (countryId) filter.$or = [{ countryId }, { countryId: null }, { countryId: { $exists: false } }];
  return filter;
}

async function listCountries(includeInactive) {
  return catalogRepo.listCountries(includeInactive ? {} : { isActive: true });
}

async function createCountry(data) {
  return catalogRepo.createCountry(data);
}

async function updateCountry(id, data) {
  const item = await catalogRepo.updateCountry(id, data);
  if (!item) throw new ApiError(404, 'Country not found');
  return item;
}

async function listCurrencies() {
  const countries = await catalogRepo.listCountries({ isActive: true });
  const seen = new Map();
  for (const c of countries) {
    if (!seen.has(c.currency)) {
      seen.set(c.currency, { code: c.currency, symbol: c.currencySymbol, countries: [] });
    }
    seen.get(c.currency).countries.push(c.code);
  }
  return [...seen.values()];
}

async function listBoards(includeInactive, countryId) {
  return catalogRepo.listBoards(scopedFilter(includeInactive, countryId));
}

async function listClassLevels(includeInactive, countryId) {
  return catalogRepo.listClassLevels(scopedFilter(includeInactive, countryId));
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
  listCountries,
  createCountry,
  updateCountry,
  listCurrencies,
  listBoards,
  listClassLevels,
  createBoard,
  updateBoard,
  createClassLevel,
  updateClassLevel,
};
