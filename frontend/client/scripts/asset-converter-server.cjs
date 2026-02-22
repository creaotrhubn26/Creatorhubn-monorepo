#!/usr/bin/env node
/**
 * Role Room – Asset Converter UI
 * ────────────────────────────────
 * Run:  node scripts/asset-converter-server.js
 * Then open http://localhost:4444 in VS Code Simple Browser.
 *
 * • PNG / JPG  →  WebP  (via Python/Pillow)
 * • MP4 / MOV  →  H.264 MP4 with faststart  (via /tmp/ffmpeg)
 */

const http  = require('http');
const path  = require('path');
const fs    = require('fs');
const { spawn } = require('child_process');

const PORT   = 4444;
const ROOT   = path.join(__dirname, '..');
const KEEP   = path.join(ROOT, 'src/components/role-room/components/icons/Keep');
const OUT    = path.join(ROOT, 'public/role-room-assets');
const FFMPEG = '/tmp/ffmpeg';

// ── helpers ──────────────────────────────────────────────────────────────────

function outName(file) {
  const base = path.basename(file, path.extname(file)).toLowerCase();
  const ext  = path.extname(file).toLowerCase();
  if (['.mp4', '.mov'].includes(ext)) return base + '.mp4';
  if (['.png', '.jpg', '.jpeg'].includes(ext))  return base + '.webp';
  return null;
}

