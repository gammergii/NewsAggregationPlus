// Vercel build — uses /api/rss proxy
const DEFAULT={city:"Lubbock",region:"Texas",lat:33.5779,lon:-101.8552};
const STATE={unit:"F",place:{...DEFAULT},weatherC:null};
const els={unitToggle:document.getElementById('unitToggle'),lastUpdated:document.getElementById('lastUpdated'),
weatherLocation:document.getElementById('weatherLocation'),currentTemp:document.getElementById('currentTemp'),
highTemp:document.getElementById('highTemp'),lowTemp:document.getElementById('lowTemp'),weatherSummary:document.getElementById('weatherSummary'),
localNewsList:document.getElementById('localNewsList'),redditList:document.getElementById('redditList'),aiList:document.getElementById('aiList')};

function cToF(c){return(c*9/5)+32;}
function formatTemp(v){if(v==null||Number.isNaN(v))return"--";return Math.round(STATE.unit==="F"?cToF(v):v);}
function setUpdated(){if(els.lastUpdated) els.lastUpdated.textContent="Updated "+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
function faviconFor(url){try{const u=new URL(url);return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;}catch{return"";}}
function escapeHtml(s){return s?.replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))||'';}

// Weather
async function loadWeather(){
  const {lat,lon}=STATE.place;
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1&temperature_unit=celsius`;
  const data=await fetch(url).then(r=>r.json());
  STATE.weatherC={current:data?.current_weather?.temperature,high:data?.daily?.temperature_2m_max?.[0],low:data?.daily?.temperature_2m_min?.[0]};
  document.getElementById('weatherLocation').textContent=`${STATE.place.city}, ${STATE.place.region}`;
  document.getElementById('weatherSummary').textContent=data?.current_weather?`Winds ${Math.round(data.current_weather.windspeed)} ${data.hourly_units?.windspeed_10m||'km/h'}`:"—";
  renderWeather();
}
function renderWeather(){ if(!STATE.weatherC)return; els.currentTemp.textContent=formatTemp(STATE.weatherC.current); els.highTemp.textContent=formatTemp(STATE.weatherC.high); els.lowTemp.textContent=formatTemp(STATE.weatherC.low); }

// RSS via Vercel API route
async function fetchRSS(feedUrl){
  const prox=`/api/rss?url=${encodeURIComponent(feedUrl)}`;
  const xml=await fetch(prox).then(r=>{ if(!r.ok) throw new Error('RSS proxy failed'); return r.text(); });
  const doc=new DOMParser().parseFromString(xml,"text/xml");
  if(doc.querySelector('parsererror')) throw new Error('Bad XML');
  const items=[...doc.querySelectorAll('item')].map(it=>{
    const link=it.querySelector('link')?.textContent?.trim()||'';
    const title=it.querySelector('title')?.textContent?.trim()||'';
    const pubDate=it.querySelector('pubDate')?.textContent?.trim()||'';
    return {title,link,pubDate};
  });
  return items;
}

// U.S. News
async function loadUSNews(){
  const feed=`https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`;
  try{
    const items=await fetchRSS(feed);
    localNewsList.innerHTML=items.slice(0,10).map(i=>{
      const fav=faviconFor(i.link);
      const host=(()=>{ try{return new URL(i.link).hostname.replace('www.','');}catch{return '';} })();
      const when=i.pubDate?new Date(i.pubDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
      return `<li class="item"><img class="favicon" src="${fav}" alt=""/><div><a href="${i.link}" target="_blank" rel="noopener">${escapeHtml(i.title)}</a><div class="meta">${host}${when?" • "+when:""}</div></div></li>`;
    }).join('');
  }catch{ localNewsList.innerHTML = '<li class="dim">Error loading feed.</li>'; }
}

// Reddit
async function loadReddit(){
  try{
    const data=await fetch('https://www.reddit.com/r/popular.json?limit=20').then(r=>r.json());
    const posts=(data?.data?.children||[]).map(x=>x.data);
    redditList.innerHTML=posts.slice(0,12).map(p=>`<li>• <a href="https://www.reddit.com${p.permalink}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a> <span class="meta">▲${new Intl.NumberFormat().format(p.ups||p.score||0)}</span></li>`).join('');
  }catch{ redditList.innerHTML = '<li class="dim">Error loading Reddit.</li>'; }
}

// AI News (last 30 days)
const AI_FEEDS=[
  'https://ai.googleblog.com/feeds/posts/default?alt=rss',
  'https://openai.com/blog/rss/',
  'https://huggingface.co/blog/feed.xml',
  'https://venturebeat.com/category/ai/feed/',
  'https://www.theverge.com/artificial-intelligence/rss/index.xml',
  'https://ai.facebook.com/blog/rss/'
];
async function loadAINews(){
  try{
    let all=[];
    for(const f of AI_FEEDS){ try{ all = all.concat(await fetchRSS(f)); }catch{} }
    const cutoff=Date.now()-30*24*60*60*1000;
    all = all.filter(i=>Date.parse(i.pubDate||'')>=cutoff);
    all.sort((a,b)=>Date.parse(b.pubDate||0)-Date.parse(a.pubDate||0));
    const seen=new Set(); const out=[];
    for(const i of all){ if(!seen.has(i.link)){ seen.add(i.link); out.push(i);} }
    aiList.innerHTML=out.slice(0,20).map(i=>{
      const fav=faviconFor(i.link);
      const host=(()=>{ try{return new URL(i.link).hostname.replace('www.','');}catch{return '';} })();
      const when=i.pubDate?new Date(i.pubDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
      return `<li class="item"><img class="favicon" src="${fav}" alt=""/><div><a href="${i.link}" target="_blank" rel="noopener">${escapeHtml(i.title)}</a><div class="meta">${host}${when?" • "+when:""}</div></div></li>`;
    }).join('');
  }catch{ aiList.innerHTML = '<li class="dim">Error loading feed.</li>'; }
}

els.unitToggle.addEventListener('click',()=>{ STATE.unit=STATE.unit==="F"?"C":"F"; els.unitToggle.textContent=`°${STATE.unit}`; renderWeather(); });

(async()=>{ await loadWeather(); await Promise.all([loadUSNews(),loadReddit(),loadAINews()]); setUpdated(); setInterval(async()=>{ await Promise.all([loadWeather(),loadUSNews(),loadReddit(),loadAINews()]); setUpdated(); }, 30*60*1000); })();

