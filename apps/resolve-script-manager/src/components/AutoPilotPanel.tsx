/**
 * AutoPilotPanel — UI for "lene seg tilbake + drikke kaffe"-modus.
 *
 * Viser:
 *  - Start-knapp (☕ Coffee mode) når idle
 *  - Pipeline-step-liste med live status
 *  - Aktivitetsstrøm (Slack-aktig) som streamer Claude/system-events
 *  - Decision-cards når Claude trenger input — auto-aksepteres etter timeout
 *  - Pause/resume/stop
 *
 * Designvalg: panelet er IKKE modal. Editor kan fortsatt klikke på timeline,
 * preview og toolbars mens auto-pilot kjører. Pipelinen pauser kun ved
 * eksplisitte decision-points.
 */

import { useEffect, useRef } from "react";
import {
  AUTO_PILOT_STEPS,
  useAutoPilot,
  type AutoPilotActivity,
  type AutoPilotInputs,
  type AutoPilotStepStatus,
} from "../hooks/useAutoPilot";

interface ProposedLookPackSpec {
  name: string;
  culturalTag: string;
  warmth: number;
  saturation: number;
  contrast: number;
  skinToneProtection: "soft" | "medium" | "strong";
  description: string;
}

interface Props {
  open: boolean;
  inputs: AutoPilotInputs | null;
  onClose: () => void;
  /** Kalt når Claude har foreslått en ny look-pack — UI kan spørre bruker
   *  om å lagre den i creator-profile. */
  onProposedLookPack?: (spec: ProposedLookPackSpec) => Promise<void> | void;
}

const STATUS_COLOR: Record<AutoPilotStepStatus, string> = {
  pending: "rgba(255,255,255,0.25)",
  running: "#a030c0",
  done: "#4ad48a",
  skipped: "#8674a8",
  error: "#ef4f6f",
};

const LEVEL_GLYPH: Record<AutoPilotActivity["level"], string> = {
  info: "ℹ",
  success: "✓",
  warn: "⚠",
  claude: "✨",
  action: "→",
};

const LEVEL_COLOR: Record<AutoPilotActivity["level"], string> = {
  info: "rgba(255,255,255,0.7)",
  success: "#4ad48a",
  warn: "#f0a500",
  claude: "#c850e0",
  action: "#a030c0",
};

