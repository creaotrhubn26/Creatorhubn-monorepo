// demo_capture_inject.js — kjøres som initialization_script i demo-capture-
// webviewet (Tauri v2). Toppdokument på den EKTE siden (ikke iframe → ikke
// underlagt X-Frame-Options). Viser en capture-verktøylinje og gjør hvert
// klikk om til et «steg» som sendes til Rust via IPC, som videresender det til
// hovedvinduet (event demo-capture://step). Script-et kjøres på nytt ved hver
// navigasjon, så stegteller persisteres i sessionStorage.
(function () {
  if (window.top !== window.self) return;        // kun toppdokument
  if (window.__demoCaptureActive) return;
  window.__demoCaptureActive = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC ikke tilgjengelig */ }
    return undefined;
  }

  function countGet() { try { return parseInt(sessionStorage.getItem('__dcCount') || '0', 10) || 0; } catch (e) { return 0; } }
  function countSet(n) { try { sessionStorage.setItem('__dcCount', String(n)); } catch (e) {} }

  // ── Verktøylinje ──
  var bar = document.createElement('div');
  bar.id = '__demoCaptureBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:2147483647;background:#1d1b19;color:#fff;display:flex;align-items:center;gap:12px;padding:0 14px;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)';
  bar.innerHTML =
    '<span style="color:#ef8a5d">●</span>'
    + '<span>Demo Capture — klikk deg gjennom siden. Hvert klikk blir et steg.</span>'
    + '<span id="__dcCount" style="margin-left:auto;opacity:.85">0 steg</span>'
    + '<button id="__dcDone" style="background:#ef8a5d;border:0;color:#fff;font:inherit;padding:7px 13px;border-radius:7px;cursor:pointer">Fullfør capture</button>'
    + '<button id="__dcCancel" style="background:transparent;border:1px solid #555;color:#fff;font:inherit;padding:7px 11px;border-radius:7px;cursor:pointer">Avbryt</button>';

  function mount() {
    if (!document.body) { setTimeout(mount, 50); return; }
    if (document.getElementById('__demoCaptureBar')) return;
    document.body.appendChild(bar);
    document.body.style.paddingTop = '46px';
    var c = document.getElementById('__dcCount'); if (c) c.textContent = countGet() + ' steg';
    var d = document.getElementById('__dcDone'); if (d) d.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); finish(false); });
    var x = document.getElementById('__dcCancel'); if (x) x.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); finish(true); });
  }

  function finish(cancelled) {
    countSet(0);
    invoke('demo_capture_done', { cancelled: !!cancelled });
  }

  // ── Selector / label / element-hjelpere ──
  function esc(s) { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } catch (e) { return s; } }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + esc(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      var sel = el.nodeName.toLowerCase();
      if (el.classList && el.classList.length) {
        sel += '.' + Array.prototype.slice.call(el.classList, 0, 2).map(esc).join('.');
      }
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

  function meaningful(el) {
    var stop = 0;
    while (el && el !== document.body && stop < 6) {
      var tag = el.nodeName.toLowerCase();
      if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select' ||
          (el.getAttribute && el.getAttribute('role')) || el.onclick) return el;
      el = el.parentElement; stop++;
    }
    return el || document.body;
  }

  function actionFor(el) {
    var tag = el.nodeName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return 'type';
    return 'click';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || (t.closest && t.closest('#__demoCaptureBar'))) return;
    var el = meaningful(t);
    var r = el.getBoundingClientRect();
    var iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    var docH = document.documentElement.scrollHeight || document.body.scrollHeight || ih;
    var maxScroll = Math.max(1, docH - ih);
    var step = {
      url: location.href,
      selector: cssPath(el),
      targetLabel: labelFor(el),
      actionType: actionFor(el),
      hotspot: {
        x: Math.max(0, Math.min(1, r.left / iw)),
        y: Math.max(0, Math.min(1, r.top / ih)),
        w: Math.max(0, Math.min(1, r.width / iw)),
        h: Math.max(0, Math.min(1, r.height / ih))
      },
      scrollPct: Math.max(0, Math.min(1, (window.scrollY || 0) / maxScroll))
    };
    var n = countGet() + 1; countSet(n);
    var c = document.getElementById('__dcCount'); if (c) c.textContent = n + ' steg';
    invoke('demo_capture_step', { step: step });
    // Ikke preventDefault: la klikket/navigasjonen skje. Script-et re-injiseres
    // på neste side, og stegtelleren leses fra sessionStorage.
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
