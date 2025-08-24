// Main client script (ESM)
const $ = s => document.querySelector(s);

function setUpdated(){
  const t = new Date();
  const hm = t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  $('#updatedTime').textContent = hm;
}

function unit(){
  return localStorage.getItem('unit') || 'F';
}
function setUnit(u){
  localStorage.setItem('unit', u);
  $('#unitToggle').textContent = `°${u}`;
}

async function fetchJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.json();
}
async function fetchText(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.text();
}

function renderRSSList(el, items, limit=8){
  el.innerHTML = '';
  items.slice(0, limit).forEach(x => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${x.link}" target="_blank" rel="noopener">${x.title}</a><br><small>${x.meta||''}</small>`;
    el.appendChild(li);
  });
  if(items.length===0) el.innerHTML = '<li class="muted">No items right now.</li>';
}

// quick and tiny XML->items
function parseRSS(xmlText){
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const items = [...doc.querySelectorAll('item')].map(it=>({
    title: it.querySelector('title')?.textContent?.trim() || '',
    link: it.querySelector('link')?.textContent?.trim() || '',
    meta: (it.querySelector('source')?.textContent||it.querySelector('author')?.textContent||'') + ' • ' + new Date(it.querySelector('pubDate')?.textContent||Date.now()).toLocaleDateString(undefined,{month:'short', day:'numeric'})
  }));
  if(items.length) return items;
  const entries = [...doc.querySelectorAll('entry')].map(it=>({
    title: it.querySelector('title')?.textContent?.trim() || '',
    link: it.querySelector('link')?.getAttribute('href') || '',
    meta: (it.querySelector('author name')?.textContent||'') + ' • ' + new Date(it.querySelector('updated')?.textContent||Date.now()).toLocaleDateString(undefined,{month:'short', day:'numeric'})
  }));
  return entries;
}

async function loadWeather(){
  const want = unit()==='F' ? 'fahrenheit' : 'celsius';
  let lat=33.5779, lon=-101.8552; // default Lubbock, TX
  try{
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}));
    lat = pos.coords.latitude; lon = pos.coords.longitude;
  }catch(_){}

  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=${want}&wind_speed_unit=mph&timezone=auto`;
    const data = await fetchJSON(url);
    $('#tempNow').textContent = Math.round(data.current.temperature_2m);
    $('#tempHigh').textContent = Math.round(data.daily.temperature_2m_max[0]);
    $('#tempLow').textContent = Math.round(data.daily.temperature_2m_min[0]);
    $('#windStr').textContent = `${Math.round(data.current.wind_speed_10m)} mph`;
    try{
      const rev = await fetchJSON(`/api/revgeo?lat=${lat}&lon=${lon}`);
      $('#weatherLocation').textContent = rev.label || 'Your area';
    }catch(_){}
  }catch(e){
    console.error('weather', e);
  }
}

async function loadUSNews(){
  const url = '/api/rss?url=' + encodeURIComponent('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
  try{
    const xml = await fetchText(url);
    renderRSSList($('#usNewsList'), parseRSS(xml), 10);
  }catch(e){
    $('#usNewsList').innerHTML = '<li class="muted">Error loading feed.</li>';
  }
}

async function loadReddit(){
  try{
    const j = await fetchJSON('https://www.reddit.com/r/popular.json?limit=12');
    const list = $('#redditList'); list.innerHTML = '';
    j.data.children.forEach(p => {
      const title = p.data.title, ups = p.data.ups;
      const link = 'https://www.reddit.com'+p.data.permalink;
      const li = document.createElement('li');
      li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a><br><small>▲${ups.toLocaleString()}</small>`;
      list.appendChild(li);
    });
  }catch(e){
    $('#redditList').innerHTML = '<li class="muted">Error loading feed.</li>';
  }
}

async function loadTikTok(){
  const url = '/api/rss?url=' + encodeURIComponent('https://rsshub.app/tiktok/trending/us?limit=15');
  try{
    const xml = await fetchText(url);
    renderRSSList($('#tiktokList'), parseRSS(xml), 8);
  }catch(e){
    $('#tiktokList').innerHTML = '<li class="muted">Loading...</li>';
  }
}

async function loadMarkets(){
  try{
    const j = await fetchJSON('/api/markets?tickers=SPY,DIA,QQQ');
    const map = {'SPY':'#sp500','DIA':'#dow30','QQQ':'#nasdaq100'};
    Object.keys(j).forEach(tk => {
      const el = document.querySelector(map[tk]);
      const priceEl = el.querySelector('.price');
      const deltaEl = el.querySelector('.delta');
      const d = j[tk];
      if(!d || !d.price){ priceEl.textContent = 'N/A'; deltaEl.textContent='—'; return; }
      priceEl.textContent = d.price.toFixed(2);
      const sign = d.change>=0 ? '+' : '';
      deltaEl.textContent = `${sign}${d.change.toFixed(2)} (${sign}${d.changePct.toFixed(2)}%)`;
      deltaEl.style.color = d.change>=0 ? 'var(--good)' : 'var(--bad)';
    });
  }catch(e){
    console.error('markets', e);
  }
}

async function loadEconomy(){
  const url = '/api/rss?url=' + encodeURIComponent('https://www.federalreserve.gov/feeds/press_monetary.xml');
  try{
    const xml = await fetchText(url);
    renderRSSList($('#economyList'), parseRSS(xml), 6);
  }catch(e){
    $('#economyList').innerHTML = '<li class="muted">Error loading feed.</li>';
  }
}

async function loadAI(){
  const feeds = [
    'https://venturebeat.com/category/ai/feed',
    'https://huggingface.co/blog/feed.xml'
  ];
  const all = [];
  await Promise.all(feeds.map(async f=>{
    try{
      const xml = await fetchText('/api/rss?url='+encodeURIComponent(f));
      parseRSS(xml).forEach(i=>all.push(i));
    }catch(_){}
  }));
  const cutoff = Date.now() - 30*24*3600*1000;
  const recent = all.filter(i=>{
    // quick meta parse for date not needed here
    return true;
  });
  renderRSSList($('#aiList'), recent, 18);
}

function start(){
  setUnit(unit());
  $('#unitToggle').addEventListener('click', async ()=>{
    setUnit(unit()==='F' ? 'C' : 'F');
    await loadWeather();
  });

  setUpdated();
  loadWeather();
  loadUSNews();
  loadReddit();
  loadTikTok();
  loadMarkets();
  loadEconomy();
  loadAI();

  setInterval(()=>{
    setUpdated();
    loadUSNews(); loadReddit(); loadTikTok(); loadMarkets(); loadEconomy(); loadAI(); loadWeather();
  }, 30*60*1000);
}

document.addEventListener('DOMContentLoaded', start);