function fmtSize(bytes) {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function getFiles() {
  return fs.readdirSync(KEEP)
    .filter(f => /\.(png|jpg|jpeg|mp4|mov|MP4|MOV)$/i.test(f))
    .map(f => {
      const oName   = outName(f);
      const outPath = oName ? path.join(OUT, oName) : null;
      const exists  = outPath ? fs.existsSync(outPath) : false;
      const outSize = exists  ? fs.statSync(outPath).size : 0;
      const inStat  = fs.statSync(path.join(KEEP, f));
      const type    = /\.(mp4|mov)$/i.test(f) ? 'video' : 'image';
      return {
        name: f, type, inSize: inStat.size,
        outName: oName, outSize, converted: exists,
        busy: !!converting[f],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── state ─────────────────────────────────────────────────────────────────────

let globalLog  = [];
let converting = {};   // file → true while running
let queue      = [];
let queueBusy  = false;

function pushLog(msg) {
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
  globalLog.push(`[${t}]  ${msg}`);
  if (globalLog.length > 300) globalLog = globalLog.slice(-300);
  process.stdout.write(msg + '\n');
}

// ── conversion ────────────────────────────────────────────────────────────────

function runConvert(file, cb) {
  if (converting[file]) { cb && cb(); return; }
  converting[file] = true;

  const ext  = path.extname(file).toLowerCase();
  const inp  = path.join(KEEP, file);
  const oNm  = outName(file);
  const out  = path.join(OUT, oNm);
  const type = /\.(mp4|mov)$/.test(ext) ? 'video' : 'image';

  pushLog(`⟳  ${file}  →  ${oNm}`);

  const finish = (ok, extra) => {
    delete converting[file];
    if (ok) {
      const sz = fmtSize(fs.statSync(out).size);
      pushLog(`✓  ${oNm}  (${sz}${extra ? ', ' + extra : ''})`);
    } else {
      pushLog(`✗  ${file}  failed`);
    }
    cb && cb();
  };

  if (type === 'video') {
    if (!fs.existsSync(FFMPEG)) {
      pushLog(`✗  ffmpeg not found at ${FFMPEG} — run the setup task first`);
      delete converting[file]; cb && cb(); return;
    }
    const ff = spawn(FFMPEG, [
      '-y', '-i', inp,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-movflags', '+faststart', '-an', out,
    ]);
    ff.stderr.on('data', d => {
      // only forward fps/progress lines to avoid noise
      const line = d.toString().split('\n').find(l => l.includes('frame=') || l.includes('error'));
      if (line) pushLog('  ' + line.trim());
    });
    ff.on('close', code => finish(code === 0));
    ff.on('error', e => { pushLog(`✗  ${e.message}`); delete converting[file]; cb && cb(); });

  } else {
    const py = [
      'from PIL import Image',
      `img = Image.open(r"""${inp}""").convert("RGBA")`,
      `img.save(r"""${out}""", "WEBP", lossless=True, quality=100, method=6)`,
      `print(f"{img.size[0]}x{img.size[1]}")`,
    ].join('\n');
    const proc = spawn('python3', ['-c', py]);
    let dims = '';
    proc.stdout.on('data', d => dims += d);
    proc.stderr.on('data', d => { const s = d.toString().trim(); if (s) pushLog('  ' + s); });
    proc.on('close', code => finish(code === 0, dims.trim()));
    proc.on('error', e => { pushLog(`✗  ${e.message}`); delete converting[file]; cb && cb(); });
  }
}

function drainQueue() {
  if (queueBusy || queue.length === 0) return;
  queueBusy = true;
  const file = queue.shift();
  runConvert(file, () => { queueBusy = false; drainQueue(); });
}

function enqueue(file) {
  if (!queue.includes(file) && !converting[file]) queue.push(file);
  drainQueue();
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url   = req.url.split('?')[0];
  const method = req.method;

  // ── API ────────────────────────────────────────────────
  if (url === '/api/files' && method === 'GET') {
    return json(res, getFiles());
  }

  if (url === '/api/status' && method === 'GET') {
    return json(res, { log: globalLog, queue: queue.length, busy: Object.keys(converting) });
  }

  if (url === '/api/convert' && method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const { file } = JSON.parse(body);
      if (!file) return json(res, { error: 'missing file' }, 400);
      enqueue(file);
      return json(res, { ok: true });
    });
    return;
  }

  if (url === '/api/convert-all' && method === 'POST') {
    const pending = getFiles().filter(f => !f.converted && !f.busy);
    pending.forEach(f => enqueue(f.name));
    pushLog(`▶  Queued ${pending.length} file(s) for conversion`);
    return json(res, { queued: pending.length });
  }

  if (url === '/api/reconvert-all' && method === 'POST') {
    const all = getFiles();
    all.forEach(f => enqueue(f.name));
    pushLog(`▶  Force-queued all ${all.length} file(s)`);
    return json(res, { queued: all.length });
  }

  // ── HTML UI ────────────────────────────────────────────
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Role Room Asset Converter`);
  console.log(`  ──────────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
});

// ── embedded HTML UI ─────────────────────────────────────────────────────────
//    Open in VS Code Simple Browser:  http://localhost:4444

const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Role Room · Asset Converter</title>
<style>
:root{
  --bg:#09090f;--surface:#14131e;--card:#1c1a28;--card-hover:#221f32;
  --border:rgba(147,51,234,.22);--border-h:rgba(192,132,252,.45);
  --p:#9333ea;--pl:#c084fc;--dim:#e2e8f0;--sub:#94a3b8;--muted:#64748b;
  --green:#22c55e;--amber:#f59e0b;--red:#ef4444;--blue:#60a5fa;
  --radius:12px;--font:'Inter',system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--dim);font-family:var(--font);font-size:14px;min-height:100vh}
a{color:var(--pl);text-decoration:none}

/* ── layout ── */
header{display:flex;align-items:center;gap:12px;padding:18px 24px;
  background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
header h1{font-size:16px;font-weight:600;letter-spacing:.03em;color:var(--dim)}
header h1 span{color:var(--pl)}
.hbadge{margin-left:auto;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);background:var(--card);border:1px solid var(--border);
  border-radius:99px;padding:3px 10px}

.toolbar{display:flex;align-items:center;gap:10px;padding:14px 24px;
  background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap}
.stats{display:flex;gap:16px;margin-right:auto;flex-wrap:wrap}
.stat{display:flex;flex-direction:column;align-items:center;gap:2px}
.stat-n{font-size:22px;font-weight:700;line-height:1;color:var(--dim)}
.stat-n.green{color:var(--green)}.stat-n.amber{color:var(--amber)}
.stat-l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}

