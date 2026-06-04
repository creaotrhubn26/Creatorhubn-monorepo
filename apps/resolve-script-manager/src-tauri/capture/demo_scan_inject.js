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

  function scan() {
    var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[onclick],h1,h2')
    );
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
    invoke('demo_scan_result', { url: location.href, title: document.title || '', elements: out });
  }

  function go() { setTimeout(scan, 1200); } // gi SPA-en tid til å rendre
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
