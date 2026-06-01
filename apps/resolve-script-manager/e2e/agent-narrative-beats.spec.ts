/**
 * Data-validerings-spec: verifiserer at alle agent-konfigene har
 * `narrativeBeat` på chapters slik at Story-fanen senere kan rendres
 * generisk inn i AgentEditorView uten å falle tilbake på `inferBeat`-
 * heuristikken.
 *
 * Kjøres i Node-context (ingen browser) for å unngå Vite/MUI-loading
 * når vi bare validerer ren data.
 */

import { test, expect } from "@playwright/test";
import MUSIC_VIDEO from "../src/agents/music_video";
import CORPORATE from "../src/agents/corporate";
import EVENT from "../src/agents/event";
import DOCUMENTARY from "../src/agents/documentary";
import SCREEN_RECORDING from "../src/agents/screen_recording";
import PODCAST from "../src/agents/podcast";
import SHORT_FILM from "../src/agents/short_film";
import type { AgentConfig } from "../src/agents/types";

const VALID_BEATS = new Set(["hook", "setup", "build", "peak", "celebration", "outro"]);

const ALL_AGENTS: AgentConfig[] = [
  MUSIC_VIDEO,
  CORPORATE,
  EVENT,
  DOCUMENTARY,
  SCREEN_RECORDING,
  PODCAST,
  SHORT_FILM,
];

test.describe("Agent narrative-beat data", () => {
  for (const cfg of ALL_AGENTS) {
    test(`${cfg.kind}: minst én chapter pr universal-beat-fase (hook/build/peak/outro)`, () => {
      const beats = new Set(
        cfg.chapters.map((c) => c.narrativeBeat).filter((b): b is string => Boolean(b)),
      );
      // Minimum-krav: en story må ha en åpning (hook), et hovedinnhold (build
      // eller peak), og en avslutning (outro). Setup/celebration er valgfrie
      // — ikke alle prosjekttyper har en celebration-fase (f.eks. screen-rec).
      expect(beats, `agent ${cfg.kind} mangler hook`).toContain("hook");
      expect(
        beats.has("build") || beats.has("peak"),
        `agent ${cfg.kind} mangler build/peak`,
      ).toBe(true);
      expect(beats, `agent ${cfg.kind} mangler outro`).toContain("outro");
    });

    test(`${cfg.kind}: alle narrativeBeat-verdier er gyldige UniversalBeats`, () => {
      const invalid = cfg.chapters
        .map((c) => c.narrativeBeat)
        .filter((b): b is string => Boolean(b))
        .filter((b) => !VALID_BEATS.has(b));
      expect(invalid).toEqual([]);
    });

    test(`${cfg.kind}: minst 80% av chapters har explicit narrativeBeat`, () => {
      const total = cfg.chapters.length;
      const mapped = cfg.chapters.filter((c) => c.narrativeBeat).length;
      const ratio = mapped / total;
      expect(ratio).toBeGreaterThanOrEqual(0.8);
    });
  }
});
