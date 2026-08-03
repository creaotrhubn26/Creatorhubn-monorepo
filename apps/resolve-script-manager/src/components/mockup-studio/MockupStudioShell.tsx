/**
 * MockupStudioShell — editor-skall for Mockup Studio (P1).
 *
 * Mørk editor-chrome: topplinje (tilbake · navn · mal · Last ned PNG),
 * venstre verktøykolonne (legg til enheter/tekst), midtstilt lerret-preview,
 * høyre kontekst-sensitiv inspektør. WYSIWYG via delt rasterisator; eksport
 * gjenbruker Tauri-fil-dialogen + demoWriteBinary (samme som Demo Studio).
 *
 * Modul-gating (demo_studio) skjer i App.tsx før dette montes.
 */

import { useEffect, useRef, useState } from 'react';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { demoWriteBinary } from '../../api';
import { MockupCanvas } from './MockupCanvas';
import { rasterizeToPngDataUrl } from './mockupRaster';
import { buildPdfBase64 } from './mockupExport';
import { buildPsdBase64 } from './mockupPsd';
import { buildEditablePsdViaBridge, isBridgeConnected } from './mockupPhotoshop';
import { useMockupStudio } from './mockupStudioStore';
import {
  MOCKUP_TEMPLATES,
  safeDocName,
  type MockupDeviceVariant,
  type MockupTextRole,
} from './mockupStudioModel';
import {
  captureSiteShots,
  bestShotForVariant,
  extractAccentFromImage,
  isCaptureReady,
  installCaptureEngine,
  hostnameOf,
  type CapturedShot,
} from './mockupCapture';

