/**
 * StoryTestHarness — minimal mounting av StoryView for Playwright e2e.
 *
 * Bruker `window.__POST_AGENT_TEST_PICKS__` som datakilde (injectes
 * av Playwright via `installTauriMock` før React monteres). Hopper
 * over hele CreativeEditorView-mounting (som krever Resolve-state,
 * picks-fil-load, mange Tauri-kommandoer) — vi tester KUN Story-
 * fanens UI/struktur.
 *
 * Replikerer den samme aktivTab="story"-grenen som CreativeEditorView
 * gjør, men med direkte mock-data.
 */

import { useState } from "react";
import { StoryView } from "./StoryView";
import type { ChapterDef } from "../../agents/types";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";

const WEDDING_CHAPTERS_FOR_STORY: ChapterDef[] = [
  { id: "forberedelser", label: "Forberedelser", description: "", priorityHint: "atmospheric", narrativeBeat: "hook" },
  { id: "details", label: "Detaljer", description: "", priorityHint: "atmospheric", narrativeBeat: "setup" },
  { id: "first-look", label: "Første blikk", description: "", priorityHint: "emotional-peak", narrativeBeat: "build" },
  { id: "ceremony", label: "Vielse", description: "", priorityHint: "emotional-peak", narrativeBeat: "peak" },
  { id: "speeches", label: "Taler", description: "", priorityHint: "emotional-peak", narrativeBeat: "celebration" },
  { id: "dance", label: "Første dans", description: "", priorityHint: "high-energy", narrativeBeat: "celebration" },
  { id: "party", label: "Fest", description: "", priorityHint: "high-energy", narrativeBeat: "celebration" },
  { id: "outro", label: "Avslutning", description: "", priorityHint: "atmospheric", narrativeBeat: "outro" },
];

const FALLBACK_PICKS: NarrativePick[] = [
  { index: 0, startSec: 0, endSec: 8, durationSec: 8, score: 0.7, chapter: "forberedelser", signals: { faces: 0.6, bokeh: 0.5 } },
  { index: 1, startSec: 8, endSec: 16, durationSec: 8, score: 0.65, chapter: "details", signals: { bokeh: 0.8 } },
  { index: 2, startSec: 16, endSec: 28, durationSec: 12, score: 0.8, chapter: "first-look", signals: { faces: 0.8, emotional_peak: 0.7 } },
  { index: 3, startSec: 28, endSec: 45, durationSec: 17, score: 0.95, chapter: "ceremony", signals: { emotional_peak: 0.95, faces: 0.9 } },
  { index: 4, startSec: 45, endSec: 75, durationSec: 30, score: 0.85, chapter: "speeches", signals: { audio_events: 0.8, faces: 0.7 } },
  { index: 5, startSec: 75, endSec: 110, durationSec: 35, score: 0.9, chapter: "dance", signals: { action: 0.85, audio_events: 0.9 } },
  { index: 6, startSec: 110, endSec: 140, durationSec: 30, score: 0.75, chapter: "party", signals: { action: 0.7, audio_events: 0.95 } },
  { index: 7, startSec: 140, endSec: 165, durationSec: 25, score: 0.7, chapter: "outro", signals: { bokeh: 0.8, slowmo: 0.6 } },
];

export function StoryTestHarness() {
  const payload = (window as unknown as {
    __POST_AGENT_TEST_PICKS__?: { picks: NarrativePick[] };
  }).__POST_AGENT_TEST_PICKS__;
  const picks: NarrativePick[] = payload?.picks ?? FALLBACK_PICKS;
  const [focused, setFocused] = useState<number | null>(picks[0]?.index ?? null);
  const [tab, setTab] = useState<"rediger" | "story">("story");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0b0b12", color: "#e5e5ea" }}>
      <div className="ce-tabs" style={{ display: "flex", gap: 12, padding: "10px 18px", borderBottom: "1px solid #2a2a36" }}>
        <button
          className={`ce-tab ${tab === "rediger" ? "active" : ""}`}
          onClick={() => setTab("rediger")}
          style={{
            background: "transparent",
            border: 0,
            color: tab === "rediger" ? "#e5e5ea" : "#7b7b8d",
            fontSize: 13,
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: tab === "rediger" ? "2px solid #a78bfa" : "2px solid transparent",
          }}
        >
          Rediger
        </button>
        <button
          className={`ce-tab ${tab === "story" ? "active" : ""}`}
          onClick={() => setTab("story")}
          style={{
            background: "transparent",
            border: 0,
            color: tab === "story" ? "#e5e5ea" : "#7b7b8d",
            fontSize: 13,
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: tab === "story" ? "2px solid #a78bfa" : "2px solid transparent",
          }}
        >
          Story
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "story" ? (
          <StoryView
            picks={picks}
            chapters={WEDDING_CHAPTERS_FOR_STORY}
            focusedPickIndex={focused}
            onFocusPick={setFocused}
            projectInfo={{
              project: "Emma & Jonas — Bryllup",
              client: "Emma & Jonas",
              duration: "02:30 – 03:00",
              format: "16:9 (FHD)",
              created: "14. mai 2024",
              updated: "i dag, 14:32",
            }}
            onBackToProject={() => {}}
            onStartEditing={() => setTab("rediger")}
          />
        ) : (
          <div data-testid="rediger-placeholder" style={{ padding: 20, color: "#7b7b8d" }}>
            (Rediger-fanen vises her i prod-app — utenfor test-scope)
          </div>
        )}
      </div>
    </div>
  );
}
