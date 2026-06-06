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

  function scan() {
    var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    var nodes = deepQueryAll('a,button,input,textarea,select,[role="button"],[role="link"],[onclick],h1,h2');
    var out = [], seen = {};
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      var lab = labelFor(el);
      if (!lab) continue;
      var s = cssPath(el);
      var key = s + '|' + lab;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({
        selector: s,
        locators: buildLocators(el),
        label: lab,
        tag: el.nodeName.toLowerCase(),
        actionType: actionFor(el),
        belowFold: r.top > ih,
        hotspot: {
          x: Math.max(0, Math.min(1, r.left / iw)),
          y: Math.max(0, Math.min(1, r.top / ih)),
          w: Math.max(0, Math.min(1, r.width / iw)),
          h: Math.max(0, Math.min(1, r.height / ih))
        }
      });
      if (out.length >= 60) break;
    }
    // JS-rendret synlig tekst (rikere kontekst enn anonym reqwest).
    var pageText = '';
    try { pageText = (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1600); } catch (e) { /* */ }
    var branding = {};
    try { branding = extractBranding(); } catch (e) { /* */ }
    invoke('demo_scan_result', { url: location.href, title: document.title || '', elements: out, pageText: pageText, branding: branding });
  }

  function go() { setTimeout(scan, 1200); } // gi SPA-en tid til å rendre
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
