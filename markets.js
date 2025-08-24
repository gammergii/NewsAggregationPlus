function stooqUrl(t){ return `https://stooq.com/q/l/?s=${t.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`; }

async function quote(t){
  const r = await fetch(stooqUrl(t));
  const csv = await r.text();
  const lines = csv.trim().split(/\r?\n/);
  if(lines.length<2) return null;
  const parts = lines[1].split(',');
  const open = parseFloat(parts[3]); const close = parseFloat(parts[6]);
  if(isNaN(open)||isNaN(close)) return null;
  const change = close - open;
  const changePct = open? (change/open*100) : 0;
  return { ticker:t, price: close, change, changePct };
}

export default async function handler(req, res){
  try{
    const tickers = (req.query.tickers || 'SPY,DIA,QQQ').split(',').map(s=>s.trim().toUpperCase());
    const out = {};
    await Promise.all(tickers.map(async t=>{ out[t] = await quote(t); }));
    res.status(200).json(out);
  }catch(e){
    res.status(500).json({error: e.message});
  }
}