function formatHms(sec: number): string {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AutoPilotPanel({ open, inputs, onClose, onProposedLookPack }: Props) {
  const { state, start, pause, resume, cancel, resolveDecision } = useAutoPilot();
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll til bunn på nye aktiviteter
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.activities.length]);

  // Auto-start når panelet åpnes med inputs (én gang)
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!open) { hasStartedRef.current = false; return; }
    if (hasStartedRef.current) return;
    if (state.status !== "idle") return;
    if (!inputs) return;
    hasStartedRef.current = true;
    void start(inputs);
  }, [open, inputs, state.status, start]);

  // Trigger callback ved completion hvis Claude foreslo ny look-pack
  const proposedHandledRef = useRef(false);
  useEffect(() => {
    if (state.status !== "completed") { proposedHandledRef.current = false; return; }
    if (proposedHandledRef.current) return;
    if (!state.proposedLookPack || !onProposedLookPack) return;
    proposedHandledRef.current = true;
    void onProposedLookPack(state.proposedLookPack);
  }, [state.status, state.proposedLookPack, onProposedLookPack]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 420,
        maxHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(20,12,40,0.98), rgba(10,5,24,0.98))",
        border: "1px solid var(--accent)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        zIndex: 4000,
        color: "var(--text-1)",
        fontSize: 12,
        overflow: "hidden",
      }}
      className="anim-pop-in"
    >
      {/* Konfetti når ferdig */}
      {state.status === "completed" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100,
                        pointerEvents: "none", overflow: "hidden" }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const colors = ["#a030c0", "#c850e0", "#4ad48a", "#f0a500", "#ef4f6f", "#d2691e"];
            return (
              <span key={i}
                    className="confetti-piece"
                    style={{
                      left: `${5 + (i * 5.2)}%`,
                      top: `${Math.random() * 20}px`,
                      background: colors[i % colors.length],
                      animationDelay: `${i * 60}ms`,
                    }} />
            );
          })}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, position: "relative",
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ position: "relative", display: "inline-block" }}>
                <span className={state.status === "running" ? "coffee-brew" : undefined}
                      style={{ display: "inline-block" }}>☕</span>
                {state.status === "running" && (
                  <>
                    <span className="coffee-steam-wisp s1"
                          style={{ top: -10 }}>~</span>
                    <span className="coffee-steam-wisp s2"
                          style={{ top: -10 }}>~</span>
                    <span className="coffee-steam-wisp s3"
                          style={{ top: -10 }}>~</span>
                  </>
                )}
              </span>
              Auto-pilot
              <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 8, fontSize: 11 }}>
                {state.status === "running" ? "brygger …"
                  : state.status === "paused" ? "venter på deg"
                  : state.status === "completed" ? "ferdig 🎉"
                  : state.status === "cancelled" ? "stoppet"
                  : state.status === "error" ? "feilet"
                  : "klar"}
              </span>
            </div>
            <div style={{ opacity: 0.55, fontSize: 11, marginTop: 2 }}>
              {state.status === "running" ? "Du kan ta kaffe ☕ — jeg pinger ved viktige valg"
                : state.status === "completed" ? "Highlighten er klar for review!"
                : state.status === "paused" && state.pendingDecision ? "Trenger ditt input på en beslutning"
                : "Jeg bygger highlighten ferdig — du kan ta kaffe"}
            </div>
          </div>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0, color: "var(--text-2)",
                            cursor: "pointer", fontSize: 16 }}>
            ✕
          </button>
        </div>
        {/* Progress bar + ETA */}
        {state.status !== "idle" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2,
                            overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${
                  state.status === "completed" ? 100
                    : (state.currentStepIdx + 1) / AUTO_PILOT_STEPS.length * 100
                }%`,
                background: state.status === "error"
                  ? "linear-gradient(90deg, #ef4f6f, #f0a500)"
                  : "linear-gradient(90deg, #a030c0, #c850e0)",
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6,
                            fontSize: 10.5, opacity: 0.65 }}>
              <span>Brukt: {formatHms(state.elapsedSec)}</span>
              <span>Igjen ~{formatHms(state.remainingSec)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline steps overview */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        {AUTO_PILOT_STEPS.map((step) => {
          const st = state.stepStatuses[step.id];
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8,
                                          padding: "3px 0", fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%",
                              background: STATUS_COLOR[st],
                              flexShrink: 0,
                              animation: st === "running" ? "anim-pulse 1.4s infinite" : undefined }} />
              <span style={{ flex: 1, opacity: st === "pending" ? 0.5 : 0.9 }}>
                {step.label}
              </span>
              {st === "done" && <span style={{ color: "#4ad48a", fontSize: 10 }}>✓</span>}
              {st === "error" && <span style={{ color: "#ef4f6f", fontSize: 10 }}>!</span>}
            </div>
          );
        })}
      </div>

      {/* Decision-card */}
      {state.pendingDecision && (
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)",
                        background: "rgba(160,48,192,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ color: "#c850e0", fontSize: 13 }}>✨</span>
            <strong style={{ fontSize: 12 }}>Claude trenger input</strong>
            {state.pendingDecision.autoAcceptAfterSec && (
              <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: 10 }}>
                auto etter {state.pendingDecision.autoAcceptAfterSec}s
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, marginBottom: 10, opacity: 0.85 }}>
            {state.pendingDecision.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.pendingDecision.options.map((opt) => (
              <button key={opt.id}
                      onClick={() => resolveDecision(opt.id)}
                      style={{
                        textAlign: "left",
                        background: opt.id === state.pendingDecision?.recommendedOptionId
                          ? "rgba(74,212,138,0.10)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${
                          opt.id === state.pendingDecision?.recommendedOptionId
                            ? "rgba(74,212,138,0.4)" : "rgba(255,255,255,0.10)"
                        }`,
                        borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                        color: "inherit",
                      }}>
                <div style={{ fontWeight: 600, fontSize: 11.5 }}>
                  {opt.label}
                  {opt.id === state.pendingDecision?.recommendedOptionId && (
                    <span style={{ marginLeft: 6, color: "#4ad48a", fontSize: 10 }}>
                      ✓ Claude anbefaler
                    </span>
                  )}
                </div>
                <div style={{ opacity: 0.7, fontSize: 10.5, marginTop: 2 }}>{opt.description}</div>
                {opt.reasoning && (
                  <div style={{ opacity: 0.55, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>
                    {opt.reasoning}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div ref={logRef}
           style={{ flex: 1, overflowY: "auto", padding: "8px 16px",
                     minHeight: 120, maxHeight: 280 }}>
        {state.activities.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 11 }}>
            Aktivitet vises her når auto-pilot starter
          </div>
        )}
        {state.activities.map((a) => (
          <div key={a.id} style={{ padding: "4px 0", fontSize: 11,
                                     display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: LEVEL_COLOR[a.level], flexShrink: 0, marginTop: 1 }}>
              {LEVEL_GLYPH[a.level]}
            </span>
            <div style={{ flex: 1, opacity: 0.85, lineHeight: 1.4 }}>
              {a.message}
              <div style={{ opacity: 0.4, fontSize: 9.5, marginTop: 1 }}>
                {new Date(a.ts).toLocaleTimeString("nb-NO")}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer controls */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)",
                      display: "flex", gap: 8, justifyContent: "space-between" }}>
        {state.status === "running" && (
          <>
            <button onClick={pause} style={controlBtn}>⏸ Pause</button>
            <button onClick={cancel} style={{ ...controlBtn, color: "#ef4f6f" }}>✕ Stopp</button>
          </>
        )}
        {state.status === "paused" && !state.pendingDecision && (
          <>
            <button onClick={resume} style={{ ...controlBtn, color: "#4ad48a" }}>▶ Fortsett</button>
            <button onClick={cancel} style={{ ...controlBtn, color: "#ef4f6f" }}>✕ Stopp</button>
          </>
        )}
        {(state.status === "completed" || state.status === "cancelled" || state.status === "error") && (
          <button onClick={onClose} style={{ ...controlBtn, flex: 1 }}>Lukk</button>
        )}
      </div>
    </div>
  );
}

const controlBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 11,
  color: "inherit",
  cursor: "pointer",
  fontWeight: 600,
};

export default AutoPilotPanel;
