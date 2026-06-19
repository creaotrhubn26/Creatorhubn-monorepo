/**
 * DemoStudioShell — Product Demo Studio (funksjonell). Piksel-matchet 5-sone
 * cream-editor-layout (fasit: Daniels mockup + docs/demo-studio/SPEC.md), nå
 * koblet til demoStudioStore med ekte interaksjon:
 *
 *   - Tom tilstand: URL-input → createProject → default scene-flow.
 *   - Senter: LIVE URL-preview i <iframe>, viewport-toggle (desktop/mobil) som
 *     setter bredde + scenens device. Scene-flow-kort under (klikkbare).
 *   - Høyre: Guide/Script/Notes — editerbare scene-felter (manus, action,
 *     enhet, varighet, overlay) bundet til storen.
 *   - Guided recorder: "Start opptak" → teleprompter-overlay med manuell
 *     Next/Done/Retake (continueMode: manual).
 *   - Story-modus: gjenbruker StoryView via demoStudioStoryAdapter.
 *
 * Verifiseres mot mockup med Playwright (scripts/_pixshot*).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StoryView } from '../story/StoryView';
import { ScriptBuilderView } from './ScriptBuilderView';
import { GuidedRecorderView } from './GuidedRecorderView';
import { ExportView } from './ExportView';
import { MarketingPanel } from './MarketingPanel';
import { ModuleGate } from '../ModuleGate';
import { hasModule, onEntitlementsChanged } from '../../entitlements';
import { LibraryPanel } from './LibraryPanel';
import { speak, cancelSpeech, getWebVoices, isWebSpeechSupported, type WebVoice } from './webSpeechVoiceover';
import { staticChecks, captureProbe, overallStatus, type Check } from './preflight';
import { FramedDevice, VIEWPORT_W } from './FramedDevice';
import { SceneInteractionOverlay } from './SceneInteractionOverlay';
import { type FrameVariant } from './deviceFrames';
import { isAiConnected } from '../../services/claudeProxyService';
import { RoleRoomSignInDialog } from '../RoleRoomSignInDialog';
import { useSceneRecorder } from './useSceneRecorder';
import { generateDemoFlow, completeDemoFlow, fetchSiteContext, analyzeSiteContext, runResponsiveCheck, healTarget, runDirectorCritic, ocrDetectElements, verifyOutcomeVision, interpretCommand, translateForVoiceover, suggestVisualBeats, type CommandResult, type VisualBeat, type SiteUnderstanding } from './demoStudioAI';
import { executeScript, playwrightStatus, playwrightCaptureShots, extractPdfText, systemOpen } from '../../api';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { runAutonomousDemo } from './autonomousDemo';
import { renderIntroCard, renderOutroCard, renderBrowserFrame } from './demoBranding';
import type { DemoFinalizeOpts } from '../../api';
import { isCaptureAvailable, startDemoCapture, onCaptureStep, onCaptureDone, scanDom, verifyAction, autoExecute, captureScreenshot, type CapturedStep } from '../../services/demoCaptureService';
import { useDemoStudio } from './demoStudioStore';
import {
  DEMO_TYPE_LABELS, DEMO_TYPE_FRIENDLY, DEMO_TYPE_TEMPLATES, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS,
  CAMERA_MOVE_LABELS, SCENE_TRANSITION_LABELS, type CameraMove, type SceneTransition,
  RENDER_OPTION_LABELS, RESPONSIVE_STATUS_LABELS, RESPONSIVE_STATUS_COLORS, ACTION_META,
  ACTION_MATCH_LABELS, ACTION_MATCH_COLORS, CRITIQUE_SEVERITY_COLORS,
  totalDuration, hasRecordedWork, defaultRenderOptions, captureStepsToScenes,
  sceneActionMatch, expectedActionText, validateScene, learnCtas, CTA_LABELS,
  recordLearnedTarget, learnedTargetCount, listLearnedTargetsForHost, removeLearnedTarget, syncLearnedTargetsFromBackend,
  clearLearnedTargets, detectLearnedDrift, pickShot, type LearnedTarget,
  type DemoScene, type DemoDevice, type DemoType, type DemoActionType, type DemoRenderOptions, type ResponsiveReport, type ResponsiveFix, type DirectorCritique, type DomScanResult,
} from './demoStudioModel';
import { demoScenesToPicks, demoChapters } from './demoStudioStoryAdapter';

const C = {
  bg: '#f3efe9', panel: '#ffffff', cream: '#faf7f2', creamActive: '#f3ece2',
  line: '#ece7df', lineStrong: '#ddd6cc', ink: '#1d1b19', inkSoft: '#6b6358',
  inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#3a2f2a', green: '#4a9d6b',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const NAV_ITEMS = [
  { id: 'create', label: 'Create Demo', ic: '▢' },
  { id: 'flow', label: 'Flow Builder', ic: '⤳' },
  { id: 'marketing', label: 'Marketing', ic: '◆' },
  { id: 'library', label: 'Bibliotek', ic: '▤' },
  { id: 'script', label: 'Script Builder', ic: '✎' },
  { id: 'recorder', label: 'Guided Recorder', ic: '●' },
  { id: 'preview', label: 'Device Preview', ic: '▭' },
  { id: 'export', label: 'Export', ic: '⤓' },
] as const;
type NavId = (typeof NAV_ITEMS)[number]['id'];

const DEMO_TYPE_ICON: Record<DemoType, string> = {
  product_demo: '▶', tutorial: '◉', onboarding: '✿', sales_video: '$',
  investor_demo: '▲', social_clip: '◆', support_guide: '?', feature_walkthrough: '⊞',
};

const DEVICE_LABEL: Record<DemoDevice, string> = { macbook: 'MacBook', ipad: 'iPad', iphone: 'iPhone' };
/** Bredde på preview-canvas per enhet (px) — desktop fyller, mobil/tablet smalere. */

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Tilgivende URL: legg til https:// hvis protokollen mangler, så brukeren
 * bare kan skrive «theroleroom.com». Tom streng forblir tom. Brukes både i
 * tom-tilstandens input og i topbarens URL-felt så de oppfører seg likt.
 */
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t;
}

