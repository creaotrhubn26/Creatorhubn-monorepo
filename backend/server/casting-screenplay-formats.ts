/**
 * casting-screenplay-formats.ts
 *
 * Parser/emitter for industri-standard screenplay-formater:
 *   - **Fountain** (Markdown-style — https://fountain.io)
 *   - **FDX** (Final Draft XML — Final Draft 8+)
 *
 * Adresserer pain point fra screenplay-marked: ingen interop mellom
 * verktøy. Skuespillere/produsenter mottar manus i FDX fra Final Draft;
 * skribenter bruker Fountain i Highland/WriterDuet; vårt system må kunne
 * importere fra og eksportere til begge.
 *
 * **MVP-scope** (denne implementasjonen):
 *   - Scene headings (INT./EXT./EST. prefiks)
 *   - Action-blokker
 *   - Karakter-replikker (ALL CAPS følges av dialog)
 *   - Parentetikk
 *   - Transitions (ALL CAPS ending TO:)
 *
 * **Out of scope (dokumentert som TODO):**
 *   - Dual dialogue (Fountain `^`-marker)
 *   - Notes (`/* ... *_/_`)
 *   - Boneyard, lyrics, centered text
 *   - FDX-revisjons-marker
 *   - Title page metadata (full Title/Author/Source/...)
 *
 * **Konvensjon:** ParsedScreenplay-typen er service-intern representasjon.
 * Klienten/frontend kan transformere til vårt scenes/dialogue-entitet-
 * skjema separat. For MVP-er endpoints stateless (parser/emitter); de
 * lagrer ikke direkte i manuscripts-service.
 *
 * Bruker `fast-xml-parser` for FDX. Fountain-parser er custom (linje-
 * basert, ~150 LOC).
 */

import { XMLBuilder, XMLParser } from "fast-xml-parser";

export interface ParsedDialogueLine {
  character: string;
  parenthetical?: string;
  text: string;
  dual?: boolean;
}

export interface ParsedScene {
  heading: string;
  action: string[];
  dialogue: ParsedDialogueLine[];
}

export interface ParsedTransition {
  text: string;
}

export interface ParsedScreenplay {
  title?: string;
  author?: string;
  scenes: ParsedScene[];
  // Transitions oppbevares ved siden — ikke knyttet til scenes-nivå i MVP.
  // For full fidelity bør de embeddes IN ordre med scenes, men det krever
  // en richer sekvens-modell (TODO).
}

// ── Fountain-parser ─────────────────────────────────────────────────

const SCENE_HEADING_RE = /^(INT|EXT|EST|I\/E|INT\/EXT|INT\.\/EXT\.)[.\s]/i;
const TRANSITION_RE = /TO:\s*$/;
const ALL_CAPS_LINE_RE = /^[A-Z0-9 ()&'\-.,]+$/;

/**
 * Parser Fountain-tekst til ParsedScreenplay. Linje-basert.
 *
 * MVP-implementasjon. Håndterer kjerne-elementer; mer avanserte Fountain-
 * features (dual dialogue, notes, lyrics) er TODO.
 */
export function parseFountain(input: string): ParsedScreenplay {
  const lines = input.split(/\r?\n/);
  const screenplay: ParsedScreenplay = { scenes: [] };
  let currentScene: ParsedScene | null = null;
  let pendingCharacter: string | null = null;
  let pendingParenthetical: string | undefined;

  // Title-page (Fountain key/value på toppen, separert med blank-linje fra body)
  let i = 0;
  if (lines.length > 0 && lines[0].includes(":")) {
    while (i < lines.length && lines[i].trim() !== "") {
      const line = lines[i];
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        if (key === "title") screenplay.title = value;
        else if (key === "author" || key === "authors") screenplay.author = value;
      }
      i += 1;
    }
    // Skip blank line(s) etter title-page
    while (i < lines.length && lines[i].trim() === "") i += 1;
  }

  function startScene(heading: string): void {
    currentScene = { heading, action: [], dialogue: [] };
    screenplay.scenes.push(currentScene);
    pendingCharacter = null;
    pendingParenthetical = undefined;
  }

  for (; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      pendingCharacter = null;
      pendingParenthetical = undefined;
      continue;
    }

    // Scene heading
    if (SCENE_HEADING_RE.test(trimmed) || trimmed.startsWith(".")) {
      const heading = trimmed.startsWith(".") ? trimmed.slice(1).trim() : trimmed;
      startScene(heading);
      continue;
    }

    // Hvis ingen scene ennå, behandle som pre-scene action.
    if (!currentScene) {
      startScene("UNTITLED");
    }

    // Transition (ALL CAPS ending in "TO:")
    if (TRANSITION_RE.test(trimmed) && ALL_CAPS_LINE_RE.test(trimmed)) {
      currentScene!.action.push(`> ${trimmed}`);
      continue;
    }

    // Parenthetical (under character/dialogue)
    if (pendingCharacter && trimmed.startsWith("(") && trimmed.endsWith(")")) {
      pendingParenthetical = trimmed.slice(1, -1);
      continue;
    }

    // Character line: ALL CAPS, etterfulgt av non-blank (vil bli dialog)
    const nextLine = lines[i + 1]?.trim() ?? "";
    if (
      ALL_CAPS_LINE_RE.test(trimmed) &&
      trimmed.length >= 2 &&
      nextLine !== "" &&
      !SCENE_HEADING_RE.test(nextLine)
    ) {
      // Strip dual-dialogue ^-marker (TODO: håndter)
      pendingCharacter = trimmed.replace(/\s*\^\s*$/, "").trim();
      pendingParenthetical = undefined;
      continue;
    }

    // Dialogue: forrige linje var character/parenthetical
    if (pendingCharacter) {
      currentScene!.dialogue.push({
        character: pendingCharacter,
        parenthetical: pendingParenthetical,
        text: trimmed,
      });
      pendingParenthetical = undefined;
      // Tillat at samme character snakker over flere linjer — la pendingCharacter ligge
      continue;
    }

    // Resten = action
    currentScene!.action.push(trimmed);
  }

  return screenplay;
}

