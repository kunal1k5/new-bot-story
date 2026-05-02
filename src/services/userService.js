const User = require('../database/models/User');

async function getOrCreateUser({ telegramId, username, firstName }) {
  return User.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        username: username || '',
        firstName: firstName || '',
      },
      $setOnInsert: {
        storiesStarted: 0,
        contributions: 0,
        votesCast: 0,
      },
    },
    { new: true, upsert: true }
  );
}

async function incrementStoryCount(userId) {
  return User.findByIdAndUpdate(userId, { $inc: { storiesStarted: 1 } }, { new: true });
}

async function incrementContributionCount(userId) {
  return User.findByIdAndUpdate(userId, { $inc: { contributions: 1 } }, { new: true });
}

async function incrementVotesCast(userId) {
  return User.findByIdAndUpdate(userId, { $inc: { votesCast: 1 } }, { new: true });
}

module.exports = {
  getOrCreateUser,
  incrementStoryCount,
  incrementContributionCount,
  incrementVotesCast,
};