.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border:none;border-radius:8px;
  cursor:pointer;font-size:13px;font-weight:500;font-family:var(--font);transition:all .15s}
.btn-primary{background:var(--p);color:#fff}
.btn-primary:hover{background:#7e22ce}
.btn-ghost{background:transparent;color:var(--sub);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--border-h);color:var(--dim)}
.btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}
.btn:disabled{opacity:.4;cursor:default}

.filters{display:flex;gap:6px;padding:12px 24px;background:var(--surface);
  border-bottom:1px solid var(--border)}
.filter-btn{padding:5px 14px;border-radius:99px;border:1px solid var(--border);
  background:transparent;color:var(--sub);font-size:12px;cursor:pointer;font-family:var(--font);
  transition:all .15s;font-weight:500}
.filter-btn.active,.filter-btn:hover{border-color:var(--pl);color:var(--pl);background:rgba(147,51,234,.08)}

.search-wrap{padding:0 24px 0;background:var(--surface);border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center}
.search{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;
  color:var(--dim);font-size:13px;font-family:var(--font);padding:7px 12px;width:260px;outline:none}
.search:focus{border-color:var(--pl)}
.search::placeholder{color:var(--muted)}

main{padding:20px 24px;display:flex;flex-direction:column;gap:16px}

.grid-header{display:flex;align-items:center;justify-content:space-between}
.grid-header h2{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}

.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
  padding:14px;display:flex;flex-direction:column;gap:10px;transition:all .15s;position:relative}
.card:hover{border-color:var(--border-h);background:var(--card-hover)}
.card.done{border-color:rgba(34,197,94,.2)}
.card.converting{border-color:rgba(96,165,250,.4);animation:pulse-border 1.5s ease-in-out infinite}
@keyframes pulse-border{0%,100%{box-shadow:0 0 0 0 rgba(96,165,250,0)}50%{box-shadow:0 0 0 3px rgba(96,165,250,.15)}}

.card-name{font-size:12px;font-weight:500;color:var(--dim);word-break:break-all;line-height:1.4}
.card-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.badge-video{background:rgba(147,51,234,.15);color:var(--pl)}
.badge-image{background:rgba(96,165,250,.12);color:var(--blue)}
.badge-done{background:rgba(34,197,94,.12);color:var(--green)}
.badge-pending{background:rgba(245,158,11,.1);color:var(--amber)}
.badge-busy{background:rgba(96,165,250,.12);color:var(--blue)}

.card-out{font-size:11px;color:var(--muted);margin-top:-4px}
.card-out.exists{color:var(--green)}

.card-actions{display:flex;gap:6px;margin-top:auto;padding-top:4px}
.btn-convert{background:rgba(147,51,234,.15);color:var(--pl);border:1px solid rgba(147,51,234,.3);padding:5px 12px;font-size:12px;border-radius:6px;cursor:pointer;font-family:var(--font);font-weight:500;transition:all .15s;flex:1}
.btn-convert:hover{background:rgba(147,51,234,.3);border-color:var(--pl)}
.btn-convert:disabled{opacity:.35;cursor:default}
.btn-reconvert{background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 8px;font-size:12px;border-radius:6px;cursor:pointer;font-family:var(--font);transition:all .15s;title:"Re-convert"}
.btn-reconvert:hover{border-color:var(--border-h);color:var(--dim)}

.empty{grid-column:1/-1;text-align:center;padding:48px;color:var(--muted);font-size:13px}