/**
 * Eksporterer ParsedScreenplay til Fountain-streng. Kanonisk format.
 */
export function exportFountain(screenplay: ParsedScreenplay): string {
  const out: string[] = [];

  if (screenplay.title) {
    out.push(`Title: ${screenplay.title}`);
  }
  if (screenplay.author) {
    out.push(`Author: ${screenplay.author}`);
  }
  if (screenplay.title || screenplay.author) {
    out.push(""); // blank line separating title page from body
  }

  for (const scene of screenplay.scenes) {
    out.push(scene.heading);
    out.push("");

    for (const action of scene.action) {
      out.push(action);
      out.push("");
    }

    for (const dlg of scene.dialogue) {
      out.push(dlg.dual ? `${dlg.character} ^` : dlg.character);
      if (dlg.parenthetical) {
        out.push(`(${dlg.parenthetical})`);
      }
      out.push(dlg.text);
      out.push("");
    }
  }

  return out.join("\n").trim() + "\n";
}

// ── FDX-parser ──────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  allowBooleanAttributes: true,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  format: true,
});

interface FdxParagraph {
  "@Type"?: string;
  Text?: string | { "#text"?: string } | Array<string | { "#text"?: string }>;
}

function readParagraphText(p: FdxParagraph): string {
  if (typeof p.Text === "string") return p.Text;
  if (Array.isArray(p.Text)) {
    return p.Text.map((entry) =>
      typeof entry === "string" ? entry : entry?.["#text"] ?? "",
    ).join("");
  }
  if (p.Text && typeof p.Text === "object") {
    return p.Text["#text"] ?? "";
  }
  return "";
}

/**
 * Parser FDX (Final Draft XML) til ParsedScreenplay.
 */
export function parseFdx(input: string): ParsedScreenplay {
  const parsed = xmlParser.parse(input) as Record<string, unknown>;
  const finalDraft = parsed.FinalDraft as
    | { Content?: { Paragraph?: FdxParagraph | FdxParagraph[] } }
    | undefined;
  const content = finalDraft?.Content;
  const paragraphs: FdxParagraph[] = Array.isArray(content?.Paragraph)
    ? content!.Paragraph
    : content?.Paragraph
      ? [content.Paragraph]
      : [];

  const screenplay: ParsedScreenplay = { scenes: [] };
  let currentScene: ParsedScene | null = null;
  let pendingCharacter: string | null = null;
  let pendingParenthetical: string | undefined;

  for (const p of paragraphs) {
    const type = p["@Type"] ?? "Action";
    const text = readParagraphText(p).trim();
    if (!text) {
      pendingCharacter = null;
      pendingParenthetical = undefined;
      continue;
    }

    if (type === "Scene Heading") {
      currentScene = { heading: text, action: [], dialogue: [] };
      screenplay.scenes.push(currentScene);
      pendingCharacter = null;
      pendingParenthetical = undefined;
      continue;
    }

    if (!currentScene) {
      currentScene = { heading: "UNTITLED", action: [], dialogue: [] };
      screenplay.scenes.push(currentScene);
    }

    if (type === "Character") {
      pendingCharacter = text;
      pendingParenthetical = undefined;
      continue;
    }
    if (type === "Parenthetical") {
      pendingParenthetical = text.replace(/^\(|\)$/g, "");
      continue;
    }
    if (type === "Dialogue") {
      if (pendingCharacter) {
        currentScene.dialogue.push({
          character: pendingCharacter,
          parenthetical: pendingParenthetical,
          text,
        });
        pendingParenthetical = undefined;
      }
      continue;
    }
    if (type === "Transition") {
      currentScene.action.push(`> ${text}`);
      continue;
    }
    // Default: Action og ukjente typer
    currentScene.action.push(text);
  }

  return screenplay;
}

/**
 * Eksporterer ParsedScreenplay til FDX-streng.
 */
export function exportFdx(screenplay: ParsedScreenplay): string {
  const paragraphs: FdxParagraph[] = [];

  for (const scene of screenplay.scenes) {
    paragraphs.push({ "@Type": "Scene Heading", Text: scene.heading });
    for (const action of scene.action) {
      if (action.startsWith("> ")) {
        paragraphs.push({ "@Type": "Transition", Text: action.slice(2) });
      } else {
        paragraphs.push({ "@Type": "Action", Text: action });
      }
    }
    for (const dlg of scene.dialogue) {
      paragraphs.push({ "@Type": "Character", Text: dlg.character });
      if (dlg.parenthetical) {
        paragraphs.push({
          "@Type": "Parenthetical",
          Text: `(${dlg.parenthetical})`,
        });
      }
      paragraphs.push({ "@Type": "Dialogue", Text: dlg.text });
    }
  }

  const xml = xmlBuilder.build({
    "?xml": { "@version": "1.0", "@encoding": "UTF-8" },
    FinalDraft: {
      "@DocumentType": "Script",
      "@Template": "No",
      "@Version": "3",
      Content: { Paragraph: paragraphs },
    },
  });
  return String(xml);
}