// Lokal palett (mørk editor-chrome) — samme inline-mønster som demo-studio.
const C = {
  bg: '#0b0d13',
  panel: '#12151f',
  panelSoft: '#171b28',
  border: 'rgba(255,255,255,0.08)',
  ink: '#eef1f8',
  inkSoft: '#9aa0b4',
  accent: '#22d3ee',
  accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

const DEVICE_LABELS: Record<MockupDeviceVariant, string> = {
  macbook: 'MacBook',
  ipad: 'iPad',
  ipad_landscape: 'iPad (liggende)',
  iphone: 'iPhone',
};

const TEXT_ROLE_LABELS: Record<MockupTextRole, string> = {
  eyebrow: 'Etikett',
  title: 'Overskrift',
  body: 'Brødtekst',
  tag: 'Liten tekst',
};

export function MockupStudioShell({ onClose }: { onClose: () => void }) {
  const doc = useMockupStudio((s) => s.doc);
  const selection = useMockupStudio((s) => s.selection);
  const store = useMockupStudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // URL-capture (P2)
  const [url, setUrl] = useState('');
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let alive = true;
    isCaptureReady().then((ok) => { if (alive) setEngineReady(ok); });
    return () => { alive = false; };
  }, []);

  const selectedDevice = selection.kind === 'device' ? doc.devices.find((d) => d.id === selection.id) ?? null : null;
  const selectedText = selection.kind === 'text' ? doc.texts.find((t) => t.id === selection.id) ?? null : null;

  const triggerUpload = (deviceId: string) => {
    setPendingDeviceId(deviceId);
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // tillat re-opplasting av samme fil
    if (!file || !pendingDeviceId) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') store.setDeviceImage(pendingDeviceId, reader.result);
      setPendingDeviceId(null);
    };
    reader.readAsDataURL(file);
  };

  // Fyll hver enhet med sitt best-egnede skjermbilde (mobil→iPhone, ellers desktop).
  const autoFill = (list: CapturedShot[]) => {
    for (const dev of doc.devices) {
      const shot = bestShotForVariant(list, dev.variant);
      if (shot) store.setDeviceImage(dev.id, shot.dataUrl);
    }
  };

  const runCapture = async () => {
    setCaptureNote(null);
    if (!url.trim()) return;
    if (engineReady === false) { setCaptureNote('Installer capture-motoren først.'); return; }
    setCapturing(true);
    try {
      const list = await captureSiteShots(url);
      setShots(list);
      if (list.length === 0) {
        setCaptureNote('Fant ingen skjermbilder — sjekk URL-en.');
      } else {
        autoFill(list);
        const host = hostnameOf(url);
        if (host && (doc.name === 'Ny mockup' || !doc.name.trim())) store.setName(host);
        setCaptureNote(`✓ ${list.length} skjermbilder hentet og fordelt på enhetene.`);
      }
    } catch (e) {
      setCaptureNote('Capture feilet: ' + String(e));
    } finally {
      setCapturing(false);
    }
  };

  const assignShot = (shot: CapturedShot) => {
    if (selection.kind === 'device') {
      store.setDeviceImage(selection.id, shot.dataUrl);
      setCaptureNote(null);
    } else {
      setCaptureNote('Velg en enhet i lerretet først, så klikk et skjermbilde.');
    }
  };

  const applyAccentFromSite = async () => {
    const src = shots.find((s) => s.viewport === 'desktop') ?? shots[0];
    if (!src) return;
    setCaptureNote('Analyserer sidefarge…');
    const hex = await extractAccentFromImage(src.dataUrl);
    if (hex) { store.patchCanvas({ accent: hex }); setCaptureNote(`✓ Accent satt til sidefargen (${hex}).`); }
    else setCaptureNote('Fant ingen tydelig accent-farge i skjermbildet.');
  };

  const installEngine = async () => {
    setInstalling(true);
    setCaptureNote('Installerer capture-motor (kan ta et par minutter)…');
    try {
      const ok = await installCaptureEngine();
      setEngineReady(ok);
      setCaptureNote(ok ? '✓ Capture-motor klar.' : 'Installasjon fullførte ikke — prøv igjen.');
    } catch (e) {
      setCaptureNote('Installasjon feilet: ' + String(e));
    } finally {
      setInstalling(false);
    }
  };

  const missingShots = doc.devices.filter((d) => !d.image).length;

  // Ekte redigerbar PSD via Photoshop-broen (smart-objekter + tekst-lag).
  const exportEditablePsd = async () => {
    setExportMsg(null);
    setExporting(true);
    try {
      if (!(await isBridgeConnected())) {
        setExportMsg('Koble til Photoshop-broen først (Photoshop-fanen → last UXP-pluginen).');
        setExporting(false);
        return;
      }
      const path = await saveFileDialog({
        defaultPath: `${safeDocName(doc.name)}.psd`,
        filters: [{ name: 'PSD', extensions: ['psd'] }],
      });
      if (typeof path !== 'string') { setExporting(false); return; }
      const res = await buildEditablePsdViaBridge(doc, path);
      setExportMsg(`✓ Redigerbar PSD bygget i Photoshop (${res.layers} lag): ${res.output_path}`);
      void openPath(res.output_path).catch(() => {});
    } catch (err) {
      setExportMsg('Photoshop-eksport feilet: ' + String(err));
    } finally {
      setExporting(false);
    }
  };

  const runExport = async (kind: 'png' | 'pdf' | 'psd') => {
    setExportMsg(null);
    setExporting(true);
    try {
      const data =
        kind === 'png' ? await rasterizeToPngDataUrl(doc, 1)
        : kind === 'pdf' ? await buildPdfBase64(doc)
        : await buildPsdBase64(doc);
      const ext = kind;
      const path = await saveFileDialog({
        defaultPath: `${safeDocName(doc.name)}.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (typeof path !== 'string') { setExporting(false); return; }
      const saved = await demoWriteBinary(path, data);
      setExportMsg(`✓ Lagret: ${saved}`);
      void openPath(saved).catch(() => {});
    } catch (err) {
      setExportMsg('Kunne ikke eksportere: ' + String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: C.font, minHeight: 0 }}>
      {/* Topplinje */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={ghostBtn}>← Home</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Mockup Studio</span>
        <input
          value={doc.name}
          onChange={(e) => store.setName(e.target.value)}
          style={{ ...textInput, width: 220 }}
          placeholder="Navn på mockup"
        />
        <select
          value=""
          onChange={(e) => { if (e.target.value) store.newFromTemplate(e.target.value); }}
          style={{ ...textInput, width: 180 }}
          title="Start fra mal (erstatter gjeldende)"
        >
          <option value="">Ny fra mal…</option>
          {MOCKUP_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {exportMsg && <span style={{ fontSize: 12, color: C.inkSoft, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exportMsg}</span>}
        {!exportMsg && missingShots > 0 && <span style={{ fontSize: 12, color: '#e0b060' }} title="Last opp eller hent skjermbilder">{missingShots} enhet{missingShots > 1 ? 'er' : ''} uten skjermbilde</span>}
        <span style={{ fontSize: 11, color: C.inkSoft }}>Eksporter:</span>
        <button onClick={() => void runExport('png')} disabled={exporting} style={primaryBtn} title="PNG-bilde">PNG</button>
        <button onClick={() => void runExport('pdf')} disabled={exporting} style={ghostBtn} title="PDF-dokument (én side)">PDF</button>
        <button onClick={() => void runExport('psd')} disabled={exporting} style={ghostBtn} title="Lagdelt Photoshop-fil (rasterlag per enhet/tekst) — fungerer uten Photoshop åpent">PSD</button>
        <button onClick={() => void exportEditablePsd()} disabled={exporting} style={ghostBtn} title="Ekte redigerbar PSD via Photoshop-broen: enheter som smart-objekter + redigerbare tekst-lag (riktig font/farge). Krever tilkoblet UXP-plugin.">PSD ✎</button>
      </div>

      {/* Kropp: verktøy · lerret · inspektør */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Venstre: nettside-capture + legg til */}
        <div style={{ width: 220, borderRight: `1px solid ${C.border}`, padding: 14, overflowY: 'auto', flexShrink: 0 }}>
          <SectionLabel>Fra nettside</SectionLabel>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runCapture(); }}
            placeholder="leadgrid.no"
            style={{ ...textInput, marginBottom: 6 }}
          />
          <button onClick={() => void runCapture()} disabled={capturing || !url.trim()} style={{ ...primaryBtn, width: '100%', opacity: capturing || !url.trim() ? 0.6 : 1 }}>
            {capturing ? 'Henter…' : 'Hent skjermbilder'}
          </button>
          {engineReady === false && (
            <button onClick={() => void installEngine()} disabled={installing} style={{ ...listBtn, marginTop: 6 }}>
              {installing ? 'Installerer…' : 'Installer capture-motor'}
            </button>
          )}
          {captureNote && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8, lineHeight: 1.4 }}>{captureNote}</div>}
          {shots.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                {shots.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => assignShot(s)}
                    title={`${s.label} — klikk for å legge på valgt enhet`}
                    style={{ padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: C.panelSoft, aspectRatio: '1 / 1' }}
                  >
                    <img src={s.dataUrl} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                  </button>
                ))}
              </div>
              <button onClick={() => autoFill(shots)} style={{ ...listBtn, marginTop: 8 }}>Auto-fyll enheter</button>
              <button onClick={() => void applyAccentFromSite()} style={{ ...listBtn, marginTop: 6 }}>Bruk sidefarge som accent</button>
            </>
          )}
          <div style={{ height: 18 }} />
          <SectionLabel>Legg til enhet</SectionLabel>
          {(Object.keys(DEVICE_LABELS) as MockupDeviceVariant[]).map((v) => (
            <button key={v} onClick={() => store.addDevice(v)} style={{ ...listBtn, marginBottom: 6 }}>+ {DEVICE_LABELS[v]}</button>
          ))}
          <div style={{ height: 16 }} />
          <SectionLabel>Legg til tekst</SectionLabel>
          {(Object.keys(TEXT_ROLE_LABELS) as MockupTextRole[]).map((r) => (
            <button key={r} onClick={() => store.addText(r)} style={{ ...listBtn, marginBottom: 6 }}>+ {TEXT_ROLE_LABELS[r]}</button>
          ))}
        </div>

        {/* Midt: lerret */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, overflow: 'auto', background: 'radial-gradient(1200px 700px at 50% 0%, #141826 0%, #0b0d13 70%)' }}>
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <MockupCanvas />
          </div>
        </div>

        {/* Høyre: inspektør */}
        <div style={{ width: 300, borderLeft: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', flexShrink: 0, background: C.panel }}>
          {selectedDevice ? (
            <DeviceInspector device={selectedDevice} onUpload={() => triggerUpload(selectedDevice.id)} />
          ) : selectedText ? (
            <TextInspector text={selectedText} />
          ) : (
            <CanvasInspector />
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} style={{ display: 'none' }} />
    </div>
  );
}

// ── Inspektører ──────────────────────────────────────────────────────────

function CanvasInspector() {
  const canvas = useMockupStudio((s) => s.doc.canvas);
  const patchCanvas = useMockupStudio((s) => s.patchCanvas);
  const useGradient = !!canvas.bg2;
  return (
    <div>
      <SectionLabel>Lerret</SectionLabel>
      <Field label="Accent-farge">
        <ColorRow value={canvas.accent} onChange={(v) => patchCanvas({ accent: v })} />
      </Field>
      <Field label="Bakgrunn">
        <ColorRow value={canvas.bg} onChange={(v) => patchCanvas({ bg: v })} />
      </Field>
      <label style={checkRow}>
        <input type="checkbox" checked={useGradient} onChange={(e) => patchCanvas({ bg2: e.target.checked ? (canvas.bg2 || '#171a2b') : undefined })} />
        Gradient
      </label>
      {useGradient && (
        <>
          <Field label="Bakgrunn 2">
            <ColorRow value={canvas.bg2 || '#171a2b'} onChange={(v) => patchCanvas({ bg2: v })} />
          </Field>
          <Field label={`Vinkel: ${canvas.bgAngle}°`}>
            <input type="range" min={0} max={360} value={canvas.bgAngle} onChange={(e) => patchCanvas({ bgAngle: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
        </>
      )}
      <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginTop: 16 }}>
        Velg en enhet eller tekst i lerretet for å redigere den. Accent-fargen
        styrer alle accent-merkede tekster i ett klikk.
      </p>
    </div>
  );
}

function DeviceInspector({ device, onUpload }: { device: import('./mockupStudioModel').MockupDeviceSlot; onUpload: () => void }) {
  const patchDevice = useMockupStudio((s) => s.patchDevice);
  const setDeviceImage = useMockupStudio((s) => s.setDeviceImage);
  const removeDevice = useMockupStudio((s) => s.removeDevice);
  return (
    <div>
      <SectionLabel>{DEVICE_LABELS[device.variant]}</SectionLabel>
      <Field label="Type">
        <select value={device.variant} onChange={(e) => patchDevice(device.id, { variant: e.target.value as MockupDeviceVariant })} style={textInput}>
          {(Object.keys(DEVICE_LABELS) as MockupDeviceVariant[]).map((v) => <option key={v} value={v}>{DEVICE_LABELS[v]}</option>)}
        </select>
      </Field>
      <Field label="Skjermbilde">
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onUpload} style={{ ...listBtn, flex: 1 }}>{device.image ? 'Bytt bilde' : 'Last opp'}</button>
          {device.image && <button onClick={() => setDeviceImage(device.id, undefined)} style={listBtn} title="Fjern bilde">✕</button>}
        </div>
      </Field>
      <Field label={`Bredde: ${Math.round(device.w)} px`}>
        <input type="range" min={120} max={1400} value={device.w} onChange={(e) => patchDevice(device.id, { w: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`Rotasjon: ${device.rotation}°`}>
        <input type="range" min={-30} max={30} value={device.rotation} onChange={(e) => patchDevice(device.id, { rotation: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`X: ${Math.round(device.x)}`}>
        <input type="range" min={-400} max={1600} value={device.x} onChange={(e) => patchDevice(device.id, { x: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`Y: ${Math.round(device.y)}`}>
        <input type="range" min={-400} max={1000} value={device.y} onChange={(e) => patchDevice(device.id, { y: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <label style={checkRow}>
        <input type="checkbox" checked={device.shadow} onChange={(e) => patchDevice(device.id, { shadow: e.target.checked })} />
        Skygge
      </label>
      <button onClick={() => removeDevice(device.id)} style={{ ...dangerBtn, marginTop: 12 }}>Slett enhet</button>
    </div>
  );
}

function TextInspector({ text }: { text: import('./mockupStudioModel').MockupTextSlot }) {
  const patchText = useMockupStudio((s) => s.patchText);
  const removeText = useMockupStudio((s) => s.removeText);
  const isAccent = text.color === 'accent';
  return (
    <div>
      <SectionLabel>{TEXT_ROLE_LABELS[text.role]}</SectionLabel>
      <Field label="Tekst">
        <textarea value={text.text} onChange={(e) => patchText(text.id, { text: e.target.value })} rows={3} style={{ ...textInput, resize: 'vertical' }} />
      </Field>
      <Field label={`Størrelse: ${Math.round(text.size)} px`}>
        <input type="range" min={12} max={140} value={text.size} onChange={(e) => patchText(text.id, { size: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`Tykkelse: ${text.weight}`}>
        <input type="range" min={300} max={900} step={100} value={text.weight} onChange={(e) => patchText(text.id, { weight: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label="Justering">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} onClick={() => patchText(text.id, { align: a })} style={{ ...listBtn, flex: 1, background: text.align === a ? C.accent : C.panelSoft, color: text.align === a ? C.accentInk : C.ink }}>
              {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Farge">
        <label style={{ ...checkRow, marginBottom: 8 }}>
          <input type="checkbox" checked={isAccent} onChange={(e) => patchText(text.id, { color: e.target.checked ? 'accent' : '#ffffff' })} />
          Bruk accent-farge
        </label>
        {!isAccent && <ColorRow value={text.color} onChange={(v) => patchText(text.id, { color: v })} />}
      </Field>
      <label style={checkRow}>
        <input type="checkbox" checked={text.uppercase} onChange={(e) => patchText(text.id, { uppercase: e.target.checked })} />
        Store bokstaver
      </label>
      <Field label={`Bredde: ${Math.round(text.w)} px`}>
        <input type="range" min={120} max={1600} value={text.w} onChange={(e) => patchText(text.id, { w: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`X: ${Math.round(text.x)}`}>
        <input type="range" min={-200} max={1600} value={text.x} onChange={(e) => patchText(text.id, { x: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`Y: ${Math.round(text.y)}`}>
        <input type="range" min={-100} max={1000} value={text.y} onChange={(e) => patchText(text.id, { y: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <button onClick={() => removeText(text.id)} style={{ ...dangerBtn, marginTop: 12 }}>Slett tekst</button>
    </div>
  );
}

// ── Små UI-primitiver ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 10, fontWeight: 700 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 32, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...textInput, flex: 1 }} />
    </div>
  );
}

const textInput: React.CSSProperties = {
  background: C.panelSoft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: C.font, width: '100%', boxSizing: 'border-box',
};
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: C.font,
};
const primaryBtn: React.CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: C.font,
};
const listBtn: React.CSSProperties = {
  background: C.panelSoft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: C.font,
};
const dangerBtn: React.CSSProperties = {
  background: 'rgba(220,60,60,0.12)', color: '#f0a0a0', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: C.font,
};
const checkRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink, cursor: 'pointer', marginBottom: 4,
};

export default MockupStudioShell;
