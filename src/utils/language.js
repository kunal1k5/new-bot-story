const FIRST_LINES = {
  hindi: [
    'एक दिन अचानक कुछ अजीब हुआ...',
    'पुरानी हवेली के दरवाजे ने खुद ही आवाज की...',
    'सुबह की पहली किरण के साथ एक रहस्य खुला...',
    'गांव की गली में आज कुछ अलग सन्नाटा था...',
    'बारिश रुकते ही आसमान में एक अनोखी रोशनी चमकी...',
    'रात के ठीक बारह बजे किसी ने खिड़की खटखटाई...',
    'पुरानी किताब खुलते ही कमरे में हवा बदल गई...',
    'मेले में खोया हुआ बच्चा एक नक्शा लेकर लौटा...',
  ],
  english: [
    'One day, something unexpected happened...',
    'The old clock stopped at exactly midnight...',
    'A strange letter arrived with no sender name...',
    'The quiet street suddenly filled with blue light...',
    'Nobody knew why the locked door was open...',
    'The first rain of the season brought a secret...',
    'A forgotten map slipped out of the dusty book...',
    'At sunrise, the whole town heard a mysterious bell...',
  ],
};

const LANGUAGE_LABELS = {
  hindi: 'Hindi',
  english: 'English',
};

function isSupportedLanguage(language) {
  return ['hindi', 'english'].includes(language);
}

function getLanguageLabel(language) {
  return LANGUAGE_LABELS[language] || 'Story';
}

function getDailyFirstLine(language, date = new Date()) {
  const lines = FIRST_LINES[language] || FIRST_LINES.english;
  const dayNumber = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
  const index = dayNumber % lines.length;

  return lines[index];
}

function hasHindiText(text = '') {
  return /[\u0900-\u097F]/.test(text);
}

function hasEnglishText(text = '') {
  return /[A-Za-z]/.test(text);
}

function isHindiText(text = '') {
  return hasHindiText(text) && !hasEnglishText(text);
}

function isEnglishText(text = '') {
  return hasEnglishText(text) && !hasHindiText(text);
}

function detectLanguage(text = '') {
  if (isHindiText(text)) {
    return 'hindi';
  }

  if (isEnglishText(text)) {
    return 'english';
  }

  return null;
}

function isTextAllowedForLanguage(text, language) {
  if (language === 'hindi') {
    return isHindiText(text);
  }

  if (language === 'english') {
    return isEnglishText(text);
  }

  return false;
}

function getWrongLanguageMessage(language) {
  if (language === 'hindi') {
    return '⚠️ Please continue in Hindi only!';
  }

  if (language === 'english') {
    return '⚠️ Please continue in English only!';
  }

  return '⚠️ Please continue in Hindi or English only!';
}

module.exports = {
  FIRST_LINES,
  detectLanguage,
  getDailyFirstLine,
  getLanguageLabel,
  getWrongLanguageMessage,
  isSupportedLanguage,
  isTextAllowedForLanguage,
};
