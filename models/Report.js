const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // 'YYYY-MM-DD', local server date

    donationsDelivered: { type: Number, default: 0 },
    mealsDelivered: { type: Number, default: 0 }, // food quantity delivered (proxy for meals)
    itemsDistributed: { type: Number, default: 0 }, // clothes + grocery + medicine + books quantity delivered
    moneyRaised: { type: Number, default: 0 }, // money-type quantity delivered
    skillHoursOffered: { type: Number, default: 0 }, // skill-type quantity delivered
    wasteReducedKg: { type: Number, default: 0 }, // rough estimate — food quantity treated as kg-equivalent

    byType: {
      food: { type: Number, default: 0 },
      clothes: { type: Number, default: 0 },
      grocery: { type: Number, default: 0 },
      money: { type: Number, default: 0 },
      medicine: { type: Number, default: 0 },
      books: { type: Number, default: 0 },
      skill: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
