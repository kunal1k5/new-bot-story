const cheerio = require('cheerio');

const ANIMEKAI_URL = 'https://anikai.to/';
const ANIMEKAI_HOME_URL = 'https://anikai.to/home';
const ANIMEKAI_SEARCH_URL = 'https://anikai.to/ajax/anime/search';
const ANIMEKAI_EPISODES_URL = 'https://anikai.to/ajax/episodes/list';

const ENCDEC_URL = 'https://enc-dec.app/api/enc-kai';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: ANIMEKAI_URL,
};

const AJAX_HEADERS = {
  ...HEADERS,
  'X-Requested-With': 'XMLHttpRequest',
};

function withTimeout(ms = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
}

async function fetchText(url, options = {}) {
  const timeout = withTimeout(options.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.text();
  } finally {
    timeout.cancel();
  }
}

async function fetchJson(url, options = {}) {
  const timeout = withTimeout(options.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
  } finally {
    timeout.cancel();
  }
}

function absoluteUrl(href = '') {
  if (!href) {
    return '';
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  return `${ANIMEKAI_URL.replace(/\/$/, '')}${href.startsWith('/') ? href : `/${href}`}`;
}

function parseBackgroundUrl(style = '') {
  const match = style.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

function parseInfoSpans($, infoEl) {
  const info = {
    subEpisodes: '',
    dubEpisodes: '',
    type: '',
  };

  if (!infoEl?.length) {
    return info;
  }

  infoEl.find('span').each((_, span) => {
    const $span = $(span);

    if ($span.hasClass('sub')) {
      info.subEpisodes = $span.text().trim();
      return;
    }

    if ($span.hasClass('dub')) {
      info.dubEpisodes = $span.text().trim();
      return;
    }

    if ($span.find('b').length) {
      info.type = $span.text().trim();
    }
  });

  return info;
}

function cleanKeyword(keyword = '') {
  return keyword.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanToken(token = '') {
  return String(token).trim().slice(0, 200);
}

async function encodeToken(text) {
  const token = cleanToken(text);

  if (!token) {
    return null;
  }

  const url = new URL(ENCDEC_URL);
  url.searchParams.set('text', token);

  try {
    const data = await fetchJson(url, { timeoutMs: 15000 });
    return data?.status === 200 ? data.result : null;
  } catch {
    return null;
  }
}

async function searchAnime(keyword) {
  const safeKeyword = cleanKeyword(keyword);

  if (!safeKeyword) {
    return [];
  }

  const url = new URL(ANIMEKAI_SEARCH_URL);
  url.searchParams.set('keyword', safeKeyword);

  const data = await fetchJson(url, {
    headers: AJAX_HEADERS,
    timeoutMs: 15000,
  });
  const html = data?.result?.html || '';

  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);
  const results = [];

  $('a.aitem').each((_, item) => {
    const $item = $(item);
    const $title = $item.find('h6.title').first();
    const title = $title.text().trim();
    const href = $item.attr('href') || '';
    const slug = href.startsWith('/watch/') ? href.replace('/watch/', '') : href;
    let subEpisodes = '';
    let dubEpisodes = '';
    let totalEpisodes = '';
    let year = '';
    let type = '';
    let rating = '';

    $item.find('.info span').each((__, span) => {
      const $span = $(span);
      const text = $span.text().trim();

      if ($span.hasClass('sub')) {
        subEpisodes = text;
      } else if ($span.hasClass('dub')) {
        dubEpisodes = text;
      } else if ($span.hasClass('rating')) {
        rating = text;
      } else if ($span.find('b').length && /^\d+$/.test(text)) {
        totalEpisodes = text;
      } else if ($span.find('b').length) {
        type = text;
      } else {
        year = text;
      }
    });

    if (!title) {
      return;
    }

    results.push({
      title,
      japaneseTitle: $title.attr('data-jp') || '',
      slug,
      url: absoluteUrl(href),
      poster: $item.find('.poster img').attr('src') || '',
      subEpisodes,
      dubEpisodes,
      totalEpisodes,
      year,
      type,
      rating,
    });
  });

  return results;
}

async function scrapeAnimeInfo(slug) {
  const safeSlug = cleanToken(slug);

  if (!safeSlug || safeSlug.includes('..')) {
    throw new Error('Invalid anime slug');
  }

  const html = await fetchText(`${ANIMEKAI_URL}watch/${safeSlug}`, {
    headers: HEADERS,
    timeoutMs: 15000,
  });
  const $ = cheerio.load(html);
  let animeId = '';
  const syncData = $('script#syncData').text();

  if (syncData) {
    try {
      animeId = JSON.parse(syncData).anime_id || '';
    } catch {
      animeId = '';
    }
  }

  const info = parseInfoSpans($, $('.main-entity .info').first());
  const detail = {};

  $('.detail > div > div').each((_, div) => {
    const $div = $(div);
    const text = $div.text().replace(/\s+/g, ' ').trim();
    const separatorIndex = text.indexOf(':');

    if (separatorIndex === -1) {
      return;
    }

    const key = text
      .slice(0, separatorIndex)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const links = $div
      .find('span a')
      .map((__, link) => $(link).text().trim())
      .get()
      .filter(Boolean);

    detail[key] = links.length ? links : text.slice(separatorIndex + 1).trim();
  });

  return {
    animeId,
    title: $('h1.title').first().text().trim(),
    japaneseTitle: $('h1.title').first().attr('data-jp') || '',
    description: $('.desc').first().text().trim(),
    poster: $(".poster img[itemprop='image']").first().attr('src') || '',
    banner: parseBackgroundUrl($('.watch-section-bg').first().attr('style') || ''),
    subEpisodes: info.subEpisodes,
    dubEpisodes: info.dubEpisodes,
    type: info.type,
    rating: $('.main-entity .info .rating').first().text().trim(),
    malScore: $('.rate-box .value').first().text().trim(),
    detail,
  };
}

async function fetchEpisodes(animeId) {
  const safeAnimeId = cleanToken(animeId);
  const encoded = await encodeToken(safeAnimeId);

  if (!encoded) {
    throw new Error('Token encryption failed');
  }

  const url = new URL(ANIMEKAI_EPISODES_URL);
  url.searchParams.set('ani_id', safeAnimeId);
  url.searchParams.set('_', encoded);

  const data = await fetchJson(url, {
    headers: AJAX_HEADERS,
    timeoutMs: 15000,
  });
  const html = data?.result || '';

  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);

  return $('.eplist a')
    .map((_, episode) => {
      const $episode = $(episode);
      const $title = $episode.find('span').first();
      const langs = $episode.attr('langs') || '0';
      const langFlags = /^\d+$/.test(langs) ? Number(langs) : 0;

      return {
        number: $episode.attr('num') || '',
        slug: $episode.attr('slug') || '',
        title: $title.text().trim(),
        japaneseTitle: $title.attr('data-jp') || '',
        token: $episode.attr('token') || '',
        hasSub: Boolean(langFlags & 1),
        hasDub: Boolean(langFlags & 2),
      };
    })
    .get();
}

async function scrapeHome() {
  const html = await fetchText(ANIMEKAI_HOME_URL, {
    headers: HEADERS,
    timeoutMs: 15000,
  });
  const $ = cheerio.load(html);
  const latestUpdates = [];

  $('.aitem-wrapper.regular .aitem').each((_, item) => {
    const $item = $(item);
    const $title = $item.find('a.title').first();
    let href = $item.find('a.poster').first().attr('href') || '';
    const episode = href.includes('#ep=') ? href.split('#ep=').pop() : '';
    href = href.split('#ep=')[0];
    const info = parseInfoSpans($, $item.find('.info').first());

    if (!$title.length) {
      return;
    }

    latestUpdates.push({
      title: $title.text().trim(),
      japaneseTitle: $title.attr('data-jp') || '',
      poster: $item.find('img.lazyload').first().attr('data-src') || '',
      url: absoluteUrl(href),
      currentEpisode: episode,
      subEpisodes: info.subEpisodes,
      dubEpisodes: info.dubEpisodes,
      type: info.type,
    });
  });

  return {
    latestUpdates,
  };
}

module.exports = {
  fetchEpisodes,
  scrapeAnimeInfo,
  scrapeHome,
  searchAnime,
};
