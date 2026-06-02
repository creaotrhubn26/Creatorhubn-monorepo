/**
 * photoshopTools — Claude tool-definitions + dispatcher for Photoshop-
 * UXP-broen. Lar Claude Co-Editor (CreativeEditorView's panel) styre
 * Photoshop fra naturlig språk via Anthropic tool-use-protokollen.
 *
 * Bruksflyt:
 *   1. Inkluder `PHOTOSHOP_TOOLS` i `tools`-parameter til claude-API-call
 *   2. Når Claude responderer med en `tool_use`-blokk, kall
 *      `runPhotoshopTool(toolUse)` for å eksekvere mot Photoshop
 *   3. Send `tool_result`-blokken tilbake til Claude i neste turn
 *
 * Hver tool er en tynn wrapper rundt en `photoshop.*`-metode i
 * photoshopBridgeService — så hele vokabularet er konsistent.
 */

import { photoshop, type ExportFormat } from "../services/photoshopBridgeService";

// Anthropic tool definition shape (matcher beta.messages.tool_use)
export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ---------------------------------------------------------------------------
// Tool definitions — what Claude sees and can choose to call
// ---------------------------------------------------------------------------

export const PHOTOSHOP_TOOLS: ClaudeToolDefinition[] = [
  {
    name: "photoshop_app_info",
    description:
      "Hent informasjon om kjørende Photoshop-instans: versjon, lokale åpne dokumenter med navn + dimensjoner. Bruk når du trenger å vite hva som er åpent eller verifisere at Photoshop kjører.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_open_document",
    description:
      "Åpne en .psd/.psb/.jpg/.tiff-fil i Photoshop fra absolutt sti. Gjør fila til aktivt dokument.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolutt fil-sti, f.eks. /Users/.../template.psd" },
      },
      required: ["path"],
    },
  },
  {
    name: "photoshop_save_document",
    description: "Lagre aktivt dokument over eksisterende fil.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_export_document",
    description:
      "Eksporter aktivt dokument til et nytt format og sti. Mutere ikke originalen. Format kan være jpg/png/psd/tiff. Quality 1-12 gjelder kun jpg.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolutt output-sti" },
        format: {
          type: "string",
          enum: ["jpg", "png", "psd", "tiff"],
          description: "Eksportformat",
        },
        quality: { type: "number", description: "JPG-kvalitet 1-12, default 10" },
      },
      required: ["path", "format"],
    },
  },
  {
    name: "photoshop_replace_smart_object",
    description:
      "Bytt ut innholdet i et navngitt smart-object-layer med en ny fil. Layer må allerede være et smart object i aktivt dokument.",
    input_schema: {
      type: "object",
      properties: {
        layer_name: { type: "string", description: "Navnet på smart-object-layeren" },
        file_path: { type: "string", description: "Absolutt sti til ny fil (bilde)" },
      },
      required: ["layer_name", "file_path"],
    },
  },
  {
    name: "photoshop_set_text",
    description:
      "Endre tekst-innholdet i et navngitt text-layer i aktivt dokument. Brukes for å fylle inn titler, navn, datoer osv. i templater.",
    input_schema: {
      type: "object",
      properties: {
        layer_name: { type: "string", description: "Navnet på text-layeren" },
        contents: { type: "string", description: "Ny tekst som skal vises" },
      },
      required: ["layer_name", "contents"],
    },
  },
  {
    name: "photoshop_toggle_layer",
    description: "Skru et navngitt layer av eller på i aktivt dokument.",
    input_schema: {
      type: "object",
      properties: {
        layer_name: { type: "string" },
        visible: { type: "boolean" },
      },
      required: ["layer_name", "visible"],
    },
  },
  {
    name: "photoshop_scan_template",
    description:
      "Skann et .psd/.psb-template etter alle layers navngitt {{key}}. Returnerer fields-array som beskriver hvilke felter (text eller image) som kan fylles. Bruk dette FØRST før du kaller render_template.",
    input_schema: {
      type: "object",
      properties: {
        template_path: { type: "string", description: "Absolutt sti til template-PSD" },
      },
      required: ["template_path"],
    },
  },
  {
    name: "photoshop_render_template",
    description:
      "Render et template ved å åpne det, fylle alle {{key}}-felter med verdier fra data-objektet, eksportere, og lukke uten å lagre. Originalen forblir urørt. Kall scan_template først for å vite hvilke nøkler som er gyldige.",
    input_schema: {
      type: "object",
      properties: {
        template_path: { type: "string" },
        data: {
          type: "object",
          description: "Map av {key: value}. Tekstverdier for text-felter, fil-stier for image-felter.",
          additionalProperties: { type: "string" },
        },
        output_path: { type: "string", description: "Absolutt sti der rendret fil skal lagres" },
        format: { type: "string", enum: ["jpg", "png", "psd", "tiff"] },
        quality: { type: "number", description: "JPG-kvalitet 1-12, default 10" },
      },
      required: ["template_path", "data", "output_path", "format"],
    },
  },
  {
    name: "photoshop_batch_render",
    description:
      "Render samme template N ganger fra én items-liste. Hver item får sin egen data-map og output_path. Brukes for å lage variants: 10 sosial-poster med ulike navn, en serie produktkort, etc. Hver iteration åpner template på nytt → ingen verdi-arv mellom items.",
    input_schema: {
      type: "object",
      properties: {
        template_path: { type: "string", description: "Absolutt sti til template-PSD" },
        items: {
          type: "array",
          description: "Array av render-jobber. Hver jobb er {data, output_path, format?, quality?}",
          items: {
            type: "object",
            properties: {
              data: {
                type: "object",
                description: "Map av {key: value} for denne varianten — samme nøkler som template.scan gir",
                additionalProperties: { type: "string" },
              },
              output_path: { type: "string", description: "Absolutt sti der rendret fil skal lagres" },
              format: { type: "string", enum: ["jpg", "png", "psd", "tiff"], description: "Overstyrer default_format" },
              quality: { type: "number", description: "Overstyrer default_quality" },
            },
            required: ["data", "output_path"],
          },
        },
        default_format: {
          type: "string",
          enum: ["jpg", "png", "psd", "tiff"],
          description: "Format brukt hvis item ikke spesifiserer eget",
        },
        default_quality: { type: "number", description: "JPG-kvalitet 1-12, default 10" },
      },
      required: ["template_path", "items"],
    },
  },
];

