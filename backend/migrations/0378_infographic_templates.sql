-- 0378_infographic_templates.sql
-- Infografikk-maler som DATA (ikke kode) → nye maler kan legges til via admin uten
-- app-deploy. render.png laster html herfra; mal-velger + auto-velg leser registeret.
-- Bygde-inn maler seedes; `is_builtin` beskytter dem mot sletting i admin-UI.
BEGIN;

CREATE TABLE IF NOT EXISTS infographic_templates (
  id             VARCHAR(64) PRIMARY KEY,
  label          TEXT NOT NULL,
  html           TEXT NOT NULL,
  category       VARCHAR(20) NOT NULL DEFAULT 'other'
                 CHECK (category IN ('single','percent','kpis','comparison','timeline','other')),
  auto_priority  INTEGER NOT NULL DEFAULT 0,
  accent_default VARCHAR(16),
  is_builtin     BOOLEAN NOT NULL DEFAULT FALSE,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infographic_templates_active
  ON infographic_templates(active, category, auto_priority DESC);

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('big-number', 'Stort tall', $html$<style>
  #wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:52px 64px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;background:#fff;border-radius:26px;
    box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:scale(.92)}
  .top{width:64px;height:6px;border-radius:4px;background:var(--a,#2f6df0);margin-bottom:14px;opacity:0}
  .num{font-size:96px;font-weight:800;color:#1f2d4a;letter-spacing:-2px;line-height:1}
  .lbl{font-size:22px;color:#5b6b7d;font-weight:500;opacity:0}
</style>
<div id="wrap">
  <div class="top" data-d="0"></div>
  <div class="num" data-to="0">0</div>
  <div class="lbl" data-d="0.35"></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var first = (CFG.cards && CFG.cards[0]) || {};
  document.querySelector('.num').dataset.to = CFG.value || first.value || '0';
  document.querySelector('.lbl').textContent = CFG.label || first.label || '';
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function num(el,to,p){var m=String(to).match(/^([-+]?\d+(?:[.,]\d+)?)(.*)$/);if(!m){el.textContent=to;return;}var dec=(m[1].split(/[.,]/)[1]||'').length,v=parseFloat(m[1].replace(',','.'))*p;el.textContent=(dec?v.toFixed(dec):Math.round(v))+m[2];}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .3));
    if (w) { w.style.opacity = e; w.style.transform = 'scale(' + (0.92 + 0.08 * e) + ')'; }
    document.querySelectorAll('[data-d]').forEach(function (el) { el.style.opacity = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.5))); });
    num(document.querySelector('.num'), document.querySelector('.num').dataset.to, ease(Math.max(0, Math.min(1, (p - .1) / .7))));
  };
  window.setProgress(0);
