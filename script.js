// helpers
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const fmtTime = d => new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
const setUpdated = () => $('#lastUpdated').textContent = 'Updated ' + fmtTime(Date.now());

// unit toggle
let unit = (localStorage.getItem('unit')||'F');
const toggle = $('#unitToggle');
toggle.textContent = unit === 'F' ? '°F' : '°C';
toggle.addEventListener('click', ()=>{
  unit = unit === 'F' ? 'C' : 'F';
  localStorage.setItem('unit', unit);
  toggle.textContent = unit === 'F' ? '°F' : '°C';
  fetchWeather();
});

// weather (Open-Meteo)
async function fetchWeather(){
  try{
    let lat=33.5779, lon=-101.8552; // default Lubbock
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p => { lat=p.coords.latitude; lon=p.coords.longitude; go(); }, go);
    } else go();
    function go(){
      const params = new URLSearchParams({
        latitude: lat, longitude: lon,
        current_weather: true, daily: 'temperature_2m_max,temperature_2m_min,weathercode',
        timezone: 'auto', temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius', windspeed_unit: 'mph'
      });
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
        .then(r=>r.json()).then(d=>{
          $('#weatherLocation').textContent = 'Your area';
          $('#currentTemp').textContent = Math.round(d.current_weather.temperature);
          $('#highTemp').textContent = Math.round(d.daily.temperature_2m_max[0]);
          $('#lowTemp').textContent = Math.round(d.daily.temperature_2m_min[0]);
          $('#weatherSummary').textContent = `Winds ${Math.round(d.current_weather.windspeed)} ${unit==='F'?'mph':'km/h'}`;
          setUpdated();
        }).catch(()=>{$('#weatherSummary').textContent='Error loading weather.'});
    }
  }catch(e){ console.error(e); }
}

// RSS proxy
const rss = url => fetch(`/api/rss?url=${encodeURIComponent(url)}`).then(r=>r.text())
  .then(str => (new window.DOMParser()).parseFromString(str, 'text/xml'));

// US news
async function loadUSNews(){
  const xml = await rss('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
  const items = [...xml.querySelectorAll('item')].slice(0,12);
  const ul = $('#usNewsList'); ul.innerHTML='';
  items.forEach(it=>{
    const title = it.querySelector('title')?.textContent||'';
    const link = it.querySelector('link')?.textContent||'#';
    const src = (it.querySelector('source')?.textContent || new URL(link).hostname.replace('www.',''));
    const date = new Date(it.querySelector('pubDate')?.textContent||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const li = document.createElement('li');
    li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a><span class="dim">${src} • ${date}</span>`;
    ul.appendChild(li);
  });
}

// TikTok trending via RSSHub (keyless)
async function loadTikTok(){
  try{
    const xml = await rss('https://rsshub.app/tiktok/trending');
    const items = [...xml.querySelectorAll('item')].slice(0,10);
    const ul = $('#tiktokList'); ul.innerHTML='';
    items.forEach(it=>{
      const title = it.querySelector('title')?.textContent || 'Trending';
      const link = it.querySelector('link')?.textContent || '#';
      const li = document.createElement('li');
      li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a>`;
      ul.appendChild(li);
    });
  }catch(e){
    $('#tiktokList').innerHTML = '<li class="dim">Issue fetching TikTok. Try again later.</li>';
  }
}

// Reddit
async function loadReddit(){
  try{
    const r = await fetch('https://www.reddit.com/r/popular.json?limit=12');
    const j = await r.json();
    const ul = $('#redditList'); ul.innerHTML='';
    j.data.children.forEach(p=>{
      const {title, permalink, ups} = p.data;
      const li = document.createElement('li');
      li.innerHTML = `<a href="https://www.reddit.com${permalink}" target="_blank" rel="noopener">${title}</a> <span class="dim">▲${ups.toLocaleString()}</span>`;
      ul.appendChild(li);
    });
  }catch(e){ $('#redditList').innerHTML = '<li class="dim">Error loading Reddit.</li>'; }
}

// Markets (Stooq keyless)
async function loadMarkets(){
  const map = { 'S&P 500':'spx', 'Dow 30':'dji', 'Nasdaq 100':'ndx' };
  const grid = $('#marketsGrid'); grid.innerHTML='';
  for (const [name,sym] of Object.entries(map)){
    try{
      const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
      const txt = await fetch(url).then(r=>r.text());
      const [hdr, row] = txt.trim().split('\n');
      const cols = row.split(',');
      const close = parseFloat(cols[6]);
      const open = parseFloat(cols[3]);
      const chg = close - open; const pct = (chg/open*100);
      const div = document.createElement('div'); div.className='ticker';
      div.innerHTML = `<div class="name">${name}</div><div class="price">${close.toFixed(2)}</div><div class="chg ${chg>=0?'up':'down'}">${chg>=0?'+':''}${chg.toFixed(2)} (${pct.toFixed(2)}%)</div>`;
      grid.appendChild(div);
    }catch(e){
      const div = document.createElement('div'); div.className='ticker';
      div.innerHTML = `<div class="name">${name}</div><div class="dim">N/A</div>`;
      grid.appendChild(div);
    }
  }
}

// Economy (Fed/BLS/BEA RSS)
const econFeeds = [
  'https://www.federalreserve.gov/feeds/press_all.xml',
  'https://www.bls.gov/feed/news.rss',
  'https://www.bea.gov/news/rss/all.xml'
];
async function loadEconomy(){
  const ul = $('#econList'); ul.innerHTML='';
  for (const f of econFeeds){
    try{
      const xml = await rss(f);
      const items = [...xml.querySelectorAll('item')].slice(0,3);
      items.forEach(it=>{
        const title = it.querySelector('title')?.textContent||'';
        const link = it.querySelector('link')?.textContent||'#';
        const src = new URL(link).hostname.replace('www.','');
        const date = new Date(it.querySelector('pubDate')?.textContent||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'});
        const li = document.createElement('li');
        li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a><span class="dim">${src} • ${date}</span>`;
        ul.appendChild(li);
      });
    }catch(e){
      ul.insertAdjacentHTML('beforeend','<li class="dim">Error loading economy feed.</li>');
    }
  }
}

// boot
function init(){
  setUpdated();
  fetchWeather();
  loadUSNews();
  loadReddit();
  loadTikTok();
  loadMarkets();
  loadEconomy();
  setInterval(()=>{ setUpdated(); loadUSNews(); loadReddit(); loadTikTok(); loadMarkets(); loadEconomy(); fetchWeather(); }, 30*60*1000);
}
document.addEventListener('DOMContentLoaded', init);
