// helpers
const $ = (s, r=document)=>r.querySelector(s);
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

// weather
async function fetchWeather(){
  try{
    let lat=33.5779, lon=-101.8552;
    const go = () => {
      const params = new URLSearchParams({
        latitude: lat, longitude: lon,
        current_weather: true, daily: 'temperature_2m_max,temperature_2m_min,weathercode',
        timezone: 'auto', temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius', windspeed_unit: unit === 'F' ? 'mph':'kmh'
      });
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
        .then(r=>r.json()).then(d=>{
          $('#weatherLocation').textContent = 'Your area';
          $('#currentTemp').textContent = Math.round(d.current_weather.temperature);
          $('#highTemp').textContent = Math.round(d.daily.temperature_2m_max[0]);
          $('#lowTemp').textContent = Math.round(d.daily.temperature_2m_min[0]);
          const ws = Math.round(d.current_weather.windspeed);
          $('#weatherSummary').textContent = `Winds ${ws} ${unit==='F'?'mph':'km/h'}`;
          setUpdated();
        }).catch(()=>$('#weatherSummary').textContent='Error loading weather.');
    };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p=>{lat=p.coords.latitude;lon=p.coords.longitude;go();}, go, {timeout:4000});
    } else go();
  }catch(e){ console.error(e); }
}

// proxy helpers
const prox = url => fetch(`/api/rss?url=${encodeURIComponent(url)}`);

// parse RSS into XML
const rssXML = async url => {
  const res = await prox(url);
  const txt = await res.text();
  return (new DOMParser()).parseFromString(txt, 'text/xml');
};

// US news
async function loadUSNews(){
  try{
    const xml = await rssXML('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
    const items = [...xml.querySelectorAll('item')].slice(0,12);
    const ul = document.getElementById('usNewsList'); ul.innerHTML='';
    items.forEach(it=>{
      const title = it.querySelector('title')?.textContent||'';
      const link = it.querySelector('link')?.textContent||'#';
      const src = (it.querySelector('source')?.textContent || new URL(link).hostname.replace('www.',''));
      const date = new Date(it.querySelector('pubDate')?.textContent||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'});
      const li = document.createElement('li');
      li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a><span class="dim">${src} • ${date}</span>`;
      ul.appendChild(li);
    });
  }catch(e){
    document.getElementById('usNewsList').innerHTML = '<li class="dim">Error loading feed.</li>';
  }
}

// TikTok via RSSHub (inline thumbnails & titles; no need to tap)
async function loadTikTok(){
  const ul = document.getElementById('tiktokList'); ul.innerHTML = '';
  try{
    const xml = await rssXML('https://rsshub.app/tiktok/trending');
    const items = [...xml.querySelectorAll('item')].slice(0,8);
    items.forEach(it=>{
      const title = it.querySelector('title')?.textContent || 'Trending';
      // Try to get thumbnail (media:content or img in description)
      let thumb = it.querySelector('media\:content, content')?.getAttribute?.('url') || '';
      if (!thumb){
        const desc = it.querySelector('description')?.textContent || '';
        const m = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
        thumb = m ? m[1] : '';
      }
      const li = document.createElement('li');
      li.className = 'media';
      li.innerHTML = `${thumb?`<img alt="" src="${thumb}">`:'<div style="width:56px;height:56px;border-radius:8px;background:#0b1016"></div>'}<div class="title">${title}</div>`;
      ul.appendChild(li);
    });
    if(items.length===0){
      ul.innerHTML = '<li class="dim">No trending items available right now.</li>';
    }
  }catch(e){
    ul.innerHTML = '<li class="dim">Issue fetching TikTok. Try again later.</li>';
  }
}

// Reddit
async function loadReddit(){
  try{
    const r = await fetch('https://www.reddit.com/r/popular.json?limit=12');
    const j = await r.json();
    const ul = document.getElementById('redditList'); ul.innerHTML='';
    j.data.children.forEach(p=>{
      const {title, permalink, ups} = p.data;
      const li = document.createElement('li');
      li.innerHTML = `<a href="https://www.reddit.com${permalink}" target="_blank" rel="noopener">${title}</a> <span class="dim">▲${ups.toLocaleString()}</span>`;
      ul.appendChild(li);
    });
  }catch(e){ document.getElementById('redditList').innerHTML = '<li class="dim">Error loading Reddit.</li>'; }
}

// Markets (proxy CSV via /api/fetch to avoid CORS)
async function loadMarkets(){
  const map = { 'S&P 500':'spx', 'Dow 30':'dji', 'Nasdaq 100':'ndx' };
  const grid = document.getElementById('marketsGrid'); grid.innerHTML='';
  for (const [name,sym] of Object.entries(map)){
    try{
      const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
      const txt = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`).then(r=>r.text());
      const row = txt.trim().split('\n')[1];
      const cols = row.split(',');
      const close = parseFloat(cols[6]); const open = parseFloat(cols[3]);
      const chg = close - open; const pct = (chg/open*100);
      const div = document.createElement('div'); div.className='ticker';
      div.innerHTML = `<div class="name">${name}</div><div class="price">${isFinite(close)?close.toFixed(2):'N/A'}</div><div class="chg ${chg>=0?'up':'down'}">${isFinite(chg)?(chg>=0?'+':'')+chg.toFixed(2)+` (${pct.toFixed(2)}%)`:'N/A'}</div>`;
      grid.appendChild(div);
    }catch(e){
      const div = document.createElement('div'); div.className='ticker';
      div.innerHTML = `<div class="name">${name}</div><div class="price">N/A</div><div class="chg">N/A</div>`;
      grid.appendChild(div);
    }
  }
}

// Economy
const econFeeds = [
  'https://www.federalreserve.gov/feeds/press_all.xml',
  'https://www.bls.gov/feed/news.rss',
  'https://www.bea.gov/news/rss/all.xml'
];
async function loadEconomy(){
  const ul = document.getElementById('econList'); ul.innerHTML='';
  for (const f of econFeeds){
    try{
      const xml = await rssXML(f);
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
