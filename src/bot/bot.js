require('dotenv').config({ override: true });

const TelegramBot = require('node-telegram-bot-api');
const BotGroup = require('../database/models/BotGroup');
const Contribution = require('../database/models/Contribution');
const Story = require('../database/models/Story');
const { createStoryVoteKeyboard, publishCompletedStory } = require('../services/channelService');
const {
  buildContributionLog,
  buildEditLog,
  buildVoteLog,
  logToAdminChannel,
  resolveGroupName: resolveAdminLogGroupName,
} = require('../services/adminLogService');
const { appendChannelButton } = require('../utils/channelButton');
const {
  createLeaderboardKeyboard,
  createLeaderboardMenuMessage,
  getLeaderboardMessage,
} = require('../services/leaderboard');
const {
  getUserProfileMessage,
  recalculateBadgesAndRanks,
  sendLiveLeaderboardUpdate,
} = require('../services/gamificationService');
const {
  fetchEpisodes,
  scrapeAnimeInfo,
  scrapeHome,
  searchAnime,
} = require('../services/animeKaiService');
const {
  addStoryContribution,
  attachContributionMessage,
  attachFirstLineMessage,
  attachStoryPreviewMessage,
  editOwnStoryLine,
  editStoryLine,
  endActiveStory,
  generatePinnedStoryMessage,
  generateStoryPreview,
  getActiveStoriesByGroup,
  getActiveStoryByPinnedMessage,
  startStory,
} = require('../services/storyService');
const {
  FALLBACK_MESSAGE,
  logError,
  safeAnswerCallbackQuery,
  safeEditMessageReplyMarkup,
  safeSendMessage,
} = require('../utils/errorHandler');
const {
  ADMIN_PERMISSION_MESSAGE,
  checkBotAdminPermissions,
  checkUserAdminPermissions,
} = require('../utils/telegramPermissions');

const token = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'KahaniHub_bot';
const GROUP_ONLY_MESSAGE = '⚠️ StoryRank works inside groups.\n\nAdd me to a group to start playing!';
const HELP_MESSAGE = `📘 How This Bot Works

🇮🇳 हिंदी:
1️⃣ सुबह 6 बजे bot खुद कहानी शुरू करता है
2️⃣ pinned message पर reply करके लाइन जोड़ें
3️⃣ हर user सिर्फ 1 लाइन जोड़ सकता है
4️⃣ 👍👎 से vote करें
5️⃣ रात 10 बजे story अपने आप खत्म हो जाती है

🇬🇧 English:
1️⃣ Bot auto starts story at 6 AM
2️⃣ Reply to pinned message to add line
3️⃣ One user = one line
4️⃣ Vote using 👍👎
5️⃣ Story auto ends at 10 PM

Anime:
/anime <name> - Search anime
/anime_info <slug> - View details
/anime_eps <anime_id> - View episodes
/anime_home - Latest updates

✨ Tip: Be creative!`;
const KNOWN_COMMANDS = new Set([
  '/start',
  '/help',
  '/start_hindi_story',
  '/start_english_story',
  '/leaderboard',
  '/profile',
  '/editline',
  '/edit_my_line',
  '/endstory',
  '/story',
  '/anime',
  '/anime_home',
  '/anime_info',
  '/anime_eps',
]);

if (!token) {
  throw new Error('BOT_TOKEN is not set in .env');
}

const bot = new TelegramBot(token, { polling: true });
const previewUpdateTimers = new Map();

function getAuditUser(user = {}) {
  return {
    userId: user.id,
    username: user.username,
    firstName: user.first_name,
  };
}

async function logContributionActivity(msg, result) {
  const groupName = await resolveAdminLogGroupName(bot, msg.chat.id);

  await logToAdminChannel(
    bot,
    buildContributionLog({
      user: getAuditUser(msg.from),
      groupName,
      storyId: result.story._id,
      text: result.contribution.text,
    })
  );
}

async function logEditActivity(msg, result) {
  const groupName = await resolveAdminLogGroupName(bot, msg.chat.id);

  await logToAdminChannel(
    bot,
    buildEditLog({
      user: getAuditUser(msg.from),
      groupName,
      storyId: result.story._id,
      oldText: result.oldText,
      newText: result.newText || result.contribution.text,
    })
  );
}

async function logVoteActivity(query, storyId, voteType) {
  await logToAdminChannel(
    bot,
    buildVoteLog({
      user: getAuditUser(query.from),
      storyId,
      voteType,
    })
  );
}

