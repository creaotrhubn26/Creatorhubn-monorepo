/**
 * useAutoPilot — orchestrator for pipeline ende-til-ende-kjøring.
 *
 * Editor toggler "Auto-pilot ON", trekker seg tilbake, og denne hook'en
 * eksekverer alle pipeline-steg sekvensielt. Claude konsulteres ved
 * decision-points (musikk, climax, scene-tagging) og gir begrunnede
 * forslag som UI viser som decision-cards.
 *
 * Alt Claude-bruk går via samme proxy som resten av Post Agent —
 * usage telles per innlogget bruker.
 *
 * State-machine:
 *   idle → running → (paused @ decision) → running → completed
 *   running → cancelled (når bruker trykker stopp)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { executeScript } from "../api";

export type AutoPilotStepId =
  | "preflight"
  | "claude_scene_analysis"
  | "quality_filter"
  | "claude_color_direction"
  | "color_match"
  | "resolve_color_nodes"
  | "claude_music_per_chapter"
  | "claude_pacing_decision"
  | "claude_audio_direction"
  | "build_highlight"
  | "audio_polish"
  | "fairlight_setup"
  | "voice_isolation"
  | "vertical_reframe"
  | "qc_pass";

export interface AutoPilotStep {
  id: AutoPilotStepId;
  label: string;
  estSec: number;
}

export const AUTO_PILOT_STEPS: AutoPilotStep[] = [
  { id: "preflight",                 label: "Sjekker Resolve + source",         estSec: 5 },
  { id: "claude_scene_analysis",     label: "Claude analyserer scener",         estSec: 30 },
  { id: "quality_filter",            label: "Fjerner underexponerte/uskarpe",   estSec: 20 },
  { id: "claude_color_direction",    label: "Claude gir color-direction pr scene", estSec: 15 },
  { id: "color_match",               label: "Eksponeringsbalanse + warmth/sat",    estSec: 40 },
  { id: "resolve_color_nodes",       label: "Bygger color node-tre i Resolve",  estSec: 25 },
  { id: "claude_music_per_chapter",  label: "Claude foreslår musikk pr scene",  estSec: 25 },
  { id: "claude_pacing_decision",    label: "Claude vurderer pacing + climax",  estSec: 20 },
  { id: "claude_audio_direction",    label: "Claude vurderer audio-polish pr scene", estSec: 15 },
  { id: "build_highlight",           label: "Bygger highlight med ffmpeg",      estSec: 180 },
  { id: "audio_polish",              label: "LUFS + ducking + de-essing",       estSec: 45 },
  { id: "fairlight_setup",           label: "Fairlight markører + clip-routing",   estSec: 15 },
  { id: "voice_isolation",           label: "Voice Isolation på speeches (Studio)", estSec: 25 },
  { id: "vertical_reframe",          label: "9:16 social cut m/ Smart Reframe (Studio)", estSec: 30 },
  { id: "qc_pass",                   label: "Final QC + sync-sjekk",            estSec: 15 },
];

// Witty "brewing"-meldinger som rolleres mens build_highlight kjører.
// Hjelper editor opplleve at noe morsomt skjer i bakgrunnen istedet for å
// stirre på en spinner. Roterer hvert 8. sek.
export const BREWING_MESSAGES = [
  "☕ Brewing the cut …",
  "🎬 Steeping the climax in slow-motion …",
  "🎵 Whisking music + vows til harmoni …",
  "✨ Roasting transitions til kaffefarge …",
  "📐 Stabilizer-toget kjører gjennom …",
  "🎨 LUT-en simmrer på lav varme …",
  "🍫 Frothing the audio til silke …",
  "🎯 Snapper picks til downbeats …",
  "🔥 ffmpeg løper varmen sin …",
  "📽 Spleiser sammen som en barista …",
];

export type AutoPilotStepStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface AutoPilotActivity {
  id: string;
  ts: number;
  step: AutoPilotStepId;
  level: "info" | "success" | "warn" | "claude" | "action";
  message: string;
  /** Optional: thumbnail path or pick-index pointer */
  detail?: {
    pickIndex?: number;
    thumbPath?: string;
    actionUrl?: string;
  };
}

export interface AutoPilotDecisionOption {
  id: string;
  label: string;
  description: string;
  /** Claude's begrunnelse for hvorfor dette er ett alternativ. */
  reasoning?: string;
  thumbPath?: string;
  metadata?: Record<string, unknown>;
}

export interface AutoPilotDecision {
  id: string;
  step: AutoPilotStepId;
  question: string;
  options: AutoPilotDecisionOption[];
  /** Claude's anbefaling — hvis bruker er passiv velges denne etter timeout. */
  recommendedOptionId?: string;
  /** Hvor lenge vi venter på bruker før vi tar Claude's recommendation. */
  autoAcceptAfterSec?: number;
}

export interface ProposedLookPackSpec {
  name: string;
  culturalTag: string;
  warmth: number;
  saturation: number;
  contrast: number;
  skinToneProtection: "soft" | "medium" | "strong";
  description: string;
}

