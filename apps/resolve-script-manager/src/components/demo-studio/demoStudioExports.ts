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
  BRAIN_KIND_LABELS, VERIFICATION_META, FRAMEWORKS, MARKETING_OBJECTIVES,
  type DemoProject, type DemoScene, type ProductBrain, type BrainNodeKind,
  type TargetLocator,
} from './demoStudioModel';

/** JSON-trygt streng-literal i generert JS. */
function jsStr(s: string): string { return JSON.stringify(String(s ?? '')); }

/**
 * Bygg et JS-array-literal av multi-strategi-locator-tupler for én scene, i
 * prioritert rekkefølge. Brukes av det selv-helbredende `act()` i skriptet.
 * Format: [['testid','x'], ['role','button','Start'], ['text','Start'], ['css','…']]
 */
function sceneLocatorTuples(scene: DemoScene): string {
  const locs: TargetLocator[] = scene.targetLocators ?? [];
  const out: string[] = [];
  const find = (s: string) => locs.find((l) => l.strategy === s);
  const testid = find('testid');
  if (testid) {
    const m = testid.value.match(/data-test(?:id)?="([^"]+)"/) || testid.value.match(/data-cy="([^"]+)"/);
    if (m) out.push(`['testid', ${jsStr(m[1])}]`);
  }
  const aria = find('aria');
  if (aria) {
    const [role, name] = aria.value.split('|');
    if (role && name) out.push(`['role', ${jsStr(role)}, ${jsStr(name)}]`);
  }
  const id = find('id');
  if (id && id.value) out.push(`['css', ${jsStr(id.value)}]`);
  const text = find('text');
  if (text) {
    const t = text.value.split('|').slice(1).join('|');
    if (t) out.push(`['text', ${jsStr(t)}]`);
  }
  const css = find('css');
  if (css && css.value) out.push(`['css', ${jsStr(css.value)}]`);
  else if (scene.targetSelector) out.push(`['css', ${jsStr(scene.targetSelector)}]`);
  if (scene.targetLabel) out.push(`['text', ${jsStr(scene.targetLabel)}]`);
  return '[' + out.join(', ') + ']';
}

// Selv-helbredende runtime som legges inn øverst i hvert generert skript.
const SELF_HEAL_RUNTIME: string[] = [
  '// ── Selv-helbredende locator. Prøver hver lagrede strategi i rekkefølge;',
  '// ── ved bom faller den tilbake til ren tekst/role-match og logger hva som',
  '// ── må fikses. Slik tåler skriptet at siden endrer seg (redesign, A/B-test,',
  '// ── lokalisering) og «tilpasser seg» hver side i stedet for å knekke.',
  'async function locate(page, strategies) {',
  '  for (const s of strategies) {',
  '    try {',
  '      let loc;',
  "      if (s[0] === 'testid') loc = page.getByTestId(s[1]);",
  "      else if (s[0] === 'role') loc = page.getByRole(s[1], { name: s[2], exact: false });",
  "      else if (s[0] === 'text') loc = page.getByText(s[1], { exact: false });",
  '      else loc = page.locator(s[1]);',
  '      loc = loc.first();',
  '      if ((await loc.count()) && (await loc.isVisible().catch(() => false))) return loc;',
  '    } catch {}',
  '  }',
  '  return null;',
  '}',
  'async function act(page, strategies, kind, label) {',
  '  let loc = await locate(page, strategies);',
  '  if (!loc && label) {',
  "    console.warn('[heal] fant ikke «' + label + '» via lagrede locators — prøver tekst/role-fallback');",
  "    loc = await locate(page, [['text', label], ['role', 'button', label], ['role', 'link', label]]);",
  '  }',
  '  if (!loc) {',
  "    console.error('[hopp] ingen treff for «' + (label || kind) + '» — siden kan ha endret seg; oppdater scenen i Demo Studio');",
  '    return false;',
  '  }',
  '  await loc.scrollIntoViewIfNeeded().catch(() => {});',
  '  try {',
  "    if (kind === 'show') { /* highlight/zoom/scroll — kun bringe i view */ }",
  "    else if (kind === 'type') { await loc.click(); await loc.fill('Eksempel'); }",
  "    else if (kind === 'hover') { await loc.hover(); }",
  '    else { await loc.click(); }',
  "  } catch (e) { console.error('[feil] «' + label + '»: ' + (e && e.message)); return false; }",
  '  return true;',
  '}',
];

