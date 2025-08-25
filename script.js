/*
 * Client-side script for NewsAggregationPlus.
 *
 * This script populates the page with information pulled from several public
 * web APIs. When the page loads it attempts to determine the user's
 * approximate location via their IP address, fetches local weather data
 * using Open‑Meteo, retrieves top headlines from Google News, top posts from
 * Reddit's r/popular feed, trending TikTok content via an RSS feed and
 * current market index values. If a request fails the affected section
 * remains blank or displays a simple error message to avoid breaking the
 * entire page. Temperature units can be toggled between Fahrenheit and
 * Celsius using the button in the header.
 */

// Grab references to page elements. Each section contains elements whose
// contents are updated after data is fetched.
const els = {
  // Weather
  weatherCard: document.getElementById('weatherCard'),
  weatherTemp: document.getElementById('weatherTemp'),
  weatherHigh: document.getElementById('weatherHigh'),
  weatherLow: document.getElementById('weatherLow'),
  weatherWinds: document.getElementById('weatherWinds'),
  // News list
  newsList: document.getElementById('usNewsList'),
  // Reddit list
  redditList: document.getElementById('redditList'),
  // TikTok list
  tiktokList: document.getElementById('tiktokList'),
  // Markets cells
  sp500: document.getElementById('sp500Value'),
  dow30: document.getElementById('dow30Value'),
  nasdaq: document.getElementById('nasdaqValue'),
  // Economy list
  economyList: document.getElementById('economyList'),
};

// State for temperature unit. 'fahrenheit' or 'celsius'. The button toggles
// this state and triggers a weather reload.
let temperatureUnit = 'fahrenheit';

// Bind click handler to the unit toggle button.
document.getElementById('unitToggle').addEventListener('click', () => {
  temperatureUnit = temperatureUnit === 'fahrenheit' ? 'celsius' : 'fahrenheit';
  document.getElementById('unitToggle').textContent = temperatureUnit === 'fahrenheit' ? '°F' : '°C';
  loadWeather();
});

/**
 * Helper: perform a GET request and return parsed JSON. If the response
 * is not JSON or the network fails this returns undefined. All network
 * errors are caught internally to prevent unhandled rejections.
 *
 * @param {string} url
 * @returns {Promise<any|undefined>}
 */
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await res.json();
  } catch (err) {
    console.error('fetchJSON error:', err);
    return undefined;
  }
}

/**
 * Helper: perform a GET request and return plain text. If the network
 * fails this returns undefined. Used for RSS feeds.
 *
 * @param {string} url
 * @returns {Promise<string|undefined>}
 */
async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await res.text();
  } catch (err) {
    console.error('fetchText error:', err);
    return undefined;
  }
}

/**
 * Helper: parse an RSS or Atom feed into a list of items. The input
 * should be XML. Items returned contain title, link, publication date and
 * source name when available. When parsing fails it returns an empty array.
 *
 * @param {string} xmlString
 * @returns {Array<{title:string,link:string,pubDate:string,source:string}>}
 */
function parseRSS(xmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const items = doc.querySelectorAll('item');
    const list = [];
    items.forEach(item => {
      const title = item.querySelector('title')?.textContent?.trim() || '';
      const link = item.querySelector('link')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
      let source = '';
      const sourceEl = item.querySelector('source');
      if (sourceEl) {
        source = sourceEl.textContent?.trim() || '';
      } else if (link) {
        try {
          const url = new URL(link);
          source = url.hostname.replace('www.', '');
        } catch {
          source = '';
        }
      }
      list.push({ title, link, pubDate, source });
    });
    return list;
  } catch (e) {
    console.error('parseRSS error:', e);
    return [];
  }
}

/**
 * Render a list of items into a UL element. Each item should have a
 * title and link. Optionally upvotes (for Reddit) will be appended. The
 * list is cleared before rendering.
 *
 * @param {HTMLElement} ul
 * @param {Array<any>} items
 */
function renderList(ul, items) {
  if (!ul) return;
  ul.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.link;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = item.title;
    li.appendChild(link);
    if (item.upvotes) {
      const span = document.createElement('span');
      span.textContent = ` ▲${item.upvotes.toLocaleString()}`;
      span.classList.add('upvotes');
      li.appendChild(span);
    }
    ul.appendChild(li);
  });
}

/**
 * Load local weather using the user's approximate location via IP. If we
 * cannot determine the location or fetch weather data the weather card is
 * cleared.
 */
