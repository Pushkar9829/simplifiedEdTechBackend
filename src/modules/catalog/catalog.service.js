const catalogRepo = require('./catalog.repo');
const ApiError = require('../../common/ApiError');

const LOOKUP_GROUPS = [
  { value: 'subject_category', label: 'Subject categories' },
  { value: 'subject_level', label: 'Subject levels' },
  { value: 'resource_type', label: 'Resource types' },
  { value: 'delivery_mode', label: 'Class modes' },
  { value: 'time_slot', label: 'Time slots' },
  { value: 'relationship', label: 'Parent relationships' },
  { value: 'billing_cycle', label: 'Billing cycles' },
  { value: 'audience', label: 'Audiences' },
  { value: 'campaign_channel', label: 'Campaign channels' },
  { value: 'language', label: 'Languages' },
  { value: 'ticket_category', label: 'Ticket categories' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'lesson_status', label: 'Lesson statuses' },
  { value: 'grading_scheme', label: 'Grading schemes' },
];

const DEFAULT_LOOKUPS = [
  ['subject_category', 'ibdp', 'IBDP', 1],
  ['subject_category', 'hobby', 'Hobby / skill', 2],
  ['subject_category', 'skill', 'Professional skill', 3],
  ['subject_level', 'HL', 'HL', 1],
  ['subject_level', 'SL', 'SL', 2],
  ['subject_level', 'N/A', 'N/A', 3],
  ['resource_type', 'notes', 'Notes', 1],
  ['resource_type', 'question_bank', 'Question bank', 2],
  ['resource_type', 'past_paper', 'Past paper', 3],
  ['resource_type', 'markscheme', 'Markscheme', 4],
  ['resource_type', 'formula_sheet', 'Formula sheet', 5],
  ['resource_type', 'flashcards', 'Flashcards', 6],
  ['resource_type', 'mind_map', 'Mind map', 7],
  ['resource_type', 'practice_test', 'Practice test', 8],
  ['delivery_mode', 'online', 'Online', 1],
  ['delivery_mode', 'offline', 'Offline', 2],
  ['time_slot', 'morning', 'Morning (6–12)', 1],
  ['time_slot', 'afternoon', 'Afternoon (12–17)', 2],
  ['time_slot', 'evening', 'Evening (17–22)', 3],
  ['relationship', 'parent', 'Parent', 1],
  ['relationship', 'guardian', 'Guardian', 2],
  ['relationship', 'other', 'Other', 3],
  ['billing_cycle', 'one_time', 'One time', 1],
  ['billing_cycle', 'monthly', 'Monthly', 2],
  ['billing_cycle', 'yearly', 'Yearly', 3],
  ['audience', 'all', 'All users', 1],
  ['audience', 'student', 'Students', 2],
  ['audience', 'tutor', 'Tutors', 3],
  ['audience', 'parent', 'Parents', 4],
  ['audience', 'admin', 'Admins', 5],
  ['campaign_channel', 'organic', 'Organic', 1],
  ['campaign_channel', 'paid_ads', 'Paid ads', 2],
  ['campaign_channel', 'email', 'Email', 3],
  ['campaign_channel', 'referral', 'Referral', 4],
  ['campaign_channel', 'social', 'Social', 5],
  ['campaign_channel', 'partner', 'Partner', 6],
  ['campaign_channel', 'other', 'Other', 7],
  ['language', 'en', 'English', 1],
  ['language', 'hi', 'Hindi', 2],
  ['language', 'es', 'Spanish', 3],
  ['language', 'fr', 'French', 4],
  ['language', 'de', 'German', 5],
  ['language', 'zh', 'Mandarin', 6],
  ['language', 'ar', 'Arabic', 7],
  ['ticket_category', 'general', 'General', 1],
  ['ticket_category', 'booking', 'Booking', 2],
  ['ticket_category', 'payment', 'Payment', 3],
  ['ticket_category', 'tutor_dispute', 'Tutor dispute', 4],
  ['ticket_category', 'complaint', 'Complaint', 5],
  ['attendance', 'pending', 'Pending', 1],
  ['attendance', 'present', 'Present', 2],
  ['attendance', 'absent', 'Absent', 3],
  ['lesson_status', 'draft', 'Draft', 1],
  ['lesson_status', 'ready', 'Ready', 2],
  ['lesson_status', 'completed', 'Completed', 3],
  ['grading_scheme', 'ib_1_7', 'IB scale (1–7)', 1],
  ['grading_scheme', 'percentage', 'Percentage', 2],
  ['grading_scheme', 'marks', 'Marks', 3],
  ['grading_scheme', 'letter', 'Letter grade', 4],
  ['grading_scheme', 'pass_fail', 'Pass / fail', 5],
].map(([group, value, label, sortOrder]) => ({ group, value, label, sortOrder, isActive: true }));

function scopedFilter(includeInactive, countryId) {
  const filter = includeInactive ? {} : { isActive: true };
  if (countryId) filter.$or = [{ countryId }, { countryId: null }, { countryId: { $exists: false } }];
  return filter;
}

async function ensureLookupDefaults() {
  const existing = await catalogRepo.listLookups({});
  const have = new Set(existing.map((row) => `${row.group}:${row.value}`));
  const missing = DEFAULT_LOOKUPS.filter((row) => !have.has(`${row.group}:${row.value}`));
  if (missing.length) await catalogRepo.LookupOption.insertMany(missing);
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

async function deleteCountry(id) {
  const item = await catalogRepo.deleteCountry(id);
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

async function deleteBoard(id) {
  const item = await catalogRepo.deleteBoard(id);
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

async function deleteClassLevel(id) {
  const item = await catalogRepo.deleteClassLevel(id);
  if (!item) throw new ApiError(404, 'Class level not found');
  return item;
}

async function listLookups(includeInactive, group) {
  await ensureLookupDefaults();
  const filter = includeInactive ? {} : { isActive: true };
  if (group) filter.group = group;
  const items = await catalogRepo.listLookups(filter);
  return { groups: LOOKUP_GROUPS, items };
}

async function createLookup(data) {
  const existing = await catalogRepo.findLookup({ group: data.group, value: data.value });
  if (existing) throw new ApiError(409, 'That option already exists in this list');
  return catalogRepo.createLookup(data);
}

async function updateLookup(id, data) {
  const item = await catalogRepo.updateLookup(id, data);
  if (!item) throw new ApiError(404, 'Option not found');
  return item;
}

async function deleteLookup(id) {
  const item = await catalogRepo.deleteLookup(id);
  if (!item) throw new ApiError(404, 'Option not found');
  return item;
}

module.exports = {
  LOOKUP_GROUPS,
  listCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  listCurrencies,
  listBoards,
  listClassLevels,
  createBoard,
  updateBoard,
  deleteBoard,
  createClassLevel,
  updateClassLevel,
  deleteClassLevel,
  listLookups,
  createLookup,
  updateLookup,
  deleteLookup,
};
