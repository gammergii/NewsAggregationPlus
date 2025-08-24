
// script.js
document.addEventListener("DOMContentLoaded", () => {
  loadWeather();
  loadReddit();
  loadTikTok();
  loadMarkets();
  loadEconomy();
});

async function loadWeather() {
  try {
    const res = await fetch("/api/weather");
    const data = await res.json();
    document.getElementById("weather-temp").textContent = data.temp + "°";
    document.getElementById("weather-high").textContent = "H: " + data.high + "°";
    document.getElementById("weather-low").textContent = "L: " + data.low + "°";
    document.getElementById("weather-wind").textContent = "Winds " + data.wind + " mph";
  } catch (err) {
    console.error("Weather error:", err);
  }
}

async function loadReddit() {
  try {
    const res = await fetch("/api/reddit");
    const posts = await res.json();
    const container = document.getElementById("reddit");
    container.innerHTML = "";
    posts.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.title + " ▲" + p.ups;
      container.appendChild(li);
    });
  } catch (err) {
    console.error("Reddit error:", err);
  }
}

async function loadTikTok() {
  try {
    const res = await fetch("/api/tiktok");
    const items = await res.json();
    const container = document.getElementById("tiktok");
    container.innerHTML = "";
    items.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t.title;
      container.appendChild(li);
    });
  } catch (err) {
    console.error("TikTok error:", err);
  }
}

async function loadMarkets() {
  try {
    const res = await fetch("/api/markets");
    const data = await res.json();
    document.getElementById("sp500").textContent = data.sp500 || "N/A";
    document.getElementById("dow30").textContent = data.dow30 || "N/A";
    document.getElementById("nasdaq").textContent = data.nasdaq || "N/A";
  } catch (err) {
    console.error("Markets error:", err);
  }
}

async function loadEconomy() {
  try {
    const res = await fetch("/api/economy");
    const items = await res.json();
    const container = document.getElementById("economy");
    container.innerHTML = "";
    items.forEach(e => {
      const li = document.createElement("li");
      li.textContent = e.title + " – " + e.date;
      container.appendChild(li);
    });
  } catch (err) {
    console.error("Economy error:", err);
  }
}
