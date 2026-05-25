import { useCallback, useEffect, useState } from "react";
import { updateAppSettings } from "../api";
import { IconCheck, IconWarning } from "./Icons";
import { RoleRoomSignInDialog } from "./RoleRoomSignInDialog";

interface Props {
  onClose: () => void;
}

const STORAGE_KEY = "trrpa.settings";
const USAGE_KEY = "trrpa.aiUsage";

interface Settings {
  RR_BEARER_TOKEN: string;
  RR_POST_AGENT_BASE_URL: string;
  ANTHROPIC_API_KEY: string;
  HF_TOKEN: string;
  RESOLVE_SCRIPT_API: string;
  RESOLVE_SCRIPT_LIB: string;
  RESOLVE_SCRIPT_MANAGER_FFMPEG: string;
  RESOLVE_SCRIPT_MANAGER_WHISPERX: string;
  defaultDeliveryTarget: string;
  defaultOutputFolder: string;
  defaultWhisperModel: string;
}

interface AiUsage {
  haikuImages: number;
  sonnetImages: number;
  monthHaikuImages: number;
  monthSonnetImages: number;
  monthKey: string;
  resetAt: string;
}

const DEFAULT_SETTINGS: Settings = {
  RR_BEARER_TOKEN: "",
  RR_POST_AGENT_BASE_URL: "",
  ANTHROPIC_API_KEY: "",
  HF_TOKEN: "",
  RESOLVE_SCRIPT_API: "",
  RESOLVE_SCRIPT_LIB: "",
  RESOLVE_SCRIPT_MANAGER_FFMPEG: "",
  RESOLVE_SCRIPT_MANAGER_WHISPERX: "",
  defaultDeliveryTarget: "wedding",
  defaultOutputFolder: "",
  defaultWhisperModel: "base",
};

