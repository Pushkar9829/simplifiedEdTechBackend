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

module.exports = {
  Country: mongoose.model('Country', countrySchema),
  Board: mongoose.model('Board', boardSchema),
  ClassLevel: mongoose.model('ClassLevel', classLevelSchema),
};
