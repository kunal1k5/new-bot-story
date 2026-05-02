const Story = require('../database/models/Story');
const Contribution = require('../database/models/Contribution');
const User = require('../database/models/User');
const {
  detectLanguage,
  getLanguageLabel,
  getWrongLanguageMessage,
  isSupportedLanguage,
  isTextAllowedForLanguage,
} = require('../utils/language');
const { getUniqueStarter } = require('../utils/storyStarters');

const MAX_CONTRIBUTION_LENGTH = 200;
const STORY_LANGUAGES = ['hindi', 'english'];

async function getActiveStoryByGroup(groupId, language) {
  if (!Number.isFinite(groupId)) {
    return null;
  }

  const query = { groupId, status: 'active' };

  if (language) {
    query.language = language;
  } else {
    query.language = { $in: STORY_LANGUAGES };
  }

  return Story.findOne(query);
}

async function getActiveStoriesByGroup(groupId) {
  if (!Number.isFinite(groupId)) {
    return [];
  }

  return Story.find({ groupId, status: 'active', language: { $in: STORY_LANGUAGES } }).sort({ language: 1 });
}

async function getActiveStoryByPinnedMessage(groupId, pinnedMessageId) {
  if (!Number.isFinite(groupId) || !Number.isFinite(pinnedMessageId)) {
    return null;
  }

  return Story.findOne({
    groupId,
    pinnedMessageId,
    status: 'active',
    language: { $in: STORY_LANGUAGES },
  });
}

function formatContributorName({ userId, username, firstName }) {
  if (username) {
    return `@${username}`;
  }

  return firstName || `User ${userId}`;
}

