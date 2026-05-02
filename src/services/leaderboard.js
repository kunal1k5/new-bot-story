const Contribution = require('../database/models/Contribution');
const Story = require('../database/models/Story');
const { appendChannelButton } = require('../utils/channelButton');

const MEDALS = ['🥇', '🥈', '🥉'];
const FILTERS = {
  daily: {
    label: 'Daily',
    days: 1,
  },
  weekly: {
    label: 'Weekly',
    days: 7,
  },
  monthly: {
    label: 'Monthly',
    days: 30,
  },
};

function getFilterStart(filter = 'weekly') {
  const selectedFilter = FILTERS[filter] || FILTERS.weekly;
  return new Date(Date.now() - selectedFilter.days * 24 * 60 * 60 * 1000);
}

function getFilterLabel(filter = 'weekly') {
  return (FILTERS[filter] || FILTERS.weekly).label;
}

function getRank(index) {
  return MEDALS[index] || `${index + 1}.`;
}

function formatUsername(row) {
  if (row.username) {
    return `@${row.username}`;
  }

  return `User ${row.userId}`;
}

function formatPoints(score) {
  return `${score} pts`;
}

async function getUserLeaderboard(filter = 'weekly', limit = 10) {
  const since = getFilterStart(filter);

  return Contribution.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        userId: { $ne: 0 },
      },
    },
    {
      $group: {
        _id: '$userId',
        userId: { $first: '$userId' },
        username: { $last: '$username' },
        totalLikes: { $sum: { $ifNull: ['$likes', '$votes'] } },
        totalDislikes: { $sum: { $ifNull: ['$dislikes', 0] } },
      },
    },
    {
      $addFields: {
        score: { $subtract: ['$totalLikes', '$totalDislikes'] },
      },
    },
    {
      $match: {
        score: { $ne: 0 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        badges: { $ifNull: ['$user.badges', []] },
      },
    },
    {
      $sort: {
        score: -1,
        totalLikes: -1,
      },
    },
    { $limit: limit },
  ]);
}

async function getGroupLeaderboard(filter = 'weekly', limit = 10) {
  const since = getFilterStart(filter);

  return Story.aggregate([
    {
      $match: {
        status: 'completed',
        endTime: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$groupId',
        groupId: { $first: '$groupId' },
        totalLikes: { $sum: { $ifNull: ['$likes', 0] } },
        totalDislikes: { $sum: { $ifNull: ['$dislikes', 0] } },
      },
    },
    {
      $addFields: {
        score: { $subtract: ['$totalLikes', '$totalDislikes'] },
      },
    },
    {
      $match: {
        score: { $ne: 0 },
      },
    },
    {
      $sort: {
        score: -1,
        totalLikes: -1,
      },
    },
    { $limit: limit },
  ]);
}

async function resolveGroupTitle(bot, groupId) {
  try {
    const chat = await bot.getChat(groupId);
    return chat?.title || 'Unknown Group';
  } catch (error) {
    return 'Unknown Group';
  }
}

function createLeaderboardKeyboard(type = 'group') {
  const targetType = type === 'user' ? 'user' : 'group';

  return appendChannelButton({
    inline_keyboard: [
      [
        { text: '📊 Group', callback_data: 'leaderboard_group_weekly' },
        { text: '👤 Users', callback_data: 'leaderboard_user_weekly' },
      ],
      [
        { text: '📅 Daily', callback_data: `leaderboard_${targetType}_daily` },
        { text: '📆 Weekly', callback_data: `leaderboard_${targetType}_weekly` },
        { text: '🗓 Monthly', callback_data: `leaderboard_${targetType}_monthly` },
      ],
    ],
  });
}

function createLeaderboardMenuMessage() {
  return '🏆 Choose a leaderboard and time filter.';
}

function formatUserLeaderboard(rows, filter = 'weekly') {
  if (!rows.length) {
    return '😴 No activity yet!';
  }

  const body = rows
    .map((row, index) => {
      const badgeText = row.badges?.length ? `\n🏅 ${row.badges.join(' | ')}` : '';
      return `${getRank(index)} ${formatUsername(row)} — ${formatPoints(row.score)}${badgeText}`;
    })
    .join('\n');

  return `👑 Top Players (${getFilterLabel(filter)})

${body}`;
}

function formatGroupLeaderboard(rows, filter = 'weekly') {
  if (!rows.length) {
    return '😴 No activity yet!';
  }

  const body = rows
    .map((row, index) => `${getRank(index)} ${row.title || 'Unknown Group'} — ${formatPoints(row.score)}`)
    .join('\n');

  return `🏆 Group Leaderboard (${getFilterLabel(filter)})

${body}`;
}

async function getUserLeaderboardMessage(filter = 'weekly', limit = 10) {
  const rows = await getUserLeaderboard(filter, limit);
  return formatUserLeaderboard(rows, filter);
}

async function getGroupLeaderboardMessage(bot, filter = 'weekly', limit = 10) {
  const rows = await getGroupLeaderboard(filter, limit);
  const rowsWithTitles = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      title: await resolveGroupTitle(bot, row.groupId),
    }))
  );

  return formatGroupLeaderboard(rowsWithTitles, filter);
}

async function getLeaderboardMessage({ bot, type = 'user', filter = 'weekly', limit = 10 } = {}) {
  if (type === 'group') {
    return getGroupLeaderboardMessage(bot, filter, limit);
  }

  return getUserLeaderboardMessage(filter, limit);
}

module.exports = {
  createLeaderboardKeyboard,
  createLeaderboardMenuMessage,
  formatGroupLeaderboard,
  formatUserLeaderboard,
  getGroupLeaderboard,
  getGroupLeaderboardMessage,
  getLeaderboardMessage,
  getUserLeaderboard,
  getUserLeaderboardMessage,
};
