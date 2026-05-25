/**
 * useDepHealth — runs check_dependencies.py once on mount, classifies the
 * result into green/amber/red, and returns a summary tooltip-string. Used
 * by the HeaderBar's DepHealthPill so the lead can see at a glance whether
 * the install is healthy without having to open Dependencies modal.
 *
 *   green = brew + ffmpeg + ffprobe + Resolve Studio installed
 *   amber = optional tool missing (chromaprint / anthropic / whisperx /
 *           librosa) but core flow works
 *   red   = brew or ffmpeg/ffprobe missing — core flow blocked
 */

import { useEffect, useState } from "react";
import { executeScript } from "../api";

export type DepHealth = "green" | "amber" | "red" | "unknown";

export interface DepHealthState {
  status: DepHealth;
  message: string;
  missingCritical: string[];
  missingOptional: string[];
  checked: boolean;
}

const INITIAL: DepHealthState = {
  status: "unknown",
  message: "Sjekker dependencies…",
  missingCritical: [],
  missingOptional: [],
  checked: false,
};

export function useDepHealth(): { state: DepHealthState; refresh: () => void } {
  const [state, setState] = useState<DepHealthState>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summary = await executeScript("check_dependencies", {}, false);
        const r = summary.events.find((e) => e.type === "result")?.value as
          | {
              tools?: Record<string, { installed?: boolean; isStudio?: boolean } | undefined>;
            }
          | undefined;
        if (cancelled) return;
        if (!r || !r.tools) {
          setState({
            status: "unknown",
            message: "Kunne ikke kjøre dep-sjekk.",
            missingCritical: [],
            missingOptional: [],
            checked: true,
          });
          return;
        }
        const tools = r.tools;
        const installed = (k: string) => Boolean(tools[k]?.installed);

        const missingCritical: string[] = [];
        const missingOptional: string[] = [];

        if (!installed("brew")) missingCritical.push("Homebrew");
        if (!installed("ffmpeg")) missingCritical.push("ffmpeg");
        if (!installed("ffprobe")) missingCritical.push("ffprobe");
        if (!installed("resolve")) {
          // Resolve missing is critical for the cull/audio/color flow
          missingCritical.push("DaVinci Resolve");
        } else if (tools.resolve?.isStudio === false) {
          // Lite-edition can't do external scripting — flag as critical
          missingCritical.push("Resolve Studio (Lite kan ikke kjøre scripts)");
        }

        if (!installed("fpcalc")) missingOptional.push("chromaprint (audio-fingerprint)");
        if (!installed("anthropic")) missingOptional.push("anthropic (AI cull)");
        if (!installed("whisperx")) missingOptional.push("whisperx (transkripsjon)");
        if (!installed("librosa")) missingOptional.push("librosa (beat-sync)");

        let status: DepHealth;
        let message: string;
        if (missingCritical.length > 0) {
          status = "red";
          message = `Mangler kritisk: ${missingCritical.join(", ")}`;
        } else if (missingOptional.length > 0) {
          status = "amber";
          message = `Klar — men mangler valgfritt: ${missingOptional.join(", ")}`;
        } else {
          status = "green";
          message = "Alle dependencies installert";
        }

        setState({ status, message, missingCritical, missingOptional, checked: true });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "unknown",
          message: e instanceof Error ? e.message : "Kunne ikke kjøre dep-sjekk.",
          missingCritical: [],
          missingOptional: [],
          checked: true,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return { state, refresh: () => setTick((t) => t + 1) };
}
