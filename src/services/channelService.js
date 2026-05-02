const Story = require('../database/models/Story');
const { formatFinalStory } = require('./storyService');
const { buildStoryCompletedLog, logToAdminChannel } = require('./adminLogService');
const { appendChannelButton } = require('../utils/channelButton');
const { logError } = require('../utils/errorHandler');

function formatContributor(userId, username) {
  if (username) {
    return `@${username}`;
  }

  if (userId === 0) {
    return 'StoryBot';
  }

  return `User ${userId}`;
}

function getTopContributors(contributions, limit = 3) {
  const contributorMap = new Map();

  for (const contribution of contributions) {
    const key = contribution.userId;
    const existing = contributorMap.get(key);

    if (existing) {
      existing.count += 1;
      if (!existing.username && contribution.username) {
        existing.username = contribution.username;
      }
      continue;
    }

    contributorMap.set(key, {
      userId: contribution.userId,
      username: contribution.username || '',
      count: 1,
      firstContributionAt: contribution.createdAt,
    });
  }

  return [...contributorMap.values()]
    .filter((contributor) => contributor.userId !== 0)
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.firstContributionAt - b.firstContributionAt;
    })
    .slice(0, limit);
}

function getUniqueContributors(contributions) {
  const contributorMap = new Map();

  for (const contribution of contributions) {
    if (contribution.userId === 0 || contributorMap.has(contribution.userId)) {
      continue;
    }

    contributorMap.set(contribution.userId, {
      userId: contribution.userId,
      username: contribution.username || '',
    });
  }

  return [...contributorMap.values()];
}

function createStoryVoteKeyboard(storyId, likes = 0, dislikes = 0) {
  return appendChannelButton({
    inline_keyboard: [
      [
        { text: `👍 Like (${likes || 0})`, callback_data: `vote_story_${storyId}_like` },
        { text: `👎 Dislike (${dislikes || 0})`, callback_data: `vote_story_${storyId}_dislike` },
      ],
    ],
  }, '📢 Read More Stories');
}

function getStoryTitle(story) {
  if (story?.title) {
    return story.title;
  }

  return story?.language === 'hindi' ? 'Hindi Story' : 'English Story';
}

function formatCompletedStoryMessage({ story, contributions, groupName }) {
  const finalStory = formatFinalStory(contributions);
  const contributors = getUniqueContributors(contributions);
  const contributorText = contributors.length
    ? contributors.map((contributor) => formatContributor(contributor.userId, contributor.username)).join(', ')
    : 'No contributors yet.';

  return `📢 Story Completed!

🏷 Group: ${groupName || 'Unknown Group'}
📌 Title: ${getStoryTitle(story)}

📖 Story:

${finalStory}

👥 Contributors:
${contributorText}

👍 Likes: ${story.likes || 0}   👎 Dislikes: ${story.dislikes || 0}

✨ Vote now!`;
}

function formatChannelStoryMessage(contributions) {
  return formatCompletedStoryMessage({
    story: { language: 'english', likes: 0, dislikes: 0 },
    contributions,
    groupName: 'Unknown Group',
  });
}

async function resolveGroupName(bot, groupId) {
  try {
    const chat = await bot.getChat(groupId);
    return chat?.title || 'Unknown Group';
  } catch (error) {
    logError('Failed to fetch group name', error);
    return 'Unknown Group';
  }
}

async function publishStoryToChannel(bot, story, contributions) {
  const channelId = process.env.CHANNEL_ID;

  if (!channelId) {
    return { success: false, skipped: true, reason: 'CHANNEL_ID is not set' };
  }

  const storyToPost = await Story.findOneAndUpdate(
    {
      _id: story._id,
      status: 'completed',
      channelPostedAt: null,
    },
    {
      $set: {
        channelPostedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!storyToPost) {
    return { success: false, skipped: true, reason: 'Story was already posted or is not completed' };
  }

  try {
    const groupName = await resolveGroupName(bot, story.groupId);
    const message = formatCompletedStoryMessage({ story: storyToPost, contributions, groupName });
    const sentMessage = await bot.sendMessage(channelId, message, {
      reply_markup: createStoryVoteKeyboard(story._id.toString(), storyToPost.likes, storyToPost.dislikes),
    });

    await Story.findByIdAndUpdate(story._id, {
      $set: { channelMessageId: sentMessage.message_id },
    });

    return { success: true, channelMessage: sentMessage };
  } catch (error) {
    logError('Failed to publish story to channel', error);
    return { success: false, skipped: false, error };
  }
}

async function publishCompletedStory(bot, story, contributions) {
  const channelId = process.env.CHANNEL_ID;
  const groupName = await resolveGroupName(bot, story.groupId);
  const message = formatCompletedStoryMessage({ story, contributions, groupName });
  await logToAdminChannel(bot, buildStoryCompletedLog({ groupName, story, contributions }));
  const replyMarkup = createStoryVoteKeyboard(story._id.toString(), story.likes, story.dislikes);
  const updates = {};
  let groupMessage = null;
  let channelMessage = null;

  try {
    groupMessage = await bot.sendMessage(story.groupId, message, { reply_markup: replyMarkup });

    if (groupMessage?.message_id) {
      updates.groupMessageId = groupMessage.message_id;
    }
  } catch (error) {
    logError('Failed to send completed story to group', error);
  }

  if (channelId) {
    try {
      channelMessage = await bot.sendMessage(channelId, message, { reply_markup: replyMarkup });

      if (channelMessage?.message_id) {
        updates.channelMessageId = channelMessage.message_id;
        updates.channelPostedAt = new Date();
      }
    } catch (error) {
      logError('Failed to publish story to channel', error);
    }
  }

  if (Object.keys(updates).length) {
    await Story.findByIdAndUpdate(story._id, { $set: updates });
  }

  return {
    success: Boolean(groupMessage || channelMessage),
    groupMessage,
    channelMessage,
    message,
  };
}

module.exports = {
  createStoryVoteKeyboard,
  formatChannelStoryMessage,
  formatCompletedStoryMessage,
  getTopContributors,
  getUniqueContributors,
  publishCompletedStory,
  publishStoryToChannel,
  resolveGroupName,
};