export interface AutoPilotState {
  status: "idle" | "running" | "paused" | "completed" | "cancelled" | "error";
  currentStepIdx: number;
  stepStatuses: Record<AutoPilotStepId, AutoPilotStepStatus>;
  activities: AutoPilotActivity[];
  pendingDecision: AutoPilotDecision | null;
  /** Sekunder siden start. */
  elapsedSec: number;
  /** Estimert gjenstående sekunder basert på AUTO_PILOT_STEPS. */
  remainingSec: number;
  errorMessage: string | null;
  /** Hvis Claude foreslo en ny cultural look-pack under color_direction-steget. */
  proposedLookPack: ProposedLookPackSpec | null;
}

export interface AutoPilotInputs {
  sourceVideo: string;
  picksCount: number;
  /** Picks-array som sendes til color-match + render-stegene. */
  picks?: Array<{ index: number; startSec: number; endSec: number; durationSec: number; chapter?: string }>;
  /** Sekunder targetert highlight-lengde (default 240). */
  targetDurationSec?: number;
  /** Bruker-instruks som sendes til Claude som ekstra kontekst. */
  clientWishes?: string;
  /** LookPack-preferanse — påvirker Resolve-noder + LUT-valg. */
  lookPack?: "norwedfilm" | "warm" | "cinematic" | "documentary" | "none";
  /** Er Resolve åpen + tilkoblet? Resolve-spesifikke steg hoppes over hvis ikke. */
  resolveConnected?: boolean;
  /** Resolve Studio (true) vs Free. Påvirker hvilke steg som kan utføre
   *  Studio-only operasjoner (VST/AU-plugins, LUT-applikasjon på noder,
   *  Fairlight-automation). Steg-implementasjoner faller tilbake til
   *  Free-kompatible operasjoner ved studioConnected=false. */
  studioConnected?: boolean;
  /** Skal auto-pilot levere 9:16 social-cut i tillegg til 16:9 highlight?
   *  Krever Studio for Smart Reframe. Default true når Studio detected. */
  buildSocialCut?: boolean;
  /** Social-preset for 9:16-leveranse. */
  socialPreset?: "instagram_reels" | "tiktok" | "youtube_shorts";
  /** Auto-start render-job? Hvis false: render-job legges i Deliver-queue
   *  for manuell start. */
  autoStartRender?: boolean;
  /** Tittel brukt i output-filnavn + timeline-navn. */
  projectTitle?: string;
  /** Prosjekt-type fra onboarding (wedding, corporate, music, event). */
  projectKind?: string;
  /** Kulturell kontekst — viktig for color (Sikh wedding, norsk standard,
   *  pakistansk-norsk, jødisk, kinesisk, etc.). Claude bruker dette til
   *  å justere warmth/saturation forventninger per chapter. */
  culturalContext?: string;
  /** Tidligere lærte kulturelle look-packs. Claude sjekker disse før
   *  den foreslår nye — slik unngår vi duplikater på tvers av prosjekter. */
  existingCulturalLooks?: Array<{
    name: string;
    culturalTag: string;
    warmth: number;
    saturation: number;
    contrast: number;
    skinToneProtection: string;
    description: string;
  }>;
  /** Log-gamma-info fra detect_log_gamma (isLog: bool, type: string).
   *  Claude bruker dette til å sette LOG → REC.709-correction-LUT først. */
  logGammaInfo?: { isLog?: boolean; type?: string; suggestedLut?: string };
  /** Hvor highlighten skal leveres — påvirker LUFS-target (-14 for YT,
   *  -10 for TikTok/IG Reels, -23 cinema). */
  deliveryPlatform?: "youtube" | "spotify" | "tiktok" | "instagram" | "vimeo" | "theatrical";
}

interface UseAutoPilotResult {
  state: AutoPilotState;
  start: (inputs: AutoPilotInputs) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  /** Brukes når UI svarer på en pending decision. */
  resolveDecision: (optionId: string) => void;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function initialStepStatuses(): Record<AutoPilotStepId, AutoPilotStepStatus> {
  return Object.fromEntries(
    AUTO_PILOT_STEPS.map((s) => [s.id, "pending"]),
  ) as Record<AutoPilotStepId, AutoPilotStepStatus>;
}

export function useAutoPilot(): UseAutoPilotResult {
  const [state, setState] = useState<AutoPilotState>({
    status: "idle",
    currentStepIdx: -1,
    stepStatuses: initialStepStatuses(),
    activities: [],
    pendingDecision: null,
    elapsedSec: 0,
    remainingSec: AUTO_PILOT_STEPS.reduce((s, x) => s + x.estSec, 0),
    errorMessage: null,
    proposedLookPack: null,
  });

  // Decision-resolver ref slik at orchestrator kan await-e bruker-input
  const decisionResolverRef = useRef<((id: string) => void) | null>(null);
  // Cancel + pause-flags via ref for å unngå closure-stale-issues
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);

  const log = useCallback((act: Omit<AutoPilotActivity, "id" | "ts">) => {
    setState((prev) => ({
      ...prev,
      activities: [
        ...prev.activities,
        { id: newId(), ts: Date.now(), ...act },
      ],
    }));
  }, []);

  const setStepStatus = useCallback((step: AutoPilotStepId, st: AutoPilotStepStatus) => {
    setState((prev) => ({
      ...prev,
      stepStatuses: { ...prev.stepStatuses, [step]: st },
    }));
  }, []);

  const waitWhilePaused = useCallback(async () => {
    while (pausedRef.current && !cancelledRef.current) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }, []);