function createVoteKeyboard(contributionId, likes = 0, dislikes = 0) {
  return appendChannelButton({
    inline_keyboard: [
      [
        {
          text: `👍 Like (${likes})`,
          callback_data: `like_${contributionId}`,
        },
        {
          text: `👎 Dislike (${dislikes})`,
          callback_data: `dislike_${contributionId}`,
        },
      ],
    ],
  });
}

function createHomeKeyboard(chatType) {
  const baseButtons = [
    [
      { text: '📖 हिंदी कहानी', callback_data: 'action_start_hindi_story' },
      { text: '📖 English Story', callback_data: 'action_start_english_story' },
    ],
    [{ text: '❓ Help', callback_data: 'help' }],
    [{ text: '📊 View Leaderboard', callback_data: 'action_leaderboard' }],
  ];

  const inline_keyboard =
    chatType === 'private'
      ? [
          [
            {
              text: '➕ Add to Group',
              url: `https://t.me/${BOT_USERNAME}?startgroup=true`,
            },
          ],
          ...baseButtons,
        ]
      : baseButtons;

  return appendChannelButton({
    inline_keyboard,
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function trimMessage(text, maxLength = 3900) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 20)}\n\n...`;
}

function formatAnimeSearchResults(keyword, results) {
  if (!results.length) {
    return `No anime found for "${escapeHtml(keyword)}".`;
  }

  const lines = [`Anime search: <b>${escapeHtml(keyword)}</b>`, ''];

  results.slice(0, 5).forEach((anime, index) => {
    const meta = [anime.type, anime.year, anime.subEpisodes && `Sub ${anime.subEpisodes}`, anime.dubEpisodes && `Dub ${anime.dubEpisodes}`]
      .filter(Boolean)
      .join(' | ');

    lines.push(
      `<b>${index + 1}. ${escapeHtml(anime.title)}</b>`,
      meta ? escapeHtml(meta) : 'No metadata',
      `<code>${escapeHtml(anime.slug)}</code>`,
      ''
    );
  });

  lines.push('Use: <code>/anime_info &lt;slug&gt;</code>');

  return trimMessage(lines.join('\n'));
}

function formatAnimeInfo(anime) {
  const detail = anime.detail || {};
  const genres = Array.isArray(detail.genres) ? detail.genres.join(', ') : detail.genres || '';
  const status = detail.status || '';
  const lines = [
    `<b>${escapeHtml(anime.title || 'Anime')}</b>`,
    anime.japaneseTitle ? escapeHtml(anime.japaneseTitle) : '',
    '',
    anime.description ? escapeHtml(anime.description.slice(0, 700)) : 'No description found.',
    '',
    anime.animeId ? `Anime ID: <code>${escapeHtml(anime.animeId)}</code>` : '',
    anime.type ? `Type: ${escapeHtml(anime.type)}` : '',
    anime.rating ? `Rating: ${escapeHtml(anime.rating)}` : '',
    anime.malScore ? `MAL: ${escapeHtml(anime.malScore)}` : '',
    genres ? `Genres: ${escapeHtml(genres)}` : '',
    status ? `Status: ${escapeHtml(status)}` : '',
    '',
    anime.animeId ? `Episodes: <code>/anime_eps ${escapeHtml(anime.animeId)}</code>` : '',
  ].filter((line) => line !== '');

  return trimMessage(lines.join('\n'));
}

function formatAnimeEpisodes(animeId, episodes) {
  if (!episodes.length) {
    return `No episodes found for anime ID <code>${escapeHtml(animeId)}</code>.`;
  }

  const lines = [
    `Episodes for <code>${escapeHtml(animeId)}</code>`,
    `Total: ${episodes.length}`,
    '',
  ];

  episodes.slice(0, 20).forEach((episode) => {
    const flags = [episode.hasSub && 'SUB', episode.hasDub && 'DUB'].filter(Boolean).join('/');
    lines.push(
      `Ep ${escapeHtml(episode.number || '?')}: ${escapeHtml(episode.title || episode.slug || 'Untitled')} ${flags ? `(${flags})` : ''}`
    );
  });

  if (episodes.length > 20) {
    lines.push('', `Showing first 20 of ${episodes.length}.`);
  }

  return trimMessage(lines.join('\n'));
}

function formatAnimeHome(home) {
  const latest = home.latestUpdates || [];

  if (!latest.length) {
    return 'No latest anime updates found right now.';
  }

  const lines = ['Latest anime updates:', ''];

  latest.slice(0, 10).forEach((anime, index) => {
    const episode = anime.currentEpisode ? ` Ep ${anime.currentEpisode}` : '';
    lines.push(`${index + 1}. <b>${escapeHtml(anime.title)}</b>${escapeHtml(episode)}`);
  });

  return trimMessage(lines.join('\n'));
}

function getCommand(text = '') {
  const command = text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  return command || null;
}

function isGroupChat(chat = {}) {
  return ['group', 'supergroup'].includes(chat.type);
}

async function rememberGroup(chat = {}) {
  if (!isGroupChat(chat) || !Number.isFinite(chat.id)) {
    return;
  }

  try {
    await BotGroup.findOneAndUpdate(
      { groupId: chat.id },
      {
        $set: {
          title: chat.title || '',
          lastSeenAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    logError('Failed to remember group', error);
  }
}

async function sendFallback(chatId) {
  await safeSendMessage(bot, chatId, FALLBACK_MESSAGE);
}

async function sendAndPinFirstLine(story, firstContribution, messageText) {
  const sentMessage = await safeSendMessage(bot, story.groupId, messageText, {
    reply_markup: appendChannelButton(),
  });

  if (!sentMessage) {
    return null;
  }

  await Story.findByIdAndUpdate(story._id, {
    $set: { pinnedMessageId: sentMessage.message_id },
  });
  await attachFirstLineMessage({
    storyId: story._id,
    contributionId: firstContribution?._id,
    messageId: sentMessage.message_id,
  });

  try {
    await bot.unpinChatMessage(story.groupId);
  } catch (error) {
    logError('Telegram unpinChatMessage failed', error);
  }

  try {
    await bot.pinChatMessage(story.groupId, sentMessage.message_id, {
      disable_notification: true,
    });
  } catch (error) {
    logError('Telegram pinChatMessage failed', error);
    await safeSendMessage(
      bot,
      story.groupId,
      "⚠️ I couldn't pin the message.\nPlease enable 'Pin Messages' permission."
    );
  }

  return sentMessage;
}

async function sendStartedStory(result) {
  const sentMessage = await sendAndPinFirstLine(result.story, result.firstContribution, result.message);

  if (sentMessage) {
    scheduleStoryPreviewUpdate(result.story._id, result.story.groupId);
  }
}

async function updateStoryPreview(storyId, chatId) {
  const story = await Story.findById(storyId);

  if (!story || story.status !== 'active') {
    return null;
  }

  const previewText = await generateStoryPreview(story._id);

  if (story.storyPreviewMessageId) {
    try {
      return await bot.editMessageText(previewText, {
        chat_id: chatId,
        message_id: story.storyPreviewMessageId,
      });
    } catch (error) {
      if (/message is not modified/i.test(error?.message || '')) {
        return null;
      }

      logError('Telegram story preview edit failed', error);
    }
  }

  const previewMessage = await safeSendMessage(bot, chatId, previewText, {
    reply_markup: appendChannelButton(),
  });

  if (previewMessage) {
    await attachStoryPreviewMessage({
      storyId: story._id,
      messageId: previewMessage.message_id,
    });
  }

  return previewMessage;
}

async function updatePinnedStoryMessage(chatId, storyId) {
  const story = await Story.findById(storyId);

  if (!story || story.status !== 'active') {
    return null;
  }

  const pinnedStoryText = await generatePinnedStoryMessage(story._id);

  try {
    await bot.unpinChatMessage(chatId);
  } catch (error) {
    logError('Telegram unpinChatMessage for story refresh failed', error);
  }

  const newMessage = await safeSendMessage(bot, chatId, pinnedStoryText, {
    reply_markup: appendChannelButton(),
  });

  if (!newMessage) {
    return null;
  }

  try {
    await bot.pinChatMessage(chatId, newMessage.message_id, {
      disable_notification: true,
    });
  } catch (error) {
    logError('Telegram pinChatMessage for story refresh failed', error);
  }

  await Story.findByIdAndUpdate(story._id, {
    $set: { pinnedMessageId: newMessage.message_id },
  });

  return newMessage;
}

function formatRecoveryStoryMessage(lines, title = '📖 Current Story') {
  let text = `${title}:\n\n`;

  if (!lines.length) {
    text += 'No lines yet.\n';
  } else {
    lines.forEach((line, index) => {
      text += `${index + 1}. ${line.text}\n`;
    });
  }

  text += '\n✨ Reply to THIS message to continue';

  return text;
}

async function recoverStory(botInstance, chatId, story, options = {}) {
  if (!botInstance || !Number.isFinite(chatId) || !story?._id) {
    return null;
  }

  const lines = await Contribution.find({ storyId: story._id }).sort({ lineNumber: 1, createdAt: 1 });
  const message = formatRecoveryStoryMessage(lines, options.title);
  const recoveredMessage = await safeSendMessage(botInstance, chatId, message, {
    reply_markup: appendChannelButton(),
  });

  if (!recoveredMessage?.message_id) {
    return null;
  }

  try {
    await botInstance.pinChatMessage(chatId, recoveredMessage.message_id, {
      disable_notification: true,
    });
  } catch (error) {
    logError('Story recovery pinChatMessage failed', error);
  }

  await Story.findByIdAndUpdate(story._id, {
    $set: { pinnedMessageId: recoveredMessage.message_id },
  });

  return recoveredMessage;
}

async function handleStartIfExists(botInstance, chatId, story) {
  if (!botInstance || !Number.isFinite(chatId) || !story?._id) {
    return null;
  }

  const lines = await Contribution.find({ storyId: story._id }).sort({ lineNumber: 1, createdAt: 1 });
  let text = '⚠️ Story already running!\n\nHere is the current progress 👇\n\n📖 Story So Far:\n\n';

  if (!lines.length) {
    text += 'No lines yet.\n';
  } else {
    lines.forEach((line, index) => {
      text += `${index + 1}. ${line.text}\n`;
    });
  }

  text += '\n✨ Continue by replying!';

  if (story.pinnedMessageId) {
    try {
      await botInstance.unpinChatMessage(chatId);
    } catch (error) {
      logError('Already-active story unpin failed', error);
    }

    try {
      await botInstance.deleteMessage(chatId, story.pinnedMessageId);
    } catch (error) {
      logError('Already-active story old pinned delete failed', error);
    }
  }

  const newMessage = await safeSendMessage(botInstance, chatId, text, {
    reply_markup: appendChannelButton(),
  });

  if (!newMessage?.message_id) {
    return null;
  }

  try {
    await botInstance.pinChatMessage(chatId, newMessage.message_id, {
      disable_notification: true,
    });
  } catch (error) {
    logError('Already-active story pin failed', error);
    await safeSendMessage(botInstance, chatId, "⚠️ I couldn't pin the current story.\nPlease enable 'Pin Messages' permission.");
  }

  await Story.findByIdAndUpdate(story._id, {
    $set: { pinnedMessageId: newMessage.message_id },
  });

  return newMessage;
}

function isValidReply(msg, story) {
  return Boolean(msg?.reply_to_message && msg.reply_to_message.message_id === story?.pinnedMessageId);
}

async function getCurrentPinnedMessageId(chatId) {
  try {
    const chat = await bot.getChat(chatId);
    return chat?.pinned_message?.message_id || null;
  } catch (error) {
    logError('Pinned message lookup failed', error);
    return null;
  }
}

async function hasRecoverableMissingPin(chatId, activeStories) {
  if (activeStories.length !== 1) {
    return null;
  }

  const [story] = activeStories;
  const currentPinnedMessageId = await getCurrentPinnedMessageId(chatId);

  return currentPinnedMessageId === story.pinnedMessageId ? null : story;
}

function scheduleStoryPreviewUpdate(storyId, chatId, delayMs = 2500) {
  if (!storyId || !Number.isFinite(chatId)) {
    return;
  }

  const key = storyId.toString();
  const existingTimer = previewUpdateTimers.get(key);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    previewUpdateTimers.delete(key);

    try {
      await updateStoryPreview(storyId, chatId);
    } catch (error) {
      logError('Story preview update failed', error);
    }
  }, delayMs);

  previewUpdateTimers.set(key, timer);
}

async function syncStoryVoteMarkup(story) {
  if (!story) {
    return;
  }

  const replyMarkup = createStoryVoteKeyboard(story._id.toString(), story.likes, story.dislikes);
  const updates = [];

  if (story.groupMessageId) {
    updates.push(
      safeEditMessageReplyMarkup(bot, replyMarkup, {
        chat_id: story.groupId,
        message_id: story.groupMessageId,
      })
    );
  }

  if (story.channelMessageId && process.env.CHANNEL_ID) {
    updates.push(
      safeEditMessageReplyMarkup(bot, replyMarkup, {
        chat_id: process.env.CHANNEL_ID,
        message_id: story.channelMessageId,
      })
    );
  }

  await Promise.all(updates);
}

async function handleStartStoryCommand(msg, language) {
  if (!msg?.chat?.id) {
    return;
  }

  if (!isGroupChat(msg.chat)) {
    await safeSendMessage(bot, msg.chat.id, GROUP_ONLY_MESSAGE);
    return;
  }

  const permissions = await checkBotAdminPermissions(bot, msg.chat.id);

  if (!permissions.ok) {
    await safeSendMessage(bot, msg.chat.id, ADMIN_PERMISSION_MESSAGE);
    return;
  }

  const result = await startStory(msg.chat.id, language);

  if (!result.success) {
    if (result.duplicate && result.story) {
      await handleStartIfExists(bot, msg.chat.id, result.story);
      return;
    }

    await safeSendMessage(bot, msg.chat.id, result.message);
    return;
  }

  await sendStartedStory(result);
}

async function endAllActiveStoriesForGroup(chatId) {
  const activeStories = await getActiveStoriesByGroup(chatId);

  if (!activeStories.length) {
    return {
      success: false,
      message: '❌ No active story to end.',
    };
  }

  const completed = [];

  for (const story of activeStories) {
    const result = await endActiveStory(story);

    if (result) {
      completed.push(result);
      await publishCompletedStory(bot, result.story, result.contributions);
    }
  }

  await recalculateBadgesAndRanks({ force: true });

  const sections = completed.length ? '✅ Story completed and published to the group and channel.' : '';

  return {
    success: true,
    message: sections || '❌ No active story to end.',
  };
}

bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    await safeSendMessage(
      bot,
      msg.chat.id,
      `👋 Welcome to StoryRank Bot!

📖 Create Hindi and English stories together with your group.

🚀 Commands:
/start_hindi_story - Start a Hindi story
/start_english_story - Start an English story
/leaderboard - View top players
/profile - View your rank and badges
/endstory - End active stories
/anime <name> - Search anime
/anime_home - Latest anime updates

✨ Send a Hindi line for the Hindi story or an English line for the English story.`,
      { reply_markup: createHomeKeyboard(msg.chat.type) }
    );
  } catch (error) {
    logError('/start handler failed', error);
    await sendFallback(msg?.chat?.id);
  }
});

bot.onText(/^\/help(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    await safeSendMessage(
      bot,
      msg.chat.id,
      HELP_MESSAGE,
      { reply_markup: createHomeKeyboard() }
    );
  } catch (error) {
    logError('/help handler failed', error);
    await sendFallback(msg?.chat?.id);
  }
});

bot.onText(/^\/start_hindi_story(?:@\w+)?$/, async (msg) => {
  try {
    await handleStartStoryCommand(msg, 'hindi');
  } catch (error) {
    logError('/start_hindi_story handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not start a Hindi story right now.\n\nPlease try again later.');
  }
});

bot.onText(/^\/start_english_story(?:@\w+)?$/, async (msg) => {
  try {
    await handleStartStoryCommand(msg, 'english');
  } catch (error) {
    logError('/start_english_story handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not start an English story right now.\n\nPlease try again later.');
  }
});

bot.onText(/^\/leaderboard(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    await safeSendMessage(bot, msg.chat.id, createLeaderboardMenuMessage(), {
      reply_markup: createLeaderboardKeyboard('group'),
    });
  } catch (error) {
    logError('/leaderboard handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not load the leaderboard.\n\nPlease try again later.');
  }
});

bot.onText(/^\/profile(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id || !msg?.from?.id) {
      return;
    }

    const profileMessage = await getUserProfileMessage(msg.from.id, msg.from.username);
    await safeSendMessage(bot, msg.chat.id, profileMessage);
  } catch (error) {
    logError('/profile handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not load your profile right now.');
  }
});

bot.onText(/^\/anime(?:@\w+)?\s+([\s\S]+)$/i, async (msg, match) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    const keyword = (match[1] || '').trim();

    if (!keyword) {
      await safeSendMessage(bot, msg.chat.id, 'Usage: /anime <anime name>');
      return;
    }

    const results = await searchAnime(keyword);
    await safeSendMessage(bot, msg.chat.id, formatAnimeSearchResults(keyword, results), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    logError('/anime handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, 'Could not search anime right now. Please try again later.');
  }
});

bot.onText(/^\/anime(?:@\w+)?$/i, async (msg) => {
  await safeSendMessage(bot, msg?.chat?.id, 'Usage: /anime <anime name>');
});

bot.onText(/^\/anime_home(?:@\w+)?$/i, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    const home = await scrapeHome();
    await safeSendMessage(bot, msg.chat.id, formatAnimeHome(home), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    logError('/anime_home handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, 'Could not load anime updates right now.');
  }
});

bot.onText(/^\/anime_info(?:@\w+)?\s+([\s\S]+)$/i, async (msg, match) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    const slug = (match[1] || '').trim();

    if (!slug) {
      await safeSendMessage(bot, msg.chat.id, 'Usage: /anime_info <slug>');
      return;
    }

    const anime = await scrapeAnimeInfo(slug);
    await safeSendMessage(bot, msg.chat.id, formatAnimeInfo(anime), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    logError('/anime_info handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, 'Could not load anime info right now.');
  }
});

bot.onText(/^\/anime_info(?:@\w+)?$/i, async (msg) => {
  await safeSendMessage(bot, msg?.chat?.id, 'Usage: /anime_info <slug>');
});

bot.onText(/^\/anime_eps(?:@\w+)?\s+([\w.-]+)$/i, async (msg, match) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    const animeId = (match[1] || '').trim();
    const episodes = await fetchEpisodes(animeId);
    await safeSendMessage(bot, msg.chat.id, formatAnimeEpisodes(animeId, episodes), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    logError('/anime_eps handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, 'Could not load episodes right now.');
  }
});

bot.onText(/^\/anime_eps(?:@\w+)?$/i, async (msg) => {
  await safeSendMessage(bot, msg?.chat?.id, 'Usage: /anime_eps <anime_id>');
});

bot.onText(/^\/editline(?:@\w+)?\s+(\d+)\s+([\s\S]+)$/i, async (msg, match) => {
  try {
    if (!msg?.chat?.id || !msg?.from?.id) {
      return;
    }

    if (!isGroupChat(msg.chat)) {
      await safeSendMessage(bot, msg.chat.id, GROUP_ONLY_MESSAGE);
      return;
    }

    const permissions = await checkUserAdminPermissions(bot, msg.chat.id, msg.from.id);

    if (!permissions.ok) {
      await safeSendMessage(bot, msg.chat.id, '❌ Only admins can edit story lines.');
      return;
    }

    const lineNumber = Number(match[1]);
    const newText = (match[2] || '').trim();

    if (!Number.isFinite(lineNumber) || lineNumber < 1 || !newText) {
      await safeSendMessage(bot, msg.chat.id, '❌ Usage: /editline <line_number> <new_text>');
      return;
    }

    const result = await editStoryLine({
      groupId: msg.chat.id,
      lineNumber,
      newText,
      replyToMessageId: msg.reply_to_message?.message_id,
    });

    if (!result.success) {
      await safeSendMessage(bot, msg.chat.id, result.message);
      return;
    }

    await logEditActivity(msg, result);

    if (!result.contribution.messageId) {
      await safeSendMessage(bot, msg.chat.id, '❌ This line cannot be edited because its message is missing.');
      return;
    }

    await bot.editMessageText(result.messageText, {
      chat_id: msg.chat.id,
      message_id: result.contribution.messageId,
      reply_markup: createVoteKeyboard(
        result.contribution._id.toString(),
        result.contribution.likes,
        result.contribution.dislikes
      ),
    });

    await safeSendMessage(bot, msg.chat.id, '✏️ Line updated successfully!');
    await updatePinnedStoryMessage(msg.chat.id, result.story._id);
    scheduleStoryPreviewUpdate(result.story._id, msg.chat.id);
  } catch (error) {
    logError('/editline handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not edit that line right now.');
  }
});

bot.onText(/^\/editline(?:@\w+)?$/i, async (msg) => {
  await safeSendMessage(bot, msg?.chat?.id, '❌ Usage: /editline <line_number> <new_text>');
});

bot.onText(/^\/edit_my_line(?:@\w+)?\s+([\s\S]+)$/i, async (msg, match) => {
  try {
    if (!msg?.chat?.id || !msg?.from?.id) {
      return;
    }

    if (!isGroupChat(msg.chat)) {
      await safeSendMessage(bot, msg.chat.id, GROUP_ONLY_MESSAGE);
      return;
    }

    const result = await editOwnStoryLine({
      groupId: msg.chat.id,
      userId: msg.from.id,
      newText: match[1],
      replyToMessageId: msg.reply_to_message?.message_id,
    });

    if (!result.success) {
      await safeSendMessage(bot, msg.chat.id, result.message);
      return;
    }

    await logEditActivity(msg, result);

    if (result.contribution.messageId) {
      await bot.editMessageText(result.messageText, {
        chat_id: msg.chat.id,
        message_id: result.contribution.messageId,
        reply_markup: createVoteKeyboard(
          result.contribution._id.toString(),
          result.contribution.likes,
          result.contribution.dislikes
        ),
      });
    }

    await safeSendMessage(bot, msg.chat.id, "✏️ Your line has been updated!");
    await updatePinnedStoryMessage(msg.chat.id, result.story._id);
    scheduleStoryPreviewUpdate(result.story._id, msg.chat.id);
  } catch (error) {
    logError('/edit_my_line handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not edit your line right now.');
  }
});

bot.onText(/^\/edit_my_line(?:@\w+)?$/i, async (msg) => {
  await safeSendMessage(bot, msg?.chat?.id, '❌ Usage: /edit_my_line <new_text>');
});

bot.onText(/^\/endstory(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    if (!isGroupChat(msg.chat)) {
      await safeSendMessage(bot, msg.chat.id, GROUP_ONLY_MESSAGE);
      return;
    }

    const admin = await checkUserAdminPermissions(bot, msg.chat.id, msg.from?.id);

    if (!admin.ok) {
      await safeSendMessage(bot, msg.chat.id, '❌ Only group admins can end active stories.');
      return;
    }

    const result = await endAllActiveStoriesForGroup(msg.chat.id);
    await safeSendMessage(bot, msg.chat.id, result.message, { reply_markup: createHomeKeyboard() });
  } catch (error) {
    logError('/endstory handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not end the story.\n\nPlease try again later.');
  }
});

bot.onText(/^\/story(?:@\w+)?$/, async (msg) => {
  try {
    if (!msg?.chat?.id) {
      return;
    }

    if (!isGroupChat(msg.chat)) {
      await safeSendMessage(bot, msg.chat.id, GROUP_ONLY_MESSAGE);
      return;
    }

    const activeStories = await getActiveStoriesByGroup(msg.chat.id);

    if (!activeStories.length) {
      await safeSendMessage(bot, msg.chat.id, '❌ No active story!');
      return;
    }

    for (const story of activeStories) {
      await recoverStory(bot, msg.chat.id, story, {
        title: '📖 Story So Far',
      });
    }
  } catch (error) {
    logError('/story handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, '❌ Could not recover the story right now.');
  }
});

bot.on('message', async (msg) => {
  try {
    if (!msg?.chat?.id || msg.from?.is_bot) {
      return;
    }

    await rememberGroup(msg.chat);

    const text = typeof msg.text === 'string' ? msg.text.trim() : '';

    if (!text) {
      return;
    }

    if (text.startsWith('/')) {
      const command = getCommand(text);

      if (command && !KNOWN_COMMANDS.has(command)) {
        await safeSendMessage(bot, msg.chat.id, '⚠️ Unknown command.\n\nUse /help to see what I can do.');
      }

      return;
    }

    const replyToMessageId = msg.reply_to_message?.message_id;

    if (!Number.isFinite(replyToMessageId)) {
      return;
    }

    if (!isGroupChat(msg.chat)) {
      return;
    }

    const story = await getActiveStoryByPinnedMessage(msg.chat.id, replyToMessageId);

    if (!story || !isValidReply(msg, story)) {
      const activeStories = await getActiveStoriesByGroup(msg.chat.id);
      const storyToRecover = await hasRecoverableMissingPin(msg.chat.id, activeStories);

      if (storyToRecover) {
        await recoverStory(bot, msg.chat.id, storyToRecover);
      }

      return;
    }

    const result = await addStoryContribution({
      groupId: msg.chat.id,
      userId: msg.from?.id,
      username: msg.from?.username,
      firstName: msg.from?.first_name,
      text,
      replyToMessageId,
    });

    if (result.success && result.contribution) {
      await logContributionActivity(msg, result);

      const lineMessage = await safeSendMessage(bot, msg.chat.id, result.formattedLineMessage, {
        reply_to_message_id: result.replyToContributionMessageId,
        allow_sending_without_reply: true,
        reply_markup: createVoteKeyboard(
          result.contribution._id.toString(),
          result.contribution.likes,
          result.contribution.dislikes
        ),
      });

      if (lineMessage) {
        await attachContributionMessage({
          contributionId: result.contribution._id,
          storyId: result.story._id,
          messageId: lineMessage.message_id,
        });
        await updatePinnedStoryMessage(msg.chat.id, result.story._id);
        scheduleStoryPreviewUpdate(result.story._id, msg.chat.id);
        await sendLiveLeaderboardUpdate(bot, msg.chat.id, msg.from.id);
      } else {
        await safeSendMessage(bot, msg.chat.id, result.message);
      }
      return;
    }

    if (!result.ignore && result.message) {
      await safeSendMessage(bot, msg.chat.id, result.message, { reply_markup: createHomeKeyboard() });
    }
  } catch (error) {
    logError('message handler failed', error);
    await safeSendMessage(bot, msg?.chat?.id, FALLBACK_MESSAGE);
  }
});

bot.on('callback_query', async (query) => {
  try {
    if (!query?.id || !query.from?.id) {
      return;
    }

    const callbackData = typeof query.data === 'string' ? query.data : '';

    if (callbackData === 'help') {
      await safeAnswerCallbackQuery(bot, query.id);
      await safeSendMessage(bot, query.message?.chat?.id, HELP_MESSAGE, {
        reply_markup: createHomeKeyboard(query.message?.chat?.type),
      });
      return;
    }

    if (callbackData === 'action_leaderboard') {
      await safeAnswerCallbackQuery(bot, query.id);
      await safeSendMessage(bot, query.message?.chat?.id, createLeaderboardMenuMessage(), {
        reply_markup: createLeaderboardKeyboard('group'),
      });
      return;
    }

    const leaderboardMatch = callbackData.match(/^leaderboard_(group|user)_(daily|weekly|monthly)$/);

    if (leaderboardMatch) {
      const [, type, filter] = leaderboardMatch;
      const leaderboardMessage = await getLeaderboardMessage({
        bot,
        type,
        filter,
      });

      await safeAnswerCallbackQuery(bot, query.id);
      await safeSendMessage(bot, query.message?.chat?.id, leaderboardMessage, {
        reply_markup: createLeaderboardKeyboard(type),
      });
      return;
    }

    if (callbackData === 'action_start_hindi_story' || callbackData === 'action_start_english_story') {
      const language = callbackData === 'action_start_hindi_story' ? 'hindi' : 'english';

      await safeAnswerCallbackQuery(bot, query.id, {
        text: `Send /start_${language}_story in the group to begin.`,
      });
      return;
    }

    const storyVoteMatch = callbackData.match(/^vote_story_([a-f\d]{24})_(like|dislike)$/i);

    if (storyVoteMatch) {
      const [, storyId, voteType] = storyVoteMatch;
      const { voteForStory } = require('../services/voteService');
      const result = await voteForStory({
        storyId,
        userId: query.from.id,
        type: voteType,
      });

      await safeAnswerCallbackQuery(bot, query.id, {
        text: result.message,
        show_alert: !result.success,
      });

      if (result.success && result.story) {
        await syncStoryVoteMarkup(result.story);
        await logVoteActivity(query, result.story._id, voteType);
      }

      return;
    }

    if (
      !callbackData.startsWith('vote_') &&
      !callbackData.startsWith('like_') &&
      !callbackData.startsWith('dislike_')
    ) {
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    const voteType = callbackData.startsWith('dislike_') ? 'dislike' : 'like';
    const contributionId = callbackData.replace(/^(vote|like|dislike)_/, '');
    const { voteForContribution } = require('../services/voteService');
    const result = await voteForContribution({
      contributionId,
      userId: query.from.id,
      type: voteType,
    });

    await safeAnswerCallbackQuery(bot, query.id, {
      text: result.message,
      show_alert: !result.success,
    });

    if (!result.success || !query.message || !result.contribution) {
      return;
    }

    await safeEditMessageReplyMarkup(
      bot,
      createVoteKeyboard(contributionId, result.contribution.likes, result.contribution.dislikes),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );

    await sendLiveLeaderboardUpdate(bot, query.message.chat.id, result.contribution.userId);
    await logVoteActivity(query, result.contribution.storyId, voteType);
  } catch (error) {
    logError('callback_query handler failed', error);
    await safeAnswerCallbackQuery(bot, query?.id, {
      text: FALLBACK_MESSAGE.replace(/\n\n/g, ' '),
      show_alert: true,
    });
  }
});

bot.on('polling_error', (error) => {
  logError('Telegram polling error', error);
});

bot.on('webhook_error', (error) => {
  logError('Telegram webhook error', error);
});

module.exports = bot;