function formatFinalStory(contributions) {
  if (!contributions.length) {
    return 'No lines were added to this story.';
  }

  const cleanedLines = contributions
    .map((contribution) => String(contribution.text || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  if (!cleanedLines.length) {
    return 'No lines were added to this story.';
  }

  return cleanedLines.join('\n\n');
}

async function generateStoryPreview(storyId) {
  const lines = await Contribution.find({ storyId }).sort({ lineNumber: 1, createdAt: 1 });

  let text = '📖 Story So Far:\n\n';

  if (!lines.length) {
    text += 'No lines yet.\n';
  } else {
    lines.forEach((line, index) => {
      text += `${index + 1}. ${line.text}\n`;
    });
  }

  text += '\n✨ Continue by replying to pinned message!';

  return text;
}

async function generatePinnedStoryMessage(storyId) {
  const story = await Story.findById(storyId);
  const lines = await Contribution.find({ storyId }).sort({ lineNumber: 1, createdAt: 1 });
  const label = story?.language === 'hindi' ? 'हिंदी कहानी' : `${getLanguageLabel(story?.language)} Story`;

  let text = `📖 ${label}:\n\n`;

  if (!lines.length) {
    text += 'No lines yet.\n';
  } else {
    lines.forEach((line, index) => {
      text += `${index + 1}. ${line.text}\n`;
    });
  }

  text += '\n✨ Continue by replying to this pinned message!';

  return text;
}

function findBestLine(contributions) {
  if (!contributions.length) {
    return null;
  }

  return [...contributions].sort((a, b) => {
    const scoreA = (a.likes ?? a.votes ?? 0) - (a.dislikes ?? 0);
    const scoreB = (b.likes ?? b.votes ?? 0) - (b.dislikes ?? 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return a.createdAt - b.createdAt;
  })[0];
}

function getStartMessage(language, firstLine) {
  if (language === 'hindi') {
    return `📖 हिंदी कहानी शुरू!

पहली लाइन: ${firstLine}

✍️ अपनी लाइन जोड़ें`;
  }

  return `📖 English Story Started!

Line 1: ${firstLine}

✍️ Continue the story!`;
}

function getNoActiveStoryMessage() {
  return `📭 No active story!

Use /start_hindi_story or /start_english_story to begin.`;
}

function getAlreadyRunningMessage(language) {
  return `⚠️ A ${getLanguageLabel(language)} story is already running!

Send your line to join the fun.`;
}

function buildFinalStoryMessage(language, contributions) {
  const label = getLanguageLabel(language);
  const finalStory = formatFinalStory(contributions);
  const bestLine = findBestLine(contributions);
  const bestLineScore = bestLine ? (bestLine.likes ?? bestLine.votes ?? 0) - (bestLine.dislikes ?? 0) : 0;
  const bestLineText = bestLine
    ? `🔥 Best Line:
'${bestLine.text}' (${bestLineScore} pts)`
    : '🔥 Best Line:\nNo votes yet.';

  return `📖 ${label} Story completed!

📚 Final Story:

${finalStory}

${bestLineText}

🎉 Great job everyone!`;
}

async function startStory(groupId, language, options = {}) {
  if (!Number.isFinite(groupId) || !isSupportedLanguage(language)) {
    return {
      success: false,
      message: '❌ Could not start a story right now.\n\nPlease try again later.',
    };
  }

  const activeStory = await getActiveStoryByGroup(groupId, language);

  if (activeStory) {
    return {
      success: false,
      duplicate: true,
      story: activeStory,
      message: getAlreadyRunningMessage(language),
    };
  }

  const firstLine = options.firstLine || (await getUniqueStarter(groupId, language));

  try {
    const story = await Story.create({
      groupId,
      language,
      starterLine: firstLine,
      status: 'active',
      startTime: new Date(),
    });

    const firstContribution = await Contribution.create({
      userId: 0,
      username: 'StoryBot',
      storyId: story._id,
      text: firstLine,
      votes: 0,
      likes: 0,
      dislikes: 0,
      lineNumber: 1,
    });

    story.totalLines = 1;
    await story.save();

    return {
      success: true,
      story,
      firstContribution,
      firstLine,
      message: getStartMessage(language, firstLine),
    };
  } catch (error) {
    if (error.code === 11000) {
      return {
        success: false,
        duplicate: true,
        message: getAlreadyRunningMessage(language),
      };
    }

    throw error;
  }
}

function chooseStoryForContribution(activeStories, cleanText) {
  if (activeStories.length === 1) {
    const [story] = activeStories;

    return { story };
  }

  const detectedLanguage = detectLanguage(cleanText);

  if (!detectedLanguage) {
    return {
      errorMessage: '⚠️ Please continue in Hindi or English only!',
    };
  }

  const matchingStory = activeStories.find((story) => story.language === detectedLanguage);

  if (!matchingStory) {
    return {
      errorMessage: getWrongLanguageMessage(activeStories[0]?.language),
    };
  }

  return { story: matchingStory };
}

function getStrictWrongLanguageMessage(language) {
  if (language === 'hindi') {
    return '⚠️ Please write in Hindi only!';
  }

  if (language === 'english') {
    return '⚠️ Please write in English only!';
  }

  return '⚠️ Please write in Hindi or English only!';
}

async function addStoryContribution({ groupId, userId, username, firstName, text, replyToMessageId }) {
  if (!Number.isFinite(groupId) || !Number.isFinite(userId) || typeof text !== 'string') {
    return {
      success: false,
      message: '❌ Something went wrong.\n\nPlease try again later.',
    };
  }

  const cleanText = text.trim().replace(/\s+/g, ' ');

  if (!cleanText) {
    return {
      success: false,
      ignore: true,
    };
  }

  if (cleanText.length > MAX_CONTRIBUTION_LENGTH) {
    return {
      success: false,
      message: `⚠️ Your line is a bit too long.

Keep it under ${MAX_CONTRIBUTION_LENGTH} characters.`,
    };
  }

  if (!Number.isFinite(replyToMessageId)) {
    return {
      success: false,
      message: '⚠️ Please reply to the pinned story message to add your line.',
    };
  }

  const activeStory = await getActiveStoryByPinnedMessage(groupId, replyToMessageId);

  if (!activeStory) {
    return {
      success: false,
      message: '⚠️ Please reply to the pinned story message to add your line.',
    };
  }

  const existingContribution = await Contribution.findOne({
    storyId: activeStory._id,
    userId,
  }).select('_id');

  if (existingContribution) {
    return {
      success: false,
      message: `⚠️ You already added your line!
Let others continue the story.`,
    };
  }

  let contribution;
  let updatedStory;
  const lineNumber = activeStory.totalLines + 1;
  const replyToContributionMessageId = activeStory.lastContributionMessageId || activeStory.pinnedMessageId;

  try {
    contribution = await Contribution.create({
      userId,
      username: username || '',
      storyId: activeStory._id,
      text: cleanText,
      votes: 0,
      likes: 0,
      dislikes: 0,
      lineNumber,
    });

    [updatedStory] = await Promise.all([
      Story.findByIdAndUpdate(activeStory._id, { $inc: { totalLines: 1 } }, { new: true }),
      User.findOneAndUpdate(
        { userId },
        {
          $set: { username: username || '' },
          $inc: {
            totalContributions: 1,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      ),
    ]);
  } catch (error) {
    if (error.code === 11000) {
      return {
        success: false,
        message: `⚠️ You already added your line!
Let others continue the story.`,
      };
    }

    throw error;
  }

  return {
    success: true,
    contribution,
    story: updatedStory,
    lineNumber,
    replyToContributionMessageId,
    formattedLineMessage: formatContributionMessage({
      lineNumber,
      text: cleanText,
      username,
      firstName,
      userId,
    }),
    message: `✅ Line added successfully!

📖 Total Lines: ${updatedStory.totalLines}
👤 Added by: ${formatContributorName({ userId, username, firstName })}`,
  };
}

function formatContributionMessage({ lineNumber, text, username, firstName, userId }) {
  return `📖 Line ${lineNumber}: ${text}

👤 ${formatContributorName({ userId, username, firstName })}`;
}

async function attachContributionMessage({ contributionId, storyId, messageId }) {
  if (!contributionId || !storyId || !Number.isFinite(messageId)) {
    return null;
  }

  const [contribution] = await Promise.all([
    Contribution.findByIdAndUpdate(contributionId, { $set: { messageId } }, { new: true }),
    Story.findByIdAndUpdate(storyId, { $set: { lastContributionMessageId: messageId } }),
  ]);

  return contribution;
}

async function attachFirstLineMessage({ storyId, contributionId, messageId }) {
  if (!storyId || !contributionId || !Number.isFinite(messageId)) {
    return null;
  }

  const [story] = await Promise.all([
    Story.findByIdAndUpdate(
      storyId,
      {
        $set: {
          pinnedMessageId: messageId,
          lastContributionMessageId: messageId,
        },
      },
      { new: true }
    ),
    Contribution.findByIdAndUpdate(contributionId, { $set: { messageId, lineNumber: 1 } }),
  ]);

  return story;
}

async function attachStoryPreviewMessage({ storyId, messageId }) {
  if (!storyId || !Number.isFinite(messageId)) {
    return null;
  }

  return Story.findByIdAndUpdate(storyId, { $set: { storyPreviewMessageId: messageId } }, { new: true });
}

async function findEditableContribution({ groupId, lineNumber, replyToMessageId }) {
  if (!Number.isFinite(groupId) || !Number.isFinite(lineNumber)) {
    return null;
  }

  const activeStories = await getActiveStoriesByGroup(groupId);
  const storyIds = activeStories.map((story) => story._id);

  if (!storyIds.length) {
    return null;
  }

  if (Number.isFinite(replyToMessageId)) {
    return Contribution.findOne({
      storyId: { $in: storyIds },
      lineNumber,
      messageId: replyToMessageId,
    });
  }

  const matches = await Contribution.find({
    storyId: { $in: storyIds },
    lineNumber,
  }).limit(2);

  if (matches.length > 1) {
    return {
      ambiguous: true,
    };
  }

  return matches[0] || null;
}

async function editStoryLine({ groupId, lineNumber, newText, replyToMessageId }) {
  const contribution = await findEditableContribution({ groupId, lineNumber, replyToMessageId });

  if (contribution?.ambiguous) {
    return {
      success: false,
      message: '❌ Please reply to the exact story line you want to edit.',
    };
  }

  if (!contribution) {
    return {
      success: false,
      message: '❌ Could not find that story line.',
    };
  }

  const cleanText = newText.trim().replace(/\s+/g, ' ');

  if (!cleanText) {
    return {
      success: false,
      message: '❌ Usage: /editline <line_number> <new_text>',
    };
  }

  if (cleanText.length > MAX_CONTRIBUTION_LENGTH) {
    return {
      success: false,
      message: `⚠️ Your line is a bit too long.\n\nKeep it under ${MAX_CONTRIBUTION_LENGTH} characters.`,
    };
  }

  const story = await Story.findById(contribution.storyId);

  if (!story || story.status !== 'active') {
    return {
      success: false,
      message: '❌ You can edit only while the story is active.',
    };
  }

  const oldText = contribution.text;

  contribution.text = cleanText;
  await contribution.save();

  return {
    success: true,
    contribution,
    story,
    oldText,
    newText: cleanText,
    messageText: formatContributionMessage({
      lineNumber: contribution.lineNumber,
      text: cleanText,
      username: contribution.username,
      userId: contribution.userId,
    }),
  };
}

async function findOwnEditableContribution({ groupId, userId, newText, replyToMessageId }) {
  const activeStories = await getActiveStoriesByGroup(groupId);

  if (!activeStories.length) {
    return { noActiveStory: true };
  }

  const storyIds = activeStories.map((story) => story._id);

  if (Number.isFinite(replyToMessageId)) {
    const repliedStory =
      activeStories.find((story) => story.pinnedMessageId === replyToMessageId) ||
      activeStories.find((story) => story.storyPreviewMessageId === replyToMessageId);

    if (repliedStory) {
      const contribution = await Contribution.findOne({
        storyId: repliedStory._id,
        userId,
      });

      return { contribution, story: repliedStory };
    }

    const repliedContribution = await Contribution.findOne({
      storyId: { $in: storyIds },
      messageId: replyToMessageId,
    });

    if (repliedContribution) {
      const story = activeStories.find((item) => item._id.equals(repliedContribution.storyId));
      const contribution = await Contribution.findOne({
        storyId: repliedContribution.storyId,
        userId,
      });

      return { contribution, story };
    }
  }

  const contributions = await Contribution.find({
    storyId: { $in: storyIds },
    userId,
  });

  if (!contributions.length) {
    return { contribution: null };
  }

  if (contributions.length === 1) {
    const [contribution] = contributions;
    const story = activeStories.find((item) => item._id.equals(contribution.storyId));

    return { contribution, story };
  }

  return { ambiguous: true };
}

async function editOwnStoryLine({ groupId, userId, newText, replyToMessageId }) {
  if (!Number.isFinite(groupId) || !Number.isFinite(userId) || typeof newText !== 'string') {
    return {
      success: false,
      message: '❌ Something went wrong.\n\nPlease try again later.',
    };
  }

  const cleanText = newText.trim().replace(/\s+/g, ' ');

  if (!cleanText) {
    return {
      success: false,
      message: '❌ Usage: /edit_my_line <new_text>',
    };
  }

  if (cleanText.length > MAX_CONTRIBUTION_LENGTH) {
    return {
      success: false,
      message: `⚠️ Your line is a bit too long.\n\nKeep it under ${MAX_CONTRIBUTION_LENGTH} characters.`,
    };
  }

  const result = await findOwnEditableContribution({
    groupId,
    userId,
    newText: cleanText,
    replyToMessageId,
  });

  if (result.noActiveStory) {
    return {
      success: false,
      message: '❌ You can edit only while the story is active.',
    };
  }

  if (result.ambiguous) {
    return {
      success: false,
      message: '❌ Please reply to the pinned story message for the line you want to edit.',
    };
  }

  if (!result.contribution) {
    return {
      success: false,
      message: "❌ You haven't added any line yet.",
    };
  }

  if (!result.story || result.story.status !== 'active') {
    return {
      success: false,
      message: '❌ You can edit only while the story is active.',
    };
  }

  const oldText = result.contribution.text;

  result.contribution.text = cleanText;
  await result.contribution.save();

  return {
    success: true,
    contribution: result.contribution,
    story: result.story,
    oldText,
    newText: cleanText,
    messageText: formatContributionMessage({
      lineNumber: result.contribution.lineNumber,
      text: cleanText,
      username: result.contribution.username,
      userId: result.contribution.userId,
    }),
  };
}

async function endStory(groupId, language) {
  if (!Number.isFinite(groupId)) {
    return {
      success: false,
      message: '❌ No active story to end.',
    };
  }

  const activeStory = await getActiveStoryByGroup(groupId, language);

  if (!activeStory) {
    return {
      success: false,
      message: '❌ No active story to end.',
    };
  }

  const contributions = await Contribution.find({ storyId: activeStory._id }).sort({ createdAt: 1 });

  activeStory.status = 'completed';
  activeStory.endTime = new Date();
  await activeStory.save();

  return {
    success: true,
    story: activeStory,
    contributions,
    bestLine: findBestLine(contributions),
    message: buildFinalStoryMessage(activeStory.language, contributions),
  };
}

async function endActiveStory(story) {
  const completedStory = await Story.findOneAndUpdate(
    {
      _id: story._id,
      status: 'active',
    },
    {
      $set: {
        status: 'completed',
        endTime: new Date(),
      },
    },
    { new: true }
  );

  if (!completedStory) {
    return null;
  }

  const contributions = await Contribution.find({ storyId: completedStory._id }).sort({ createdAt: 1 });

  return {
    story: completedStory,
    contributions,
    message: buildFinalStoryMessage(completedStory.language, contributions),
  };
}

module.exports = {
  MAX_CONTRIBUTION_LENGTH,
  STORY_LANGUAGES,
  addStoryContribution,
  attachContributionMessage,
  attachFirstLineMessage,
  attachStoryPreviewMessage,
  buildFinalStoryMessage,
  editOwnStoryLine,
  editStoryLine,
  endActiveStory,
  endStory,
  findBestLine,
  formatFinalStory,
  generatePinnedStoryMessage,
  generateStoryPreview,
  getActiveStoriesByGroup,
  getActiveStoryByPinnedMessage,
  getActiveStoryByGroup,
  getStartMessage,
  startStory,
};