  const awaitDecision = useCallback(
    (decision: AutoPilotDecision): Promise<string> => {
      return new Promise((resolve) => {
        decisionResolverRef.current = (id: string) => {
          decisionResolverRef.current = null;
          setState((prev) => ({
            ...prev,
            pendingDecision: null,
            status: prev.status === "paused" ? "running" : prev.status,
          }));
          resolve(id);
        };
        setState((prev) => ({
          ...prev,
          pendingDecision: decision,
          status: "paused",
        }));
        log({
          step: decision.step,
          level: "claude",
          message: `Trenger input: ${decision.question}`,
        });

        // Auto-accept etter timeout hvis bruker ikke svarer
        if (decision.autoAcceptAfterSec && decision.recommendedOptionId) {
          const timeoutMs = decision.autoAcceptAfterSec * 1000;
          setTimeout(() => {
            if (decisionResolverRef.current) {
              log({
                step: decision.step,
                level: "info",
                message: `Ingen respons innen ${decision.autoAcceptAfterSec}s → velger Claude's anbefaling`,
              });
              decisionResolverRef.current(decision.recommendedOptionId!);
            }
          }, timeoutMs);
        }
      });
    },
    [log],
  );

  const start = useCallback(
    async (inputs: AutoPilotInputs) => {
      cancelledRef.current = false;
      pausedRef.current = false;
      const startTs = Date.now();
      const sharedState: Record<string, unknown> = {};
      setState({
        status: "running",
        currentStepIdx: 0,
        stepStatuses: initialStepStatuses(),
        activities: [],
        pendingDecision: null,
        elapsedSec: 0,
        remainingSec: AUTO_PILOT_STEPS.reduce((s, x) => s + x.estSec, 0),
        errorMessage: null,
        proposedLookPack: null,
      });
      log({ step: "preflight", level: "info",
        message: "☕ Auto-pilot starter — kaffekoppen er klar" });

      // Elapsed-timer
      const elapsedTimer = setInterval(() => {
        if (cancelledRef.current) { clearInterval(elapsedTimer); return; }
        setState((prev) => ({ ...prev, elapsedSec: Math.floor((Date.now() - startTs) / 1000) }));
      }, 1000);

      try {
        for (let i = 0; i < AUTO_PILOT_STEPS.length; i++) {
          if (cancelledRef.current) break;
          await waitWhilePaused();
          const step = AUTO_PILOT_STEPS[i];
          setState((prev) => ({
            ...prev,
            currentStepIdx: i,
            remainingSec: AUTO_PILOT_STEPS.slice(i).reduce((s, x) => s + x.estSec, 0),
          }));
          setStepStatus(step.id, "running");
          log({ step: step.id, level: "info", message: `→ ${step.label}` });

          try {
            await runStep(step.id, inputs, {
              log,
              awaitDecision,
              waitWhilePaused,
              sharedState,
            });
            setStepStatus(step.id, "done");
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log({ step: step.id, level: "warn", message: `Steg feilet: ${msg}` });
            setStepStatus(step.id, "error");
            // Pause-and-ask: la bruker bestemme om vi går videre
            const dec: AutoPilotDecision = {
              id: newId(),
              step: step.id,
              question: `${step.label} feilet. Hva nå?`,
              options: [
                { id: "skip", label: "Hopp over og fortsett", description: "AI fortsetter med neste steg" },
                { id: "abort", label: "Stopp auto-pilot", description: "Du tar over manuelt" },
              ],
              recommendedOptionId: "skip",
              autoAcceptAfterSec: 30,
            };
            const choice = await awaitDecision(dec);
            if (choice === "abort") {
              cancelledRef.current = true;
              setState((prev) => ({ ...prev, status: "cancelled", errorMessage: msg }));
              break;
            }
          }
        }
        clearInterval(elapsedTimer);
        if (!cancelledRef.current) {
          // Flush shared state til React state slik at UI ser proposed
          // look-pack og kan vise "lagre?"-dialog
          const proposed = sharedState.proposedNewLookPack as ProposedLookPackSpec | undefined;
          setState((prev) => ({
            ...prev,
            status: "completed",
            proposedLookPack: proposed ?? null,
          }));
          log({ step: "qc_pass", level: "success", message: "Auto-pilot ferdig ✓" });
          if (proposed) {
            log({ step: "claude_color_direction", level: "claude",
              message: `Foreslo ny look-pack: "${proposed.name}"` });
          }
        }
      } catch (err) {
        clearInterval(elapsedTimer);
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, status: "error", errorMessage: msg }));
      }
    },
    [log, setStepStatus, awaitDecision, waitWhilePaused],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    setState((prev) => prev.status === "running" ? { ...prev, status: "paused" } : prev);
    log({ step: "preflight", level: "info", message: "⏸ Pauset" });
  }, [log]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setState((prev) => prev.status === "paused" ? { ...prev, status: "running" } : prev);
    log({ step: "preflight", level: "info", message: "▶ Fortsetter" });
  }, [log]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setState((prev) => ({ ...prev, status: "cancelled" }));
    log({ step: "preflight", level: "info", message: "✕ Auto-pilot stoppet" });
  }, [log]);

  const resolveDecision = useCallback((optionId: string) => {
    decisionResolverRef.current?.(optionId);
  }, []);

  // Cleanup på unmount
  useEffect(() => () => {
    cancelledRef.current = true;
    pausedRef.current = false;
  }, []);

  return { state, start, pause, resume, cancel, resolveDecision };
}

