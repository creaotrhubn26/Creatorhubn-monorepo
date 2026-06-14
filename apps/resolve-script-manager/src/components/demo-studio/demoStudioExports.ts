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

// Selv-helbredende + LÆRENDE runtime som legges inn øverst i hvert skript.
const SELF_HEAL_RUNTIME: string[] = [
  '// ── Selv-helbredende + lærende locator. Prøver lagrede strategier i',
  '// ── rekkefølge; ved bom helbreder den via tekst/role OG lærer hvilken',
  '// ── strategi som traff (learned.json) → brukes først neste kjøring. Slik',
  '// ── blir skriptet bedre for hver gang siden besøkes, og tåler redesign.',
  "const LEARNED_FILE = 'learned.json';",
  'let LEARNED = {};',
  "try { if (existsSync(LEARNED_FILE)) LEARNED = JSON.parse(readFileSync(LEARNED_FILE, 'utf8')); } catch {}",
  'function saveLearned() { try { writeFileSync(LEARNED_FILE, JSON.stringify(LEARNED, null, 2)); } catch {} }',
  '',
  '// Fjern cookie/consent-bannere så opptaket viser faktisk innhold.',
  'async function dismissOverlays(page) {',
  "  const labels = ['Godta alle','Godta','Aksepter alle','Aksepter','Akseptér alle','Akseptér','Tillat alle','Tillat','Jeg forstår','Forstått','Greit','OK','Accept all','Accept','Allow all','I agree','Agree','Got it'];",
  '  for (const t of labels) {',
  '    try {',
  "      const b = page.getByRole('button', { name: t, exact: false }).first();",
  '      if ((await b.count()) && (await b.isVisible().catch(() => false))) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); return true; }',
  '    } catch {}',
  '  }',
  "  for (const sel of ['#onetrust-accept-btn-handler', 'button[aria-label*=\"accept\" i]', '[id*=\"cookie\" i] button', '[class*=\"consent\" i] button', '[class*=\"cookie\" i] button']) {",
  '    try {',
  '      const b = page.locator(sel).first();',
  '      if ((await b.count()) && (await b.isVisible().catch(() => false))) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); return true; }',
  '    } catch {}',
  '  }',
  '  return false;',
  '}',
  '',
  '// Returnerer { loc, strategy } for første treffende strategi (eller null).',
  'async function locate(page, strategies) {',
  '  for (const s of strategies) {',
  '    if (!s) continue;',
  '    try {',
  '      let loc;',
  "      if (s[0] === 'testid') loc = page.getByTestId(s[1]);",
  "      else if (s[0] === 'role') loc = page.getByRole(s[1], { name: s[2], exact: false });",
  "      else if (s[0] === 'text') loc = page.getByText(s[1], { exact: false });",
  '      else loc = page.locator(s[1]);',
  '      loc = loc.first();',
  '      if ((await loc.count()) && (await loc.isVisible().catch(() => false))) return { loc, strategy: s };',
  '    } catch {}',
  '  }',
  '  return null;',
  '}',
  'async function act(page, strategies, kind, label) {',
  '  const key = label || JSON.stringify(strategies[0] || null);',
  '  // Lært strategi fra tidligere kjøringer prøves FØRST.',
  '  const ordered = (LEARNED[key] ? [LEARNED[key]] : []).concat(strategies);',
  '  let hit = await locate(page, ordered);',
  '  let viaFallback = false;',
  '  if (!hit && label) {',
  "    console.warn('[heal] fant ikke «' + label + '» — prøver tekst/role-fallback');",
  "    hit = await locate(page, [['text', label], ['role', 'button', label], ['role', 'link', label]]);",
  '    viaFallback = !!hit;',
  '  }',
  '  if (!hit) {',
  "    console.error('[hopp] ingen treff for «' + (label || kind) + '» — oppdater scenen i Demo Studio');",
  '    return false;',
  '  }',
  '  // LÆR: lagre den fungerende strategien for denne siden.',
  '  if (key && hit.strategy && JSON.stringify(LEARNED[key]) !== JSON.stringify(hit.strategy)) {',
  '    LEARNED[key] = hit.strategy; saveLearned();',
  "    if (viaFallback) console.log('[lært] «' + label + '» → ' + JSON.stringify(hit.strategy));",
  '  }',
  '  await hit.loc.scrollIntoViewIfNeeded().catch(() => {});',
  '  try {',
  "    if (kind === 'show') {}",
  "    else if (kind === 'type') { await hit.loc.click(); await hit.loc.fill('Eksempel'); }",
  "    else if (kind === 'hover') { await hit.loc.hover(); }",
  '    else { await hit.loc.click(); }',
  "  } catch (e) { console.error('[feil] «' + label + '»: ' + (e && e.message)); return false; }",
  '  return true;',
  '}',
];

