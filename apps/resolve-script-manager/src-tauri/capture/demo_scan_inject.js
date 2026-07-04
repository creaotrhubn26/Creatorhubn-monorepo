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
  // G10: meld fremdrift til frontenden så dens timeout holdes levende så lenge
  // skannet faktisk jobber (før: fast 20 s som var kortere enn skannet selv).
  function progress(phase, extra) {
    var p = { phase: phase };
    if (extra) { for (var k in extra) { p[k] = extra[k]; } }
    invoke('demo_scan_progress', { progress: p });
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
    // Samle FLERE logo-kandidater (header-logo, apple-touch-icon, og:image,
    // favicon, [class*=logo]-bilder) → studioet kan la brukeren velge.
    var cands = [], candSeen = {};
    function addCand(href) { if (!href) return; try { var u = new URL(href, location.href).href; if (!candSeen[u]) { candSeen[u] = 1; cands.push(u); } } catch (e) { /* */ } }
    var logoImgs = document.querySelectorAll('header img, [class*="logo" i] img, img[alt*="logo" i], img[class*="logo" i], a[href="/"] img, [id*="logo" i] img');
    for (var li = 0; li < logoImgs.length && cands.length < 8; li++) { if (logoImgs[li].src) addCand(logoImgs[li].src); }
    var icons = ['link[rel="apple-touch-icon"]', 'link[rel="apple-touch-icon-precomposed"]', 'meta[property="og:image"]', 'link[rel="icon"]', 'link[rel="shortcut icon"]'];
    for (var i = 0; i < icons.length; i++) {
      var el = document.querySelector(icons[i]);
      if (el) { addCand(el.getAttribute('href') || el.getAttribute('content')); }
    }
    var logoUrl = cands[0] || '';
    var logoCandidates = cands.slice(0, 6);
    var palette = [], seen = {};
    function add(c) { var rgb = parseColor(c); if (rgb && vivid(rgb)) { var hex = toHex(rgb); if (!seen[hex]) { seen[hex] = 1; palette.push(hex); } } }
    var theme = metaContent('meta[name="theme-color"]');
    if (theme && /^#?[0-9a-fA-F]{3,8}$/.test(theme)) { var th = theme[0] === '#' ? theme : '#' + theme; seen[th] = 1; palette.push(th); }
    var nodes = deepQueryAll('button,a[class*="btn" i],[class*="button" i],[class*="cta" i],header');
    for (var j = 0; j < nodes.length && palette.length < 8; j++) { try { var cs = getComputedStyle(nodes[j]); add(cs.backgroundColor); add(cs.color); } catch (e) { /* */ } }
    return { brandName: brandName || '', logoUrl: logoUrl || '', logoCandidates: logoCandidates, brandColor: palette[0] || '', palette: palette.slice(0, 6) };
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
        // PII-sladding (G23): shots blir preview-thumbnails, guide-bilder og
        // vision-input — masker skjemafelt + e-post/telefon under skuddet.
        if (window.__demoPii) window.__demoPii.mask();
        function unmask() { if (window.__demoPii) window.__demoPii.restore(); }
        window.html2canvas(document.documentElement, {
          x: window.scrollX || 0, y: window.scrollY || 0,
          width: window.innerWidth, height: window.innerHeight,
          useCORS: true, logging: false, scale: 1, backgroundColor: '#ffffff'
        }).then(function (canvas) {
          unmask();
          var maxW = 900, c = canvas;
          if (canvas.width > maxW) {
            c = document.createElement('canvas');
            c.width = maxW; c.height = Math.round(canvas.height * maxW / canvas.width);
            var ctx = c.getContext('2d'); if (ctx) ctx.drawImage(canvas, 0, 0, c.width, c.height);
          }
          resolve(c.toDataURL('image/jpeg', 0.7));
        }).catch(function () { unmask(); resolve(null); });
      } catch (e) {
        if (window.__demoPii) window.__demoPii.restore();
        resolve(null);
      }
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
        progress('shot', { index: i + 1, of: bands });
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
      shots: shots || [],
      wall: WALL
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
        progress('scan', { step: guard, found: out.length });
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

  // G10: ikke fast 1200 ms — vent til DOM-en har vært ROLIG i 500 ms (trege
  // SPA-er/lazy hero rendrer ferdig), minst 400 ms, maks 5 s.
  function waitForStable(cb) {
    var start = Date.now(), last = Date.now(), mo = null;
    try {
      mo = new MutationObserver(function () { last = Date.now(); });
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    } catch (e) { /* */ }
    (function poll() {
      var now = Date.now();
      if ((now - last >= 500 && now - start >= 400) || now - start >= 5000) {
        if (mo) { try { mo.disconnect(); } catch (e) { /* */ } }
        cb();
        return;
      }
      setTimeout(poll, 120);
    })();
  }

  // G12: cookie-/login-vegg skal ikke katalogiseres som om den var produktet.
  // Consent-bannere forsøkes lukket automatisk (godta-knapp); login-vegger kan
  // ikke fikses — de flagges i resultatet så UI-et kan si det ærlig.
  var WALL = null;
  function detectAndDismissWall(done) {
    try {
      var pw = document.querySelector('input[type="password"]');
      if (pw) {
        var pr = pw.getBoundingClientRect();
        if (pr.width > 0 && pr.height > 0) { WALL = { kind: 'login', dismissed: false }; done(); return; }
      }
      var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
      var cands = document.querySelectorAll('[class*="cookie" i],[id*="cookie" i],[class*="consent" i],[id*="consent" i],[class*="gdpr" i],[role="dialog"],[aria-modal="true"]');
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i], rc = el.getBoundingClientRect();
        if (rc.width * rc.height < iw * ih * 0.05) continue; // små badges teller ikke
        var t = ((el.innerText || '') + '').slice(0, 500).toLowerCase();
        if (!/cookie|samtykke|consent|personvern|informasjonskapsl|gdpr/.test(t)) continue;
        var btns = el.querySelectorAll('button,[role="button"],a');
        for (var j = 0; j < btns.length; j++) {
          var bl = ((btns[j].innerText || btns[j].textContent || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (/godta alle|aksepter alle|accept all|allow all|tillat alle/.test(bl) || /^(godta|aksepter|tillat|accept|agree|allow|ok)\b/.test(bl)) {
            try { btns[j].click(); } catch (e) { /* */ }
            WALL = { kind: 'consent', dismissed: true, label: bl.slice(0, 40) };
            progress('wall', { kind: 'consent', dismissed: true });
            setTimeout(done, 700); // la banneret lukke før skann
            return;
          }
        }
        WALL = { kind: 'consent', dismissed: false };
        progress('wall', { kind: 'consent', dismissed: false });
        done();
        return;
      }
    } catch (e) { /* */ }
    done();
  }

  function go() {
    waitForStable(function () {
      progress('stable');
      detectAndDismissWall(scrollThrough);
    });
  }
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
