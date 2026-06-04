/**
 * demoStudioExports — leveranse-generatorer som ikke går gjennom video-render:
 *   - buildSrt:        undertekst-fil (.srt) fra scenenes manus + varigheter
 *   - buildScriptHtml: print-klar manus-PDF (åpnes i print-vindu)
 *   - renderThumbnail: branded cover-PNG (thumbnail) via canvas
 *
 * Rene funksjoner (canvas for thumbnail), ingen nye avhengigheter.
 */

import {
  ACTION_META, DEMO_TYPE_LABELS, DEVICE_LABELS, totalDuration,
  type DemoProject, type DemoScene,
} from './demoStudioModel';

/** SRT-timecode: «HH:MM:SS,mmm». */
function srtTime(totalSec: number): string {
  const ms = Math.round(totalSec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(milli, 3)}`;
}

/** Bygg .srt fra scenene. Hver scene = ett blokk, timet etter varighet. */
export function buildSrt(scenes: DemoScene[]): string {
  let t = 0;
  const blocks: string[] = [];
  let idx = 0;
  for (const s of scenes) {
    const text = (s.narration || s.requiredAction || s.title || '').trim();
    const dur = s.duration > 0 ? s.duration : 3;
    if (text) {
      idx += 1;
      blocks.push(`${idx}\n${srtTime(t)} --> ${srtTime(t + dur)}\n${text}`);
    }
    t += dur;
  }
  return blocks.join('\n\n') + '\n';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Print-klar manus-HTML (åpnes i print-vindu → lagre som PDF). */
export function buildScriptHtml(project: DemoProject): string {
  const rows = project.scenes.map((s, i) => {
    const verb = ACTION_META[s.actionType ?? 'click'].verb;
    const action = s.targetLabel ? `${verb} ${esc(s.targetLabel)}` : esc(s.requiredAction || '—');
    return `
      <section class="scene">
        <div class="hd"><span class="num">${i + 1}</span><h2>${esc(s.title)}</h2>
          <span class="meta">${DEVICE_LABELS[s.device]} · ${s.duration}s</span></div>
        <div class="grid">
          <div class="k">Manus</div><div class="v">${esc(s.narration || '—')}</div>
          <div class="k">Handling</div><div class="v">${action}</div>
          ${s.visualInstruction ? `<div class="k">Visuelt</div><div class="v">${esc(s.visualInstruction)}</div>` : ''}
          ${s.overlayText ? `<div class="k">Overlay</div><div class="v">${esc(s.overlayText)}</div>` : ''}
          ${s.notes ? `<div class="k">Notat</div><div class="v">${esc(s.notes)}</div>` : ''}
        </div>
      </section>`;
  }).join('');

  return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<title>${esc(project.name)} — manus</title>
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #1d1b19; margin: 0; }
  header { border-bottom: 2px solid #ef8a5d; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b6358; font-size: 12px; }
  .scene { border: 1px solid #eae5dd; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .hd { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .num { background: #ef8a5d; color: #fff; font-weight: 700; font-size: 12px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; }
  h2 { font-size: 14px; margin: 0; }
  .meta { margin-left: auto; color: #9a9186; font-size: 11px; }
  .grid { display: grid; grid-template-columns: 70px 1fr; gap: 3px 10px; font-size: 12.5px; }
  .k { color: #9a9186; }
  footer { margin-top: 8px; color: #9a9186; font-size: 11px; }
</style></head><body>
<header>
  <h1>${esc(project.name)}</h1>
  <div class="sub">${DEMO_TYPE_LABELS[project.demoType]} · ${esc(project.url)} · ${project.scenes.length} scener · ${Math.round(totalDuration(project.scenes))}s</div>
</header>
${rows}
<footer>Generert av Product Demo Studio</footer>
</body></html>`;
}

/**
 * Bygg en SELVSTENDIG interaktiv guide (HTML): klikkbar steg-for-steg-
 * gjennomgang med hotspots + tooltips + required actions. Den andre output-en
 * ved siden av video — «Interactive Content» i flyten. Embedder scenene som
 * JSON + inline CSS/JS, så fila kan deles og åpnes i hvilken som helst nettleser.
 *
 * Hvert steg viser sidens skjermbilde (thumbnailDataUrl) hvis det finnes, ellers
 * en live <iframe> av URL-en. Hotspot + bobletekst plasseres i viewport-prosent.
 */
