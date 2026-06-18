import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent, updateAppSettings } from "../api";
import { loadSettings, settingsToEnvVars } from "./SettingsModal";
import {
  IconCheck,
  IconX,
  IconWarning,
  IconArrowRight,
  IconBox,
  IconSparkle,
} from "./Icons";

const COMPLETED_KEY = "trrpa.firstRunComplete";

interface ToolStatus {
  installed: boolean;
  version?: string | null;
  path?: string | null;
  bundleId?: string;
  isStudio?: boolean;
  isLite?: boolean;
}

interface DepResult {
  tools: Record<string, ToolStatus>;
  summary: Record<string, boolean>;
}

type Stage =
  | "welcome"
  | "checking"
  | "homebrew"
  | "brewTools"
  | "pythonTools"
  | "anthropicKey"
  | "brandVignette"
  | "resolve"
  | "complete";

interface StepState {
  status: "pending" | "running" | "ok" | "failed" | "skipped";
  detail?: string;
}

interface Props {
  onClose: () => void;
}

export function FirstRunSetupWizard({ onClose }: Props) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [check, setCheck] = useState<DepResult | null>(null);
  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [anthropicKey, setAnthropicKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkLabel, setCheckLabel] = useState("");
  const cancelled = useRef(false);

  // Listen for progress events from any script — surface the label in the spinner
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onScriptEvent((event) => {
      if (event.type === "progress" && event.label) {
        setCheckLabel(event.label);
      } else if (event.type === "finished") {
        setCheckLabel("");
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const updateStep = useCallback((key: string, status: StepState["status"], detail?: string) => {
    setSteps((prev) => ({ ...prev, [key]: { status, detail } }));
  }, []);

  const runCheck = useCallback(async (): Promise<DepResult | null> => {
    try {
      // 30s watchdog — if executeScript hangs, surface a usable error instead of stuck spinner
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 30_000),
      );
      const winner = await Promise.race([
        executeScript("check_dependencies", {}, false),
        timeoutPromise,
      ]);
      if (!winner) {
        setError(
          "Sjekken brukte over 30 sekunder. Tauri-prosessen er antakelig henget — restart appen (cmd-Q og åpne på nytt), eller hopp over og bruk Dependencies-modalen senere.",
        );
        return null;
      }
      const r = winner.events.find((e) => e.type === "result")?.value as DepResult | undefined;
      return r ?? null;
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, []);

  const startChecking = useCallback(async () => {
    setStage("checking");
    setError(null);
    const r = await runCheck();
    if (cancelled.current) return;
    if (!r) {
      setError((prev) => prev ?? "Could not check dependencies — see the log panel.");
      return;
    }
    setCheck(r);
    if (!r.tools.brew?.installed) {
      setStage("homebrew");
    } else if (!r.tools.ffmpeg?.installed || !r.tools.fpcalc?.installed) {
      setStage("brewTools");
    } else if (!r.tools.anthropic?.installed || !r.tools.whisperx?.installed) {
      setStage("pythonTools");
    } else {
      setStage("anthropicKey");
    }
  }, [runCheck]);

  // --- Install actions ---
  const runInstall = useCallback(
    async (manager: "brew" | "pip", packages: string[], stepKey: string, advanceTo: Stage) => {
      updateStep(stepKey, "running", `Installing via ${manager}…`);
      setError(null);
      try {
        await executeScript("install_dependency", { manager, packages }, false);
        updateStep(stepKey, "ok", `${packages.join(", ")} installed`);
        // Re-check then advance
        const r = await runCheck();
        if (r) setCheck(r);
        setStage(advanceTo);
      } catch (e) {
        updateStep(stepKey, "failed", String(e));
        setError(String(e));
      }
    },
    [runCheck, updateStep],
  );

  const installBrewTools = useCallback(async () => {
    if (!check) return;
    const missing: string[] = [];
    if (!check.tools.ffmpeg?.installed) missing.push("ffmpeg");
    if (!check.tools.fpcalc?.installed) missing.push("chromaprint");
    if (missing.length === 0) {
      setStage("pythonTools");
      return;
    }
    await runInstall("brew", missing, "brewTools", "pythonTools");
  }, [check, runInstall]);

  const installPythonTools = useCallback(async () => {
    if (!check) return;
    const missing: string[] = [];
    if (!check.tools.anthropic?.installed) missing.push("anthropic");
    if (!check.tools.whisperx?.installed) missing.push("whisperx");
    if (missing.length === 0) {
      setStage("anthropicKey");
      return;
    }
    await runInstall("pip", missing, "pythonTools", "anthropicKey");
  }, [check, runInstall]);

  const saveAnthropicKey = useCallback(async () => {
    if (!anthropicKey.trim()) {
      setStage("brandVignette");
      return;
    }
    const settings = { ...loadSettings(), ANTHROPIC_API_KEY: anthropicKey.trim() };
    try {
      localStorage.setItem("trrpa.settings", JSON.stringify(settings));
      await updateAppSettings(settingsToEnvVars(settings));
      updateStep("anthropicKey", "ok", "API key saved");
    } catch (e) {
      setError(String(e));
    }
    setStage("brandVignette");
  }, [anthropicKey, updateStep]);

  // Persist a brand asset path into settings localStorage (key not in Settings
  // interface — round-trips via loadSettings()'s {...DEFAULT_SETTINGS, ...parsed} spread).
  const saveBrandPath = useCallback(
    async (key: "BRAND_VIGNETTE_PATH" | "BRAND_LOGO_PATH", path: string) => {
      const settings = { ...loadSettings(), [key]: path };
      try {
        localStorage.setItem("trrpa.settings", JSON.stringify(settings));
        await updateAppSettings(settingsToEnvVars(settings));
        updateStep("brandVignette", "ok", `${key === "BRAND_VIGNETTE_PATH" ? "Vignett" : "Logo"} lagret`);
      } catch (e) {
        setError(String(e));
      }
      setStage("resolve");
    },
    [updateStep],
  );

  const pickBrandVignette = useCallback(async () => {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mov", "mp4", "m4v", "prores"] }],
    });
    if (typeof picked !== "string") return; // cancelled -> stay
    await saveBrandPath("BRAND_VIGNETTE_PATH", picked);
  }, [saveBrandPath]);

  const pickBrandLogo = useCallback(async () => {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: "Bilde", extensions: ["png", "jpg", "jpeg", "svg", "webp"] }],
    });
    if (typeof picked !== "string") return; // cancelled -> stay
    await saveBrandPath("BRAND_LOGO_PATH", picked);
  }, [saveBrandPath]);

  const finishWizard = useCallback(() => {
    localStorage.setItem(COMPLETED_KEY, new Date().toISOString());
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  // --- Stage helpers ---
  const stageNumber = (s: Stage): number => {
    switch (s) {
      case "welcome": return 1;
      case "checking": return 2;
      case "homebrew": return 3;
      case "brewTools": return 4;
      case "pythonTools": return 5;
      case "anthropicKey": return 6;
      case "brandVignette": return 7;
      case "resolve": return 8;
      case "complete": return 9;
    }
  };
  const totalStages = 8;
  const currentNumber = Math.min(stageNumber(stage), totalStages);

  return (
    <div className="modal-backdrop">
      <div className="modal first-run-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="first-run-progress">
          {Array.from({ length: totalStages }).map((_, i) => (
            <div
              key={i}
              className={`first-run-progress-dot ${i + 1 < currentNumber ? "done" : i + 1 === currentNumber ? "active" : ""}`}
            />
          ))}
          <span className="first-run-progress-text">
            Steg {currentNumber} av {totalStages}
          </span>
        </div>

        {/* WELCOME */}
        {stage === "welcome" && (
          <>
            <h2>Velkommen til The Role Room Post Agent</h2>
            <div className="desc">
              Et lokalt verktøy som hjelper deg å gå fra minnekort til ferdig timeline i DaVinci Resolve med smartere AI-utvalg.
              <br /><br />
              Først setter vi opp et par verktøy på Mac-en din. Det tar 2–5 minutter og du trenger ikke å gjøre noe selv etter at du klikker "Start".
            </div>
            <div className="first-run-actions">
              <button onClick={() => { localStorage.setItem(COMPLETED_KEY, "skipped"); onClose(); }}>
                Hopp over (avansert bruker)
              </button>
              <button className="primary" onClick={startChecking}>
                Start oppsett <IconArrowRight />
              </button>
            </div>
          </>
        )}

        {/* CHECKING */}
        {stage === "checking" && (
          <>
            <h2>Sjekker hva som finnes på Mac-en…</h2>
            <div className="cull-running" style={{ padding: 24, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="cull-running-spinner" />
                {checkLabel || "Identifiserer Homebrew, ffmpeg, Python-moduler og DaVinci Resolve…"}
              </div>
              <div className="card-chip-meta">
                Tar normalt 1–3 sekunder. Hvis dette står lenger enn 10 sekunder, restart appen.
              </div>
            </div>
            {error && <div className="dialog-warning" style={{ marginTop: 8 }}>{error}</div>}
            <div className="first-run-actions">
              <button onClick={() => { localStorage.setItem(COMPLETED_KEY, "skipped"); onClose(); }}>
                Hopp over wizard
              </button>
              <button onClick={() => setStage("welcome")}>
                Tilbake
              </button>
            </div>
          </>
        )}

        {/* HOMEBREW */}
        {stage === "homebrew" && (
          <>
            <h2>Vi trenger Homebrew</h2>
            <div className="desc">
              Homebrew er Mac-ens app-butikk for utvikler-verktøy. Vi bruker den til å installere de andre tingene vi trenger (ffmpeg, chromaprint).
              <br /><br />
              Installasjon krever at du <strong>limer en kommando inn i Terminal og skriver Mac-passordet ditt</strong> (det er Apple sin sikkerhetsmekanisme — ingen app kan omgå den).
            </div>
            <div className="first-run-codeblock">
              /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            </div>
            <div className="first-run-help">
              <strong>Slik gjør du:</strong>
              <ol>
                <li>Åpne <strong>Terminal</strong> (Spotlight → "Terminal")</li>
                <li>Kopier kommandoen over (klikk for å selektere)</li>
                <li>Lim inn i Terminal og trykk Enter</li>
                <li>Skriv Mac-passordet ditt når den spør</li>
                <li>Vent til den er ferdig (~3-5 min)</li>
                <li>Klikk "Jeg har installert Homebrew" under</li>
              </ol>
            </div>
            <div className="first-run-actions">
              <button onClick={() => { localStorage.setItem(COMPLETED_KEY, "skipped"); onClose(); }}>
                Avbryt
              </button>
              <button className="primary" onClick={startChecking}>
                <IconCheck /> Jeg har installert Homebrew
              </button>
            </div>
          </>
        )}

        {/* BREW TOOLS */}
        {stage === "brewTools" && (
          <>
            <h2>Installerer audio- og video-verktøy</h2>
            <div className="desc">
              Disse trengs for thumbnail-uttrekk, audio-LUFS-måling og retake-deteksjon. Installeres automatisk — du trenger ikke gjøre noe.
            </div>
            <div className="first-run-tool-list">
              <div className="first-run-tool">
                <strong>ffmpeg</strong>
                <span className="card-chip-meta">audio + video processing</span>
              </div>
              <div className="first-run-tool">
                <strong>chromaprint</strong>
                <span className="card-chip-meta">audio fingerprint for retake-deteksjon</span>
              </div>
            </div>
            {steps.brewTools && (
              <div className={`dialog-warning ${steps.brewTools.status === "ok" ? "success" : ""}`} style={{
                borderColor: steps.brewTools.status === "ok" ? "var(--success)" : steps.brewTools.status === "failed" ? "var(--danger)" : "var(--warning)",
                color: steps.brewTools.status === "ok" ? "var(--success)" : "inherit",
              }}>
                {steps.brewTools.status === "running" && <><div className="cull-running-spinner" style={{ display: "inline-block", marginRight: 8 }} />Installerer…</>}
                {steps.brewTools.status === "ok" && <><IconCheck /> {steps.brewTools.detail}</>}
                {steps.brewTools.status === "failed" && <><IconX /> {steps.brewTools.detail}</>}
              </div>
            )}
            <div className="first-run-actions">
              <button onClick={() => setStage("pythonTools")}>Hopp over</button>
              <button
                className="primary"
                onClick={installBrewTools}
                disabled={steps.brewTools?.status === "running"}
              >
                {steps.brewTools?.status === "running" ? "Installerer…" : "Installer (~30 sek)"}
              </button>
            </div>
          </>
        )}

        {/* PYTHON TOOLS */}
        {stage === "pythonTools" && (
          <>
            <h2>Installerer AI-pakker for Python</h2>
            <div className="desc">
              Disse trengs for AI-cull (Claude Vision) og transkripsjon (WhisperX). Installeres med pip — ~2 GB nedlasting, tar 2-3 minutter.
            </div>
            <div className="first-run-tool-list">
              <div className="first-run-tool">
                <strong>anthropic</strong>
                <span className="card-chip-meta">Claude AI for Cull-scoring og scene-tagging</span>
              </div>
              <div className="first-run-tool">
                <strong>whisperx</strong>
                <span className="card-chip-meta">lokal tale-til-tekst for vows, taler, intervjuer</span>
              </div>
            </div>
            {steps.pythonTools && (
              <div className={`dialog-warning`} style={{
                borderColor: steps.pythonTools.status === "ok" ? "var(--success)" : steps.pythonTools.status === "failed" ? "var(--danger)" : "var(--warning)",
                color: steps.pythonTools.status === "ok" ? "var(--success)" : "inherit",
              }}>
                {steps.pythonTools.status === "running" && <><div className="cull-running-spinner" style={{ display: "inline-block", marginRight: 8 }} />Installerer pakker… kan ta noen minutter.</>}
                {steps.pythonTools.status === "ok" && <><IconCheck /> {steps.pythonTools.detail}</>}
                {steps.pythonTools.status === "failed" && <><IconX /> {steps.pythonTools.detail}</>}
              </div>
            )}
            <div className="first-run-actions">
              <button onClick={() => setStage("anthropicKey")}>Hopp over</button>
              <button
                className="primary"
                onClick={installPythonTools}
                disabled={steps.pythonTools?.status === "running"}
              >
                {steps.pythonTools?.status === "running" ? "Installerer…" : "Installer (~2-3 min)"}
              </button>
            </div>
          </>
        )}

        {/* ANTHROPIC KEY */}
        {stage === "anthropicKey" && (
          <>
            <h2>Koble til Claude AI (valgfritt)</h2>
            <div className="desc">
              For AI-cull, scene-deteksjon og highlight-scoring trenger vi en Anthropic API-nøkkel.
              Få en gratis konto på <strong>console.anthropic.com</strong> — du betaler bare per bruk (~$0.30 per 100 klipp).
              <br /><br />
              Du kan hoppe over og legge den til senere i Settings → Admin (5 klikk på versjons-navnet).
            </div>
            <div className="field">
              <label>ANTHROPIC_API_KEY</label>
              <input
                type="password"
                placeholder="sk-ant-…"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
              <div className="settings-help">
                Lagres lokalt på Mac-en din (localStorage). Sendes aldri til andre tjenester.
              </div>
            </div>
            <div className="first-run-actions">
              <button onClick={() => setStage("resolve")}>Hopp over</button>
              <button className="primary" onClick={saveAnthropicKey}>
                Lagre + fortsett <IconArrowRight />
              </button>
            </div>
          </>
        )}

        {/* BRAND VIGNETTE */}
        {stage === "brandVignette" && (
          <>
            <h2>Merkevare-vignett (valgfritt)</h2>
            <div className="desc">
              Har du en intro/outro-vignett (logo-animasjon) du vil at appen skal legge på timelinen automatisk?
            </div>
            {steps.brandVignette && steps.brandVignette.status === "ok" && (
              <div className="dialog-warning" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
                <IconCheck /> {steps.brandVignette.detail}
              </div>
            )}
            <div className="first-run-tool-list">
              <div className="first-run-tool">
                <strong>Ja, velg fil</strong>
                <span className="card-chip-meta">En ferdig vignett-video (.mov/.mp4) brukes som intro/outro</span>
                <button className="primary" style={{ marginTop: 8 }} onClick={pickBrandVignette}>
                  Velg vignett-fil <IconArrowRight />
                </button>
              </div>
              <div className="first-run-tool">
                <strong>Jeg har bare en logo</strong>
                <span className="card-chip-meta">
                  Velg en logo-fil (.png/.svg) — appen kan generere en animert vignett fra logoen din senere.
                </span>
                <button className="primary" style={{ marginTop: 8 }} onClick={pickBrandLogo}>
                  Velg logo-fil <IconArrowRight />
                </button>
              </div>
            </div>
            <div className="first-run-actions">
              <button onClick={() => setStage("resolve")}>Hopp over</button>
            </div>
          </>
        )}

        {/* RESOLVE */}
        {stage === "resolve" && (
          <>
            <h2>DaVinci Resolve Studio</h2>
            <div className="desc">
              For å snakke med Resolve fra appen vår trengs:
              <br /><br />
              1. <strong>DaVinci Resolve Studio</strong> (ikke Lite/Free — Studio kreves for external scripting)
              <br />
              2. <strong>External scripting aktivert</strong> i Resolve Preferences
            </div>
            {check?.tools.resolve && (
              <div className="first-run-tool-list">
                {check.tools.resolve.isStudio && (
                  <div className="first-run-tool" style={{ borderColor: "var(--success)" }}>
                    <strong><IconCheck /> DaVinci Resolve Studio</strong>
                    <span className="card-chip-meta">{check.tools.resolve.version} · klar for scripting</span>
                  </div>
                )}
                {check.tools.resolve.isLite && (
                  <div className="first-run-tool" style={{ borderColor: "var(--warning)" }}>
                    <strong><IconWarning /> DaVinci Resolve Lite (Free)</strong>
                    <span className="card-chip-meta">Studio kreves for at appen skal fungere fullt. Last ned fra blackmagicdesign.com.</span>
                  </div>
                )}
                {!check.tools.resolve.installed && (
                  <div className="first-run-tool" style={{ borderColor: "var(--danger)" }}>
                    <strong><IconX /> DaVinci Resolve ikke funnet</strong>
                    <span className="card-chip-meta">Last ned Studio fra blackmagicdesign.com</span>
                  </div>
                )}
              </div>
            )}
            <div className="first-run-help">
              <strong>Etter at Studio er installert + aktivert:</strong>
              <ol>
                <li>Åpne Resolve Studio</li>
                <li>Preferences → System → General → <strong>External scripting using: Local</strong></li>
                <li>Save → restart Resolve</li>
                <li>Kom tilbake hit og klikk "Sjekk igjen"</li>
              </ol>
            </div>
            <div className="first-run-actions">
              <button onClick={() => setStage("complete")}>
                Fullfør (sjekk Resolve senere)
              </button>
              <button className="primary" onClick={startChecking}>
                Sjekk igjen
              </button>
            </div>
          </>
        )}

        {/* COMPLETE */}
        {stage === "complete" && (
          <>
            <h2><IconSparkle /> Klar til bruk!</h2>
            <div className="desc">
              Alt er installert og konfigurert. Du kan nå:
              <ul>
                <li>Klikk <strong>Set up Project</strong> i headeren for å starte et nytt prosjekt fra et SD-kort eller en mappe</li>
                <li>Bruk <strong>Cull</strong>-fanen for AI-drevet klipp-utvalg</li>
                <li>Bruk <strong>Audio</strong>-fanen for LUFS-måling, retake-deteksjon og transkripsjon</li>
                <li>Bruk <strong>Color</strong>-fanen for kamera-profiler og look pack-applikasjon</li>
              </ul>
              Du kan kjøre denne wizard-en igjen senere fra <strong><IconBox /> Dependencies</strong> i footeren.
            </div>
            <div className="first-run-actions">
              <button className="primary" onClick={finishWizard} style={{ width: "100%" }}>
                Start å bruke appen <IconArrowRight />
              </button>
            </div>
          </>
        )}

        {error && stage !== "checking" && (
          <div className="dialog-warning" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function shouldShowFirstRun(): boolean {
  return !localStorage.getItem(COMPLETED_KEY);
}