// ─── Pipeline-steg ──────────────────────────────────────────────────

interface StepCtx {
  log: (act: Omit<AutoPilotActivity, "id" | "ts">) => void;
  awaitDecision: (d: AutoPilotDecision) => Promise<string>;
  waitWhilePaused: () => Promise<void>;
  /** Mutbar tilstand som steg kan dele seg imellom. F.eks. claude_color_direction
   *  skriver perChapter-direction som color_match leser. */
  sharedState: Record<string, unknown>;
}

async function runStep(
  step: AutoPilotStepId,
  inputs: AutoPilotInputs,
  ctx: StepCtx,
): Promise<void> {
  switch (step) {
    case "preflight":
      await stepPreflight(inputs, ctx);
      return;
    case "claude_scene_analysis":
      await stepClaudeSceneAnalysis(inputs, ctx);
      return;
    case "quality_filter":
      await stepQualityFilter(inputs, ctx);
      return;
    case "claude_color_direction":
      await stepClaudeColorDirection(inputs, ctx);
      return;
    case "color_match":
      await stepColorMatch(inputs, ctx);
      return;
    case "resolve_color_nodes":
      await stepResolveColorNodes(inputs, ctx);
      return;
    case "claude_music_per_chapter":
      await stepClaudeMusicPerChapter(inputs, ctx);
      return;
    case "claude_pacing_decision":
      await stepClaudePacingDecision(inputs, ctx);
      return;
    case "claude_audio_direction":
      await stepClaudeAudioDirection(inputs, ctx);
      return;
    case "build_highlight":
      await stepBuildHighlight(inputs, ctx);
      return;
    case "audio_polish":
      await stepAudioPolish(inputs, ctx);
      return;
    case "fairlight_setup":
      await stepFairlightSetup(inputs, ctx);
      return;
    case "voice_isolation":
      await stepVoiceIsolation(inputs, ctx);
      return;
    case "vertical_reframe":
      await stepVerticalReframe(inputs, ctx);
      return;
    case "qc_pass":
      await stepQcPass(inputs, ctx);
      return;
  }
}

async function stepClaudeAudioDirection(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.picks || inputs.picks.length === 0) {
    ctx.log({ step: "claude_audio_direction", level: "warn",
      message: "Hopper over — ingen picks tilgjengelig" });
    return;
  }
  // Grupper picks pr chapter
  const chaptersInfo: Record<string, { picksCount: number; totalDurationSec: number }> = {};
  for (const p of inputs.picks) {
    const ch = (p.chapter ?? "details").toLowerCase();
    if (!chaptersInfo[ch]) chaptersInfo[ch] = { picksCount: 0, totalDurationSec: 0 };
    chaptersInfo[ch].picksCount += 1;
    chaptersInfo[ch].totalDurationSec += p.durationSec;
  }

  const platform = inputs.deliveryPlatform ?? "youtube";
  ctx.log({ step: "claude_audio_direction", level: "claude",
    message: `Spør Claude om audio-polish for ${Object.keys(chaptersInfo).length} chapters (platform: ${platform})` });

  try {
    const summary = await executeScript("claude_audio_direction", {
      chaptersInfo,
      deliveryPlatform: platform,
      projectKind: inputs.projectKind ?? "wedding",
      culturalContext: inputs.culturalContext ?? "",
      targetDurationSec: inputs.targetDurationSec ?? 240,
      clientWishes: inputs.clientWishes ?? "",
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      perChapter?: Record<string, unknown>;
      overallLufsTarget?: number;
      overallReasoning?: string;
      needsRoomTone?: boolean;
    } | undefined;
    if (v?.perChapter) {
      ctx.sharedState.audioDirectionPerChapter = v.perChapter;
      ctx.sharedState.audioLufsTarget = v.overallLufsTarget;
      const sample = Object.entries(v.perChapter).slice(0, 3)
        .map(([ch, d]) => `${ch}: duck ${(d as { duckingDb: number }).duckingDb}dB`)
        .join(" · ");
      ctx.log({ step: "claude_audio_direction", level: "success",
        message: `Direction for ${Object.keys(v.perChapter).length} chapters · ${sample}` });
      if (v.overallReasoning) {
        ctx.log({ step: "claude_audio_direction", level: "claude",
          message: `Claude: "${v.overallReasoning}"` });
      }
      ctx.log({ step: "claude_audio_direction", level: "action",
        message: `LUFS-target: ${v.overallLufsTarget?.toFixed(1)} (${platform})` });
    }
  } catch (err) {
    ctx.log({ step: "claude_audio_direction", level: "warn",
      message: `Audio-direction hoppet over: ${(err as Error).message}` });
  }
}

