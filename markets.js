function parseCSV(csv){
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const cols = header.split(',');
  return rows.map(r=>{
    const parts = r.split(',');
    const obj = {};
    cols.forEach((c,i)=>obj[c]=parts[i]);
    return obj;
  });
}
export default async function handler(req, res) {
  try{
    // Use ETFs as proxies for the indexes (free & reliable)
    const url = 'https://stooq.com/q/l/?s=spy,dia,qqq&f=sd2t2ohlcv&h=e';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (+NewsAggregationPlus)' }});
    const csv = await r.text();
    const rows = parseCSV(csv);
    const out = {};
    for (const row of rows){
      const sym = row.Symbol.toUpperCase();
      const price = parseFloat(row.Close);
      const open = parseFloat(row.Open);
      const change = price - open;
      const changePct = (change / open) * 100;
      out[sym] = { price, change, changePct };
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ SPY: out['SPY'], DIA: out['DIA'], QQQ: out['QQQ'] });
  }catch(e){
    res.status(200).json({});
  }
}