/**
 * fireflyPromptHelper — genererer best-practice Firefly-prompts for
 * `gen.fill` og `gen.expand` (Photoshop 2024+).
 *
 * To strategier:
 *   - **suggestPromptsLocal**: deterministic template-basert. Bruker
 *     curatede mønstre etter intent + kontekst. Ingen nettverkskall —
 *     fungerer offline og i tester.
 *   - **suggestPromptsViaClaude**: sender brief til claudeProxyService
 *     med spesialisert system-prompt → Claude analyserer kontekst og
 *     returnerer 3 målrettede prompts med rasjonale. Brukes når
 *     local-templates ikke gir nok presisjon.
 *
 * Best-practice-prinsippene som ligger bak begge:
 *   1. Specific over generic ("rolling hills, golden hour" > "nice bg")
 *   2. Inkluder lighting, colors, mood, style i samme prompt
 *   3. Unngå negativt språk ("lush forest" vs "no buildings")
 *   4. Hold under 30 ord — Firefly responderer best på kompakte
 *   5. For Expand: beskriv det som er ALLEREDE i bildet ("continuation
 *      of …") så modellen ekstrapolerer, ikke divergerer
 *   6. For Remove (gen.fill med tom prompt): la Firefly auto-fill
 *   7. For Replace: presis subjekt + lighting + style
 */

import { claudeProxyService } from "../services/claudeProxyService";
import type {
  AppInfo,
  LayerListResult,
  SelectionInfoResult,
} from "../services/photoshopBridgeService";

export type FireflyIntent =
  | "expand_background"
  | "remove_object"
  | "replace_background"
  | "add_element"
  | "fix_edges"
  | "stylize"
  | "generate_subject";

export interface FireflyContext {
  /** Type scene — hjelper modellen å lokke fram riktig lighting/komposisjon. */
  scene_type?:
    | "portrait" | "landscape" | "product" | "interior" | "event"
    | "wedding" | "studio" | "outdoor" | "urban";
  /** Stil-tags som "cinematic", "natural", "vibrant", "moody", "warm". */
  style_tags?: string[];
  /** Lyssetting hvis kjent — Firefly bruker dette mye. */
  lighting?: string;
  /** Tid på dagen — påvirker farger og atmosfære. */
  time_of_day?: "morning" | "midday" | "golden_hour" | "blue_hour" | "night";
  /** Aspect/format som hjelper modellen å komponere riktig. */
  target_aspect?: string;
  /** Fri-tekst bruker-intent (det de "vil oppnå"). */
  user_intent?: string;
  /** Frivillig beskrivelse av eksisterende innhold (subjekt i bildet). */
  subject_description?: string;
}

export interface FireflyPromptSuggestion {
  prompt: string;
  rationale: string;
  /** Hvilken intent denne prompten passer til. */
  fits: FireflyIntent;
}

// ---------------------------------------------------------------------------
// Kontekst-ekstraksjon fra Photoshop-state
// ---------------------------------------------------------------------------

/**
 * Les `app.info`-responsen og bygg en FireflyContext med så mye auto-
 * utledet informasjon som mulig. Dialog-en kan bruke dette som
 * forhåndsutfylling før brukeren manuelt korrigerer.
 *
 * Hva som auto-utledes per nå:
 *   - target_aspect: fra active doc width/height (nærmeste standard-ratio
 *     hvis det finnes, ellers den faktiske ratioen)
 *   - scene_type: hint fra document name (matcher mot kjente nøkkelord)
 *   - subject_description: tom — krever layer-analyse (V2)
 *
 * Returnerer en delvis kontekst som kan merges med dialog-state.
 */
/**
 * Utvidet kontekst-ekstraksjon som leser BÅDE app.info, layer-listen
 * OG aktiv selection. Bygger en rik FireflyContext der subject-hints
 * gjettes fra layer-navn og selection-coverage gir hint om hvor stort
 * inngrep brukeren planlegger.
 *
 * Anbefales fremfor `extractContextFromAppInfo` når plugin støtter
 * doc.listLayers + selection.info (Post Agent 2026-06-02+).
 */
