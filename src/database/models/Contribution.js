const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true,
  },
  username: {
    type: String,
    trim: true,
    default: '',
  },
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true,
  },
  messageId: {
    type: Number,
    default: null,
    index: true,
  },
  lineNumber: {
    type: Number,
    default: 0,
    min: 0,
    index: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
  },
  votes: {
    type: Number,
    default: 0,
    min: 0,
  },
  likes: {
    type: Number,
    default: 0,
    min: 0,
  },
  dislikes: {
    type: Number,
    default: 0,
    min: 0,
  },
  voters: {
    type: [
      {
        userId: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          enum: ['like', 'dislike'],
          required: true,
        },
      },
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

contributionSchema.index({ storyId: 1, userId: 1 }, { unique: true });
contributionSchema.index(
  { storyId: 1, lineNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { lineNumber: { $gt: 0 } },
  }
);
contributionSchema.index({ createdAt: -1, userId: 1 });
contributionSchema.index({ createdAt: -1, storyId: 1 });

module.exports = mongoose.model('Contribution', contributionSchema);
