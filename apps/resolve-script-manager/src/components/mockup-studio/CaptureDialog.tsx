/**
 * CaptureDialog — guidet «Fang fra URL» (§3 skjerm 5).
 *
 * Rikere enn hurtig-fangsten i sidepanelet: hent alle skjermbilder (desktop-
 * scroll-bånd + mobil), velg ett, se det FORHÅNDSVIST i mål-enhetens ramme
 * (nøyaktig slik det beskjæres), velg enhet, og sett inn. Smart-crop-fokus
 * settes automatisk av store.setDeviceImage.
 */

import { useState } from 'react';
import { DEVICE_FRAMES, type FrameVariant } from '../demo-studio/deviceFrames';
import { captureSiteShots, type CapturedShot } from './mockupCapture';
import { useMockupStudio } from './mockupStudioStore';
import { type MockupDeviceVariant } from './mockupStudioModel';

const C = {
  overlay: 'rgba(6,8,13,0.72)', card: '#12151f', soft: '#171b28', border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8', inkSoft: '#9aa0b4', accent: '#22d3ee', accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

const DEV_LABEL: Record<MockupDeviceVariant, string> = {
  macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad (liggende)', iphone: 'iPhone', watch: 'Apple Watch',
  android: 'Android', browser: 'Nettleser', tablet: 'Nettbrett',
};

/** Forhåndsvis et skjermbilde slik det beskjæres inn i en enhets-skjerm. */
export function DevicePreview({ variant, shot }: { variant: MockupDeviceVariant; shot?: string }) {
  const bg = shot ? { backgroundImage: `url(${shot})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#0c0e16' };
  if (variant === 'watch') {
    return (
      <div style={{ width: 150, aspectRatio: '0.84', margin: '0 auto', background: 'linear-gradient(135deg,#2c2f35,#141519)', borderRadius: '30%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '76%', height: '76%', borderRadius: '26%', overflow: 'hidden', ...bg }} />
      </div>
    );
  }
  const f = DEVICE_FRAMES[variant as FrameVariant];
  return (
    <div style={{ position: 'relative', width: f.aspect >= 1 ? 280 : 200, aspectRatio: String(f.aspect), margin: '0 auto' }}>
      <img src={f.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', left: `${f.screen.x * 100}%`, top: `${f.screen.y * 100}%`, width: `${f.screen.w * 100}%`, height: `${f.screen.h * 100}%`, borderRadius: `${f.radius * 100}%`, overflow: 'hidden', ...bg }} />
    </div>
  );
}

export function CaptureDialog({ onClose }: { onClose: () => void }) {
  const doc = useMockupStudio((s) => s.doc);
  const setDeviceImage = useMockupStudio((s) => s.setDeviceImage);
  const [url, setUrl] = useState('');
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [selShot, setSelShot] = useState<CapturedShot | null>(null);
  const [target, setTarget] = useState<string | null>(doc.devices[0]?.id ?? null);

  const targetDev = doc.devices.find((d) => d.id === target) ?? doc.devices[0] ?? null;

  const fang = async () => {
    setNote(null); if (!url.trim()) return;
    setBusy(true);
    try {
      const list = await captureSiteShots(url);
      setShots(list);
      setSelShot(list[0] ?? null);
      setNote(list.length ? `${list.length} skjermbilder fanget.` : 'Fant ingen skjermbilder — sjekk URL-en.');
    } catch (e) { setNote('Fangst feilet: ' + String(e)); }
    finally { setBusy(false); }
  };

  const insert = () => {
    if (!selShot || !targetDev) return;
    setDeviceImage(targetDev.id, selShot.dataUrl);
    setNote(`✓ Satt inn i ${DEV_LABEL[targetDev.variant]}.`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 820, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, flex: 1 }}>Fang skjermbilde fra nettside</h2>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void fang(); }} placeholder="app.eksempel.no/dashboard" style={{ ...input, flex: 1 }} />
          <button onClick={() => void fang()} disabled={busy || !url.trim()} style={{ ...primary, opacity: busy || !url.trim() ? 0.6 : 1 }}>{busy ? 'Fanger…' : 'Åpne forhåndsvisning'}</button>
        </div>
        <div style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 12 }}>Cookie-bannere fjernes automatisk. Desktop- og mobil-bånd fanges.</div>

        {note && <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>{note}</div>}

        {shots.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
            {/* Galleri */}
            <div>
              <div style={sectionLbl}>Fangede bånd</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                {shots.map((s, i) => (
                  <button key={i} onClick={() => setSelShot(s)} title={s.label}
                    style={{ padding: 0, border: `2px solid ${selShot === s ? C.accent : C.border}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: C.soft }}>
                    <img src={s.dataUrl} alt={s.label} style={{ width: '100%', height: 90, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                    <div style={{ fontSize: 10.5, color: C.inkSoft, padding: '3px 4px' }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Forhåndsvisning i enhet + innsetting */}
            <div>
              <div style={sectionLbl}>Forhåndsvis i enhet</div>
              {doc.devices.length === 0 ? (
                <div style={{ fontSize: 13, color: C.inkSoft }}>Legg til en enhet på lerretet først.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {doc.devices.map((d) => (
                      <button key={d.id} onClick={() => setTarget(d.id)} style={{ ...chip, background: target === d.id ? C.accent : C.soft, color: target === d.id ? C.accentInk : C.ink }}>{DEV_LABEL[d.variant]}</button>
                    ))}
                  </div>
                  <div style={{ background: '#0b0d13', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    {targetDev && <DevicePreview variant={targetDev.variant} shot={selShot?.dataUrl} />}
                  </div>
                  <button onClick={insert} disabled={!selShot || !targetDev} style={{ ...primary, width: '100%' }}>Sett inn i {targetDev ? DEV_LABEL[targetDev.variant] : 'enhet'}</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sectionLbl: React.CSSProperties = { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 10, fontWeight: 700 };
const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const input: React.CSSProperties = { background: C.soft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 14, fontFamily: C.font, boxSizing: 'border-box' };
const chip: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 16, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: C.font };

export default CaptureDialog;