const HAIKU_COST_PER_IMAGE = 0.0003;
const SONNET_COST_PER_IMAGE = 0.003;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function settingsToEnvVars(settings: Settings): Record<string, string> {
  return {
    RR_BEARER_TOKEN: settings.RR_BEARER_TOKEN,
    RR_POST_AGENT_BASE_URL: settings.RR_POST_AGENT_BASE_URL,
    ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY,
    HF_TOKEN: settings.HF_TOKEN,
    RESOLVE_SCRIPT_API: settings.RESOLVE_SCRIPT_API,
    RESOLVE_SCRIPT_LIB: settings.RESOLVE_SCRIPT_LIB,
    RESOLVE_SCRIPT_MANAGER_FFMPEG: settings.RESOLVE_SCRIPT_MANAGER_FFMPEG,
    RESOLVE_SCRIPT_MANAGER_WHISPERX: settings.RESOLVE_SCRIPT_MANAGER_WHISPERX,
  };
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export function loadAiUsage(): AiUsage {
  const month = currentMonthKey();
  const base: AiUsage = {
    haikuImages: 0,
    sonnetImages: 0,
    monthHaikuImages: 0,
    monthSonnetImages: 0,
    monthKey: month,
    resetAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as AiUsage;
    // Reset month counters when month rolls over
    if (parsed.monthKey !== month) {
      parsed.monthHaikuImages = 0;
      parsed.monthSonnetImages = 0;
      parsed.monthKey = month;
    }
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export function recordAiUsage(model: string, imageCount: number): void {
  const usage = loadAiUsage();
  if (model.includes("haiku")) {
    usage.haikuImages += imageCount;
    usage.monthHaikuImages += imageCount;
  } else if (model.includes("sonnet")) {
    usage.sonnetImages += imageCount;
    usage.monthSonnetImages += imageCount;
  }
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore
  }
}

function formatCost(cost: number): string {
  if (cost < 0.01) return "$0.00";
  return `$${cost.toFixed(2)}`;
}

const ADMIN_UNLOCK_CLICKS = 5;
const ADMIN_UNLOCK_WINDOW_MS = 1500;

export function SettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [usage, setUsage] = useState<AiUsage>(() => loadAiUsage());
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminClicks, setAdminClicks] = useState<number[]>([]);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    void updateAppSettings(settingsToEnvVars(settings));
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await updateAppSettings(settingsToEnvVars(settings));
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleAdminClick = useCallback(() => {
    const now = Date.now();
    const recent = [...adminClicks, now].filter((t) => now - t <= ADMIN_UNLOCK_WINDOW_MS);
    setAdminClicks(recent);
    if (recent.length >= ADMIN_UNLOCK_CLICKS) {
      setAdminMode(true);
      setAdminClicks([]);
    }
  }, [adminClicks]);

  const resetUsage = useCallback(() => {
    const reset: AiUsage = {
      haikuImages: 0,
      sonnetImages: 0,
      monthHaikuImages: 0,
      monthSonnetImages: 0,
      monthKey: currentMonthKey(),
      resetAt: new Date().toISOString(),
    };
    localStorage.setItem(USAGE_KEY, JSON.stringify(reset));
    setUsage(reset);
  }, []);

  const monthCost =
    usage.monthHaikuImages * HAIKU_COST_PER_IMAGE +
    usage.monthSonnetImages * SONNET_COST_PER_IMAGE;
  const allTimeCost =
    usage.haikuImages * HAIKU_COST_PER_IMAGE + usage.sonnetImages * SONNET_COST_PER_IMAGE;

  const signedIn = !!settings.RR_BEARER_TOKEN;
  const aiConnected = signedIn || !!settings.ANTHROPIC_API_KEY;
  const diarizationConnected = !!settings.HF_TOKEN;
  const customPaths =
    !!settings.RESOLVE_SCRIPT_API ||
    !!settings.RESOLVE_SCRIPT_LIB ||
    !!settings.RESOLVE_SCRIPT_MANAGER_FFMPEG ||
    !!settings.RESOLVE_SCRIPT_MANAGER_WHISPERX;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 540, maxHeight: "85vh" }}>
        <h2>Settings</h2>
        <div className="desc">
          Brukerinnstillinger som påvirker default-valg i Cull, Audio og Color.
        </div>

        {/* USER PREFERENCES */}
        <div className="settings-section">
          <div className="field">
            <label>Default delivery target</label>
            <select
              value={settings.defaultDeliveryTarget}
              onChange={(e) => update("defaultDeliveryTarget", e.target.value)}
            >
              <option value="wedding">Wedding Film (−16 LUFS)</option>
              <option value="youtube">YouTube (−14 LUFS)</option>
              <option value="instagram">Instagram Reel (−14 LUFS)</option>
              <option value="podcast">Podcast (−16 LUFS)</option>
              <option value="broadcast">Broadcast (−23 LUFS)</option>
            </select>
            <div className="settings-help">Foretrukket loudness-mål når Audio QC Report kjøres.</div>
          </div>
          <div className="field">
            <label>Default output folder</label>
            <input
              type="text"
              placeholder="~/Documents/Resolve Reports"
              value={settings.defaultOutputFolder}
              onChange={(e) => update("defaultOutputFolder", e.target.value)}
            />
          </div>
          <div className="field">
            <label>WhisperX-modell</label>
            <select
              value={settings.defaultWhisperModel}
              onChange={(e) => update("defaultWhisperModel", e.target.value)}
            >
              <option value="tiny">tiny (rask, mindre presis)</option>
              <option value="base">base (balansert — anbefalt)</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large-v3">large-v3 (best, treg)</option>
            </select>
          </div>
        </div>

        {/* AI USAGE / COST */}
        <div className="settings-section">
          <div className="section-title">AI-forbruk</div>
          <div className="ai-usage-summary">
            <div className="ai-usage-month">
              <div className="ai-usage-amount">{formatCost(monthCost)}</div>
              <div className="card-chip-meta">denne måneden ({usage.monthKey})</div>
            </div>
            <div className="ai-usage-total">
              <div className="ai-usage-amount-small">{formatCost(allTimeCost)}</div>
              <div className="card-chip-meta">all-time</div>
            </div>
          </div>
          <div className="ai-usage-breakdown">
            <div>
              <span className="chip stub">Haiku</span>
              {usage.monthHaikuImages} bilder denne måneden · {usage.haikuImages} totalt
            </div>
            <div>
              <span className="chip experimental">Sonnet</span>
              {usage.monthSonnetImages} bilder denne måneden · {usage.sonnetImages} totalt
            </div>
          </div>
          <div className="settings-help" style={{ marginTop: 4 }}>
            Estimat basert på faktiske antall Vision-kall (Haiku ≈ $0.0003/bilde, Sonnet ≈ $0.003/bilde).
            Sist tilbakestilt: {new Date(usage.resetAt).toLocaleDateString()}.
          </div>
          <button className="small ghost" onClick={resetUsage} style={{ marginTop: 6, alignSelf: "flex-start" }}>
            Reset counters
          </button>
        </div>

        {/* THE ROLE ROOM SIGN-IN — primary auth path for end users */}
        <div className="settings-section">
          <div className="section-title">The Role Room-konto</div>
          <div className="settings-help" style={{ marginBottom: 8 }}>
            Logg inn for å bruke AI-funksjoner (cull, highlight-scoring, scene-tagging). Krever aktiv Role Room-abonnement.
          </div>
          <div className="settings-status-row">
            <span className={`chip ${signedIn ? "ready" : "stub"}`}>
              {signedIn ? <><IconCheck /> Logget inn</> : "Ikke logget inn"}
            </span>
            <span>{signedIn ? "AI-kall routes via proxy" : "Logg inn for AI-tilgang"}</span>
          </div>
          <div className="actions" style={{ marginTop: 8 }}>
            {!signedIn ? (
              <button className="small primary" onClick={() => setShowSignIn(true)}>
                Logg inn med Role Room
              </button>
            ) : (
              <button
                className="small"
                onClick={() => {
                  update("RR_BEARER_TOKEN", "");
                  setSettings((s) => ({ ...s, RR_BEARER_TOKEN: "" }));
                }}
              >
                Logg ut
              </button>
            )}
          </div>
        </div>

        {showSignIn && (
          <RoleRoomSignInDialog
            onClose={() => setShowSignIn(false)}
            onSignedIn={() => {
              setSettings((s) => ({ ...s, RR_BEARER_TOKEN: loadSettings().RR_BEARER_TOKEN }));
            }}
          />
        )}

        {/* SERVICE STATUS */}
        <div className="settings-section">
          <div className="section-title">Tilkoblinger</div>
          <div className="settings-status-row">
            <span className={`chip ${aiConnected ? "ready" : "stub"}`}>
              {aiConnected ? <><IconCheck /> Tilkoblet</> : "Ikke tilkoblet"}
            </span>
            <span>Claude Vision AI</span>
          </div>
          <div className="settings-status-row">
            <span className={`chip ${diarizationConnected ? "ready" : "stub"}`}>
              {diarizationConnected ? <><IconCheck /> Tilkoblet</> : "Ikke tilkoblet"}
            </span>
            <span>Speaker diarization (HuggingFace)</span>
          </div>
          <div className="settings-status-row">
            <span className={`chip ${customPaths ? "ready" : ""}`}>
              {customPaths ? <><IconCheck /> Overstyrt</> : "Auto"}
            </span>
            <span>Tool paths (ffmpeg / Resolve / WhisperX)</span>
          </div>
          <div className="settings-help" style={{ marginTop: 6 }}>
            For å konfigurere AI-tilgang eller endre tool-paths, kontakt admin.
          </div>
        </div>

        {/* ADMIN — locked behind 5 quick clicks on footer */}
        {adminMode && (
          <div className="settings-section settings-section-admin">
            <div className="section-title"><IconWarning /> Admin · Env vars</div>
            <div className="settings-help" style={{ marginBottom: 8 }}>
              Sensitive verdier. Sendes som env-vars til Python-subprosesser, lagres i localStorage.
            </div>
            <div className="field">
              <label>ANTHROPIC_API_KEY</label>
              <input type="password" placeholder="sk-ant-…"
                value={settings.ANTHROPIC_API_KEY}
                onChange={(e) => update("ANTHROPIC_API_KEY", e.target.value)} />
            </div>
            <div className="field">
              <label>HF_TOKEN</label>
              <input type="password" placeholder="hf_…"
                value={settings.HF_TOKEN}
                onChange={(e) => update("HF_TOKEN", e.target.value)} />
            </div>
            <div className="field">
              <label>RESOLVE_SCRIPT_API</label>
              <input type="text" placeholder="auto-detected if empty"
                value={settings.RESOLVE_SCRIPT_API}
                onChange={(e) => update("RESOLVE_SCRIPT_API", e.target.value)} />
            </div>
            <div className="field">
              <label>RESOLVE_SCRIPT_LIB</label>
              <input type="text" placeholder="auto-detected if empty"
                value={settings.RESOLVE_SCRIPT_LIB}
                onChange={(e) => update("RESOLVE_SCRIPT_LIB", e.target.value)} />
            </div>
            <div className="field">
              <label>RESOLVE_SCRIPT_MANAGER_FFMPEG</label>
              <input type="text" placeholder="/opt/homebrew/bin/ffmpeg"
                value={settings.RESOLVE_SCRIPT_MANAGER_FFMPEG}
                onChange={(e) => update("RESOLVE_SCRIPT_MANAGER_FFMPEG", e.target.value)} />
            </div>
            <div className="field">
              <label>RESOLVE_SCRIPT_MANAGER_WHISPERX</label>
              <input type="text" placeholder="/opt/homebrew/bin/whisperx"
                value={settings.RESOLVE_SCRIPT_MANAGER_WHISPERX}
                onChange={(e) => update("RESOLVE_SCRIPT_MANAGER_WHISPERX", e.target.value)} />
            </div>
            <button className="small ghost" onClick={() => setAdminMode(false)} style={{ marginTop: 6 }}>
              Lock admin section
            </button>
          </div>
        )}

        {savedToast && (
          <div className="dialog-warning" style={{
            borderColor: "var(--success)",
            color: "var(--success)",
            background: "rgba(76,175,80,.08)",
          }}>
            Saved.
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Close</button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div
          className="settings-admin-hint"
          onClick={handleAdminClick}
          title={adminMode ? "Admin section unlocked" : ""}
        >
          The Role Room Post Agent · v0.1.0
        </div>
      </div>
    </div>
  );
}
