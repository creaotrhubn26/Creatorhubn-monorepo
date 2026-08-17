// TEMP — enkel statisk server for å vise bygget frontend.
// SPA-fallback → index.html, og proxy /api → backend (mocks fanger opp i browseren uansett).
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, 'client/dist');
const PORT = 4174;
const API_TARGET = 'http://localhost:3003';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';

    // API-proxy → backend (kun hvis ikke mocket i browseren)
    if (url.startsWith('/api/')) {
      const proxyReq = http.request(
        API_TARGET + url + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
        { method: req.method, headers: { ...req.headers, host: undefined } },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'proxy unavailable' }));
      });
      if (req.method === 'GET' || req.method === 'HEAD') proxyReq.end();
      else req.pipe(proxyReq);
      return;
    }

    let filePath = path.join(DIST, url);
    let ext = path.extname(filePath).toLowerCase();
    if (ext === '') filePath = path.join(filePath, 'index.html'); // katalog
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA-fallback
      filePath = path.join(DIST, 'index.html');
      ext = '.html';
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`Serving ${DIST} on http://localhost:${PORT}`);
  });
