/**
 * templateArtDirector — Phase 3 av AI-to-editable-PSD-pipelinen.
 *
 * Tar et fri-tekst brukerprompt og konverterer det til en strukturert
 * JSON-spec som beskriver hele templatet (dimensjoner, palette, fonts,
 * felter, image-prompts). Claude opptrer som "art director" — tar
 * estetiske valg du som bruker ellers måtte tatt manuelt.
 *
 * Spec'en kan deretter mates inn i:
 *   - template.scaffold (Phase 1) for å bygge PSD med text- og
 *     image_placeholder-layers
 *   - ai_generate_image (Phase 2) for å fylle hver image_prompt
 *
 * Phase 4 wire'r alt sammen i én knapp; Phase 3 leverer fundamentet.
 */

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Spec-typen som Claude returnerer
// ---------------------------------------------------------------------------

export type ImageSize =
  | "square_hd"
  | "portrait_16_9"
  | "landscape_16_9"
  | "portrait_4_3"
  | "landscape_4_3";

export interface TemplateField {
  key: string;
  type: "text" | "image_placeholder";
  hint?: string;
  /** For image_placeholder: hvilken AI-prompt skal brukes for å generere bildet. */
  image_prompt?: string;
  /** Foreslått størrelse på AI-generert bilde. */
  image_size?: ImageSize;
  /** Foreslåtte koordinater + størrelse i pixels. */
  x?: number;
  y?: number;
  font_size?: number;
}

export interface TemplateSpec {
  name: string;
  /** Format-rasjonale på norsk slik at brukeren forstår valgene. */
  rationale: string;
  width: number;
  height: number;
  background_color: { red: number; green: number; blue: number };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  fields: TemplateField[];
}

// ---------------------------------------------------------------------------
// System-prompt + tool-definition
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du er Art Director for Post Agent — en spesialisert AI som tar en brukers fri-tekst beskrivelse av hva slags grafikk de trenger, og konverterer det til en strukturert JSON-spec som beskriver en redigerbar Photoshop-template.

Brukerens bakgrunn: profesjonelle dansere/kreatører som trenger promo-materiell (plakater, social media, audition-flyers, time-planer).

Designprinsipper du følger:

1. **Aspect ratio**: matcher bruksområdet (Instagram-post: 1080×1080, Instagram-story / poster: 1080×1920, Facebook: 1200×630, kvadrat-card: 1080×1350). Velg det som matcher beskrivelsen.

2. **Palette**: 3 farger som hører sammen. Beskriv mood-en (mørk + dramatisk, lys + luftig, varm + organisk, etc.). Bakgrunnsfargen settes RGB.

3. **Fonts**: foreslå 2 — én for heading (display, expressive), én for body (readable, sans-serif). Bruk vanlige fonts som finnes i Photoshop default: Helvetica, Arial, Georgia, Times New Roman. ALDRI foreslå custom-fonts vi ikke vet finnes.

4. **Layout**: plasser text-layers vertikalt i logisk lese-rekkefølge. Heading øverst, secondary midt, smådetaljer nederst. Smart-object-layers (bilder) bør være de første som lages så de havner under text i layer-stacken.

5. **Image-prompts**: For hver image_placeholder, skriv et detaljert prompt på engelsk som beskriver: motiv, lyssetning, stil, mood. Lengde 15-30 ord. ALDRI nevn navngitte personer eller copyright-merker. Detaljnivå: "Dramatic contemporary dancer mid-leap, dark backdrop, blue spotlight from above, photojournalistic style, sharp focus on hands and face" — IKKE "Dance photo".

6. **Felt-navn (key)**: lowercase, underscores (title, subtitle, hero_image, venue_date). Bruk semantiske navn, IKKE generiske som "text_1" / "image_2".

Du MÅ kalle generate_template_spec-toolen. Ikke svar med plain text. Hvis brukerens prompt er uklar (mangler kontekst som "hva slags forestilling?"), still oppfølgings-spørsmål FØR du kaller toolen.`;

const TOOL_DEFINITION = {
  name: "generate_template_spec",
  description:
    "Generer en fullstendig JSON-spec som beskriver en redigerbar Photoshop-template. Inkluderer dimensjoner, fargepalett, fonts, text-felter, smart-object-felter med image-prompts.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Kort beskrivende navn på templatet (3-5 ord)",
      },
      rationale: {
        type: "string",
        description: "1-2 setninger på norsk som forklarer designvalgene",
      },
      width: {
        type: "integer",
        description: "Bredde i pixels — typisk 1080, 1200 eller 1920",
      },
      height: {
        type: "integer",
        description: "Høyde i pixels",
      },
      background_color: {
        type: "object",
        properties: {
          red: { type: "integer", minimum: 0, maximum: 255 },
          green: { type: "integer", minimum: 0, maximum: 255 },
          blue: { type: "integer", minimum: 0, maximum: 255 },
        },
        required: ["red", "green", "blue"],
      },
      palette: {
        type: "object",
        properties: {
          primary: { type: "string", description: "Hex-farge, f.eks. #1a1a2e" },
          secondary: { type: "string" },
          accent: { type: "string" },
        },
        required: ["primary", "secondary", "accent"],
      },
      fonts: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Photoshop default-font" },
          body: { type: "string" },
        },
        required: ["heading", "body"],
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "lowercase_with_underscores, semantic name",
            },
            type: { type: "string", enum: ["text", "image_placeholder"] },
            hint: {
              type: "string",
              description: "Placeholder-tekst for text-felter (vises i layeren)",
            },
            image_prompt: {
              type: "string",
              description: "For image_placeholder: detaljert engelsk prompt for AI image generation",
            },
            image_size: {
              type: "string",
              enum: ["square_hd", "portrait_16_9", "landscape_16_9", "portrait_4_3", "landscape_4_3"],
              description: "For image_placeholder: foreslått størrelse",
            },
            x: { type: "integer", description: "Foreslått x-posisjon (pixels)" },
            y: { type: "integer" },
            font_size: { type: "integer", description: "For text: font-størrelse i points" },
          },
          required: ["key", "type"],
        },
      },
    },
    required: ["name", "rationale", "width", "height", "background_color", "palette", "fonts", "fields"],
  },
} as const;

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

interface ClaudeContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ClaudeResponse {
  content: ClaudeContentBlock[];
  stop_reason?: string;
}

/**
 * Tar en bruker-prompt og kaller Claude (som art director) for å få en
 * ferdig spec. Kaster om Claude svarer med follow-up-questions i stedet
 * for et tool-call — UI-laget kan da rendre teksten og la brukeren
 * svare.
 */
export async function generateTemplateSpec(userPrompt: string): Promise<
  | { kind: "spec"; spec: TemplateSpec }
  | { kind: "question"; text: string }
> {
  const response = await invoke<ClaudeResponse>("claude_chat", {
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT,
    model: "claude-opus-4-7",
    maxTokens: 2048,
    tools: [TOOL_DEFINITION],
  });

  // Let etter tool_use i responsen
  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "generate_template_spec",
  );
  if (toolUse?.input) {
    return { kind: "spec", spec: toolUse.input as unknown as TemplateSpec };
  }

  // Hvis ikke tool-call: trolig follow-up spørsmål
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (text) {
    return { kind: "question", text };
  }

  throw new Error("Claude returnerte verken tool-call eller tekst");
}
