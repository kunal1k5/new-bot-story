const FALLBACK_MESSAGE = '❌ Something went wrong.\n\nPlease try again later.';

function logError(context, error) {
  const errorMessage = error?.message || String(error);
  const stack = error?.stack || 'No stack trace available';

  console.error(`[${context}] ${errorMessage}`);
  console.error(stack);
}

function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason) => {
    logError('Unhandled Promise Rejection', reason);
  });

  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', error);
  });
}

async function safeSendMessage(bot, chatId, message = FALLBACK_MESSAGE, options = {}) {
  if (!bot || !chatId || !message) {
    return null;
  }

  try {
    return await bot.sendMessage(chatId, message, options);
  } catch (error) {
    logError('Telegram sendMessage failed', error);
    return null;
  }
}

async function safeAnswerCallbackQuery(bot, callbackQueryId, options = {}) {
  if (!bot || !callbackQueryId) {
    return null;
  }

  try {
    return await bot.answerCallbackQuery(callbackQueryId, options);
  } catch (error) {
    logError('Telegram answerCallbackQuery failed', error);
    return null;
  }
}

async function safeEditMessageReplyMarkup(bot, replyMarkup, options = {}) {
  if (!bot || !replyMarkup || !options.chat_id || !options.message_id) {
    return null;
  }

  try {
    return await bot.editMessageReplyMarkup(replyMarkup, options);
  } catch (error) {
    logError('Telegram editMessageReplyMarkup failed', error);
    return null;
  }
}

module.exports = {
  FALLBACK_MESSAGE,
  logError,
  safeAnswerCallbackQuery,
  safeEditMessageReplyMarkup,
  safeSendMessage,
  setupGlobalErrorHandlers,
};
