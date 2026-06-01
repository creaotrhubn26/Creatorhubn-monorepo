/**
 * useNarrativeStructure — deriverer Story-fanens narrative struktur
 * fra det som ALLEREDE finnes i CreativeEditorView-state (picks +
 * chapters + signals). Ingen ny persistens — ren projeksjon.
 *
 * Gir Story-fanen samme universelle struktur uavhengig av prosjekt-
 * type: bryllup, dans-forestilling, dokumentar, corporate, music-video.
 * Hver type-spesifikke ChapterDef mapper til én av 5-6 universelle
 * beats (hook / setup / build / peak / celebration / outro).
 */

import { useMemo } from "react";
import type { ChapterDef } from "../agents/types";

/**
 * Minimal Pick-shape som Story-fanen trenger. Mappper 1:1 mot Pick
 * brukt i HighlightReviewView + CreativeEditorView, men eksporteres
 * her så Story-komponenter slipper å duplisere typen.
 */
export interface NarrativePick {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  chapter?: string;
  thumbnailPath?: string;
  signals?: Record<string, number | undefined>;
}

export type UniversalBeat =
  | "hook"
  | "setup"
  | "build"
  | "peak"
  | "celebration"
  | "outro";

export interface NarrativeBeat {
  id: UniversalBeat;
  label: string;
  description: string;
  startSec: number;
  endSec: number;
  picks: NarrativePick[];
  /** Foreslått tekstlig oppsummering (auto-generert fra picks + chapter). */
  hint: string;
  /** Hvilke chapter-ID-er fra prosjekt-typen som mapper hit. */
  sourceChapters: string[];
}

export interface NarrativeStructure {
  beats: NarrativeBeat[];
  totalDuration: number;
  arcPoints: { tNorm: number; energy: number; pickIndex: number }[];
}

const UNIVERSAL_BEATS: Record<UniversalBeat, { label: string; description: string }> = {
  hook: {
    label: "Hook / Intro",
    description: "Introdusér karakterene og setningen",
  },
  setup: {
    label: "Oppbygging",
    description: "Bygger forventning og etablerer relasjoner",
  },
  build: {
    label: "Stigende handling",
    description: "Spenning og emosjon bygger seg opp",
  },
  peak: {
    label: "Emosjonelt peak",
    description: "Det viktigste øyeblikket — dagens høydepunkt",
  },
  celebration: {
    label: "Feiring",
    description: "Fellesskap, taler og dans",
  },
  outro: {
    label: "Avslutning / Etterklang",
    description: "Rolig avrunding og vakre øyeblikk",
  },
};

/**
 * Fallback-mapping når ChapterDef ikke har explicit `narrativeBeat`.
 * Bruker `priorityHint` som heuristikk for å plassere i et rimelig beat.
 */
function inferBeat(chapter: ChapterDef | undefined, position: number, totalChapters: number): UniversalBeat {
  if (chapter?.narrativeBeat) return chapter.narrativeBeat;
  const hint = chapter?.priorityHint;
  // Heuristikk på posisjon hvis ingen eksplisitt mapping
  const ratio = position / Math.max(totalChapters, 1);
  if (ratio < 0.15) return "hook";
  if (ratio < 0.4) return "setup";
  if (hint === "emotional-peak" || hint === "high-energy") {
    if (ratio < 0.7) return "peak";
    return "celebration";
  }
  if (ratio < 0.7) return "build";
  if (ratio < 0.9) return "celebration";
  return "outro";
}

export function useNarrativeStructure(
  picks: NarrativePick[],
  chapters: ChapterDef[],
): NarrativeStructure {
  return useMemo(() => {
    if (picks.length === 0) {
      return { beats: [], totalDuration: 0, arcPoints: [] };
    }

    // Bygg chapter-lookup
    const chaptersById = new Map(chapters.map((c) => [c.id, c]));

    // Beat-buckets
    const buckets = new Map<UniversalBeat, { picks: NarrativePick[]; sourceChapters: Set<string> }>();
    chapters.forEach((c, i) => {
      const beat = inferBeat(c, i, chapters.length);
      if (!buckets.has(beat)) {
        buckets.set(beat, { picks: [], sourceChapters: new Set() });
      }
      buckets.get(beat)!.sourceChapters.add(c.id);
    });

    // Plasser picks i deres beat basert på chapter
    for (const p of picks) {
      const chapterId = p.chapter ?? "";
      const chapter = chaptersById.get(chapterId);
      const beat = chapter
        ? inferBeat(chapter, chapters.findIndex((c) => c.id === chapterId), chapters.length)
        : inferBeat(undefined, 0, 1);
      if (!buckets.has(beat)) {
        buckets.set(beat, { picks: [], sourceChapters: new Set() });
      }
      buckets.get(beat)!.picks.push(p);
    }

    // Tidssortér picks per bucket
    const orderedBeats: UniversalBeat[] = [
      "hook",
      "setup",
      "build",
      "peak",
      "celebration",
      "outro",
    ];

    let cursor = 0;
    const beats: NarrativeBeat[] = [];
    for (const beatId of orderedBeats) {
      const bucket = buckets.get(beatId);
      if (!bucket || bucket.picks.length === 0) continue;
      const sortedPicks = [...bucket.picks].sort((a, b) => a.startSec - b.startSec);
      const startSec = cursor;
      const beatDuration = sortedPicks.reduce(
        (sum, p) => sum + p.durationSec,
        0,
      );
      const endSec = startSec + beatDuration;
      beats.push({
        id: beatId,
        label: UNIVERSAL_BEATS[beatId].label,
        description: UNIVERSAL_BEATS[beatId].description,
        startSec,
        endSec,
        picks: sortedPicks,
        hint: generateBeatHint(beatId, sortedPicks, Array.from(bucket.sourceChapters), chaptersById),
        sourceChapters: Array.from(bucket.sourceChapters),
      });
      cursor = endSec;
    }

    const totalDuration = cursor;

    // Story arc-punkter (energi 0..1) — én per pick, normalisert til total varighet
    const arcPoints = beats
      .flatMap((b) =>
        b.picks.map((p) => ({
          tNorm: 0,
          energy: computeEnergyForPick(p),
          pickIndex: p.index,
        })),
      )
      .map((point, i, arr) => ({
        ...point,
        tNorm: arr.length > 1 ? i / (arr.length - 1) : 0.5,
      }));

    return { beats, totalDuration, arcPoints };
  }, [picks, chapters]);
}

function generateBeatHint(
  beat: UniversalBeat,
  picks: NarrativePick[],
  chapterIds: string[],
  chaptersById: Map<string, ChapterDef>,
): string {
  const labels = chapterIds
    .map((id) => chaptersById.get(id)?.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const baseHint = UNIVERSAL_BEATS[beat].description;
  if (labels) {
    return `${baseHint}. Inneholder: ${labels}.`;
  }
  return `${baseHint}. ${picks.length} klipp.`;
}

function computeEnergyForPick(p: NarrativePick): number {
  // Speil eksisterende storyArcPoints-beregning i CreativeEditorView:1251.
  // Energi basert på en blanding av signals.
  const s = p.signals ?? {};
  const e =
    (((s.emotional_peak as number | undefined) ?? 0) * 0.35) +
    (((s.action as number | undefined) ?? 0) * 0.2) +
    (((s.audio_events as number | undefined) ?? 0) * 0.15) +
    (((s.faces as number | undefined) ?? 0) * 0.1) +
    (((s.slowmo as number | undefined) ?? 0) * 0.1) +
    (((s.pose as number | undefined) ?? 0) * 0.1);
  return Math.max(0, Math.min(1, e));
}
