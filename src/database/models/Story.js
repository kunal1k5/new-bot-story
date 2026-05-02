const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  storyId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
  },
  groupId: {
    type: Number,
    required: true,
    index: true,
  },
  language: {
    type: String,
    enum: ['hindi', 'english'],
    required: true,
    index: true,
  },
  starterLine: {
    type: String,
    trim: true,
    default: '',
  },
  pinnedMessageId: {
    type: Number,
    default: null,
  },
  lastContributionMessageId: {
    type: Number,
    default: null,
  },
  storyPreviewMessageId: {
    type: Number,
    default: null,
  },
  groupMessageId: {
    type: Number,
    default: null,
  },
  channelMessageId: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
    index: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  totalLines: {
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
  channelPostedAt: {
    type: Date,
    default: null,
  },
});

storySchema.index(
  { groupId: 1, status: 1, language: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

module.exports = mongoose.model('Story', storySchema);
