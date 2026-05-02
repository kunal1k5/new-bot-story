function getChannelButton(label = '📢 Join Channel') {
  const url = process.env.PUBLIC_CHANNEL_LINK;

  if (!url) {
    return null;
  }

  return {
    text: label,
    url,
  };
}

function appendChannelButton(replyMarkup = {}, label = '📢 Join Channel') {
  const channelButton = getChannelButton(label);
  const inlineKeyboard = Array.isArray(replyMarkup.inline_keyboard) ? [...replyMarkup.inline_keyboard] : [];

  if (channelButton) {
    inlineKeyboard.push([channelButton]);
  }

  if (!inlineKeyboard.length) {
    return undefined;
  }

  return {
    ...replyMarkup,
    inline_keyboard: inlineKeyboard,
  };
}

module.exports = {
  appendChannelButton,
  getChannelButton,
};