/**
 * Fase 3 + selv-helbredelse — generer et kjørbart, ADAPTIVT Playwright-skript
 * (.mjs) av demoen: ekte navigasjon + per-scene handling via multi-strategi-
 * locators som helbreder seg selv når siden endrer seg + per-scene screenshot
 * + video. Deterministisk og redigerbart.
 *
 * Kjør:  npm i -D playwright && npx playwright install chromium && node demo.mjs
 */
export function buildPlaywrightScript(project: DemoProject): string {
  const name = (project.name || 'demo').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'demo';
  const L: string[] = [];
  L.push('// Auto-generert av Post Agent — Demo Studio → Playwright (selv-helbredende).');
  L.push(`// Kjør:  npm i -D playwright && npx playwright install chromium && node ${name}.mjs`);
  L.push("import { chromium } from 'playwright';");
  L.push('');
  SELF_HEAL_RUNTIME.forEach((l) => L.push(l));
  L.push('');
  L.push('const browser = await chromium.launch({ headless: false, slowMo: 350 });');
  L.push("const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'demo-video', size: { width: 1280, height: 800 } } });");
  L.push('const page = await context.newPage();');
  L.push(`await page.goto(${jsStr(project.url)}, { waitUntil: 'domcontentloaded' });`);
  L.push('await page.waitForTimeout(1500);');
  L.push('');
  project.scenes.forEach((s, i) => {
    const n = i + 1;
    const at = s.actionType ?? 'click';
    const oneLine = (x: string) => (x || '').replace(/\s+/g, ' ').trim();
    const tuples = sceneLocatorTuples(s);
    const hasTarget = tuples !== '[]';
    const label = oneLine(s.targetLabel || '');
    L.push(`// ── Scene ${n}: ${oneLine(s.title).slice(0, 60)} — ${ACTION_META[at].label}`);
    if (s.narration) L.push(`// VO: ${oneLine(s.narration).slice(0, 120)}`);
    if (s.startScrollPct) L.push(`await page.evaluate(() => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * ${(s.startScrollPct / 100).toFixed(2)}));`);
    if (at === 'wait') {
      L.push(`await page.waitForTimeout(${Math.max(1, s.pauseSec ?? 2) * 1000});`);
    } else if (at === 'open_url') {
      L.push('// open_url — legg til page.goto(...) hvis scenen bytter side');
    } else if (at === 'switch_device') {
      L.push('// switch_device — kjør en egen context med mobil-viewport for denne delen');
    } else if (at === 'scroll' && !hasTarget) {
      L.push('await page.mouse.wheel(0, 600);');
    } else if (hasTarget) {
      const kind = at === 'type' ? 'type' : at === 'hover' ? 'hover'
        : (at === 'highlight' || at === 'zoom' || at === 'scroll') ? 'show' : 'click';
      L.push(`await act(page, ${tuples}, ${jsStr(kind)}, ${jsStr(label)});`);
    } else {
      L.push(`// (ingen target for scene ${n} — sett selector i Demo Studio)`);
    }
    if (s.validationRule) L.push(`// forventet: ${oneLine(s.validationRule).slice(0, 100)}`);
    L.push(`await page.screenshot({ path: 'scene-${String(n).padStart(2, '0')}.png' });`);
    L.push(`await page.waitForTimeout(${Math.max(0.5, s.pauseSec ?? 1) * 1000});`);
    L.push('');
  });
  L.push('await context.close(); // video skrives til demo-video/');
  L.push('await browser.close();');
  L.push('');
  return L.join('\n');
}

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

/** Rastrer en SVG-streng til en PNG data-URL via canvas (for deling/eksport). */
export function svgToPngDataUrl(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const urlObj = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale; canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas-kontekst utilgjengelig')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(urlObj);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { URL.revokeObjectURL(urlObj); reject(e as Error); }
    };
    img.onerror = () => { URL.revokeObjectURL(urlObj); reject(new Error('Klarte ikke å rastre SVG')); };
    img.src = urlObj;
  });
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
 * Print-klar PDF av Product Brain (verifisert tankekart): anbefalt metode +
 * begrunnelse, noder gruppert pr. type med ✓/!/+-status, dekningssti og gap.
 */