</script>
$html$, 'single', 10, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('stat-bar', 'Stat-bar (horisontal)', $html$<style>
  #wrap{display:flex;align-items:center;gap:34px;padding:34px 44px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;background:#fff;border-radius:22px;
    box-shadow:0 24px 60px rgba(20,40,80,.10);opacity:0;transform:translateY(22px)}
  .ttl{font-size:32px;font-weight:800;color:#1f2d4a;letter-spacing:-.5px}
  .kpi{text-align:center}.kpi .k{font-size:15px;color:#5b6b7d;font-weight:500;margin-bottom:4px}
  .kpi .v{font-size:40px;font-weight:800;color:var(--a,#2f6df0);letter-spacing:-.5px}
  .sep{width:1px;height:56px;background:rgba(20,40,80,.10)}
</style>
<div id="wrap"></div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var wrap = document.getElementById('wrap');
  if (CFG.title) { var t = document.createElement('div'); t.className = 'ttl'; t.textContent = CFG.title; wrap.appendChild(t); }
  (CFG.kpis || CFG.cards || []).forEach(function (k, i) {
    if (i > 0 || CFG.title) { var s = document.createElement('div'); s.className = 'sep'; wrap.appendChild(s); }
    var kp = document.createElement('div'); kp.className = 'kpi'; kp.dataset.d = 0.12 + 0.1 * i;
    kp.innerHTML = '<div class="k">' + (k.label || '') + '</div><div class="v" data-to="' + (k.value || '') + '">0</div>';
    wrap.appendChild(kp);
  });
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function num(el,to,p){var m=String(to).match(/^([-+]?\d+(?:[.,]\d+)?)(.*)$/);if(!m){el.textContent=to;return;}var dec=(m[1].split(/[.,]/)[1]||'').length,v=parseFloat(m[1].replace(',','.'))*p;el.textContent=(dec?v.toFixed(dec):Math.round(v))+m[2];}
  window.setProgress = function (p) {
    document.querySelectorAll('[data-d]').forEach(function (e) { e.style.opacity = ease(Math.max(0, Math.min(1, (p - (+e.dataset.d)) / 0.5))); });
    document.querySelectorAll('[data-to]').forEach(function (e) { num(e, e.dataset.to, ease(Math.max(0, Math.min(1, (p - .15) / .6)))); });
    var w = document.getElementById('wrap'); if (w) { w.style.opacity = ease(Math.min(1, p / .3)); w.style.transform = 'translateY(' + (22 * (1 - ease(Math.min(1, p / .3)))) + 'px)'; }
  };
  window.setProgress(0);
</script>
$html$, 'kpis', 10, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('donut', 'Donut (prosent / andel)', $html$<style>
  #wrap{display:flex;flex-direction:column;align-items:center;gap:6px;padding:48px 60px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;background:#fff;border-radius:26px;
    box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:scale(.92)}
  .ring{position:relative;width:220px;height:220px}
  .ring svg{transform:rotate(-90deg)}
  .pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font-size:52px;font-weight:800;color:#1f2d4a;letter-spacing:-1px}
  .lbl{font-size:20px;color:#5b6b7d;font-weight:500;margin-top:6px;opacity:0}
</style>
<div id="wrap">
  <div class="ring">
    <svg width="220" height="220" viewBox="0 0 220 220">
      <circle cx="110" cy="110" r="94" fill="none" stroke="#eef1f6" stroke-width="22"/>
      <circle id="arc" cx="110" cy="110" r="94" fill="none" stroke="var(--a,#2f6df0)" stroke-width="22"
        stroke-linecap="round" stroke-dasharray="590.6" stroke-dashoffset="590.6"/>
    </svg>
    <div class="pct" data-to="0">0%</div>
  </div>
  <div class="lbl" data-d="0.4"></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var first = (CFG.cards && CFG.cards[0]) || {};
  // Prosent 0..100 (godtar "87", "87%", 0.87).
  var raw = CFG.value != null ? CFG.value : (first.value != null ? first.value : 0);
  var pct = parseFloat(String(raw).replace('%','').replace(',', '.')) || 0;
  if (pct > 0 && pct <= 1) pct = pct * 100;
  pct = Math.max(0, Math.min(100, pct));
  document.querySelector('.lbl').textContent = CFG.label || first.label || '';
  var CIRC = 2 * Math.PI * 94; // 590.6
  var arc = document.getElementById('arc');
  var pctEl = document.querySelector('.pct');
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .3));
    if (w) { w.style.opacity = e; w.style.transform = 'scale(' + (0.92 + 0.08 * e) + ')'; }
    var ap = ease(Math.max(0, Math.min(1, (p - .1) / .7)));
    arc.style.strokeDashoffset = CIRC * (1 - (pct / 100) * ap);
    var shown = pct * ap;
    pctEl.textContent = (Math.round(shown * 10) / 10 % 1 === 0 ? Math.round(shown) : shown.toFixed(1)) + '%';
    document.querySelectorAll('[data-d]').forEach(function (el) {
      el.style.opacity = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.5)));
    });
  };
  window.setProgress(0);
