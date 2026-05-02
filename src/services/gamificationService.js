const Contribution = require('../database/models/Contribution');
const User = require('../database/models/User');
const { logError, safeSendMessage } = require('../utils/errorHandler');

const LIVE_UPDATE_COOLDOWN_MS = 30 * 1000;
const LEADERBOARD_CACHE_TTL_MS = 10 * 1000;
const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_BADGES = ['🥇 Story King', '🥈 Challenger', '🥉 Rising Star'];
const MOST_LIKED_BADGE = '🔥 Most Liked Line';
const CONSISTENT_BADGE = '🎯 Consistent Player';

const liveUpdateCooldownByChat = new Map();
const leaderboardCache = {
  expiresAt: 0,
  rows: null,
};

function formatUsername(user = {}) {
  if (user.username) {
    return `@${user.username}`;
  }

  return `User ${user.userId}`;
}

function getScoreFields() {
  return {
    totalLikes: { $sum: { $ifNull: ['$likes', '$votes'] } },
    totalDislikes: { $sum: { $ifNull: ['$dislikes', 0] } },
    contributions: { $sum: 1 },
  };
}

async function getAllTimeUserScores({ force = false, limit = 50 } = {}) {
  const now = Date.now();

  if (!force && leaderboardCache.rows && leaderboardCache.expiresAt > now) {
    return leaderboardCache.rows.slice(0, limit);
  }

  const rows = await Contribution.aggregate([
    {
      $match: {
        userId: { $ne: 0 },
      },
    },
    {
      $group: {
        _id: '$userId',
        userId: { $first: '$userId' },
        username: { $last: '$username' },
        ...getScoreFields(),
      },
    },
    {
      $addFields: {
        score: { $subtract: ['$totalLikes', '$totalDislikes'] },
      },
    },
    {
      $sort: {
        score: -1,
        totalLikes: -1,
        contributions: -1,
      },
    },
    { $limit: Math.max(limit, 50) },
  ]);

  leaderboardCache.rows = rows;
  leaderboardCache.expiresAt = now + LEADERBOARD_CACHE_TTL_MS;

  return rows.slice(0, limit);
}

async function getMostLikedUserId() {
  const [topLine] = await Contribution.find({ userId: { $ne: 0 } })
    .sort({ likes: -1, createdAt: 1 })
    .limit(1)
    .lean();

  if (!topLine || (topLine.likes || topLine.votes || 0) <= 0) {
    return null;
  }

  return topLine.userId;
}

function getBadgesForRow(row, index, mostLikedUserId) {
  const badges = [];

  if (index < RANK_BADGES.length) {
    badges.push(RANK_BADGES[index]);
  }

  if (row.userId === mostLikedUserId) {
    badges.push(MOST_LIKED_BADGE);
  }

  if (row.contributions >= 3) {
    badges.push(CONSISTENT_BADGE);
  }

  return badges;
}

async function recalculateBadgesAndRanks({ force = true } = {}) {
  const rows = await getAllTimeUserScores({ force, limit: 50 });
  const mostLikedUserId = await getMostLikedUserId();

  await Promise.all(
    rows.map((row, index) =>
      User.findOneAndUpdate(
        { userId: row.userId },
        {
          $set: {
            username: row.username || '',
            score: row.score,
            points: row.score,
            rank: index + 1,
            badges: getBadgesForRow(row, index, mostLikedUserId),
            totalLikes: row.totalLikes,
            totalDislikes: row.totalDislikes,
            totalContributions: row.contributions,
          },
        },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );

  return rows;
}

function formatLiveLeaderboard(rows) {
  const topRows = rows.slice(0, 3);

  if (!topRows.length) {
    return null;
  }

  const lines = topRows.map((row, index) => `${MEDALS[index]} ${formatUsername(row)} — ${row.score} pts`);

  return `📊 Live Update!

${lines.join('\n')}`;
}

function getRankFeedback({ previousRank, newRank, row, oldLeaderId }) {
  if (!row || !newRank) {
    return null;
  }

  const username = formatUsername(row);

  if (newRank === 1 && oldLeaderId && oldLeaderId !== row.userId) {
    return `👑 New Leader: ${username}!`;
  }

  if (!previousRank) {
    return newRank <= 3 ? `🚀 ${username} entered the top ${newRank}!` : null;
  }

  if (newRank < previousRank) {
    return `🚀 ${username} jumped to #${newRank}!`;
  }

  if (newRank > previousRank) {
    return `📉 ${username} moved down to #${newRank}`;
  }

  return null;
}

async function sendLiveLeaderboardUpdate(bot, chatId, changedUserId) {
  if (!bot || !chatId) {
    return null;
  }

  const now = Date.now();
  const nextAllowedAt = liveUpdateCooldownByChat.get(chatId) || 0;

  if (nextAllowedAt > now) {
    return { skipped: true, reason: 'cooldown' };
  }

  try {
    const previousRows = await getAllTimeUserScores({ force: false, limit: 10 });
    const previousRankByUser = new Map(previousRows.map((row, index) => [row.userId, index + 1]));
    const oldLeaderId = previousRows[0]?.userId;
    const rows = await recalculateBadgesAndRanks({ force: true });
    const changedRow = rows.find((row) => row.userId === changedUserId);
    const newRank = changedRow ? rows.findIndex((row) => row.userId === changedUserId) + 1 : null;
    const feedback = getRankFeedback({
      previousRank: previousRankByUser.get(changedUserId),
      newRank,
      row: changedRow,
      oldLeaderId,
    });
    const liveMessage = formatLiveLeaderboard(rows);
    const message = [liveMessage, feedback].filter(Boolean).join('\n\n');

    if (!message) {
      return { skipped: true, reason: 'empty' };
    }

    liveUpdateCooldownByChat.set(chatId, now + LIVE_UPDATE_COOLDOWN_MS);
    await safeSendMessage(bot, chatId, message);

    return { success: true };
  } catch (error) {
    logError('Live leaderboard update failed', error);
    return { success: false, error };
  }
}

async function getUserProfileMessage(userId, username = '') {
  await recalculateBadgesAndRanks({ force: true });

  const user = await User.findOne({ userId }).lean();

  if (!user) {
    return '😴 No profile activity yet!';
  }

  const displayName = user.username ? `@${user.username}` : username ? `@${username}` : `User ${userId}`;
  const badges = user.badges?.length ? user.badges.join('\n') : 'No badges yet.';

  return `👤 ${displayName}

🏆 Rank: ${user.rank ? `#${user.rank}` : 'Unranked'}
⭐ Points: ${user.score || 0}

🏅 Badges:
${badges}`;
}

module.exports = {
  CONSISTENT_BADGE,
  MOST_LIKED_BADGE,
  RANK_BADGES,
  formatLiveLeaderboard,
  getAllTimeUserScores,
  getUserProfileMessage,
  recalculateBadgesAndRanks,
  sendLiveLeaderboardUpdate,
};
