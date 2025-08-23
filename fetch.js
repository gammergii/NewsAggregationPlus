export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return new Response('Missing ?url=', { status: 400 });
  try {
    const res = await fetch(url, { next: { revalidate: 300 }, headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsAggregationPlus/1.0)' } });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'text/plain; charset=utf-8',
        'cache-control': 's-maxage=300, stale-while-revalidate=600',
        'access-control-allow-origin': '*'
      }
    });
  } catch (e) {
    return new Response('Fetch proxy error', { status: 502 });
  }
}
