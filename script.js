
// NewsAggregationPlus — resilient client script (temporary: TikTok & Markets disabled)
// This version ensures failures do NOT blank the page.
// If a section cannot load, it shows a lightweight placeholder instead.

(function () {
  const log = (...args) => console.debug("[NAP]", ...args);

  // Generic timeout fetch that never crashes the app
  async function safeFetch(url, opts = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  // Utility: sets text if el exists
  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setHTML(sel, html) {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = html;
  }
  function ensureList(sel) {
    const el = document.querySelector(sel);
    if (el && !el.querySelector("ul")) {
      const ul = document.createElement("ul");
      ul.className = "list";
      el.appendChild(ul);
      return ul;
    }
    return el ? el.querySelector("ul") : null;
  }
  function appendItem(ul, html) {
    if (!ul) return;
    const li = document.createElement("li");
    li.innerHTML = html;
    ul.appendChild(li);
  }

  // Weather (Open-Meteo via existing page logic: expects #temp, #hi, #lo, #winds)
  async function loadWeather() {
    try {
      const lat = localStorage.getItem("lat");
      const lon = localStorage.getItem("lon");
      if (!lat || !lon) {
        // Request geolocation, but do not block render
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              localStorage.setItem("lat", pos.coords.latitude.toFixed(4));
              localStorage.setItem("lon", pos.coords.longitude.toFixed(4));
              // retry once
              loadWeather();
            },
            (err) => {
              log("Geolocation denied", err);
              setText("#temp", "— —");
            },
            { timeout: 8000 }
          );
        } else {
          setText("#temp", "— —");
        }
        return;
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;
      const res = await safeFetch(url);
      const data = await res.json();
      const current = data.current || {};
      const daily = data.daily || {};
      setText("#temp", Math.round(current.temperature_2m ?? NaN) + "°");
      setText("#hi", (daily.temperature_2m_max && Math.round(daily.temperature_2m_max[0])) ? `H: ${Math.round(daily.temperature_2m_max[0])}°` : "H: --°");
      setText("#lo", (daily.temperature_2m_min && Math.round(daily.temperature_2m_min[0])) ? `L: ${Math.round(daily.temperature_2m_min[0])}°` : "L: --°");
      setText("#winds", current.wind_speed_10m != null ? `Winds ${Math.round(current.wind_speed_10m)} mph` : "Winds --");
    } catch (e) {
      log("Weather error", e);
      setText("#temp", "— —");
      setText("#hi", "H: --°");
      setText("#lo", "L: --°");
      setText("#winds", "Winds --");
    }
  }

  // U.S. News via existing /api/rss?feed=... (keep resilient)
  async function loadUSNews() {
    try {
      const ul = ensureList("#us-news");
      if (!ul) return;
      appendItem(ul, `<span class="muted">Loading...</span>`);
      const res = await safeFetch("/api/rss?feed=us");
      const items = await res.json(); // expected array of {title, link, source, date}
      ul.innerHTML = "";
      (items || []).slice(0, 10).forEach(item => {
        const date = item.date ? ` • ${item.date}` : "";
        appendItem(ul, `<a href="${item.link}" target="_blank" rel="noopener">${item.title}</a><div class="sub">${item.source || ""}${date}</div>`);
      });
      if (!ul.children.length) appendItem(ul, `<span class="muted">Nothing found.</span>`);
    } catch (e) {
      log("US News error", e);
      const ul = ensureList("#us-news");
      if (ul) { ul.innerHTML = `<li><span class="muted">Error loading feed.</span></li>`; }
    }
  }

  // Reddit Popular via existing /api/reddit
  async function loadReddit() {
    try {
      const ul = ensureList("#reddit");
      if (!ul) return;
      appendItem(ul, `<span class="muted">Loading...</span>`);
      const res = await safeFetch("/api/reddit");
      const items = await res.json(); // expected array of {title, link, score}
      ul.innerHTML = "";
      (items || []).slice(0, 12).forEach(post => {
        appendItem(ul,
          `<a href="${post.link}" target="_blank" rel="noopener">${post.title}</a>
           <span class="score">▲${(post.score || 0).toLocaleString()}</span>`
        );
      });
      if (!ul.children.length) appendItem(ul, `<span class="muted">No posts.</span>`);
    } catch (e) {
      log("Reddit error", e);
      const ul = ensureList("#reddit");
      if (ul) { ul.innerHTML = `<li><span class="muted">Error loading feed.</span></li>`; }
    }
  }

  // TikTok — temporarily disabled (render placeholder so page doesn’t break)
  async function loadTikTok() {
    try {
      const ul = ensureList("#tiktok");
      if (!ul) return;
      ul.innerHTML = "";
      appendItem(ul, `<span class="muted">Temporarily unavailable (working on proxy).</span>`);
      // When ready, replace with proxied RSS fetch like:
      // const res = await safeFetch("/api/tiktok");
      // const items = await res.json();
      // ul.innerHTML = "";
      // items.slice(0, 8).forEach(it => appendItem(ul, `<a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>`));
    } catch (e) {
      log("TikTok section error", e);
    }
  }

  // Markets — temporarily disabled (render placeholder to avoid blank page)
  async function loadMarkets() {
    try {
      const ids = [
        { box: "#sp500", label: "S&P 500" },
        { box: "#dow30", label: "Dow 30" },
        { box: "#nasdaq100", label: "Nasdaq 100" },
      ];
      ids.forEach(({ box }) => {
        const el = document.querySelector(box);
        if (el) {
          el.querySelector(".big")?.replaceChildren(document.createTextNode("N/A"));
          el.querySelector(".sub")?.replaceChildren(document.createTextNode("—"));
        }
      });
      // When backend proxy is stable, fetch and fill:
      // const res = await safeFetch("/api/markets");
      // const data = await res.json(); // {sp500:{price,change}, dow30:{...}, nasdaq100:{...}}
      // updateCard("#sp500", data.sp500);
      // updateCard("#dow30", data.dow30);
      // updateCard("#nasdaq100", data.nasdaq100);
    } catch (e) {
      log("Markets section error", e);
    }
  }

  // Kick everything off safely
  function ready(fn){ 
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    // Never throw uncaught at top-level
    Promise.resolve().then(loadWeather).catch(e => log(e));
    Promise.resolve().then(loadUSNews).catch(e => log(e));
    Promise.resolve().then(loadReddit).catch(e => log(e));
    Promise.resolve().then(loadTikTok).catch(e => log(e));
    Promise.resolve().then(loadMarkets).catch(e => log(e));
  });
})();