export function extractContextFromPhotoshopState(
  info: AppInfo,
  layers?: LayerListResult,
  selection?: SelectionInfoResult,
): FireflyContext {
  const ctx = extractContextFromAppInfo(info);
  if (layers && layers.layers.length > 0) {
    const subject = inferSubjectFromLayers(layers.layers.map((l) => l.name));
    if (subject) ctx.subject_description = subject;
  }
  if (selection && selection.exists) {
    // Veldig stor coverage (>70%) hinter at brukeren vil endre HELE
    // bildet — sannsynligvis stylize eller replace. Liten coverage
    // (<15%) hinter på remove/add av enkelt-element. Vi lagrer ikke
    // direkte men bruker det som "user_intent"-supplement.
    const coverageHint =
      selection.coverage_pct >= 70
        ? "(stor selection — sannsynligvis hele scenen)"
        : selection.coverage_pct <= 15
          ? "(liten selection — enkelt-element)"
          : "(middels selection)";
    ctx.user_intent = [ctx.user_intent, coverageHint].filter(Boolean).join(" ");
  }
  return ctx;
}

/**
 * Gjett hovedsubjektet fra layer-navnene. Bruker en kombinasjon av:
 * 1. Eksplisitte "subject"/"main"/"hero"-prefikser
 * 2. Filter ut åpenbare ikke-subjekt-layers (background, logo, watermark)
 * 3. Returner det mest meningsfulle navnet (uten Photoshop-default
 *    "Layer 1", "Layer 2" osv.)
 */
function inferSubjectFromLayers(layerNames: string[]): string | undefined {
  const DEFAULT_NAMES = /^layer\s*\d+$|^background$|^bakgrunn$/i;
  const NEGATIVE_HINTS = /(logo|watermark|brand|frame|border|guides?|notes?|gutter)/i;
  const POSITIVE_PREFIXES = /(subject|main|hero|portrait|product|model|key)/i;

  // Først: layers med eksplisitt positivt prefix
  for (const name of layerNames) {
    const last = name.split("/").pop() ?? name;
    if (POSITIVE_PREFIXES.test(last)) {
      return cleanLayerName(last);
    }
  }

  // Deretter: første "ekte" navngitte layer som ikke matcher negativ-mønster
  for (const name of layerNames) {
    const last = name.split("/").pop() ?? name;
    if (DEFAULT_NAMES.test(last)) continue;
    if (NEGATIVE_HINTS.test(last)) continue;
    if (last.length < 2) continue;
    return cleanLayerName(last);
  }

  return undefined;
}

