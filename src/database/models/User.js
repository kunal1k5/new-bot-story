const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    trim: true,
    default: '',
  },
  points: {
    type: Number,
    default: 0,
    min: 0,
  },
  score: {
    type: Number,
    default: 0,
  },
  rank: {
    type: Number,
    default: null,
    index: true,
  },
  badges: {
    type: [String],
    default: [],
  },
  totalContributions: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalLikes: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalDislikes: {
    type: Number,
    default: 0,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