</script>
$html$, 'percent', 10, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('comparison', 'Sammenligning (før/etter)', $html$<style>
  #wrap{display:flex;flex-direction:column;gap:20px;padding:44px 56px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;background:#fff;border-radius:26px;
    box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:scale(.94)}
  .ttl{font-size:22px;font-weight:800;color:#1f2d4a;text-align:center}
  .row{display:flex;align-items:center;gap:34px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:150px}
  .cell .v{font-size:56px;font-weight:800;letter-spacing:-1px}
  .cell .l{font-size:15px;color:#7a8699;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .before .v{color:#9aa6b8}
  .after .v{color:var(--a,#2f6df0)}
  .arrow{display:flex;flex-direction:column;align-items:center;gap:2px;opacity:0}
  .arrow .sym{font-size:34px;color:var(--a,#2f6df0);line-height:1}
  .arrow .delta{font-size:15px;font-weight:800;padding:2px 10px;border-radius:20px}
</style>
<div id="wrap">
  <div class="ttl" data-d="0"></div>
  <div class="row">
    <div class="cell before"><div class="v" data-to="0">0</div><div class="l" data-bl></div></div>
    <div class="arrow" data-d="0.5"><div class="sym">&rarr;</div><div class="delta"></div></div>
    <div class="cell after"><div class="v" data-to="0">0</div><div class="l" data-al></div></div>
  </div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var cards = CFG.cards || [];
  var b = CFG.before || cards[0] || {}, a = CFG.after || cards[1] || {};
  if (CFG.title) document.querySelector('.ttl').textContent = CFG.title;
  document.querySelector('.before .l').textContent = b.label || 'Før';
  document.querySelector('.after .l').textContent = a.label || 'Etter';
  var bv = document.querySelector('.before .v'), av = document.querySelector('.after .v');
  bv.dataset.to = b.value != null ? b.value : '0';
  av.dataset.to = a.value != null ? a.value : '0';
  // Delta-% når begge er rene tall.
  function n(x){var m=String(x).match(/-?\d+(?:[.,]\d+)?/);return m?parseFloat(m[0].replace(',','.')):null;}
  var nb = n(b.value), na = n(a.value), deltaEl = document.querySelector('.delta');
  if (nb != null && na != null && nb !== 0) {
    var d = Math.round((na - nb) / Math.abs(nb) * 100);
    var up = d >= 0;
    deltaEl.textContent = (up ? '+' : '') + d + '%';
    deltaEl.style.color = up ? '#0a7d38' : '#c0392b';
    deltaEl.style.background = up ? '#e6f6ec' : '#fdecea';
  }
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function num(el,p){var to=el.dataset.to,m=String(to).match(/^([-+]?\d+(?:[.,]\d+)?)(.*)$/);if(!m){el.textContent=to;return;}var dec=(m[1].split(/[.,]/)[1]||'').length,v=parseFloat(m[1].replace(',','.'))*p;el.textContent=(dec?v.toFixed(dec):Math.round(v))+m[2];}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .3));
    if (w) { w.style.opacity = e; w.style.transform = 'scale(' + (0.94 + 0.06 * e) + ')'; }
    var np = ease(Math.max(0, Math.min(1, (p - .1) / .7)));
    num(bv, np); num(av, np);
    document.querySelectorAll('[data-d]').forEach(function (el) {
      el.style.opacity = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.5)));
    });
  };
  window.setProgress(0);
