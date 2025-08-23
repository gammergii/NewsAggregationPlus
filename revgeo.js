export default async function handler(req, res) {
  const {lat, lon} = req.query;
  if(!lat || !lon){ res.status(400).json({}); return; }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (+NewsAggregationPlus)' }});
    const j = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=86400');
    res.status(200).json(j.address || {});
  } catch(e){
    res.status(200).json({});
  }
}