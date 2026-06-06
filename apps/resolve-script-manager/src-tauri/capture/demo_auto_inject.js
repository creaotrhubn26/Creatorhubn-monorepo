// demo_auto_inject.js — kjøres i demo-auto-vinduet. Utfører en scenes handling
// AUTOMATISK på den ekte siden (continueMode:'auto'): finner target-elementet
// via selector og klikker/scroller/hover/skriver, og rapporterer resultatet til
// Rust (demo_auto_result → demo-capture://auto). Config i window.__demoAuto
// (satt før dette scriptet): { selector, actionType, text }.
(function () {
  if (window.top !== window.self) return;
  if (window.__demoAutoActive) return;
  window.__demoAutoActive = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC utilgjengelig */ }
    return undefined;
  }

  var cfg = window.__demoAuto || {};

  var bar = document.createElement('div');
  bar.id = '__demoAutoBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:2147483647;background:#1d1b19;color:#fff;display:flex;align-items:center;gap:10px;padding:0 14px;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)';
  bar.innerHTML = '<span style="color:#ef8a5d">▶</span><span id="__daMsg">Utfører handling automatisk…</span>';
  function mount() {
    if (!document.body) { setTimeout(mount, 50); return; }
    if (!document.getElementById('__demoAutoBar')) { document.body.appendChild(bar); document.body.style.paddingTop = '46px'; }
  }

  function flash(el) {
    try { el.style.outline = '3px solid #ef8a5d'; el.style.outlineOffset = '2px'; el.scrollIntoView({ block: 'center' }); } catch (e) { /* */ }
  }

  function run() {
    var el = null;
    try { el = cfg.selector ? document.querySelector(cfg.selector) : null; } catch (e) { el = null; }
    if (!el) {
      invoke('demo_auto_result', { ok: false, found: false, selector: cfg.selector || '' });
      return;
    }
    flash(el);
    var at = cfg.actionType || 'click';
    try {
      if (at === 'type') {
        el.focus();
        if ('value' in el) {
          el.value = cfg.text || 'Demo';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (at === 'hover') {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      } else if (at === 'scroll') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (at === 'highlight') {
        /* allerede fremhevet via flash */
      } else {
        el.click(); // click + default
      }
    } catch (e) { /* fortsett — rapporter likevel found */ }
    var m = document.getElementById('__daMsg');
    if (m) m.textContent = '✓ Handling utført';
    setTimeout(function () { invoke('demo_auto_result', { ok: true, found: true, selector: cfg.selector || '' }); }, 900);
  }

  function go() { mount(); setTimeout(run, 1200); } // gi siden tid til å rendre
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
