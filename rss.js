export default async function handler(req, res) {
  try{
    const url = req.query.url;
    if(!url){ res.status(400).json({error:'Missing url'}); return; }
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsAggregationPlus/1.0)' } });
    const text = await r.text();
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.status(200).send(text);
  }catch(e){
    res.status(500).json({error: e.message});
  }
}