export function buildBrainHtml(brain: ProductBrain, projectName: string, url: string): string {
  const kinds = Object.keys(BRAIN_KIND_LABELS) as BrainNodeKind[];
  const nodeGroups = kinds.map((kind) => {
    const ns = brain.nodes.filter((n) => n.kind === kind);
    if (!ns.length) return '';
    const items = ns.map((n) => {
      const m = VERIFICATION_META[n.status];
      return `<li><span class="ic" style="color:${m.color}">${m.icon}</span> ${esc(n.text)}${n.matchedOn ? ` <span class="dim">· ${esc(n.matchedOn)}</span>` : ''}</li>`;
    }).join('');
    return `<div class="grp"><h3>${BRAIN_KIND_LABELS[kind]}</h3><ul>${items}</ul></div>`;
  }).join('');
  const coverage = brain.coveragePath.length
    ? `<h2>Hva vi må gjennom (dekningssti)</h2><ol>${brain.coveragePath.map((s) => `<li>${esc(s.label)}${s.elementLabel ? ` <span class="dim">→ ${esc(s.elementLabel)}</span>` : ''}</li>`).join('')}</ol>`
    : '';
  const gaps = brain.gaps.length
    ? `<div class="gaps"><h2>Gap — hevdet, ikke verifisert på siden</h2><ul>${brain.gaps.map((g) => `<li>⚠ ${esc(g)}</li>`).join('')}</ul></div>`
    : '';
  const rec = `${FRAMEWORKS[brain.recommendedFramework].label}${brain.recommendedObjective ? ` · ${MARKETING_OBJECTIVES[brain.recommendedObjective].label}` : ''}`;
  return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<title>${esc(projectName)} — Product Brain</title>
<style>
  @page { margin: 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #1d1b19; margin: 0; }
  header { border-bottom: 2px solid #ef8a5d; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b6358; font-size: 12px; }
  .rec { background: #fdeee6; border: 1px solid #f3d3c1; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
  .rec b { color: #3a2f2a; }
  h2 { font-size: 14px; margin: 16px 0 6px; }
  .grps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
  .grp h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #9a9186; margin: 8px 0 4px; }
  ul, ol { margin: 0 0 6px; padding-left: 18px; }
  li { margin-bottom: 2px; }
  .ic { font-weight: 700; }
  .dim { color: #9a9186; }
  .gaps { background: #fff8ec; border: 1px solid #f0d9a8; border-radius: 8px; padding: 8px 12px; margin-top: 12px; }
  footer { margin-top: 14px; color: #9a9186; font-size: 11px; }
</style></head><body>
<header>
  <h1>${esc(projectName)} — Product Brain</h1>
  <div class="sub">${esc(url)} · ${brain.nodes.filter((n) => n.status === 'verified').length} verifisert · ${brain.gaps.length} gap</div>
</header>
${brain.summary ? `<p>${esc(brain.summary)}</p>` : ''}
<div class="rec"><b>Anbefalt metode:</b> ${esc(rec)}${brain.reasoning ? `<br><span class="dim">${esc(brain.reasoning)}</span>` : ''}</div>
<h2>Verifisert tankekart</h2>
<div class="grps">${nodeGroups}</div>
${coverage}
${gaps}
<footer>Generert av Product Demo Studio · Marketing mode</footer>
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
  const b = project.branding || {};
  const accent = (b.brandColor && /^#[0-9a-fA-F]{3,8}$/.test(b.brandColor)) ? b.brandColor : '#ef8a5d';
  const brandName = b.brandName || project.name;
  const logo = b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="" style="height:22px;width:auto;border-radius:4px">` : `<span style="color:var(--accent)">▶</span>`;
  const watermark = b.hidePoweredBy ? '' : `<a href="https://theroleroom.com" target="_blank" style="margin-left:auto;font-size:11px;color:var(--soft);text-decoration:none;opacity:.8">Powered by Product Demo Studio</a>`;
  const data = JSON.stringify({ name: brandName, steps }).replace(/</g, '\\u003c');

  return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brandName)} — interaktiv guide</title>
<style>
  :root { --accent:${accent}; --ink:#1d1b19; --soft:#6b6358; --line:#eae5dd; --bg:#f3efe9; }
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
  button.primary { background:var(--accent); color:#fff; border:0; }
  button:disabled { opacity:.45; cursor:default; }
  .cap { flex:1; color:var(--soft); font-size:12.5px; }
</style></head><body>
<header>${logo}<h1>${esc(brandName)}</h1><span class="step" id="stepLabel"></span></header>
<div class="stage"><div class="screen" id="screen"></div></div>
<footer>
  <button id="prev">‹ Forrige</button>
  <div class="dots" id="dots"></div>
  <div class="cap" id="cap"></div>
  <button class="primary" id="next">Neste ›</button>
</footer>
<div style="display:flex;padding:8px 18px;background:#fff;border-top:1px solid var(--line)">${watermark}</div>
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
