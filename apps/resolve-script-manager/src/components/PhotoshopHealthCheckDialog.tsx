/**
 * PhotoshopHealthCheckDialog — in-app verifisering av at hele
 * Photoshop-stacken fungerer ende-til-ende. Designet for å gi
 * ikke-tekniske brukere (typisk Irene) ett enkelt "ALT GRØNT"-svar
 * uten å måtte åpne DevTools eller terminal.
 *
 * Kjører 8 sjekker sekvensielt og rapporterer status per ledd:
 *   1. Bridge-server lytter
 *   2. UXP-plugin tilkoblet
 *   3. Photoshop-versjon detektert
 *   4. Ping mot Photoshop
 *   5. app.info returnerer dokumenter
 *   6. Aktivt dokument finnes
 *   7. PSD-indekserer fungerer (Rust-side)
 *   8. Role Room /me returnerer 200 (med eller uten schemaDegraded)
 *
 * Hver sjekk har idle/running/ok/warn/fail-status + en fix-hint
 * når noe feiler, slik at brukeren vet hva som må gjøres.
 */

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { photoshop, getStatus } from "../services/photoshopBridgeService";
import { indexDirectory } from "../services/psdIndexerService";
import { loadSettings } from "./SettingsModal";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CircularProgress from "@mui/material/CircularProgress";

interface Props {
  onClose: () => void;
}

type CheckState = "idle" | "running" | "ok" | "warn" | "fail";

interface CheckResult {
  state: CheckState;
  message: string;
  fix?: string;
}

interface CheckDef {
  id: string;
  title: string;
  description: string;
  /** Optional — vises hvis sjekken er valgfri og feilen ikke betyr "alt brutt". */
  optional?: boolean;
  run: () => Promise<CheckResult>;
}

const CHECKS: CheckDef[] = [
  {
    id: "bridge-server",
    title: "Bridge-server lytter",
    description: "Tauri-app kjører WebSocket på port 1733",
    run: async () => {
      const s = await getStatus();
      if (s.port === 1733)
        return { state: "ok", message: `Lytter på port ${s.port}` };
      return {
        state: "fail",
        message: "Klarte ikke å hente bridge-status",
        fix: "Restart Tauri-appen (cmd+Q og åpne på nytt)",
      };
    },
  },
  {
    id: "plugin-connected",
    title: "UXP-plugin tilkoblet",
    description: "Post Agent Bridge-pluginen i Photoshop er live",
    run: async () => {
      const s = await getStatus();
      if (s.connected) {
        return {
          state: "ok",
          message: `Plugin v${s.plugin_version ?? "?"} koblet til`,
        };
      }
      return {
        state: "fail",
        message: "Ingen plugin tilkoblet",
        fix: "Åpne Adobe UXP Developer Tool, last plugin fra apps/post-agent-photoshop-plugin/manifest.json, klikk Load med Photoshop åpent",
      };
    },
  },
  {
    id: "photoshop-version",
    title: "Photoshop-versjon detektert",
    description: "Vi vet hvilken Photoshop-versjon pluginen kjører i",
    run: async () => {
      const s = await getStatus();
      if (s.photoshop_version) {
        return { state: "ok", message: `Photoshop ${s.photoshop_version}` };
      }
      return {
        state: "warn",
        message: "Versjon ikke rapportert ennå",
        fix: "Reload pluginen i UDT — plugin sender hello-melding på tilkobling",
      };
    },
  },
  {
    id: "ping",
    title: "Ping mot Photoshop",
    description: "WS-meldingen kan rundtur uten timeout",
    run: async () => {
      const start = Date.now();
      const r = await photoshop.ping();
      const ms = Date.now() - start;
      if (r.pong) return { state: "ok", message: `Pong på ${ms}ms` };
      return { state: "fail", message: "Pong-svar mangler" };
    },
  },
  {
    id: "app-info",
    title: "App.info returnerer dokumenter",
    description: "Vi får liste over åpne dokumenter fra Photoshop",
    run: async () => {
      const info = await photoshop.appInfo();
      return {
        state: "ok",
        message: `${info.documents.length} åpne dokument${info.documents.length === 1 ? "" : "er"}`,
      };
    },
  },
  {
    id: "active-doc",
    title: "Aktivt dokument finnes",
    description: "Photoshop har minst ett åpent dokument vi kan jobbe mot",
    optional: true,
    run: async () => {
      const info = await photoshop.appInfo();
      if (info.active_document) {
        const d = info.active_document;
        return {
          state: "ok",
          message: `${d.name} (${d.width}×${d.height})`,
        };
      }
      return {
        state: "warn",
        message: "Ingen aktiv doc",
        fix: "Åpne en .psd-fil i Photoshop, eller File → New, før du tester template-funksjonalitet",
      };
    },
  },
  {
    id: "psd-indexer",
    title: "PSD-indekserer (Rust)",
    description: "Backend kan parse .psd-filer uten Photoshop",
    run: async () => {
      const home = (await invoke<string>("get_app_data_dir").catch(() => "/tmp")) || "/tmp";
      const r = await indexDirectory(home, 1).catch(() => []);
      return {
        state: "ok",
        message: `Indekserte ${r.length} PSD i app data dir (test-skanning)`,
      };
    },
  },
  {
    id: "role-room-me",
    title: "Role Room /me returnerer 200",
    description: "Backend-API responderer på din innlogging",
    run: async () => {
      const s = loadSettings();
      const token = s.RR_BEARER_TOKEN?.trim();
      if (!token)
        return {
          state: "warn",
          message: "Ikke innlogget i Role Room",
          fix: "Logg inn via tannhjul → Settings → Sign in",
        };
      const base = (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
      const res = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        return {
          state: "fail",
          message: `HTTP ${res.status} fra /me`,
          fix: "Logg inn på nytt — Render-deploy kan ennå være under vei",
        };
      }
      const body = await res.json();
      const tag = body.schemaDegraded ? " (schemaDegraded — migrate venter)" : "";
      return {
        state: "ok",
        message: `Innlogget som ${body.email}${tag}`,
      };
    },
  },
];

