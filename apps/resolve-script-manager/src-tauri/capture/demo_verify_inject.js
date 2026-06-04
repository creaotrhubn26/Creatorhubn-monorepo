// demo_verify_inject.js — kjøres i demo-verify-vinduet. Ett-skudds verifisering:
// brukeren klikker elementet handlingen gjelder, vi sender selector+label til
// Rust (demo_verify_result → demo-capture://verify) og lukker. Brukes av Guided
// Recorder til å fylle detectedSelector → ekte Expected↔Detected-validering.
// Forventet element-label leses fra window.__demoExpectedLabel (satt før dette).
(function () {
  if (window.top !== window.self) return;
  if (window.__demoVerifyActive) return;
  window.__demoVerifyActive = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC utilgjengelig */ }
    return undefined;
  }

  var expected = (window.__demoExpectedLabel || '').toString();

  var bar = document.createElement('div');
  bar.id = '__demoVerifyBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:2147483647;background:#1d1b19;color:#fff;display:flex;align-items:center;gap:10px;padding:0 14px;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)';
  bar.innerHTML =
    '<span style="color:#ef8a5d">◎</span>'
    + '<span>Verifiser handling — klikk på ' + (expected ? '«' + expected + '»' : 'elementet handlingen gjelder') + '</span>'
    + '<button id="__dvCancel" style="margin-left:auto;background:transparent;border:1px solid #555;color:#fff;font:inherit;padding:7px 11px;border-radius:7px;cursor:pointer">Avbryt</button>';

  function mount() {
    if (!document.body) { setTimeout(mount, 50); return; }
    if (document.getElementById('__demoVerifyBar')) return;
    document.body.appendChild(bar);
    document.body.style.paddingTop = '46px';
    var x = document.getElementById('__dvCancel');
    if (x) x.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); invoke('demo_verify_result', { cancelled: true }); });
  }

  function esc(s) { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } catch (e) { return s; } }
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + esc(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      var sel = el.nodeName.toLowerCase();
      if (el.classList && el.classList.length) sel += '.' + Array.prototype.slice.call(el.classList, 0, 2).map(esc).join('.');
      var p = el.parentNode;
      if (p && p.children) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.nodeName === el.nodeName; });
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

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || (t.closest && t.closest('#__demoVerifyBar'))) return;
    e.preventDefault();
    e.stopPropagation(); // verify: ikke naviger — vi vil bare registrere klikket
    var el = meaningful(t);
    invoke('demo_verify_result', { cancelled: false, selector: cssPath(el), label: labelFor(el) });
  }, true);

  mount();
})();
