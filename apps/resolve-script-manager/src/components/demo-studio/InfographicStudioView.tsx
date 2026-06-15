// InfographicStudioView — «studio» inne i Product Demo for å lage animerte
// infographic-overlays UTEN at brukeren rører HTML. Velg et design (galleri,
// «anbefalt — matcher brandet ditt»), fyll enkle felter, se en TYDELIG live-
// preview som spiller animasjonen, sett når den skal dukke opp, og lag + legg
// den i Resolve. AI kan også foreslå hva som passer demoen.

import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { executeScript, systemOpen } from '../../api';
import { useDemoStudio } from './demoStudioStore';
import {
  INFOGRAPHIC_TEMPLATES, INFOGRAPHIC_HTML, buildInfographicConfig,
  type InfographicTemplate,
} from './infographicStudio';

const C = {
  bg: '#f4f6fb', panel: '#fff', ink: '#1f2d4a', soft: '#5b6b7d', line: '#e4e9f2',
  accent: '#2f6df0', faint: '#9aa7bd',
};

/** Hent ut logoens dominante (mest fremtredende, mettede) farge → hex. */
async function dominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = 28;
        const cv = document.createElement('canvas');
        cv.width = s; cv.height = s;
        const ctx = cv.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, s, s);
        const d = ctx.getImageData(0, 0, s, s).data;
        const bins: Record<string, { n: number; r: number; g: number; b: number }> = {};
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]; if (a < 160) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 244 && mn > 240) continue;  // nær-hvit
          if (mx < 24) continue;               // nær-svart
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bn = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
          bn.n++; bn.r += r; bn.g += g; bn.b += b;
        }
        let best: { r: number; g: number; b: number; score: number } | null = null;
        for (const k in bins) {
          const bn = bins[k];
          const r = bn.r / bn.n, g = bn.g / bn.n, b = bn.b / bn.n;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const score = bn.n * (1 + sat / 40);
          if (!best || score > best.score) best = { r, g, b, score };
        }
        if (!best) { resolve(''); return; }
        const hex = '#' + [best.r, best.g, best.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
        resolve(hex);
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

export function InfographicStudioView({ onNav }: { onNav: (id: string) => void }) {
  const project = useDemoStudio((s) => s.project);
  const brandColor = project?.branding?.brandColor || '#2f6df0';
  const [accent, setAccent] = useState<string>(brandColor);
  const [logo, setLogo] = useState<string>(() => {
    const u = project?.branding?.logoUrl;
    return u && u.startsWith('data:') ? u : '';
  });
  const [suggested, setSuggested] = useState<string>('');  // foreslått accent fra logo
  const brand = useMemo(() => ({ accent, ink: '#1f2d4a', logo: logo || undefined }), [accent, logo]);
  const pickLogo = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const url = typeof r.result === 'string' ? r.result : '';
      setLogo(url);
      // Trekk ut logoens dominante farge og foreslå den som accent — så designet
      // støtter logoens branding.
      void dominantColor(url).then((hex) => {
        if (hex && hex.toLowerCase() !== accent.toLowerCase()) setSuggested(hex);
      });
    };
    r.readAsDataURL(file);
  };

  const [tplId, setTplId] = useState<string>(INFOGRAPHIC_TEMPLATES[0].id);
  const tpl: InfographicTemplate = useMemo(
    () => INFOGRAPHIC_TEMPLATES.find((t) => t.id === tplId) || INFOGRAPHIC_TEMPLATES[0],
    [tplId],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [atSec, setAtSec] = useState('4');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const fieldVals = (t: InfographicTemplate) => {
    const out: Record<string, string> = { ...t.defaults };
    for (const f of t.fields) if (values[f.key] !== undefined) out[f.key] = values[f.key];
    return out;
  };
  const config = useMemo(() => buildInfographicConfig(tpl, fieldVals(tpl), brand),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, values, brandColor]);

  // Bygg preview-HTML (config injisert som global) + autoplay-animasjon.
  const srcDoc = useMemo(
    () => `<script>window.__CFG__=${JSON.stringify(config)}</script>` + INFOGRAPHIC_HTML,
    [config],
  );

  const play = () => {
    const win = iframeRef.current?.contentWindow as (Window & { setProgress?: (p: number) => void }) | null | undefined;
    if (!win || typeof win.setProgress !== 'function') return;
    const dur = Math.max(1, tpl.durationSec) * 1000;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      try { win.setProgress!(p); } catch { /* */ }
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };
  // Spill av når preview lastes / config endres.
  const onIframeLoad = () => { window.setTimeout(play, 250); };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const recommendedId = INFOGRAPHIC_TEMPLATES.find((t) => t.style === 'light')?.id;

  const generate = async () => {
    if (busy) return;
    setBusy(true); setMsg('Lager overlay (HTML → transparent video) …');
    try {
      const out = await invoke<string>('render_infographic', {
        html: srcDoc, durationSec: tpl.durationSec, name: `${tpl.id}-${Date.now()}`,
      });
      setMsg('Legger overlayet på Resolve-timelinen …');
      const summary = await executeScript('place_overlay', {
        overlays: [{ path: out, atSec: parseFloat(atSec) || 0, durationSec: tpl.durationSec, track: 2 }],
      });
      const okEvt = summary.events.find((e) => e.type === 'result');
      const errEvt = summary.events.find((e) => e.type === 'error');
      if (!summary.succeeded || errEvt) {
        setMsg('Overlay laget (' + out + '), men kunne ikke legges i Resolve: ' + ((errEvt?.value as { message?: string } | undefined)?.message || 'er Resolve åpen med en timeline?'));
        void systemOpen(out).catch(() => {});
      } else {
        const r = (okEvt?.value ?? {}) as { placed?: number };
        setMsg(`✓ Lagt på timelinen ved ${atSec}s (${r.placed ?? 1} overlay). Åpne Resolve for å se det over opptaket.`);
      }
    } catch (e) {
      setMsg('Feil: ' + (e instanceof Error ? e.message : String(e)) + ' — render_infographic-kommandoen krever ny app-versjon.');
    } finally {
      setBusy(false);
    }
  };

  const inp: React.CSSProperties = { width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', colorScheme: 'light', color: C.ink };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, cursor: 'pointer', fontSize: 13, fontWeight: 600 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.ink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${C.line}`, background: '#fff' }}>
        <button style={btn} onClick={() => onNav('flow')}>← Tilbake</button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>◷ Infographic Studio</div>
        <div style={{ fontSize: 12, color: C.soft }}>Lag animerte data-overlays — ingen design­erfaring nødvendig</div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Venstre: galleri + felter */}
        <div style={{ width: 360, borderRight: `1px solid ${C.line}`, overflowY: 'auto', padding: 16, background: '#fbfcfe' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Velg design</div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            {INFOGRAPHIC_TEMPLATES.map((t) => {
              const sel = t.id === tplId;
              return (
                <button key={t.id} onClick={() => { setTplId(t.id); }}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${sel ? C.accent : C.line}`, background: sel ? '#eef4ff' : '#fff', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: '#eef4ff', display: 'grid', placeItems: 'center', fontSize: 20, color: C.accent }}>{t.glyph}</div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.soft, marginTop: 6, lineHeight: 1.4 }}>{t.desc}</div>
                  {t.id === recommendedId && (
                    <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, color: '#0c8f6f', background: '#e3f5f1', padding: '3px 8px', borderRadius: 20 }}>Anbefalt · matcher brandet</div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Innhold</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {tpl.fields.map((f) => (
              <label key={f.key} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: C.soft }}>{f.label}</span>
                <input style={inp} placeholder={f.placeholder}
                  value={values[f.key] ?? tpl.defaults[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </label>
            ))}
          </div>

          {/* Logo & brand */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>Logo & brand</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 64, height: 44, borderRadius: 8, border: `1px solid ${C.line}`, background: '#1b2330', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }}>
              {logo ? <img src={logo} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: 10, color: C.faint }}>ingen</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...btn, fontSize: 12, padding: '6px 12px', display: 'inline-block' }}>
                Last opp logo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickLogo(e.target.files?.[0] || null)} />
              </label>
              {logo && <button style={{ ...btn, fontSize: 11, padding: '4px 10px' }} onClick={() => setLogo('')}>Fjern logo</button>}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>PNG med gjennomsiktig bakgrunn anbefales. Brukes i bar/kort + matcher brand-fargen.</div>

          {/* Brand-farge + forslag fra logo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              style={{ width: 38, height: 30, border: `1px solid ${C.line}`, borderRadius: 7, background: '#fff', cursor: 'pointer', padding: 0 }} />
            <span style={{ fontSize: 12, color: C.soft }}>Brand-farge <b style={{ color: C.ink }}>{accent}</b></span>
          </label>
          {suggested && suggested.toLowerCase() !== accent.toLowerCase() && (
            <div style={{ marginTop: 10, border: `1px solid ${C.line}`, background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: suggested, border: `1px solid ${C.line}`, flex: 'none' }} />
                <div style={{ fontSize: 11.5, color: C.soft, lineHeight: 1.35 }}>Logoen din ser ut til å bruke <b style={{ color: C.ink }}>{suggested}</b>. Vil du la designet støtte den?</div>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                <button style={{ ...btn, padding: '5px 12px', fontSize: 12, background: suggested, color: '#fff', border: 'none' }}
                  onClick={() => { setAccent(suggested); setSuggested(''); }}>Bruk logoens farge</button>
                <button style={{ ...btn, padding: '5px 10px', fontSize: 12 }} onClick={() => setSuggested('')}>Behold</button>
              </div>
            </div>
          )}
        </div>

        {/* Høyre: TYDELIG preview + handlinger */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 18, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Slik blir det</div>
          {/* preview på mørk bakgrunn (slik det legges over video) */}
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}`, background: '#1b2330', minHeight: 320, display: 'grid', placeItems: 'center' }}>
            <iframe ref={iframeRef} title="preview" srcDoc={srcDoc} onLoad={onIframeLoad}
              style={{ width: '100%', height: 360, border: 0, background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button style={btn} onClick={play}>▶ Spill av preview</button>
            <span style={{ fontSize: 12, color: C.soft }}>Transparent — legges over opptaket i Resolve.</span>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11.5, color: C.soft }}>Dukker opp ved (sek)</span>
              <input style={{ ...inp, width: 120 }} type="number" min="0" step="0.5" value={atSec} onChange={(e) => setAtSec(e.target.value)} />
            </label>
            <button style={{ ...btn, background: busy ? '#e7ecf5' : C.accent, color: busy ? C.soft : '#fff', border: 'none', padding: '11px 18px', fontSize: 14 }}
              disabled={busy} onClick={() => void generate()}>
              {busy ? 'Lager …' : '◆ Lag + legg i Resolve'}
            </button>
          </div>
          {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('Feil') ? '#c4453b' : C.soft, marginTop: 12, lineHeight: 1.5 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
