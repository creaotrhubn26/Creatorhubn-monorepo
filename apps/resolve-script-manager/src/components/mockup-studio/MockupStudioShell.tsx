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
import { MockupLibraryPanel } from './MockupLibraryPanel';
import { ingestImage } from './mockupLibraryIngest';
import { MockupKeyframeGraph } from './MockupKeyframeGraph';
import { ExportDialog } from './ExportDialog';
import { OnboardingDialog } from './OnboardingDialog';
import { DesignGallery } from './DesignGallery';
import { CampaignCompareDialog } from './CampaignCompareDialog';
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
  TYPE_PRESETS,
  CHAT_TYPE_SPEEDS,
  CHAT_TYPE_SPEED_LABELS,
  type ChatTypeSpeed,
  PERSON_RIG_PROPS,
  IMAGE_TRANSFORM_PROPS,
  PERSON_OUTFIT_LABELS,
  PERSON_HAIR_LABELS,
  PERSON_ACCESSORY_LABELS,
  PERSON_SCENARIO_LABELS,
  BACKDROP_ANCHORS,
  DEFAULT_RIG_POSE,
  EXPRESSION_PRESETS,
  PERSON_ROLE_PRESETS,
  sampleKf,
  type PersonStyle,
  type PersonRigPose,
  previsitUiCardImage,
  previsitInfoCardImage,
  previsitFormListCardImage,
  previsitPhoneScreenImage,
  previsitDashboardScreenImage,
  placeholderImage,
  type PreVisitCardContent,
  type PreVisitStepState,
  type PreVisitInfoCardContent,
  type PreVisitFormListContent,
  type PreVisitChecklistContent,
  type PreVisitDashboardContent,
} from './mockupStudioModel';
import { drawPersonLaptop } from './mockupRaster';
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
import { SEEDANCE_PROMPTS, generateCraveClip, seedanceCreditEstimate } from './mockupSeedance';
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

// Browser-test-modus (satt av browserTauriShim når Tauri mangler) — start rett i editoren
// uten onboarding, så E2E kan teste bibliotek/bilde-element. Umulig i native/prod.
const IS_BROWSER_TEST = typeof window !== 'undefined' && !!(window as unknown as { __BROWSER_TEST__?: boolean }).__BROWSER_TEST__;