// ── Cinematisk lag for autonom video: synlig peker som reiser til elementer,
// ── klikk-ripple, glow-uthevning + myk scroll når target mangler (så opptaket
// ── aldri fryser). Playwright tegner ingen ekte cursor — vi injiserer en.
const CINEMATIC_RUNTIME: string[] = [
  'async function injectCursor(page) {',
  '  await page.evaluate(() => {',
  "    if (document.getElementById('__pa_cur')) return;",
  "    const c = document.createElement('div');",
  "    c.id = '__pa_cur';",
  "    c.style.cssText = 'position:fixed;left:50%;top:45%;z-index:2147483647;width:26px;height:26px;pointer-events:none;transition:left .7s cubic-bezier(.45,0,.2,1),top .7s cubic-bezier(.45,0,.2,1);will-change:left,top';",
  '    c.innerHTML = \'<svg width="26" height="26" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))"><path d="M5 2l15 8-6.5 1.7L10 20z" fill="#fff" stroke="#1d1b19" stroke-width="1.3" stroke-linejoin="round"/></svg>\';',
  '    document.documentElement.appendChild(c);',
  '    window.__paMove = (x, y) => { const e = document.getElementById("__pa_cur"); if (e) { e.style.left = x + "px"; e.style.top = y + "px"; } };',
  '    window.__paRipple = (x, y) => { const r = document.createElement("div"); r.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:2147483646;width:12px;height:12px;margin:-6px 0 0 -6px;border:3px solid #ef8a5d;border-radius:50%;pointer-events:none;opacity:.95;transition:all .55s ease-out`; document.documentElement.appendChild(r); requestAnimationFrame(() => { r.style.width = "64px"; r.style.height = "64px"; r.style.margin = "-32px 0 0 -32px"; r.style.opacity = "0"; }); setTimeout(() => r.remove(), 650); };',
  '    window.__paGlow = (x, y, w, h) => { const g = document.createElement("div"); g.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:2147483645;border:3px solid #ef8a5d;border-radius:8px;box-shadow:0 0 0 4px rgba(239,138,93,.22);pointer-events:none;transition:opacity .4s`; document.documentElement.appendChild(g); setTimeout(() => { g.style.opacity = "0"; setTimeout(() => g.remove(), 400); }, 1500); };',
  '    // Push-in: skaler body med origin i elementets senter (det punktet står stille',
  '    // i viewporten, så peker + element holder seg justert under zoomen).',
  '    window.__paZoom = (vx, vy, sc) => { const b = document.body; if (!b) return; const ox = vx + (window.scrollX || 0), oy = vy + (window.scrollY || 0); b.style.transition = "transform 1s cubic-bezier(.4,0,.2,1)"; b.style.transformOrigin = ox + "px " + oy + "px"; b.style.transform = "scale(" + sc + ")"; };',
  '    window.__paZoomReset = () => { const b = document.body; if (!b) return; b.style.transition = "transform .5s ease, filter .3s ease"; b.style.transform = "none"; b.style.filter = "none"; };',
  '    // Kinetisk tekst-banner: animert overlay-tekst som glir inn (motion + info).',
  '    window.__paCaption = (text) => { const old = document.getElementById("__pa_cap"); if (old) old.remove(); if (!text) return; const c = document.createElement("div"); c.id = "__pa_cap"; c.textContent = text; c.style.cssText = "position:fixed;left:50%;bottom:48px;transform:translate(-50%,16px);max-width:78%;z-index:2147483646;background:rgba(29,27,25,.92);color:#fff;font:600 24px -apple-system,Helvetica,Arial,sans-serif;padding:14px 26px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .45s,transform .45s;text-align:center;pointer-events:none"; document.documentElement.appendChild(c); requestAnimationFrame(() => { c.style.opacity = "1"; c.style.transform = "translate(-50%,0)"; }); };',
  '    window.__paCaptionHide = () => { const c = document.getElementById("__pa_cap"); if (c) { c.style.opacity = "0"; c.style.transform = "translate(-50%,16px)"; setTimeout(() => c.remove(), 450); } };',
  '    // Spotlight: dim alt unntatt elementet (kino-fokus). Layout-trygt fixed-overlay.',
  '    window.__paSpotlight = (x, y, w, h) => { const old = document.getElementById("__pa_spot"); if (old) old.remove(); const pad = 10; const s = document.createElement("div"); s.id = "__pa_spot"; s.style.cssText = `position:fixed;inset:0;z-index:2147483644;pointer-events:none;opacity:0;transition:opacity .5s;box-shadow:0 0 0 9999px rgba(20,18,16,.45);border-radius:12px;left:${Math.max(0,x-pad)}px;top:${Math.max(0,y-pad)}px;width:${w+pad*2}px;height:${h+pad*2}px;inset:auto`; document.documentElement.appendChild(s); requestAnimationFrame(() => { s.style.opacity = "1"; }); };',
  '    window.__paSpotlightOff = () => { const s = document.getElementById("__pa_spot"); if (s) { s.style.opacity = "0"; setTimeout(() => s.remove(), 500); } };',
  '    // Cinematisk reveal: siden «avsløres» fra mørkt med en mild zoom-inn.',
  '    window.__paReveal = () => { const o = document.createElement("div"); o.id = "__pa_reveal"; o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#141210;pointer-events:none;transition:opacity 1.1s ease"; document.documentElement.appendChild(o); const b = document.body; if (b) { b.style.transition = "transform 1.2s cubic-bezier(.2,0,.2,1)"; b.style.transformOrigin = "50% 42%"; b.style.transform = "scale(1.06)"; } requestAnimationFrame(() => { o.style.opacity = "0"; if (b) b.style.transform = "none"; }); setTimeout(() => o.remove(), 1200); };',
  '    // Light sweep: en lysstripe glir diagonalt over skjermen (premium-shine).',
  '    window.__paSweep = () => { const old = document.getElementById("__pa_sweep"); if (old) old.remove(); const s = document.createElement("div"); s.id = "__pa_sweep"; s.style.cssText = "position:fixed;top:-30%;left:-60%;width:40%;height:160%;z-index:2147483646;pointer-events:none;transform:rotate(18deg) translateX(0);background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transition:transform 1.1s ease-in-out,opacity .3s;opacity:.9;mix-blend-mode:screen"; document.documentElement.appendChild(s); requestAnimationFrame(() => { s.style.transform = "rotate(18deg) translateX(420%)"; }); setTimeout(() => { s.style.opacity = "0"; setTimeout(() => s.remove(), 300); }, 1000); };',
  '    // Virtuelt kamera: alle bevegelser forankret i fokus-elementets senter',
  '    // (transform-origin der → kameraet «følger brukerens fokus»).',
  '    window.__paCamera = (move, x, y, w, h) => { const b = document.body; if (!b) return; const ox = (x + w / 2) + (window.scrollX || 0), oy = (y + h / 2) + (window.scrollY || 0); b.style.transformOrigin = ox + "px " + oy + "px"; const set = (tr, ms) => { b.style.transition = "transform " + (ms || 1100) + "ms cubic-bezier(.4,0,.2,1)"; b.style.transform = tr; }; if (move === "zoom_out") { b.style.transition = "none"; b.style.transform = "scale(1.2)"; requestAnimationFrame(() => set("none", 1200)); } else if (move === "pan_left") { set("scale(1.12) translateX(3.5%)"); } else if (move === "pan_right") { set("scale(1.12) translateX(-3.5%)"); } else if (move === "section_snap") { set("scale(1.04)", 700); } else { set("scale(1.18)"); } };',
  '    // Whip-overgang: rask uskarp pan (energisk klipp mellom scener).',
  '    window.__paWhip = (dir) => { const b = document.body; if (!b) return; b.style.transition = "transform .22s ease-in, filter .22s ease-in"; b.style.transform = "translateX(" + (dir < 0 ? "-" : "") + "8%) scale(1.04)"; b.style.filter = "blur(7px)"; setTimeout(() => { b.style.transition = "transform .32s ease-out, filter .32s ease-out"; b.style.transform = "none"; b.style.filter = "none"; }, 220); };',
  '  }).catch(() => {});',
  '}',
  'async function cinematicAct(page, strategies, kind, label, move) {',
  '  await injectCursor(page);',
  '  await page.evaluate(() => { window.__paZoomReset && window.__paZoomReset(); window.__paSpotlightOff && window.__paSpotlightOff(); }).catch(() => {});',
  '  await page.waitForTimeout(250);',
  "  const key = label || JSON.stringify(strategies[0] || null);",
  '  const ordered = (LEARNED[key] ? [LEARNED[key]] : []).concat(strategies);',
  '  let hit = await locate(page, ordered);',
  '  if (!hit && label) hit = await locate(page, [["text", label], ["role", "button", label], ["role", "link", label]]);',
  '  if (!hit) {',
  "    console.warn('[hopp] ingen target for «' + (label || kind) + '» — myk scroll så videoen lever');",
  '    await page.evaluate(() => window.scrollBy({ top: Math.min(420, innerHeight * 0.55), behavior: "smooth" })).catch(() => {});',
  '    await page.waitForTimeout(900);',
  '    return false;',
  '  }',
  '  if (key && hit.strategy && JSON.stringify(LEARNED[key]) !== JSON.stringify(hit.strategy)) { LEARNED[key] = hit.strategy; saveLearned(); }',
  '  await hit.loc.scrollIntoViewIfNeeded().catch(() => {});',
  '  await page.waitForTimeout(550);',
  '  const box = await hit.loc.boundingBox().catch(() => null);',
  '  if (box) {',
  '    const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);',
  '    await page.evaluate(([x, y]) => window.__paMove && window.__paMove(x, y), [cx, cy]).catch(() => {});',
  '    await page.waitForTimeout(780);',
  '    await page.evaluate(([x, y, w, h]) => window.__paGlow && window.__paGlow(Math.round(x), Math.round(y), Math.round(w), Math.round(h)), [box.x, box.y, box.width, box.height]).catch(() => {});',
  "    if (kind !== 'show' && kind !== 'hover') { await page.evaluate(([x, y]) => window.__paRipple && window.__paRipple(x, y), [cx, cy]).catch(() => {}); }",
  '    await page.waitForTimeout(320);',
  '    // Virtuelt kamera (forankret i fokus) + spotlight: dra blikket mot elementet.',
  '    await page.evaluate(([m, x, y, w, h]) => window.__paCamera && window.__paCamera(m, x, y, w, h), [move || "push_in", box.x, box.y, box.width, box.height]).catch(() => {});',
  "    if (kind === 'show' || kind === 'highlight' || kind === 'zoom') { await page.evaluate(([x, y, w, h]) => window.__paSpotlight && window.__paSpotlight(Math.round(x), Math.round(y), Math.round(w), Math.round(h)), [box.x, box.y, box.width, box.height]).catch(() => {}); }",
  '    await page.waitForTimeout(450);',
  '  }',
  '  try {',
  "    if (kind === 'show') {}",
  "    else if (kind === 'type') { await hit.loc.click({ timeout: 3000 }).catch(() => {}); await hit.loc.fill('Eksempel').catch(() => {}); }",
  "    else if (kind === 'hover') { await hit.loc.hover({ timeout: 3000 }).catch(() => {}); }",
  '    else { await hit.loc.click({ timeout: 3000 }).catch(() => {}); }',
  '  } catch {}',
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
  L.push("import { readFileSync, writeFileSync, existsSync } from 'node:fs';");
  L.push('');
  SELF_HEAL_RUNTIME.forEach((l) => L.push(l));
  L.push('');
  // Bruk system-Chrome hvis tilgjengelig (ingen Chromium-nedlasting); fall
  // tilbake til Playwrights bundlede Chromium.
  L.push('let browser;');
  L.push("try { browser = await chromium.launch({ headless: false, slowMo: 350, channel: 'chrome' }); }");
  L.push('catch { browser = await chromium.launch({ headless: false, slowMo: 350 }); }');
  L.push("const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'demo-video', size: { width: 1280, height: 800 } } });");
  L.push('const page = await context.newPage();');
  L.push(`await page.goto(${jsStr(project.url)}, { waitUntil: 'domcontentloaded' });`);
  L.push('await page.waitForTimeout(1500);');
  L.push('await dismissOverlays(page); // fjern cookie/consent-banner før opptak');
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

/**
 * AUTONOM demo-script: som buildPlaywrightScript, men dveler per scene =
 * narration-varigheten (dwellsMs) og logger tids-markører (MARK_T0 / MARK i)
 * slik at orkestratoren kan legge hver narration på riktig tid i muxingen.
 * Ingen menneskelig opptak — dette KJØRES og produserer videoen.
 */
export function buildAutonomousScript(project: DemoProject, dwellsMs: number[]): string {
  const L: string[] = [];
  L.push('// Auto-generert: AUTONOM demo (URL → narrert video). MARK-linjer lar');
  L.push('// orkestratoren synkronisere voiceover med videoen.');
  L.push("import { chromium } from 'playwright';");
  L.push("import { readFileSync, writeFileSync, existsSync } from 'node:fs';");
  L.push('');
  SELF_HEAL_RUNTIME.forEach((l) => L.push(l));
  CINEMATIC_RUNTIME.forEach((l) => L.push(l));
  L.push('');
  L.push('let browser;');
  L.push("try { browser = await chromium.launch({ headless: false, slowMo: 90, channel: 'chrome' }); }");
  L.push('catch { browser = await chromium.launch({ headless: false, slowMo: 90 }); }');
  L.push("const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'demo-video', size: { width: 1280, height: 800 } } });");
  L.push('const page = await context.newPage();');
  L.push("console.log('MARK_T0 ' + Date.now()); // video-t0 ≈ context-opprettelse");
  L.push(`await page.goto(${jsStr(project.url)}, { waitUntil: 'domcontentloaded' });`);
  L.push('await page.waitForTimeout(1800);');
  L.push('await dismissOverlays(page); // fjern cookie/consent før opptak');
  L.push('await injectCursor(page); // synlig peker i opptaket');
  L.push('// Premium intro: cinematisk reveal fra mørkt + light-sweep over skjermen.');
  L.push('await page.evaluate(() => window.__paReveal && window.__paReveal()).catch(() => {});');
  L.push('await page.waitForTimeout(1200);');
  L.push('await page.evaluate(() => window.__paSweep && window.__paSweep()).catch(() => {});');
  L.push('await page.waitForTimeout(500);');
  L.push('');
  project.scenes.forEach((s, i) => {
    const n = i + 1;
    const at = s.actionType ?? 'click';
    const oneLine = (x: string) => (x || '').replace(/\s+/g, ' ').trim();
    const tuples = sceneLocatorTuples(s);
    const hasTarget = tuples !== '[]';
    const label = oneLine(s.targetLabel || '');
    const dwell = Math.max(1500, Math.round(dwellsMs[i] || 3000));
    const kind = at === 'type' ? 'type' : at === 'hover' ? 'hover' : at === 'click' ? 'click' : 'show';
    // Virtuelt kamera: varier bevegelsen per scene (alltid forankret i fokus).
    const CAM_MOVES = ['push_in', 'pan_right', 'zoom_out', 'pan_left', 'section_snap'];
    const move = CAM_MOVES[i % CAM_MOVES.length];
    L.push(`// ── Scene ${n}: ${oneLine(s.title).slice(0, 60)} [kamera: ${move}]`);
    // MARK FØR handlingen, så narrasjonen dekker peker-reisen + handlingen.
    L.push(`console.log('MARK ${i} ' + Date.now());`);
    L.push('await injectCursor(page); // re-injiser (navigasjon kan ha fjernet pekeren)');
    L.push('await page.evaluate(() => { window.__paZoomReset && window.__paZoomReset(); window.__paSpotlightOff && window.__paSpotlightOff(); window.__paCaptionHide && window.__paCaptionHide(); }).catch(() => {}); // nullstill effekter fra forrige scene');
    if (i > 0) { L.push(`await page.evaluate(() => window.__paWhip && window.__paWhip(${i % 2 === 0 ? 1 : -1})).catch(() => {}); // whip-overgang`); L.push('await page.waitForTimeout(300);'); }
    if (s.startScrollPct) L.push(`await page.evaluate(() => window.scrollTo({ top: (document.body.scrollHeight - innerHeight) * ${(s.startScrollPct / 100).toFixed(2)}, behavior: 'smooth' })).catch(() => {});`);
    if (at === 'wait') {
      L.push('await page.waitForTimeout(600);');
    } else if (hasTarget) {
      // Cinematisk: peker reiser til elementet + virtuelt kamera + handling.
      L.push(`await cinematicAct(page, ${tuples}, ${jsStr(kind)}, ${jsStr(label)}, ${jsStr(move)});`);
    } else {
      // Ingen target → vis bevegelse uansett så videoen lever.
      L.push('await page.evaluate(() => window.scrollBy({ top: Math.min(420, innerHeight * 0.55), behavior: "smooth" })).catch(() => {});');
      L.push('await page.waitForTimeout(900);');
    }
    // Kinetisk tekst-banner: animert overlay-tekst (motion + budskap på skjermen).
    const cap = oneLine(s.overlayText || '');
    if (cap) L.push(`await page.evaluate((t) => window.__paCaption && window.__paCaption(t), ${jsStr(cap)}).catch(() => {});`);
    L.push(`await page.waitForTimeout(${dwell});`);
    L.push('');
  });
  L.push('await context.close();');
  L.push('await browser.close();');
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
