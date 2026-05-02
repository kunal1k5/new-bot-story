const { logError } = require('./errorHandler');

const ADMIN_PERMISSION_MESSAGE = `⚠️ Please make me an admin to start the story!

I need permissions:
📌 Pin messages
🗑 Delete messages`;

let cachedBotId = null;

async function getBotId(bot) {
  if (cachedBotId) {
    return cachedBotId;
  }

  const me = await bot.getMe();
  cachedBotId = me.id;

  return cachedBotId;
}

async function checkBotAdminPermissions(bot, chatId) {
  try {
    const botId = await getBotId(bot);
    const member = await bot.getChatMember(chatId, botId);

    if (member.status === 'creator') {
      return { ok: true, member };
    }

    const ok =
      member.status === 'administrator' &&
      Boolean(member.can_pin_messages) &&
      Boolean(member.can_delete_messages);

    return { ok, member };
  } catch (error) {
    logError('Bot admin permission check failed', error);
    return { ok: false, error };
  }
}

async function checkUserAdminPermissions(bot, chatId, userId) {
  if (!Number.isFinite(userId)) {
    return { ok: false };
  }

  try {
    const member = await bot.getChatMember(chatId, userId);
    return {
      ok: ['creator', 'administrator'].includes(member.status),
      member,
    };
  } catch (error) {
    logError('User admin permission check failed', error);
    return { ok: false, error };
  }
}

module.exports = {
  ADMIN_PERMISSION_MESSAGE,
  checkBotAdminPermissions,
  checkUserAdminPermissions,
};