// Responsiv skalering: vw-basert clamp → skalerer kontinuerlig for alle skjermstørrelser
// (liten laptop → 5K) uten breakpoints eller JS-lyttere. min holder lesbarhet på små
// skjermer, max hindrer gigantisk tekst på ultrabrede.
const FS = 'clamp(12px, 0.9vw, 15px)';          // knapp / input body
const FS_SM = 'clamp(11px, 0.8vw, 13.5px)';     // felt-label / hjelpetekst
const FS_LABEL = 'clamp(10px, 0.75vw, 12.5px)'; // seksjons-label (uppercase)

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
  const videoInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [view, setView] = useState<'projects' | 'editor'>(IS_BROWSER_TEST ? 'editor' : 'projects');

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
  const selectedImage = selection.kind === 'image' ? doc.images?.find((im) => im.id === selection.id) ?? null : null;

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

  const triggerVideoUpload = () => videoInputRef.current?.click();
  // Manuell video-import (f.eks. et Autodesk Flow Studio-render) — INGEN AI-generering skjer her,
  // bare fest en ferdig video-fil til et bilde-element. `video` avspilles i preview/eksport;
  // `image` (poster fra første frame) er statisk fallback (Bilde-fanen, statisk PNG-eksport).
  // Blob-URL: varer kun denne økten (overlever ikke omstart) — kjent begrensning, ikke en bug.
  const onVideoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('Kunne ikke lese videofilen'));
    });
    v.currentTime = 0;
    await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const poster = canvas.toDataURL('image/jpeg', 0.85);
    const targetW = 400, targetH = Math.round(targetW * (v.videoHeight / v.videoWidth));
    store.addImage(poster, { video: url, w: targetW, h: targetH, fit: 'cover' });
  };

  const triggerSpriteUpload = () => spriteInputRef.current?.click();
  // Sprite-sekvens import (f.eks. transparente PNG-rammer fra Sorceress 3D Studio sitt
  // 3D→2D-verktøy) — velg ALLE rammene i én fildialog, sorteres naturlig på filnavn (frame_001,
  // frame_002...) så rekkefølgen blir riktig uansett hvilken rekkefølge OS-en leverer filene i.
  const onSpritePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const naturalCmp = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    const sorted = files.sort(naturalCmp);
    const frames = await Promise.all(sorted.map((f) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Kunne ikke lese rammen')));
      reader.onerror = () => reject(new Error('Kunne ikke lese rammen'));
      reader.readAsDataURL(f);
    })));
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Kunne ikke lese første ramme')); img.src = frames[0]; });
    const targetW = 400, targetH = Math.round(targetW * (img.naturalHeight / img.naturalWidth));
    store.addImage(frames[0], { sprite: { frames, fps: 12 }, w: targetW, h: targetH, fit: 'contain' });
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
        // Auto-mappestruktur: pipeline legger fangsten i biblioteket under fangst/<host>
        const libFolder = `fangst/${host || 'nettside'}`;
        void Promise.all(list.map((s) => ingestImage(s.label || s.viewport, s.dataUrl, libFolder, `capture:${host}`).then(store.addLibraryMeta).catch((e) => console.error('[mockup-studio] lib-ingest', e))));
        setCaptureNote(`✓ ${list.length} skjermbilder hentet, fordelt på enhetene + lagt i biblioteket (${libFolder}).`);
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
        <button onClick={() => setShowCompare(true)} style={ghostBtn} title="Se alle kampanje-varianter side ved side, eksporter dem som én video">⚖ Sammenlign</button>
        <button onClick={() => store.undo()} disabled={store.past.length === 0} style={{ ...ghostBtn, opacity: store.past.length ? 1 : 0.4, padding: '6px 10px' }} title="Angre" aria-label="Angre">↶</button>
        <button onClick={() => store.redo()} disabled={store.future.length === 0} style={{ ...ghostBtn, opacity: store.future.length ? 1 : 0.4, padding: '6px 10px' }} title="Gjør om" aria-label="Gjør om">↷</button>
        <span style={{ fontSize: 11, color: C.inkSoft, whiteSpace: 'nowrap' }} title="Alt lagres automatisk lokalt ved hver endring">✓ Lagret{store.past.length ? ` · ${store.past.length} angre` : ''}</span>
        <div style={{ flex: 1 }} />
        {exportMsg && <span style={{ fontSize: FS_SM, color: C.inkSoft, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exportMsg}</span>}
        {!exportMsg && missingShots > 0 && <span style={{ fontSize: FS_SM, color: '#e0b060' }} title="Last opp eller hent skjermbilder">{missingShots} enhet{missingShots > 1 ? 'er' : ''} uten skjermbilde</span>}
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
        <div style={{ width: 'clamp(190px, 15vw, 300px)', borderRight: `1px solid ${C.border}`, padding: 14, overflowY: 'auto', flexShrink: 0 }}>
          <Collapsible title="Oppsett">
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

          </Collapsible>
          <Collapsible title="Bibliotek">
            <MockupLibraryPanel />
          </Collapsible>
          <Collapsible title="Fra nettside" defaultOpen={false}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runCapture(); }}
            placeholder="leadgrid.no"
            style={{ ...textInput, marginBottom: 6 }}
          />
          <button onClick={() => void runCapture()} disabled={capturing || !url.trim()} style={{ ...actionBtn, width: '100%', opacity: capturing || !url.trim() ? 0.6 : 1 }}>
            {capturing ? 'Henter…' : 'Hent skjermbilder'}
          </button>
          <button
            onClick={() => void runAiCompose()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...actionBtn, width: '100%', marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Full flyt: skjermbilder + hero-tekst + merkevare-farger + callouts som forklarer produktet — alt fra URL-en' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            Full AI-illustrasjon fra URL
          </button>
          <button
            onClick={() => void runAiDraft()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...listBtn, marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Kun one-pager-utkast (overskrift, tekst, farger, mal + skjermbilder) — uten callouts' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            <span style={iconRow}><IcSparkle />AI-utkast (uten callouts)</span>
          </button>
          <button
            onClick={() => void runAiMindmap()}
            disabled={capturing || !url.trim() || !aiAvailable()}
            style={{ ...listBtn, marginTop: 6, opacity: capturing || !url.trim() || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? 'Lag en produkt-mind map (Mermaid) fra URL-en som setter hele perspektivet — som eget prosjekt' : 'Krever innlogget AI (RR-token i Innstillinger)'}
          >
            <span style={iconRow}><IcNodes />Produkt-mind map fra URL</span>
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
              <button onClick={() => void applyBrandLook()} style={{ ...actionBtn, marginTop: 6, width: '100%' }} title="Generér en unik palett + typografi + dekor fra merkevarens egne farger">Generér merkevare-look</button>
              <button onClick={() => void applyAccentFromSite()} style={{ ...listBtn, marginTop: 6 }}>Bruk kun sidefargen som accent</button>
            </>
          )}

          </Collapsible>
          <Collapsible title="Fra simulator" defaultOpen={false}>
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

          </Collapsible>
          <Collapsible title="Legg til enhet">
          {(Object.keys(DEVICE_LABELS) as MockupDeviceVariant[]).map((v) => (
            <button key={v} onClick={() => store.addDevice(v)} style={{ ...listBtn, marginBottom: 6 }}>+ {DEVICE_LABELS[v]}</button>
          ))}
          </Collapsible>
          <Collapsible title="Legg til tekst">
          {(Object.keys(TEXT_ROLE_LABELS) as MockupTextRole[]).map((r) => (
            <button key={r} onClick={() => store.addText(r)} style={{ ...listBtn, marginBottom: 6 }}>+ {TEXT_ROLE_LABELS[r]}</button>
          ))}

          </Collapsible>
          <Collapsible title="Elementer">
          {(Object.keys(ELEMENT_LABELS) as MockupElementKind[]).map((k) => (
            <button key={k} onClick={() => store.addTexts(makeElement(k))} style={{ ...listBtn, marginBottom: 6 }} title="Sett inn forhåndsgodkjent modul">+ {ELEMENT_LABELS[k]}</button>
          ))}

          </Collapsible>
          <Collapsible title="Illustrasjon">
          <button
            onClick={() => store.addImage('', { illustration: 'person-laptop', w: 220, h: 279, radius: 0, fit: 'contain', shadow: false })}
            style={{ ...listBtn, marginBottom: 6 }}
            title="Prosedural flat-illustrasjon tegnet direkte på lerretet — ingen ekstern fil, animeres automatisk (typing-bounce) i videoeksport"
          >
            + Person ved laptop
          </button>
          <button
            onClick={() => store.addImage('', { illustration: 'office-backdrop', x: 0, y: 0, w: store.doc.canvas.w, h: store.doc.canvas.h, radius: 0, fit: 'contain', shadow: false })}
            style={{ ...listBtn, marginBottom: 6 }}
            title="Legekontor-bakgrunn (vindu, pult, plante, klokke) — tegnes alltid bak personer, uansett rekkefølge"
          >
            + Legekontor (bakgrunn)
          </button>
          <button
            onClick={() => store.addImage('', { illustration: 'waiting-room-backdrop', x: 0, y: 0, w: store.doc.canvas.w, h: store.doc.canvas.h, radius: 0, fit: 'contain', shadow: false })}
            style={{ ...listBtn, marginBottom: 6 }}
            title="Venteværelse-bakgrunn (stolrad, resepsjon, sofabord) — tegnes alltid bak personer, uansett rekkefølge"
          >
            + Venteværelse (bakgrunn)
          </button>
          <button
            onClick={triggerVideoUpload}
            style={{ ...listBtn, marginBottom: 6 }}
            title="Last opp en ferdig video (f.eks. et Autodesk Flow Studio-render) som et bilde-element — spilles i preview/eksport, ingen AI-generering her"
          >
            + Last opp video (3D-figur)
          </button>
          <button
            onClick={triggerSpriteUpload}
            style={{ ...listBtn, marginBottom: 6 }}
            title="Velg ALLE PNG-rammene i én dialog (f.eks. fra Sorceress 3D Studio sitt 3D→2D/Auto-Sprite-verktøy) — ekte 3D-render avspilt som bytte-frames, ingen AI-generering her"
          >
            + Last opp sprite-sekvens (3D-render)
          </button>
          </Collapsible>
          <Collapsible title="Kits" defaultOpen={false}>
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

          </Collapsible>
          <Collapsible title="Versjoner" defaultOpen={false}>
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
          </Collapsible>
        </div>

        {/* Midt: lerret */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12, overflow: 'hidden', background: 'radial-gradient(1200px 700px at 50% 0%, #141826 0%, #0b0d13 70%)' }}>
          <MockupCanvas safeArea={safeArea} />
        </div>

        {/* Høyre: inspektør */}
        <div style={{ width: 'clamp(250px, 19vw, 360px)', borderLeft: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', flexShrink: 0, background: C.panel }}>
          {selectedDevice ? (
            <DeviceInspector device={selectedDevice} onUpload={() => triggerUpload(selectedDevice.id)} advanced={advanced} />
          ) : selectedText ? (
            <TextInspector text={selectedText} advanced={advanced} />
          ) : selectedImage ? (
            <ImageInspector image={selectedImage} />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0, fontSize: FS_SM, color: C.inkSoft }}>
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
      <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => void onVideoPicked(e)} style={{ display: 'none' }} />
      <input ref={spriteInputRef} type="file" accept="image/*" multiple onChange={(e) => void onSpritePicked(e)} style={{ display: 'none' }} />

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showOnboarding && <OnboardingDialog onClose={() => setShowOnboarding(false)} onDone={() => setView('editor')} />}
      {showGallery && <DesignGallery onClose={() => setShowGallery(false)} onDone={() => setView('editor')} />}
      {showCompare && <CampaignCompareDialog category="kampanje" onClose={() => setShowCompare(false)} onDone={() => setView('editor')} />}
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
      <Collapsible title="Merkevare">
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
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <img src={canvas.logo.image} alt="logo" style={{ height: 34, maxWidth: 96, objectFit: 'contain', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 4 }} />
              <button onClick={onUploadLogo} style={{ ...listBtn, flex: 1 }}>Bytt</button>
              <button onClick={() => patchCanvas({ logo: undefined })} style={{ ...listBtn, width: 30, textAlign: 'center' }} title="Fjern logo" aria-label="Fjern logo">✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <NumberBox label="X" value={Math.round(canvas.logo.x)} onChange={(n) => patchCanvas({ logo: { ...canvas.logo!, x: n } })} />
              <NumberBox label="Y" value={Math.round(canvas.logo.y)} onChange={(n) => patchCanvas({ logo: { ...canvas.logo!, y: n } })} />
              <NumberBox label="Bredde" value={Math.round(canvas.logo.w)} onChange={(n) => patchCanvas({ logo: { ...canvas.logo!, w: Math.max(20, n) } })} />
            </div>
          </>
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
      </Collapsible>
      <Collapsible title="Bakgrunn & stil">
      <Field label="Bakgrunn">
        <Segmented<MockupBackground>
          options={[['light', 'Lys'], ['dark', 'Mørk'], ['brand', 'Merkevare']]}
          value={canvas.background}
          onChange={(v) => patchCanvas({ background: v })}
        />
      </Field>
      <Field label="Egendefinert bakgrunnsfarge (overstyrer Lys/Mørk/Merkevare sin faste standardtone)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <ColorRow value={canvas.bgColor ?? resolveBaseBg(canvas)} onChange={(v) => patchCanvas({ bgColor: v })} />
          {canvas.bgColor && (
            <button onClick={() => patchCanvas({ bgColor: undefined })} style={{ ...listBtn, width: 30, textAlign: 'center' }} title="Tilbakestill til standard" aria-label="Tilbakestill bakgrunnsfarge">✕</button>
          )}
        </div>
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
        {canvas.scene?.id && canvas.scene.shot && (() => {
          const sc = canvas.scene!; const ta = sc.typeAnim;
          const setTa = (patch: Partial<import('./mockupStudioModel').TypeAnimCfg> | null) => patchCanvas({ scene: { id: sc.id, shot: sc.shot, typeAnim: patch === null ? undefined : { ...ta, text: ta?.text ?? '', ...patch } } });
          const chk = { display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, marginTop: 6, cursor: 'pointer' } as const;
          return <>
            <input type="text" value={ta?.text ?? ''} onChange={(e) => setTa(e.target.value ? { text: e.target.value } : null)} placeholder="Skrive-animasjon på skjermen (valgfritt)" style={{ ...textInput, marginTop: 6 }} />
            {ta?.text && <>
              <select value={ta.field ?? 'plain'} onChange={(e) => setTa({ field: e.target.value as import('./mockupStudioModel').MockupFieldStyle })} style={{ ...textInput, marginTop: 6 }}>
                <option value="plain">Enkel</option><option value="search">Søkefelt</option><option value="chat">Chat</option>
                <option value="url">URL-linje</option><option value="document">Dokument</option><option value="code">Kode</option><option value="terminal">Terminal</option>
              </select>
              <input type="text" value={ta.placeholder ?? ''} onChange={(e) => setTa({ placeholder: e.target.value || undefined })} placeholder="Placeholder (valgfri)" style={{ ...textInput, marginTop: 6 }} />
              <label style={chk}><input type="checkbox" checked={!!ta.keyPop} onChange={(e) => setTa({ keyPop: e.target.checked })} /> Tastetrykk-pop</label>
              <label style={chk}><input type="checkbox" checked={!!ta.payoff} onChange={(e) => setTa({ payoff: e.target.checked })} /> Payoff (Enter → resultat)</label>
              <label style={chk}><input type="checkbox" checked={!!ta.correct} onChange={(e) => setTa({ correct: e.target.checked })} /> Korreksjon (typo → rett)</label>
            </>}
          </>;
        })()}
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
            {bgBusy ? 'Genererer…' : <span style={iconRow}><IcImage />Generér bakgrunn</span>}
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
        <select value={canvas.typography ?? 'moderne'} onChange={(e) => patchCanvas({ typography: e.target.value as MockupTypographyId })} style={{ ...textInput, marginBottom: 6 }}>
          {(Object.keys(TYPOGRAPHY_STYLES) as MockupTypographyId[]).map((id) => <option key={id} value={id}>{TYPOGRAPHY_STYLES[id].label}</option>)}
        </select>
        <input
          value={canvas.customDisplayFont ?? ''}
          onChange={(e) => patchCanvas({ customDisplayFont: e.target.value || undefined })}
          placeholder='Egendefinert overskrift-font (CSS, f.eks. "Rockwell", serif) — overstyrer forvalget'
          style={{ ...textInput, width: '100%', fontSize: 11.5 }}
        />
      </Field>
      <Field label="Dekor">
        <select value={canvas.decor ?? 'none'} onChange={(e) => patchCanvas({ decor: e.target.value as MockupDecor })} style={{ ...textInput, marginBottom: canvas.decor && canvas.decor !== 'none' ? 6 : 0 }}>
          {(Object.keys(DECOR_LABELS) as MockupDecor[]).map((id) => <option key={id} value={id}>{DECOR_LABELS[id]}</option>)}
        </select>
        {canvas.decor && canvas.decor !== 'none' && (
          <label style={{ fontSize: 11, color: C.inkSoft, display: 'block' }}>Styrke: {Math.round((canvas.decorIntensity ?? 1) * 100)}%
            <input type="range" min={0} max={2} step={0.05} value={canvas.decorIntensity ?? 1} onChange={(e) => patchCanvas({ decorIntensity: Number(e.target.value) })} style={{ width: '100%' }} />
          </label>
        )}
      </Field>
      <Field label="Motion & grad (craveable)">
        <label style={checkRow}>
          <input type="checkbox" checked={(canvas.warmth ?? 0) > 0} onChange={(e) => patchCanvas({ warmth: e.target.checked ? 0.6 : 0 })} /> Warmth-grad (ost glinser)
        </label>
        {(canvas.warmth ?? 0) > 0 && (
          <input type="range" min={0.1} max={1} step={0.05} value={canvas.warmth ?? 0.6} onChange={(e) => patchCanvas({ warmth: Number(e.target.value) })} style={{ width: '100%', accentColor: C.accent }} />
        )}
        <label style={checkRow}>
          <input type="checkbox" checked={(canvas.pushIn ?? 0) > 0} onChange={(e) => patchCanvas({ pushIn: e.target.checked ? 0.6 : 0 })} /> Push-in (zoom under avspilling)
        </label>
        {(canvas.pushIn ?? 0) > 0 && (
          <input type="range" min={0.1} max={1} step={0.05} value={canvas.pushIn ?? 0.6} onChange={(e) => patchCanvas({ pushIn: Number(e.target.value) })} style={{ width: '100%', accentColor: C.accent }} />
        )}
        <label style={checkRow}>
          <input type="checkbox" checked={(canvas.beatPunch ?? 0) > 0} onChange={(e) => patchCanvas({ beatPunch: e.target.checked ? 0.6 : 0, bpm: e.target.checked ? (canvas.bpm ?? 120) : canvas.bpm })} /> Zoom-punch på beat
        </label>
        {(canvas.beatPunch ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: FS_SM, color: C.inkSoft }}>BPM</span>
            <input type="number" min={60} max={200} value={canvas.bpm ?? 120} onChange={(e) => patchCanvas({ bpm: Math.max(40, Math.min(220, Number(e.target.value) || 120)) })} style={{ ...textInput, width: 64 }} />
            <input type="range" min={0.1} max={1} step={0.05} value={canvas.beatPunch ?? 0.6} onChange={(e) => patchCanvas({ beatPunch: Number(e.target.value) })} style={{ flex: 1, accentColor: C.accent }} />
          </div>
        )}
        {/* Lyd-spor → muxes inn i MP4-eksport (musicPath). Sett BPM = sporets tempo for beat-synk. */}
        {canvas.audio ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: FS_SM, color: C.inkSoft }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎵 {canvas.audio.name ?? 'lyd-spor'}</span>
            <button onClick={() => patchCanvas({ audio: undefined })} style={{ ...listBtn, width: 'auto', padding: '4px 8px' }}>Fjern</button>
          </div>
        ) : (
          <label style={{ ...listBtn, display: 'block', textAlign: 'center', cursor: 'pointer', marginTop: 6 }}>
            🎵 Legg til lyd-spor (mux i MP4)
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const r = new FileReader(); r.onload = () => patchCanvas({ audio: { src: String(r.result), name: f.name } }); r.readAsDataURL(f);
            }} />
          </label>
        )}
      </Field>
      <div style={{ fontSize: FS_SM, color: goodContrast ? '#4ade80' : '#e0b060', marginTop: 8 }}>
        {goodContrast ? '✓ God kontrast' : '! Svak kontrast tekst/bakgrunn'} ({ratio.toFixed(1)}:1)
      </div>
      <p style={{ fontSize: FS_SM, color: C.inkSoft, lineHeight: 1.5, marginTop: 14 }}>
        To accent-tokens styrer hele malen. Velg en enhet eller tekst på lerretet for å redigere den.
      </p>
      </Collapsible>
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

  const KIND_LABEL: Record<string, string> = { callout: 'Callout', loupe: 'Lupe', marker: 'Markør', step: 'Trinn-badge', connector: 'Kobling', pill: 'Pill' };
  const devName = (id?: string) => {
    if (!id) return 'Lerret';
    const i = doc.devices.findIndex((d) => d.id === id);
    return i >= 0 ? `${DEVICE_LABELS[doc.devices[i].variant]}${doc.devices.length > 1 ? ` ${i + 1}` : ''}` : 'Lerret';
  };

  return (
    <div>
      <Collapsible title="Illustrasjon">

      {doc.mindmap ? (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: FS_SM, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 8px' }}>
            Produkt-mind map (Mermaid). Rediger kilden — rendres i merkevarefargene.
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
        <p style={{ fontSize: FS_SM, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 10px' }}>
          Forklar produktet: callouts som peker på UI, en zoom-lupe på detaljen, eller en markør-ramme.
          <br /><span style={{ opacity: 0.8 }}>Tips: «🧠 Produkt-mind map fra URL» (Fra nettside) lager en mind map-slide.</span>
        </p>
      )}
      <button
        onClick={() => void runAiIllustrate()}
        disabled={aiBusy || !hasScreen}
        style={{ ...actionBtn, width: '100%', marginBottom: 6, opacity: aiBusy || !hasScreen ? 0.55 : 1 }}
        title={hasScreen ? 'La AI finne UI-regioner og skrive funksjonstekst fra produktskjermen' : 'Legg inn en produktskjerm i en enhet først'}
      >
        {aiBusy ? 'Illustrerer…' : 'AI-illustrer produktskjermen'}
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button onClick={() => addAnnotation('callout', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Callout</button>
        <button onClick={() => addAnnotation('loupe', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Lupe</button>
        <button onClick={() => addAnnotation('marker', devTarget)} style={{ ...listBtn, flex: 1 }}>+ Markør</button>
      </div>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 6px' }}>Kampanje-elementer (hjørne-badge/pill/koblingslinje — lerret-relative, ikke festet til en enhet):</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => addAnnotation('step', undefined)} style={{ ...listBtn, flex: 1 }}>+ Trinn</button>
        <button onClick={() => addAnnotation('pill', undefined)} style={{ ...listBtn, flex: 1 }}>+ Pill</button>
        <button onClick={() => addAnnotation('connector', undefined)} style={{ ...listBtn, flex: 1 }}>+ Kobling</button>
      </div>

      {anns.length === 0 && <p style={{ fontSize: FS_SM, color: C.inkSoft }}>Ingen annotasjoner ennå.</p>}

      {anns.map((a) => (
        <div key={a.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8, background: C.panelSoft }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: FS, fontWeight: 700 }}>{a.kind === 'callout' ? `${a.n}. ` : ''}{KIND_LABEL[a.kind]}</span>
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

          {a.kind === 'step' && (
            <>
              <label style={{ fontSize: 11, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Tall i badge
                <input type="number" min={1} value={a.n ?? 1} onChange={(e) => patchAnnotation(a.id, { n: Math.max(1, Number(e.target.value)) })} style={{ ...textInput, width: 56, display: 'block', marginTop: 2 }} />
              </label>
              <label style={{ fontSize: 11, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Størrelse: {Math.round((a.scale ?? 1) * 100)}%
                <input type="range" min={0.5} max={2} step={0.05} value={a.scale ?? 1} onChange={(e) => patchAnnotation(a.id, { scale: Number(e.target.value) })} style={{ width: '100%' }} />
              </label>
            </>
          )}

          {a.kind === 'pill' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={a.glyph ?? ''} onChange={(e) => patchAnnotation(a.id, { glyph: e.target.value })} placeholder="Ikon (f.eks. ✓ ⌂ 📋)" style={{ ...textInput, width: 70 }} title="Ikon-glyph (unicode)" />
                <input value={a.label ?? ''} onChange={(e) => patchAnnotation(a.id, { label: e.target.value })} placeholder="Tittel" style={{ ...textInput, flex: 1 }} />
              </div>
              <input value={a.label2 ?? ''} onChange={(e) => patchAnnotation(a.id, { label2: e.target.value })} placeholder="Undertekst" style={{ ...textInput, width: '100%', marginBottom: 6 }} />
            </>
          )}

          {a.kind === 'connector' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>X2: {Math.round((a.fx2 ?? a.fx) * 100)}%
                  <input type="range" min={0} max={1} step={0.01} value={a.fx2 ?? a.fx} onChange={(e) => patchAnnotation(a.id, { fx2: Number(e.target.value) })} style={{ width: '100%' }} />
                </label>
                <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>Y2: {Math.round((a.fy2 ?? a.fy) * 100)}%
                  <input type="range" min={0} max={1} step={0.01} value={a.fy2 ?? a.fy} onChange={(e) => patchAnnotation(a.id, { fy2: Number(e.target.value) })} style={{ width: '100%' }} />
                </label>
              </div>
              <label style={{ fontSize: 11, color: C.inkSoft, display: 'block', marginBottom: 4 }}>Bue: {Math.round((a.curve ?? 0) * 1000) / 10}%
                <input type="range" min={-0.15} max={0.15} step={0.005} value={a.curve ?? 0} onChange={(e) => patchAnnotation(a.id, { curve: Number(e.target.value) })} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 11, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Størrelse (linje + prikk): {Math.round((a.scale ?? 1) * 100)}%
                <input type="range" min={0.5} max={2} step={0.05} value={a.scale ?? 1} onChange={(e) => patchAnnotation(a.id, { scale: Number(e.target.value) })} style={{ width: '100%' }} />
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>X: {Math.round(a.fx * 100)}%
              <input type="range" min={0} max={1} step={0.01} value={a.fx} onChange={(e) => patchAnnotation(a.id, { fx: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
            <label style={{ fontSize: 11, color: C.inkSoft, flex: 1 }}>Y: {Math.round(a.fy * 100)}%
              <input type="range" min={0} max={1} step={0.01} value={a.fy} onChange={(e) => patchAnnotation(a.id, { fy: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
          </div>
          {(a.kind === 'marker' || a.kind === 'callout' || a.kind === 'loupe') && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginTop: 6, cursor: 'pointer' }} title="Elementet er alltid fullt synlig ved avspilling/eksport — deltar ikke i inn-avsløringen">
              <input type="checkbox" checked={!!a.noReveal} onChange={(e) => patchAnnotation(a.id, { noReveal: e.target.checked })} />
              Ikke animer (alltid synlig)
            </label>
          )}
        </div>
      ))}
      </Collapsible>
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

/** Frittstående bilde-element: størrelse, radius, tilpasning, rotasjon, skygge, lag, slett. */
/** Delt av ImageInspector og DeviceInspector: chat-samtale-editor (flere spørsmål/svar-runder, auto-scroll i motion-eksport). */
function ChatTypeField({ chatType, onChange }: { chatType: import('./mockupStudioModel').ChatTypeConfig | undefined; onChange: (v: import('./mockupStudioModel').ChatTypeConfig | undefined) => void }) {
  const patchTurn = (i: number, patch: Partial<import('./mockupStudioModel').ChatTurn>) => {
    if (!chatType) return;
    onChange({ ...chatType, turns: chatType.turns.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };
  return (
    <Field label="Chat-samtale (spørsmål → svar, prikker → tekst, auto-scroll)">
      <label style={checkRow}>
        <input type="checkbox" checked={!!chatType} onChange={(e) => onChange(e.target.checked ? { speed: 'normal', turns: [{ question: 'Kan du fortelle litt om...', reply: 'Ja, det er...' }] } : undefined)} />
        Spill av som chat i motion-eksport
      </label>
      {chatType && (
        <>
          {chatType.turns.map((turn, i) => (
            <div key={i} style={{ marginTop: 8, paddingTop: 8, borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: FS_SM, color: C.inkSoft, marginBottom: 4 }}>Runde {i + 1}</div>
              <textarea value={turn.question} onChange={(e) => patchTurn(i, { question: e.target.value })}
                rows={2} style={{ ...textInput, width: '100%', resize: 'vertical' }} placeholder="Spørsmål (innkommende, venstre)…" />
              <textarea value={turn.reply ?? ''} onChange={(e) => patchTurn(i, { reply: e.target.value || undefined })}
                rows={2} style={{ ...textInput, width: '100%', resize: 'vertical', marginTop: 4 }} placeholder="Svar (utgående, høyre — valgfritt)…" />
              {chatType.turns.length > 1 && (
                <button onClick={() => onChange({ ...chatType, turns: chatType.turns.filter((_, idx) => idx !== i) })}
                  style={{ ...listBtn, marginTop: 4, fontSize: FS_SM }}>✕ Fjern runde</button>
              )}
            </div>
          ))}
          <button onClick={() => onChange({ ...chatType, turns: [...chatType.turns, { question: '', reply: '' }] })}
            style={{ ...listBtn, width: '100%', marginTop: 8 }}>+ Legg til runde</button>
          <div style={{ marginTop: 8 }}>
            <Segmented<ChatTypeSpeed>
              options={(Object.keys(CHAT_TYPE_SPEEDS) as ChatTypeSpeed[]).map((sp) => [sp, CHAT_TYPE_SPEED_LABELS[sp]])}
              value={chatType.speed}
              onChange={(v) => onChange({ ...chatType, speed: v })}
            />
          </div>
        </>
      )}
    </Field>
  );
}

type PersonColorKey = 'skin' | 'hair' | 'shirt' | 'accent';
const PERSON_STYLE_DEFAULTS: Record<PersonColorKey, string> = { skin: '#e0a878', hair: '#2a2f3d', shirt: '#1b294b', accent: '#c9963b' };
const PERSON_STYLE_LABELS: Record<PersonColorKey, string> = { skin: 'Hud', hair: 'Hår', shirt: 'Klær', accent: 'Aksent' };

/** Live miniatyr av person-laptop-riggen — sampler image.kf ved t=0 og redraw ved hver endring
 *  (style ELLER keyframe), så du ser figuren mens du drar i kurvene istedenfor å gjette tall. */
function PersonThumbnail({ kf, style }: { kf: Record<string, import('./mockupStudioModel').Keyframe[]> | undefined; style: PersonStyle | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const kfv = <K extends keyof PersonRigPose>(prop: K, def: number): number => (kf ? (sampleKf(kf[prop], 0) ?? def) : def);
    const pose: PersonRigPose = {
      armSwing: kfv('armSwing', DEFAULT_RIG_POSE.armSwing),
      fingerTap: kfv('fingerTap', DEFAULT_RIG_POSE.fingerTap),
      screenActivity: kfv('screenActivity', DEFAULT_RIG_POSE.screenActivity),
      blink: kfv('blink', DEFAULT_RIG_POSE.blink),
      headTilt: kfv('headTilt', DEFAULT_RIG_POSE.headTilt),
      mouthCurve: kfv('mouthCurve', DEFAULT_RIG_POSE.mouthCurve),
      eyeSize: kfv('eyeSize', DEFAULT_RIG_POSE.eyeSize),
      bodyBob: kfv('bodyBob', DEFAULT_RIG_POSE.bodyBob),
      leanX: kfv('leanX', DEFAULT_RIG_POSE.leanX),
      browRaise: kfv('browRaise', DEFAULT_RIG_POSE.browRaise),
      tears: kfv('tears', DEFAULT_RIG_POSE.tears),
      legSwing: kfv('legSwing', DEFAULT_RIG_POSE.legSwing),
    };
    drawPersonLaptop(ctx, 0, 0, canvas.width, canvas.height, pose, style);
  }, [kf, style]);
  return <canvas ref={canvasRef} width={100} height={127} style={{ borderRadius: 8, background: '#faf6ee', display: 'block', margin: '0 auto' }} />;
}

/** Fargevelgere for person-laptop-riggen (hud/hår/klær/aksent) — hvert felt valgfritt, mangler felt → standardpalett. */
function PersonStylePicker({ style, onChange }: { style: PersonStyle | undefined; onChange: (v: PersonStyle | undefined) => void }) {
  const set = (key: keyof PersonStyle, v: string) => {
    const next = { ...style, [key]: v };
    onChange(next);
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {(Object.keys(PERSON_STYLE_DEFAULTS) as PersonColorKey[]).map((key) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: FS_SM, color: C.inkSoft }}>
            {PERSON_STYLE_LABELS[key]}
            <input type="color" value={style?.[key] || PERSON_STYLE_DEFAULTS[key]} onChange={(e) => set(key, e.target.value)}
              style={{ width: 32, height: 24, padding: 0, border: `1px solid ${C.border}`, borderRadius: 4, background: 'none', cursor: 'pointer' }} />
          </label>
        ))}
      </div>
      <Segmented<NonNullable<PersonStyle['outfit']>>
        options={(Object.keys(PERSON_OUTFIT_LABELS) as NonNullable<PersonStyle['outfit']>[]).map((o) => [o, PERSON_OUTFIT_LABELS[o]])}
        value={style?.outfit || 'genser'}
        onChange={(outfit) => onChange({ ...style, outfit })}
      />
      <div style={{ height: 6 }} />
      <Segmented<NonNullable<PersonStyle['hairStyle']>>
        options={(Object.keys(PERSON_HAIR_LABELS) as NonNullable<PersonStyle['hairStyle']>[]).map((o) => [o, PERSON_HAIR_LABELS[o]])}
        value={style?.hairStyle || 'kort'}
        onChange={(hairStyle) => onChange({ ...style, hairStyle })}
      />
      <div style={{ height: 6 }} />
      <Segmented<NonNullable<PersonStyle['accessory']>>
        options={(Object.keys(PERSON_ACCESSORY_LABELS) as NonNullable<PersonStyle['accessory']>[]).map((o) => [o, PERSON_ACCESSORY_LABELS[o]])}
        value={style?.accessory || 'ingen'}
        onChange={(accessory) => onChange({ ...style, accessory })}
      />
      <div style={{ height: 6 }} />
      <Segmented<NonNullable<PersonStyle['scenario']>>
        options={(Object.keys(PERSON_SCENARIO_LABELS) as NonNullable<PersonStyle['scenario']>[]).map((o) => [o, PERSON_SCENARIO_LABELS[o]])}
        value={style?.scenario || 'laptop'}
        onChange={(scenario) => onChange({ ...style, scenario })}
      />
    </div>
  );
}

const STEP_STATE_LABEL: Record<PreVisitStepState, string> = { done: 'Fullført', active: 'Aktiv', todo: 'Ikke startet' };

/** Redigerer for det genererte falske PreVisit-kortet: tittel/undertekst/knapp-tekst
 *  + stegliste (legg til/fjern/endre navn+status). Regenererer SVG-en live på hver endring. */
function PreVisitCardEditor({ content, onChange }: { content: PreVisitCardContent; onChange: (c: PreVisitCardContent) => void }) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 10, marginBottom: 10 }}>
      <SectionLabel>PreVisit-kort (falsk skjerm)</SectionLabel>
      <Field label="Overskrift">
        <input value={content.title} onChange={(e) => onChange({ ...content, title: e.target.value })} style={{ ...textInput, width: '100%' }} />
      </Field>
      <Field label="Undertekst">
        <input value={content.subtitle} onChange={(e) => onChange({ ...content, subtitle: e.target.value })} style={{ ...textInput, width: '100%' }} />
      </Field>
      <Field label="Knappetekst">
        <input value={content.buttonText} onChange={(e) => onChange({ ...content, buttonText: e.target.value })} style={{ ...textInput, width: '100%' }} />
      </Field>
      <Field label={`Steg (${content.steps.length})`}>
        {content.steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input
              value={s.label}
              onChange={(e) => onChange({ ...content, steps: content.steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              style={{ ...textInput, flex: 1 }}
            />
            <select
              value={s.state}
              onChange={(e) => onChange({ ...content, steps: content.steps.map((x, j) => (j === i ? { ...x, state: e.target.value as PreVisitStepState } : x)) })}
              style={{ ...textInput, width: 92 }}
            >
              {(Object.keys(STEP_STATE_LABEL) as PreVisitStepState[]).map((st) => <option key={st} value={st}>{STEP_STATE_LABEL[st]}</option>)}
            </select>
            <button
              onClick={() => onChange({ ...content, steps: content.steps.filter((_, j) => j !== i) })}
              disabled={content.steps.length <= 1}
              style={{ ...listBtn, width: 26, textAlign: 'center', padding: '4px 0', opacity: content.steps.length <= 1 ? 0.4 : 1 }}
              title="Fjern steg" aria-label="Fjern steg"
            >✕</button>
          </div>
        ))}
        <button
          onClick={() => onChange({ ...content, steps: [...content.steps, { label: 'Nytt steg', state: 'todo' }] })}
          style={{ ...listBtn, width: '100%' }}
        >+ Steg</button>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, marginTop: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!content.animateSteps} onChange={(e) => onChange({ ...content, animateSteps: e.target.checked })} />
        {' '}Animer steg (flyt — hvert steg popper inn étt og étt langs tidslinjen)
      </label>
    </div>
  );
}

function ImageInspector({ image }: { image: import('./mockupStudioModel').MockupImageSlot }) {
  const patchImage = useMockupStudio((s) => s.patchImage);
  const removeImage = useMockupStudio((s) => s.removeImage);
  const playT = useMockupStudio((s) => s.playT);
  const doc = useMockupStudio((s) => s.doc);
  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const onImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { if (typeof r.result === 'string') patchImage(image.id, { image: r.result }); };
    r.readAsDataURL(f);
  };
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  // Manuell video-import PÅ dette eksisterende bilde-elementet (i motsetning til
  // Shell sin onVideoPicked, som legger til et HELT NYTT element) — beholder
  // x/y/w/h/fit. `image` (poster fra første frame) er statisk fallback.
  const onVideoFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.playsInline = true;
    await new Promise<void>((resolve, reject) => { v.onloadeddata = () => resolve(); v.onerror = () => reject(new Error('Kunne ikke lese videofilen')); });
    v.currentTime = 0;
    await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const poster = canvas.toDataURL('image/jpeg', 0.85);
    patchImage(image.id, { video: url, image: poster });
  };
  const [seedPrompt, setSeedPrompt] = useState('cheese-pull');
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const runSeedance = async () => {
    setSeedErr(null); setSeedBusy(true);
    try {
      const path = await generateCraveClip({ imageDataUrl: image.image, promptId: seedPrompt, refId: image.id, resolution: '720p' });
      patchImage(image.id, { video: path });
    } catch (e) { setSeedErr(String(e instanceof Error ? e.message : e)); } finally { setSeedBusy(false); }
  };
  const isIllustration = !!image.illustration;
  const isPersonRig = image.illustration === 'person-laptop';
  const isBackdrop = image.illustration === 'office-backdrop' || image.illustration === 'waiting-room-backdrop';
  return (
    <div>
      <SectionLabel>{isBackdrop ? 'Bakgrunn' : isIllustration ? 'Illustrasjon' : 'Bilde'}</SectionLabel>
      {isPersonRig ? (
        <>
          <div style={{ borderRadius: 8, marginBottom: 10, padding: '10px 0', background: C.panelSoft }}>
            <PersonThumbnail kf={image.kf} style={image.personStyle} />
          </div>
          {(() => {
            const backdrop = doc.images?.find((im) => im.illustration === 'office-backdrop' || im.illustration === 'waiting-room-backdrop');
            const anchors = backdrop ? BACKDROP_ANCHORS[backdrop.illustration as 'office-backdrop' | 'waiting-room-backdrop'] : undefined;
            if (!backdrop || !anchors) return null;
            return (
              <Field label="Plasser ved anker (unngår møbel-kollisjon)">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {anchors.map((a) => (
                    <button key={a.id} onClick={() => patchImage(image.id, {
                      x: Math.round(backdrop.x + a.fx * backdrop.w),
                      y: Math.round(backdrop.y + a.fy * backdrop.h),
                      w: Math.round(a.fw * backdrop.w),
                      h: Math.round(a.fh * backdrop.h),
                    })} style={{ ...listBtn, flex: '1 1 auto', fontSize: FS_SM }}>{a.label}</button>
                  ))}
                </div>
              </Field>
            );
          })()}
          <Field label="Rolle (setter antrekk/farge/tilbehør samlet — overstyrbart etterpå)">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PERSON_ROLE_PRESETS.map((p) => (
                <button key={p.id} onClick={() => patchImage(image.id, { personStyle: { ...image.personStyle, ...p.style } })}
                  style={{ ...listBtn, flex: '1 1 auto', fontSize: FS_SM }}>{p.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Uttrykk (setter munn/bryn/øyne/tårer samlet — overstyrbart etterpå)">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {EXPRESSION_PRESETS.map((p) => (
                <button key={p.id} onClick={() => {
                  const next = { ...(image.kf ?? {}) };
                  (Object.keys(p.values) as (keyof PersonRigPose)[]).forEach((k) => { next[k] = [{ t: 0, v: p.values[k]! }]; });
                  patchImage(image.id, { kf: next });
                }} style={{ ...listBtn, flex: '1 1 auto', fontSize: FS_SM }}>{p.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Klær og farger">
            <PersonStylePicker style={image.personStyle} onChange={(personStyle) => patchImage(image.id, { personStyle })} />
          </Field>
        </>
      ) : isBackdrop ? (
        <div style={{ width: '100%', borderRadius: 8, marginBottom: 10, padding: '18px 10px', textAlign: 'center', background: C.panelSoft, fontSize: FS_SM, color: C.inkSoft }}>
          🏥 {image.illustration === 'waiting-room-backdrop' ? 'Venteværelse' : 'Legekontor'}-bakgrunn — tegnet direkte på lerretet, ligger alltid bak personer.
        </div>
      ) : (
        <>
          <img src={image.image} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 10, maxHeight: 130, objectFit: 'cover', display: 'block' }} />
          <button onClick={() => imgFileInputRef.current?.click()} style={{ ...listBtn, width: '100%', marginBottom: 10 }}>Bytt bilde</button>
          <input ref={imgFileInputRef} type="file" accept="image/*" onChange={onImageFilePicked} style={{ display: 'none' }} />
        </>
      )}
      {image.cardContent && (
        <>
          <PreVisitCardEditor content={image.cardContent} onChange={(content) => patchImage(image.id, { cardContent: content, image: previsitUiCardImage(content, doc.canvas.accent, doc.canvas.accent2) })} />
          <button
            onClick={() => patchImage(image.id, { image: previsitUiCardImage(image.cardContent, doc.canvas.accent, doc.canvas.accent2) })}
            style={{ ...listBtn, width: '100%', marginBottom: 10 }}
            title="Kortet henter IKKE fargene automatisk når du endrer Accent 1/2 — trykk her etterpå for å synke det"
          >↻ Oppdater kort-farger fra Accent 1/2</button>
        </>
      )}
      {image.infoCardContent && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 10, marginBottom: 10 }}>
          <SectionLabel>Info-kort</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!image.infoCardContent.animateRows}
              onChange={(e) => {
                const content: PreVisitInfoCardContent = { ...image.infoCardContent!, animateRows: e.target.checked };
                patchImage(image.id, { infoCardContent: content, image: previsitInfoCardImage({ ...content, primary: doc.canvas.accent, accent: doc.canvas.accent2 }) });
              }}
            />
            {' '}Animer rader (flyt — hver rad popper inn étt og étt langs tidslinjen)
          </label>
        </div>
      )}
      {image.formListContent && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 10, marginBottom: 10 }}>
          <SectionLabel>Skjema-kort</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!image.formListContent.animateRows}
              onChange={(e) => {
                const content: PreVisitFormListContent = { ...image.formListContent!, animateRows: e.target.checked };
                patchImage(image.id, { formListContent: content, image: previsitFormListCardImage(content.fields, content.buttonText, doc.canvas.accent, doc.canvas.accent2, content.animateRows) });
              }}
            />
            {' '}Animer rader (flyt — hver rad popper inn étt og étt langs tidslinjen)
          </label>
        </div>
      )}
      {image.solidColor && (
        <Field label="Farge">
          <ColorRow value={image.solidColor} onChange={(v) => patchImage(image.id, { solidColor: v, image: placeholderImage('', v, v) })} />
        </Field>
      )}
      <Field label="Størrelse (px)">
        <div style={{ display: 'flex', gap: 6 }}>
          <NumberBox label="B" value={Math.round(image.w)} onChange={(n) => patchImage(image.id, { w: Math.max(20, n) })} />
          <NumberBox label="H" value={Math.round(image.h)} onChange={(n) => patchImage(image.id, { h: Math.max(20, n) })} />
        </div>
      </Field>
      <Field label={`Hjørne-radius (${Math.round(image.radius)}px)`}>
        <input type="range" min={0} max={120} value={image.radius} onChange={(e) => patchImage(image.id, { radius: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      {!isIllustration && (
        <Field label="Tilpasning">
          <Segmented<'cover' | 'contain'> options={[['cover', 'Fyll'], ['contain', 'Hele bildet']]} value={image.fit} onChange={(v) => patchImage(image.id, { fit: v })} />
        </Field>
      )}
      <Field label={`Rotasjon (${Math.round(image.rotation)}°)`}>
        <input type="range" min={-45} max={45} value={image.rotation} onChange={(e) => patchImage(image.id, { rotation: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <label style={checkRow}><input type="checkbox" checked={image.shadow} onChange={(e) => patchImage(image.id, { shadow: e.target.checked })} /> Skygge</label>
      <label style={checkRow} title="Elementet er alltid fullt synlig ved avspilling/eksport — deltar ikke i inn-avsløringen">
        <input type="checkbox" checked={!!image.noReveal} onChange={(e) => patchImage(image.id, { noReveal: e.target.checked })} /> Ikke animer (alltid synlig)
      </label>
      <Field label="Animasjon — posisjon/rotasjon/skala/synlighet">
        <MockupKeyframeGraph value={image.kf} playT={playT} props={IMAGE_TRANSFORM_PROPS} onChange={(kf) => patchImage(image.id, { kf })} />
      </Field>
      {isPersonRig && (
        <Field label="Animasjon — figur-rigg (hender, fingre, blunk, skjerm)">
          <MockupKeyframeGraph value={image.kf} playT={playT} props={PERSON_RIG_PROPS} onChange={(kf) => patchImage(image.id, { kf })} />
        </Field>
      )}
      {image.sprite && (
        <Field label="Sprite-sekvens (ekte 3D-render)">
          <div style={{ fontSize: FS_SM, color: '#4ade80' }}>
            ✓ {image.sprite.frames.length} rammer @ {image.sprite.fps} fps — bytter frame under videoeksport{'. '}
            <button onClick={() => patchImage(image.id, { sprite: undefined })} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: FS_SM }}>fjern</button>
          </div>
          <NumberBox label="fps" value={image.sprite.fps} onChange={(n) => patchImage(image.id, { sprite: { ...image.sprite!, fps: Math.max(1, n) } })} />
        </Field>
      )}
      {!isIllustration && <ChatTypeField chatType={image.chatType} onChange={(chatType) => patchImage(image.id, { chatType })} />}
      {!isIllustration && (
        <Field label="Video">
          <button onClick={() => videoFileInputRef.current?.click()} style={{ ...listBtn, width: '100%' }}>{image.video ? 'Bytt video' : '📼 Last opp video'}</button>
          <input ref={videoFileInputRef} type="file" accept="video/*" onChange={(e) => void onVideoFilePicked(e)} style={{ display: 'none' }} />
        </Field>
      )}
      {!isIllustration && (
        <Field label="Animer (Seedance i2v — craveable)">
          <select value={seedPrompt} onChange={(e) => setSeedPrompt(e.target.value)} style={textInput}>
            {SEEDANCE_PROMPTS.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
          </select>
          <button onClick={() => void runSeedance()} disabled={seedBusy || !aiAvailable()}
            style={{ ...actionBtn, width: '100%', marginTop: 6, opacity: seedBusy || !aiAvailable() ? 0.6 : 1 }}
            title={aiAvailable() ? `Seedance i2v fra dette fotoet → craveable klipp · ~${seedanceCreditEstimate('720p', 3)} kreditter (3s 720p)` : 'Krever innlogget AI (RR-token) + kreditter'}>
            {seedBusy ? 'Genererer klipp…' : image.video ? '↻ Regenerer klipp' : '🎬 Animer'}
          </button>
          {image.video && <div style={{ fontSize: FS_SM, color: '#4ade80', marginTop: 4 }}>✓ Klipp koblet — spilles i preview{'. '}<button onClick={() => patchImage(image.id, { video: undefined })} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: FS_SM }}>fjern</button></div>}
          {seedErr && <div style={{ fontSize: 11.5, color: '#e0b060', marginTop: 4 }}>{seedErr}</div>}
        </Field>
      )}
      <div style={{ height: 8 }} />
      <ArrangeRow kind="image" id={image.id} />
      <button onClick={() => removeImage(image.id)} style={{ ...dangerBtn, marginTop: 8 }}>Slett bilde</button>
    </div>
  );
}

/** Lag-rad: dupliser + z-rekkefølge (delt av enhet/tekst/bilde-inspektør). */
function ArrangeRow({ kind, id }: { kind: 'device' | 'text' | 'image'; id: string }) {
  const dupDevice = useMockupStudio((s) => s.duplicateDevice);
  const dupText = useMockupStudio((s) => s.duplicateText);
  const dupImage = useMockupStudio((s) => s.duplicateImage);
  const reorder = useMockupStudio((s) => s.reorderElement);
  const dup = () => (kind === 'device' ? dupDevice(id) : kind === 'image' ? dupImage(id) : dupText(id));
  return (
    <Field label="Lag">
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={dup} style={{ ...listBtn, flex: 1 }} title="Dupliser (Cmd/Ctrl+D)">⧉ Dupliser</button>
        <button onClick={() => reorder(kind, id, 'up')} style={{ ...listBtn, width: 36, textAlign: 'center' }} title="Flytt fram (tegnes over)" aria-label="Flytt fram">↑</button>
        <button onClick={() => reorder(kind, id, 'down')} style={{ ...listBtn, width: 36, textAlign: 'center' }} title="Flytt bak" aria-label="Flytt bak">↓</button>
      </div>
    </Field>
  );
}

function DeviceInspector({ device, onUpload, advanced }: { device: import('./mockupStudioModel').MockupDeviceSlot; onUpload: () => void; advanced: boolean }) {
  const doc = useMockupStudio((s) => s.doc);
  const patchDevice = useMockupStudio((s) => s.patchDevice);
  const setDeviceImage = useMockupStudio((s) => s.setDeviceImage);
  const removeDevice = useMockupStudio((s) => s.removeDevice);
  const playT = useMockupStudio((s) => s.playT);
  const [simBusy, setSimBusy] = useState(false);
  const [simMsg, setSimMsg] = useState<string | null>(null);
  // Fang skjermen fra en bootet iOS-simulator som device-innhold (ekte app-skjerm).
  const runSimCapture = async () => {
    if (simBusy) return;
    setSimBusy(true); setSimMsg('Henter fra simulator…');
    try {
      const sims = await listSimulators();
      if (sims.length === 0) { setSimMsg('Ingen bootet simulator. Start én i Simulator/Xcode.'); return; }
      const target = sims[0];
      const dataUrl = await captureSimShot(target.udid);
      setDeviceImage(device.id, dataUrl);
      setSimMsg(`✓ Fanget fra ${target.label}${sims.length > 1 ? ` (+${sims.length - 1} flere bootet)` : ''}.`);
    } catch (e) {
      setSimMsg(`Sim-fangst gikk ikke: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSimBusy(false); }
  };
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
          <button onClick={() => void runSimCapture()} disabled={simBusy} style={{ ...listBtn, flex: 1, opacity: simBusy ? 0.6 : 1 }} title="Fang skjermen fra en bootet iOS-simulator som device-innhold (ekte app-skjerm)">{simBusy ? 'Henter…' : 'Fra sim'}</button>
          {device.image && <button onClick={() => setDeviceImage(device.id, undefined)} style={listBtn} title="Fjern bilde" aria-label="Fjern bilde">✕</button>}
        </div>
        {simMsg && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>{simMsg}</div>}
      </Field>
      {device.checklistContent && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 10, marginBottom: 10 }}>
          <SectionLabel>Sjekkliste-skjerm</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!device.checklistContent.animate}
              onChange={(e) => {
                const content: PreVisitChecklistContent = { ...device.checklistContent!, animate: e.target.checked };
                patchDevice(device.id, { checklistContent: content, image: previsitPhoneScreenImage(content, doc.canvas.accent) });
              }}
            />
            {' '}Animer sjekkliste (flyt — hver rad popper inn étt og étt langs tidslinjen)
          </label>
        </div>
      )}
      {device.dashboardContent && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 10, marginBottom: 10 }}>
          <SectionLabel>Dashboard-skjerm</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_SM, color: C.inkSoft, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!device.dashboardContent.animate}
              onChange={(e) => {
                const content: PreVisitDashboardContent = { ...device.dashboardContent!, animate: e.target.checked };
                patchDevice(device.id, { dashboardContent: content, image: previsitDashboardScreenImage(content, doc.canvas.accent, doc.canvas.accent2) });
              }}
            />
            {' '}Animer felt-grid (flyt — hvert felt popper inn étt og étt langs tidslinjen)
          </label>
        </div>
      )}
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
      <ChatTypeField chatType={device.chatType} onChange={(chatType) => patchDevice(device.id, { chatType })} />
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
          {device.threeD && (
            <Field label="Keyframe-animasjon (kurve over tid)">
              <MockupKeyframeGraph value={device.threeD.kf} playT={playT} onChange={(kf) => patchDevice(device.id, { threeD: { ...device.threeD!, kf } })} />
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
              <select
                value=""
                onChange={(e) => { const p = TYPE_PRESETS.find((x) => x.id === e.target.value); if (p) patchDevice(device.id, { typeAnim: { ...p.cfg } }); e.currentTarget.selectedIndex = 0; }}
                style={{ ...textInput, marginBottom: 6 }}
                title="Ett-klikks scenario (setter tekst + felt + payoff ferdig)"
              >
                <option value="">Scenario…</option>
                {TYPE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <input
                type="text"
                value={device.typeAnim?.text ?? ''}
                onChange={(e) => patchDevice(device.id, { typeAnim: e.target.value ? { ...device.typeAnim, text: e.target.value } : undefined })}
                placeholder="F.eks. Hei verden — tastene trykkes"
                style={textInput}
              />
            </Field>
          )}
          {device.threeD && device.typeAnim?.text && (
            <>
              <Field label="Felt-kontekst">
                <select value={device.typeAnim.field ?? 'plain'} onChange={(e) => patchDevice(device.id, { typeAnim: { ...device.typeAnim!, field: e.target.value as import('./mockupStudioModel').MockupFieldStyle } })} style={textInput}>
                  <option value="plain">Enkel</option><option value="search">Søkefelt</option><option value="chat">Chat</option>
                  <option value="url">URL-linje</option><option value="document">Dokument</option><option value="code">Kode</option><option value="terminal">Terminal</option>
                </select>
              </Field>
              <Field label="Placeholder (valgfri hint-tekst)">
                <input type="text" value={device.typeAnim.placeholder ?? ''} onChange={(e) => patchDevice(device.id, { typeAnim: { ...device.typeAnim!, placeholder: e.target.value || undefined } })} placeholder="F.eks. Søk…" style={textInput} />
              </Field>
              <label style={checkRow}><input type="checkbox" checked={!!device.typeAnim.keyPop} onChange={(e) => patchDevice(device.id, { typeAnim: { ...device.typeAnim!, keyPop: e.target.checked } })} /> Tastetrykk-pop (tast svever opp)</label>
              <label style={checkRow}><input type="checkbox" checked={!!device.typeAnim.payoff} onChange={(e) => patchDevice(device.id, { typeAnim: { ...device.typeAnim!, payoff: e.target.checked } })} /> Payoff (Enter → resultat)</label>
              <label style={checkRow}><input type="checkbox" checked={!!device.typeAnim.correct} onChange={(e) => patchDevice(device.id, { typeAnim: { ...device.typeAnim!, correct: e.target.checked } })} /> Korreksjon (typo → rett)</label>
            </>
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
      <label style={checkRow} title="Elementet er alltid fullt synlig ved avspilling/eksport — deltar ikke i inn-avsløringen">
        <input type="checkbox" checked={!!device.noReveal} onChange={(e) => patchDevice(device.id, { noReveal: e.target.checked })} />
        Ikke animer (alltid synlig)
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
          {vBusy ? 'Skriver…' : <span style={iconRow}><IcSparkle />Tekst-varianter</span>}
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
      <label style={checkRow} title="Elementet er alltid fullt synlig ved avspilling/eksport — deltar ikke i inn-avsløringen">
        <input type="checkbox" checked={!!text.noReveal} onChange={(e) => patchText(text.id, { noReveal: e.target.checked })} />
        Ikke animer (alltid synlig)
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
  // Skillelinje + luft over hver gruppe → panelet leses som distinkte seksjoner, ikke én vegg av knapper.
  return <div style={{ fontSize: FS_LABEL, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink, opacity: 0.82, marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.border}`, marginBottom: 10, fontWeight: 700 }}>{children}</div>;
}

// Kollapsbar seksjon: klikk overskriften for å skjule/vise gruppa → ryddigere, tett inspektør.
function Collapsible({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const key = `mockup.sect.${title}`;
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? defaultOpen : v === '1'; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem(key, n ? '1' : '0'); } catch { /* private mode */ } return n; });
  return (
    <div>
      <button onClick={toggle} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderTop: `1px solid ${C.border}`, marginTop: 18, paddingTop: 14, paddingBottom: 2, cursor: 'pointer', fontFamily: C.font }}>
        <span style={{ flex: 1, textAlign: 'left', fontSize: FS_LABEL, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink, opacity: 0.82, fontWeight: 700 }}>{title}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.inkSoft} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: FS_SM, color: C.inkSoft, marginBottom: 5 }}>{label}</div>
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
  background: C.panelSoft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: FS, fontFamily: C.font, width: '100%', boxSizing: 'border-box',
};
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: FS, cursor: 'pointer', fontFamily: C.font,
};
const primaryBtn: React.CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: FS, fontWeight: 700, cursor: 'pointer', fontFamily: C.font,
};
// Sekundær handlingsfarge: teal-omriss (ikke solid fyll) → underordnet Eksporter, men tydelig handling.
const actionBtn: React.CSSProperties = {
  background: 'rgba(34,211,238,0.10)', color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '8px 16px', fontSize: FS, fontWeight: 700, cursor: 'pointer', fontFamily: C.font,
};
const listBtn: React.CSSProperties = {
  background: C.panelSoft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: FS, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: C.font,
};
const dangerBtn: React.CSSProperties = {
  background: 'rgba(220,60,60,0.12)', color: '#f0a0a0', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 8, padding: '8px 10px', fontSize: FS, cursor: 'pointer', width: '100%', fontFamily: C.font,
};
const checkRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: FS, color: C.ink, cursor: 'pointer', marginBottom: 4,
};

// Ekte SVG-ikoner i stedet for emoji (arver knappefargen via currentColor).
const iconRow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, verticalAlign: 'middle' };
const svgProps = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { flexShrink: 0 } };
const IcSparkle = () => <svg {...svgProps}><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" /></svg>;
const IcNodes = () => <svg {...svgProps}><circle cx="5" cy="12" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M7 11l9-4M7 13l9 4" /></svg>;
const IcImage = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></svg>;

export default MockupStudioShell;