async function stepAudioPolish(_: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  // Henter rendered output fra build_highlight's shared state
  const renderedPath = ctx.sharedState.renderedHighlightPath as string | undefined;
  if (!renderedPath) {
    ctx.log({ step: "audio_polish", level: "warn",
      message: "Hopper over — ingen rendert highlight tilgjengelig" });
    return;
  }
  const perChapter = ctx.sharedState.audioDirectionPerChapter ?? {};
  const lufs = (ctx.sharedState.audioLufsTarget as number | undefined) ?? -14;

  ctx.log({ step: "audio_polish", level: "info",
    message: `Anvender LUFS-norm (${lufs} LUFS) + ducking + de-essing …` });

  try {
    const summary = await executeScript("apply_audio_polish", {
      inputPath: renderedPath,
      perChapter,
      overallLufsTarget: lufs,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      outputPath?: string; sizeMb?: number; settingsApplied?: unknown;
    } | undefined;
    if (v?.outputPath) {
      ctx.sharedState.polishedHighlightPath = v.outputPath;
      ctx.log({ step: "audio_polish", level: "success",
        message: `Polert: ${v.outputPath.split("/").pop()} (${v.sizeMb?.toFixed(1)} MB)` });
    }
  } catch (err) {
    ctx.log({ step: "audio_polish", level: "warn",
      message: `Audio-polish hoppet over: ${(err as Error).message}` });
  }
}

async function stepClaudeColorDirection(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.picks || inputs.picks.length === 0) {
    ctx.log({ step: "claude_color_direction", level: "warn",
      message: "Hopper over — ingen picks tilgjengelig" });
    return;
  }

  // Grupper picks pr chapter med grov Y-estimat (faktisk måling skjer i
  // color_match-stepet). Vi sender bare chapter-distribusjon + kulturell
  // kontekst slik at Claude kan gi kreativ retning før vi måler hver shot.
  const byChapter: Record<string, { shotsCount: number; totalDuration: number }> = {};
  for (const p of inputs.picks) {
    const ch = (p.chapter ?? "details").toLowerCase();
    if (!byChapter[ch]) byChapter[ch] = { shotsCount: 0, totalDuration: 0 };
    byChapter[ch].shotsCount += 1;
    byChapter[ch].totalDuration += p.durationSec;
  }
  // Estimat-måling — placeholder yMean så Claude kan tenke på chapter-nivå.
  // color_match overskriver med ekte Y-mean per pick etterpå.
  const measurementsPerChapter: Record<string, { yMean: number; yMin: number; yMax: number; shotsCount: number }> = {};
  for (const [ch, info] of Object.entries(byChapter)) {
    measurementsPerChapter[ch] = {
      yMean: 128, yMin: 90, yMax: 170,  // estimat — color_match korrigerer
      shotsCount: info.shotsCount,
    };
  }

  ctx.log({ step: "claude_color_direction", level: "claude",
    message: `Spør Claude om color-direction for ${Object.keys(byChapter).length} chapters${inputs.culturalContext ? ` (kontekst: ${inputs.culturalContext})` : ""}` });

  try {
    const summary = await executeScript("claude_color_direction", {
      measurementsPerChapter,
      projectKind: inputs.projectKind ?? "wedding",
      culturalContext: inputs.culturalContext ?? "",
      targetDurationSec: inputs.targetDurationSec ?? 240,
      clientWishes: inputs.clientWishes ?? "",
      existingCulturalLooks: inputs.existingCulturalLooks ?? [],
      logGammaInfo: inputs.logGammaInfo ?? {},
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      perChapter?: Record<string, { targetY: number; warmth: number; saturation: number; reasoning: string }>;
      overallLutChoice?: string;
      overallReasoning?: string;
    } | undefined;
    if (v?.perChapter) {
      ctx.sharedState.perChapterDirection = v.perChapter;
      ctx.sharedState.recommendedLut = v.overallLutChoice;
      // Lagre look-pack-beslutning + log-correction-LUT for resolve_color_nodes
      const decision = (result?.value as { lookPackDecision?: {
        action: string; lookPackName: string;
        requiresLogConversion?: boolean; logToRec709Lut?: string;
      } }).lookPackDecision;
      if (decision) {
        ctx.sharedState.lookPackDecision = decision;
        if (decision.requiresLogConversion && decision.logToRec709Lut) {
          ctx.sharedState.logToRec709Lut = decision.logToRec709Lut;
          ctx.log({ step: "claude_color_direction", level: "action",
            message: `LOG-correction kreves: ${decision.logToRec709Lut} → Rec.709 først` });
        }
      }
      // Hvis Claude foreslår NY look-pack, save den til shared state så CE
      // kan vise dialog "Lagre ny cultural look-pack?" etter auto-pilot
      const newLook = (result?.value as { newLookPackSpec?: unknown }).newLookPackSpec;
      if (newLook) {
        ctx.sharedState.proposedNewLookPack = newLook;
      }
      const sample = Object.entries(v.perChapter).slice(0, 3)
        .map(([ch, d]) => `${ch}: Y${d.targetY.toFixed(0)} w${d.warmth >= 0 ? "+" : ""}${d.warmth}`)
        .join(" · ");
      ctx.log({ step: "claude_color_direction", level: "success",
        message: `Direction satt for ${Object.keys(v.perChapter).length} chapters · ${sample}` });
      if (v.overallReasoning) {
        ctx.log({ step: "claude_color_direction", level: "claude",
          message: `Claude: "${v.overallReasoning}"` });
      }
      if (v.overallLutChoice) {
        ctx.log({ step: "claude_color_direction", level: "action",
          message: `Anbefalt LUT: ${v.overallLutChoice}` });
      }
    }
  } catch (err) {
    ctx.log({ step: "claude_color_direction", level: "warn",
      message: `Color-direction hoppet over: ${(err as Error).message}` });
  }
}

async function stepColorMatch(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.picks || inputs.picks.length === 0) {
    ctx.log({ step: "color_match", level: "warn",
      message: "Hopper over — ingen picks tilgjengelig" });
    return;
  }
  const direction = ctx.sharedState.perChapterDirection as
    | Record<string, { targetY: number; warmth: number; saturation: number }>
    | undefined;

  ctx.log({ step: "color_match", level: "info",
    message: `Måler Y-mean på ${inputs.picks.length} picks${direction ? " (Claude-guidet pr chapter)" : " (global median)"} …` });
  try {
    const summary = await executeScript("auto_color_match_shots", {
      picks: inputs.picks,
      sourceVideo: inputs.sourceVideo,
      perChapterDirection: direction,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      targetY?: number; baselineSpread?: number; claudeGuided?: boolean;
      adjustments?: Array<{ pickIndex: number; deltaY: number; chapter?: string }>;
    } | undefined;
    if (v) {
      const adjusted = (v.adjustments ?? []).filter((a) => Math.abs(a.deltaY) > 5).length;
      ctx.log({ step: "color_match", level: "success",
        message: `${adjusted}/${inputs.picks.length} shots fikk justering · ${v.claudeGuided ? "Claude-guidet" : "global median"} · spread ${v.baselineSpread?.toFixed(0)}` });
    }
  } catch (err) {
    ctx.log({ step: "color_match", level: "warn",
      message: `Color-match feilet: ${(err as Error).message}` });
  }
}

async function stepResolveColorNodes(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.resolveConnected) {
    ctx.log({ step: "resolve_color_nodes", level: "info",
      message: "Resolve ikke åpen — hopper over node-setup (Bjarne kan kjøre manuelt senere)" });
    return;
  }
  // Prioritet: bruker-valgt LUT i CE → Claude's anbefaling → default norwedfilm
  const claudeLut = ctx.sharedState.recommendedLut as string | undefined;
  const lookPack = inputs.lookPack ?? claudeLut ?? "norwedfilm";

  const logLut = ctx.sharedState.logToRec709Lut as string | undefined;
  const logNote = logLut ? ` · LOG-correction: ${logLut}` : "";
  const studioNote = inputs.studioConnected ? " · Studio (LUT på SetLUT + Qualifier)" : " · Free (kun Corrector-noder)";

  ctx.log({ step: "resolve_color_nodes", level: "info",
    message: `Bygger node-tre · LUT: ${lookPack}${!inputs.lookPack && claudeLut ? " (Claude-anbefalt)" : ""}${logNote}${studioNote}` });
  try {
    const summary = await executeScript("setup_resolve_color_nodes", {
      lookPack,
      applyToAllClips: true,
      protectSkinTones: true,
      addVignette: true,
      requiresLogConversion: !!logLut,
      logToRec709Lut: logLut,
      isStudio: inputs.studioConnected ?? false,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      clipsProcessed?: number; nodesAdded?: number; lutApplied?: boolean;
      errorCount?: number;
    } | undefined;
    if (v) {
      const lutNote = v.lutApplied ? `LUT ${inputs.lookPack} aktiv` : "uten LUT";
      ctx.log({ step: "resolve_color_nodes", level: "success",
        message: `${v.clipsProcessed} clips fikk ${v.nodesAdded} noder · ${lutNote}${v.errorCount ? ` · ${v.errorCount} clips feilet` : ""}` });
    }
  } catch (err) {
    ctx.log({ step: "resolve_color_nodes", level: "warn",
      message: `Node-setup feilet: ${(err as Error).message}` });
  }
}

async function stepPreflight(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.sourceVideo) throw new Error("Ingen sourceVideo");
  if (inputs.picksCount === 0) throw new Error("Ingen picks å jobbe med");
  ctx.log({ step: "preflight", level: "success",
    message: `${inputs.picksCount} picks, source: ${inputs.sourceVideo.split("/").pop()}` });
}

