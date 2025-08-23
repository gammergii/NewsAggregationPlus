let useF = true;
const fmtTemp = v => useF ? Math.round(v) + '°' : Math.round((v-32)*5/9)+'°';
const updatedAt = document.getElementById('updatedAt');
document.getElementById('unitToggle').addEventListener('click', () => {
  useF = !useF; document.getElementById('unitToggle').textContent = useF?'°F':'°C'; // re-render temps
  if (window.__wx) paintWeather(window.__wx);
});

function stamp(){ updatedAt.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
stamp();

async function getJSON(url, opts={}){
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error('fetch failed'); 
  return res.json();
}

// Weather — Open-Meteo (US units); fallback to Lubbock, TX
function geolocate(){
  return new Promise(resolve=>{
    navigator.geolocation?.getCurrentPosition(p=>resolve({lat:p.coords.latitude, lon:p.coords.longitude}), _=>resolve(null), {timeout:5000})
  });
}
async function loadWeather(){
  let pos = await geolocate();
  if(!pos){ // Lubbock default
    pos = {lat:33.5779, lon:-101.8552};
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&hourly=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;
  const data = await getJSON(url);
  const city = await reverseGeocode(pos.lat,pos.lon).catch(_=>null);
  window.__wx = { 
    city: city || 'Your area',
    temp: data.current_weather?.temperature,
    hi: data.daily?.temperature_2m_max?.[0],
    lo: data.daily?.temperature_2m_min?.[0],
    wind: data.current_weather?.windspeed
  };
  paintWeather(window.__wx);
}
function paintWeather(wx){
  document.getElementById('where').textContent = wx.city;
  document.getElementById('temp').textContent = fmtTemp(wx.temp);
  document.getElementById('hi').textContent = fmtTemp(wx.hi);
  document.getElementById('lo').textContent = fmtTemp(wx.lo);
  document.getElementById('wind').textContent = (wx.wind??'--') + ' mph';
}

// reverse geocode (no key) via Nominatim
async function reverseGeocode(lat,lon){
  const r = await fetch(`/api/revgeo?lat=${lat}&lon=${lon}`);
  if(!r.ok) return null;
  const j = await r.json();
  return j.city || j.town || j.village || j.state || 'Your area';
}

// Reddit r/popular
async function loadReddit(){
  const res = await fetch('https://www.reddit.com/r/popular.json?limit=15',{headers:{'User-Agent':'Mozilla/5.0'}});
  const j = await res.json();
  const list = document.getElementById('redditList');
  list.innerHTML = j.data.children.map(ch=>{
    const p = ch.data;
    const ups = p.ups || 0;
    return `<li><a target="_blank" rel="noopener" href="https://reddit.com${p.permalink}">${p.title}</a> <span class="small">▲${ups.toLocaleString()}</span></li>`
  }).join('');
}

// Google News (US) & Fed releases
async function loadNews(){
  const us = await fetchRSS('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
  renderList(document.getElementById('usNewsList'), us.slice(0,8));
  const econ = await fetchRSS('https://www.federalreserve.gov/feeds/press_monetary.xml');
  renderList(document.getElementById('economyList'), econ.slice(0,6));
}

// AI Dev (VentureBeat AI feed)
async function loadAI(){
  const ai = await fetchRSS('https://venturebeat.com/category/ai/feed/');
  renderList(document.getElementById('aiList'), ai.slice(0,12));
}

// TikTok Trending via RSSHub proxy
async function loadTikTok(){
  const items = await fetchRSS('https://rsshub.app/tiktok/trending');
  renderList(document.getElementById('tiktokList'), items.slice(0,8));
}

// Markets via Stooq (ETF proxies)
async function loadMarkets(){
  const j = await getJSON('/api/markets');
  paintTile('sp500', j.SPY);
  paintTile('dow', j.DIA);
  paintTile('nasdaq', j.QQQ);
}
function paintTile(prefix, data){
  const v = document.getElementById(prefix);
  const d = document.getElementById(prefix+'d');
  if(!data){ v.textContent='N/A'; d.textContent='—'; return; }
  v.textContent = data.price.toFixed(2);
  d.textContent = `${data.change>=0?'+':''}${data.change.toFixed(2)} (${data.changePct.toFixed(2)}%)`;
  d.className = 'delta ' + (data.change>=0 ? 'pos' : 'neg');
}

// kick everything
(async function init(){
  try{
    await Promise.all([loadWeather(), loadReddit(), loadNews(), loadAI(), loadTikTok(), loadMarkets()]);
  }catch(e){ console.error(e); }
  setInterval(()=>{
    stamp();
    // refresh lightweight feeds every 30 mins
  }, 30*60*1000);
})();