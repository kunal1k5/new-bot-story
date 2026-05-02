const mongoose = require('mongoose');
const Contribution = require('../database/models/Contribution');
const Story = require('../database/models/Story');
const User = require('../database/models/User');

function normalizeVoters(voters = []) {
  return voters
    .map((voter) => {
      if (typeof voter === 'number') {
        return { userId: voter, type: 'like' };
      }

      if (Number.isFinite(voter?.userId) && ['like', 'dislike'].includes(voter.type)) {
        return {
          userId: voter.userId,
          type: voter.type,
        };
      }

      return null;
    })
    .filter(Boolean);
}

function getVoteDelta(previousType, nextType) {
  const delta = {
    likes: 0,
    dislikes: 0,
  };

  if (previousType === 'like') {
    delta.likes -= 1;
  }

  if (previousType === 'dislike') {
    delta.dislikes -= 1;
  }

  if (nextType === 'like') {
    delta.likes += 1;
  }

  if (nextType === 'dislike') {
    delta.dislikes += 1;
  }

  return delta;
}

async function voteForContribution({ contributionId, userId, type = 'like' }) {
  if (!Number.isFinite(userId) || !mongoose.Types.ObjectId.isValid(contributionId)) {
    return {
      success: false,
      message: '❌ Could not process this vote.',
    };
  }

  if (!['like', 'dislike'].includes(type)) {
    return {
      success: false,
      message: '❌ Could not process this vote.',
    };
  }

  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    return {
      success: false,
      message: '❌ This line no longer exists.',
    };
  }

  if (contribution.userId === userId) {
    return {
      success: false,
      message: '❌ You cannot vote for your own line!',
    };
  }

  const voters = normalizeVoters(contribution.voters);
  const existingVote = voters.find((voter) => voter.userId === userId);

  if (existingVote?.type === type) {
    return {
      success: false,
      message: `⚠️ You already ${type === 'like' ? 'liked' : 'disliked'} this line!`,
    };
  }

  const delta = getVoteDelta(existingVote?.type, type);
  const nextVoters = voters.filter((voter) => voter.userId !== userId);
  nextVoters.push({ userId, type });

  contribution.likes = Math.max(0, (contribution.likes || contribution.votes || 0) + delta.likes);
  contribution.dislikes = Math.max(0, (contribution.dislikes || 0) + delta.dislikes);
  contribution.votes = contribution.likes;
  contribution.voters = nextVoters;

  await contribution.save();

  await Promise.all([
    Story.findByIdAndUpdate(contribution.storyId, {
      $inc: {
        totalLikes: delta.likes,
        totalDislikes: delta.dislikes,
      },
    }),
    User.findOneAndUpdate(
      { userId: contribution.userId },
      {
        $inc: {
          totalLikes: delta.likes,
          totalDislikes: delta.dislikes,
          score: delta.likes - delta.dislikes,
          points: delta.likes - delta.dislikes,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ),
  ]);

  return {
    success: true,
    contribution,
    message: existingVote ? '✅ Vote switched!' : type === 'like' ? '✅ Like counted!' : '✅ Dislike counted!',
  };
}

async function voteForStory({ storyId, userId, type = 'like' }) {
  if (!Number.isFinite(userId) || !mongoose.Types.ObjectId.isValid(storyId)) {
    return {
      success: false,
      message: '❌ Could not process this vote.',
    };
  }

  if (!['like', 'dislike'].includes(type)) {
    return {
      success: false,
      message: '❌ Could not process this vote.',
    };
  }

  const story = await Story.findById(storyId);

  if (!story) {
    return {
      success: false,
      message: '❌ This story no longer exists.',
    };
  }

  const voters = normalizeVoters(story.voters);
  const existingVote = voters.find((voter) => voter.userId === userId);

  if (existingVote?.type === type) {
    return {
      success: false,
      message: `⚠️ You already ${type === 'like' ? 'liked' : 'disliked'} this story!`,
    };
  }

  const delta = getVoteDelta(existingVote?.type, type);
  const nextVoters = voters.filter((voter) => voter.userId !== userId);
  nextVoters.push({ userId, type });

  story.likes = Math.max(0, (story.likes || 0) + delta.likes);
  story.dislikes = Math.max(0, (story.dislikes || 0) + delta.dislikes);
  story.voters = nextVoters;

  await story.save();

  return {
    success: true,
    story,
    message: existingVote ? '✅ Vote switched!' : type === 'like' ? '✅ Like counted!' : '✅ Dislike counted!',
  };
}

module.exports = {
  voteForContribution,
  voteForStory,
};