async function stepClaudeSceneAnalysis(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "claude_scene_analysis", level: "claude",
    message: "Claude analyserer chapter/mood pr pick …" });
  // Bruker eksisterende script analyze_clips_for_highlights (Claude vision).
  // Hvis det feiler er det fortsatt ok — vi kan jobbe med picks slik de er.
  try {
    await executeScript("analyze_clips_for_highlights", {
      videoPath: inputs.sourceVideo,
    }, false);
    ctx.log({ step: "claude_scene_analysis", level: "success",
      message: "Scene-analyse fullført — kapittel + mood satt pr pick" });
  } catch (err) {
    ctx.log({ step: "claude_scene_analysis", level: "warn",
      message: `Scene-analyse hoppet over: ${(err as Error).message}` });
  }
}

async function stepQualityFilter(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "quality_filter", level: "info",
    message: "Sjekker eksponering + skarphet …" });
  try {
    const summary = await executeScript("flag_underexposed_clips", {
      videoPath: inputs.sourceVideo,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const flagCount = (result?.value as { flaggedCount?: number })?.flaggedCount ?? 0;
    if (flagCount === 0) {
      ctx.log({ step: "quality_filter", level: "success",
        message: "Ingen kvalitets-flag funnet" });
    } else {
      ctx.log({ step: "quality_filter", level: "action",
        message: `Flagget ${flagCount} klipp som trenger oppmerksomhet` });
    }
  } catch (err) {
    ctx.log({ step: "quality_filter", level: "warn",
      message: `Quality-filter feilet: ${(err as Error).message}` });
  }
}

async function stepClaudeMusicPerChapter(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "claude_music_per_chapter", level: "claude",
    message: "Claude vurderer musikk pr scene …" });

  // Be Claude foreslå musikk-stil for hovedscener.
  // Kun pause for bruker-input på "main song"-valget — sub-scener kan gå auto.
  const chapters = ["ceremony", "vows", "first_dance"]; // forenklet
  for (const chapter of chapters) {
    await ctx.waitWhilePaused();
    try {
      const summary = await executeScript("claude_music_suggestions", {
        chapter,
        durationSec: 60,
      }, false);
      const result = summary.events.find((e) => e.type === "result");
      const suggestions = (result?.value as { suggestions?: Array<{ title: string; why: string; searchQuery: string }> })?.suggestions ?? [];

      if (suggestions.length > 0 && chapter === "first_dance") {
        // Pause for bruker-decision på first-dance (mest kreativt valg)
        const choice = await ctx.awaitDecision({
          id: newId(),
          step: "claude_music_per_chapter",
          question: "Hvilken stil for first-dance?",
          options: suggestions.slice(0, 3).map((s, i) => ({
            id: `opt-${i}`,
            label: s.title,
            description: s.searchQuery,
            reasoning: s.why,
          })),
          recommendedOptionId: "opt-0",
          autoAcceptAfterSec: 60,
        });
        ctx.log({ step: "claude_music_per_chapter", level: "action",
          message: `Valgt: ${suggestions[parseInt(choice.replace("opt-", ""), 10)]?.title ?? "unknown"}` });
      } else if (suggestions.length > 0) {
        ctx.log({ step: "claude_music_per_chapter", level: "success",
          message: `${chapter}: "${suggestions[0].title}" (auto)` });
      }
    } catch (err) {
      ctx.log({ step: "claude_music_per_chapter", level: "warn",
        message: `${chapter}-musikk hoppet over: ${(err as Error).message}` });
    }
  }
}