export function buildInteractiveGuideHtml(project: DemoProject): string {
  const steps = project.scenes.map((s) => ({
    title: s.title,
    device: s.device,
    url: project.url,
    narration: s.narration || '',
    action: s.targetLabel ? `${ACTION_META[s.actionType ?? 'click'].verb} ${s.targetLabel}` : (s.requiredAction || ''),
    overlay: s.overlayText || '',
    hotspot: s.hotspot || null,
    thumb: s.thumbnailDataUrl || null,
    startScrollPct: s.startScrollPct ?? 0,
  }));
  const data = JSON.stringify({ name: project.name, steps }).replace(/</g, '\\u003c');

  return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} — interaktiv guide</title>
<style>
  :root { --accent:#ef8a5d; --ink:#1d1b19; --soft:#6b6358; --line:#eae5dd; --bg:#f3efe9; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; color:var(--ink); background:var(--bg); }
  header { display:flex; align-items:center; gap:10px; padding:12px 18px; background:#fff; border-bottom:1px solid var(--line); }
  header h1 { font-size:15px; margin:0; }
  header .step { margin-left:auto; color:var(--soft); font-size:12.5px; }
  .stage { display:flex; align-items:center; justify-content:center; padding:24px; min-height:60vh; }
  .screen { position:relative; background:#000; border-radius:14px; overflow:hidden; box-shadow:0 18px 50px rgba(0,0,0,.22); }
  .screen iframe, .screen img { position:absolute; inset:0; width:100%; height:100%; border:0; object-fit:cover; object-position:top; }
  .hot { position:absolute; border:2px solid var(--accent); border-radius:10px; box-shadow:0 0 0 9999px rgba(0,0,0,.30); cursor:pointer; animation:pulse 1.6s infinite; }
  @keyframes pulse { 0%,100%{ box-shadow:0 0 0 9999px rgba(0,0,0,.30), 0 0 0 0 rgba(239,138,93,.5);} 50%{ box-shadow:0 0 0 9999px rgba(0,0,0,.30), 0 0 0 10px rgba(239,138,93,0);} }
  .tip { position:absolute; max-width:260px; background:#fff; color:var(--ink); border-radius:10px; padding:11px 13px; box-shadow:0 8px 24px rgba(0,0,0,.25); font-size:13px; z-index:5; }
  .tip b { display:block; color:var(--accent); font-size:11.5px; text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
  footer { display:flex; align-items:center; gap:14px; padding:14px 18px; background:#fff; border-top:1px solid var(--line); }
  .dots { display:flex; gap:6px; }
  .dots i { width:7px; height:7px; border-radius:4px; background:#d8d2c8; display:block; transition:all .2s; }
  .dots i.on { width:18px; background:var(--accent); }
  button { font:inherit; border:1px solid #ddd6cc; background:#fff; color:var(--ink); border-radius:9px; padding:9px 16px; cursor:pointer; font-weight:600; }
  button.primary { background:linear-gradient(135deg,#ef8a5d,#d96a3a); color:#fff; border:0; }
  button:disabled { opacity:.45; cursor:default; }
  .cap { flex:1; color:var(--soft); font-size:12.5px; }
</style></head><body>
<header><span style="color:var(--accent)">▶</span><h1>${esc(project.name)}</h1><span class="step" id="stepLabel"></span></header>
<div class="stage"><div class="screen" id="screen"></div></div>
<footer>
  <button id="prev">‹ Forrige</button>
  <div class="dots" id="dots"></div>
  <div class="cap" id="cap"></div>
  <button class="primary" id="next">Neste ›</button>
</footer>
<script>
  var DATA = ${data};
  var steps = DATA.steps || [];
  var i = 0;
  var screen = document.getElementById('screen');
  function dims(device){
    if (device === 'iphone') return { w: 300, h: 620 };
    if (device === 'ipad') return { w: 560, h: 740 };
    return { w: 900, h: 562 }; // macbook/desktop 16:10
  }
  function render(){
    var s = steps[i]; if(!s){ return; }
    var d = dims(s.device);
    screen.style.width = d.w + 'px'; screen.style.height = d.h + 'px';
    var media = s.thumb
      ? '<img src="' + s.thumb + '" alt="">'
      : '<iframe src="' + s.url + '" scrolling="no" referrerpolicy="no-referrer"></iframe>';
    var hot = '', tip = '';
    if (s.hotspot){
      var h = s.hotspot;
      hot = '<div class="hot" id="hot" style="left:'+(h.x*100)+'%;top:'+(h.y*100)+'%;width:'+(h.w*100)+'%;height:'+(h.h*100)+'%"></div>';
      var tx = Math.min(70, (h.x*100)); var ty = Math.min(72, (h.y*100) + (h.h*100) + 2);
      tip = '<div class="tip" style="left:'+tx+'%;top:'+ty+'%">' + (s.action ? '<b>'+escapeHtml(s.action)+'</b>' : '') + escapeHtml(s.narration || s.overlay || '') + '</div>';
    }
    screen.innerHTML = media + hot + tip;
    var hotEl = document.getElementById('hot'); if (hotEl) hotEl.onclick = next;
    document.getElementById('stepLabel').textContent = 'Steg ' + (i+1) + ' av ' + steps.length + ' — ' + (s.title || '');
    document.getElementById('cap').textContent = s.narration || s.overlay || '';
    document.getElementById('prev').disabled = i === 0;
    document.getElementById('next').textContent = i === steps.length-1 ? 'Ferdig' : 'Neste ›';
    var dots = document.getElementById('dots'); dots.innerHTML = '';
    for (var k=0;k<steps.length;k++){ var c=document.createElement('i'); if(k===i)c.className='on'; dots.appendChild(c); }
  }
  function escapeHtml(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function next(){ if(i < steps.length-1){ i++; render(); } }
  function prev(){ if(i > 0){ i--; render(); } }
  document.getElementById('next').onclick = next;
  document.getElementById('prev').onclick = prev;
  document.addEventListener('keydown', function(e){ if(e.key==='ArrowRight')next(); else if(e.key==='ArrowLeft')prev(); });
  render();
</script>
</body></html>`;
}

/** Tegn en branded thumbnail (PNG-dataURL) for demoen. */
export function renderThumbnail(project: DemoProject, format: DemoProject['format'] = '16:9'): string {
  const aspect: Record<DemoProject['format'], [number, number]> = {
    '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080], '4:5': [1080, 1350],
  };
  const [w, h] = aspect[format];
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Bakgrunn — diagonal gradient.
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2f2a26'); g.addColorStop(1, '#ef8a5d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.07);
  ctx.textBaseline = 'top';

  // Demo-type eyebrow.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 ${Math.round(w * 0.022)}px -apple-system, Segoe UI, sans-serif`;
  ctx.fillText(DEMO_TYPE_LABELS[project.demoType].toUpperCase(), pad, pad);

  // Tittel — ordbrytende.
  ctx.fillStyle = '#ffffff';
  const titleSize = Math.round(w * 0.062);
  ctx.font = `700 ${titleSize}px -apple-system, Segoe UI, sans-serif`;
  const maxW = w - pad * 2;
  const words = project.name.split(/\s+/);
  let line = ''; const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  let ty = Math.round(h * (format === '9:16' ? 0.34 : 0.3));
  for (const l of lines.slice(0, 4)) { ctx.fillText(l, pad, ty); ty += Math.round(titleSize * 1.15); }

  // URL + scene-info nederst.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `500 ${Math.round(w * 0.026)}px -apple-system, Segoe UI, sans-serif`;
  const host = project.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.fillText(host, pad, h - pad - Math.round(w * 0.06));
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `500 ${Math.round(w * 0.02)}px -apple-system, Segoe UI, sans-serif`;
  ctx.fillText(`${project.scenes.length} scener · ${Math.round(totalDuration(project.scenes))}s`, pad, h - pad - Math.round(w * 0.028));

  return canvas.toDataURL('image/png');
}
