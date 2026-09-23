/**
 * SenseAid Explore, pakke 3 «spørsmål underveis» (Daniel 23.09.2026): ren
 * logikk for innslagene som vises midt i et kapittel av fortellingen, uten
 * Express og uten database. Rutene i reiseguide-routes.ts legger dem på hvert
 * fortellingskapittel som `prompts`.
 *
 * Datamodell: migrations/0662_reiseguide_chapter_prompts.sql.
 *   look  = «Se opp: …»; avspillingen fortsetter.
 *   guess = gjettespørsmål; appen pauser, viser alternativene og så fasit.
 * atFraction er posisjonen i kapittelet (0 ≤ x < 1); appen ganger med varigheten.
 */

export type ChapterPromptKind = "look" | "guess";

export interface ChapterPromptRow {
  id: string;
  poi_id: string;
  lang: string;
  chapter_no: number;
  kind: string;
  /** NUMERIC kommer som tekst fra pg. */
  at_fraction: number | string;
  prompt_text: string;
  options: unknown;
  answer_index: number | null;
  reveal_text: string | null;
  sort_order: number;
}

export interface ChapterPromptView {
  id: string;
  kind: ChapterPromptKind;
  atFraction: number;
  text: string;
  /** 2–4 alternativer for guess, ellers null. */
  options: string[] | null;
  /** Fasit (indeks i options) for guess, ellers null. */
  answerIndex: number | null;
  revealText: string | null;
}

function toFraction(value: number | string): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : null;
}

/** Én rad til visning; null når raden er ugyldig (skal ikke skje med CHECK-ene i 0662). */
export function chapterPromptView(row: ChapterPromptRow): ChapterPromptView | null {
  const atFraction = toFraction(row.at_fraction);
  const text = typeof row.prompt_text === "string" ? row.prompt_text.trim() : "";
  if (atFraction == null || text === "") return null;
  const revealText = row.reveal_text?.trim() ? row.reveal_text.trim() : null;

  if (row.kind === "look") {
    return { id: row.id, kind: "look", atFraction, text, options: null, answerIndex: null, revealText };
  }
  if (row.kind === "guess") {
    const options = Array.isArray(row.options)
      ? row.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : [];
    const answerIndex = row.answer_index;
    if (options.length < 2 || options.length > 4) return null;
    if (answerIndex == null || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return null;
    }
    return { id: row.id, kind: "guess", atFraction, text, options, answerIndex, revealText };
  }
  return null;
}

/**
 * Innslagene for ett kapittel på ett språk, i rekkefølge (sort_order, så posisjon).
 * Ugyldige rader hoppes over så ett dårlig innslag aldri velter hele svaret.
 */
export function buildChapterPrompts(
  rows: ChapterPromptRow[],
  poiId: string,
  lang: string,
  chapterNo: number,
): ChapterPromptView[] {
  return rows
    .filter((r) => r.poi_id === poiId && r.lang.toLowerCase() === lang && r.chapter_no === chapterNo)
    .sort((a, b) => a.sort_order - b.sort_order || Number(a.at_fraction) - Number(b.at_fraction))
    .flatMap((r) => {
      const view = chapterPromptView(r);
      return view ? [view] : [];
    });
}