</script>
$html$, 'comparison', 10, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('timeline', 'Tidslinje (steg)', $html$<style>
  #wrap{padding:44px 56px;width:max-content;max-width:640px;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;background:#fff;border-radius:26px;
    box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:scale(.94)}
  .ttl{font-size:22px;font-weight:800;color:#1f2d4a;margin-bottom:22px}
  .steps{position:relative;padding-left:34px}
  .line{position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:#e7ebf1}
  .step{position:relative;padding-bottom:22px;opacity:0;transform:translateX(-8px)}
  .step:last-child{padding-bottom:0}
  .dot{position:absolute;left:-33px;top:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;border:3px solid var(--a,#2f6df0);box-sizing:border-box}
  .when{font-size:13px;font-weight:700;color:var(--a,#2f6df0);letter-spacing:.4px}
  .head{font-size:18px;font-weight:700;color:#1f2d4a;margin:1px 0}
  .desc{font-size:14px;color:#6b7787;line-height:1.35}
</style>
<div id="wrap">
  <div class="ttl" data-d="0"></div>
  <div class="steps"><div class="line"></div><div id="list"></div></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  if (CFG.title) document.querySelector('.ttl').textContent = CFG.title; else document.querySelector('.ttl').style.display = 'none';
  var steps = CFG.steps || CFG.cards || [];
  var list = document.getElementById('list');
  steps.forEach(function (s, i) {
    var el = document.createElement('div');
    el.className = 'step'; el.dataset.d = (0.15 + i * 0.18).toFixed(2);
    var when = s.value != null ? s.value : (s.when || s.date || '');
    el.innerHTML = '<span class="dot"></span>' +
      (when ? '<div class="when">' + esc(when) + '</div>' : '') +
      '<div class="head">' + esc(s.label || s.title || '') + '</div>' +
      (s.desc ? '<div class="desc">' + esc(s.desc) + '</div>' : '');
    list.appendChild(el);
  });
  function esc(t){return String(t).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .3));
    if (w) { w.style.opacity = e; w.style.transform = 'scale(' + (0.94 + 0.06 * e) + ')'; }
    document.querySelectorAll('[data-d]').forEach(function (el) {
      var t = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.4)));
      el.style.opacity = t;
      if (el.classList.contains('step')) el.style.transform = 'translateX(' + (-8 * (1 - t)) + 'px)';
    });
  };
  window.setProgress(0);
</script>
$html$, 'timeline', 10, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('demo-template', 'KPI-kort (tellende tall)', $html$<style>
  #wrap{display:flex;gap:22px;padding:44px;width:max-content;font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif}
  .c{background:#fff;border-radius:18px;padding:24px 28px;min-width:240px;box-shadow:0 20px 50px rgba(20,40,80,.12);opacity:0;transform:translateY(20px)}
  .l{color:#5b6b7d;font-size:15px;font-weight:500}
  .n{font-size:48px;font-weight:800;color:#1f2d4a;line-height:1.05}
  .d{width:46px;height:5px;border-radius:3px;margin-top:12px;background:var(--a,#2f6df0)}
</style>
<div id="wrap"></div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var wrap = document.getElementById('wrap');
  (CFG.cards || []).forEach(function (c, i) {
    var d = document.createElement('div'); d.className = 'c'; d.dataset.d = 0.14 * i;
    d.innerHTML = '<div class="l">' + (c.label || '') + '</div><div class="n" data-to="' + (c.value || '') + '">0</div><div class="d"></div>';
    wrap.appendChild(d);
  });
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  window.setProgress = function (p) {
    document.querySelectorAll('[data-d]').forEach(function (e) {
      var t = ease(Math.max(0, Math.min(1, (p - (+e.dataset.d)) / 0.5)));
      e.style.opacity = t; e.style.transform = 'translateY(' + (20 * (1 - t)) + 'px)';
    });
    document.querySelectorAll('[data-to]').forEach(function (e) {
      var m = String(e.dataset.to).match(/^([-+]?\d+(?:[.,]\d+)?)(.*)$/);
      if (!m) { e.textContent = e.dataset.to; return; }
      var q = ease(Math.max(0, Math.min(1, (p - .1) / .7)));
      e.textContent = Math.round(parseFloat(m[1].replace(',', '.')) * q) + m[2];
    });
  };
  window.setProgress(0);
</script>
$html$, 'kpis', 5, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, updated_at=NOW();

COMMIT;