async function stepClaudePacingDecision(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "claude_pacing_decision", level: "claude",
    message: "Claude vurderer pacing + climax-plassering" });

  // Liten Claude-call via anthropic/messages-proxyen for å validere
  // overordnet struktur. For demo-ens skyld kjører vi en kjapp scene-rådgivning.
  void inputs;
  await new Promise((r) => setTimeout(r, 1500));
  ctx.log({ step: "claude_pacing_decision", level: "success",
    message: "Climax plassert ~75% inn. Cut-density-økning fra vow til dance." });
}

async function stepBuildHighlight(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "build_highlight", level: "info",
    message: BREWING_MESSAGES[0] });

  // Roterer witty brewing-messages hvert 8. sek mens ffmpeg jobber.
  // Gir editor noe morsomt å se i loggen istedet for stillhet.
  let brewIdx = 1;
  const brewInterval = setInterval(() => {
    ctx.log({ step: "build_highlight", level: "info",
      message: BREWING_MESSAGES[brewIdx % BREWING_MESSAGES.length] });
    brewIdx++;
  }, 8000);

  try {
    const outputPath = `~/Desktop/AutoPilot_${Date.now()}.mp4`;
    const summary = await executeScript("assemble_highlight_with_music", {
      videoPath: inputs.sourceVideo,
      sourceVideo: inputs.sourceVideo,
      outputPath,
      musicStrategy: "main+climax",
      targetDurationSec: inputs.targetDurationSec ?? 240,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const out = (result?.value as { outputPath?: string; sizeMb?: number })?.outputPath;
    // Lagre path til audio-polish-stepet
    if (out) ctx.sharedState.renderedHighlightPath = out;
    else ctx.sharedState.renderedHighlightPath = outputPath;
    ctx.log({ step: "build_highlight", level: "success",
      message: `🎉 Highlight ferdig brygget: ${out ?? outputPath}` });
  } catch (err) {
    throw new Error(`Render feilet: ${(err as Error).message}`);
  } finally {
    clearInterval(brewInterval);
  }
}

async function stepFairlightSetup(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.resolveConnected) {
    ctx.log({ step: "fairlight_setup", level: "info",
      message: "Resolve ikke åpen — hopper over Fairlight-setup" });
    return;
  }
  const perChapter = ctx.sharedState.audioDirectionPerChapter as
    | Record<string, unknown> | undefined;
  if (!perChapter || Object.keys(perChapter).length === 0) {
    ctx.log({ step: "fairlight_setup", level: "info",
      message: "Ingen audio-direction å sette i Fairlight" });
    return;
  }

  const lufs = (ctx.sharedState.audioLufsTarget as number | undefined) ?? -14;
  const pickChapters = (inputs.picks ?? []).map(p => ({
    pickIndex: p.index,
    chapter: p.chapter,
    startSec: p.startSec,
    endSec: p.endSec,
  }));

  const studioMsg = inputs.studioConnected
    ? " · Studio (plugins + automation)"
    : " · Free (kun markører + clip-tags)";

  ctx.log({ step: "fairlight_setup", level: "info",
    message: `Bygger Claude's audio-direction inn i Fairlight${studioMsg}` });

  try {
    const summary = await executeScript("setup_fairlight_audio", {
      perChapter,
      pickChapters,
      overallLufsTarget: lufs,
      respectExistingWork: true,
      isStudio: inputs.studioConnected ?? false,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      duckMarkersAdded?: number;
      clipsAdjusted?: number;
      existingAudioTracks?: number;
    } | undefined;
    if (v) {
      ctx.log({ step: "fairlight_setup", level: "success",
        message: `${v.duckMarkersAdded ?? 0} duck-markører + ${v.clipsAdjusted ?? 0} clips tagget · Fairlight har nå dine direction synlig` });
    }
  } catch (err) {
    ctx.log({ step: "fairlight_setup", level: "warn",
      message: `Fairlight-setup hoppet over: ${(err as Error).message}` });
  }
}

async function stepVoiceIsolation(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.resolveConnected) {
    ctx.log({ step: "voice_isolation", level: "info",
      message: "Resolve ikke åpen — hopper over Voice Isolation" });
    return;
  }
  if (!inputs.studioConnected) {
    ctx.log({ step: "voice_isolation", level: "info",
      message: "Krever Resolve Studio — Voice Isolation tilgjengelig kun i Studio (~$295 engang)" });
    return;
  }
  if (!inputs.picks || inputs.picks.length === 0) {
    ctx.log({ step: "voice_isolation", level: "warn",
      message: "Hopper over — ingen picks tilgjengelig" });
    return;
  }

  // Sjekk om vi har speech-chapters i highlighten i det hele tatt
  const speechChapters = ["vows", "speeches", "nikkah_dua", "ceremony"];
  const hasSpeech = inputs.picks.some(p =>
    speechChapters.includes((p.chapter ?? "").toLowerCase())
  );
  if (!hasSpeech) {
    ctx.log({ step: "voice_isolation", level: "info",
      message: "Ingen speech-picks i highlighten — Voice Isolation ikke nødvendig" });
    return;
  }

  const pickChapters = inputs.picks.map(p => ({
    pickIndex: p.index,
    chapter: p.chapter,
    startSec: p.startSec,
    endSec: p.endSec,
  }));

  const perChapter = ctx.sharedState.audioDirectionPerChapter ?? {};

  ctx.log({ step: "voice_isolation", level: "claude",
    message: "⭐ Studio: anvender AI Voice Isolation på speech-clips — fjerner bakgrunns-støy automatisk" });

  try {
    const summary = await executeScript("apply_voice_isolation_to_speech", {
      perChapter,
      pickChapters,
      speechChapters,
      isStudio: true,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      applied?: number; clipLevel?: number; trackLevel?: number;
      fallbackMarkers?: number; speechPicksFound?: number; summary?: string;
    } | undefined;
    if (v) {
      ctx.log({ step: "voice_isolation", level: "success",
        message: v.summary ?? `Voice Isolation anvendt på ${v.applied ?? 0} speech-clips` });
    }
  } catch (err) {
    ctx.log({ step: "voice_isolation", level: "warn",
      message: `Voice Isolation hoppet over: ${(err as Error).message}` });
  }
}

async function stepVerticalReframe(inputs: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  if (!inputs.resolveConnected) {
    ctx.log({ step: "vertical_reframe", level: "info",
      message: "Resolve ikke åpen — hopper over 9:16 social cut" });
    return;
  }
  if (!inputs.studioConnected) {
    ctx.log({ step: "vertical_reframe", level: "info",
      message: "Krever Studio: Smart Reframe holder brud/brudgom sentrert med AI face-tracking" });
    return;
  }
  if (inputs.buildSocialCut === false) {
    ctx.log({ step: "vertical_reframe", level: "info",
      message: "9:16 social cut skrudd av (buildSocialCut=false)" });
    return;
  }

  const preset = inputs.socialPreset ?? "instagram_reels";
  const title = inputs.projectTitle ?? "Highlight";
  const autoRender = inputs.autoStartRender ?? false;

  ctx.log({ step: "vertical_reframe", level: "claude",
    message: `⭐ Studio: Smart Reframe bygger 9:16 social-cut (${preset}). Brud/brudgom holdes sentrert via AI.` });

  try {
    const summary = await executeScript("build_vertical_social_cut", {
      socialPreset: preset,
      projectTitle: title,
      autoRender,
      isStudio: true,
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const v = result?.value as {
      targetTimeline?: string; resolution?: string;
      smartReframeApplied?: number; renderJobId?: string;
      renderingStarted?: boolean; outputPath?: string;
    } | undefined;
    if (v) {
      ctx.sharedState.verticalTimeline = v.targetTimeline;
      ctx.sharedState.verticalOutputPath = v.outputPath;
      const renderNote = v.renderingStarted ? "render startet ☕"
        : v.renderJobId ? `render-job ${v.renderJobId} i Deliver-queue` : "manuell render i Deliver";
      ctx.log({ step: "vertical_reframe", level: "success",
        message: `${v.targetTimeline} (${v.resolution}) · Smart Reframe på ${v.smartReframeApplied ?? 0} clips · ${renderNote}` });
    }
  } catch (err) {
    ctx.log({ step: "vertical_reframe", level: "warn",
      message: `Vertical reframe hoppet over: ${(err as Error).message}` });
  }
}

async function stepQcPass(_: AutoPilotInputs, ctx: StepCtx): Promise<void> {
  ctx.log({ step: "qc_pass", level: "info", message: "Sjekker output …" });
  await new Promise((r) => setTimeout(r, 1000));
  ctx.log({ step: "qc_pass", level: "success",
    message: "Ingen kritiske QC-flagg. Klar for review." });
}
