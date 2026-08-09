const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true, index: true }, // stable identifier, e.g. 'food_hero'
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true }, // emoji, kept simple — no icon asset pipeline needed
    threshold: { type: Number, required: true }, // total donations required to earn it
  },
  { timestamps: true }
);

module.exports = mongoose.model('Badge', badgeSchema);