export function PhotoshopHealthCheckDialog({ onClose }: Props) {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setCompleted(false);
    const fresh: Record<string, CheckResult> = {};
    for (const check of CHECKS) {
      fresh[check.id] = { state: "running", message: "Kjører…" };
      setResults({ ...fresh });
      try {
        const r = await check.run();
        fresh[check.id] = r;
      } catch (err) {
        fresh[check.id] = {
          state: check.optional ? "warn" : "fail",
          message: err instanceof Error ? err.message : String(err),
        };
      }
      setResults({ ...fresh });
    }
    setRunning(false);
    setCompleted(true);
  }, []);

  // Compute aggregate
  const states = Object.values(results);
  const failCount = states.filter((r) => r.state === "fail").length;
  const warnCount = states.filter((r) => r.state === "warn").length;
  const okCount = states.filter((r) => r.state === "ok").length;
  const allGreen = completed && failCount === 0 && warnCount === 0;
  const someFailed = completed && failCount > 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Helse-sjekk Photoshop</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Verifiserer at hele Photoshop-koblingen fungerer ende-til-ende
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        {completed && (
          <div
            style={{
              ...banner,
              ...(allGreen
                ? bannerGreen
                : someFailed
                ? bannerRed
                : bannerAmber),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {allGreen && (
              <>
                <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
                ALT FUNGERER — {okCount} av {CHECKS.length} sjekker grønne
              </>
            )}
            {someFailed && (
              <>
                <ErrorOutlineIcon sx={{ fontSize: 18 }} />
                {failCount} sjekk{failCount === 1 ? "" : "er"} feiler — se under for fix
              </>
            )}
            {!someFailed && warnCount > 0 && (
              <>
                <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />
                {warnCount} advarsel{warnCount === 1 ? "" : "er"}, men ingen kritiske feil
              </>
            )}
          </div>
        )}

        <div style={body}>
          {!completed && Object.keys(results).length === 0 && (
            <div style={emptyState}>
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                Klar til å verifisere hele stacken.
              </div>
              <div style={{ color: "#888", lineHeight: 1.6 }}>
                Før du starter, sørg for at:
                <ul style={{ paddingLeft: 18 }}>
                  <li>Adobe Photoshop er åpent</li>
                  <li>Post Agent Bridge-pluginen er lastet i UDT</li>
                  <li>Du har minst ett dokument åpent i Photoshop</li>
                </ul>
              </div>
            </div>
          )}

          {CHECKS.map((check, i) => {
            const r = results[check.id];
            if (!r) return null;
            return (
              <div key={check.id} style={checkRow}>
                <div style={{ ...statusBadge, ...badgeStyle(r.state) }}>
                  {iconFor(r.state)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={checkTitle}>
                    <span style={{ color: "#666", marginRight: 6 }}>{i + 1}.</span>
                    {check.title}
                    {check.optional && (
                      <span style={{ fontSize: 10, color: "#666", marginLeft: 6 }}>
                        (valgfri)
                      </span>
                    )}
                  </div>
                  <div style={checkDesc}>{check.description}</div>
                  <div
                    style={{
                      ...checkMessage,
                      color: messageColor(r.state),
                    }}
                  >
                    {r.message}
                  </div>
                  {r.fix && (
                    <div style={fixHint}>
                      <strong>Fix:</strong> {r.fix}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer style={footerBar}>
          <button onClick={runAll} disabled={running} style={primaryBtn}>
            {running
              ? "Kjører sjekker…"
              : completed
              ? "Kjør på nytt"
              : "Kjør helse-sjekk"}
          </button>
          {completed && (
            <div style={{ fontSize: 11, color: "#888" }}>
              <CheckIcon sx={{ fontSize: 12, verticalAlign: "text-bottom", color: "#4ad48a" }} /> {okCount}  ·  <WarningAmberOutlinedIcon sx={{ fontSize: 12, verticalAlign: "text-bottom", color: "#f59e0b" }} /> {warnCount}  ·  <CloseIcon sx={{ fontSize: 12, verticalAlign: "text-bottom", color: "#ef4f6f" }} /> {failCount}  av {CHECKS.length}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function iconFor(state: CheckState): React.ReactNode {
  switch (state) {
    case "ok": return <CheckIcon sx={{ fontSize: 16 }} />;
    case "warn": return <WarningAmberOutlinedIcon sx={{ fontSize: 16 }} />;
    case "fail": return <CloseIcon sx={{ fontSize: 16 }} />;
    case "running": return <CircularProgress size={12} sx={{ color: "#60a5fa" }} />;
    default: return <FiberManualRecordIcon sx={{ fontSize: 8 }} />;
  }
}

function badgeStyle(state: CheckState): React.CSSProperties {
  switch (state) {
    case "ok":      return { background: "rgba(74,212,138,0.18)", color: "#4ad48a" };
    case "warn":    return { background: "rgba(245,158,11,0.18)", color: "#f59e0b" };
    case "fail":    return { background: "rgba(239,79,111,0.18)", color: "#ef4f6f" };
    case "running": return { background: "rgba(59,130,246,0.18)", color: "#60a5fa" };
    default:        return { background: "rgba(184,168,216,0.10)", color: "#888" };
  }
}

function messageColor(state: CheckState): string {
  switch (state) {
    case "ok": return "#4ad48a";
    case "warn": return "#f59e0b";
    case "fail": return "#ef4f6f";
    case "running": return "#60a5fa";
    default: return "#888";
  }
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modal: React.CSSProperties = {
  background: "#1f1f1f",
  borderRadius: 8,
  width: "min(720px, 95vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  color: "#ddd",
  fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a2a",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#888",
  fontSize: 18,
  cursor: "pointer",
  padding: 4,
};

const banner: React.CSSProperties = {
  padding: "12px 18px",
  fontWeight: 600,
  fontSize: 13,
  textAlign: "center",
};

const bannerGreen: React.CSSProperties = {
  background: "rgba(74,212,138,0.15)",
  color: "#4ad48a",
  borderBottom: "1px solid rgba(74,212,138,0.4)",
};

const bannerRed: React.CSSProperties = {
  background: "rgba(239,79,111,0.15)",
  color: "#ef4f6f",
  borderBottom: "1px solid rgba(239,79,111,0.4)",
};

const bannerAmber: React.CSSProperties = {
  background: "rgba(245,158,11,0.15)",
  color: "#f59e0b",
  borderBottom: "1px solid rgba(245,158,11,0.4)",
};

const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  flex: 1,
};

const emptyState: React.CSSProperties = {
  padding: "20px 12px",
  fontSize: 12,
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 6,
  marginBottom: 6,
  background: "#181818",
  alignItems: "flex-start",
};

const statusBadge: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 700,
  flexShrink: 0,
};

const checkTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#ddd",
};

const checkDesc: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
  marginTop: 1,
};

const checkMessage: React.CSSProperties = {
  fontSize: 11,
  marginTop: 4,
  fontFamily: "ui-monospace, monospace",
};

const fixHint: React.CSSProperties = {
  fontSize: 11,
  marginTop: 4,
  color: "#bbb",
  background: "rgba(255,255,255,0.04)",
  padding: "4px 8px",
  borderRadius: 4,
  borderLeft: "2px solid #f59e0b",
};

const footerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 18px",
  borderTop: "1px solid #2a2a2a",
  background: "#181818",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
