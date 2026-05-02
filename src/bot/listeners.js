const { addContribution } = require('../services/storyService');

function setupListeners(bot) {
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) {
      return;
    }

    const contribution = await addContribution({
      userId: msg.from.id,
      username: msg.from.username,
      firstName: msg.from.first_name,
      text: msg.text,
      storyId: null,
    });

    if (contribution.message) {
      await bot.sendMessage(msg.chat.id, contribution.message);
    }
  });
}

module.exports = {
  setupListeners,
};
