/**
 * Role Room sign-in flow — device-code pairing.
 *
 *   1. Calls POST /api/post-agent/pairing/start → gets 6-char code
 *   2. Shows code prominently + opens theroleroom.com/link in browser
 *   3. Polls /pairing/poll every 2s
 *   4. On success: stores bearer token in Settings + closes dialog
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { updateAppSettings } from "../api";
import { IconCheck, IconX, IconSparkle, IconArrowRight } from "./Icons";

const STORAGE_KEY = "trrpa.settings";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;

interface Props {
  onClose: () => void;
  onSignedIn: () => void;
}

interface PairingStart {
  code: string;
  expiresAt: string;
  verificationUrl: string;
  pollIntervalMs: number;
}

type Stage = "starting" | "awaiting" | "paired" | "error";

function getBaseUrl(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { RR_POST_AGENT_BASE_URL?: string };
      if (s.RR_POST_AGENT_BASE_URL) return s.RR_POST_AGENT_BASE_URL.replace(/\/$/, "");
    }
  } catch {
    // fall through
  }
  return "https://creatorhubn.com/api/post-agent";
}

async function saveBearerToSettings(token: string): Promise<void> {
  const raw = localStorage.getItem(STORAGE_KEY);
  const settings = raw ? JSON.parse(raw) : {};
  settings.RR_BEARER_TOKEN = token;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // Also push to Rust side so currently-running Python subprocesses pick it up
  await updateAppSettings({ RR_BEARER_TOKEN: token });
  // Notify in-tab listeners (HeaderBar / UserProfile) so they re-render with
  // the new auth state — localStorage 'storage' event doesn't fire same-tab.
  window.dispatchEvent(new CustomEvent("trrpa:auth-changed"));
}

export function RoleRoomSignInDialog({ onClose, onSignedIn }: Props) {
  const [stage, setStage] = useState<Stage>("starting");
  const [pairing, setPairing] = useState<PairingStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const pollTimer = useRef<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  const base = getBaseUrl();

  const start = useCallback(async () => {
    setStage("starting");
    setError(null);
    try {
      const res = await fetch(`${base}/pairing/start`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("For mange innloggings-forsøk. Vent 30 sekunder og prøv på nytt.");
        }
        throw new Error(`pairing/start: HTTP ${res.status}`);
      }
      const data = (await res.json()) as PairingStart;
      setPairing(data);
      setStage("awaiting");
      startedAt.current = Date.now();
      try {
        await openUrl(`${data.verificationUrl}?code=${encodeURIComponent(data.code)}`);
      } catch {
        // user can still copy the code manually
      }
    } catch (e) {
      setStage("error");
      setError(String(e));
    }
  }, [base]);

  // Kick off the pairing on mount
  useEffect(() => {
    void start();
  }, [start]);

  // Polling loop
  useEffect(() => {
    if (stage !== "awaiting" || !pairing) return;
    const tick = async () => {
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        setStage("error");
        setError("Pairing timed out — generer ny kode.");
        return;
      }
      setSecondsLeft(Math.max(0, Math.floor((startedAt.current + MAX_POLL_MS - Date.now()) / 1000)));
      try {
        const res = await fetch(`${base}/pairing/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: pairing.code }),
        });
        if (res.status === 202) return; // still pending
        if (res.status === 410) {
          setStage("error");
          setError("Pairing-koden er utløpt. Klikk 'Prøv på nytt'.");
          return;
        }
        if (!res.ok) {
          setStage("error");
          setError(`pairing/poll: HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as { bearerToken?: string };
        if (!data.bearerToken) {
          setStage("error");
          setError("Backend returnerte tomt token.");
          return;
        }
        await saveBearerToSettings(data.bearerToken);
        setStage("paired");
        onSignedIn();
      } catch (e) {
        // Transient network error — keep polling. Don't burn the user's session
        // because of a flaky wifi blip.
        console.warn("pairing/poll transient error", e);
      }
    };
    pollTimer.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    void tick(); // first poll immediately
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, [stage, pairing, base, onSignedIn]);

  const copyCode = useCallback(() => {
    if (pairing) void navigator.clipboard.writeText(pairing.code);
  }, [pairing]);

  return (
    <div className="modal-backdrop" onClick={stage === "paired" ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <h2>
          <IconSparkle /> Logg inn på The Role Room
        </h2>

        {stage === "starting" && (
          <div className="cull-running" style={{ padding: 16 }}>
            <div className="cull-running-spinner" />
            Henter pairing-kode…
          </div>
        )}

        {stage === "awaiting" && pairing && (
          <>
            <div className="desc">
              Skriver inn koden under på <strong>theroleroom.com/link</strong>. Vi har allerede åpnet siden for deg.
            </div>
            <div style={{
              background: "var(--bg-3)",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              margin: "16px 0",
            }}>
              <div style={{
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: 6,
                color: "var(--accent)",
              }}>
                {pairing.code}
              </div>
              <button className="small ghost" onClick={copyCode} style={{ marginTop: 12 }}>
                Kopier kode
              </button>
            </div>
            <div className="cull-running" style={{ padding: 10 }}>
              <div className="cull-running-spinner" />
              <span>Venter på paring… (utløper om {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")})</span>
            </div>
            <div className="actions">
              <button onClick={onClose}>
                <IconX /> Avbryt
              </button>
              <button
                onClick={() => pairing && openUrl(`${pairing.verificationUrl}?code=${encodeURIComponent(pairing.code)}`)}
              >
                Åpne theroleroom.com/link igjen
              </button>
            </div>
          </>
        )}

        {stage === "paired" && (
          <>
            <div className="cull-running" style={{ padding: 18, color: "var(--success)" }}>
              <IconCheck /> Logget inn. AI-funksjonene er nå klare.
            </div>
            <div className="actions">
              <button className="primary" onClick={onClose}>Lukk</button>
            </div>
          </>
        )}

        {stage === "error" && (
          <>
            <div className="dialog-warning">{error ?? "Ukjent feil"}</div>
            <div className="actions">
              <button onClick={onClose}>Lukk</button>
              <button className="primary" onClick={start}><IconArrowRight /> Prøv på nytt</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
