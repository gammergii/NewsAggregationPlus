export default async function handler(req, res){
  try{
    const { lat, lon } = req.query;
    if(!lat || !lon){ res.status(400).json({error:'Missing lat/lon'}); return; }
    const u = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`;
    const r = await fetch(u);
    const j = await r.json();
    const place = j?.results?.[0];
    const city = place?.city || place?.name || '';
    const admin = place?.admin1 || place?.admin2 || place?.country || '';
    res.status(200).json({ label: [city, admin].filter(Boolean).join(', ') });
  }catch(e){
    res.status(200).json({ label: 'Your area' });
  }
}
