// InfographicStudioView — «Infographic Studio» inne i Product Demo.
// Multi-scene studio: flere scener i ett prosjekt (hver med egen mal + data +
// tidspunkt), galleri, live-preview, Brand Kit (logo + farge-forslag), og
// «Send to Resolve» som rendrer ALLE scener til transparent ProRes 4444 og
// legger dem på overlay-spor ved riktig tid. Brukeren rører ALDRI HTML.

import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { executeScript, systemOpen } from '../../api';
import { useDemoStudio } from './demoStudioStore';
import {
  INFOGRAPHIC_TEMPLATES, htmlForTemplate, buildInfographicConfig,
  type InfographicTemplate,
} from './infographicStudio';

const D = {
  bg: '#0e1320', panel: '#141b2b', panel2: '#1b2436', line: '#27314a',
  ink: '#e8eefc', soft: '#8a98b5', faint: '#5d6b88', accent: '#3b82f6', teal: '#2dd4bf',
};
const ANIM_PRESETS = [{ id: 'fadeUp', label: 'Fade Up' }, { id: 'scaleIn', label: 'Scale In' }, { id: 'slideLeft', label: 'Slide Left' }];
const EASINGS = ['Ease Out Cubic', 'Ease In Out', 'Linear', 'Spring'];

interface Scene { id: string; tplId: string; values: Record<string, string>; atSec: number }
let _sid = 1;
const newScene = (tplId: string, atSec: number): Scene => ({ id: `s${_sid++}`, tplId, values: {}, atSec });

async function dominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = 28; const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
        const ctx = cv.getContext('2d'); if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, s, s);
        const d = ctx.getImageData(0, 0, s, s).data;
        const bins: Record<string, { n: number; r: number; g: number; b: number }> = {};
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]; if (a < 160) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 244 && mn > 240) continue; if (mx < 24) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bn = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
          bn.n++; bn.r += r; bn.g += g; bn.b += b;
        }
        let best: { r: number; g: number; b: number; score: number } | null = null;
        for (const k in bins) {
          const bn = bins[k]; const r = bn.r / bn.n, g = bn.g / bn.n, b = bn.b / bn.n;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const score = bn.n * (1 + sat / 40);
          if (!best || score > best.score) best = { r, g, b, score };
        }
        if (!best) { resolve(''); return; }
        resolve('#' + [best.r, best.g, best.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''));
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

