-- 0441_infographic_call_sheet_template — registrer «call-sheet» som innebygd DB-mal.
--
-- Bakgrunn: CaptureApp rendrer en designet call-sheet (shot-list → Infographic-motor)
-- via ?tpl=call-sheet. Malen lå KUN som statisk /embed/templates/call-sheet.html og
-- ble servert via render.png sin embed-fetch-fallback (HTTP-hopp til frontend, og
-- den dukket ikke opp i mal-velgeren /api/infographics/templates).
--
-- Dette seeder den samme HTML-en inn i infographic_templates som is_builtin=TRUE →
-- render.png treffer DB-cachen direkte (ingen fetch), og malen listes i velgeren.
-- Kategori «other» + auto_priority 0 → aldri auto-valgt (kun eksplisitt ?tpl=call-sheet).
-- Idempotent (ON CONFLICT DO UPDATE), samme kontrakt som 0378/0396 (__CFG__, #wrap, setProgress).

INSERT INTO infographic_templates (id,label,html,category,auto_priority,accent_default,is_builtin,active)
VALUES ('call-sheet', 'Call-sheet (shot-list)', $callsheet$<style>
  :root { --a: #ff6b35; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: transparent; font-family: Inter, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #wrap {
    width: 1000px; padding: 64px 68px 72px;
    background: #ffffff; border-radius: 40px;
    box-shadow: 0 40px 120px rgba(10,15,26,.14);
  }
  .top { display: flex; align-items: center; gap: 18px; margin-bottom: 8px; }
  .badge {
    width: 56px; height: 56px; border-radius: 16px; flex: none;
    background: linear-gradient(135deg, var(--a), #a855f7);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 30px; font-weight: 800;
  }
  .ttl { font-size: 40px; font-weight: 800; color: #101828; letter-spacing: -.5px; line-height: 1.05; }
  .sub { font-size: 19px; color: #667085; margin: 6px 0 30px; }
  .hr { height: 4px; width: 68px; border-radius: 4px; background: var(--a); margin: 14px 0 30px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 18px 44px; }
  .grid.two { grid-template-columns: 1fr 1fr; }
  .row { display: flex; align-items: flex-start; gap: 16px; break-inside: avoid; }
  .num {
    width: 34px; height: 34px; border-radius: 999px; flex: none; margin-top: 2px;
    background: rgba(255,107,53,.12); color: var(--a);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums;
  }
  .txt { min-width: 0; }
  .lbl { font-size: 22px; font-weight: 700; color: #1d2939; line-height: 1.2; }
  .dsc { font-size: 17px; color: #667085; margin-top: 2px; line-height: 1.25; }
  .foot { margin-top: 34px; font-size: 15px; color: #98a2b3; display: flex; align-items: center; gap: 8px; }
  .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--a); }
</style>
<div id="wrap">
  <div class="top">
    <div class="badge">&#10022;</div>
    <div>
      <div class="ttl" id="ttl"></div>
    </div>
  </div>
  <div class="sub" id="sub"></div>
  <div class="hr"></div>
  <div class="grid" id="grid"></div>
  <div class="foot"><span class="dot"></span><span id="foot"></span></div>
</div>
<script>
  var CFG = window.__CFG__ || {};
  if (CFG.accent) document.documentElement.style.setProperty('--a', CFG.accent);
  function esc(t){return String(t).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  var steps = CFG.steps || CFG.cards || [];
  document.getElementById('ttl').textContent = CFG.title || 'Call-sheet';
  var sub = document.getElementById('sub');
  if (CFG.subtitle) sub.textContent = CFG.subtitle; else sub.style.display = 'none';
  var grid = document.getElementById('grid');
  if (steps.length > 9) grid.classList.add('two');
  steps.forEach(function (s, i) {
    var when = s.when || s.date || s.value || '';
    var desc = s.desc || (when ? String(when) : '');
    var el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = '<div class="num">' + (i + 1) + '</div><div class="txt">' +
      '<div class="lbl">' + esc(s.label || s.title || '') + '</div>' +
      (desc ? '<div class="dsc">' + esc(desc) + '</div>' : '') + '</div>';
    grid.appendChild(el);
  });
  document.getElementById('foot').textContent =
    (CFG.footer || (steps.length + ' shots')) + ' · CreatorHub';
  window.setProgress = function (p) {
    var w = document.getElementById('wrap');
    if (w) { w.style.opacity = Math.min(1, p / 0.25); }
  };
</script>
$callsheet$, 'other', 0, '#ff6b35', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  html=EXCLUDED.html, label=EXCLUDED.label, category=EXCLUDED.category,
  auto_priority=EXCLUDED.auto_priority, accent_default=EXCLUDED.accent_default, updated_at=NOW();