async function loadWeather() {
  // Clear the card while loading
  els.weatherTemp.textContent = '--°';
  els.weatherHigh.textContent = 'H: --°';
  els.weatherLow.textContent = 'L: --°';
  els.weatherWinds.textContent = 'Winds -- mph';
  try {
    // Determine approximate location via IP. We'll fallback to a generic
    // location if this fails.
    const ipInfo = await fetchJSON('https://ipapi.co/json/');
    const lat = ipInfo?.latitude;
    const lon = ipInfo?.longitude;
    if (!lat || !lon) {
      console.warn('Could not determine location');
      return;
    }
    // Determine the appropriate units and call Open‑Meteo.
    const tempUnit = temperatureUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${tempUnit}&windspeed_unit=mph`;
    const data = await fetchJSON(url);
    if (!data || !data.current_weather) {
      console.warn('Weather response missing expected data');
      return;
    }
    const cur = data.current_weather;
    // Populate DOM
    els.weatherTemp.textContent = `${Math.round(cur.temperature)}°`;
    els.weatherHigh.textContent = `H: ${Math.round((data.daily?.temperature_2m_max?.[0] || cur.temperature))}°`;
    els.weatherLow.textContent = `L: ${Math.round((data.daily?.temperature_2m_min?.[0] || cur.temperature))}°`;
    els.weatherWinds.textContent = `Winds ${Math.round(cur.windspeed)} mph`;
  } catch (err) {
    console.error('Weather load error:', err);
  }
}

/**
 * Load top U.S. headlines. Uses Google News RSS feed via AllOrigins to
 * avoid CORS issues. If this fails the list remains empty.
 */
async function loadNews() {
  const feedUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
  try {
    const xml = await fetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`);
    const items = xml ? parseRSS(xml).slice(0, 6) : [];
    renderList(els.newsList, items);
  } catch (err) {
    console.error('News load error:', err);
  }
}

/**
 * Load trending posts from Reddit's r/popular feed. Uses Reddit's public
 * JSON API. Only the first 8 posts are shown. If this fails the list
 * remains empty.
 */
async function loadReddit() {
  try {
    const data = await fetchJSON('https://www.reddit.com/r/popular.json?limit=8');
    if (!data || !data.data || !Array.isArray(data.data.children)) {
      return;
    }
    const posts = data.data.children.map(child => ({
      title: child.data.title,
      link: `https://reddit.com${child.data.permalink}`,
      upvotes: child.data.ups || 0,
    }));
    renderList(els.redditList, posts);
  } catch (err) {
    console.error('Reddit load error:', err);
  }
}

/**
 * Load trending TikTok clips via an RSS feed. We use the RSSHub endpoint
 * which delivers trending videos as an RSS feed. Only the first five
 * entries are shown. If the request fails the list will simply say
 * "No trending items available right now." to avoid confusion.
 */
async function loadTikTok() {
  const feedUrl = 'https://rsshub.app/tiktok/trending/us';
  try {
    const xml = await fetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`);
    const items = xml ? parseRSS(xml).slice(0, 5) : [];
    if (items.length === 0) {
      els.tiktokList.textContent = 'No trending items available right now.';
    } else {
      renderList(els.tiktokList, items);
    }
  } catch (err) {
    console.error('TikTok load error:', err);
    els.tiktokList.textContent = 'No trending items available right now.';
  }
}

/**
 * Load market indices. Uses Yahoo Finance unofficial quote API. Values are
 * updated in their respective cells. If the request fails the cells
 * remain as N/A. Yahoo returns price as decimals; we round to two
 * decimal places.
 */
async function loadMarkets() {
  try {
    const data = await fetchJSON('https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EDJI,%5EIXIC');
    const quotes = data?.quoteResponse?.result;
    if (!quotes) return;
    quotes.forEach(quote => {
      const value = quote.regularMarketPrice;
      const rounded = typeof value === 'number' ? value.toFixed(2) : 'N/A';
      if (quote.symbol === '^GSPC') {
        els.sp500.textContent = rounded;
      } else if (quote.symbol === '^DJI') {
        els.dow30.textContent = rounded;
      } else if (quote.symbol === '^IXIC') {
        els.nasdaq.textContent = rounded;
      }
    });
  } catch (err) {
    console.error('Markets load error:', err);
  }
}

/**
 * Load latest releases or statements regarding the U.S. economy. Uses
 * Federal Reserve RSS feed. Only the first three items are shown.
 */
async function loadEconomy() {
  const feedUrl = 'https://www.federalreserve.gov/feeds/press_all.xml';
  try {
    const xml = await fetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`);
    const items = xml ? parseRSS(xml).slice(0, 3) : [];
    renderList(els.economyList, items);
  } catch (err) {
    console.error('Economy load error:', err);
  }
}

/**
 * Initialise the page by loading all sections. Executed once on page load.
 */
async function init() {
  await Promise.all([
    loadWeather(),
    loadNews(),
    loadReddit(),
    loadTikTok(),
    loadMarkets(),
    loadEconomy(),
  ]);
}

// Start the initial load when the DOM is fully ready. Some browsers may
// support DOMContentLoaded; we fallback to window onload for safety.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}