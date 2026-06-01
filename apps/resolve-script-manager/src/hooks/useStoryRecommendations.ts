/**
 * useStoryRecommendations — henter Story Director-anbefalinger fra
 * Claude via post-agent-proxy. Fallback til lokal heuristikk hvis
 * Claude ikke svarer (offline, ikke innlogget, eller test-modus).
 *
 * Strategi:
 *   1. Initial render: vis heuristikk-baserte anbefalinger med en gang
 *      (ingen tom skjerm mens vi venter).
 *   2. useEffect → async claudeProxyService.send() med kompakt brief.
 *   3. Claude svarer JSON med {summary, recommendations[]} → erstatt
 *      heuristikken med Claude-versjonen + sett source="claude".
 *   4. Hvis kallet feiler: behold heuristikken + sett source="fallback".
 *
 * Test-bypass: `window.__POST_AGENT_DISABLE_CLAUDE__ = true` hopper
 * Claude-kallet (brukt av eksisterende Playwright-tester slik at de
 * ikke flakker på nettverk).
 */

import { useEffect, useMemo, useState } from "react";
import type { NarrativePick } from "./useNarrativeStructure";
import type { NarrativeStructure } from "./useNarrativeStructure";
import { claudeProxyService } from "../services/claudeProxyService";

export type RecommendationCategory =
  | "emotion"
  | "variety"
  | "structure"
  | "ending"
  | "pacing";

export interface StoryRecommendation {
  id: string;
  title: string;
  body: string;
  category: RecommendationCategory;
  /** Foreslått antall klipp som anbefalingen gjelder (vises i CTA). */
  actionCount?: number;
}

export interface StoryRecommendationsState {
  recommendations: StoryRecommendation[];
  summary: string;
  source: "heuristic" | "claude" | "fallback";
  loading: boolean;
  error: string | null;
}

interface Opts {
  picks: NarrativePick[];
  structure: NarrativeStructure;
  /** Brief om prosjektet — Claude bruker dette for ton + språk. */
  projectBrief?: {
    type: string; // "Bryllup" | "Music Video" | …
    intent?: string; // f.eks. "Cinematic / Emotional"
  };
}

export function useStoryRecommendations({
  picks,
  structure,
  projectBrief,
}: Opts): StoryRecommendationsState {
  const heuristic = useMemo(
    () => buildHeuristicRecommendations(picks, structure),
    [picks, structure],
  );

  const [state, setState] = useState<StoryRecommendationsState>({
    recommendations: heuristic.recommendations,
    summary: heuristic.summary,
    source: "heuristic",
    loading: false,
    error: null,
  });

  useEffect(() => {
    // Hold heuristikken oppdatert som baseline mens vi venter på Claude.
    setState((prev) => ({
      ...prev,
      recommendations:
        prev.source === "claude" ? prev.recommendations : heuristic.recommendations,
      summary: prev.source === "claude" ? prev.summary : heuristic.summary,
    }));
  }, [heuristic]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const flag = (window as { __POST_AGENT_DISABLE_CLAUDE__?: boolean })
        .__POST_AGENT_DISABLE_CLAUDE__;
      if (flag) return; // Test-modus: hold på heuristikken
    }

    if (picks.length === 0) return; // Ingenting å si til Claude

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const brief = compactProjectBrief({ picks, structure, projectBrief });
        const text = await claudeProxyService.send({
          systemPrompt: STORY_DIRECTOR_SYSTEM_PROMPT,
          messages: [{ role: "user", content: brief }],
          maxTokens: 1200,
        });
        if (cancelled) return;
        const parsed = parseClaudeResponse(text);
        if (parsed) {
          setState({
            recommendations: parsed.recommendations,
            summary: parsed.summary,
            source: "claude",
            loading: false,
            error: null,
          });
        } else {
          setState({
            recommendations: heuristic.recommendations,
            summary: heuristic.summary,
            source: "fallback",
            loading: false,
            error: "Klarte ikke tolke Claude-respons — viser heuristikk.",
          });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          recommendations: heuristic.recommendations,
          summary: heuristic.summary,
          source: "fallback",
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Refetch når picks-count, beat-fordeling eller prosjekt-type endrer seg
    // — ikke på hver re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    picks.length,
    structure.beats.map((b) => `${b.id}:${b.picks.length}`).join(","),
    projectBrief?.type,
    projectBrief?.intent,
  ]);

  return state;
}

const STORY_DIRECTOR_SYSTEM_PROMPT = `Du er Story Director for Post Agent — en AI-assistent som hjelper videografer skape sterkere historier.

Du leverer 2-4 KONKRETE, HANDLINGSORIENTERTE anbefalinger basert på det filmskaperen allerede har klippet. Du holder tonen varm og presis — ikke generisk, ikke svulstig.

Du SVARER ALLTID kun med gyldig JSON i dette skjemaet, uten markdown-kode-fence:

{
  "summary": "1 setning som oppsummerer det sterkeste ved historien",
  "recommendations": [
    {
      "id": "kort-stable-slug",
      "title": "kort tittel (3-5 ord)",
      "body": "1-2 setninger om HVA + HVORFOR",
      "category": "emotion" | "variety" | "structure" | "ending" | "pacing",
      "actionCount": valgfritt tall som antyder antall klipp
    }
  ]
}

Skriv på norsk bokmål. Aldri inkluder backticks, kode-fence eller forklaring utenfor JSON.`;

