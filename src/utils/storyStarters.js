const BotGroup = require('../database/models/BotGroup');

const hindiStarters = [
  'एक दिन अचानक कुछ अजीब हुआ...',
  'एक लड़का जंगल में रास्ता भटक गया...',
  'एक पुराना दरवाज़ा अपने आप खुल गया...',
  'एक लड़की को एक रहस्यमयी चिट्ठी मिली...',
  'एक गांव में अजीब घटनाएं होने लगीं...',
  'एक आदमी को रात में किसी ने पुकारा...',
  'एक बच्चा अचानक गायब हो गया...',
  'एक ट्रेन बिना ड्राइवर के चलने लगी...',
  'एक कुत्ता इंसानों की तरह बोलने लगा...',
  'एक नक्शा एक गुप्त जगह दिखा रहा था...',
  'एक पेड़ के अंदर से रोशनी आ रही थी...',
  'एक दिन सूरज नहीं उगा...',
  'एक आईना भविष्य दिखाने लगा...',
  'एक आदमी को अपना हमशक्ल मिला...',
  'एक घर में कोई छुपा हुआ था...',
  'एक किताब खुद पढ़ने लगी...',
  'एक लड़की को जादुई शक्ति मिल गई...',
  'एक आदमी समय में पीछे चला गया...',
  'एक फोन से अजीब आवाजें आने लगीं...',
  'एक शहर अचानक गायब हो गया...',
  'एक पुरानी घड़ी उल्टी दिशा में चलने लगी...',
  'एक स्कूल में रात को रोशनी जल रही थी...',
  'एक नदी ने अपना रास्ता बदल दिया...',
  'एक बच्चे को आसमान से संदेश मिला...',
  'एक ताला बिना चाबी के खुल गया...',
  'एक मोमबत्ती कभी बुझती ही नहीं थी...',
  'एक तस्वीर में लोग हिलने लगे...',
  'एक खाली कमरे से हंसी सुनाई दी...',
  'एक पुल आधी रात को दिखाई देता था...',
  'एक बूढ़े आदमी ने गुप्त भविष्यवाणी की...',
  'एक बैग में अनंत चीजें छुपी थीं...',
  'एक चिड़िया ने खजाने का पता बताया...',
  'एक दीवार पर नया दरवाज़ा बन गया...',
  'एक राजा की खोई हुई मुहर मिल गई...',
  'एक लड़की ने सपने में सच देखा...',
  'एक पहाड़ के अंदर शहर मिला...',
  'एक गांव पर नीली बारिश होने लगी...',
  'एक नाव सूखी ज़मीन पर चलने लगी...',
  'एक बच्चे की परछाई अलग हो गई...',
  'एक रहस्यमयी दुकान सिर्फ रात में खुलती थी...',
  'एक बादल ज़मीन पर उतर आया...',
  'एक आदमी को बोलता हुआ पत्थर मिला...',
  'एक बगीचे में समय रुक गया...',
  'एक खिड़की दूसरे संसार में खुलती थी...',
  'एक चाबी ने अपना मालिक चुन लिया...',
  'एक बस अजनबी शहर में पहुंच गई...',
  'एक गुड़िया ने आंखें खोल दीं...',
  'एक डाकिया सौ साल पुराना पत्र लाया...',
  'एक झील में सितारे चमक रहे थे...',
  'एक घर हर रात अपनी जगह बदलता था...',
  'एक बच्चा किसी की यादें सुन सकता था...',
  'एक मंदिर की घंटी खुद बजने लगी...',
  'एक कमरे में बारिश होने लगी...',
  'एक लड़की को अदृश्य दोस्त मिला...',
  'एक बंद किताब से संगीत आने लगा...',
  'एक पुराने रेडियो ने कल की खबर सुनाई...',
  'एक किसान को सोने का बीज मिला...',
  'एक सड़क अचानक समुद्र तक जाने लगी...',
  'एक डिब्बे में छोटा सा ब्रह्मांड था...',
  'एक जादुई पेन से लिखी बात सच हो जाती थी...',
  'एक लड़का अपनी आवाज़ खो बैठा...',
  'एक जंगल में पेड़ नाम लेकर बुलाते थे...',
  'एक गांव में कोई बूढ़ा नहीं होता था...',
  'एक अजनबी ने दरवाज़े पर तीन सवाल छोड़े...',
  'एक छतरी उड़कर बादलों तक पहुंच गई...',
  'एक घड़ी ने किसी की जिंदगी गिननी शुरू की...',
  'एक लड़की को धरती के नीचे रास्ता मिला...',
  'एक बाजार में यादें खरीदी जाती थीं...',
  'एक पुराने कुएं से रोशनी निकली...',
  'एक बच्चे को चांद से दोस्ती हो गई...',
  'एक कक्षा में खाली कुर्सी जवाब देने लगी...',
  'एक दीया जलते ही रास्ता दिखाने लगा...',
  'एक बंद स्टेशन पर ट्रेन आ गई...',
  'एक शहर में सबकी परछाइयां गायब हो गईं...',
  'एक आदमी को ऐसी डायरी मिली जो खुद लिखती थी...',
  'एक लड़की ने हवा में तैरता महल देखा...',
  'एक गांव की सारी घड़ियां एक साथ रुक गईं...',
  'एक पतंग आसमान में संदेश लेकर गई...',
  'एक पुरानी हवेली ने अपना नाम बताया...',
  'एक आदमी हर सुबह नई जगह जागता था...',
  'एक बच्ची को नदी ने रहस्य बताया...',
  'एक रेगिस्तान में हरा दरवाज़ा मिला...',
  'एक चश्मा पहनते ही सच दिखाई देता था...',
  'एक पेड़ पर कांच के फल उग आए...',
  'एक पहेली ने पूरे गांव को रोक दिया...',
  'एक तारे ने ज़मीन पर गिरकर बात की...',
  'एक अंधेरी गली में सूरजमुखी चमक रहे थे...',
  'एक राजा बिना राज्य के लौट आया...',
  'एक बूढ़ी किताब ने आखिरी पन्ना छुपा लिया...',
  'एक लड़की ने अपनी हंसी में जादू पाया...',
  'एक जहाज़ आसमान में तैरता दिखा...',
  'एक बच्चा जानवरों की भाषा समझने लगा...',
  'एक रात सभी सपने सच हो गए...',
  'एक अलमारी में पूरा जंगल छुपा था...',
  'एक गांव के ऊपर दूसरा गांव तैर रहा था...',
  'एक सिक्का हर बार अलग चेहरा दिखाता था...',
  'एक आदमी को अपना बचपन सड़क पर मिला...',
  'एक पहरेदार मूर्ति अचानक चलने लगी...',
  'एक नदी उल्टी दिशा में बहने लगी...',
  'एक खाली कागज पर खुद कहानी लिखी जाने लगी...',
];

