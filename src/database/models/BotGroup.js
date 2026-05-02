const mongoose = require('mongoose');

const botGroupSchema = new mongoose.Schema({
  groupId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    trim: true,
    default: '',
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
  },
  usedHindi: {
    type: [String],
    default: [],
  },
  usedEnglish: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model('BotGroup', botGroupSchema);