function cleanLayerName(name: string): string {
  // Fjern Photoshop-suffikser (" copy", " 2") + bytt ut underscore med space
  return name
    .replace(/\s*copy(\s*\d+)?$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractContextFromAppInfo(info: AppInfo): FireflyContext {
  const ctx: FireflyContext = {};
  const doc = info.active_document;
  if (!doc) return ctx;

  const aspect = pickAspectRatio(doc.width, doc.height);
  if (aspect) ctx.target_aspect = aspect;

  const sceneHint = inferSceneTypeFromName(doc.name);
  if (sceneHint) ctx.scene_type = sceneHint;

  return ctx;
}

function pickAspectRatio(w: number, h: number): string | undefined {
  if (!w || !h) return undefined;
  // Standard-ratios vi gjenkjenner. Matcher mot raw ratio med 3% toleranse.
  const standards: Array<[number, number]> = [
    [1, 1], [16, 9], [9, 16], [4, 5], [5, 4], [4, 3], [3, 4], [3, 2], [2, 3], [21, 9],
  ];
  const ratio = w / h;
  for (const [num, den] of standards) {
    const stdRatio = num / den;
    if (Math.abs(ratio - stdRatio) / stdRatio < 0.03) {
      return `${num}:${den}`;
    }
  }
  return undefined;
}

function inferSceneTypeFromName(name: string): FireflyContext["scene_type"] {
  const n = name.toLowerCase();
  const map: Array<[string, FireflyContext["scene_type"]]> = [
    ["wedding", "wedding"],
    ["bryllup", "wedding"],
    ["portrait", "portrait"],
    ["portrett", "portrait"],
    ["landscape", "landscape"],
    ["landskap", "landscape"],
    ["product", "product"],
    ["produkt", "product"],
    ["interior", "interior"],
    ["interiør", "interior"],
    ["event", "event"],
    ["studio", "studio"],
    ["outdoor", "outdoor"],
    ["urban", "urban"],
  ];
  for (const [key, value] of map) {
    if (n.includes(key)) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Local template-based prompt generation
// ---------------------------------------------------------------------------

const SCENE_DEFAULTS: Record<string, string> = {
  portrait: "soft natural light, shallow depth of field",
  landscape: "sweeping wide vista, atmospheric depth",
  product: "clean studio backdrop, soft shadows",
  interior: "natural window light, warm ambient",
  event: "candid documentary lighting, authentic atmosphere",
  wedding: "romantic warm light, dreamy bokeh, timeless",
  studio: "controlled lighting, seamless backdrop",
  outdoor: "natural daylight, organic textures",
  urban: "cinematic ambient light, contemporary feel",
};

const TIME_PHRASES: Record<string, string> = {
  morning: "soft morning light",
  midday: "bright midday sunlight",
  golden_hour: "warm golden hour light",
  blue_hour: "moody blue hour ambiance",
  night: "low-light night atmosphere",
};

/**
 * Bygg en deterministisk prompt fra intent + kontekst. Returnerer 1
 * "canonical" prompt + opptil 2 varianter (mer stylized / minimal).
 */
export function suggestPromptsLocal(
  intent: FireflyIntent,
  ctx: FireflyContext = {},
): FireflyPromptSuggestion[] {
  const sceneBits = ctx.scene_type ? [SCENE_DEFAULTS[ctx.scene_type]] : [];
  const timeBits = ctx.time_of_day ? [TIME_PHRASES[ctx.time_of_day]] : [];
  const lightingBits = ctx.lighting ? [ctx.lighting] : [];
  const styleBits = ctx.style_tags?.length ? [ctx.style_tags.join(", ")] : [];
  const subject = ctx.subject_description?.trim();

  switch (intent) {
    case "remove_object":
      return [
        {
          prompt: "",
          rationale: "Tom prompt = Firefly auto-fill basert på omgivelser. Mest pålitelig for å fjerne objekter i en eksisterende komposisjon.",
          fits: intent,
        },
      ];

    case "expand_background": {
      const base = subject
        ? `continuation of ${subject}`
        : "continuation of existing scene";
      const composed = [base, ...sceneBits, ...timeBits, ...lightingBits, ...styleBits]
        .filter(Boolean)
        .join(", ");
      return [
        {
          prompt: composed,
          rationale: "Ber Firefly ekstrapolere det eksisterende — best for naturlige utvidelser uten å innføre nye elementer.",
          fits: intent,
        },
        {
          prompt: "",
          rationale: "Tom prompt — Firefly bruker omgivelser direkte. Fungerer ofte godt for ren bakgrunns-utvidelse.",
          fits: intent,
        },
        ...(sceneBits.length > 0
          ? [
              {
                prompt: [sceneBits[0], styleBits[0]].filter(Boolean).join(", "),
                rationale: "Kortere variant — fokus på sjanger/stil hvis original-prompten blir for spesifikk.",
                fits: intent,
              },
            ]
          : []),
      ];
    }

    case "replace_background": {
      const composed = [
        subject ? `${subject}, against` : "subject against",
        ctx.user_intent || "soft minimal backdrop",
        ...timeBits,
        ...lightingBits,
        ...styleBits,
      ]
        .filter(Boolean)
        .join(" ");
      return [
        {
          prompt: composed,
          rationale: "Plasserer subjektet eksplisitt foran ny bakgrunn. Konkret lighting + stil gir konsistent resultat.",
          fits: intent,
        },
        {
          prompt: [ctx.user_intent || "studio backdrop", ...styleBits].filter(Boolean).join(", "),
          rationale: "Kortere variant — la Firefly tolke kontekst fra subjektet selv.",
          fits: intent,
        },
      ];
    }

    case "add_element": {
      const composed = [
        ctx.user_intent || "natural detail",
        ...sceneBits.slice(0, 1),
        ...styleBits,
      ]
        .filter(Boolean)
        .join(", ");
      return [
        {
          prompt: composed,
          rationale: "Beskriver elementet alene + matchende stil — Firefly blender bedre når input matcher omgivelser.",
          fits: intent,
        },
      ];
    }

    case "fix_edges":
      return [
        {
          prompt: "",
          rationale: "Edge-rydding gjøres best med tom prompt — Firefly leser omgivelsene og fyller naturlig.",
          fits: intent,
        },
      ];

    case "stylize": {
      const composed = [
        subject || "scene",
        ...styleBits,
        ...lightingBits,
        ...timeBits,
      ]
        .filter(Boolean)
        .join(", ");
      return [
        {
          prompt: composed,
          rationale: "Stil-overlay som beholder original-subjekt — gir konsistent atmosfære uten å bytte innhold.",
          fits: intent,
        },
      ];
    }

    case "generate_subject": {
      const composed = [
        ctx.user_intent || "central subject",
        ...sceneBits.slice(0, 1),
        ...lightingBits,
        ...styleBits,
      ]
        .filter(Boolean)
        .join(", ");
      return [
        {
          prompt: composed,
          rationale: "Genererer nytt subjekt med sammenhengende lighting + stil — best for fra-bunnen-av-komposisjoner.",
          fits: intent,
        },
      ];
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Claude-assisted prompt generation
// ---------------------------------------------------------------------------

/**
 * Send konteksten til Claude og få tilbake 3 målrettede Firefly-prompts
 * med kort rasjonale. Fallback til lokal-generator hvis Claude feiler
 * eller er disablet i test-modus.
 */
export async function suggestPromptsViaClaude(
  intent: FireflyIntent,
  ctx: FireflyContext = {},
): Promise<FireflyPromptSuggestion[]> {
  if (typeof window !== "undefined") {
    const flag = (window as { __POST_AGENT_DISABLE_CLAUDE__?: boolean })
      .__POST_AGENT_DISABLE_CLAUDE__;
    if (flag) return suggestPromptsLocal(intent, ctx);
  }

  try {
    const brief = buildClaudeBrief(intent, ctx);
    const text = await claudeProxyService.send({
      systemPrompt: FIREFLY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: brief }],
      maxTokens: 700,
    });
    const parsed = parseClaudePromptResponse(text, intent);
    if (parsed && parsed.length > 0) return parsed;
    return suggestPromptsLocal(intent, ctx);
  } catch {
    return suggestPromptsLocal(intent, ctx);
  }
}

const FIREFLY_SYSTEM_PROMPT = `Du er en Adobe Firefly prompt-ekspert. Du genererer korte, presise prompts (under 30 ord) som Firefly responderer godt på i Photoshop Generative Fill / Generative Expand.

Beste praksis:
- Spesifikk over generisk: "rolling hills with golden hour light" > "nice background"
- Inkluder lighting + farger + atmosfære i samme prompt
- ALDRI bruk negativ-formulering ("no X") — Firefly tolker det dårlig
- For Generative Expand: bruk fraser som "continuation of …" så modellen ekstrapolerer
- For Remove: tom prompt ofte best (Firefly auto-fill)
- For Replace: subjekt + lighting + style i én streng

Du SVARER ALLTID kun med gyldig JSON i dette skjemaet, uten markdown-kode-fence:

{
  "suggestions": [
    {
      "prompt": "den faktiske Firefly-prompten",
      "rationale": "1 setning som forklarer hvorfor"
    }
  ]
}

3 forslag er ideelt. Varier mellom canonical, kort, og stilisert. Skriv prompts på engelsk (Firefly er trent på engelsk), men rasjonale på norsk.`;

function buildClaudeBrief(intent: FireflyIntent, ctx: FireflyContext): string {
  return [
    `Intent: ${intent}`,
    ctx.user_intent ? `Brukerens ønske: ${ctx.user_intent}` : "",
    ctx.scene_type ? `Scene: ${ctx.scene_type}` : "",
    ctx.subject_description ? `Subjekt: ${ctx.subject_description}` : "",
    ctx.style_tags?.length ? `Style tags: ${ctx.style_tags.join(", ")}` : "",
    ctx.lighting ? `Lighting: ${ctx.lighting}` : "",
    ctx.time_of_day ? `Tid: ${ctx.time_of_day}` : "",
    ctx.target_aspect ? `Aspect ratio: ${ctx.target_aspect}` : "",
    "",
    "Gi 3 ulike Firefly-prompts som dekker spennet fra detaljert til minimal. Husk: kun JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseClaudePromptResponse(
  raw: string,
  intent: FireflyIntent,
): FireflyPromptSuggestion[] | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as {
      suggestions?: Array<{ prompt?: string; rationale?: string }>;
    };
    if (!Array.isArray(parsed.suggestions)) return null;
    const result = parsed.suggestions
      .filter((s) => typeof s.prompt === "string")
      .slice(0, 4)
      .map((s) => ({
        prompt: String(s.prompt),
        rationale: s.rationale ? String(s.rationale) : "Generert av Claude",
        fits: intent,
      }));
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}
