-- 0396_infographic_templates_kpi_ring — to nye polerte maler (kvalitetsløft).
--
-- kpi-grid: 2x2 KPI-kort (kategori «kpis», mer visuell enn stat-bar).
-- progress-ring: ren sirkulær progresjon (kategori «percent», moderne alt. til donut).
-- Idempotent (ON CONFLICT DO UPDATE), samme kontrakt som 0378 (leser __CFG__, setProgress).

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('kpi-grid', 'KPI-rutenett', $kpi$<style>
  #wrap{display:flex;flex-direction:column;gap:20px;padding:48px 52px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
    background:#fff;border-radius:28px;box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:translateY(14px)}
  .hd{font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--a,#2f6df0);opacity:0}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px}
  .kpi{position:relative;padding:24px 26px 22px;border-radius:18px;background:#f7f9fc;border:1px solid #eef2f8;opacity:0;transform:translateY(10px)}
  .kpi::before{content:"";position:absolute;left:26px;top:0;width:34px;height:5px;border-radius:0 0 4px 4px;background:var(--a,#2f6df0)}
  .v{font-size:52px;font-weight:800;color:#1f2d4a;letter-spacing:-1.5px;line-height:1.02}
  .l{margin-top:6px;font-size:16px;color:#5b6b7d;font-weight:500}
</style>
<div id="wrap">
  <div class="hd" data-d="0"></div>
  <div class="grid" id="grid"></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  var hd = document.querySelector('.hd');
  hd.textContent = CFG.label || CFG.title || '';
  if (!hd.textContent) hd.style.display = 'none';
  var cards = (Array.isArray(CFG.cards) && CFG.cards.length ? CFG.cards : [{ value: CFG.value, label: '' }]).slice(0, 4);
  var g = document.getElementById('grid');
  cards.forEach(function (c, i) {
    var d = document.createElement('div'); d.className = 'kpi'; d.dataset.d = (0.12 + i * 0.12).toFixed(2);
    var v = document.createElement('div'); v.className = 'v'; v.dataset.to = (c && c.value != null ? c.value : '0'); v.textContent = '0';
    var l = document.createElement('div'); l.className = 'l'; l.textContent = (c && c.label) || '';
    d.appendChild(v); d.appendChild(l); g.appendChild(d);
  });
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function num(el,to,p){var m=String(to).match(/^([-+]?[\d\s.,]*\d)(.*)$/);if(!m){el.textContent=to;return;}var raw=m[1].replace(/\s/g,''),dec=(raw.split(/[.,]/)[1]||'').length,base=parseFloat(raw.replace(',','.'));if(!isFinite(base)){el.textContent=to;return;}var v=base*p,s=(dec?v.toFixed(dec):Math.round(v));if(Math.abs(base)>=1000&&!dec)s=Math.round(v).toLocaleString('nb-NO');el.textContent=s+m[2];}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .25));
    if (w) { w.style.opacity = e; w.style.transform = 'translateY(' + (14 * (1 - e)).toFixed(1) + 'px)'; }
    document.querySelectorAll('[data-d]').forEach(function (el) {
      var q = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.5)));
      el.style.opacity = q; if (el.classList.contains('kpi')) el.style.transform = 'translateY(' + (10 * (1 - q)).toFixed(1) + 'px)';
    });
    document.querySelectorAll('.v').forEach(function (el) { num(el, el.dataset.to, ease(Math.max(0, Math.min(1, (p - .15) / .7)))); });
  };
  window.setProgress(0);
</script>
$kpi$, 'kpis', 12, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, auto_priority=EXCLUDED.auto_priority, updated_at=NOW();

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('progress-ring', 'Progresjons-ring', $ring$<style>
  #wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:52px 60px;width:max-content;
    font-family:Inter,"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;
    background:#fff;border-radius:28px;box-shadow:0 28px 70px rgba(20,40,80,.12);opacity:0;transform:scale(.94)}
  .ring{position:relative;width:260px;height:260px}
  .ring svg{transform:rotate(-90deg)}
  .track{fill:none;stroke:#eef2f8;stroke-width:22}
  .arc{fill:none;stroke:var(--a,#2f6df0);stroke-width:22;stroke-linecap:round}
  .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .pct{font-size:66px;font-weight:800;color:#1f2d4a;letter-spacing:-2px;line-height:1}
  .sub{font-size:15px;color:#8a97a6;font-weight:600;margin-top:2px}
  .lbl{font-size:21px;color:#5b6b7d;font-weight:500;opacity:0}
</style>
<div id="wrap">
  <div class="ring">
    <svg width="260" height="260" viewBox="0 0 260 260">
      <circle class="track" cx="130" cy="130" r="108"></circle>
      <circle class="arc" id="arc" cx="130" cy="130" r="108"></circle>
    </svg>
    <div class="ctr">
      <div class="pct" id="pct">0%</div>
      <div class="sub" id="sub"></div>
    </div>
  </div>
  <div class="lbl" data-d="0.45"></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  document.documentElement.style.setProperty('--a', CFG.accent || '#2f6df0');
  // Verdi → andel 0..1. Godtar «80%», 0.8, 80 (>1 antas prosent-tall).
  var raw = CFG.value != null ? CFG.value : ((CFG.cards && CFG.cards[0] && CFG.cards[0].value));
  var frac = 0, showPct = true;
  (function () {
    if (typeof raw === 'number') { frac = raw > 1 ? raw / 100 : raw; }
    else if (typeof raw === 'string') {
      var s = raw.trim();
      if (s.slice(-1) === '%') frac = parseFloat(s) / 100;
      else { var n = Number(s.replace(',', '.')); if (isFinite(n)) frac = n > 1 ? n / 100 : n; }
    }
    if (!(frac >= 0)) frac = 0; if (frac > 1) frac = 1;
  })();
  document.querySelector('.lbl').textContent = CFG.label || '';
  var C = 2 * Math.PI * 108, arc = document.getElementById('arc');
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  window.setProgress = function (p) {
    var w = document.getElementById('wrap'); var e = ease(Math.min(1, p / .3));
    if (w) { w.style.opacity = e; w.style.transform = 'scale(' + (0.94 + 0.06 * e) + ')'; }
    var fp = ease(Math.max(0, Math.min(1, (p - .1) / .75)));
    arc.style.strokeDashoffset = C * (1 - frac * fp);
    document.getElementById('pct').textContent = Math.round(frac * fp * 100) + '%';
    document.querySelectorAll('[data-d]').forEach(function (el) { el.style.opacity = ease(Math.max(0, Math.min(1, (p - (+el.dataset.d)) / 0.5))); });
  };
  window.setProgress(0);
</script>
$ring$, 'percent', 8, '#2f6df0', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category, auto_priority=EXCLUDED.auto_priority, updated_at=NOW();
