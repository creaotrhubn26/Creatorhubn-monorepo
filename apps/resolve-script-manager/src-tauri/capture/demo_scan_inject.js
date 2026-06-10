// demo_scan_inject.js — kjøres i demo-scan-vinduet (Tauri v2). Laster den ekte
// siden (cross-origin OK, ikke iframe → ikke X-Frame-Options), venter på at
// SPA-en rendrer, og skanner alle interaktive elementer (selector + label +
// viewport-relativ rect). Sender katalogen til Rust via IPC (demo_scan_result),
// som videresender til hovedvinduet (demo-capture://dom) og lukker vinduet.
// AI Director bruker katalogen til å binde scener til EKTE elementer.
(function () {
  if (window.top !== window.self) return;
  if (window.__demoScanDone) return;
  window.__demoScanDone = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC utilgjengelig */ }
    return undefined;
  }

  function esc(s) { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } catch (e) { return s; } }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + esc(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      var sel = el.nodeName.toLowerCase();
      if (el.classList && el.classList.length) sel += '.' + Array.prototype.slice.call(el.classList, 0, 2).map(esc).join('.');
      var parent = el.parentNode;
      if (parent && parent.children) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.nodeName === el.nodeName; });
        if (same.length > 1) sel += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(sel);
      el = el.parentNode;
    }
    return parts.join(' > ');
  }

  function labelFor(el) {
    var t = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('alt'))) || '';
    if (!t) t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 60);
  }

  function actionFor(el) {
    var tag = el.nodeName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return 'type';
    return 'click';
  }

  function buildLocators(el) {
    var L = [];
    try {
      if (el.id) L.push({ strategy: 'id', value: '#' + esc(el.id) });
      var tid = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy'));
      if (tid) L.push({ strategy: 'testid', value: '[data-testid="' + tid + '"]' });
      var role = el.getAttribute && el.getAttribute('role');
      var aria = el.getAttribute && (el.getAttribute('aria-label') || '');
      if (role || aria) L.push({ strategy: 'aria', value: (role || el.nodeName.toLowerCase()) + '|' + (aria || labelFor(el)) });
      var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt && txt.length <= 40) L.push({ strategy: 'text', value: el.nodeName.toLowerCase() + '|' + txt });
      L.push({ strategy: 'css', value: cssPath(el) });
    } catch (e) { /* */ }
    return L;
  }

  // Dyp spørring som gjennomtrenger shadow-DOM (web components / design-systemer).
  function deepQueryAll(sel) {
    var out = [];
    function walk(root) {
      try { Array.prototype.push.apply(out, root.querySelectorAll(sel)); } catch (e) { /* */ }
      var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (var i = 0; i < all.length; i++) { if (all[i].shadowRoot) walk(all[i].shadowRoot); }
    }
    walk(document);
    return out;
  }

  // ── Auto-merkevare: hent navn, logo og farger fra siden ──
  function metaContent(sel) { var e = document.querySelector(sel); return e ? (e.getAttribute('content') || '').trim() : ''; }
  function parseColor(c) {
    var m = (c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length >= 4 && p[3] === 0) return null;
    return { r: p[0], g: p[1], b: p[2] };
  }
  function vivid(rgb) { if (!rgb) return false; var mx = Math.max(rgb.r, rgb.g, rgb.b), mn = Math.min(rgb.r, rgb.g, rgb.b); return (mx - mn) > 24 && mx > 30 && mx < 250; }
  function toHex(rgb) { function h(n) { return ('0' + Math.round(n).toString(16)).slice(-2); } return '#' + h(rgb.r) + h(rgb.g) + h(rgb.b); }
  function extractBranding() {
    var brandName = metaContent('meta[property="og:site_name"]') || metaContent('meta[name="application-name"]') || (document.title || '').split(/[|–—\-]/)[0].trim();
    var logoUrl = '';
    var icons = ['link[rel="apple-touch-icon"]', 'link[rel="apple-touch-icon-precomposed"]', 'meta[property="og:image"]', 'link[rel="icon"]', 'link[rel="shortcut icon"]'];
    for (var i = 0; i < icons.length; i++) {
      var el = document.querySelector(icons[i]);
      if (el) { var href = el.getAttribute('href') || el.getAttribute('content'); if (href) { try { logoUrl = new URL(href, location.href).href; break; } catch (e) { /* */ } } }
    }
    if (!logoUrl) { var img = document.querySelector('header img, [class*="logo" i] img, img[alt*="logo" i], img[class*="logo" i]'); if (img && img.src) logoUrl = img.src; }
    var palette = [], seen = {};
    function add(c) { var rgb = parseColor(c); if (rgb && vivid(rgb)) { var hex = toHex(rgb); if (!seen[hex]) { seen[hex] = 1; palette.push(hex); } } }
    var theme = metaContent('meta[name="theme-color"]');
    if (theme && /^#?[0-9a-fA-F]{3,8}$/.test(theme)) { var th = theme[0] === '#' ? theme : '#' + theme; seen[th] = 1; palette.push(th); }
    var nodes = deepQueryAll('button,a[class*="btn" i],[class*="button" i],[class*="cta" i],header');
    for (var j = 0; j < nodes.length && palette.length < 8; j++) { try { var cs = getComputedStyle(nodes[j]); add(cs.backgroundColor); add(cs.color); } catch (e) { /* */ } }
    return { brandName: brandName || '', logoUrl: logoUrl || '', brandColor: palette[0] || '', palette: palette.slice(0, 6) };
  }

  // Bredt utvalg av interaktive/innholds-elementer (inkl. klikkbare div-er,
  // tabbable, kort, CTA-er som SPA-er ofte bygger uten <button>/role).
  var SEL = 'a,button,input,textarea,select,' +
    '[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],' +
    '[onclick],[tabindex]:not([tabindex="-1"]),' +
    '[class*="btn" i],[class*="button" i],[class*="cta" i],[class*="card" i],' +
    'h1,h2,h3';

  function isVisible(el, r) {
    if (r.width < 8 || r.height < 6) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') < 0.05) return false;
      if (cs.pointerEvents === 'none' && el.nodeName.toLowerCase() !== 'h1' && el.nodeName.toLowerCase() !== 'h2' && el.nodeName.toLowerCase() !== 'h3') return false;
    } catch (e) { /* */ }
    var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    // Må snitte gjeldende viewport (vi scanner per scroll-steg).
    if (r.bottom < 0 || r.top > ih || r.right < 0 || r.left > iw) return false;
    return true;
  }

  // Er elementet faktisk det øverste på sitt senter? (filtrerer vekk skjulte /
  // overlappede elementer som ellers ga «random» hotspots).
  function isTopmost(el, r) {
    try {
      var cx = Math.min((window.innerWidth || 1) - 1, Math.max(0, r.left + r.width / 2));
      var cy = Math.min((window.innerHeight || 1) - 1, Math.max(0, r.top + r.height / 2));
      var hit = document.elementFromPoint(cx, cy);
      if (!hit) return true;
      return hit === el || el.contains(hit) || hit.contains(el);
    } catch (e) { return true; }
  }

  function importance(el, tag, lab) {
    var sc = 0;
    var role = (el.getAttribute && el.getAttribute('role')) || '';
    if (tag === 'button' || role === 'button') sc += 5;
    else if (tag === 'a' || role === 'link') sc += 4;
    else if (tag === 'input' || tag === 'textarea' || tag === 'select') sc += 3;
    else if (/^h[1-3]$/.test(tag)) sc += 1;
    var cls = '';
    try { cls = (el.className && el.className.toString) ? el.className.toString() : ''; } catch (e) { /* */ }
    if (/cta|primary|submit|start|kom.?i.?gang|get.?started|sign.?up|log.?in|kontakt/i.test(cls + ' ' + lab)) sc += 4;
    if (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy'))) sc += 2;
    return sc;
  }

  function collect(out, seen) {
    var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    var maxScroll = Math.max(1, (document.documentElement.scrollHeight || ih) - ih);
    var scrollPct = Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset || 0) / maxScroll));
    var nodes = deepQueryAll(SEL);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var r = el.getBoundingClientRect();
      if (!isVisible(el, r)) continue;
      var lab = labelFor(el);
      if (!lab) continue;
      var s = cssPath(el);
      var key = s + '|' + lab;
      if (seen[key]) continue;
      if (!isTopmost(el, r)) continue;
      seen[key] = 1;
      var tag = el.nodeName.toLowerCase();
      out.push({
        selector: s,
        locators: buildLocators(el),
        label: lab,
        tag: tag,
        actionType: actionFor(el),
        importance: importance(el, tag, lab),
        scrollPct: scrollPct,            // hvor på siden (0–1) elementet sees best
        hotspot: {                       // viewport-relativ AT scrollPct → render scroller dit
          x: Math.max(0, Math.min(1, r.left / iw)),
          y: Math.max(0, Math.min(1, r.top / ih)),
          w: Math.max(0, Math.min(1, r.width / iw)),
          h: Math.max(0, Math.min(1, r.height / ih))
        }
      });
    }
  }

  // ── Fase 1b: viewport-screenshot via html2canvas (injisert FØR dette scriptet)
  // ── slik at preview-rammen kan vise EKTE side-piksler ved riktig scroll,
  // ── med hotspots oppå (bilde + hotspot fra samme scan = perfekt align).
  function shootViewport() {
    return new Promise(function (resolve) {
      if (!window.html2canvas) { resolve(null); return; }
      try {
        window.html2canvas(document.documentElement, {
          x: window.scrollX || 0, y: window.scrollY || 0,
          width: window.innerWidth, height: window.innerHeight,
          useCORS: true, logging: false, scale: 1, backgroundColor: '#ffffff'
        }).then(function (canvas) {
          var maxW = 900, c = canvas;
          if (canvas.width > maxW) {
            c = document.createElement('canvas');
            c.width = maxW; c.height = Math.round(canvas.height * maxW / canvas.width);
            var ctx = c.getContext('2d'); if (ctx) ctx.drawImage(canvas, 0, 0, c.width, c.height);
          }
          resolve(c.toDataURL('image/jpeg', 0.7));
        }).catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  function captureShots(done) {
    var shots = [];
    var ih = window.innerHeight || 1;
    var maxScroll = Math.max(0, (document.documentElement.scrollHeight || ih) - ih);
    var bands = Math.max(1, Math.min(6, Math.ceil((maxScroll + ih) / ih)));
    var i = 0;
    function nextShot() {
      if (i >= bands) { window.scrollTo(0, 0); done(shots); return; }
      var y = bands === 1 ? 0 : Math.round((maxScroll * i) / (bands - 1));
      var scrollPct = maxScroll > 0 ? Math.max(0, Math.min(1, y / maxScroll)) : 0;
      window.scrollTo(0, y);
      setTimeout(function () {
        shootViewport().then(function (dataUrl) {
          if (dataUrl) shots.push({ scrollPct: scrollPct, dataUrl: dataUrl });
          i++; nextShot();
        });
      }, 260);
    }
    nextShot();
  }

  function finish(out, shots) {
    out.sort(function (a, b) { return (a.scrollPct - b.scrollPct) || (b.importance - a.importance); });
    if (out.length > 150) out = out.slice(0, 150);
    var pageText = '';
    try { pageText = (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1600); } catch (e) { /* */ }
    var branding = {};
    try { branding = extractBranding(); } catch (e) { /* */ }
    invoke('demo_scan_result', {
      url: location.href, title: document.title || '', elements: out,
      pageText: pageText, branding: branding,
      viewport: { w: window.innerWidth || 0, h: window.innerHeight || 0 },
      docHeight: (document.documentElement.scrollHeight || 0),
      shots: shots || []
    });
  }

  // Scroll gjennom HELE siden i viewport-steg (samle elementer), deretter fang
  // screenshots ved jevnt fordelte bånd, så send alt.
  function scrollThrough() {
    var out = [], seen = {};
    var ih = window.innerHeight || 1;
    var maxScroll = Math.max(0, (document.documentElement.scrollHeight || ih) - ih);
    var step = Math.round(ih * 0.85), y = 0, guard = 0;
    function next() {
      window.scrollTo(0, y);
      setTimeout(function () {
        collect(out, seen);
        guard++;
        if (y >= maxScroll || guard > 40 || out.length >= 150) {
          window.scrollTo(0, 0);
          setTimeout(function () { captureShots(function (shots) { finish(out, shots); }); }, 150);
          return;
        }
        y = Math.min(maxScroll, y + step);
        next();
      }, 230); // la lazy-innhold rendre på hvert steg
    }
    next();
  }

  function go() { setTimeout(scrollThrough, 1200); } // gi SPA-en tid til første render
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
