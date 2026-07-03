// demo_session_inject.js — kjøres i det VEDVARENDE demo-session-vinduet (G4).
//
// I motsetning til demo_auto/verify/shot-vinduene (nytt vindu per kall, alt
// state tapes) lever dette vinduet gjennom HELE auto-kjøringen: navigasjon,
// innlogging og side-tilstand overlever mellom stegene. Scriptet injiseres på
// nytt ved hver navigasjon (initialization_script) og definerer tre funksjoner
// som Rust kaller via eval():
//
//   __demoSessionRun(cfg)     — utfør en handling {selector, locators, actionType, text}
//   __demoSessionVerify(lbl)  — arm ett-skudds verify (bruker klikker elementet)
//   __demoSessionShot()       — html2canvas-skjermbilde av viewporten (post-state!)
//
// Alle rapporterer via demo_session_report(kind, result) — som IKKE lukker
// vinduet. Elementer finnes via multi-strategi-locators (id → testid → aria →
// text → css) med enkel css-selector som fallback, og handlinger rapporterer
// EKTE utfall (exception → ok:false), ikke alltid-suksess.
(function () {
  if (window.top !== window.self) return;
  if (window.__demoSessionBooted) return;
  window.__demoSessionBooted = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC utilgjengelig */ }
    return undefined;
  }
  function report(kind, result) { invoke('demo_session_report', { kind: kind, result: result }); }

  // ── Diskret økt-indikator (nederst — toppen skal være urørt for opptak) ──
  function mountBadge() {
    if (!document.body || document.getElementById('__demoSessionBadge')) return;
    var b = document.createElement('div');
    b.id = '__demoSessionBadge';
    b.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:2147483646;background:rgba(29,27,25,.92);color:#fff;padding:6px 11px;border-radius:8px;font:600 11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none';
    b.textContent = '● Demo-økt aktiv';
    document.body.appendChild(b);
  }
  function setBadge(msg) {
    var b = document.getElementById('__demoSessionBadge');
    if (b) b.textContent = msg;
  }

  function whenReady(cb, settleMs) {
    var s = typeof settleMs === 'number' ? settleMs : 900;
    if (document.readyState === 'complete') setTimeout(cb, Math.min(s, 250));
    else window.addEventListener('load', function () { setTimeout(cb, s); });
  }

  // ── Locator-oppløsning: prøv strategiene i prioritert rekkefølge ──
  function tryLocator(loc) {
    try {
      var st = loc.strategy, v = loc.value || '';
      if (st === 'id' || st === 'testid' || st === 'css') return document.querySelector(v);
      if (st === 'aria') {
        var p = v.split('|'); var role = p[0] || ''; var label = (p.slice(1).join('|') || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var sel = '[role="' + role + '"]';
        try { if (/^[a-z][a-z0-9-]*$/i.test(role)) sel += ',' + role; } catch (e2) { /* */ }
        var cands = document.querySelectorAll(sel);
        for (var i = 0; i < cands.length; i++) {
          var a = (cands[i].getAttribute('aria-label') || cands[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (label && a.indexOf(label) >= 0) return cands[i];
        }
        return null;
      }
      if (st === 'text') {
        var q = v.split('|'); var tag = q[0] || '*'; var txt = (q.slice(1).join('|') || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!txt) return null;
        var els = document.querySelectorAll(tag);
        for (var j = 0; j < els.length; j++) {
          var t = (els[j].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (t === txt || (t.indexOf(txt) >= 0 && t.length <= txt.length + 24)) return els[j];
        }
        return null;
      }
    } catch (e) { /* ugyldig selector — prøv neste strategi */ }
    return null;
  }
  function findTarget(cfg) {
    var L = cfg.locators || [];
    for (var i = 0; i < L.length; i++) {
      var el = tryLocator(L[i]);
      if (el) return { el: el, strategy: L[i].strategy };
    }
    if (cfg.selector) {
      try { var e2 = document.querySelector(cfg.selector); if (e2) return { el: e2, strategy: 'css' }; } catch (e) { /* */ }
    }
    return null;
  }

  function flash(el) {
    try { el.style.outline = '3px solid #ef8a5d'; el.style.outlineOffset = '2px'; el.scrollIntoView({ block: 'center' }); } catch (e) { /* */ }
  }

  // ── Utfør en handling. Rapporterer EKTE utfall via kind 'auto'. ──
  window.__demoSessionRun = function (cfg) {
    cfg = cfg || {};
    whenReady(function () {
      mountBadge();
      var at = cfg.actionType || 'click';
      // Scroll uten target = scroll siden (intro-/oversikts-scener).
      if (at === 'scroll' && !cfg.selector && !(cfg.locators && cfg.locators.length)) {
        try { window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: 'smooth' }); } catch (e) { window.scrollBy(0, 500); }
        setBadge('▶ Scrollet');
        setTimeout(function () { report('auto', { ok: true, found: true, selector: '', strategy: 'none', url: location.href }); }, 500);
        return;
      }
      var hit = findTarget(cfg);
      if (!hit) {
        setBadge('✕ Fant ikke elementet');
        report('auto', { ok: false, found: false, selector: cfg.selector || '', url: location.href });
        return;
      }
      flash(hit.el);
      setBadge('▶ Utfører: ' + at);
      var el = hit.el;
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
          el.click();
        }
      } catch (e) {
        setBadge('✕ Handlingen feilet');
        report('auto', { ok: false, found: true, selector: cfg.selector || '', strategy: hit.strategy, error: String(e), url: location.href });
        return;
      }
      setBadge('✓ Utført');
      // Rapporter STRAKS (ikke etter delay): et klikk kan navigere bort og da
      // dør en utsatt rapport med den gamle siden. Utfalls-verifisering skjer
      // via __demoSessionShot + vision, eller ved at neste steg finner sitt element.
      report('auto', { ok: true, found: true, selector: cfg.selector || '', strategy: hit.strategy, url: location.href });
    }, cfg.settleMs);
  };

  // ── Ett-skudds verify: bruker klikker elementet, vi fanger selector+label. ──
  var verifyState = { armed: false, handler: null, bar: null };
  function disarmVerify() {
    if (verifyState.handler) document.removeEventListener('click', verifyState.handler, true);
    if (verifyState.bar && verifyState.bar.parentNode) verifyState.bar.parentNode.removeChild(verifyState.bar);
    if (document.body) document.body.style.paddingTop = '';
    verifyState = { armed: false, handler: null, bar: null };
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

  window.__demoSessionVerify = function (expected) {
    whenReady(function () {
      mountBadge();
      disarmVerify();
      var bar = document.createElement('div');
      bar.id = '__demoSessionVerifyBar';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:2147483647;background:#1d1b19;color:#fff;display:flex;align-items:center;gap:10px;padding:0 14px;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)';
      bar.innerHTML =
        '<span style="color:#ef8a5d">◎</span>'
        + '<span>Verifiser — klikk på ' + (expected ? '«' + String(expected).replace(/</g, '&lt;') + '»' : 'elementet handlingen gjelder') + '</span>'
        + '<button id="__dsvCancel" style="margin-left:auto;background:transparent;border:1px solid #555;color:#fff;font:inherit;padding:7px 11px;border-radius:7px;cursor:pointer">Avbryt</button>';
      document.body.appendChild(bar);
      document.body.style.paddingTop = '46px';
      var x = bar.querySelector('#__dsvCancel');
      if (x) x.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        disarmVerify();
        report('verify', { cancelled: true });
      });
      var handler = function (e) {
        var t = e.target;
        if (!t || (t.closest && t.closest('#__demoSessionVerifyBar'))) return;
        e.preventDefault();
        e.stopPropagation(); // registrér klikket uten å utføre — utførelsen kjøres etterpå via __demoSessionRun
        var el = meaningful(t);
        var payload = { cancelled: false, selector: cssPath(el), label: labelFor(el) };
        disarmVerify();
        report('verify', payload);
      };
      verifyState = { armed: true, handler: handler, bar: bar };
      document.addEventListener('click', handler, true);
    }, 200);
  };

  // ── Skjermbilde av NÅVÆRENDE tilstand (post-action — G6-fiksen). ──
  function downscale(canvas, maxW) {
    if (canvas.width <= maxW) return canvas;
    var c2 = document.createElement('canvas');
    c2.width = maxW;
    c2.height = Math.round(canvas.height * maxW / canvas.width);
    var ctx = c2.getContext('2d');
    if (ctx) ctx.drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2;
  }
  window.__demoSessionShot = function () {
    whenReady(function () {
      try {
        if (!window.html2canvas) { report('shot', { ok: false, error: 'html2canvas mangler' }); return; }
        window.html2canvas(document.documentElement, {
          x: window.scrollX || 0,
          y: window.scrollY || 0,
          width: window.innerWidth,
          height: window.innerHeight,
          useCORS: true,
          logging: false,
          scale: 1,
          backgroundColor: '#ffffff',
        }).then(function (canvas) {
          var out = downscale(canvas, 1000);
          report('shot', { ok: true, dataUrl: out.toDataURL('image/jpeg', 0.72) });
        }).catch(function (e) {
          report('shot', { ok: false, error: String(e) });
        });
      } catch (e) {
        report('shot', { ok: false, error: String(e) });
      }
    }, 300);
  };

  // Meld fra når en side i økten er lastet (frontend venter på dette ved åpning
  // og kan bruke det til å vite at en navigasjon har landet).
  whenReady(function () {
    mountBadge();
    report('nav', { url: location.href, title: document.title || '' });
  }, 400);
})();