// ---------------------------------------------------------------------------
// Dispatcher — runs a tool_use block against Photoshop
// ---------------------------------------------------------------------------

/**
 * Eksekver en `tool_use`-blokk fra Claude mot Photoshop-broen.
 * Returnerer en `tool_result`-blokk som kan sendes tilbake i neste
 * Claude-turn. Fanger feil → setter `is_error: true` så Claude kan
 * reagere (typisk ved å spørre brukeren om mer info).
 */
export async function runPhotoshopTool(
  toolUse: ClaudeToolUseBlock,
): Promise<ClaudeToolResultBlock> {
  try {
    const result = await dispatch(toolUse.name, toolUse.input);
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(result),
    };
  } catch (err) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: err instanceof Error ? err.message : String(err),
      is_error: true,
    };
  }
}

async function dispatch(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "photoshop_app_info":
      return photoshop.appInfo();
    case "photoshop_open_document":
      return photoshop.openDocument(requireString(input, "path"));
    case "photoshop_save_document":
      return photoshop.saveDocument();
    case "photoshop_export_document":
      return photoshop.exportDocument({
        path: requireString(input, "path"),
        format: requireString(input, "format") as ExportFormat,
        quality: input.quality as number | undefined,
      });
    case "photoshop_replace_smart_object":
      return photoshop.replaceSmartObject({
        layer_name: requireString(input, "layer_name"),
        file_path: requireString(input, "file_path"),
      });
    case "photoshop_set_text":
      return photoshop.setTextContents({
        layer_name: requireString(input, "layer_name"),
        contents: requireString(input, "contents"),
      });
    case "photoshop_toggle_layer":
      return photoshop.toggleLayer({
        layer_name: requireString(input, "layer_name"),
        visible: input.visible === true,
      });
    case "photoshop_scan_template":
      return photoshop.scanTemplate(requireString(input, "template_path"));
    case "photoshop_render_template":
      return photoshop.renderTemplate({
        template_path: requireString(input, "template_path"),
        data: (input.data ?? {}) as Record<string, string>,
        output_path: requireString(input, "output_path"),
        format: requireString(input, "format") as ExportFormat,
        quality: input.quality as number | undefined,
      });
    case "photoshop_batch_render": {
      const itemsRaw = input.items;
      if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
        throw new Error('"items" må være en non-empty array');
      }
      const items = itemsRaw.map((raw, i) => {
        if (!raw || typeof raw !== "object") {
          throw new Error(`items[${i}] må være et objekt`);
        }
        const item = raw as Record<string, unknown>;
        return {
          data: (item.data ?? {}) as Record<string, string>,
          output_path: requireString(item, "output_path"),
          format: item.format as ExportFormat | undefined,
          quality: item.quality as number | undefined,
        };
      });
      return photoshop.batchRender({
        template_path: requireString(input, "template_path"),
        items,
        default_format: input.default_format as ExportFormat | undefined,
        default_quality: input.default_quality as number | undefined,
      });
    }
    default:
      throw new Error(`Ukjent photoshop-tool: ${name}`);
  }
}

function requireString(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`Mangler eller ugyldig "${key}" i tool input`);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Convenience: detect tool_use blocks in Claude response content
// ---------------------------------------------------------------------------

export function extractToolUses(content: unknown): ClaudeToolUseBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (b): b is ClaudeToolUseBlock =>
      typeof b === "object" &&
      b !== null &&
      (b as { type?: string }).type === "tool_use" &&
      typeof (b as { name?: unknown }).name === "string",
  );
}

/**
 * Kjør alle tool_use-blokker i en Claude-respons og returner tilsvarende
 * tool_result-blokker — klart for å sendes tilbake til Claude som neste
 * user-message (i `messages`-array som content av siste user-melding).
 */
export async function runAllPhotoshopTools(
  content: unknown,
): Promise<ClaudeToolResultBlock[]> {
  const uses = extractToolUses(content);
  return Promise.all(uses.map((u) => runPhotoshopTool(u)));
}
