export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    res.status(400).send('Missing url'); return;
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (+NewsAggregationPlus)' }});
    const text = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).send('Upstream error');
  }
}