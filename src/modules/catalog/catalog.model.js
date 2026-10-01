const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    currencySymbol: { type: String, default: '' },
    defaultTimezone: { type: String, default: 'UTC' },
    timezones: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, default: '' },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const classLevelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const lookupOptionSchema = new mongoose.Schema(
  {
    group: { type: String, required: true, trim: true, index: true },
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

lookupOptionSchema.index({ group: 1, value: 1 }, { unique: true });

module.exports = {
  Country: mongoose.model('Country', countrySchema),
  Board: mongoose.model('Board', boardSchema),
  ClassLevel: mongoose.model('ClassLevel', classLevelSchema),
  LookupOption: mongoose.model('LookupOption', lookupOptionSchema),
};