function compactProjectBrief(opts: Opts): string {
  const { picks, structure, projectBrief } = opts;
  const beatSummary = structure.beats
    .map((b) => `${b.id}(${b.picks.length})`)
    .join(", ");
  const energyByBeat = structure.beats
    .map((b) => {
      const avg =
        b.picks.length === 0
          ? 0
          : b.picks.reduce((s, p) => s + p.score, 0) / b.picks.length;
      return `${b.id}=${avg.toFixed(2)}`;
    })
    .join(", ");
  const chapterCounts = new Map<string, number>();
  for (const p of picks) {
    const ch = p.chapter ?? "—";
    chapterCounts.set(ch, (chapterCounts.get(ch) ?? 0) + 1);
  }
  const chapterList = Array.from(chapterCounts.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return [
    `Prosjekt-type: ${projectBrief?.type ?? "ukjent"}`,
    projectBrief?.intent ? `Intent: ${projectBrief.intent}` : "",
    `Total picks: ${picks.length}`,
    `Total varighet: ${structure.totalDuration.toFixed(0)}s`,
    `Beat-fordeling (antall picks): ${beatSummary}`,
    `Gjennomsnittsscore pr beat: ${energyByBeat}`,
    `Picks pr chapter: ${chapterList}`,
    "",
    "Gi 2-4 anbefalinger som gjør historien sterkere. Husk: kun JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseClaudeResponse(
  raw: string,
): { summary: string; recommendations: StoryRecommendation[] } | null {
  // Tillat at Claude pakket JSON i ```json … ``` selv om vi ba om uten.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as {
      summary?: string;
      recommendations?: Array<{
        id?: string;
        title?: string;
        body?: string;
        category?: string;
        actionCount?: number;
      }>;
    };
    if (!Array.isArray(parsed.recommendations)) return null;
    const recs: StoryRecommendation[] = parsed.recommendations
      .filter((r) => r.title && r.body)
      .slice(0, 4)
      .map((r, i) => ({
        id: r.id?.trim() || `claude-${i}`,
        title: String(r.title),
        body: String(r.body),
        category: normalizeCategory(r.category),
        actionCount: typeof r.actionCount === "number" ? r.actionCount : undefined,
      }));
    if (recs.length === 0) return null;
    return {
      summary: parsed.summary?.trim() || "Historien din har en sterk struktur",
      recommendations: recs,
    };
  } catch {
    return null;
  }
}

function normalizeCategory(raw: string | undefined): RecommendationCategory {
  const c = (raw ?? "").toLowerCase();
  if (c === "emotion" || c === "variety" || c === "structure" || c === "ending" || c === "pacing") {
    return c;
  }
  return "structure";
}

interface HeuristicResult {
  summary: string;
  recommendations: StoryRecommendation[];
}

function buildHeuristicRecommendations(
  picks: NarrativePick[],
  structure: NarrativeStructure,
): HeuristicResult {
  if (picks.length === 0) {
    return { summary: "Velg footage for å starte", recommendations: [] };
  }

  const recs: StoryRecommendation[] = [];

  const peakBeat = structure.beats.find((b) => b.id === "peak");
  if (peakBeat && peakBeat.picks.length < 3) {
    recs.push({
      id: "more-breathing-before-peak",
      title: "Mer pust før peak",
      body:
        "Vurder å gjøre delen før peak litt roligere. Et ekstra reaksjons-klipp vil gjøre toppen mer effektfull.",
      category: "pacing",
      actionCount: 3,
    });
  }

  const faceSignals = picks.filter(
    (p) => ((p.signals?.faces as number | undefined) ?? 0) > 0.5,
  ).length;
  if (faceSignals < picks.length * 0.3) {
    recs.push({
      id: "parent-reactions",
      title: "Reaksjon fra mennesker",
      body:
        "Du har fine atmosfære-klipp, men mangler ansiktsreaksjoner. Dette vil forsterke emosjonen.",
      category: "emotion",
    });
  }

  const outro = structure.beats.find((b) => b.id === "outro");
  if (!outro || outro.picks.length < 2) {
    recs.push({
      id: "stronger-outro",
      title: "Sterkere avslutning",
      body:
        "Avslutningen kan bygge ut følelsen litt mer. Et siste atmosfærisk øyeblikk vil gi en fin etterklang.",
      category: "ending",
      actionCount: 2,
    });
  }

  const uniqueChapters = new Set(picks.map((p) => p.chapter ?? "—")).size;
  if (uniqueChapters < 4) {
    recs.push({
      id: "more-variety",
      title: "Mer variasjon i shots",
      body:
        "Historien lener seg på samme type klipp. Legg til detaljbilder eller bredere atmosfære-shots.",
      category: "variety",
    });
  }

  return {
    summary: "Historien din har en sterk emosjonell bue",
    recommendations: recs.slice(0, 3),
  };
}