export function InfographicStudioView({ onNav }: { onNav: (id: string) => void }) {
  const project = useDemoStudio((s) => s.project);
  const [scenes, setScenes] = useState<Scene[]>([newScene(INFOGRAPHIC_TEMPLATES[0].id, 0)]);
  const [sel, setSel] = useState(0);
  const scene = scenes[sel] || scenes[0];
  const tpl: InfographicTemplate = useMemo(
    () => INFOGRAPHIC_TEMPLATES.find((t) => t.id === scene.tplId) || INFOGRAPHIC_TEMPLATES[0], [scene.tplId]);

  const [accent, setAccent] = useState<string>(project?.branding?.brandColor || '#3b82f6');
  const [logo, setLogo] = useState<string>(() => { const u = project?.branding?.logoUrl; return u && u.startsWith('data:') ? u : ''; });
  const [suggested, setSuggested] = useState('');
  const [rightTab, setRightTab] = useState<'Design' | 'Animate' | 'Data'>('Data');
  const [leftSec, setLeftSec] = useState<'templates' | 'brand' | 'export'>('templates');
  const [palette, setPalette] = useState<string[]>(['#2dd4bf', '#3b82f6', '#ffffff', '#1f2d4a', '#f59e0b', '#a855f7']);
  const [easing, setEasing] = useState(EASINGS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateScene = (patch: Partial<Scene>) => setScenes((ss) => ss.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  const setValue = (k: string, v: string) => updateScene({ values: { ...scene.values, [k]: v } });
  const pickTemplate = (id: string) => updateScene({ tplId: id });
  const addScene = () => {
    const last = scenes[scenes.length - 1];
    const lastTpl = INFOGRAPHIC_TEMPLATES.find((t) => t.id === last.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const at = last.atSec + (lastTpl.durationSec || 5);
    setScenes((ss) => [...ss, newScene(INFOGRAPHIC_TEMPLATES[0].id, at)]);
    setSel(scenes.length);
  };
  const deleteScene = (i: number) => {
    if (scenes.length <= 1) return;
    setScenes((ss) => ss.filter((_, j) => j !== i));
    setSel((s) => Math.max(0, Math.min(s, scenes.length - 2)));
  };

  const fieldVals = (sc: Scene, t: InfographicTemplate) => {
    const out: Record<string, string> = { ...t.defaults };
    for (const f of t.fields) if (sc.values[f.key] !== undefined) out[f.key] = sc.values[f.key];
    return out;
  };
  const config = useMemo(() => buildInfographicConfig(tpl, fieldVals(scene, tpl), { accent, ink: '#1f2d4a', logo: logo || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, scene, accent, logo]);
  const srcDoc = useMemo(() => `<script>window.__CFG__=${JSON.stringify(config)}</script>` + htmlForTemplate(tpl), [config, tpl]);

  const play = () => {
    const win = iframeRef.current?.contentWindow as (Window & { setProgress?: (p: number) => void }) | null | undefined;
    if (!win || typeof win.setProgress !== 'function') return;
    const dur = Math.max(1, tpl.durationSec) * 1000, t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      try { win.setProgress!(p); } catch { /* */ }
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };
  const onIframeLoad = () => { window.setTimeout(play, 250); };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const pickLogo = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const url = typeof r.result === 'string' ? r.result : ''; setLogo(url);
      void dominantColor(url).then((hex) => { if (hex && hex.toLowerCase() !== accent.toLowerCase()) setSuggested(hex); });
    };
    r.readAsDataURL(file);
  };
  const recommendedId = INFOGRAPHIC_TEMPLATES.find((t) => t.style === 'light')?.id;

  const sendToResolve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const overlays: Array<Record<string, unknown>> = [];
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
        const cfg = buildInfographicConfig(t, fieldVals(sc, t), { accent, ink: '#1f2d4a', logo: logo || undefined });
        const html = `<script>window.__CFG__=${JSON.stringify(cfg)}</script>` + htmlForTemplate(t);
        setMsg(`Rendrer scene ${i + 1}/${scenes.length} (${t.name}) …`);
        const out = await invoke<string>('render_infographic', { html, durationSec: t.durationSec, name: `${t.id}-${sc.id}-${Date.now()}` });
        overlays.push({ path: out, atSec: sc.atSec, durationSec: t.durationSec, track: 2 });
      }
      setMsg('Sender alle scener til Resolve …');
      const summary = await executeScript('place_overlay', { overlays });
      const errEvt = summary.events.find((e) => e.type === 'error');
      if (!summary.succeeded || errEvt) {
        setMsg('Rendret, men kunne ikke legges i Resolve: ' + ((errEvt?.value as { message?: string } | undefined)?.message || 'er Resolve åpen med en timeline?'));
        if (overlays[0]?.path) void systemOpen(String(overlays[0].path)).catch(() => {});
      } else { setMsg(`✓ ${scenes.length} scene(r) sendt til Resolve, plassert på overlay-spor til riktig tid.`); }
    } catch (e) {
      setMsg('Feil: ' + (e instanceof Error ? e.message : String(e)) + ' — krever Playwright-runtime (kjør «Sett opp Playwright»).');
    } finally { setBusy(false); }
  };

  const railItem = (active: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderLeft: `3px solid ${active ? D.accent : 'transparent'}`, fontSize: 13 });
  const topBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
  const inp: React.CSSProperties = { width: '100%', fontSize: 12.5, padding: '7px 9px', borderRadius: 7, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, colorScheme: 'dark' };
  const tabBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '7px 0', textAlign: 'center', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderBottom: `2px solid ${active ? D.accent : 'transparent'}` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: D.bg, color: D.ink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${D.line}`, background: D.panel }}>
        <button style={{ ...topBtn, border: 'none', background: 'transparent', color: D.soft }} onClick={() => onNav('flow')}>←</button>
        <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: D.accent }}>▥</span> Infographic Studio</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: D.soft }}>{project?.name || 'Uten navn'} · {scenes.length} scene(r)</div>
        <button style={topBtn} onClick={play}>▶ Preview</button>
        <button style={topBtn} onClick={addScene}>＋ New Scene</button>
        <button style={{ ...topBtn, background: D.accent, border: 'none', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void sendToResolve()}>✦ {busy ? 'Sender …' : 'Send to Resolve'}</button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Rail */}
        <div style={{ width: 178, borderRight: `1px solid ${D.line}`, background: D.panel, paddingTop: 8, display: 'flex', flexDirection: 'column' }}>
          <div style={railItem(leftSec === 'templates')} onClick={() => setLeftSec('templates')}>▦ Templates <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.length}</span></div>
          <div style={railItem(false)} title="Kommer">▤ Charts <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>snart</span></div>
          <div style={railItem(false)} title="Kommer">◷ Icons <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>snart</span></div>
          <div style={railItem(leftSec === 'brand')} onClick={() => setLeftSec('brand')}>◆ Brand Kit</div>
          <div style={railItem(leftSec === 'export')} onClick={() => setLeftSec('export')}>⤓ Export</div>
          <div style={{ flex: 1 }} />
          {logo && <img src={logo} alt="" style={{ maxWidth: 120, maxHeight: 40, margin: '0 auto 14px', opacity: 0.9 }} />}
        </div>

        {/* Sekundær-panel */}
        <div style={{ width: 280, borderRight: `1px solid ${D.line}`, overflowY: 'auto', padding: 14, background: D.panel }}>
          {leftSec === 'templates' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Templates <span style={{ color: D.faint, fontWeight: 500 }}>· endrer scene {sel + 1}</span></div>
            <div style={{ display: 'grid', gap: 9 }}>
              {INFOGRAPHIC_TEMPLATES.map((t) => {
                const selT = t.id === scene.tplId;
                return (
                  <button key={t.id} onClick={() => pickTemplate(t.id)} style={{ textAlign: 'left', padding: 11, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${selT ? D.accent : D.line}`, background: selT ? D.panel2 : D.bg, color: D.ink, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: D.panel2, display: 'grid', placeItems: 'center', fontSize: 18, color: t.style === 'hud' ? D.teal : D.accent }}>{t.glyph}</div>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{t.name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: D.soft, marginTop: 5, lineHeight: 1.35 }}>{t.desc}</div>
                    {t.id === recommendedId && <div style={{ position: 'absolute', top: 9, right: 9, fontSize: 9.5, fontWeight: 700, color: D.teal, background: 'rgba(45,212,191,.14)', padding: '2px 7px', borderRadius: 20 }}>Anbefalt</div>}
                  </button>
                );
              })}
            </div>
          </>)}
          {leftSec === 'brand' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Brand Kit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 64, height: 44, borderRadius: 8, border: `1px solid ${D.line}`, background: D.bg, display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }}>
                {logo ? <img src={logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: 10, color: D.faint }}>ingen</span>}
              </div>
              <label style={{ ...topBtn, fontSize: 12 }}>Last opp logo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickLogo(e.target.files?.[0] || null)} /></label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 36, height: 28, border: `1px solid ${D.line}`, borderRadius: 6, background: D.bg, padding: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: D.soft }}>Brand-farge <b style={{ color: D.ink }}>{accent}</b></span>
            </label>
            {suggested && suggested.toLowerCase() !== accent.toLowerCase() && (
              <div style={{ border: `1px solid ${D.line}`, background: D.bg, borderRadius: 9, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, background: suggested, flex: 'none' }} />
                  <div style={{ fontSize: 11, color: D.soft, lineHeight: 1.35 }}>Logoen bruker <b style={{ color: D.ink }}>{suggested}</b>. La designet støtte den?</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={{ ...topBtn, padding: '4px 11px', fontSize: 11.5, background: suggested, border: 'none' }} onClick={() => { setAccent(suggested); setSuggested(''); }}>Bruk farge</button>
                  <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11.5 }} onClick={() => setSuggested('')}>Behold</button>
                </div>
              </div>
            )}
          </>)}
          {leftSec === 'export' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Export</div>
            <div style={{ fontSize: 12, color: D.soft, lineHeight: 1.5 }}>Format: <b style={{ color: D.ink }}>Apple ProRes 4444</b> (alfa)<br />Bakgrunn: <b style={{ color: D.ink }}>Transparent</b><br />Alle {scenes.length} scener rendres + plasseres på timelinen med <b style={{ color: D.ink }}>Send to Resolve</b>.</div>
          </>)}
        </div>

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: D.faint, marginBottom: 8 }}>Canvas · scene {sel + 1} av {scenes.length} ({tpl.name}) · transparent overlay</div>
            <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${D.line}`, background: 'linear-gradient(135deg,#10182a,#0b1120)', display: 'grid', placeItems: 'center' }}>
              <iframe ref={iframeRef} title="preview" srcDoc={srcDoc} onLoad={onIframeLoad} style={{ width: '100%', height: '100%', minHeight: 280, border: 0, background: 'transparent' }} />
            </div>
          </div>
          {/* Scene-stripe (multi-scene) */}
          <div style={{ borderTop: `1px solid ${D.line}`, background: D.panel, padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={topBtn} onClick={play}>▶</button>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
                {scenes.map((sc, i) => {
                  const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
                  const active = i === sel;
                  return (
                    <div key={sc.id} onClick={() => setSel(i)} style={{ width: 104, flex: 'none', borderRadius: 9, border: `2px solid ${active ? D.accent : D.line}`, background: active ? D.panel2 : D.bg, cursor: 'pointer', padding: '8px 9px', position: 'relative' }}>
                      <div style={{ fontSize: 10, color: D.faint }}>Scene {i + 1} · {sc.atSec}s</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 15, color: t.style === 'hud' ? D.teal : D.accent }}>{t.glyph}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      </div>
                      {scenes.length > 1 && <button onClick={(e) => { e.stopPropagation(); deleteScene(i); }} style={{ position: 'absolute', top: 4, right: 5, border: 'none', background: 'transparent', color: D.faint, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
                    </div>
                  );
                })}
                <div onClick={addScene} style={{ width: 56, flex: 'none', borderRadius: 9, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', fontSize: 20, color: D.faint, cursor: 'pointer' }} title="Ny scene">＋</div>
              </div>
              <label style={{ fontSize: 12, color: D.soft, display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>Dukker opp ved
                <input style={{ ...inp, width: 64 }} type="number" min="0" step="0.5" value={scene.atSec} onChange={(e) => updateScene({ atSec: parseFloat(e.target.value) || 0 })} /> s</label>
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.startsWith('Feil') ? '#f08a82' : D.soft, padding: '8px 16px', borderTop: `1px solid ${D.line}`, background: D.panel }}>{msg}</div>}
        </div>

        {/* Høyre: Design / Animate / Data */}
        <div style={{ width: 280, borderLeft: `1px solid ${D.line}`, background: D.panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${D.line}` }}>
            {(['Design', 'Animate', 'Data'] as const).map((t) => <div key={t} style={tabBtn(rightTab === t)} onClick={() => setRightTab(t)}>{t}</div>)}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {rightTab === 'Data' && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 10 }}>Innhold · scene {sel + 1}</div>
              <div style={{ display: 'grid', gap: 9 }}>
                {tpl.fields.map((f) => (
                  <label key={f.key} style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 11, color: D.soft }}>{f.label}</span>
                    <input style={inp} placeholder={f.placeholder} value={scene.values[f.key] ?? tpl.defaults[f.key] ?? ''} onChange={(e) => setValue(f.key, e.target.value)} />
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', margin: '16px 0 8px' }}>Transparency / Export</div>
              <div style={{ fontSize: 12, color: D.soft, lineHeight: 1.5 }}>Background: <b style={{ color: D.ink }}>Transparent</b> · Format: <b style={{ color: D.ink }}>ProRes 4444</b></div>
            </>)}
            {rightTab === 'Design' && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Color Palette</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {palette.map((c, i) => (
                  <button key={i} onClick={() => setAccent(c)} title={c} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: `2px solid ${accent.toLowerCase() === c.toLowerCase() ? D.ink : D.line}`, cursor: 'pointer' }} />
                ))}
                <label style={{ width: 30, height: 30, borderRadius: 8, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', color: D.soft, cursor: 'pointer' }}>＋
                  <input type="color" style={{ display: 'none' }} onChange={(e) => { setPalette((p) => [...p, e.target.value]); setAccent(e.target.value); }} />
                </label>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Typography</div>
              <div style={{ fontSize: 12, color: D.soft }}>Inter · Semi Bold <span style={{ color: D.faint }}>(brand-font kommer)</span></div>
            </>)}
            {rightTab === 'Animate' && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Animation Presets</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {ANIM_PRESETS.map((a) => <div key={a.id} style={{ flex: 1, padding: '12px 6px', borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg, textAlign: 'center', fontSize: 11, color: D.soft, cursor: 'pointer' }} onClick={play}>{a.label}</div>)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Easing</div>
              <select style={inp} value={easing} onChange={(e) => setEasing(e.target.value)}>{EASINGS.map((e) => <option key={e} value={e}>{e}</option>)}</select>
              <div style={{ fontSize: 10.5, color: D.faint, marginTop: 8, lineHeight: 1.4 }}>Animasjonen er innebygd i malen (count-up, vekst, stagger). Per-element-styring kommer.</div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
