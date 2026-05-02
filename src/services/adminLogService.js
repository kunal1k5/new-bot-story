const { logError } = require('../utils/errorHandler');

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function formatUser({ userId, username, firstName } = {}) {
  if (username) {
    return `@${username}`;
  }

  return firstName || `User ${userId || 'Unknown'}`;
}

function formatContributor(userId, username) {
  if (username) {
    return `@${username}`;
  }

  if (userId === 0) {
    return 'StoryBot';
  }

  return `User ${userId}`;
}

async function resolveGroupName(bot, chatId) {
  try {
    const chat = await bot.getChat(chatId);
    return chat?.title || chat?.username || 'Unknown Group';
  } catch (error) {
    logError('Admin log group name lookup failed', error);
    return 'Unknown Group';
  }
}

async function logToAdminChannel(bot, message) {
  const adminChannelId = process.env.ADMIN_CHANNEL_ID;

  if (!bot || !adminChannelId || !message) {
    return null;
  }

  try {
    return await bot.sendMessage(adminChannelId, message);
  } catch (error) {
    logError('Admin channel logging failed', error);
    return null;
  }
}

function buildContributionLog({ user, groupName, storyId, text, timestamp = new Date() }) {
  return `📝 New Contribution

👤 User: ${formatUser(user)}
🆔 ID: ${user?.userId || 'Unknown'}
👥 Group: ${groupName || 'Unknown Group'}
📖 Story ID: ${storyId}
✍️ Text: ${text}

🕒 Time: ${formatTimestamp(timestamp)}`;
}

function buildEditLog({ user, groupName, storyId, oldText, newText, timestamp = new Date() }) {
  return `✏️ Line Edited

👤 User: ${formatUser(user)}
🆔 ID: ${user?.userId || 'Unknown'}
👥 Group: ${groupName || 'Unknown Group'}
📖 Story ID: ${storyId}

❌ Old Text: ${oldText}

✅ New Text: ${newText}

🕒 Time: ${formatTimestamp(timestamp)}`;
}

function buildVoteLog({ user, storyId, voteType, timestamp = new Date() }) {
  return `👍 Vote Activity

👤 User: ${formatUser(user)}
🆔 ID: ${user?.userId || 'Unknown'}
📖 Story ID: ${storyId}

Vote Type: ${voteType === 'dislike' ? 'Dislike' : 'Like'}

🕒 Time: ${formatTimestamp(timestamp)}`;
}

function buildStoryCompletedLog({ groupName, story, contributions = [], timestamp = new Date() }) {
  const contributors = [
    ...new Map(
      contributions
        .filter((contribution) => contribution.userId !== 0)
        .map((contribution) => [
          contribution.userId,
          formatContributor(contribution.userId, contribution.username),
        ])
    ).values(),
  ];

  return `📢 Story Completed

👥 Group: ${groupName || 'Unknown Group'}
📖 Story ID: ${story?._id || story?.id || 'Unknown'}

👥 Contributors:
${contributors.length ? contributors.join(', ') : 'No contributors yet.'}

👍 Likes: ${story?.likes || 0}
👎 Dislikes: ${story?.dislikes || 0}

🕒 Time: ${formatTimestamp(timestamp)}`;
}

module.exports = {
  buildContributionLog,
  buildEditLog,
  buildStoryCompletedLog,
  buildVoteLog,
  logToAdminChannel,
  resolveGroupName,
};
