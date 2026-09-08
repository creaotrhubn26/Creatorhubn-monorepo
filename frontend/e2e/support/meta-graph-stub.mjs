/**
 * Lokal stand-in for graph.facebook.com/v21.0.
 *
 * Svarer med de FAKTISKE feltnavnene Meta bruker (fan_count,
 * followers_count, …) — bruker man egne navn her beviser testen bare at
 * koden leser sine egne oppfinnelser. Skrivekall logges til en jsonl-fil
 * slik at set-cta og publish-event kan bevises å sende riktige felter.
 *
 * Startes med:
 *   node frontend/e2e/support/meta-graph-stub.mjs
 * og backend peker hit via META_GRAPH_BASE_URL=http://127.0.0.1:4010.
 * Se docs/LOCAL_E2E_MARKETING_COCKPIT.md.
 */
import http from 'node:http';
import fs from 'node:fs';

const PAGE = 'page-1', IG = 'ig-1';
const WRITES = process.env.GRAPH_STUB_WRITE_LOG
  || new URL('./graph-writes.jsonl', import.meta.url).pathname;
fs.writeFileSync(WRITES, '');

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\//, '');

  if (req.method === 'POST') {
    let raw = ''; for await (const c of req) raw += c;
    fs.appendFileSync(WRITES, JSON.stringify({ path: p, body: raw, at: new Date().toISOString() }) + '\n');
    if (p === PAGE) return json(res, 200, { success: true });
    if (p === `${IG}/upcoming_events`) return json(res, 200, { id: 'event-999' });
    return json(res, 200, { success: true });
  }

  if (p === PAGE) {
    return json(res, 200, {
      id: PAGE, name: 'The Role Room', fan_count: 2481,
      followers_count: 2512, link: 'https://facebook.com/theroleroom',
      category: 'Casting Agency', about: 'Casting for film og TV',
      verification_status: 'not_verified',
    });
  }
  if (p === `${PAGE}/tagged`) {
    return json(res, 200, { data: [
      { id: 'm1', message: 'Takk til @theroleroom for en super audition!',
        created_time: '2026-09-05T10:00:00+0000', permalink_url: 'https://facebook.com/m1',
        from: { name: 'Kari Nordmann', id: 'u1' } },
    ]});
  }
  if (p === IG) {
    return json(res, 200, {
      id: IG, username: 'theroleroom', followers_count: 1893,
      media_count: 214, biography: 'Casting', website: 'https://theroleroom.no',
    });
  }
  if (p === `${IG}/upcoming_events`) {
    return json(res, 200, { data: [
      { id: 'ev1', title: 'Open Call Oslo', start_time: '2026-09-20T10:00:00+0000' },
    ]});
  }
  if (p === 'ig_hashtag_search') return json(res, 200, { data: [{ id: 'ht1' }] });
  if (p === 'ht1/recent_media') {
    return json(res, 200, { data: [
      { id: 'p1', caption: '#norskcasting audition i dag', like_count: 42,
        comments_count: 7, permalink: 'https://instagram.com/p/1',
        timestamp: '2026-09-06T09:00:00+0000', media_type: 'IMAGE' },
    ]});
  }
  if (p === `${PAGE}/leadgen_forms`) {
    return json(res, 200, { data: [
      { id: 'f1', name: 'Skuespiller-registrering', status: 'ACTIVE', leads_count: 37 },
    ]});
  }
  return json(res, 404, { error: { message: `Unknown path ${p}`, code: 803 } });
}).listen(4010, '127.0.0.1', () => console.log('fake-graph on 4010'));
