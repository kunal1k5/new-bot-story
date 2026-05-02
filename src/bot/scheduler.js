const cron = require('node-cron');
const BotGroup = require('../database/models/BotGroup');
const Story = require('../database/models/Story');
const { publishCompletedStory } = require('../services/channelService');
const { recalculateBadgesAndRanks } = require('../services/gamificationService');
const { endActiveStory, formatFinalStory, getActiveStoriesByGroup, startStory } = require('../services/storyService');
const { getLanguageLabel } = require('../utils/language');
const { logError, safeSendMessage } = require('../utils/errorHandler');
const { ADMIN_PERMISSION_MESSAGE, checkBotAdminPermissions } = require('../utils/telegramPermissions');

const DEFAULT_AUTO_START_CRON = '0 6 * * *';
const DEFAULT_AUTO_END_CRON = '0 22 * * *';
const AUTO_CRON_TIMEZONE = process.env.AUTO_CRON_TIMEZONE || 'Asia/Kolkata';
const AUTO_START_CRON = getValidCronExpression(process.env.AUTO_START_CRON, DEFAULT_AUTO_START_CRON, 'AUTO_START_CRON');
const AUTO_END_CRON = getValidCronExpression(process.env.AUTO_END_CRON, DEFAULT_AUTO_END_CRON, 'AUTO_END_CRON');
const STORY_LANGUAGES = ['hindi', 'english'];

function getValidCronExpression(value, fallback, name) {
  const expression = String(value || '').trim();
  const validShape = /^[-*/,\d]+\s+[-*/,\d]+\s+[-*/,\d]+\s+[-*/,\d]+\s+[-*/,\d]+$/;

  try {
    if (!expression) {
      return fallback;
    }

    if (validShape.test(expression) && cron.validate(expression)) {
      return expression;
    }
  } catch (error) {
    logError(`Invalid ${name} validation failed`, error);
  }

  console.warn(`[scheduler] Invalid ${name}; using default`, {
    received: expression,
    fallback,
  });

  return fallback;
}

function getConfiguredGroupIds() {
  const rawGroupIds = [process.env.GROUP_ID, process.env.GROUP_IDS].filter(Boolean).join(',');

  return rawGroupIds
    .split(',')
    .map((groupId) => Number(groupId.trim()))
    .filter(Number.isFinite);
}

async function getKnownGroupIds() {
  const configuredGroupIds = getConfiguredGroupIds();
  const rememberedGroupIds = await BotGroup.distinct('groupId');
  const storyGroupIds = await Story.distinct('groupId');
  const groupIds = [...configuredGroupIds, ...rememberedGroupIds, ...storyGroupIds].filter(Number.isFinite);

  return [...new Set(groupIds)];
}

async function retrySafely(context, task, retries = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      logError(`${context} failed on attempt ${attempt + 1}`, error);
    }
  }

  return { success: false, error: lastError };
}

async function pinStoryMessage(bot, story, message) {
  if (!bot || !story || !message?.chat?.id || !message.message_id) {
    return;
  }

  try {
    await bot.unpinChatMessage(message.chat.id);
  } catch (error) {
    logError('Scheduler unpinChatMessage failed', error);
  }

  try {
    await Story.findByIdAndUpdate(story._id, {
      $set: { pinnedMessageId: message.message_id },
    });

    await bot.pinChatMessage(message.chat.id, message.message_id, {
      disable_notification: true,
    });
  } catch (error) {
    logError('Scheduler pinChatMessage failed', error);
    await safeSendMessage(
      bot,
      story.groupId,
      "⚠️ I couldn't pin the message.\nPlease enable 'Pin Messages' permission."
    );
  }
}

async function sendAndPinStartedStory(bot, result) {
  const sentMessage = await safeSendMessage(bot, result.story.groupId, result.message);

  if (sentMessage) {
    await pinStoryMessage(bot, result.story, sentMessage);
  }
}

async function autoStartStories(bot) {
  console.log('[scheduler] Auto starting stories');
  const groupIds = await getKnownGroupIds();

  for (const groupId of groupIds) {
    for (const language of STORY_LANGUAGES) {
      await retrySafely(`Auto start ${language} story for ${groupId}`, async () => {
        const permissions = await checkBotAdminPermissions(bot, groupId);

        if (!permissions.ok) {
          await safeSendMessage(bot, groupId, ADMIN_PERMISSION_MESSAGE);
          return { success: false, skipped: true };
        }

        const result = await startStory(groupId, language);

        if (result.success) {
          console.log('[scheduler] Started story', { groupId, language, storyId: result.story._id.toString() });
          await sendAndPinStartedStory(bot, result);
        }

        return result;
      });
    }
  }
}

function formatDailyStorySection(language, contributions) {
  return `📖 Today's ${getLanguageLabel(language)} Story:
${formatFinalStory(contributions)}`;
}

async function autoEndStories(bot) {
  console.log('[scheduler] Auto ending stories');
  const groupIds = await getKnownGroupIds();

  for (const groupId of groupIds) {
    await retrySafely(`Auto end stories for ${groupId}`, async () => {
      const activeStories = await getActiveStoriesByGroup(groupId);

      if (!activeStories.length) {
        return { success: false, skipped: true };
      }

      const completed = [];

      for (const story of activeStories) {
        const result = await endActiveStory(story);

        if (result) {
          completed.push(result);
          console.log('[scheduler] Ended story', {
            groupId,
            language: result.story.language,
            storyId: result.story._id.toString(),
          });
          await publishCompletedStory(bot, result.story, result.contributions);
        }
      }

      await recalculateBadgesAndRanks({ force: true });

      return { success: true };
    });
  }
}

function startScheduler(bot) {
  if (!bot) {
    throw new Error('Bot instance is required to start scheduler');
  }

  console.log('[scheduler] Registered auto jobs', {
    start: AUTO_START_CRON,
    end: AUTO_END_CRON,
    timezone: AUTO_CRON_TIMEZONE,
  });

  cron.schedule(AUTO_START_CRON, async () => {
    await retrySafely('Daily auto story start cron', () => autoStartStories(bot));
  }, { timezone: AUTO_CRON_TIMEZONE });

  cron.schedule(AUTO_END_CRON, async () => {
    await retrySafely('Daily auto story end cron', () => autoEndStories(bot));
  }, { timezone: AUTO_CRON_TIMEZONE });
}

module.exports = {
  AUTO_END_CRON,
  AUTO_START_CRON,
  AUTO_CRON_TIMEZONE,
  autoEndStories,
  autoStartStories,
  formatDailyStorySection,
  getKnownGroupIds,
  startScheduler,
};