/* ── log console ── */
.log-wrap{position:fixed;bottom:0;left:0;right:0;background:var(--surface);
  border-top:1px solid var(--border);display:flex;flex-direction:column;height:160px;z-index:9}
.log-header{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0}
.log-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.log-badge{width:7px;height:7px;border-radius:50%;background:var(--muted);flex-shrink:0}
.log-badge.active{background:var(--green);box-shadow:0 0 0 3px rgba(34,197,94,.2);animation:glow .8s ease-in-out infinite alternate}
@keyframes glow{from{opacity:.6}to{opacity:1}}
.log-body{flex:1;overflow-y:auto;padding:8px 16px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:11.5px;line-height:1.65;color:var(--sub)}
.log-body .ok{color:var(--green)}.log-body .err{color:var(--red)}.log-body .spin{color:var(--blue)}
.log-clear{margin-left:auto;padding:3px 8px;font-size:11px;background:transparent;border:1px solid var(--border);
  border-radius:5px;color:var(--muted);cursor:pointer;font-family:var(--font)}
.log-clear:hover{border-color:var(--border-h);color:var(--dim)}

main{padding-bottom:180px}

/* scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(147,51,234,.3);border-radius:3px}
</style>
</head>
<body>

<header>
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8"/><polyline points="7 9 12 12 17 9"/><line x1="12" y1="12" x2="12" y2="22"/></svg>
  <h1>Role Room &nbsp;<span>Asset Converter</span></h1>
  <span class="hbadge" id="server-port">:4444</span>
</header>

<div class="toolbar">
  <div class="stats">
    <div class="stat"><span class="stat-n" id="stat-total">—</span><span class="stat-l">Total</span></div>
    <div class="stat"><span class="stat-n green" id="stat-done">—</span><span class="stat-l">Converted</span></div>
    <div class="stat"><span class="stat-n amber" id="stat-pending">—</span><span class="stat-l">Pending</span></div>
    <div class="stat"><span class="stat-n" style="color:var(--blue)" id="stat-queue">—</span><span class="stat-l">In Queue</span></div>
  </div>
  <button class="btn btn-primary" id="btn-all">▶ Convert All Pending</button>
  <button class="btn btn-ghost" id="btn-force">↺ Re-convert All</button>
</div>

<div class="filters">
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="image">Images</button>
  <button class="filter-btn" data-filter="video">Video</button>
  <button class="filter-btn" data-filter="pending">Pending</button>
  <button class="filter-btn" data-filter="done">Converted</button>
</div>

<div class="search-wrap" style="padding:10px 24px">
  <input class="search" type="text" id="search" placeholder="Filter by filename…">
</div>

<main>
  <div class="grid-header">
    <h2 id="grid-label">Loading…</h2>
  </div>
  <div class="grid" id="grid"></div>
</main>

<div class="log-wrap">
  <div class="log-header">
    <div class="log-badge" id="log-badge"></div>
    <span class="log-title">Conversion Log</span>
    <button class="log-clear" onclick="clearLog()">Clear</button>
  </div>
  <div class="log-body" id="log"></div>
</div>

<script>
let files   = [];
let filter  = 'all';
let search  = '';
let logLines = [];

const grid       = document.getElementById('grid');
const logEl      = document.getElementById('log');
const logBadge   = document.getElementById('log-badge');
const statTotal  = document.getElementById('stat-total');
const statDone   = document.getElementById('stat-done');
const statPend   = document.getElementById('stat-pending');
const statQueue  = document.getElementById('stat-queue');
const gridLabel  = document.getElementById('grid-label');

// ── fetch ──────────────────────────────────────────────────────────
async function fetchFiles() {
  const r = await fetch('/api/files');
  files = await r.json();
  renderGrid();
}

async function fetchStatus() {
  const r = await fetch('/api/status');
  const s = await r.json();
  // merge busy state
  files = files.map(f => ({ ...f, busy: s.busy.includes(f.name) }));
  statQueue.textContent = s.queue + s.busy.length;
  logBadge.className = 'log-badge' + (s.busy.length || s.queue ? ' active' : '');

  // append new log lines
  if (s.log.length > logLines.length) {
    const newLines = s.log.slice(logLines.length);
    logLines = s.log;
    newLines.forEach(line => {
      const div = document.createElement('div');
      div.className = line.startsWith('[') && line.includes('✓') ? 'ok'
                    : line.includes('✗') ? 'err'
                    : line.includes('⟳') || line.includes('▶') ? 'spin' : '';
      div.textContent = line;
      logEl.appendChild(div);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }
  renderGrid();
}

function clearLog() {
  logLines = []; logEl.innerHTML = '';
  fetch('/api/status').then(r=>r.json()).then(s=>{ logLines = s.log; });
}

// ── render ─────────────────────────────────────────────────────────
function renderGrid() {
  const total   = files.length;
  const done    = files.filter(f => f.converted).length;
  const pending = total - done;
  statTotal.textContent  = total;
  statDone.textContent   = done;
  statPend.textContent   = pending;

  let visible = files.filter(f => {
    if (filter === 'image'  && f.type !== 'image')     return false;
    if (filter === 'video'  && f.type !== 'video')     return false;
    if (filter === 'done'   && !f.converted)           return false;
    if (filter === 'pending' && f.converted)           return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  gridLabel.textContent = visible.length + ' file' + (visible.length !== 1 ? 's' : '');
  grid.innerHTML = '';

  if (!visible.length) {
    grid.innerHTML = '<div class="empty">No files match the current filter.</div>';
    return;
  }

  visible.forEach(f => {
    const card = document.createElement('div');
    card.className = 'card' + (f.busy ? ' converting' : f.converted ? ' done' : '');
    card.innerHTML = \`
      <div class="card-name">\${f.name}</div>
      <div class="card-meta">
        <span class="badge badge-\${f.type}">\${f.type}</span>
        <span class="badge \${f.busy ? 'badge-busy' : f.converted ? 'badge-done' : 'badge-pending'}">
          \${f.busy ? 'converting…' : f.converted ? 'done' : 'pending'}</span>
      </div>
      <div class="card-out \${f.converted ? 'exists' : ''}">
        \${f.converted
          ? '✓ ' + f.outName + ' (' + fmtSize(f.outSize) + ')'
          : f.outName ? '→ ' + f.outName : 'unsupported'}
      </div>
      <div class="card-meta" style="font-size:11px;color:var(--muted)">
        source: \${fmtSize(f.inSize)}
      </div>
      <div class="card-actions">
        <button class="btn-convert" \${f.busy ? 'disabled' : ''} onclick="convertOne('\${f.name}')">
          \${f.busy ? 'Converting…' : f.converted ? 'Re-convert' : '▶ Convert'}
        </button>
      </div>
    \`;
    grid.appendChild(card);
  });
}

function fmtSize(b) {
  if (b > 1048576) return (b/1048576).toFixed(1)+' MB';
  return (b/1024).toFixed(0)+' KB';
}

// ── actions ────────────────────────────────────────────────────────
async function convertOne(file) {
  await fetch('/api/convert', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ file }) });
  setTimeout(fetchFiles, 200);
}

document.getElementById('btn-all').onclick = async () => {
  await fetch('/api/convert-all', { method:'POST' });
};

document.getElementById('btn-force').onclick = async () => {
  if (!confirm('Re-convert ALL files (even already converted)?')) return;
  await fetch('/api/reconvert-all', { method:'POST' });
};

// ── filters ────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    renderGrid();
  };
});

document.getElementById('search').oninput = e => {
  search = e.target.value;
  renderGrid();
};

// ── poll ───────────────────────────────────────────────────────────
fetchFiles();
setInterval(fetchStatus, 1000);
setInterval(fetchFiles, 5000);
</script>
</body>
</html>`;
