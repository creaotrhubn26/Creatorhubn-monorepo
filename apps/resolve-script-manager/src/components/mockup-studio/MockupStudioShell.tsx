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
import { MockupCanvas } from './MockupCanvas';
import { ExportDialog } from './ExportDialog';
import { OnboardingDialog } from './OnboardingDialog';
import { DesignGallery } from './DesignGallery';
import { CaptureDialog } from './CaptureDialog';
import { ProjectsView } from './ProjectsView';
import { useMockupStudio } from './mockupStudioStore';
import {
  listKits,
  saveKit,
  deleteKit,
  loadKitDoc,
  makeElement,
  ELEMENT_LABELS,
  LAYOUT_VARIANTS,
  MOCKUP_FORMATS,
  TYPOGRAPHY_STYLES,
  DECOR_LABELS,
  currentFormatId,
  hasFormatLayout,
  orientationGroup,
  listBrandKits,
  saveBrandKit,
  deleteBrandKit,
  brandKitPatch,
  listVersions,
  saveVersion,
  deleteVersion,
  loadVersionDoc,
  resolveBaseBg,
  resolveColor,
  contrastRatio,
  isDark,
  type MockupKit,
  type MockupBrandKit,
  type MockupVersion,
  type MockupElementKind,
  type MockupDeviceVariant,
  type MockupTextRole,
  type MockupBackground,
  type MockupBgStyle,
  type MockupTypographyId,
  type MockupDecor,
  buildMindmapDoc,
} from './mockupStudioModel';
import { RECOMMENDED_MAX } from './mockupPreflight';
import {
  captureSiteShots,
  bestShotForVariant,
  extractAccentFromImage,
  extractBrandLook,
  isCaptureReady,
  installCaptureEngine,
  hostnameOf,
  listSimulators,
  captureSimShot,
  type CapturedShot,
  type SimTarget,
} from './mockupCapture';
import { aiAvailable, aiDraftOnePager } from './mockupAiDraft';
import { aiIllustrate, aiComposeFromUrl } from './mockupAiIllustrate';
import { aiCopyVariants, copyVariantsAvailable } from './mockupAiEnhance';
import { aiLocalizeTexts, localizeAvailable, LOCALIZE_LANGS } from './mockupAiLocalize';
import { PERSPECTIVE_PRESETS, type MockupPerspective } from './mockupPerspective';
import { generateSceneBackground, aiBackgroundAvailable } from './mockupAiBackground';
import { MOCKUP_SCENES } from './mockupScenes';
import { is3dVariant } from './mockup3d/deviceGeometry';
import { aiProductMindmap } from './mockupMindmap';
import { exportAndSaveMotion, motionExportAvailable } from './mockupMotionExport';
import { exportAndSaveGif } from './mockupGifExport';
import { MOTION_PRESETS, type MotionConfig } from './mockupMotion';
import { exportCinematic } from './mockupCinematicExport';

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
  watch: 'Apple Watch',
  android: 'Android',
  browser: 'Nettleser',
  tablet: 'Nettbrett',
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [view, setView] = useState<'projects' | 'editor'>('projects');

  // URL-capture (P2)
  const [url, setUrl] = useState('');
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [sims, setSims] = useState<SimTarget[]>([]);

  // Kits (P4)
  const [kits, setKits] = useState<MockupKit[]>(() => listKits());
  const [kitName, setKitName] = useState('');
  const doSaveKit = () => {
    const res = saveKit(kitName || doc.name, doc);
    if (res.ok) { setKits(listKits()); setKitName(''); setExportMsg('✓ Kit lagret.'); }
    else setExportMsg(res.error || 'Kunne ikke lagre kit.');
  };
  const doLoadKit = (id: string) => { const d = loadKitDoc(id); if (d) store.setDocument(d); };
  const doDeleteKit = (id: string) => { if (!confirm('Slette dette kittet? Kan ikke angres.')) return; deleteKit(id); setKits(listKits()); };

  // Versjoner (§1.4)
  const [versions, setVersions] = useState<MockupVersion[]>(() => listVersions());
  const [versionName, setVersionName] = useState('');
  const doSaveVersion = () => {
    const r = saveVersion(versionName || doc.name, doc);
    if (r.ok) { setVersions(listVersions()); setVersionName(''); setExportMsg('✓ Versjon lagret.'); }
    else setExportMsg(r.error || 'Kunne ikke lagre versjon.');
  };
  const doLoadVersion = (id: string) => { const d = loadVersionDoc(id); if (d) store.setDocument(d); };
  const doDeleteVersion = (id: string) => { if (!confirm('Slette denne versjonen? Kan ikke angres.')) return; deleteVersion(id); setVersions(listVersions()); };

  // Trygt område-guide (§ bunnbar / hybrid slot-nod)
  const [safeArea, setSafeArea] = useState(false);
  // Struktur før frihet (§1.1): geometri-kontroller er skjult som standard.
  const [advanced, setAdvanced] = useState(false);

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

  const triggerLogoUpload = () => logoInputRef.current?.click();
  const onLogoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') store.patchCanvas({ logo: { image: reader.result, x: 120, y: 120, w: 280 } });
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
      console.error('[mockup-studio] capture', e);
      setCaptureNote('Fant ikke skjermbilder — sjekk URL-en og at capture-motoren er installert.');
    } finally {
      setCapturing(false);
    }
  };

  const runAiDraft = async () => {
    setCaptureNote(null);
    if (!url.trim()) return;
    if (!aiAvailable()) { setCaptureNote('AI ikke tilkoblet — logg inn (RR-token) i Innstillinger.'); return; }
    setCapturing(true);
    try {
      const draft = await aiDraftOnePager(url, (s) => setCaptureNote(`AI: ${s}`));
      store.setDocument(draft);
      setCaptureNote('✓ AI-utkast klart — rediger fritt.');
    } catch (e) {
      console.error('[mockup-studio] ai-draft', e);
      setCaptureNote('AI-utkast gikk ikke — sjekk URL-en og at du er innlogget (RR-token). Prøv igjen.');
    } finally {
      setCapturing(false);
    }
  };

  const runAiCompose = async () => {
    setCaptureNote(null);
    if (!url.trim()) return;
    if (!aiAvailable()) { setCaptureNote('AI ikke tilkoblet — logg inn (RR-token) i Innstillinger.'); return; }
    setCapturing(true);
    try {
      const doc = await aiComposeFromUrl(url, (s) => setCaptureNote(`AI: ${s}`));
      store.setDocument(doc);
      const n = (doc.annotations ?? []).filter((a) => a.kind === 'callout').length;
      setCaptureNote(n > 0 ? `✓ Ferdig illustrasjon: hero-tekst + ${n} callouts — rediger fritt.` : '✓ Utkast klart (fant ingen tydelig produktskjerm å illustrere).');
    } catch (e) {
      console.error('[mockup-studio] ai-compose', e);
      setCaptureNote('AI-illustrasjon gikk ikke — sjekk URL-en og AI-tilkoblingen. Prøv igjen.');
    } finally {
      setCapturing(false);
    }
  };

  const runAiMindmap = async () => {
    setCaptureNote(null);
    if (!url.trim()) return;
    if (!aiAvailable()) { setCaptureNote('AI ikke tilkoblet — logg inn (RR-token) i Innstillinger.'); return; }
    setCapturing(true);
    try {
      const mermaid = await aiProductMindmap(url, (s) => setCaptureNote(`AI: ${s}`));
      const cur = store.doc.canvas;
      // Ny mind map-slide som eget prosjekt, arver gjeldende merkevare.
      const doc = buildMindmapDoc(mermaid, {
        accent: cur.accent, accent2: cur.accent2, background: cur.background,
        typography: cur.typography, name: `${doc0Name()} — mind map`,
      });
      store.setDocument(doc);
      setCaptureNote('✓ Produkt-mind map generert (eget prosjekt) — rediger Mermaid-kilden i Illustrasjon-panelet.');
    } catch (e) {
      console.error('[mockup-studio] ai-mindmap', e);
      setCaptureNote('Mind map gikk ikke — sjekk URL-en og AI-tilkoblingen. Prøv igjen.');
    } finally {
      setCapturing(false);
    }
  };
  const doc0Name = () => (store.doc.name && store.doc.name !== 'Produkt-mind map' ? store.doc.name : 'Produkt');

  const runExportVideo = async (cfg: MotionConfig) => {
    if (!motionExportAvailable()) { setExportMsg('Video-opptak støttes ikke i denne webviewen.'); return; }
    if (videoBusy) return;
    setVideoBusy(true);
    try {
      const saved = await exportAndSaveMotion(doc, cfg, 0.75, (l, f) => setExportMsg(`🎬 ${l} ${Math.round(f * 100)}%`));
      setExportMsg(saved ? '✓ Video lagret (WebM).' : null);
    } catch (e) {
      console.error('[mockup-studio] video-export', e);
      setExportMsg('Video-eksport gikk ikke — prøv en kortere lengde eller lavere oppløsning.');
    } finally {
      setVideoBusy(false);
    }
  };

  const runLocalize = async (code: string, label: string) => {
    if (videoBusy) return;
    const texts = store.doc.texts.map((t) => ({ id: t.id, text: t.text }));
    if (texts.length === 0) { setExportMsg('Ingen tekst å oversette.'); return; }
    setVideoBusy(true);
    try {
      setExportMsg(`🌐 Oversetter til ${label}…`);
      const map = await aiLocalizeTexts(texts, label);
      let n = 0;
      for (const [id, translated] of Object.entries(map)) { if (translated.trim()) { store.patchText(id, { text: translated }); n++; } }
      setExportMsg(n > 0 ? `✓ Oversatt ${n} tekst(er) til ${label}.` : 'Fikk ingen oversettelse — prøv igjen.');
      void code;
    } catch (e) {
      console.error('[mockup-studio] localize', e);
      setExportMsg('Oversettelse gikk ikke — sjekk at du er innlogget (RR-token).');
    } finally { setVideoBusy(false); }
  };

  const runExportCinematic = async () => {
    if (videoBusy) return;
    setVideoBusy(true);
    try {
      const out = await exportCinematic(doc, 36, (m) => setExportMsg(m));
      setExportMsg(out ? '✓ Cinematic MP4 lagret (Blender/Cycles).' : null);
    } catch (e) {
      console.error('[mockup-studio] cinematic', e);
      setExportMsg(`Cinematic gikk ikke: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVideoBusy(false);
    }
  };

  const runExportGif = async (cfg: MotionConfig) => {
    if (videoBusy) return;
    setVideoBusy(true);
    try {
      const saved = await exportAndSaveGif(doc, cfg, (l, f) => setExportMsg(`🎞️ ${l} ${Math.round(f * 100)}%`));
      setExportMsg(saved ? '✓ GIF lagret.' : null);
    } catch (e) {
      console.error('[mockup-studio] gif-export', e);
      setExportMsg('GIF-eksport gikk ikke — prøv en kortere lengde.');
    } finally {
      setVideoBusy(false);
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

  const applyBrandLook = async () => {
    const src = shots.find((s) => s.viewport === 'desktop') ?? shots[0];
    if (!src) return;
    setCaptureNote('Genererer skreddersydd merkevare-look…');
    const look = await extractBrandLook(src.dataUrl);
    if (!look) { setCaptureNote('Fant ingen tydelig merkevare-farge i skjermbildet.'); return; }
    const VIBE_LABEL: Record<string, string> = { vivid: 'levende', bold: 'markant', muted: 'dempet', playful: 'leken' };
    store.patchCanvas({
      accent: look.accent, accent2: look.accent2, background: look.background,
      bgStyle: look.bgStyle, decor: look.decor, typography: look.typography,
    });
    setCaptureNote(`✓ Merkevare-look generert (${VIBE_LABEL[look.vibe] ?? look.vibe}): ${look.accent} + ${look.accent2}.`);
  };

  const installEngine = async () => {
    setInstalling(true);
    setCaptureNote('Installerer capture-motor (kan ta et par minutter)…');
    try {
      const ok = await installCaptureEngine();
      setEngineReady(ok);
      setCaptureNote(ok ? '✓ Capture-motor klar.' : 'Installasjon fullførte ikke — prøv igjen.');
    } catch (e) {
      console.error('[mockup-studio] install-engine', e);
      setCaptureNote('Installasjon av capture-motoren gikk ikke — prøv igjen, eller sjekk nettforbindelsen.');
    } finally {
      setInstalling(false);
    }
  };

  const findSims = async () => {
    setCaptureNote('Ser etter bootede simulatorer…');
    const list = await listSimulators();
    setSims(list);
    setCaptureNote(list.length ? `Fant ${list.length} simulator(er) — klikk for å hente skjermbilde.` : 'Ingen bootet simulator. Start en i Xcode/Simulator og prøv igjen.');
  };

  const grabSim = async (udid: string) => {
    setCaptureNote('Henter simulator-skjermbilde…');
    try {
      const dataUrl = await captureSimShot(udid);
      const target = selection.kind === 'device'
        ? selection.id
        : (doc.devices.find((d) => d.variant === 'iphone') ?? doc.devices.find((d) => d.variant === 'ipad') ?? doc.devices[0])?.id;
      if (!target) { setCaptureNote('Legg til en enhet først.'); return; }
      store.setDeviceImage(target, dataUrl);
      setCaptureNote('✓ Simulator-skjermbilde lagt på enheten.');
    } catch (e) {
      console.error('[mockup-studio] sim-capture', e);
      setCaptureNote('Simulator-capture gikk ikke — sjekk at simulatoren kjører og prøv igjen.');
    }
  };

  const missingShots = doc.devices.filter((d) => !d.image).length;
  const curFmt = currentFormatId(doc);
  const hasCustomFmt = curFmt ? hasFormatLayout(doc, curFmt) : false;

  if (view === 'projects') {
    return (
      <>
        <ProjectsView
          onClose={onClose}
          onOpen={(d) => { store.setDocument(d); setView('editor'); }}
          onNew={() => setShowOnboarding(true)}
          onGallery={() => setShowGallery(true)}
        />
        {showOnboarding && <OnboardingDialog onClose={() => setShowOnboarding(false)} onDone={() => setView('editor')} />}
        {showGallery && <DesignGallery onClose={() => setShowGallery(false)} onDone={() => setView('editor')} />}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: C.font, minHeight: 0 }}>
      {/* Topplinje */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={() => setView('projects')} style={ghostBtn}>← Prosjekter</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Mockup Studio</span>
        <input
          value={doc.name}
          onChange={(e) => store.setName(e.target.value)}
          style={{ ...textInput, width: 220 }}
          placeholder="Navn på mockup"
        />
        <button onClick={() => setShowOnboarding(true)} style={ghostBtn} title="Velg mal / nytt materiell">Ny mockup</button>
        <button onClick={() => setShowGallery(true)} style={ghostBtn} title="Bla i ferdig-stylede design">✦ Galleri</button>
        <button onClick={() => store.undo()} disabled={store.past.length === 0} style={{ ...ghostBtn, opacity: store.past.length ? 1 : 0.4, padding: '6px 10px' }} title="Angre" aria-label="Angre">↶</button>
        <button onClick={() => store.redo()} disabled={store.future.length === 0} style={{ ...ghostBtn, opacity: store.future.length ? 1 : 0.4, padding: '6px 10px' }} title="Gjør om" aria-label="Gjør om">↷</button>
        <span style={{ fontSize: 11, color: C.inkSoft, whiteSpace: 'nowrap' }} title="Alt lagres automatisk lokalt ved hver endring">✓ Lagret{store.past.length ? ` · ${store.past.length} angre` : ''}</span>
        <div style={{ flex: 1 }} />
        {exportMsg && <span style={{ fontSize: 12, color: C.inkSoft, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exportMsg}</span>}
        {!exportMsg && missingShots > 0 && <span style={{ fontSize: 12, color: '#e0b060' }} title="Last opp eller hent skjermbilder">{missingShots} enhet{missingShots > 1 ? 'er' : ''} uten skjermbilde</span>}
        <select
          onChange={(e) => { const c = e.target.value; e.target.selectedIndex = 0; const l = LOCALIZE_LANGS.find((x) => x.code === c); if (l) void runLocalize(l.code, l.label); }}
          disabled={videoBusy || !localizeAvailable()}
          value=""
          style={{ ...ghostBtn, padding: '7px 8px', opacity: videoBusy || !localizeAvailable() ? 0.5 : 1 }}
          title={localizeAvailable() ? 'Oversett all tekst til et annet språk (App Store / Play-lokalisering)' : 'Krever innlogget AI (RR-token)'}
        >
          <option value="" disabled>🌐 Oversett</option>
          {LOCALIZE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select
          onChange={(e) => {
            const v = e.target.value; e.target.selectedIndex = 0;
            if (v.startsWith('gif:')) { const p = MOTION_PRESETS.find((x) => x.id === v.slice(4)); if (p) void runExportGif(p.cfg); }
            else { const p = MOTION_PRESETS.find((x) => x.id === v); if (p) void runExportVideo(p.cfg); }
          }}
          disabled={videoBusy}
          value=""
          style={{ ...ghostBtn, padding: '7px 8px', opacity: videoBusy ? 0.5 : 1 }}
          title="Animér avsløringen (enheter → tekst → callouts én etter én → lupe) og eksporter som video (WebM) eller animert GIF"
        >
          <option value="" disabled>{videoBusy ? '🎬 Lager…' : '🎬 Video / GIF'}</option>
          <optgroup label="Video (WebM)">
            {MOTION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </optgroup>
          <optgroup label="Animert GIF">
            {MOTION_PRESETS.map((p) => <option key={`gif-${p.id}`} value={`gif:${p.id}`}>🎞️ {p.label}</option>)}
          </optgroup>
        </select>
        <button
          onClick={() => void runExportCinematic()}
          disabled={videoBusy}
          style={{ ...ghostBtn, padding: '7px 8px', opacity: videoBusy ? 0.5 : 1 }}
          title="Fotoreal Blender-render (Cycles) av 3D-enheten i et studio-environment → MP4. Krever Blender installert. ~1–3 min."
        >🎥 Cinematic</button>
        <button onClick={() => setShowExport(true)} style={primaryBtn} title="Kvalitetssjekk → format → eksport (PNG/PDF/PSD)">Eksporter</button>
      </div>

      {/* Kropp: verktøy · lerret · inspektør */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Venstre: nettside-capture + legg til */}
        <div style={{ width: 220, borderRight: `1px solid ${C.border}`, padding: 14, overflowY: 'auto', flexShrink: 0 }}>
          <SectionLabel>Oppsett</SectionLabel>
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 6 }}>Format (flate)</div>
          <select
            value={MOCKUP_FORMATS.find((f) => f.w === doc.canvas.w && f.h === doc.canvas.h)?.id ?? ''}
            onChange={(e) => { const f = MOCKUP_FORMATS.find((x) => x.id === e.target.value); if (f) store.applyFormat(f); }}
            style={{ ...textInput, marginBottom: 10 }}
            title="Bytt lerret-format — komposisjonen reflowes for sosiale flater"
          >
            {!MOCKUP_FORMATS.find((f) => f.w === doc.canvas.w && f.h === doc.canvas.h) && <option value="">Egendefinert</option>}
            {MOCKUP_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {curFmt && (
            <div style={{ marginBottom: 10 }}>
              {hasCustomFmt ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => store.saveFormatLayout()} style={{ ...listBtn, flex: 1 }} title="Overskriv den lagrede plasseringen med gjeldende">Oppdater ✎</button>
                  <button onClick={() => store.clearFormatLayout(curFmt)} style={listBtn} title="Tilbake til auto-reflow">Auto</button>
                </div>
              ) : (
                <button onClick={() => store.saveFormatLayout()} style={{ ...listBtn, width: '100%' }} title="Lås gjeldende plassering som pikselperfekt layout for dette formatet">Lagre plassering for formatet</button>
              )}
              <div style={{ fontSize: 10.5, color: hasCustomFmt ? C.accent : C.inkSoft, marginTop: 4 }}>{hasCustomFmt ? '✎ Egendefinert layout aktiv' : 'Auto-reflow · tune fritt + lagre for pikselperfekt'}</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 6 }}>Layout-variant</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {LAYOUT_VARIANTS.map((v) => (
              <button key={v.id} onClick={() => store.applyLayout(v.id)} style={{ ...listBtn, flex: 1, textAlign: 'center' }} title="Snap komposisjonen til dette oppsettet">{v.label}</button>
            ))}
          </div>
          <button onClick={() => setShowSwitch(true)} style={{ ...listBtn, marginBottom: 8 }} title="Bytt mal — innholdet overføres der det passer">Bytt mal…</button>

          <div style={{ height: 14 }} />
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
          <button
            onClick={() => void runAiCompose()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...primaryBtn, width: '100%', marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Full flyt: skjermbilder + hero-tekst + merkevare-farger + callouts som forklarer produktet — alt fra URL-en' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            ✨ Full AI-illustrasjon fra URL
          </button>
          <button
            onClick={() => void runAiDraft()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...listBtn, marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Kun one-pager-utkast (overskrift, tekst, farger, mal + skjermbilder) — uten callouts' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            ✨ AI-utkast (uten callouts)
          </button>
          <button
            onClick={() => void runAiMindmap()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...listBtn, marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Lag en produkt-mind map (Mermaid) fra URL-en som setter hele perspektivet — som eget prosjekt' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            🧠 Produkt-mind map fra URL
          </button>
          <button onClick={() => setShowCapture(true)} style={{ ...listBtn, marginTop: 6 }} title="Guidet fangst: velg skjermbilde og forhåndsvis i enheten før innsetting">Fang fra URL (guidet)…</button>
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
              <button onClick={() => void applyBrandLook()} style={{ ...primaryBtn, marginTop: 6, width: '100%' }} title="Generér en unik palett + typografi + dekor fra merkevarens egne farger">✨ Generér merkevare-look</button>
              <button onClick={() => void applyAccentFromSite()} style={{ ...listBtn, marginTop: 6 }}>Bruk kun sidefargen som accent</button>
            </>
          )}

          <div style={{ height: 14 }} />
          <SectionLabel>Fra simulator</SectionLabel>
          <button onClick={() => void findSims()} style={{ ...listBtn, marginBottom: 6 }} title="Fang den kjørende appen fra en bootet iOS-simulator">Finn simulatorer</button>
          {sims.map((s) => (
            <button
              key={s.udid}
              onClick={() => void grabSim(s.udid)}
              style={{ ...listBtn, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title="Hent skjermbilde → valgt enhet (eller iPhone/iPad)"
            >
              ⊞ {s.label}
            </button>
          ))}

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

          <div style={{ height: 18 }} />
          <SectionLabel>Elementer</SectionLabel>
          {(Object.keys(ELEMENT_LABELS) as MockupElementKind[]).map((k) => (
            <button key={k} onClick={() => store.addTexts(makeElement(k))} style={{ ...listBtn, marginBottom: 6 }} title="Sett inn forhåndsgodkjent modul">+ {ELEMENT_LABELS[k]}</button>
          ))}

          <div style={{ height: 18 }} />
          <SectionLabel>Kits</SectionLabel>
          <input
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSaveKit(); }}
            placeholder={doc.name || 'Kit-navn'}
            style={{ ...textInput, marginBottom: 6 }}
          />
          <button onClick={doSaveKit} style={{ ...listBtn, marginBottom: 8 }}>Lagre gjeldende som kit</button>
          {kits.length === 0 && <div style={{ fontSize: 11, color: C.inkSoft }}>Ingen lagrede kits enda.</div>}
          {kits.map((k) => (
            <div key={k.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <button onClick={() => doLoadKit(k.id)} style={{ ...listBtn, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Last inn (erstatter gjeldende)">{k.name}</button>
              <button onClick={() => doDeleteKit(k.id)} style={{ ...listBtn, width: 30, textAlign: 'center', flexShrink: 0 }} title="Slett kit" aria-label="Slett kit">✕</button>
            </div>
          ))}

          <div style={{ height: 18 }} />
          <SectionLabel>Versjoner</SectionLabel>
          <input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSaveVersion(); }}
            placeholder="Versjonsnavn"
            style={{ ...textInput, marginBottom: 6 }}
          />
          <button onClick={doSaveVersion} style={{ ...listBtn, marginBottom: 8 }}>Lagre versjon</button>
          {versions.length === 0 && <div style={{ fontSize: 11, color: C.inkSoft }}>Ingen versjoner enda.</div>}
          {versions.map((v) => (
            <div key={v.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <button onClick={() => doLoadVersion(v.id)} style={{ ...listBtn, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Gjenopprett denne versjonen">{v.name}</button>
              <button onClick={() => doDeleteVersion(v.id)} style={{ ...listBtn, width: 30, textAlign: 'center', flexShrink: 0 }} title="Slett versjon" aria-label="Slett versjon">✕</button>
            </div>
          ))}
        </div>

        {/* Midt: lerret */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, overflow: 'auto', background: 'radial-gradient(1200px 700px at 50% 0%, #141826 0%, #0b0d13 70%)' }}>
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <MockupCanvas safeArea={safeArea} />
          </div>
        </div>

        {/* Høyre: inspektør */}
        <div style={{ width: 300, borderLeft: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', flexShrink: 0, background: C.panel }}>
          {selectedDevice ? (
            <DeviceInspector device={selectedDevice} onUpload={() => triggerUpload(selectedDevice.id)} advanced={advanced} />
          ) : selectedText ? (
            <TextInspector text={selectedText} advanced={advanced} />
          ) : (
            <>
              <BrandingInspector onUploadLogo={triggerLogoUpload} />
              <div style={{ height: 18 }} />
              <IllustrationInspector />
            </>
          )}
        </div>
      </div>

      {/* Bunnbar (§ editorens bunnbar) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0, fontSize: 12, color: C.inkSoft }}>
        <span>{doc.canvas.w}×{doc.canvas.h}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} /> Vis trygt område
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} title="Lås opp fri plassering (flytt/roter/skaler). Av = malen beskytter komposisjonen.">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} /> Fri plassering
        </label>
        <div style={{ flex: 1 }} />
        <span>{doc.devices.length} enhet{doc.devices.length === 1 ? '' : 'er'} · {doc.texts.length} tekst{doc.texts.length === 1 ? '' : 'er'}</span>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} style={{ display: 'none' }} />
      <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoPicked} style={{ display: 'none' }} />

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showOnboarding && <OnboardingDialog onClose={() => setShowOnboarding(false)} onDone={() => setView('editor')} />}
      {showGallery && <DesignGallery onClose={() => setShowGallery(false)} onDone={() => setView('editor')} />}
      {showSwitch && <OnboardingDialog switchDoc={doc} onClose={() => setShowSwitch(false)} />}
      {showCapture && <CaptureDialog onClose={() => setShowCapture(false)} />}
    </div>
  );
}

// ── Inspektører ──────────────────────────────────────────────────────────

function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{ ...listBtn, flex: 1, textAlign: 'center', padding: '7px 4px', background: value === v ? C.accent : C.panelSoft, color: value === v ? C.accentInk : C.ink }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BrandingInspector({ onUploadLogo }: { onUploadLogo: () => void }) {
  const canvas = useMockupStudio((s) => s.doc.canvas);
  const patchCanvas = useMockupStudio((s) => s.patchCanvas);
  const base = resolveBaseBg(canvas);
  const textColor = isDark(base) ? '#ffffff' : '#101317';
  const ratio = contrastRatio(base, textColor);
  const goodContrast = ratio >= 4.5;
  const [brandKits, setBrandKits] = useState<MockupBrandKit[]>(() => listBrandKits());
  const [bkName, setBkName] = useState('');
  const doSaveBrandKit = () => { if (saveBrandKit(bkName || 'Merkevare', canvas).ok) { setBrandKits(listBrandKits()); setBkName(''); } };
  const [bgPrompt, setBgPrompt] = useState('');
  const [bgBusy, setBgBusy] = useState(false);
  const [bgErr, setBgErr] = useState<string | null>(null);
  const runBgGen = async () => {
    setBgErr(null); setBgBusy(true);
    try {
      const dataUrl = await generateSceneBackground(canvas, bgPrompt);
      patchCanvas({ bgImage: dataUrl });
    } catch (e) {
      console.error('[mockup-studio] ai-background', e);
      setBgErr('AI-bakgrunn gikk ikke — sjekk at du er innlogget (RR-token) og har kreditter.');
    } finally { setBgBusy(false); }
  };
  return (
    <div>
      <SectionLabel>Merkevare</SectionLabel>
      <Field label="Brand kit">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={bkName} onChange={(e) => setBkName(e.target.value)} placeholder="Navn på brand kit" style={{ ...textInput, flex: 1 }} />
          <button onClick={doSaveBrandKit} style={listBtn} title="Lagre gjeldende merkevare">Lagre</button>
        </div>
        {brandKits.map((k) => (
          <div key={k.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <button onClick={() => { const p = brandKitPatch(k.id); if (p) patchCanvas(p); }} style={{ ...listBtn, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }} title="Bruk denne merkevaren">
              <span style={{ width: 12, height: 12, borderRadius: 3, background: k.accent, flexShrink: 0 }} />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: k.accent2, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
            </button>
            <button onClick={() => { if (!confirm('Slette denne merkevare-looken? Kan ikke angres.')) return; deleteBrandKit(k.id); setBrandKits(listBrandKits()); }} style={{ ...listBtn, width: 30, textAlign: 'center', flexShrink: 0 }} title="Slett merkevare-look" aria-label="Slett merkevare-look">✕</button>
          </div>
        ))}
      </Field>
      <Field label="Logo">
        {canvas.logo?.image ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <img src={canvas.logo.image} alt="logo" style={{ height: 34, maxWidth: 96, objectFit: 'contain', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 4 }} />
            <button onClick={onUploadLogo} style={{ ...listBtn, flex: 1 }}>Bytt</button>
            <button onClick={() => patchCanvas({ logo: undefined })} style={{ ...listBtn, width: 30, textAlign: 'center' }} title="Fjern logo" aria-label="Fjern logo">✕</button>
          </div>
        ) : (
          <button onClick={onUploadLogo} style={listBtn}>Last opp logo</button>
        )}
      </Field>
      <Field label="Accent 1 · primær (CTA, tall, markører)">
        <ColorRow value={canvas.accent} onChange={(v) => patchCanvas({ accent: v })} />
      </Field>
      <Field label="Accent 2 · sekundær (badges, gradient)">
        <ColorRow value={canvas.accent2} onChange={(v) => patchCanvas({ accent2: v })} />
      </Field>
      <Field label="Bakgrunn">
        <Segmented<MockupBackground>
          options={[['light', 'Lys'], ['dark', 'Mørk'], ['brand', 'Merkevare']]}
          value={canvas.background}
          onChange={(v) => patchCanvas({ background: v })}
        />
      </Field>
      <Field label="Lifestyle-scene">
        <select
          value={canvas.scene?.id ?? ''}
          onChange={(e) => patchCanvas({ scene: e.target.value ? { id: e.target.value, shot: canvas.scene?.shot } : undefined })}
          style={{ ...textInput, marginBottom: canvas.scene?.id ? 6 : 0 }}
        >
          <option value="">Ingen (vanlig lerret)</option>
          {MOCKUP_SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {canvas.scene?.id && (
          <label style={{ ...listBtn, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            {canvas.scene.shot ? 'Bytt skjermbilde' : 'Legg til skjermbilde'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const r = new FileReader(); r.onload = () => patchCanvas({ scene: { id: canvas.scene!.id, shot: String(r.result) } }); r.readAsDataURL(f);
            }} />
          </label>
        )}
        {canvas.scene?.id && canvas.scene.shot && (
          <input
            type="text"
            value={canvas.scene.typeAnim?.text ?? ''}
            onChange={(e) => patchCanvas({ scene: { id: canvas.scene!.id, shot: canvas.scene!.shot, typeAnim: e.target.value ? { text: e.target.value, keyPop: canvas.scene!.typeAnim?.keyPop } : undefined } })}
            placeholder="Skrive-animasjon på skjermen (valgfritt)"
            style={{ ...textInput, marginTop: 6 }}
          />
        )}
        {canvas.scene?.typeAnim?.text && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft, marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!canvas.scene.typeAnim?.keyPop} onChange={(e) => patchCanvas({ scene: { id: canvas.scene!.id, shot: canvas.scene!.shot, typeAnim: { text: canvas.scene!.typeAnim!.text, keyPop: e.target.checked } } })} />
            Tastetrykk-pop (tast svever opp)
          </label>
        )}
        {canvas.scene?.id && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>Skjermbildet warpes i perspektiv inn i scenens skjerm. Skriv inn tekst for on-screen-tastatur-animasjon. Tekst-lag legges oppå.</div>}
      </Field>
      <Field label="AI-bakgrunn">
        <input value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="Beskriv scene (tomt = fra palett)" style={{ ...textInput, marginBottom: 6 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            disabled={bgBusy || !aiBackgroundAvailable()}
            onClick={() => void runBgGen()}
            style={{ ...listBtn, flex: 1, opacity: bgBusy || !aiBackgroundAvailable() ? 0.6 : 1 }}
            title={aiBackgroundAvailable() ? 'Generér en scene-bakgrunn (fal) fra prompt eller lerretets palett' : 'Krever innlogget AI (RR-token) + kreditter'}
          >
            {bgBusy ? 'Genererer…' : '✨ Generér bakgrunn'}
          </button>
          {canvas.bgImage && <button onClick={() => patchCanvas({ bgImage: undefined })} style={{ ...listBtn, width: 34, textAlign: 'center' }} title="Fjern AI-bakgrunn" aria-label="Fjern AI-bakgrunn">✕</button>}
        </div>
        {bgErr && <div style={{ fontSize: 11.5, color: '#e0b060', marginTop: 6 }}>{bgErr}</div>}
      </Field>
      <Field label="Stil">
        <Segmented<MockupBgStyle>
          options={[['clean', 'Ren'], ['gradient', 'Gradient'], ['atmospheric', 'Atmosf.']]}
          value={canvas.bgStyle}
          onChange={(v) => patchCanvas({ bgStyle: v })}
        />
      </Field>
      <Field label="Typografi">
        <select value={canvas.typography ?? 'moderne'} onChange={(e) => patchCanvas({ typography: e.target.value as MockupTypographyId })} style={textInput}>
          {(Object.keys(TYPOGRAPHY_STYLES) as MockupTypographyId[]).map((id) => <option key={id} value={id}>{TYPOGRAPHY_STYLES[id].label}</option>)}
        </select>
      </Field>
      <Field label="Dekor">
        <select value={canvas.decor ?? 'none'} onChange={(e) => patchCanvas({ decor: e.target.value as MockupDecor })} style={textInput}>
          {(Object.keys(DECOR_LABELS) as MockupDecor[]).map((id) => <option key={id} value={id}>{DECOR_LABELS[id]}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 12, color: goodContrast ? '#4ade80' : '#e0b060', marginTop: 8 }}>
        {goodContrast ? '✓ God kontrast' : '! Svak kontrast tekst/bakgrunn'} ({ratio.toFixed(1)}:1)
      </div>
      <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginTop: 14 }}>
        To accent-tokens styrer hele malen. Velg en enhet eller tekst på lerretet for å redigere den.
      </p>
    </div>
  );
}

function IllustrationInspector() {
  const doc = useMockupStudio((s) => s.doc);
  const addAnnotation = useMockupStudio((s) => s.addAnnotation);
  const patchAnnotation = useMockupStudio((s) => s.patchAnnotation);
  const removeAnnotation = useMockupStudio((s) => s.removeAnnotation);
  const setAnnotations = useMockupStudio((s) => s.setAnnotations);
  const setMindmap = useMockupStudio((s) => s.setMindmap);
  const anns = doc.annotations ?? [];
  const [target, setTarget] = useState<string>('');
  const devTarget = target || doc.devices[0]?.id;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const hasScreen = doc.devices.some((d) => d.image);

  const runAiIllustrate = async () => {
    setAiBusy(true); setAiMsg('Analyserer produktskjermen…');
    try {
      const anns = await aiIllustrate(doc, undefined, (s) => setAiMsg(s));
      setAnnotations(anns);
      setAiMsg(`✓ ${anns.filter((a) => a.kind === 'callout').length} callouts plassert.`);
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : 'AI-illustrasjon feilet.');
    } finally {
      setAiBusy(false);
    }
  };

  const KIND_LABEL: Record<string, string> = { callout: 'Callout', loupe: 'Lupe', marker: 'Markør' };
  const devName = (id?: string) => {
    if (!id) return 'Lerret';
    const i = doc.devices.findIndex((d) => d.id === id);
    return i >= 0 ? `${DEVICE_LABELS[doc.devices[i].variant]}${doc.devices.length > 1 ? ` ${i + 1}` : ''}` : 'Lerret';
  };

  return (
    <div>
      <SectionLabel>Illustrasjon</SectionLabel>

      {doc.mindmap ? (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 8px' }}>
            🧠 Produkt-mind map (Mermaid). Rediger kilden — rendres i merkevarefargene.
          </p>
          <textarea
            value={doc.mindmap}
            onChange={(e) => setMindmap(e.target.value)}
            spellCheck={false}
            style={{ ...textInput, width: '100%', minHeight: 150, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'vertical', whiteSpace: 'pre' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { navigator.clipboard?.writeText(doc.mindmap ?? ''); }} style={{ ...listBtn, flex: 1 }} title="Kopier Mermaid-kode (lim inn i et hvilket som helst Mermaid-verktøy)">Kopier Mermaid</button>
            <button onClick={() => setMindmap(undefined)} style={{ ...listBtn, flex: 1 }} title="Fjern mind map (tilbake til vanlig mockup)">Fjern mind map</button>
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5, marginTop: 10 }}>
            Callouts/lupe under gjelder vanlige mockups — mind map er sitt eget lerret.
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 10px' }}>
          Forklar produktet: callouts som peker på UI, en zoom-lupe på detaljen, eller en markør-ramme.
          <br /><span style={{ opacity: 0.8 }}>Tips: «🧠 Produkt-mind map fra URL» (Fra nettside) lager en mind map-slide.</span>
        </p>
      )}
      <button
        onClick={() => void runAiIllustrate()}
        disabled={aiBusy || !hasScreen}
        style={{ ...primaryBtn, width: '100%', marginBottom: 6, opacity: aiBusy || !hasScreen ? 0.55 : 1 }}
        title={hasScreen ? 'La AI finne UI-regioner og skrive funksjonstekst fra produktskjermen' : 'Legg inn en produktskjerm i en enhet først'}
      >
        {aiBusy ? 'Illustrerer…' : '✨ AI-illustrer produktskjermen'}
      </button>
      {aiMsg && <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 10px' }}>{aiMsg}</p>}
      {doc.devices.length > 1 && (
        <Field label="Fest til">
          <select value={devTarget ?? ''} onChange={(e) => setTarget(e.target.value)} style={textInput}>
            {doc.devices.map((d, i) => <option key={d.id} value={d.id}>{DEVICE_LABELS[d.variant]}{doc.devices.length > 1 ? ` ${i + 1}` : ''}</option>)}
            <option value="">Lerret</option>
          </select>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => addAnnotation('callout', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Callout</button>
        <button onClick={() => addAnnotation('loupe', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Lupe</button>
        <button onClick={() => addAnnotation('marker', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Markør</button>
      </div>

      {anns.length === 0 && <p style={{ fontSize: 12, color: C.inkSoft }}>Ingen annotasjoner ennå.</p>}

      {anns.map((a) => (
        <div key={a.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8, background: C.panelSoft }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{a.kind === 'callout' ? `${a.n}. ` : ''}{KIND_LABEL[a.kind]}</span>
            <span style={{ fontSize: 11, color: C.inkSoft }}>· {devName(a.deviceId)}</span>
            <button onClick={() => removeAnnotation(a.id)} style={{ ...listBtn, marginLeft: 'auto', width: 28, textAlign: 'center', padding: '4px 0' }} title="Slett annotasjon" aria-label="Slett annotasjon">✕</button>
          </div>

          {a.kind === 'callout' && (
            <>
              <input value={a.label ?? ''} onChange={(e) => patchAnnotation(a.id, { label: e.target.value })} placeholder="Funksjonstekst" style={{ ...textInput, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input type="number" min={1} value={a.n ?? 1} onChange={(e) => patchAnnotation(a.id, { n: Math.max(1, Number(e.target.value)) })} style={{ ...textInput, width: 56 }} title="Nummer" />
                <select value={a.side ?? 'right'} onChange={(e) => patchAnnotation(a.id, { side: e.target.value as never })} style={{ ...textInput, flex: 1 }}>
                  <option value="left">Etikett venstre</option>
                  <option value="right">Etikett høyre</option>
                  <option value="top">Etikett topp</option>
                  <option value="bottom">Etikett bunn</option>
                </select>
              </div>
            </>
          )}

          {a.kind === 'loupe' && (
            <Field label={`Zoom: ${(a.zoom ?? 2.4).toFixed(1)}×`}>
              <input type="range" min={1.5} max={4} step={0.1} value={a.zoom ?? 2.4} onChange={(e) => patchAnnotation(a.id, { zoom: Number(e.target.value) })} style={{ width: '100%' }} />
            </Field>
          )}

          {a.kind === 'marker' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>Bredde
                <input type="range" min={0.05} max={0.8} step={0.01} value={a.fw ?? 0.2} onChange={(e) => patchAnnotation(a.id, { fw: Number(e.target.value) })} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>Høyde
                <input type="range" min={0.05} max={0.8} step={0.01} value={a.fh ?? 0.12} onChange={(e) => patchAnnotation(a.id, { fh: Number(e.target.value) })} style={{ width: '100%' }} />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>X: {Math.round(a.fx * 100)}%
              <input type="range" min={0} max={1} step={0.01} value={a.fx} onChange={(e) => patchAnnotation(a.id, { fx: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>Y: {Math.round(a.fy * 100)}%
              <input type="range" min={0} max={1} step={0.01} value={a.fy} onChange={(e) => patchAnnotation(a.id, { fy: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kompakt numerisk felt (X/Y/B/H) — presis posisjonering ved siden av sliderne. */
function NumberBox({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 10, color: C.inkSoft, marginBottom: 2 }}>{label}</span>
      <input
        type="number" value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.round(n)); }}
        aria-label={label}
        style={{ ...textInput, width: '100%', padding: '5px 6px', fontVariantNumeric: 'tabular-nums' }}
      />
    </label>
  );
}

/** Lag-rad: dupliser + z-rekkefølge (delt av enhet/tekst-inspektør). */
function ArrangeRow({ kind, id }: { kind: 'device' | 'text'; id: string }) {
  const dupDevice = useMockupStudio((s) => s.duplicateDevice);
  const dupText = useMockupStudio((s) => s.duplicateText);
  const reorder = useMockupStudio((s) => s.reorderElement);
  return (
    <Field label="Lag">
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => (kind === 'device' ? dupDevice(id) : dupText(id))} style={{ ...listBtn, flex: 1 }} title="Dupliser (Cmd/Ctrl+D)">⧉ Dupliser</button>
        <button onClick={() => reorder(kind, id, 'up')} style={{ ...listBtn, width: 36, textAlign: 'center' }} title="Flytt fram (tegnes over)" aria-label="Flytt fram">↑</button>
        <button onClick={() => reorder(kind, id, 'down')} style={{ ...listBtn, width: 36, textAlign: 'center' }} title="Flytt bak" aria-label="Flytt bak">↓</button>
      </div>
    </Field>
  );
}

function DeviceInspector({ device, onUpload, advanced }: { device: import('./mockupStudioModel').MockupDeviceSlot; onUpload: () => void; advanced: boolean }) {
  const patchDevice = useMockupStudio((s) => s.patchDevice);
  const setDeviceImage = useMockupStudio((s) => s.setDeviceImage);
  const removeDevice = useMockupStudio((s) => s.removeDevice);
  return (
    <div>
      <SectionLabel>{DEVICE_LABELS[device.variant]}</SectionLabel>
      <Field label="Type">
        <select value={device.variant} onChange={(e) => patchDevice(device.id, { variant: e.target.value as MockupDeviceVariant })} style={textInput}>
          {(advanced ? (Object.keys(DEVICE_LABELS) as MockupDeviceVariant[]) : orientationGroup(device.variant)).map((v) => <option key={v} value={v}>{DEVICE_LABELS[v]}</option>)}
        </select>
      </Field>
      <Field label="Skjermbilde">
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onUpload} style={{ ...listBtn, flex: 1 }}>{device.image ? 'Bytt bilde' : 'Last opp'}</button>
          {device.image && <button onClick={() => setDeviceImage(device.id, undefined)} style={listBtn} title="Fjern bilde" aria-label="Fjern bilde">✕</button>}
        </div>
      </Field>
      {device.image && (
        <Field label="Utsnitt">
          <Segmented<'cover' | 'contain'>
            options={[['cover', 'Smart'], ['contain', 'Vis alt']]}
            value={device.fit ?? 'cover'}
            onChange={(v) => patchDevice(device.id, { fit: v })}
          />
        </Field>
      )}
      {device.image && (device.fit ?? 'cover') === 'cover' && (
        <>
          <Field label={`Fokus X: ${Math.round((device.focusX ?? 0.5) * 100)}%`}>
            <input type="range" min={0} max={1} step={0.01} value={device.focusX ?? 0.5} onChange={(e) => patchDevice(device.id, { focusX: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Fokus Y: ${Math.round((device.focusY ?? 0.5) * 100)}%`}>
            <input type="range" min={0} max={1} step={0.01} value={device.focusY ?? 0.5} onChange={(e) => patchDevice(device.id, { focusY: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
        </>
      )}
      {advanced && (
        <>
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
        </>
      )}
      <Field label="Perspektiv (2.5D)">
        <select value={device.perspective ?? 'none'} onChange={(e) => patchDevice(device.id, { perspective: e.target.value as MockupPerspective })} style={textInput} disabled={!!device.threeD}>
          {PERSPECTIVE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      {is3dVariant(device.variant) && (
        <>
          <label style={checkRow}>
            <input type="checkbox" checked={!!device.threeD} onChange={(e) => patchDevice(device.id, { threeD: e.target.checked ? { rotX: -6, rotY: 20, rotZ: 0 } : undefined })} />
            Ekte 3D (WebGL)
          </label>
          {device.threeD && (['rotY', 'rotX', 'rotZ'] as const).map((axis) => (
            <Field key={axis} label={`3D ${axis === 'rotY' ? 'snu' : axis === 'rotX' ? 'vipp' : 'rull'}: ${Math.round(device.threeD![axis])}°`}>
              <input type="range" min={-45} max={45} value={device.threeD![axis]} onChange={(e) => patchDevice(device.id, { threeD: { ...device.threeD!, [axis]: Number(e.target.value) } })} style={{ width: '100%' }} />
            </Field>
          ))}
          {device.threeD && (
            <Field label={`3D-størrelse: ${Math.round((device.threeD.zoom ?? 1) * 100)}%`}>
              <input type="range" min={0.7} max={1.6} step={0.05} value={device.threeD.zoom ?? 1} onChange={(e) => patchDevice(device.id, { threeD: { ...device.threeD!, zoom: Number(e.target.value) } })} style={{ width: '100%' }} />
            </Field>
          )}
          {device.threeD && device.variant === 'macbook' && (
            <Field label="Tastatur-layout">
              <select value={device.threeD.kbLayout ?? 'mac'} onChange={(e) => patchDevice(device.id, { threeD: { ...device.threeD!, kbLayout: e.target.value as 'mac' | 'windows' } })} style={textInput}>
                <option value="mac">Mac (⌘ ⌥ ⌃)</option>
                <option value="windows">Windows (Ctrl ⊞ Alt)</option>
              </select>
            </Field>
          )}
          {device.threeD && (
            <Field label="Skrive-animasjon (tekst «skrives» på skjermen)">
              <input
                type="text"
                value={device.typeAnim?.text ?? ''}
                onChange={(e) => patchDevice(device.id, { typeAnim: e.target.value ? { text: e.target.value, keyPop: device.typeAnim?.keyPop } : undefined })}
                placeholder="F.eks. Hei verden — tastene trykkes"
                style={textInput}
              />
            </Field>
          )}
          {device.threeD && device.typeAnim?.text && (
            <label style={checkRow}>
              <input type="checkbox" checked={!!device.typeAnim?.keyPop} onChange={(e) => patchDevice(device.id, { typeAnim: { text: device.typeAnim!.text, keyPop: e.target.checked } })} />
              Tastetrykk-pop (tast svever opp)
            </label>
          )}
        </>
      )}
      <label style={checkRow}>
        <input type="checkbox" checked={device.shadow} onChange={(e) => patchDevice(device.id, { shadow: e.target.checked })} />
        Skygge
      </label>
      <label style={checkRow}>
        <input type="checkbox" checked={device.reflection ?? false} onChange={(e) => patchDevice(device.id, { reflection: e.target.checked })} />
        Refleksjon
      </label>
      {(device.variant === 'iphone' || device.variant === 'android') && (
        <label style={checkRow}>
          <input type="checkbox" checked={device.cleanStatusBar ?? false} onChange={(e) => patchDevice(device.id, { cleanStatusBar: e.target.checked })} />
          Ren status-bar (09:41)
        </label>
      )}
      <Field label="Plassering (px)">
        <div style={{ display: 'flex', gap: 6 }}>
          <NumberBox label="X" value={Math.round(device.x)} onChange={(n) => patchDevice(device.id, { x: n })} />
          <NumberBox label="Y" value={Math.round(device.y)} onChange={(n) => patchDevice(device.id, { y: n })} />
          <NumberBox label="Bredde" value={Math.round(device.w)} onChange={(n) => patchDevice(device.id, { w: Math.max(40, n) })} />
        </div>
      </Field>
      <ArrangeRow kind="device" id={device.id} />
      <button onClick={() => removeDevice(device.id)} style={{ ...dangerBtn, marginTop: 12 }}>Slett enhet</button>
    </div>
  );
}

function trimToWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

function TextInspector({ text, advanced }: { text: import('./mockupStudioModel').MockupTextSlot; advanced: boolean }) {
  const patchText = useMockupStudio((s) => s.patchText);
  const removeText = useMockupStudio((s) => s.removeText);
  const canvas = useMockupStudio((s) => s.doc.canvas);
  const colorMode = text.color === 'accent' ? 'accent' : text.color === 'accent2' ? 'accent2' : 'custom';
  // Per-tekst kontrast mot lerret-bakgrunnen (approksimasjon; teksten kan ligge over en enhet).
  const textHex = resolveColor(text.color, canvas);
  const contrast = contrastRatio(resolveBaseBg(canvas), textHex);
  const contrastOk = contrast >= 4.5;
  const [variants, setVariants] = useState<string[] | null>(null);
  const [vBusy, setVBusy] = useState(false);
  const [vErr, setVErr] = useState<string | null>(null);
  const runVariants = async () => {
    setVErr(null); setVBusy(true);
    try {
      const v = await aiCopyVariants(text.text, text.role);
      setVariants(v);
      if (!v.length) setVErr('Fikk ingen varianter — prøv igjen.');
    } catch (e) {
      console.error('[mockup-studio] copy-variants', e);
      setVErr('AI-varianter gikk ikke — sjekk at du er innlogget (RR-token).');
    } finally { setVBusy(false); }
  };
  return (
    <div>
      <SectionLabel>{TEXT_ROLE_LABELS[text.role]}</SectionLabel>
      <Field label="Tekst">
        <textarea value={text.text} onChange={(e) => patchText(text.id, { text: e.target.value })} rows={3} style={{ ...textInput, resize: 'vertical' }} />
        <div style={{ fontSize: 11, color: text.text.length > RECOMMENDED_MAX[text.role] ? '#e0b060' : C.inkSoft, marginTop: 4 }}>
          {text.text.length}/{RECOMMENDED_MAX[text.role]} tegn{text.text.length > RECOMMENDED_MAX[text.role] ? ' · lengre enn anbefalt' : ''}
        </div>
        {text.text.length > RECOMMENDED_MAX[text.role] && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => patchText(text.id, { text: trimToWords(text.text, RECOMMENDED_MAX[text.role]) })} style={{ ...listBtn, flex: 1, padding: '6px 8px' }} title="Kort ned til anbefalt lengde">Forkort</button>
            <button onClick={() => patchText(text.id, { size: Math.max(12, Math.round(text.size * 0.85)) })} style={{ ...listBtn, flex: 1, padding: '6px 8px' }} title="Mindre typografi så alt får plass">Kompakt</button>
          </div>
        )}
      </Field>
      <div style={{ marginBottom: 12 }}>
        <button
          disabled={vBusy || !copyVariantsAvailable() || !text.text.trim()}
          onClick={() => void runVariants()}
          style={{ ...listBtn, width: '100%', opacity: vBusy || !copyVariantsAvailable() || !text.text.trim() ? 0.6 : 1 }}
          title={copyVariantsAvailable() ? 'La AI foreslå tone-varianter av denne teksten (kortere / mer selgende / roligere / mer konkret)' : 'Krever innlogget AI (RR-token i Innstillinger)'}
        >
          {vBusy ? 'Skriver…' : '✨ Tekst-varianter'}
        </button>
        {vErr && <div style={{ fontSize: 11.5, color: '#e0b060', marginTop: 6 }}>{vErr}</div>}
        {variants && variants.map((v, i) => (
          <button key={i} onClick={() => { patchText(text.id, { text: v }); setVariants(null); }} style={{ ...listBtn, width: '100%', textAlign: 'left', marginTop: 6, whiteSpace: 'normal', lineHeight: 1.4 }} title="Bruk denne varianten">{v}</button>
        ))}
      </div>
      <Field label={`Størrelse: ${Math.round(text.size)} px`}>
        <input type="range" min={12} max={140} value={text.size} onChange={(e) => patchText(text.id, { size: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label={`Tykkelse: ${text.weight}`}>
        <input type="range" min={300} max={900} step={100} value={text.weight} onChange={(e) => patchText(text.id, { weight: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Field label="Justering">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} onClick={() => patchText(text.id, { align: a })} title={a === 'left' ? 'Venstrejuster' : a === 'center' ? 'Midtstill' : 'Høyrejuster'} aria-label={a === 'left' ? 'Venstrejuster' : a === 'center' ? 'Midtstill' : 'Høyrejuster'} aria-pressed={text.align === a} style={{ ...listBtn, flex: 1, background: text.align === a ? C.accent : C.panelSoft, color: text.align === a ? C.accentInk : C.ink }}>
              {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Farge">
        <Segmented<'accent' | 'accent2' | 'custom'>
          options={[['accent', 'Accent 1'], ['accent2', 'Accent 2'], ['custom', 'Egen']]}
          value={colorMode}
          onChange={(v) => patchText(text.id, { color: v === 'accent' ? 'accent' : v === 'accent2' ? 'accent2' : (colorMode === 'custom' ? text.color : '#ffffff') })}
        />
        {colorMode === 'custom' && <div style={{ marginTop: 8 }}><ColorRow value={text.color} onChange={(v) => patchText(text.id, { color: v })} /></div>}
      </Field>
      <label style={checkRow}>
        <input type="checkbox" checked={text.uppercase} onChange={(e) => patchText(text.id, { uppercase: e.target.checked })} />
        Store bokstaver
      </label>
      <div style={{ fontSize: 11, color: contrastOk ? C.inkSoft : '#e0b060', margin: '2px 0 10px' }} title="WCAG AA krever ≥ 4.5:1 for brødtekst. Målt mot lerret-bakgrunnen.">
        Kontrast mot bakgrunn: {contrast.toFixed(1)}:1{contrastOk ? ' ✓' : ' · lav (mål ≥ 4.5:1)'}
      </div>
      {advanced && (
        <>
          <Field label={`Bredde: ${Math.round(text.w)} px`}>
            <input type="range" min={120} max={1600} value={text.w} onChange={(e) => patchText(text.id, { w: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`X: ${Math.round(text.x)}`}>
            <input type="range" min={-200} max={1600} value={text.x} onChange={(e) => patchText(text.id, { x: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Y: ${Math.round(text.y)}`}>
            <input type="range" min={-100} max={1000} value={text.y} onChange={(e) => patchText(text.id, { y: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
        </>
      )}
      <Field label="Plassering (px)">
        <div style={{ display: 'flex', gap: 6 }}>
          <NumberBox label="X" value={Math.round(text.x)} onChange={(n) => patchText(text.id, { x: n })} />
          <NumberBox label="Y" value={Math.round(text.y)} onChange={(n) => patchText(text.id, { y: n })} />
          <NumberBox label="Bredde" value={Math.round(text.w)} onChange={(n) => patchText(text.id, { w: Math.max(40, n) })} />
        </div>
      </Field>
      <ArrangeRow kind="text" id={text.id} />
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
