/**
 * Role Room sign-in flow — device-code pairing.
 *
 *   1. Calls POST /api/post-agent/pairing/start → gets 6-char code
 *   2. Shows code prominently + opens theroleroom.com/link in browser
 *   3. Polls /pairing/poll every 2s
 *   4. On success: stores bearer token in Settings + closes dialog
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

/** Rust pairing_* commands proxy the HTTP call (bypasser browser-CORS) og
 *  returnerer { status, body } så vi beholder 202/410/429/200-semantikken. */
interface PairingHttp {
  status: number;
  body: unknown;
}

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

/**
 * Lagre bearer-token. ROBUST: hvert steg er best-effort og kaster ALDRI, slik at
 * en feil i ÉN persisterings-kanal (full/korrupt localStorage, invoke-hikke) ikke
 * strander en bruker som faktisk er paret (server har allerede konsumert koden).
 * Returnerer en feilbeskrivelse hvis noe gikk galt — for diagnostikk i UI.
 */
async function saveBearerToSettings(token: string): Promise<string | null> {
  const problems: string[] = [];
  // 1) localStorage (for header/UI + persistens over restart)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    settings.RR_BEARER_TOKEN = token;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    problems.push("localStorage: " + String(e));
    console.warn("[pairing] localStorage-lagring feilet:", e);
  }
  // 2) Rust-siden (så kjørende Python-subprosesser plukker opp token-en)
  try {
    await updateAppSettings({ RR_BEARER_TOKEN: token });
  } catch (e) {
    problems.push("updateAppSettings: " + String(e));
    console.warn("[pairing] updateAppSettings feilet:", e);
  }
  // 3) Varsle in-tab-lyttere (HeaderBar / UserProfile)
  try {
    window.dispatchEvent(new CustomEvent("trrpa:auth-changed"));
  } catch {
    /* ignore */
  }
  return problems.length ? problems.join(" · ") : null;
}

export function RoleRoomSignInDialog({ onClose, onSignedIn }: Props) {
  const [stage, setStage] = useState<Stage>("starting");
  const [pairing, setPairing] = useState<PairingStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const trace = useCallback((m: string) => {
    console.log("[pairing]", m);
  }, []);
  const pollTimer = useRef<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  const base = getBaseUrl();

  const start = useCallback(async () => {
    setStage("starting");
    setError(null);
    try {
      // Via Rust (utenom CORS) — backend sender ikke ACAO på /pairing/*.
      const res = await invoke<PairingHttp>("pairing_start", { base });
      if (res.status < 200 || res.status >= 300) {
        if (res.status === 429) {
          throw new Error("For mange innloggings-forsøk. Vent 30 sekunder og prøv på nytt.");
        }
        throw new Error(`pairing/start: HTTP ${res.status}`);
      }
      const data = res.body as PairingStart;
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
    // Lokal flagg: så snart tick'en har sett "paired" / "expired" /
    // "error", skal etterfølgende tick-er ikke gjøre noe. Forhindrer en
    // race der setInterval fyrer en gang til mellom paired-respons og
    // useEffect-cleanup — serveren har allerede slettet pairing-koden,
    // så den neste tick'en fikk 410 og overskrev "paired"-state med
    // "Pairing-koden er utløpt" som Daniel så.
    const stopRef = { stopped: false };
    const stopPolling = () => {
      stopRef.stopped = true;
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
    const tick = async () => {
      if (stopRef.stopped) return;
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        stopPolling();
        setStage("error");
        setError("Pairing timed out — generer ny kode.");
        return;
      }
      setSecondsLeft(Math.max(0, Math.floor((startedAt.current + MAX_POLL_MS - Date.now()) / 1000)));
      try {
        const res = await invoke<PairingHttp>("pairing_poll", {
          base,
          code: pairing.code,
        });
        trace(`poll ${pairing.code} → status ${res?.status} body ${JSON.stringify(res?.body)?.slice(0, 80)}`);
        if (stopRef.stopped) return;
        if (res.status === 202) return; // still pending
        if (res.status === 410) {
          stopPolling();
          setStage("error");
          setError("Pairing-koden er utløpt. Klikk 'Prøv på nytt'.");
          return;
        }
        if (res.status < 200 || res.status >= 300) {
          stopPolling();
          setStage("error");
          setError(`pairing/poll: HTTP ${res.status}`);
          return;
        }
        const data = (res.body ?? {}) as { bearerToken?: string; token?: string; bearer?: string };
        const gotToken = data.bearerToken || data.token || data.bearer;
        trace(`success-branch, felt=[${Object.keys(data).join(",")}] token?${!!gotToken}`);
        if (!gotToken) {
          stopPolling();
          setStage("error");
          setError("Backend returnerte tomt token. Felt: " + JSON.stringify(Object.keys(data)));
          return;
        }
        // Stopp polling FØR vi lagrer + setter state, så ingen ny tick
        // kan fyre mens vi er midt i success-flyten. saveBearerToSettings
        // kaster ALDRI — så vi fullfører alltid innloggingen når token er mottatt.
        stopPolling();
        trace("lagrer token…");
        const saveProblem = await saveBearerToSettings(gotToken);
        trace(`lagret (problem: ${saveProblem ?? "nei"}) → setStage(paired)`);
        setStage("paired");
        trace("setStage(paired) kalt → kaller onSignedIn");
        onSignedIn();
        trace("onSignedIn ferdig");
      } catch (e) {
        // Transient network error — keep polling. Don't burn the user's session
        // because of a flaky wifi blip.
        trace(`poll KASTET: ${String(e)?.slice(0, 120)}`);
      }
    };
    pollTimer.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    void tick(); // first poll immediately
    return () => {
      stopRef.stopped = true;
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
          <IconSparkle /> Logg inn på Creatorhub
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
              Skriver inn koden under på <strong>{(() => { try { const u = new URL(pairing.verificationUrl); return u.host + u.pathname; } catch { return pairing.verificationUrl; } })()}</strong> (logg inn med din Creatorhub- eller Role Room-konto). Vi har allerede åpnet siden for deg.
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
                Åpne innloggings-siden igjen
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
