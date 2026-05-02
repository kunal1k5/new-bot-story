const { botMessages } = require('../utils/messages');
const { startStory } = require('../services/storyService');

function setupCommands(bot) {
  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, botMessages.start);
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id, botMessages.help);
  });

  bot.onText(/\/start_hindi_story/, async (msg) => {
    const result = await startStory(msg.chat.id, 'hindi');

    await bot.sendMessage(msg.chat.id, result.message);
  });

  bot.onText(/\/start_english_story/, async (msg) => {
    const result = await startStory(msg.chat.id, 'english');

    await bot.sendMessage(msg.chat.id, result.message);
  });
}

module.exports = {
  setupCommands,
};