const englishStarters = [
  'One day, something unexpected happened...',
  'A boy got lost in a mysterious forest...',
  'A strange door suddenly opened...',
  'A girl found a secret letter...',
  'A village started experiencing strange events...',
  'A man heard someone calling his name at night...',
  'A child disappeared without a trace...',
  'A train started moving without a driver...',
  'A dog began speaking like a human...',
  'A map led to a hidden place...',
  'A glowing light came from inside a tree...',
  'The sun did not rise one day...',
  'A mirror started showing the future...',
  'A man met his exact double...',
  'A house had a hidden secret...',
  'A book started reading itself...',
  'A girl discovered magical powers...',
  'A man traveled back in time...',
  'A phone received messages from nowhere...',
  'A city vanished overnight...',
  'An old clock began ticking backward...',
  'A school stayed lit long after midnight...',
  'A river changed its course in one night...',
  'A child received a message from the sky...',
  'A lock opened without a key...',
  'A candle refused to go out...',
  'People in a painting started moving...',
  'Laughter came from an empty room...',
  'A bridge appeared only at midnight...',
  'An old man whispered a secret prophecy...',
  'A bag seemed to hold endless objects...',
  'A bird revealed the location of treasure...',
  'A new door appeared on a blank wall...',
  'A lost royal seal was discovered...',
  'A girl dreamed something that came true...',
  'A city was found inside a mountain...',
  'Blue rain began falling on a village...',
  'A boat started sailing across dry land...',
  'A child noticed his shadow had escaped...',
  'A mysterious shop opened only at night...',
  'A cloud drifted down to the ground...',
  'A man found a stone that could speak...',
  'Time stopped inside a small garden...',
  'A window opened into another world...',
  'A key chose its own owner...',
  'A bus arrived in a city no one knew...',
  'A doll opened its eyes...',
  'A postman delivered a letter from a century ago...',
  'Stars were shining at the bottom of a lake...',
  'A house changed places every night...',
  'A child could hear other people’s memories...',
  'A temple bell started ringing by itself...',
  'Rain began falling inside a room...',
  'A girl met an invisible friend...',
  'Music came from a closed book...',
  'An old radio announced tomorrow’s news...',
  'A farmer found a golden seed...',
  'A road suddenly led to the sea...',
  'A tiny universe was hidden inside a box...',
  'Anything written by a magical pen came true...',
  'A boy woke up without his voice...',
  'Trees in a forest called people by name...',
  'Nobody in a village ever grew old...',
  'A stranger left three questions at the door...',
  'An umbrella flew up into the clouds...',
  'A clock began counting down someone’s life...',
  'A girl found a tunnel beneath the earth...',
  'Memories were sold in a hidden market...',
  'Light rose from an abandoned well...',
  'A child became friends with the moon...',
  'An empty chair answered a question in class...',
  'A lamp lit up and revealed a path...',
  'A train arrived at a closed station...',
  'Every shadow in the city disappeared...',
  'A man found a diary that wrote by itself...',
  'A girl saw a castle floating in the air...',
  'All the clocks in a town stopped together...',
  'A kite carried a message into the sky...',
  'An old mansion spoke its own name...',
  'A man woke up somewhere new every morning...',
  'A river told a child a secret...',
  'A green door appeared in the desert...',
  'A pair of glasses revealed the truth...',
  'Glass fruit grew on an ordinary tree...',
  'A riddle brought an entire village to a halt...',
  'A fallen star started speaking...',
  'Sunflowers glowed in a dark alley...',
  'A king returned without a kingdom...',
  'An old book hid its final page...',
  'A girl discovered magic in her laughter...',
  'A ship was seen floating in the sky...',
  'A child began understanding animal speech...',
  'Every dream came true for one night...',
  'A whole forest was hidden inside a wardrobe...',
  'A second village floated above the first...',
  'A coin showed a different face every time...',
  'A man found his childhood waiting on the road...',
  'A guard statue suddenly stepped forward...',
  'A river began flowing backward...',
  'A blank page started writing a story by itself...',
];

function chooseRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getStarterConfig(language) {
  if (language === 'hindi') {
    return {
      pool: hindiStarters,
      field: 'usedHindi',
      legacyField: 'usedHindiStarters',
    };
  }

  return {
    pool: englishStarters,
    field: 'usedEnglish',
    legacyField: 'usedEnglishStarters',
  };
}

function getValidUsedLines(lines, pool) {
  return Array.isArray(lines) ? lines.filter((line) => pool.includes(line)) : [];
}

async function getOrCreateGroup(groupId) {
  let group = await BotGroup.findOne({ groupId });

  if (group) {
    return group;
  }

  try {
    group = await BotGroup.create({
      groupId,
      title: '',
      usedHindi: [],
      usedEnglish: [],
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    group = await BotGroup.findOne({ groupId });
  }

  return group;
}

async function getUniqueStarter(groupId, language) {
  const group = await getOrCreateGroup(groupId);
  const { pool, field, legacyField } = getStarterConfig(language);

  const legacyGroup = await BotGroup.collection.findOne(
    { groupId },
    {
      projection: {
        [legacyField]: 1,
      },
    }
  );

  const currentUsed = getValidUsedLines(group[field], pool);
  const legacyUsed = getValidUsedLines(legacyGroup?.[legacyField], pool);
  let used = [...new Set([...currentUsed, ...legacyUsed])];
  let available = pool.filter((line) => !used.includes(line));
  const resetUsedLines = available.length === 0;

  if (resetUsedLines) {
    used = [];
    available = pool;
  }

  const selected = chooseRandom(available);

  group[field] = used;
  group[field].push(selected);
  group.lastSeenAt = new Date();
  group.markModified(field);
  await group.save();

  if (legacyUsed.length) {
    await BotGroup.collection.updateOne({ groupId }, { $unset: { [legacyField]: '' } });
  }

  console.log('[story-starter]', {
    groupId,
    language,
    resetUsedLines,
    usedCount: group[field].length,
    availableCount: available.length,
    selected,
  });

  return selected;
}

module.exports = {
  englishStarters,
  getOrCreateGroup,
  getUniqueStarter,
  hindiStarters,
};
