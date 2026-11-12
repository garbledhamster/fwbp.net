const origins = new Set(['https://fwbp.net', 'https://www.fwbp.net']);
const encoder = new TextEncoder();

async function visitorKey(ip, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const { pathname } = new URL(request.url);
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && !origins.has(origin)) return new Response(null, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;

    const read = request.method === 'GET' && pathname === '/';
    const record = request.method === 'POST' && (pathname === '/visit' || pathname === '/hotdog');
    if (!read && !record) return new Response(null, { status: 404, headers });

    try {
      if (record) {
        const ip = request.headers.get('CF-Connecting-IP');
        if (!origin || !ip) return new Response(null, { status: 403, headers });
        if (!env.COUNTER_KEY) return new Response(null, { status: 503, headers });

        const key = await visitorKey(ip, env.COUNTER_KEY);
        await env.DB.prepare(`
          INSERT INTO visitors (visitor_key, clicked_hotdog) VALUES (?, ?)
          ON CONFLICT(visitor_key) DO UPDATE SET clicked_hotdog = 1
          WHERE excluded.clicked_hotdog = 1 AND visitors.clicked_hotdog = 0
        `).bind(key, Number(pathname === '/hotdog')).run();
      }

      const totals = await env.DB.prepare('SELECT anglers, hotdog FROM totals WHERE id = 1').first();
      return totals
        ? Response.json(totals, { headers })
        : new Response(null, { status: 503, headers });
    } catch {
      return new Response(null, { status: 503, headers });
    }
  },
};