export function DemoStudioShell({ onClose }: { onClose?: () => void } = {}) {
  const {
    project, selectedSceneId, recorderStepIndex,
    createProject, selectScene, updateScene, addScene, removeScene, replaceScenes,
    setSceneDevice, setProjectField, setDemoType: applyDemoTypeTemplate, setRenderOption, applyResponsiveFix,
    reorderScenes, startRecorder, nextStep, markCurrentDone, retakeCurrent, goToStep,
    loadExisting,
    undo, redo, canUndo, canRedo,
    selectedSceneIds, toggleSceneSelected, clearSceneSelection, removeSelectedScenes,
  } = useDemoStudio();

  // Gjenopprett lagret prosjekt ved oppstart (ellers virket alt arbeid borte).
  useEffect(() => { if (!project) loadExisting(); /* eslint-disable-next-line */ }, []);

  // #1 delt lærings-lager: flett inn kollektiv kunnskap for denne hosten når
  // demoen åpnes/URL endres, så healing + AI bruker det andre har lært.
  const syncedHostRef = useRef('');
  useEffect(() => {
    const u = project?.url;
    if (!u) return;
    let host = ''; try { host = new URL(u).host; } catch { return; }
    if (!host || host === syncedHostRef.current) return;
    syncedHostRef.current = host;
    void syncLearnedTargetsFromBackend(u);
  }, [project?.url]);

  // Edit Mode-hurtigtaster: undo/redo globalt; slett/velg-alle/escape kun når
  // man ikke skriver i et felt. ⌘/Ctrl bærer kommandoene.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const ids = useDemoStudio.getState().project?.scenes.map((s) => s.id) ?? [];
        useDemoStudio.setState({ selectedSceneIds: ids });
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && useDemoStudio.getState().selectedSceneIds.length) {
        e.preventDefault();
        removeSelectedScenes();
        return;
      }
      if (e.key === 'Escape') clearSceneSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, removeSelectedScenes, clearSceneSelection]);
  // Frigjør skjermdelings-streamen når shell unmountes.
  useEffect(() => () => rec.release(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Start web-opptak for scenen brukeren faktisk står på nå (fersk fra storen). */
  const startForCurrent = async () => {
    const st = useDemoStudio.getState();
    const sc = st.project?.scenes[st.recorderStepIndex];
    if (sc && st.project) await rec.start(st.project.id, sc.id);
  };

  const [nav, setNav] = useState<NavId>('flow');
  const [tab, setTab] = useState<'Guide' | 'Script' | 'Notes'>('Guide');
  const [storyMode, setStoryMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const rec = useSceneRecorder();
  const [urlInput, setUrlInput] = useState('');
  const [directorBusy, setDirectorBusy] = useState(false);
  const [directorMsg, setDirectorMsg] = useState<string | null>(null);
  // «Forstå siden først»: Claudes forståelse av produkt + målgruppe, vist som
  // en brief før noe lages — grunnlag for diskusjon/justering.
  const [understanding, setUnderstanding] = useState<SiteUnderstanding | null>(null);
  const [showTools, setShowTools] = useState(false); // sammenleggbare sekundære verktøy
  const [showAdvanced, setShowAdvanced] = useState(false); // sammenleggbart «Avansert» i Beskriv-steget
  const [generated, setGenerated] = useState(false); // har vi generert en demo i denne sesjonen?
  // «Generér ferdig demo» (autonom): TTS → Playwright-opptak → mux til ferdig mp4.
  const [demoVidBusy, setDemoVidBusy] = useState(false);
  const [demoVidMsg, setDemoVidMsg] = useState<string | null>(null);
  const [demoVidPct, setDemoVidPct] = useState(0);
  const [demoVidResult, setDemoVidResult] = useState<string | null>(null);
  const [demoVidScene, setDemoVidScene] = useState<{ index: number; total: number } | null>(null);
  const [demoVidQa, setDemoVidQa] = useState<Array<{ score: number; ok: boolean; issue: string } | null> | null>(null);
  const [demoVidScriptQa, setDemoVidScriptQa] = useState<{ score: number; ok: boolean; framework: string; missing: string[]; issue: string } | null>(null);
  const [brandedOutput, setBrandedOutput] = useState(true); // intro/outro + ramme på autonom video
  const [elevenKey, setElevenKeyState] = useState<string>(() => { try { return localStorage.getItem('trrpa.eleven_key') || ''; } catch { return ''; } });
  const setElevenKey = (v: string) => { setElevenKeyState(v); try { localStorage.setItem('trrpa.eleven_key', v); } catch { /* */ } };
  /** Bygg branding (ramme + intro/outro PNG-er) fra prosjekt + forståelse. */
  const buildFinalize = (): DemoFinalizeOpts | undefined => {
    if (!brandedOutput || !project) return undefined;
    const brandName = project.branding?.brandName || (() => { try { return new URL(project.url).host.replace(/^www\./, '').split('.')[0]; } catch { return project.name || 'Demo'; } })();
    const color = project.branding?.brandColor;
    const tagline = understanding?.summary;
    const frame = renderBrowserFrame({ url: project.url });
    return {
      framePng: frame.png, frameX: frame.rect.x, frameY: frame.rect.y, frameW: frame.rect.w, frameH: frame.rect.h,
      introPng: renderIntroCard({ brandName, tagline, color }),
      outroPng: renderOutroCard({ brandName, url: project.url, color }),
      introSec: 2.6, outroSec: 2.6,
    };
  };
  // Product Brain: les en produkt-PDF (one-pager) inn i AI-konteksten.
  const [docBusy, setDocBusy] = useState(false);
  const pickProductDoc = async () => {
    if (!project) return;
    try {
      const sel = await openFileDialog({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      const path = Array.isArray(sel) ? sel[0] : sel;
      if (!path) return;
      setDocBusy(true);
      const text = await extractPdfText(path as string);
      const name = (path as string).split('/').pop() || 'one-pager.pdf';
      setProjectField('productDoc', text);
      setProjectField('productDocName', name);
      directorCtx.current = null; // ny kontekst → tving ny skann/forståelse
      setUnderstanding(null);
    } catch (e) {
      window.alert('Kunne ikke lese PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDocBusy(false);
    }
  };
  const runAutoDemo = async () => {
    if (!project || demoVidBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDemoVidBusy(true); setDemoVidResult(null); setDemoVidQa(null); setDemoVidScriptQa(null); setDemoVidPct(0); setDemoVidScene(null); setDemoVidMsg('Starter…');
    try {
      const voice = project.language === 'en' ? undefined : 'Nora'; // norsk on-device-stemme
      const out = await runAutonomousDemo(project, {
        voice,
        onProgress: (m, p) => { setDemoVidMsg(m); setDemoVidPct(p); },
        onScene: (index, total) => setDemoVidScene({ index, total }),
        onShots: (shots) => setProjectField('scanShots', shots),
        finalize: buildFinalize(),
        elevenKey: elevenKey.trim() || undefined,
      });
      setDemoVidResult(out.path);
      setDemoVidQa(out.qa); setDemoVidScriptQa(out.scriptQa);
      const bad = out.qa.filter((g) => g && !g.ok).length;
      setDemoVidMsg(bad ? `✓ Ferdig — ${bad} scene(r) bør sjekkes` : '✓ Ferdig demo klar (alle scener verifisert)');
      void systemOpen(out.path).catch(() => {});
    } catch (e) {
      setDemoVidMsg('Feil: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDemoVidScene(null);
      setDemoVidBusy(false);
    }
  };
  /** Ett klikk fra URL: forstå → generér scener → autonom render → ferdig video. */
  const runOneClickDemo = async () => {
    if (!project || demoVidBusy || directorBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDemoVidBusy(true); setDemoVidResult(null); setDemoVidQa(null); setDemoVidScriptQa(null); setDemoVidPct(0); setDemoVidScene(null); setDemoVidMsg('Forstår + genererer scener…');
    try {
      // 1) Generér scener hvis vi mangler dem ELLER manuset er for en annen URL
      //    (unngå at forrige videos manus brukes på en ny side).
      let proj = useDemoStudio.getState().project!;
      const hasScenes = proj.scenes.some((s) => !!s.narration?.trim());
      const stale = !!proj.scenesUrl && proj.scenesUrl !== proj.url;
      if (!hasScenes || stale) {
        if (stale) setDemoVidMsg('Manuset var for en annen side — lager nytt…');
        await generateDemo();
        proj = useDemoStudio.getState().project!; // fersk, etter replaceScenes
      }
      // 2) Autonom render av de (nye) scenene.
      const voice = proj.language === 'en' ? undefined : 'Nora';
      const out = await runAutonomousDemo(proj, {
        voice,
        onProgress: (m, p) => { setDemoVidMsg(m); setDemoVidPct(p); },
        onScene: (index, total) => setDemoVidScene({ index, total }),
        onShots: (shots) => setProjectField('scanShots', shots),
        finalize: buildFinalize(),
        elevenKey: elevenKey.trim() || undefined,
      });
      setDemoVidResult(out.path); setDemoVidQa(out.qa);
      { const bad = out.qa.filter((g) => g && !g.ok).length; setDemoVidMsg(bad ? `✓ Ferdig — ${bad} scene(r) bør sjekkes` : '✓ Ferdig demo klar (alle scener verifisert)'); }
      void systemOpen(out.path).catch(() => {});
    } catch (e) {
      setDemoVidMsg('Feil: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDemoVidScene(null);
      setDemoVidBusy(false);
    }
  };
  const pickAudience = (a: string) => {
    const m = project?.scriptMeta ?? { tone: 'professional' as const, audience: '', language: 'Norsk', length: 'medium' as const };
    setProjectField('scriptMeta', { ...m, audience: a });
  };
  const [showSignIn, setShowSignIn] = useState(false);
  const [aiReady, setAiReady] = useState(isAiConnected());
  // Re-render når entitlements endres (kjøp/refresh) så Marketing-gaten åpner.
  const [, bumpEntitlements] = useState(0);
  useEffect(() => onEntitlementsChanged(() => bumpEntitlements((n) => n + 1)), []);
  // Nullstill URL-avledet state når man bytter prosjekt, så forrige prosjekts
  // forståelse/QA/«generert»-flagg ikke lekker inn i en ny video.
  const prevProjectId = useRef<string | undefined>(project?.id);
  useEffect(() => {
    if (project?.id === prevProjectId.current) return;
    prevProjectId.current = project?.id;
    setUnderstanding(null);
    setGenerated(false);
    setDemoVidResult(null); setDemoVidQa(null); setDemoVidScriptQa(null); setDemoVidScene(null); setDemoVidMsg(null);
  }, [project?.id]);
  const [respBusy, setRespBusy] = useState(false);
  const [respReport, setRespReport] = useState<ResponsiveReport | null>(null);
  const [critique, setCritique] = useState<DirectorCritique | null>(null);
  const [critiqueBusy, setCritiqueBusy] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdReply, setCmdReply] = useState<string | null>(null);
  const [cmdClarify, setCmdClarify] = useState<{ question: string; options: string[] } | null>(null);
  const pendingInstruction = useRef('');
  const [customCmds, setCustomCmds] = useState<string[]>([]);
  useEffect(() => { try { setCustomCmds(JSON.parse(localStorage.getItem('trrpa.demoStudio.quickCmds') || '[]')); } catch { /* */ } }, []);
  const saveCustomCmds = (list: string[]) => { setCustomCmds(list); try { localStorage.setItem('trrpa.demoStudio.quickCmds', JSON.stringify(list)); } catch { /* */ } };
  const addCustomCmd = () => { const v = window.prompt('Ny quick-kommando (naturlig språk, f.eks. «lag voiceover med mannsstemme»):'); if (v && v.trim()) saveCustomCmds([...customCmds, v.trim()]); };

  // Conversational Director: skrevet kommando → AI tolker → handling (eller spør tilbake).
  const runCommand = async (instruction: string, answeredWith?: string) => {
    if (!project || !instruction.trim() || cmdBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setCmdBusy(true); setCmdReply(null); setCmdClarify(null);
    try {
      const hasNarration = project.scenes.some((s) => !!s.narration?.trim());
      const r = await interpretCommand({ instruction, demoType: project.demoType, sceneCount: project.scenes.length, hasNarration, answeredWith });
      if (r.clarify && r.clarify.options.length) { pendingInstruction.current = instruction; setCmdClarify(r.clarify); return; }
      setCmdReply(r.reply || 'OK');
      await executeCommandAction(r);
    } catch (e) {
      setCmdReply('Feil: ' + (e as Error).message);
    } finally {
      setCmdBusy(false);
    }
  };

  const executeCommandAction = async (r: CommandResult) => {
    if (r.params.task) setProjectField('task', r.params.task);
    if (r.params.goal) setProjectField('goal', r.params.goal);
    if (r.params.voiceModel) setProjectField('voiceModel', r.params.voiceModel);
    // Vinkel/målgruppe fra kommando → oppdater UI + send som override (stale-closure-trygt).
    if (r.params.demoType) setProjectField('demoType', r.params.demoType);
    if (r.params.audience) setProjectField('scriptMeta', { ...(project?.scriptMeta ?? { tone: 'professional' as const, audience: '', language: 'Norsk', length: 'medium' as const }), audience: r.params.audience });
    switch (r.action) {
      case 'generate': await generateDemo({ demoType: r.params.demoType, audience: r.params.audience }); break;
      case 'complete': await completeDemo(); break;
      case 'responsive': await runResponsiveCheck_(); break;
      case 'critic': await runCritic(); break;
      case 'voiceover': await runVoiceover(r.params.voiceModel); break;
      default: break;
    }
  };

  const runVoiceover = async (voiceModel?: string) => {
    if (!project) return;
    const narrations = project.scenes.filter((s) => s.narration?.trim()).map((s) => s.narration!.trim());
    if (!narrations.length) { setCmdReply('Ingen manus å lese opp — generér eller skriv manus først.'); return; }
    setCmdReply('Oversetter manus → engelsk + genererer voiceover i Resolve…');
    let texts = narrations;
    try { texts = await translateForVoiceover(narrations, 'engelsk'); } catch { /* behold norsk ved feil */ }
    const scenes = texts.map((t) => ({ narration: t }));
    try {
      const sum = await executeScript('generate_voiceover_with_resolve', { scenes, voiceModel: voiceModel || project.voiceModel || 'Female 1', audioTrack: 7, isStudio: true }, false);
      setCmdReply(sum?.succeeded ? '✓ Voiceover generert i Resolve' : 'Voiceover fullførte ikke — sjekk at Resolve Studio kjører med aktiv timeline.');
    } catch (e) { setCmdReply('Feil ved voiceover: ' + String(e)); }
  };

  // Auto-merkevare: bruk farger/logo/navn hentet fra siden (overskriver ikke
  // manuelt satt branding).
  // #2: oppgrader preview-screenshots til skarpe Playwright-bilder (ekte
  // Chrome/Chromium) når tilgjengelig — bedre enn html2canvas. Fire-and-forget.
  const upgradeShotsWithPlaywright = (url: string) => {
    void (async () => {
      try {
        const st = await playwrightStatus();
        if (!st.playwrightInstalled) return;
        const r = await playwrightCaptureShots(url);
        if (r?.shots?.length) setProjectField('scanShots', r.shots);
      } catch { /* best-effort */ }
    })();
  };

  const applyScannedBranding = (scan: DomScanResult | null) => {
    // Lagre scan-screenshots (Fase 1b) for presis preview-render.
    if (scan?.shots && scan.shots.length) setProjectField('scanShots', scan.shots);
    if (scan?.url) upgradeShotsWithPlaywright(scan.url);
    const bd = scan?.branding;
    if (!bd) return;
    const cur = useDemoStudio.getState().project?.branding;
    if (cur && (cur.brandName || cur.brandColor || cur.logoUrl)) return;
    if (bd.brandName || bd.brandColor || bd.logoUrl) {
      setProjectField('branding', { brandName: bd.brandName || undefined, brandColor: bd.brandColor || undefined, logoUrl: bd.logoUrl || undefined });
    }
  };

  // Director Critic: AI vurderer hele demoen mot målet → score + forbedringer.
  const runCritic = async () => {
    if (!project || critiqueBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setCritiqueBusy(true);
    try {
      const meta = project.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: project.language === 'en' ? 'English' : 'Norsk', length: 'medium' as const };
      const c = await runDirectorCritic({ url: project.url, demoType: project.demoType, goal: project.goal, meta, scenes: project.scenes });
      setCritique(c);
    } catch (e) {
      setCritique({ score: 0, summary: 'Director Critic feilet: ' + (e as Error).message, issues: [] });
    } finally {
      setCritiqueBusy(false);
    }
  };
  const [placingHotspot, setPlacingHotspot] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1); // zoom på enhets-preview (0.5–3)
  const [showValidation, setShowValidation] = useState(false);
  const [showLearned, setShowLearned] = useState(false);
  const [driftTargets, setDriftTargets] = useState<LearnedTarget[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [visualBeats, setVisualBeats] = useState<VisualBeat[] | null>(null);
  const [visualBusy, setVisualBusy] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const zoomBy = (delta: number) => setPreviewZoom((z) => Math.min(3, Math.max(0.5, Math.round((z + delta) * 100) / 100)));
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const captureBuf = useRef<CapturedStep[]>([]);

  // Auto-utfør gjeldende scenes handling (continueMode:'auto'): systemet finner
  // target-elementet og utfører handlingen, fyller detectedSelector og avanserer.
  const autoRunCurrent = async () => {
    if (!isCaptureAvailable()) { window.alert('Auto-utførelse krever Tauri-appen.'); return; }
    const st = useDemoStudio.getState();
    const sc = st.project?.scenes[st.recorderStepIndex];
    if (!sc || !st.project) return;
    if (!sc.targetSelector) { window.alert('Scenen mangler target-selector — bind elementet via AI Director eller capture først.'); return; }
    setAutoBusy(true);
    try {
      const r = await autoExecute(st.project.url, sc.targetSelector, sc.actionType ?? 'click');
      if (r?.ok && r.found) {
        updateScene(sc.id, { detectedSelector: sc.targetSelector, status: 'done' });
        if (st.recorderStepIndex < st.project.scenes.length - 1) nextStep();
      } else if (r && !r.found) {
        // Self-healing: skann siden på nytt + la AI finne riktig element → reparer + prøv igjen.
        const scan = await scanDom(st.project.url).catch(() => null);
        const els = scan?.elements ?? [];
        const idx = els.length ? await healTarget({ targetLabel: sc.targetLabel, actionType: sc.actionType, elements: els }).catch(() => null) : null;
        if (idx != null && els[idx]) {
          const el = els[idx];
          updateScene(sc.id, { targetSelector: el.selector, targetLocators: el.locators, targetLabel: el.label, hotspot: el.hotspot, startScrollPct: el.scrollPct != null ? Math.round(el.scrollPct * 100) : undefined });
          const r2 = await autoExecute(st.project.url, el.selector, sc.actionType ?? 'click');
          if (r2?.ok && r2.found) {
            updateScene(sc.id, { detectedSelector: el.selector, status: 'done' });
            if (st.recorderStepIndex < st.project.scenes.length - 1) nextStep();
            window.alert('Selector var brutt — AI reparerte den automatisk og handlingen lyktes.');
          } else {
            updateScene(sc.id, { status: 'needs_review' });
            window.alert('AI klarte ikke å reparere target. Scene merket «Needs Review».');
          }
        } else {
          updateScene(sc.id, { status: 'needs_review' });
          window.alert('Fant ikke elementet på siden. Scene merket «Needs Review».');
        }
      }
    } finally {
      setAutoBusy(false);
    }
  };

  // Verifiser den gjeldende recorder-scenens handling: brukeren klikker
  // elementet → detectedSelector fylles → ekte Expected↔Detected-validering.
  const verifyCurrentAction = async () => {
    if (!isCaptureAvailable()) { window.alert('Verifisering krever Tauri-appen.'); return; }
    const st = useDemoStudio.getState();
    const sc = st.project?.scenes[st.recorderStepIndex];
    if (!sc || !st.project) return;
    setVerifyBusy(true);
    try {
      const v = await verifyAction(st.project.url, sc.targetLabel);
      if (v && !v.cancelled && v.selector) {
        // Vision-runtime-verifisering: ta skjermbilde ETTER handlingen og sjekk
        // at forventet utfall faktisk skjedde — ikke bare selector-match.
        let visionOk: boolean | null = null;
        const expected = sc.validationRule || sc.targetLabel || sc.requiredAction;
        if (expected && isCaptureAvailable()) {
          const shot = await captureScreenshot(st.project.url).catch(() => null);
          if (shot) { const o = await verifyOutcomeVision({ screenshot: shot, expected }).catch(() => null); if (o) visionOk = o.success; }
        }
        const match = sceneActionMatch({ ...sc, detectedSelector: v.selector });
        const status = visionOk === false ? 'needs_review' : (match === 'match' || visionOk === true) ? 'done' : 'needs_review';
        updateScene(sc.id, { detectedSelector: v.selector, status, bindingConfidence: 'high' });
        // Lær av verifiseringen (A): det brukeren faktisk klikket er fasiten.
        // Avvik fra AI-ens gjetning → lær riktig selector + avvis den gamle.
        if (sc.targetLabel) {
          recordLearnedTarget(st.project.url, sc.targetLabel, {
            selector: v.selector, hotspot: sc.hotspot, source: 'manual',
            rejectSelector: sc.targetSelector && sc.targetSelector !== v.selector ? sc.targetSelector : undefined,
          });
        }
      }
    } finally {
      setVerifyBusy(false);
    }
  };

  // Klikk-gjennom-capture (Fase 2): lytt på steg-events fra capture-vinduet,
  // og bygg scener når brukeren er ferdig. Lytterne lever hele komponentens liv.
  useEffect(() => {
    const pending = [
      onCaptureStep((s) => { captureBuf.current.push(s); setCaptureCount(captureBuf.current.length); }),
      onCaptureDone((cancelled) => {
        setCapturing(false);
        const steps = captureBuf.current;
        captureBuf.current = [];
        setCaptureCount(0);
        if (cancelled || steps.length === 0) return;
        const st = useDemoStudio.getState();
        const device = st.project?.scenes[0]?.device ?? 'macbook';
        st.replaceScenes(captureStepsToScenes(steps, device));
        // «Vis meg én gang» (B): hvert klikk brukeren gjorde blir en lært target,
        // så AI binder presist neste gang den lager en flow på samme nettside.
        const url = st.project?.url;
        if (url) {
          let learned = 0;
          for (const s of steps) {
            const label = (s.targetLabel || '').trim();
            if (!label || (!s.selector && !s.hotspot)) continue;
            recordLearnedTarget(url, label, {
              selector: s.selector, hotspot: s.hotspot,
              actionType: s.actionType as DemoActionType | undefined,
              source: 'capture',
            });
            learned++;
          }
          if (learned) setCmdReply(`✓ Lærte ${learned} element${learned === 1 ? '' : 'er'} fra opptaket — AI binder presist på denne siden neste gang.`);
        }
      }),
    ];
    return () => { pending.forEach((p) => void p.then((un) => un())); };
  }, []);

  const startCapture = async () => {
    if (!project) return;
    if (!isCaptureAvailable()) { window.alert('Klikk-capture krever Tauri-appen (ikke tilgjengelig i nettleser-dev). Bruk «Sett hotspot» for manuell plassering.'); return; }
    captureBuf.current = [];
    setCaptureCount(0);
    setCapturing(true);
    try {
      await startDemoCapture(project.url);
    } catch (e) {
      setCapturing(false);
      window.alert('Kunne ikke starte capture: ' + (e as Error).message);
    }
  };

  /** Plasser scenens hotspot fra et klikk på preview-en (viewport-prosent). */
  const placeHotspot = (xPct: number, yPct: number) => {
    if (!selected) return;
    const w = 0.22, h = 0.09; // knapp-aktig standardstørrelse
    const hotspot = { x: Math.max(0, Math.min(1 - w, xPct - w / 2)), y: Math.max(0, Math.min(1 - h, yPct - h / 2)), w, h };
    updateScene(selected.id, { hotspot });
    learnHotspot(hotspot);
    setPlacingHotspot(false);
  };

  /** Tegn scenens hotspot ved å dra et rektangel på preview-en (eksakt markering). */
  const drawHotspot = (rect: { x: number; y: number; w: number; h: number }) => {
    if (!selected) return;
    const hotspot = {
      x: Math.max(0, Math.min(1, rect.x)), y: Math.max(0, Math.min(1, rect.y)),
      w: Math.max(0.02, Math.min(1 - rect.x, rect.w)), h: Math.max(0.02, Math.min(1 - rect.y, rect.h)),
    };
    updateScene(selected.id, { hotspot });
    learnHotspot(hotspot);
    setPlacingHotspot(false);
  };

  /** Lær opp AI-en: manuell hotspot huskes per side+label og overstyrer AI-ens
   *  gjetting neste gang man genererer en flow på samme nettside. */
  const learnHotspot = (hotspot: { x: number; y: number; w: number; h: number }) => {
    if (project?.url && selected?.targetLabel) {
      recordLearnedTarget(project.url, selected.targetLabel, { hotspot, selector: selected.targetSelector });
      setCmdReply(`✓ Lærte hvor «${selected.targetLabel}» er — AI husker dette for ${(() => { try { return new URL(project.url).host; } catch { return 'denne siden'; } })()} neste gang.`);
    }
  };

  /** Aktiv læring (C): hopp til en scene AI er usikker på og start hotspot-plassering. */
  const teachScene = (id: string) => {
    selectScene(id); setStoryMode(false); setNav('flow'); setPlacingHotspot(true);
  };

  /** Manus-drevne visuelle forslag: les manuset → foreslå uthevinger med preview. */
  const runVisualBeats = async () => {
    if (!project || visualBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setVisualBusy(true);
    try {
      const beats = await suggestVisualBeats({ scenes: project.scenes.map((s) => ({ narration: s.narration, targetLabel: s.targetLabel })) });
      setVisualBeats(beats);
      if (!beats.length) setCmdReply('Fant ingenting i manuset som trengte en visuell utheving.');
    } catch (e) {
      setCmdReply('Feil: ' + (e as Error).message);
    } finally {
      setVisualBusy(false);
    }
  };
  /** Anvend et visuelt forslag: sett overlay-tekst + stil på scenen. */
  const applyVisualBeat = (b: VisualBeat) => {
    const sc = project?.scenes[b.index];
    if (!sc) return;
    updateScene(sc.id, { overlayText: b.overlay, overlayStyle: b.kind === 'stat' ? 'callout' : 'lower-third' });
  };

  // Responsive Check: vurder siden i desktop/tablet/mobil → vis rapport med
  // anvendbare fikser. Krever AI (Role Room) som AI Director.
  const runResponsiveCheck_ = async () => {
    if (!project || respBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setRespBusy(true);
    try {
      const siteContext = await fetchSiteContext(project.url);
      const report = await runResponsiveCheck({ url: project.url, demoType: project.demoType, scenes: project.scenes, siteContext });
      setRespReport(report);
    } catch (e) {
      setRespReport({ results: [{ device: 'macbook', status: 'error', message: 'Responsive Check feilet', recommendation: (e as Error).message }], createdAt: new Date().toISOString() });
    } finally {
      setRespBusy(false);
    }
  };

  // AI Director (§5.1): hent nettside-kontekst → generér hel scene-flow →
  // erstatt scener → hopp til Script Builder så Director + Script Builder
  // jobber på samme scene-objekter.
  // Cache av siste skann (elementer + sidetekst) per URL, så «Forstå siden» og
  // «Generér demoen» kan dele resultatet uten å skanne to ganger.
  const directorCtx = useRef<{ url: string; elements: any[]; siteContext: string; brandName?: string } | null>(null);

  /** Skann ekte interaktive elementer + les sidetekst (med OCR-fallback). Cacher per URL. */
  const scanAndContext = async (): Promise<{ elements: any[]; siteContext: string; brandName?: string }> => {
    if (directorCtx.current && directorCtx.current.url === project!.url) {
      return { elements: directorCtx.current.elements, siteContext: directorCtx.current.siteContext, brandName: directorCtx.current.brandName };
    }
    const scan = await scanDom(project!.url).catch(() => null);
    let elements = scan?.elements ?? [];
    // OCR-/vision-fallback: ingen DOM-elementer → la Claude finne elementer fra et skjermbilde.
    if (elements.length === 0 && isCaptureAvailable()) {
      setDirectorMsg('Ingen DOM-elementer — bruker vision (OCR)…');
      const shot = await captureScreenshot(project!.url).catch(() => null);
      if (shot) elements = await ocrDetectElements({ screenshot: shot }).catch(() => []);
    }
    learnCtas(elements); // auto-utvid CTA-banken fra det vi fant
    if (elements.length) setDriftTargets(detectLearnedDrift(project!.url, elements)); // drift-deteksjon (D)
    const pageText = scan?.pageText || await fetchSiteContext(project!.url);
    // Product Brain: prependér produkt-PDF-en (one-pager) til konteksten, så
    // AI-en forstår produktet dypere enn nettsiden alene.
    const doc = project!.productDoc?.trim();
    const siteContext = doc ? `PRODUKT-DOKUMENT (one-pager — autoritativ kilde):\n${doc}\n\n--- NETTSIDE ---\n${pageText}` : pageText;
    applyScannedBranding(scan);
    const brandName = scan?.branding?.brandName;
    directorCtx.current = { url: project!.url, elements, siteContext, brandName };
    return { elements, siteContext, brandName };
  };

  /** Kjerne: analyser siden + adopter målgruppe/mål/vinkel. Ingen busy-guard
   *  (kalles fra både understandSite og generateDemo). Returnerer forståelsen. */
  const analyzeAndAdopt = async (elements: any[], siteContext: string, brandName?: string) => {
    const u = await analyzeSiteContext({ url: project!.url, pageText: siteContext, brandName, elements }).catch(() => null);
    if (u) {
      setUnderstanding(u);
      // Adopter målgruppe/mål/vinkel fra forståelsen hvis brukeren ikke har satt dem.
      const meta = project!.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: project!.language === 'en' ? 'English' : 'Norsk', length: 'medium' as const };
      if ((!meta.audience || meta.audience === 'General') && u.audience) setProjectField('scriptMeta', { ...meta, audience: u.audience });
      if (!project!.goal && u.suggestedGoal) setProjectField('goal', u.suggestedGoal);
      if (u.suggestedType && project!.demoType === 'product_demo' && u.suggestedType !== 'product_demo') setProjectField('demoType', u.suggestedType);
    }
    return u;
  };

  /** STEG 1 — FORSTÅ FØRST: hva er produktet + hvem er målgruppen? Viser en brief,
   *  lager INGENTING. Diskuter/juster vinkel, og kjør så «Generér demoen». */
  const understandSite = async () => {
    if (!project || directorBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDirectorBusy(true); setDirectorMsg('Forstår siden…');
    try {
      const { elements, siteContext, brandName } = await scanAndContext();
      const u = await analyzeAndAdopt(elements, siteContext, brandName);
      setDirectorMsg(u
        ? 'Forstått. Juster målgruppe/vinkel under hvis du vil, og trykk «Generér demoen».'
        : 'Kunne ikke forstå siden automatisk — du kan generere likevel.');
    } catch (e) {
      setDirectorMsg('Feil: ' + (e as Error).message);
    } finally {
      setDirectorBusy(false);
    }
  };

  /** STEG 2 — GENERÉR: lag scenene med (eventuelt justert) målgruppe/vinkel/mål.
   *  Forstår automatisk først hvis det ikke er gjort, så ett klikk holder også. */
  const generateDemo = async (override?: { demoType?: DemoType; audience?: string }) => {
    if (!project || directorBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDirectorBusy(true);
    try {
      const { elements, siteContext, brandName } = await scanAndContext();
      // Bruk returverdien (ikke React-state, som er stale i denne closuren).
      let u = understanding;
      if (!u) { setDirectorMsg('Forstår siden…'); u = await analyzeAndAdopt(elements, siteContext, brandName); }
      const meta0 = project.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: project.language === 'en' ? 'English' : 'Norsk', length: 'medium' as const };
      // Effektive verdier: override (fra kommando) vinner, så brukerens valg, så forståelsen.
      const audience = override?.audience || (meta0.audience && meta0.audience !== 'General' ? meta0.audience : (u?.audience || meta0.audience));
      const meta = { ...meta0, audience };
      const demoType = override?.demoType || (project.demoType !== 'product_demo' ? project.demoType : (u?.suggestedType || project.demoType));
      setDirectorMsg('Lager demo…');
      const scenes = await generateDemoFlow({
        url: project.url, demoType, devices: project.devices, meta, siteContext, elements, goal: project.goal || u?.suggestedGoal, task: project.task,
      });
      replaceScenes(scenes);
      setProjectField('scenesUrl', project.url); // stemple hvilken URL manuset gjelder
      setGenerated(true);
      setDirectorMsg(`✓ ${scenes.length} scener generert`);
      setNav('script'); // samarbeid: åpne resultatet i Script Builder
    } catch (e) {
      setDirectorMsg('Feil: ' + (e as Error).message);
    } finally {
      setDirectorBusy(false);
    }
  };

  const [demoType, setDemoType] = useState<DemoType>('product_demo');

  // «AI fullfør demoen»: fyll KUN tomme felt på eksisterende scener.
  const completeDemo = async () => {
    if (!project || directorBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDirectorBusy(true); setDirectorMsg('Analyserer + fyller hull…');
    try {
      const scan = await scanDom(project.url).catch(() => null);
      const elements = scan?.elements ?? [];
      learnCtas(elements);
      const siteContext = scan?.pageText || await fetchSiteContext(project.url);
      applyScannedBranding(scan);
      const meta = project.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: project.language === 'en' ? 'English' : 'Norsk', length: 'medium' as const };
      const patches = await completeDemoFlow({ url: project.url, demoType: project.demoType, meta, scenes: project.scenes, elements, siteContext });
      const validActions = Object.keys(ACTION_META) as DemoActionType[];
      let filled = 0;
      for (const p of patches) {
        const sc = useDemoStudio.getState().project?.scenes.find((s) => s.index === p.index);
        if (!sc) continue;
        const patch: Partial<DemoScene> = {};
        if (!sc.narration?.trim() && p.narration) patch.narration = p.narration;
        if (!sc.overlayText?.trim() && p.overlayText) patch.overlayText = p.overlayText;
        if ((!sc.duration || sc.duration <= 0) && typeof p.duration === 'number' && p.duration > 0) patch.duration = p.duration;
        if (!sc.requiredAction?.trim() && p.requiredAction) patch.requiredAction = p.requiredAction;
        if (!sc.actionType && p.actionType && validActions.includes(p.actionType as DemoActionType)) patch.actionType = p.actionType as DemoActionType;
        const noTarget = !sc.targetLabel?.trim() && !sc.targetSelector?.trim() && !sc.hotspot;
        if (noTarget) {
          const el = typeof p.targetIndex === 'number' ? elements[p.targetIndex] : undefined;
          if (el) {
            patch.targetSelector = el.selector; patch.targetLabel = el.label; patch.hotspot = el.hotspot;
            patch.targetLocators = el.locators;
            if (el.scrollPct != null) patch.startScrollPct = Math.round(el.scrollPct * 100);
            if (!patch.actionType && validActions.includes(el.actionType as DemoActionType)) patch.actionType = el.actionType as DemoActionType;
          } else if (p.targetLabel) {
            patch.targetLabel = p.targetLabel;
          }
        }
        if (Object.keys(patch).length) { updateScene(sc.id, patch); filled++; }
      }
      setDirectorMsg(filled ? `✓ Fylte ${filled} scene(r)` : 'Alt var allerede komplett');
    } catch (e) {
      setDirectorMsg('Feil: ' + (e as Error).message);
    } finally {
      setDirectorBusy(false);
    }
  };

  const scenes = project?.scenes ?? [];
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const recorderScene = scenes[recorderStepIndex];
  const doneCount = scenes.filter((s) => s.status === 'done' || s.status === 'approved').length;
  const previewDevice = selected?.device ?? 'macbook';
  const previewVariant: FrameVariant = previewDevice === 'ipad' && selected?.orientation === 'landscape' ? 'ipad_landscape' : previewDevice;
  const render = project?.render ?? defaultRenderOptions();
  // Preview-bredde per enhet (deles av enhets-ramme + kontaktskygge), skalert av zoom.
  const baseWPct = previewVariant === 'macbook' ? 78 : previewVariant === 'ipad_landscape' ? 64 : previewVariant === 'ipad' ? 42 : 26;
  const baseMaxW = previewVariant === 'macbook' ? 640 : previewVariant === 'ipad_landscape' ? 560 : previewVariant === 'ipad' ? 360 : 230;

  const storyPicks = useMemo(() => (project ? demoScenesToPicks(project.scenes) : []), [project]);
  const storyChapters = useMemo(() => (project ? demoChapters(project.scenes) : []), [project]);

  // ── Tom tilstand: Create Demo (URL + flow) ──
  if (!project) {
    // Tilgivende URL-håndtering: auto-legg til https:// hvis brukeren bare
    // skrev "domene.no". Krever et punktum i verts­navnet for å være gyldig.
    // i-flagg så stor "HTTPS://" (f.eks. fra macOS autocorrect) også godtas.
    const normalizedUrl = normalizeUrl(urlInput);
    const valid = /^https?:\/\/\S+\.\S+/i.test(normalizedUrl);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: C.font, background: C.bg, color: C.ink }}>
        <div style={topbarStyle}>
          <div style={iconBtn} onClick={onClose} title="Tilbake til hjem">☰</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Product Demo Studio</div>
        </div>
        <div style={{ maxWidth: 560, margin: '64px auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hva vil du vise frem?</h2>
          <p style={{ color: C.inkSoft, fontSize: 13.5, margin: 0 }}>Lim inn en URL og bygg en scene-basert produktdemo. Velg opptaks-enhet i Guided Recorder. Du styrer opptaket steg for steg.</p>
          <input style={{ ...field, fontSize: 15, padding: '13px 15px' }} placeholder="https://example.com"
            value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) createProject(normalizedUrl, demoType); }} />
          <select style={{ ...field, padding: '11px 12px' }} value={demoType} onChange={(e) => setDemoType(e.target.value as DemoType)}>
            {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => <option key={t} value={t}>{DEMO_TYPE_LABELS[t]}</option>)}
          </select>
          <button style={{ ...primaryBtn, opacity: valid ? 1 : 0.5, alignSelf: 'flex-start' }}
            disabled={!valid} onClick={() => createProject(normalizedUrl, demoType)}>
            Generér demo-flow →
          </button>
          {!valid && (
            <p style={{ color: C.inkSoft, fontSize: 12.5, margin: '2px 0 0' }}>
              Skriv inn en gyldig URL for å starte (f.eks. <code>theroleroom.com</code>).
            </p>
          )}
        </div>
      </div>
    );
  }

  // Script Builder + Guided Recorder har egne fullskjerm-layouter.
  if (nav === 'script' && !storyMode) {
    return <ScriptBuilderView onNav={(id) => setNav(id as NavId)} />;
  }
  if (nav === 'recorder' && !storyMode) {
    return <GuidedRecorderView onNav={(id) => setNav(id as NavId)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: C.font, background: C.bg, color: C.ink, fontSize: 13 }}>
      {/* ── Topbar (URL-input erstatter Search) ── */}
      <div style={topbarStyle}>
        <div style={iconBtn} onClick={onClose} title="Tilbake til hjem">☰</div>
        <div>
          <input style={{ ...titleField }} value={project.name} onChange={(e) => setProjectField('name', e.target.value)} />
          <div style={{ fontSize: 11, color: C.inkFaint, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> Draft · Autosaved just now
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 9, padding: '7px 12px' }}>
          <span style={{ color: C.inkFaint }}>🌐</span>
          <input style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 13, color: C.ink }}
            value={project.url} onChange={(e) => setProjectField('url', e.target.value)}
            onBlur={(e) => setProjectField('url', normalizeUrl(e.target.value))} placeholder="https://example.com" />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.inkSoft }}><span style={{ color: C.green }}>✓</span> Lagret</div>
        <button style={recording ? { ...btn, background: '#ef4444', color: '#fff', borderColor: '#ef4444' } : btn}
          onClick={async () => {
            if (recording) return;
            setStoryMode(false); startRecorder();
            const st = useDemoStudio.getState();
            const sc = st.project?.scenes[st.recorderStepIndex];
            const ok = sc && st.project ? await rec.start(st.project.id, sc.id) : false;
            if (ok) setRecording(true);
          }}>● {rec.state === 'recording' ? 'Recording' : rec.state === 'saving' ? 'Lagrer…' : 'Record'}</button>
        <button style={{ ...btn, background: C.dark, color: '#fff', borderColor: C.dark }}
          onClick={() => { setStoryMode(false); setNav('export'); }}>Export <span>⌄</span></button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Left nav ── */}
        <div style={{ width: 256, background: C.panel, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', padding: '12px 11px', flexShrink: 0, overflowY: 'auto', minHeight: 0 }}>
          {NAV_ITEMS.map((it) => (
            <div key={it.id} onClick={() => { setNav(it.id); setStoryMode(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
                background: nav === it.id && !storyMode ? C.creamActive : 'transparent', color: nav === it.id && !storyMode ? C.ink : C.inkSoft, fontWeight: nav === it.id && !storyMode ? 600 : 500 }}>
              <span style={{ width: 18, opacity: 0.85 }}>{it.ic}</span> {it.label}
            </div>
          ))}
          {/* Story-modus (gjenbruk av StoryView) */}
          <div onClick={() => setStoryMode(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
              background: storyMode ? C.creamActive : 'transparent', color: storyMode ? C.ink : C.inkSoft, fontWeight: storyMode ? 600 : 500 }}>
            <span style={{ width: 18, opacity: 0.85 }}>✦</span> Story
          </div>
          <div onClick={() => setShowPreflight(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2, color: C.inkSoft }}>
            <span style={{ width: 18, opacity: 0.85 }}>◇</span> Sjekk oppsett
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: '15px 14px 16px', marginBottom: 12, boxShadow: '0 1px 3px rgba(31,27,23,0.05)' }}>
            <h4 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{ color: C.accent }}>✦</span> AI Director
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: aiReady ? '#e6f3ec' : '#fdeee0', color: aiReady ? C.green : '#b5651d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: aiReady ? C.green : '#b5651d' }} />
                {aiReady ? 'AI klar' : 'Ikke koblet'}
              </span>
            </h4>
            {/* Stegvis flyt: Beskriv → Diskutér → Forfin (progressive disclosure) */}
            {(() => {
              const hasGenerated = generated || scenes.some((s) => !!s.narration?.trim());
              const stage: 'describe' | 'discuss' | 'refine' = !understanding && !hasGenerated ? 'describe' : hasGenerated ? 'refine' : 'discuss';
              const stepNum = stage === 'describe' ? 1 : stage === 'discuss' ? 2 : 3;
              const stageName = stage === 'describe' ? 'Beskriv' : stage === 'discuss' ? 'Diskutér' : 'Forfin';
              const audienceChips = understanding ? Array.from(new Set([understanding.audience, ...understanding.audienceOptions])).filter(Boolean) : [];
              const cmdRow = (placeholder: string) => (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input style={{ ...field, flex: 1 }} value={cmdInput} placeholder={placeholder}
                    onChange={(e) => setCmdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && cmdInput.trim()) { const v = cmdInput; setCmdInput(''); void runCommand(v); } }} />
                  <button style={{ ...btn, opacity: cmdBusy ? 0.6 : 1 }} disabled={cmdBusy}
                    onClick={() => { const v = cmdInput; setCmdInput(''); void runCommand(v); }}>{cmdBusy ? '…' : '➤'}</button>
                </div>
              );
              const clarifyBox = cmdClarify ? (
                <div style={{ border: `1px solid ${C.accent}`, borderRadius: 9, padding: 10, marginBottom: 8, background: '#fdf0e7' }}>
                  <div style={{ fontSize: 12, marginBottom: 7 }}>{cmdClarify.question}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {cmdClarify.options.map((o) => (
                      <button key={o} style={{ ...btn, padding: '5px 10px', fontSize: 12 }}
                        onClick={() => { const ins = pendingInstruction.current; setCmdClarify(null); void runCommand(ins, o); }}>{o}</button>
                    ))}
                  </div>
                </div>
              ) : null;
              const replyLine = cmdReply ? <div style={{ fontSize: 11.5, color: cmdReply.startsWith('Feil') ? '#c4453b' : C.inkSoft, marginBottom: 8 }}>{cmdReply}</div> : null;
              const directorLine = directorMsg ? <div style={{ fontSize: 11, color: directorMsg.startsWith('Feil') ? '#c4453b' : C.inkSoft, marginTop: 8 }}>{directorMsg}</div> : null;
              // Delt progress/resultat for autonom ferdig demo (brukt i Beskriv + Forfin).
              const demoVidShot = demoVidScene ? pickShot(project.scanShots, (scenes[demoVidScene.index]?.startScrollPct ?? 0) / 100) : null;
              const demoVidBlock = (
                <>
                  {!demoVidBusy && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginTop: 8, cursor: 'pointer' }}
                      title="Legg på branded intro/outro + nettleser-ramme rundt videoen">
                      <input type="checkbox" checked={brandedOutput} onChange={(e) => setBrandedOutput(e.target.checked)} />
                      Med intro + nettleser-ramme
                    </label>
                  )}
                  {demoVidBusy && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 5, background: C.line, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${demoVidPct}%`, background: C.accent, transition: 'width .3s' }} />
                      </div>
                    </div>
                  )}
                  {demoVidBusy && demoVidScene && (
                    <div style={{ marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                      {demoVidShot
                        ? <img src={demoVidShot} alt="" style={{ width: '100%', display: 'block', maxHeight: 110, objectFit: 'cover', objectPosition: 'top' }} />
                        : <div style={{ height: 70, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11 }}>tar opp…</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px', background: C.cream, fontSize: 10.5, color: C.inkSoft }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d9342b' }} />
                        Tar opp scene {demoVidScene.index + 1}/{demoVidScene.total}{scenes[demoVidScene.index]?.title ? ` · ${scenes[demoVidScene.index].title.slice(0, 32)}` : ''}
                      </div>
                    </div>
                  )}
                  {demoVidMsg && <div style={{ fontSize: 11, color: demoVidMsg.startsWith('Feil') ? '#c4453b' : C.inkSoft, marginTop: 6 }}>{demoVidMsg}</div>}
                  {demoVidResult && !demoVidBusy && (
                    <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginTop: 8 }}
                      onClick={() => void systemOpen(demoVidResult).catch(() => {})}>▶ Åpne ferdig video</button>
                  )}
                  {/* Narrativ QA: følger manuset rammeverket (PAS/AIDA/…)? */}
                  {demoVidScriptQa && !demoVidBusy && (
                    <div style={{ marginTop: 8, border: `1px solid ${demoVidScriptQa.ok ? '#bfe0c9' : '#f0d9a8'}`, background: demoVidScriptQa.ok ? '#eef7f0' : '#fff8ec', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: demoVidScriptQa.ok ? C.green : '#8a6516' }}>
                        {demoVidScriptQa.ok ? '✓ ' : ''}Manus følger {demoVidScriptQa.framework.split(' (')[0]}: {demoVidScriptQa.score}/100
                      </div>
                      {!demoVidScriptQa.ok && (demoVidScriptQa.issue || demoVidScriptQa.missing.length) ? (
                        <div style={{ fontSize: 10.5, color: '#8a6516', marginTop: 3, lineHeight: 1.35 }}>
                          {demoVidScriptQa.issue}{demoVidScriptQa.missing.length ? ` Mangler: ${demoVidScriptQa.missing.join(', ')}.` : ''}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {/* QA-rapport: AI-verifisering av hver scene i videoen */}
                  {demoVidQa && !demoVidBusy && (() => {
                    const graded = demoVidQa.map((g, i) => ({ g, i })).filter((x) => x.g);
                    if (!graded.length) return null;
                    const bad = graded.filter((x) => x.g && !x.g.ok);
                    return (
                      <div style={{ marginTop: 8, border: `1px solid ${bad.length ? '#f0d9a8' : '#bfe0c9'}`, background: bad.length ? '#fff8ec' : '#eef7f0', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: bad.length ? '#8a6516' : C.green, marginBottom: bad.length ? 5 : 0 }}>
                          {bad.length ? `AI-sjekk: ${graded.length - bad.length}/${graded.length} scener bra` : `✓ AI verifiserte alle ${graded.length} scener`}
                        </div>
                        {bad.map((x) => (
                          <div key={x.i} style={{ fontSize: 10.5, color: '#8a6516', marginTop: 3, lineHeight: 1.35 }}>
                            Scene {x.i + 1} ({x.g!.score}/100): {x.g!.issue || 'kunne ikke verifiseres'}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              );
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                      {[1, 2, 3].map((n) => (
                        <div key={n} style={{ flex: 1, height: 4, borderRadius: 3, background: n <= stepNum ? C.accent : C.line, transition: 'background .2s' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.inkSoft, whiteSpace: 'nowrap' }}>{stepNum}/3 · {stageName}</div>
                  </div>

                  {/* ── STEG 1 · Beskriv ── */}
                  {stage === 'describe' && (
                    <>
                      {/* Product Brain (steg 0): gi AI-en produktets one-pager (PDF) */}
                      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 11, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>🧠 Product Brain</div>
                        {project.productDoc ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1, fontSize: 11.5, color: C.green, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.productDocName}>✓ Lest: {project.productDocName} ({Math.round((project.productDoc.length) / 1000)}k tegn)</span>
                            <button style={{ ...outlineBtn, padding: '4px 9px', fontSize: 11.5 }} disabled={docBusy} onClick={() => void pickProductDoc()}>Bytt</button>
                            <button style={{ ...outlineBtn, padding: '4px 9px', fontSize: 11.5 }} title="Fjern" onClick={() => { setProjectField('productDoc', undefined); setProjectField('productDocName', undefined); directorCtx.current = null; setUnderstanding(null); }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff' }} disabled={docBusy} onClick={() => void pickProductDoc()}>
                              {docBusy ? 'Leser PDF…' : '📄 Legg til one-pager (PDF)'}
                            </button>
                            <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6, lineHeight: 1.4 }}>Last opp produktets one-pager/datablad — AI-en leser den og forstår produktet dypere enn nettsiden alene.</div>
                          </>
                        )}
                      </div>
                      <div style={fldLabel}>Hva skal demoen vise?</div>
                      <input style={{ ...field, marginBottom: 10 }} value={project.task ?? ''} placeholder="f.eks. «hele innloggings-prosessen»"
                        onChange={(e) => setProjectField('task', e.target.value)} />
                      <div style={fldLabel}>Mål</div>
                      <input style={{ ...field, marginBottom: 12 }} value={project.goal ?? ''} placeholder="f.eks. «få flere til å booke demo»"
                        onChange={(e) => setProjectField('goal', e.target.value)} />
                      {!aiReady && (
                        <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginBottom: 8 }}
                          onClick={() => setShowSignIn(true)}>Koble til AI (Role Room)</button>
                      )}
                      <button style={{ ...btn, width: '100%', justifyContent: 'center', background: C.accent, color: '#fff', borderColor: C.accent, fontWeight: 600, padding: '10px 13px', boxShadow: '0 1px 3px rgba(239,138,93,0.35)', opacity: directorBusy ? 0.6 : 1 }}
                        disabled={directorBusy} onClick={() => void understandSite()}>
                        {directorBusy ? 'Forstår siden…' : '① Forstå siden →'}
                      </button>
                      <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 7, lineHeight: 1.4 }}>AI leser siden og foreslår produkt-vinkel + målgruppe — lager ingenting ennå.</div>
                      {directorLine}
                      {/* Ett-klikk: hele veien fra URL til ferdig narrert video */}
                      <div style={{ borderTop: `1px dashed ${C.line}`, margin: '12px 0 0', paddingTop: 12 }}>
                        <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', borderColor: C.accent, color: C.accent, fontWeight: 600, opacity: demoVidBusy || directorBusy ? 0.6 : 1 }}
                          disabled={demoVidBusy || directorBusy} onClick={() => void runOneClickDemo()}
                          title="Forstå → generér scener → kjør nettsiden + narrér → ferdig video, alt i ett">
                          {demoVidBusy ? 'Lager ferdig demo…' : '✨ Lag ferdig demo fra URL'}
                        </button>
                        <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 5, lineHeight: 1.4 }}>Helautonomt: AI forstår, skriver manus, kjører nettsiden, narrerer og leverer en ferdig video — uten at du tar opp noe.</div>
                        {demoVidBlock}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div onClick={() => setShowAdvanced((v) => !v)} style={{ fontSize: 10.5, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ transition: 'transform .15s', transform: showAdvanced ? 'rotate(90deg)' : 'none' }}>▸</span> Avansert
                        </div>
                        {showAdvanced && (
                          <div style={{ marginTop: 8 }}>
                            <input style={{ ...field, marginBottom: 8 }} value={project.scriptMeta?.audience ?? ''} placeholder="Målgruppe / persona (valgfritt)"
                              onChange={(e) => setProjectField('scriptMeta', { ...(project.scriptMeta ?? { tone: 'professional', audience: '', language: 'Norsk', length: 'medium' }), audience: e.target.value })} />
                            <input style={{ ...field, marginBottom: 4 }} type="password" value={elevenKey} placeholder="ElevenLabs API-nøkkel (valgfritt — bedre stemme)"
                              onChange={(e) => setElevenKey(e.target.value)} />
                            <div style={{ fontSize: 10, color: C.inkFaint, marginBottom: 8, lineHeight: 1.4 }}>Med nøkkel brukes ElevenLabs-stemme i den autonome videoen. Uten → norsk «Nora» (on-device).</div>
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', opacity: directorBusy ? 0.6 : 1 }}
                              disabled={directorBusy} onClick={() => void generateDemo()}
                              title="Hopp over diskusjonen og generér rett fra det du har skrevet">Generér direkte (uten å forstå først)</button>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── STEG 2 · Diskutér ── */}
                  {stage === 'discuss' && understanding && (
                    <>
                      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 11, marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 4 }}>Forstår jeg dette riktig?</div>
                        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.45, marginBottom: 8 }}>{understanding.summary}</div>
                        <div style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 4 }}>Hvem er målgruppen?</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: understanding.valueProps?.length ? 8 : 0 }}>
                          {audienceChips.map((a) => {
                            const active = (project?.scriptMeta?.audience || '') === a;
                            return (
                              <button key={a} onClick={() => pickAudience(a)}
                                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${active ? C.accent : C.line}`, background: active ? C.accent : '#fff', color: active ? '#fff' : C.inkSoft, fontWeight: active ? 600 : 500 }}>{a}</button>
                            );
                          })}
                        </div>
                        {understanding.valueProps?.length ? (
                          <div style={{ fontSize: 10.5, color: C.inkFaint, lineHeight: 1.4 }}>Verdiløfter: {understanding.valueProps.slice(0, 3).join(' · ')}</div>
                        ) : null}
                      </div>
                      {cmdRow('Juster: «gjør den mer investor-rettet»…')}
                      {clarifyBox}
                      {replyLine}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...btn, justifyContent: 'center', background: '#fff', borderColor: C.lineStrong, padding: '0 13px' }}
                          onClick={() => { setUnderstanding(null); setGenerated(false); }} title="Endre beskrivelse / forstå på nytt">←</button>
                        <button style={{ ...btn, flex: 1, justifyContent: 'center', background: C.accent, color: '#fff', borderColor: C.accent, fontWeight: 600, padding: '10px 13px', boxShadow: '0 1px 3px rgba(239,138,93,0.35)', opacity: directorBusy ? 0.6 : 1 }}
                          disabled={directorBusy} onClick={() => void generateDemo()}>
                          {directorBusy ? 'Lager demo…' : '② Generér demoen'}
                        </button>
                      </div>
                      {directorLine}
                    </>
                  )}

                  {/* ── STEG 3 · Forfin ── */}
                  {stage === 'refine' && (
                    <>
                      {understanding && (
                        <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={understanding.summary}>{project.scriptMeta?.audience || understanding.audience} · {understanding.summary}</span>
                          <span onClick={() => { setUnderstanding(null); setGenerated(false); }} style={{ cursor: 'pointer', color: C.accent, fontSize: 10.5, whiteSpace: 'nowrap' }}>endre</span>
                        </div>
                      )}
                      {cmdRow('Si til AI: «lag en voiceover»…')}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                        {['Lag en voiceover', 'Responsive check', 'Lag veiledning for innlogging'].map((q) => (
                          <span key={q} onClick={() => { if (!cmdBusy) void runCommand(q); }}
                            style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 7, border: `1px solid ${C.line}`, background: '#fff', color: C.inkSoft, cursor: cmdBusy ? 'default' : 'pointer' }}>{q}</span>
                        ))}
                        {customCmds.map((q) => (
                          <span key={q} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '3px 6px 3px 8px', borderRadius: 7, border: `1px solid ${C.accent}`, background: '#fdf0e7', color: '#b5651d' }}>
                            <span onClick={() => { if (!cmdBusy) void runCommand(q); }} style={{ cursor: cmdBusy ? 'default' : 'pointer' }}>{q}</span>
                            <span onClick={() => saveCustomCmds(customCmds.filter((x) => x !== q))} title="Fjern" style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                          </span>
                        ))}
                        <span onClick={addCustomCmd} title="Lag egen quick-kommando"
                          style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 7, border: `1px dashed ${C.lineStrong}`, background: '#fff', color: C.inkSoft, cursor: 'pointer' }}>+ Egen</span>
                      </div>
                      {clarifyBox}
                      {replyLine}
                      {/* Headline: autonom ferdig demo (TTS → Playwright-opptak → mux) */}
                      <button style={{ ...btn, width: '100%', justifyContent: 'center', background: C.accent, color: '#fff', borderColor: C.accent, fontWeight: 600, padding: '10px 13px', boxShadow: '0 1px 3px rgba(239,138,93,0.35)', opacity: demoVidBusy || directorBusy ? 0.6 : 1 }}
                        disabled={demoVidBusy || directorBusy} onClick={() => void runAutoDemo()}
                        title="AI kjører nettsiden, narrerer med voiceover og leverer en ferdig video — uten at du tar opp noe">
                        {demoVidBusy ? 'Lager ferdig demo…' : '✨ Generér ferdig demo (autonom)'}
                      </button>
                      {demoVidBlock}
                      <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginTop: 8, opacity: directorBusy ? 0.6 : 1 }}
                        disabled={directorBusy} onClick={() => void generateDemo()}>{directorBusy ? 'Lager…' : '↻ Generér scener på nytt'}</button>
                      {directorLine}
                      <div style={{ marginTop: 12 }}>
                        <div onClick={() => setShowTools((v) => !v)}
                          style={{ fontSize: 10.5, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ transition: 'transform .15s', transform: showTools ? 'rotate(90deg)' : 'none' }}>▸</span> Verktøy
                        </div>
                        {showTools && (
                          <div style={{ marginTop: 8 }}>
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', opacity: directorBusy ? 0.6 : 1 }}
                              disabled={directorBusy} onClick={() => void completeDemo()}
                              title="Fyll kun manglende felt (manus, target, overlay, varighet) uten å overskrive det du har skrevet">
                              ✦ Fullfør demoen (fyll hull)
                            </button>
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: capturing ? C.accent : '#fff', color: capturing ? '#fff' : C.ink, borderColor: capturing ? C.accent : C.lineStrong, marginTop: 8 }}
                              disabled={capturing} onClick={() => void startCapture()}
                              title="Åpne siden i et capture-vindu og klikk deg gjennom — hvert klikk blir et steg med hotspot">
                              {capturing ? `Tar opp klikk… (${captureCount})` : '☞ Klikk-capture fra side'}
                            </button>
                            {capturing && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>Klikk deg gjennom i capture-vinduet. Trykk «Fullfør» der når du er ferdig.</div>}
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginTop: 8, opacity: critiqueBusy ? 0.6 : 1 }}
                              disabled={critiqueBusy} onClick={() => void runCritic()}
                              title="La AI vurdere hele demoen mot målet og foreslå forbedringer">
                              ★ {critiqueBusy ? 'Vurderer…' : 'Vurder demoen (Critic)'}
                            </button>
                            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginTop: 8, opacity: visualBusy ? 0.6 : 1 }}
                              disabled={visualBusy} onClick={() => void runVisualBeats()}
                              title="La AI lese manuset og foreslå visuelle uthevinger der noe konkret nevnes — med preview">
                              ✦ {visualBusy ? 'Leser manus…' : 'Foreslå visuelle uthevinger'}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* Læring & presisjon (menneske-loop A/C/D) — kun i Forfin-steget */}
            {(generated || scenes.some((s) => !!s.narration?.trim())) && (
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 10 }}>
              <div style={{ fontSize: 10.5, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Læring & presisjon</div>
              {(() => {
                const uncertain = scenes.filter((s) => s.bindingConfidence === 'low');
                return uncertain.length > 0 ? (
                  <div style={{ background: '#fff8ec', border: '1px solid #f0d9a8', borderRadius: 8, padding: '7px 9px', marginBottom: 8 }}>
                    <div style={{ fontSize: 11.5, color: '#8a6516', marginBottom: 5 }}>AI er usikker på hvor {uncertain.length} element{uncertain.length === 1 ? '' : 'er'} er. Lær den hvor:</div>
                    <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', fontSize: 12 }}
                      onClick={() => teachScene(uncertain[0].id)}>◎ Lær AI: «{(uncertain[0].targetLabel || uncertain[0].title).slice(0, 28)}»</button>
                  </div>
                ) : null;
              })()}
              {driftTargets.length > 0 && (
                <div style={{ background: '#fdecec', border: '1px solid #f0b8b8', borderRadius: 8, padding: '7px 9px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, color: '#9a2b2b', marginBottom: 5 }}>{driftTargets.length} lært element{driftTargets.length === 1 ? '' : 'er'} finnes ikke lenger på siden (redesignet?). Lær på nytt eller glem.</div>
                  <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', fontSize: 12 }}
                    onClick={() => setShowLearned(true)}>Se utdaterte ({driftTargets.length})</button>
                </div>
              )}
              <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', fontSize: 12 }}
                onClick={() => setShowLearned(true)}
                title="Se, rediger og slett det AI har lært om hvor elementene er">
                ◈ Det AI har lært ({learnedTargetCount()})
              </button>
            </div>
            )}
          </div>
        </div>

        {/* ── STORY-modus: gjenbruk StoryView ── */}
        {storyMode ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <StoryView
              picks={storyPicks} chapters={storyChapters}
              focusedPickIndex={selected?.index ?? null}
              onFocusPick={(idx) => { if (idx == null) return; const sc = scenes.find((s) => s.index === idx); if (sc) selectScene(sc.id); }}
              projectInfo={{
                project: project.name, client: DEMO_TYPE_LABELS[project.demoType],
                duration: fmt(totalDuration(scenes)), format: project.format,
                created: new Date(project.createdAt).toLocaleDateString('nb-NO'),
                updated: new Date(project.updatedAt).toLocaleDateString('nb-NO'),
              }}
              onBackToProject={() => setStoryMode(false)} onStartEditing={() => setStoryMode(false)}
            />
          </div>
        ) : nav === 'export' ? (
          <div style={{ flex: 1, minHeight: 0 }}><ExportView /></div>
        ) : nav === 'create' ? (
          <div style={{ flex: 1, minHeight: 0 }}><CreateDemoView onCreated={() => setNav('flow')} /></div>
        ) : nav === 'preview' ? (
          <div style={{ flex: 1, minHeight: 0 }}><DevicePreviewView /></div>
        ) : nav === 'marketing' ? (
          hasModule('marketing') ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}><MarketingPanel onOpenSignIn={() => setShowSignIn(true)} /></div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ModuleGate module="marketing" signedIn={aiReady} onClose={() => setNav('flow')} onSignIn={() => setShowSignIn(true)} />
            </div>
          )
        ) : nav === 'library' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}><LibraryPanel /></div>
        ) : (
          <>
            {/* ── Blocks panel (demo-typer) ── */}
            <div style={{ width: 230, background: C.panel, borderRight: `1px solid ${C.line}`, padding: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Demo-typer <span style={{ color: C.inkFaint }}>‹</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => (
                  <div key={t} onClick={() => {
                    if (t === project.demoType) return;
                    // Bytt mal: re-seed flowen. Bekreft kun hvis brukeren har gjort
                    // reelt opptaks-arbeid som ville gått tapt.
                    const reseed = !hasRecordedWork(scenes) ||
                      window.confirm(`Bytte til «${DEMO_TYPE_LABELS[t]}»-mal? Dette erstatter scene-flowen. Opptak du har gjort følger ikke med over i den nye malen.`);
                    if (!reseed) return;
                    applyDemoTypeTemplate(t, true);
                  }}
                    title={`${DEMO_TYPE_LABELS[t]} — ${DEMO_TYPE_TEMPLATES[t].scenes.length} scener · ~${DEMO_TYPE_TEMPLATES[t].targetSeconds}s`}
                    style={{ aspectRatio: '1.15', border: `1px solid ${project.demoType === t ? C.accent : C.line}`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: C.inkSoft, background: project.demoType === t ? C.cream : '#fff' }}>
                    <div style={{ fontSize: 20 }}>{DEMO_TYPE_ICON[t]}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{DEMO_TYPE_LABELS[t].split(' ')[0]}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 18 }}>Lagrede maler <span style={{ color: C.inkFaint }}>›</span></div>

              {/* ── Visning (render-toggles) ── */}
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 20, marginBottom: 4 }}>Visning</div>
              {(Object.keys(RENDER_OPTION_LABELS) as (keyof DemoRenderOptions)[]).map((k) => (
                <Toggle key={k} label={RENDER_OPTION_LABELS[k]} on={(project.render ?? defaultRenderOptions())[k]}
                  onChange={(v) => setRenderOption(k, v)} />
              ))}

              {/* ── Responsive Check ── */}
              <button style={{ ...outlineBtn, width: '100%', justifyContent: 'center', marginTop: 16, opacity: respBusy ? 0.6 : 1 }}
                disabled={respBusy} onClick={() => void runResponsiveCheck_()}>
                {respBusy ? 'Sjekker…' : '⤢ Responsive Check'}
              </button>
              <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6, lineHeight: 1.4 }}>Sjekker siden i desktop, tablet og mobil.</div>

              {/* ── Validation ── */}
              <button style={{ ...outlineBtn, width: '100%', justifyContent: 'center', marginTop: 10 }}
                onClick={() => setShowValidation(true)}>
                ✓ Validér handlinger
              </button>
              <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6, lineHeight: 1.4 }}>Expected ↔ Detected — Match / Warning per scene.</div>
            </div>

            {/* ── Center: LIVE device preview ── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'auto', padding: '16px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 4, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 3 }}>
                  {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => (
                    <div key={d} onClick={() => selected && setSceneDevice(selected.id, d)} title={DEVICE_LABEL[d]}
                      style={{ minWidth: 40, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '0 8px',
                        background: previewDevice === d ? C.creamActive : 'transparent', color: previewDevice === d ? C.ink : C.inkFaint }}>
                      {DEVICE_LABEL[d]}
                    </div>
                  ))}
                </div>
                {selected && (
                  <button
                    onClick={() => setPlacingHotspot((v) => !v)}
                    title={`Klikk på preview-en for å markere elementet handlingen gjelder. AI har lært ${learnedTargetCount()} korreksjon(er).`}
                    style={{ ...btn, height: 34, background: placingHotspot ? C.accent : '#fff', color: placingHotspot ? '#fff' : C.ink, borderColor: placingHotspot ? C.accent : C.lineStrong }}>
                    ◎ {placingHotspot ? 'Klikk på elementet…' : selected.hotspot ? 'Flytt hotspot' : 'Lær AI hvor'}
                  </button>
                )}
                {/* Zoom på enhets-preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, height: 34, boxSizing: 'border-box' }}>
                  <div onClick={() => zoomBy(-0.25)} title="Zoom ut"
                    style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', fontSize: 15, color: previewZoom <= 0.5 ? C.inkFaint : C.ink }}>−</div>
                  <div onClick={() => setPreviewZoom(1)} title="Tilbakestill zoom (100%)"
                    style={{ minWidth: 44, textAlign: 'center', fontSize: 12, cursor: 'pointer', color: C.inkSoft }}>{Math.round(previewZoom * 100)}%</div>
                  <div onClick={() => zoomBy(0.25)} title="Zoom inn"
                    style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', fontSize: 15, color: previewZoom >= 3 ? C.inkFaint : C.ink }}>+</div>
                </div>
              </div>

              {/* Scene: enheten på et "bord" — varm spotlight + overflate + kontaktskygge,
                  så det føles som å sitte ved et bord med enheten foran seg. */}
              <div style={{
                position: 'relative', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '18px 0 34px', flexShrink: 0,
                background: 'radial-gradient(68% 88% at 50% 22%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(255,255,255,0) 52%, rgba(58,47,42,0.07) 100%)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  width: `${baseWPct * previewZoom}%`, maxWidth: baseMaxW * previewZoom,
                }}>
                  <FramedDevice variant={previewVariant} url={project.url} width="100%"
                    screenshot={pickShot(project.scanShots, (selected?.startScrollPct ?? 0) / 100) ?? undefined}
                    overlay={<SceneInteractionOverlay hotspot={selected?.hotspot} render={render} device={previewDevice} actionType={selected?.actionType} animate={!placingHotspot} />}
                    focusZoom={render.autoZoom && selected?.hotspot && !placingHotspot ? { cx: selected.hotspot.x + selected.hotspot.w / 2, cy: selected.hotspot.y + selected.hotspot.h / 2, scale: 1.5 } : undefined}
                    onScreenClick={placingHotspot ? placeHotspot : undefined}
                    onScreenDraw={placingHotspot ? drawHotspot : undefined}
                    editRect={placingHotspot ? selected?.hotspot : undefined}
                    onEditRect={(rect) => { if (selected) { updateScene(selected.id, { hotspot: rect }); learnHotspot(rect); } }} />
                </div>
                {/* Jordet kontaktskygge under enheten */}
                <div style={{
                  width: `${baseWPct * previewZoom * 0.82}%`, maxWidth: baseMaxW * previewZoom * 0.82,
                  height: Math.round(16 * previewZoom), marginTop: previewVariant === 'macbook' ? Math.round(2 * previewZoom) : Math.round(14 * previewZoom),
                  background: 'radial-gradient(50% 100% at 50% 0%, rgba(0,0,0,0.30), rgba(0,0,0,0) 72%)',
                  filter: `blur(${Math.round(5 * previewZoom)}px)`, borderRadius: '50%', flexShrink: 0,
                }} />
              </div>

              {/* Scene-flow-kort */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 16, margin: 0 }}>Demo-flow</h3>
                  <div style={{ flex: 1 }} />
                  {/* Undo/redo */}
                  <button onClick={() => undo()} disabled={!canUndo()} title="Angre (⌘Z)"
                    style={{ ...btn, padding: '5px 9px', fontSize: 12, opacity: canUndo() ? 1 : 0.4 }}>↶ Angre</button>
                  <button onClick={() => redo()} disabled={!canRedo()} title="Gjør om (⌘⇧Z)"
                    style={{ ...btn, padding: '5px 9px', fontSize: 12, opacity: canRedo() ? 1 : 0.4 }}>↷ Gjør om</button>
                </div>
                {selectedSceneIds.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, background: C.creamActive, border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{selectedSceneIds.length} scene{selectedSceneIds.length === 1 ? '' : 'r'} valgt</span>
                    <div style={{ flex: 1 }} />
                    <button style={{ ...btn, padding: '4px 9px', fontSize: 12, color: '#9a2b2b', borderColor: '#f0b8b8' }} onClick={() => removeSelectedScenes()}>Slett valgte</button>
                    <button style={{ ...btn, padding: '4px 9px', fontSize: 12 }} onClick={() => clearSceneSelection()}>Avbryt</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>Dra for å endre rekkefølge · ⌘-klikk for å velge flere · ⌘Z angrer.</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  {scenes.map((s) => {
                    const multiSel = selectedSceneIds.includes(s.id);
                    const isPrimary = s.id === selectedSceneId;
                    const dropBefore = dragOverIndex === s.index && dragIndex != null && dragIndex !== s.index;
                    return (
                    <div key={s.id}
                      data-testid="scene-card"
                      draggable
                      onDragStart={(e) => { setDragIndex(s.index); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverIndex !== s.index) setDragOverIndex(s.index); }}
                      onDrop={(e) => { e.preventDefault(); if (dragIndex != null && dragIndex !== s.index) reorderScenes(dragIndex, s.index); setDragIndex(null); setDragOverIndex(null); }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) { toggleSceneSelected(s.id, true); return; }
                        clearSceneSelection(); selectScene(s.id); if (recording) goToStep(s.index);
                      }}
                      style={{ border: `2px solid ${multiSel ? C.dark : isPrimary ? C.accent : C.line}`, borderRadius: 10, padding: 10, cursor: 'grab', background: multiSel ? C.creamActive : '#fff', opacity: dragIndex === s.index ? 0.4 : 1, boxShadow: dropBefore ? `-3px 0 0 ${C.accent}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <span style={{ color: C.inkFaint, fontSize: 12, cursor: 'grab' }} title="Dra for å flytte">⠿</span>
                        <span style={{ fontWeight: 700, fontSize: 11 }}>{s.index + 1}</span>
                        <span style={{ fontSize: 10, color: C.inkFaint }}>{DEVICE_LABEL[s.device]}</span>
                        <div style={{ flex: 1 }} />
                        <span onClick={(e) => { e.stopPropagation(); if (s.index > 0) reorderScenes(s.index, s.index - 1); }}
                          title="Flytt tidligere" style={{ cursor: s.index > 0 ? 'pointer' : 'default', color: s.index > 0 ? C.inkSoft : C.line, fontSize: 12, padding: '0 2px' }}>‹</span>
                        <span onClick={(e) => { e.stopPropagation(); if (s.index < scenes.length - 1) reorderScenes(s.index, s.index + 1); }}
                          title="Flytt senere" style={{ cursor: s.index < scenes.length - 1 ? 'pointer' : 'default', color: s.index < scenes.length - 1 ? C.inkSoft : C.line, fontSize: 12, padding: '0 2px' }}>›</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: SCENE_STATUS_COLORS[s.status] }} />
                      </div>
                      <SceneThumb scene={s} url={project.url} height={64} />
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: C.inkFaint }}>{fmt(s.duration)} · {SCENE_STATUS_LABELS[s.status]}</div>
                    </div>
                    );
                  })}
                  <div onClick={() => addScene(scenes.length - 1)}
                    style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkSoft, fontSize: 22, minHeight: 110 }}>+</div>
                </div>
              </div>
            </div>

            {/* ── Right: scene settings (editerbar) ── */}
            <div style={{ width: 320, background: C.panel, borderLeft: `1px solid ${C.line}`, padding: 16, flexShrink: 0, overflowY: 'auto' }}>
              {recording && recorderScene ? (
                /* Guided recorder teleprompter */
                <>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: C.inkSoft, letterSpacing: 0.5 }}>Steg {recorderStepIndex + 1} av {scenes.length}</div>
                  <div style={{ height: 4, background: '#eee4d8', borderRadius: 2, margin: '6px 0 12px' }}>
                    <div style={{ height: '100%', width: `${((recorderStepIndex + 1) / scenes.length) * 100}%`, background: C.accent, borderRadius: 2 }} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{recorderScene.title}</h3>
                  <div style={fldLabel}>Narration</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{recorderScene.narration || <em style={{ color: C.inkFaint }}>(ingen manus)</em>}</div>
                  <div style={fldLabel}>Required action</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, marginBottom: recorderScene.targetLabel ? 6 : 14 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${C.lineStrong}`, display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0 }}>{ACTION_META[recorderScene.actionType ?? 'click'].icon}</span>
                    <span>{recorderScene.requiredAction || <em style={{ color: C.inkFaint }}>(ingen)</em>}</span>
                  </div>
                  {recorderScene.targetLabel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', marginBottom: 14, background: C.cream }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{recorderScene.targetLabel}</span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 10.5, color: recorderScene.hotspot ? C.green : C.inkFaint }}>{recorderScene.hotspot ? '◎ fremhevet' : 'ingen hotspot'}</span>
                    </div>
                  )}
                  <span style={{ ...chip, background: SCENE_STATUS_COLORS[recorderScene.status] }}>{SCENE_STATUS_LABELS[recorderScene.status]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: rec.state === 'recording' ? '#ef4444' : C.inkSoft, margin: '14px 0' }}>
                    {rec.state === 'recording' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
                    {rec.state === 'recording' ? 'Tar opp denne scenen…' : rec.state === 'saving' ? 'Lagrer opptak…' : 'Opptaket venter. Systemet går ikke videre før du bekrefter.'}
                  </div>
                  {rec.error && <div style={{ fontSize: 11.5, color: '#c4453b', marginBottom: 10 }}>{rec.error}</div>}
                  {recorderScene.recordingPath && <div style={{ fontSize: 11, color: C.green, marginBottom: 10 }}>✓ Opptak lagret</div>}
                  <button style={{ ...primaryBtn, background: C.green, width: '100%', marginBottom: 8, opacity: rec.state === 'saving' ? 0.6 : 1 }}
                    disabled={rec.state === 'saving'}
                    onClick={async () => {
                      // Stopp + lagre opptak, sett recordingPath, marker done, gå videre + start neste opptak.
                      if (rec.state === 'recording') {
                        const path = await rec.stopAndSave(project.id, recorderScene.id);
                        if (path) updateScene(recorderScene.id, { recordingPath: path });
                      }
                      markCurrentDone();
                      if (recorderStepIndex < scenes.length - 1) {
                        nextStep();
                        await startForCurrent();
                      } else {
                        setRecording(false);
                      }
                    }}>✓ Mark as Done</button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8 }}
                    onClick={async () => { retakeCurrent(); await startForCurrent(); }}>↺ Retake</button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8, opacity: recorderStepIndex >= scenes.length - 1 ? 0.5 : 1 }} disabled={recorderStepIndex >= scenes.length - 1}
                    onClick={async () => { if (rec.state === 'recording') await rec.stopAndSave(project.id, recorderScene.id).then((pth) => pth && updateScene(recorderScene.id, { recordingPath: pth })); nextStep(); await startForCurrent(); }}>→ Next Step</button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8, opacity: autoBusy ? 0.6 : 1 }} disabled={autoBusy}
                    onClick={() => void autoRunCurrent()}
                    title="La systemet utføre handlingen automatisk på target-elementet (continueMode: auto)">
                    ▶ {autoBusy ? 'Kjører…' : 'Kjør automatisk'}
                  </button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8, opacity: verifyBusy ? 0.6 : 1 }} disabled={verifyBusy}
                    onClick={() => void verifyCurrentAction()}
                    title="Åpne siden og klikk elementet for å bekrefte at riktig handling utføres">
                    ◎ {verifyBusy ? 'Venter på klikk…' : 'Verifiser handling'}
                  </button>
                  <button style={{ ...outlineBtn, width: '100%' }} onClick={() => { rec.cancel(); setRecording(false); }}>Avslutt opptak</button>
                </>
              ) : selected ? (
                <>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scene-innstillinger</h3>
                  <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
                    {(['Guide', 'Script', 'Notes'] as const).map((t) => (
                      <div key={t} onClick={() => setTab(t)} style={{ fontSize: 13, paddingBottom: 9, cursor: 'pointer', color: tab === t ? C.ink : C.inkFaint, fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? `2px solid ${C.ink}` : '2px solid transparent' }}>{t}</div>
                    ))}
                  </div>

                  <div style={fldLabel}>Scene-tittel</div>
                  <input style={field} value={selected.title} onChange={(e) => updateScene(selected.id, { title: e.target.value })} />

                  <div style={fldLabel}>{tab === 'Notes' ? 'Notater' : 'Manus / narration'}</div>
                  <textarea style={{ ...field, height: 70, resize: 'vertical', fontFamily: 'inherit' }} value={selected.narration}
                    placeholder="Hva som skal sies i denne scenen…" onChange={(e) => updateScene(selected.id, { narration: e.target.value })} />
                  {tab !== 'Notes' && <WebSpeechBar scene={selected} language={project.language} />}

                  <div style={row2}>
                    <div><div style={fldLabel}>Enhet</div>
                      <select style={field} value={selected.device} onChange={(e) => setSceneDevice(selected.id, e.target.value as DemoDevice)}>
                        {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => <option key={d} value={d}>{DEVICE_LABEL[d]}</option>)}
                      </select>
                    </div>
                    <div><div style={fldLabel}>Varighet (s)</div>
                      <input style={field} type="number" value={selected.duration} onChange={(e) => updateScene(selected.id, { duration: Number(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div style={fldLabel}>Required action</div>
                  <div style={row2}>
                    <select style={field} value={selected.actionType ?? 'click'} onChange={(e) => updateScene(selected.id, { actionType: e.target.value as DemoActionType })}>
                      {(Object.keys(ACTION_META) as DemoActionType[]).map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
                    </select>
                    <input style={field} value={selected.targetLabel ?? ''} placeholder="Element, f.eks. «Start free trial»" onChange={(e) => updateScene(selected.id, { targetLabel: e.target.value })} />
                  </div>
                  <input style={{ ...field, marginTop: 6 }} value={selected.requiredAction} placeholder="F.eks. Click the Start button" onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <button style={{ ...outlineBtn, flex: 1, background: placingHotspot ? C.accent : '#fff', color: placingHotspot ? '#fff' : C.ink, borderColor: placingHotspot ? C.accent : C.lineStrong }}
                      onClick={() => setPlacingHotspot((v) => !v)}>
                      ◎ {placingHotspot ? 'Tegn rundt elementet…' : selected.hotspot ? 'Tegn hotspot på nytt' : 'Tegn hotspot på preview'}
                    </button>
                    {selected.hotspot && (
                      <button style={{ ...outlineBtn, padding: '0 10px' }} title="Fjern hotspot"
                        onClick={() => updateScene(selected.id, { hotspot: undefined })}>✕</button>
                    )}
                  </div>
                  {placingHotspot
                    ? <div style={{ fontSize: 11, color: C.accent, marginTop: 5 }}>{selected.hotspot ? 'Dra boksen for å flytte, eller dra et hjørne/kant for å endre størrelse. Tegn et nytt rektangel på tom flate for å erstatte.' : 'Dra et rektangel rundt elementet for eksakt markering — eller bare klikk for en standard-boks.'}</div>
                    : selected.hotspot
                    ? <div style={{ marginTop: 6 }}><span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#e6f3ec', color: C.green, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />Element markert — fremheves i opptak</span></div>
                    : <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 5 }}>Tegn rundt elementet på preview-en så Guided Recorder kan fremheve det presist.</div>}
                  {selected.ctaType && (
                    <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#fdf0e7', color: '#b5651d' }}>CTA: {CTA_LABELS[selected.ctaType]}</span>
                  )}

                  <div style={fldLabel}>Kamera & overgang (autonom video)</div>
                  <div style={row2}>
                    <select style={field} value={selected.cameraMove ?? 'auto'} onChange={(e) => updateScene(selected.id, { cameraMove: e.target.value as CameraMove })}>
                      {(Object.keys(CAMERA_MOVE_LABELS) as CameraMove[]).map((m) => <option key={m} value={m}>{CAMERA_MOVE_LABELS[m]}</option>)}
                    </select>
                    <select style={field} value={selected.transition ?? 'auto'} onChange={(e) => updateScene(selected.id, { transition: e.target.value as SceneTransition })}>
                      {(Object.keys(SCENE_TRANSITION_LABELS) as SceneTransition[]).map((t) => <option key={t} value={t}>{SCENE_TRANSITION_LABELS[t]}</option>)}
                    </select>
                  </div>

                  <div style={fldLabel}>Overlay-tekst</div>
                  <input style={field} value={selected.overlayText ?? ''} onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />

                  {selected.startScrollPct != null && (
                    <>
                      <div style={fldLabel}>Start-scroll (% — fra Responsive Check)</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ ...field, flex: 1 }} type="number" min={0} max={100} value={selected.startScrollPct}
                          onChange={(e) => updateScene(selected.id, { startScrollPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                        <button style={{ ...outlineBtn, padding: '0 10px' }} title="Fjern start-scroll"
                          onClick={() => updateScene(selected.id, { startScrollPct: undefined })}>✕</button>
                      </div>
                    </>
                  )}

                  <div style={fldLabel}>Progresjon</div>
                  <div style={{ ...sel, background: C.cream }}>continueMode: manual — venter på deg</div>

                  <button style={{ ...outlineBtn, width: '100%', marginTop: 14, color: '#c4453b', borderColor: '#e6c5c2' }}
                    disabled={scenes.length <= 1} onClick={() => removeScene(selected.id)}>Slett scene</button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* ── Bottom: stat cards ── */}
      {!storyMode && nav !== 'export' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.line, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
          <Stat h="⚇ Devices" v={[...new Set(scenes.map((s) => DEVICE_LABEL[s.device]))].join(' · ')} link="Endre →" />
          <Stat h="▦ Scener" v={`${scenes.length} scener`} s={`${doneCount} ferdig`} />
          <Stat h="⏱ Varighet" v={`${fmt(totalDuration(scenes))} total`} s="Anbefalt 60–90 s" />
          <Stat h="◷ Opptak" v={recording ? `Steg ${recorderStepIndex + 1} av ${scenes.length}` : 'Ikke startet'} s={recording ? 'Venter på deg' : 'Trykk Record'} />
          <Stat h="⤓ Format" v={`${project.format} · 1080p`} link="Eksport →" />
          <div style={{ background: C.panel, padding: '13px 15px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${C.green}`, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, float: 'right' }}>{Math.round((doneCount / Math.max(scenes.length, 1)) * 100)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginBottom: 7 }}>✓ Demo-score</div>
            <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{doneCount === scenes.length ? 'Klar for eksport' : 'Ta opp scener'}</div>
          </div>
        </div>
      )}
      {showSignIn && (
        <RoleRoomSignInDialog onClose={() => setShowSignIn(false)} onSignedIn={() => { setAiReady(true); setShowSignIn(false); }} />
      )}
      {respReport && (
        <ResponsiveCheckModal report={respReport} onClose={() => setRespReport(null)}
          onApply={(fix) => applyResponsiveFix(fix)} />
      )}
      {critique && (
        <DirectorCritiqueModal critique={critique} onClose={() => setCritique(null)}
          onGoto={(idx) => { const sc = scenes.find((s) => s.index === idx); if (sc) { selectScene(sc.id); setStoryMode(false); setNav('flow'); } setCritique(null); }} />
      )}
      {showValidation && project && (
        <ValidationModal
          scenes={project.scenes}
          onClose={() => setShowValidation(false)}
          onGoto={(id) => { selectScene(id); setStoryMode(false); setNav('flow'); setShowValidation(false); }}
          onSetStatus={(id, status) => updateScene(id, { status })}
        />
      )}
      {showLearned && project && (
        <LearnedTargetsModal
          url={project.url}
          drift={driftTargets}
          onClose={() => setShowLearned(false)}
          onForget={(label) => { removeLearnedTarget(project.url, label); setDriftTargets((d) => d.filter((t) => t.label !== label)); }}
          onClearAll={() => { clearLearnedTargets(project.url); setDriftTargets([]); }}
        />
      )}
      {showPreflight && (
        <PreflightModal url={project?.url ?? ''} onClose={() => setShowPreflight(false)} onConnect={() => { setShowPreflight(false); setShowSignIn(true); }} />
      )}
      {visualBeats && project && (
        <VisualBeatsModal
          beats={visualBeats}
          scenes={project.scenes}
          brandColor={project.branding?.brandColor}
          onClose={() => setVisualBeats(null)}
          onApply={(b) => applyVisualBeat(b)}
          onGoto={(idx) => { const sc = scenes[idx]; if (sc) { selectScene(sc.id); setStoryMode(false); setNav('flow'); } }}
        />
      )}
    </div>
  );
}

/** «Det AI har lært» (D): se/glem korreksjoner pr. side + utdaterte (drift). */
function LearnedTargetsModal({ url, drift, onClose, onForget, onClearAll }: {
  url: string;
  drift: LearnedTarget[];
  onClose: () => void;
  onForget: (label: string) => void;
  onClearAll: () => void;
}) {
  const [, force] = useState(0);
  const items = listLearnedTargetsForHost(url);
  const driftSet = new Set(drift.map((d) => d.label));
  let host = url; try { host = new URL(url).host; } catch { /* */ }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Det AI har lært</h3>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>Korreksjoner for <strong>{host}</strong> — overstyrer AI-ens gjetting når du lager en flow på denne siden.</div>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, padding: '18px 0' }}>Ingenting lært ennå. Plasser et hotspot («Lær AI hvor») eller kjør «Klikk-capture fra side» — så husker AI elementene her.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((t) => {
              const stale = driftSet.has(t.label);
              return (
                <div key={t.label} style={{ border: `1px solid ${stale ? '#f0b8b8' : C.line}`, background: stale ? '#fdf3f3' : '#fff', borderRadius: 9, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.correctLabel || t.label}</div>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: t.source === 'capture' ? '#e8f0fe' : '#eef7ee', color: t.source === 'capture' ? '#2a5bd7' : '#2e7d32' }}>
                      {t.source === 'capture' ? 'fra opptak' : 'manuelt'}
                    </span>
                    {t.count > 1 && <span style={{ fontSize: 10, color: C.inkFaint }}>×{t.count}</span>}
                    {stale && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fdecec', color: '#9a2b2b' }}>utdatert</span>}
                    <div style={{ flex: 1 }} />
                    <button style={{ ...btn, padding: '3px 9px', fontSize: 11.5, background: '#fff' }}
                      onClick={() => { onForget(t.label); force((n) => n + 1); }}>Glem</button>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 4, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
                    {t.selector || '(kun hotspot)'}{t.actionType ? ` · ${t.actionType}` : ''}{t.hotspot ? ' · hotspot' : ''}{t.rejectSelectors?.length ? ` · avvist ${t.rejectSelectors.length}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {items.length > 0 && (
          <button style={{ ...btn, marginTop: 14, background: '#fff', color: '#9a2b2b', borderColor: '#f0b8b8' }}
            onClick={() => { onClearAll(); force((n) => n + 1); }}>Glem alt for {host}</button>
        )}
      </div>
    </div>
  );
}

/** Pre-flight «Sjekk oppsett»: klar/ikke-klar + ekte capture-test. */
function PreflightModal({ url, onClose, onConnect }: { url: string; onClose: () => void; onConnect: () => void }) {
  const [checks, setChecks] = useState<Check[]>(() => staticChecks());
  const [probing, setProbing] = useState(false);
  const overall = overallStatus(checks);
  const COLOR: Record<Check['status'], string> = { ok: C.green, warn: '#b5651d', fail: '#c4453b', pending: C.inkFaint };
  const ICON: Record<Check['status'], string> = { ok: '✓', warn: '!', fail: '✕', pending: '…' };
  const runProbe = async () => {
    setProbing(true);
    const c = await captureProbe(url);
    setChecks((cur) => [...cur.filter((x) => x.id !== 'capture'), c]);
    setProbing(false);
  };
  const banner = overall === 'ready'
    ? { t: 'Klar til å starte', c: C.green, bg: '#e6f3ec' }
    : overall === 'blocked'
      ? { t: 'Ikke klar — noe må fikses', c: '#c4453b', bg: '#fdecec' }
      : { t: 'Klar med forbehold', c: '#b5651d', bg: '#fff8ec' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Sjekk oppsett</h3>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ background: banner.bg, color: banner.c, fontWeight: 700, fontSize: 13.5, borderRadius: 9, padding: '9px 12px', marginBottom: 14 }}>{banner.t}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checks.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px' }}>
              <span style={{ color: COLOR[c.status], fontWeight: 700, width: 14, flexShrink: 0 }}>{ICON[c.status]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>{c.detail}</div>
                {c.fix && <div style={{ fontSize: 11.5, color: COLOR[c.status], marginTop: 3 }}>→ {c.fix}</div>}
                {c.id === 'ai' && c.status === 'fail' && (
                  <button style={{ ...btn, padding: '4px 10px', fontSize: 11.5, marginTop: 6 }} onClick={onConnect}>Koble til AI</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button style={{ ...btn, opacity: probing ? 0.6 : 1 }} disabled={probing} onClick={() => void runProbe()}>
            {probing ? 'Tester capture…' : `Kjør capture-test${url ? ` mot ${(() => { try { return new URL(url).host; } catch { return url; } })()}` : ''}`}
          </button>
          <button style={{ ...btn }} onClick={() => setChecks(staticChecks())}>Oppdater</button>
          <div style={{ flex: 1 }} />
          <button style={{ ...outlineBtn }} onClick={onClose}>Lukk</button>
        </div>
      </div>
    </div>
  );
}

/** Manus-drevne visuelle forslag med PREVIEW av hvordan uthevingen ser ut. */
function VisualBeatsModal({ beats, scenes, brandColor, onClose, onApply, onGoto }: {
  beats: VisualBeat[];
  scenes: DemoScene[];
  brandColor?: string;
  onClose: () => void;
  onApply: (b: VisualBeat) => void;
  onGoto: (sceneIndex: number) => void;
}) {
  const accent = brandColor || C.accent;
  const [applied, setApplied] = useState<Record<number, boolean>>({});
  const kindLabel: Record<VisualBeat['kind'], string> = { overlay: 'Tekst-overlay', stat: 'Stat-callout', highlight: 'Highlight', infographic: 'Infographic' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Visuelle uthevinger fra manuset</h3>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>AI fant {beats.length} sted{beats.length === 1 ? '' : 'er'} der manuset nevner noe konkret. Slik vil det se ut:</div>
        {beats.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, padding: '12px 0' }}>Ingenting å fremheve.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {beats.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                {/* PREVIEW av uthevingen på en mock-skjerm */}
                <div style={{ position: 'relative', width: 150, height: 95, flexShrink: 0, background: 'linear-gradient(135deg,#2f2a26,#544b43)', borderRadius: 8, overflow: 'hidden' }}>
                  {b.kind === 'stat' ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                      <div style={{ background: accent, color: '#fff', fontWeight: 800, fontSize: 18, padding: '6px 12px', borderRadius: 8, textAlign: 'center', maxWidth: '88%' }}>{b.overlay}</div>
                    </div>
                  ) : b.kind === 'infographic' ? (
                    <div style={{ position: 'absolute', inset: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                      {[0, 1, 2, 3].map((n) => <div key={n} style={{ background: 'rgba(255,255,255,.16)', borderRadius: 4, borderLeft: `3px solid ${accent}` }} />)}
                    </div>
                  ) : (
                    <>
                      {b.kind === 'highlight' && <div style={{ position: 'absolute', left: '30%', top: '24%', width: '40%', height: '30%', border: `2px solid ${accent}`, borderRadius: 6, boxShadow: `0 0 0 999px rgba(0,0,0,.25)` }} />}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.65))', padding: '14px 8px 7px' }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: 6 }}>{b.overlay}</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Info + handlinger */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: accent, padding: '1px 7px', borderRadius: 6 }}>{kindLabel[b.kind]}</span>
                    <span style={{ fontSize: 11, color: C.inkFaint }}>Scene {b.index + 1}</span>
                  </div>
                  {b.phrase && <div style={{ fontSize: 12, color: C.inkSoft, fontStyle: 'italic', marginBottom: 3 }}>«{b.phrase}»</div>}
                  {b.why && <div style={{ fontSize: 11.5, color: C.inkFaint, marginBottom: 8 }}>{b.why}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...btn, padding: '5px 11px', fontSize: 11.5, background: applied[i] ? C.green : '#fff', color: applied[i] ? '#fff' : C.ink, borderColor: applied[i] ? C.green : C.lineStrong }}
                      onClick={() => { onApply(b); setApplied((a) => ({ ...a, [i]: true })); }}>
                      {applied[i] ? '✓ Brukt' : 'Bruk'}
                    </button>
                    <button style={{ ...btn, padding: '5px 11px', fontSize: 11.5, background: '#fff' }} onClick={() => onGoto(b.index)} disabled={b.index >= scenes.length}>Gå til scene</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button style={{ ...outlineBtn, width: '100%', marginTop: 14 }} onClick={onClose}>Lukk</button>
      </div>
    </div>
  );
}

/** Director Critic-panel: score (0–100) + konkrete forbedringer per område/scene. */
function DirectorCritiqueModal({ critique, onClose, onGoto }: {
  critique: DirectorCritique;
  onClose: () => void;
  onGoto: (sceneIndex: number) => void;
}) {
  const scoreColor = critique.score >= 75 ? C.green : critique.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', border: `4px solid ${scoreColor}`, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{critique.score}</div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Director Critic</h3>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{critique.summary}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ fontSize: 11, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>{critique.issues.length} forbedringer</div>
        {critique.issues.map((iss, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: CRITIQUE_SEVERITY_COLORS[iss.severity], marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.3 }}>{iss.area}</div>
              <div style={{ fontSize: 12.5 }}>{iss.message}</div>
            </div>
            {typeof iss.sceneIndex === 'number' && (
              <button style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 10px', alignSelf: 'center' }} onClick={() => onGoto(iss.sceneIndex!)}>Scene {iss.sceneIndex + 1}</button>
            )}
          </div>
        ))}
        <button style={{ ...outlineBtn, width: '100%', marginTop: 4 }} onClick={onClose}>Lukk</button>
      </div>
    </div>
  );
}

/** Validation-panel (§7): Expected ↔ Detected → Match/Warning per scene + godkjenn. */
function ValidationModal({ scenes, onClose, onGoto, onSetStatus }: {
  scenes: DemoScene[];
  onClose: () => void;
  onGoto: (id: string) => void;
  onSetStatus: (id: string, status: DemoScene['status']) => void;
}) {
  const rows = scenes.map((s) => ({ s, match: sceneActionMatch(s), val: validateScene(s) }));
  const nMatch = rows.filter((r) => r.match === 'match').length;
  const nWarn = rows.filter((r) => r.match === 'warning').length;
  const nUnver = rows.filter((r) => r.match === 'unverified').length;
  const nNotReady = rows.filter((r) => !r.val.ready).length;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Validation & status</h3>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>
          <span><b style={{ color: ACTION_MATCH_COLORS.match }}>{nMatch}</b> Match</span>
          <span><b style={{ color: ACTION_MATCH_COLORS.warning }}>{nWarn}</b> Warning</span>
          <span><b style={{ color: ACTION_MATCH_COLORS.unverified }}>{nUnver}</b> ikke verifisert</span>
          <span style={{ marginLeft: 'auto' }}>{nNotReady > 0 ? `${nNotReady} scener mangler felt` : 'Alle scener komplette'}</span>
        </div>
        {rows.map(({ s, match, val }) => (
          <div key={s.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{s.index + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{s.title}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 7, color: '#fff', background: ACTION_MATCH_COLORS[match] }}>{ACTION_MATCH_LABELS[match]}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: '3px 8px', fontSize: 12, marginTop: 8 }}>
              <span style={{ color: C.inkFaint }}>Expected</span><span>{expectedActionText(s)}</span>
              <span style={{ color: C.inkFaint }}>Detected</span><span style={{ color: s.detectedSelector ? C.ink : C.inkFaint }}>{s.detectedSelector ? `${ACTION_META[s.actionType ?? 'click'].verb} ${s.targetLabel || s.detectedSelector}` : '(ikke verifisert — kjør capture eller marker manuelt)'}</span>
            </div>
            {!val.ready && <div style={{ fontSize: 11.5, color: '#b5651d', marginTop: 7 }}>⚠ {val.issues.join(' · ')}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button style={{ ...outlineBtn, fontSize: 12, padding: '6px 11px' }} onClick={() => onGoto(s.id)}>Gå til scene</button>
              <div style={{ flex: 1 }} />
              {s.status !== 'needs_review' && <button style={{ ...outlineBtn, fontSize: 12, padding: '6px 11px', color: '#b5651d', borderColor: '#e6c5c2' }} onClick={() => onSetStatus(s.id, 'needs_review')}>Trenger gjennomgang</button>}
              <button style={{ ...primaryBtn, fontSize: 12, padding: '6px 12px', background: s.status === 'approved' ? C.green : undefined, opacity: s.status === 'approved' ? 0.7 : 1 }}
                disabled={s.status === 'approved'} onClick={() => onSetStatus(s.id, 'approved')}>
                {s.status === 'approved' ? '✓ Godkjent' : 'Godkjenn'}
              </button>
            </div>
          </div>
        ))}
        <button style={{ ...outlineBtn, width: '100%', marginTop: 4 }} onClick={onClose}>Lukk</button>
      </div>
    </div>
  );
}

/** Scene-kort thumbnail: live mini-preview av siden (skalert iframe) for scenens
 *  enhet. Bruker frosset skjermbilde hvis det finnes, ellers live render. */
function SceneThumb({ scene, url, height = 80 }: { scene: DemoScene; url: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => setBoxW(el.clientWidth);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (scene.thumbnailDataUrl) {
    return <img src={scene.thumbnailDataUrl} alt="" style={{ width: '100%', height, objectFit: 'cover', objectPosition: 'top', borderRadius: 7, marginBottom: 8, border: `1px solid ${C.line}` }} />;
  }
  const variant: FrameVariant = scene.device === 'ipad' && scene.orientation === 'landscape' ? 'ipad_landscape' : scene.device;
  const vw = VIEWPORT_W[variant];
  const scale = boxW > 0 ? boxW / vw : 0;
  const logicalH = scale > 0 ? height / scale : height;
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height, borderRadius: 7, overflow: 'hidden', background: '#fff', border: `1px solid ${C.line}`, marginBottom: 8 }}>
      <iframe src={url} scrolling="no" tabIndex={-1} title="" aria-hidden
        style={{ width: vw, height: logicalH, border: 0, transform: `scale(${scale || 0.001})`, transformOrigin: '0 0', pointerEvents: 'none', opacity: scale > 0 ? 1 : 0 }} />
    </div>
  );
}

/** Create Demo — start/oversikt: gjeldende demo + skjema for å starte en ny. */
function CreateDemoView({ onCreated }: { onCreated?: () => void }) {
  const { project, createProject } = useDemoStudio();
  const [urlInput, setUrlInput] = useState('');
  const [demoType, setDemoType] = useState<DemoType>('product_demo');
  const normalizedUrl = normalizeUrl(urlInput);
  const valid = /^https?:\/\/\S+\.\S+/i.test(normalizedUrl);
  const start = () => {
    if (project && !window.confirm('Erstatte gjeldende demo med en ny? (Du kan eksportere først.)')) return;
    createProject(normalizedUrl, demoType);
    onCreated?.(); // gå rett til Flow Builder for å redigere den nye demoen
  };
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: C.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 32px' }}>
        {project && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, background: '#fff', marginBottom: 26 }}>
            <div style={{ fontSize: 11, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Nåværende demo</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{project.name}</div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>{project.url} · {DEMO_TYPE_LABELS[project.demoType]} · {project.scenes.length} scener · {fmt(totalDuration(project.scenes))}</div>
          </div>
        )}
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{project ? 'Start en ny video' : 'Hva vil du lage?'}</h2>
        <p style={{ color: C.inkSoft, fontSize: 13.5, margin: '0 0 18px' }}>Lim inn nettadressen din, så lager jeg en video av den for deg.{project ? ' En ny video erstatter den du har nå.' : ''}</p>

        <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 7 }}>1. Hva slags video?</div>
        <select style={{ ...field, padding: '11px 12px' }} value={demoType} onChange={(e) => setDemoType(e.target.value as DemoType)}>
          {(Object.keys(DEMO_TYPE_FRIENDLY) as DemoType[]).map((t) => <option key={t} value={t}>{DEMO_TYPE_FRIENDLY[t].label}</option>)}
        </select>
        <p style={{ color: C.inkFaint, fontSize: 12, margin: '6px 2px 0', lineHeight: 1.4 }}>{DEMO_TYPE_FRIENDLY[demoType].desc} <span style={{ color: C.accent }}>· AI justerer dette automatisk etter siden din.</span></p>

        <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, margin: '18px 0 7px' }}>2. Nettadressen</div>
        <input style={{ ...field, fontSize: 15, padding: '13px 15px' }} placeholder="https://din-side.no" value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && valid) start(); }} />
        {!valid && urlInput.length > 2 && <p style={{ color: C.inkSoft, fontSize: 12.5, margin: '6px 2px 0' }}>Skriv inn en gyldig nettadresse (f.eks. <code>theroleroom.com</code>).</p>}

        <div><button style={{ ...primaryBtn, opacity: valid ? 1 : 0.5, marginTop: 18 }} disabled={!valid} onClick={start}>
          {project ? 'Lag ny video →' : 'Kom i gang →'}
        </button></div>
        <p style={{ color: C.inkFaint, fontSize: 12, margin: '12px 2px 0', lineHeight: 1.45 }}>Neste steg kan du la AI lage hele videoen ferdig automatisk — med stemme og det hele — eller styre hvert steg selv.</p>
      </div>
    </div>
  );
}

/** Device Preview — ren forhåndsvisning: stor enhet, enhetsbytte, spill gjennom scenene. */
function DevicePreviewView() {
  const { project, selectedSceneId, selectScene } = useDemoStudio();
  const [override, setOverride] = useState<DemoDevice | null>(null);
  const [playing, setPlaying] = useState(false);
  const scenes = project?.scenes ?? [];
  const idx = Math.max(0, scenes.findIndex((s) => s.id === selectedSceneId));
  const scene = scenes[idx] ?? scenes[0];
  // Spill gjennom hele demoen: avansér per scene-varighet + les narrasjon (Web
  // Speech) — så man «ser hele videoen» før eksport. Spacebar = play/pause.
  useEffect(() => {
    if (!playing || !scene) return;
    try { if (scene.narration && window.speechSynthesis) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(scene.narration); u.lang = project?.language === 'en' ? 'en-US' : 'nb-NO'; window.speechSynthesis.speak(u); } } catch { /* */ }
    const atEnd = idx >= scenes.length - 1;
    const t = setTimeout(() => {
      if (atEnd) { setPlaying(false); }
      else selectScene(scenes[idx + 1].id);
    }, Math.max(1800, (scene.duration || 4) * 1000));
    return () => clearTimeout(t);
  }, [playing, idx, scene, scenes, selectScene, project?.language]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== 'Space' || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))) return;
      e.preventDefault();
      setPlaying((p) => { if (!p && idx >= scenes.length - 1 && scenes[0]) selectScene(scenes[0].id); return !p; });
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); try { window.speechSynthesis?.cancel(); } catch { /* */ } };
  }, [idx, scenes, selectScene]);
  if (!project) return null;
  if (!scene) return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: C.inkSoft }}>Ingen scener ennå.</div>;
  const device = override ?? scene.device;
  const variant: FrameVariant = device === 'ipad' && scene.orientation === 'landscape' ? 'ipad_landscape' : device;
  const render = project.render ?? defaultRenderOptions();
  const go = (d: number) => { const n = Math.max(0, Math.min(scenes.length - 1, idx + d)); selectScene(scenes[n].id); };
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ display: 'flex', gap: 4, alignSelf: 'center', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, margin: '16px auto 0' }}>
        {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => (
          <div key={d} onClick={() => setOverride(d === scene.device ? null : d)} title={DEVICE_LABEL[d]}
            style={{ minWidth: 46, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '0 8px', background: device === d ? C.creamActive : 'transparent', color: device === d ? C.ink : C.inkFaint }}>{DEVICE_LABEL[d]}</div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 24px', display: 'grid', placeItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: variant === 'macbook' ? 820 : variant === 'ipad_landscape' ? 720 : variant === 'ipad' ? 460 : 300, margin: '0 auto' }}>
          <FramedDevice variant={variant} url={project.url} width="100%"
            screenshot={pickShot(project.scanShots, (scene.startScrollPct ?? 0) / 100) ?? undefined}
            overlay={<SceneInteractionOverlay hotspot={scene.hotspot} render={render} device={device} />} />
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, background: '#fff', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button style={{ ...outlineBtn, opacity: idx === 0 ? 0.5 : 1 }} disabled={idx === 0} onClick={() => go(-1)}>‹ Forrige</button>
        <button style={{ ...btn, background: playing ? C.accent : '#fff', color: playing ? '#fff' : C.ink, borderColor: playing ? C.accent : C.lineStrong }}
          title="Spill gjennom hele demoen (mellomrom)" onClick={() => { if (!playing && idx >= scenes.length - 1 && scenes[0]) selectScene(scenes[0].id); setPlaying((p) => !p); }}>
          {playing ? '❚❚ Pause' : '▶ Spill av alt'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Scene {idx + 1}/{scenes.length} — {scene.title} <span style={{ fontWeight: 400, color: C.inkFaint, fontSize: 11 }}>· mellomrom = spill av</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.narration || scene.requiredAction || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>{scenes.map((s, i) => <span key={s.id} onClick={() => selectScene(s.id)} style={{ width: i === idx ? 16 : 7, height: 7, borderRadius: 4, background: i === idx ? C.accent : '#d8d2c8', cursor: 'pointer' }} />)}</div>
        <button style={{ ...outlineBtn, opacity: idx >= scenes.length - 1 ? 0.5 : 1 }} disabled={idx >= scenes.length - 1} onClick={() => go(1)}>Neste ›</button>
      </div>
    </div>
  );
}

/** Av/på-bryter for visnings-toggles (Show Cursor, Touch Points, …). */
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} role="switch" aria-checked={on}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', cursor: 'pointer', fontSize: 12.5, color: C.ink }}>
      <span>{label}</span>
      <span style={{ width: 34, height: 20, borderRadius: 10, background: on ? C.green : C.lineStrong, position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
      </span>
    </div>
  );
}

/** Responsive Check-rapport: status per viewport + «Godta forslag» som anvender fiksen. */
function ResponsiveCheckModal({ report, onClose, onApply }: {
  report: ResponsiveReport;
  onClose: () => void;
  onApply: (fix: ResponsiveFix) => void;
}) {
  const [applied, setApplied] = useState<Set<number>>(new Set());
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.32)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: C.panel, borderRadius: 14, padding: 22, fontFamily: C.font, color: C.ink, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Responsive Check</h3>
          <div style={{ flex: 1 }} />
          <div onClick={onClose} style={{ ...iconBtn, cursor: 'pointer' }}>✕</div>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Siden vurdert i desktop, tablet og mobil.</p>
        {report.results.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{r.device === 'macbook' ? 'Desktop' : r.device === 'ipad' ? 'Tablet' : 'Mobile'}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 7, color: '#fff', background: RESPONSIVE_STATUS_COLORS[r.status] }}>
                {RESPONSIVE_STATUS_LABELS[r.status]}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: C.ink, marginTop: 7 }}>{r.message}</div>
            {r.recommendation && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{r.recommendation}</div>}
            {r.fix && (
              <button style={{ ...primaryBtn, fontSize: 12, padding: '7px 12px', marginTop: 10, opacity: applied.has(i) ? 0.55 : 1 }}
                disabled={applied.has(i)}
                onClick={() => { onApply(r.fix!); setApplied((s) => new Set(s).add(i)); }}>
                {applied.has(i) ? '✓ Justert' : `Godta forslag — ${r.fix.summary}`}
              </button>
            )}
          </div>
        ))}
        <button style={{ ...outlineBtn, width: '100%', marginTop: 4 }} onClick={onClose}>Lukk</button>
      </div>
    </div>
  );
}

function Stat({ h, v, s, link }: { h: string; v: string; s?: string; link?: string }) {
  return (
    <div style={{ background: C.panel, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginBottom: 7 }}>{h}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{s}</div>}
      {link && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>{link}</div>}
    </div>
  );
}

const topbarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, height: 60, padding: '0 18px', background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 };
const iconBtn: React.CSSProperties = { width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 8, color: C.inkSoft, cursor: 'pointer' };
const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const primaryBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #ef8a5d, #d96a3a)', border: 0, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#fff', border: `1px solid ${C.lineStrong}`, color: C.ink, fontSize: 13, padding: '9px 14px', borderRadius: 8, cursor: 'pointer' };
const fldLabel: React.CSSProperties = { fontSize: 11, color: C.inkSoft, margin: '14px 0 6px', fontWeight: 600 };
const field: React.CSSProperties = { width: '100%', border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: C.ink, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };
const titleField: React.CSSProperties = { background: 'transparent', border: 0, color: C.ink, fontSize: 15, fontWeight: 700, padding: 0, outline: 'none', minWidth: 140 };
const sel: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#fff', padding: '2px 8px', borderRadius: 10, display: 'inline-block' };

/**
 * Resolve-fri voiceover-forhåndsvisning (Web Speech). Les opp scenens manus i
 * nettleseren — velg kjønn — uten DaVinci Resolve. For eksportert lydfil brukes
 * Resolve-provideren når den er tilgjengelig.
 */
function WebSpeechBar({ scene, language }: { scene: DemoScene; language: string }) {
  const [voices, setVoices] = useState<WebVoice[]>([]);
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { void getWebVoices().then(setVoices); return () => cancelSpeech(); }, []);
  if (!isWebSpeechSupported()) return null;
  const lang = language === 'en' ? 'en' : 'nb';
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  const hasNarration = !!scene.narration?.trim();
  const play = () => {
    if (!hasNarration) return;
    setSpeaking(true);
    speak(scene.narration, { gender, lang, onEnd: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const stop = () => { cancelSpeech(); setSpeaking(false); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      <button onClick={speaking ? stop : play} disabled={!hasNarration}
        title="Les opp manus i nettleseren (uten Resolve)"
        style={{ ...btn, padding: '5px 11px', fontSize: 12, opacity: hasNarration ? 1 : 0.5 }}>
        {speaking ? '■ Stopp' : '▶ Les opp'}
      </button>
      <div style={{ display: 'inline-flex', gap: 2, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: 2 }}>
        {(['female', 'male'] as const).map((g) => (
          <button key={g} onClick={() => setGender(g)}
            style={{ ...btn, border: 'none', padding: '4px 9px', fontSize: 11.5, background: gender === g ? C.accent : 'transparent', color: gender === g ? '#fff' : C.ink }}>
            {g === 'female' ? 'Kvinne' : 'Mann'}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 10.5, color: C.inkFaint }}>Resolve-fri · {langVoices.length || voices.length} stemmer</span>
    </div>
  );
}

export default DemoStudioShell;
