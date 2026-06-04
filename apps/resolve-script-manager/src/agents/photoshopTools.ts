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
import {
  suggestPromptsLocal,
  suggestPromptsViaClaude,
  type FireflyIntent,
  type FireflyContext,
} from "../lib/fireflyPromptHelper";

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

/**
 * Tool result kan være string (text-only) eller array av blokker
 * (text + image). Anthropic støtter image-content i tool_result så
 * Claude vision-modellen kan se bildet i neste turn — brukes av
 * `photoshop_see_canvas` for å levere thumbnail tilbake til modellen.
 */
export type ClaudeToolResultContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: "image/png" | "image/jpeg";
            data: string;
          };
        }
    >;

export interface ClaudeToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: ClaudeToolResultContent;
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
    name: "photoshop_history_snapshot",
    description:
      "Lag et navngitt history-state i Photoshop. Brukes FØR risikable endringer så du kan revert hvis brukeren ikke liker resultatet. Returnerer snapshot_name som photoshop_history_revert kan bruke senere.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Snapshot-navn (default: timestamp). Bruk beskrivende navn som 'Før gen.fill av bakgrunn'.",
        },
      },
    },
  },
  {
    name: "photoshop_history_revert",
    description:
      "Revert til et navngitt history-snapshot. Brukes hvis brukeren ikke liker en endring eller for å teste flere varianter.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Snapshot-navn å revertere til" },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_selection_from_mask",
    description:
      "Last en PNG-mask som Photoshop selection. Mask må ha samme dimensjoner som aktivt dokument. White pixels = selected. threshold styrer terskel (0-255, default 128). Brukes for å pre-definere region før gen.fill når Claude allerede har generert en maske.",
    input_schema: {
      type: "object",
      properties: {
        mask_path: { type: "string", description: "Absolutt sti til mask-PNG" },
        threshold: { type: "number", description: "Grayscale-terskel (0-255, default 128)" },
      },
      required: ["mask_path"],
    },
  },
  {
    name: "photoshop_resolve_project_info",
    description:
      "Hent live info om aktivt Resolve-prosjekt: project_name, timeline_name, timeline_fps, timeline_timecode, current_folder. Krever at watch-resolve-commands.lua kjører i Resolve.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_media_pool_list_items",
    description:
      "List alle MediaPoolItems i Resolve current folder med id + clip_name + file_path + frames + fps. Krever watch-resolve-commands.lua.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_quick_export_list",
    description:
      "List Resolve sine innebygde Quick Export render-presets ('H.264 Master', 'ProRes 422 HQ', etc.). Bruk dette FØR quick_export_run. Krever watch-resolve-commands.lua.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_quick_export_run",
    description:
      "Kjør Quick Export på Resolve current timeline med spesifikt preset. preset_name fra quick_export_list. Valgfri target_dir + custom_name + video_quality. GPU-akselerert batch-eksport.",
    input_schema: {
      type: "object",
      properties: {
        preset_name: { type: "string" },
        target_dir: { type: "string", description: "Absolutt mappe-path (valgfri)" },
        custom_name: { type: "string", description: "Output-filnavn-prefix (valgfri)" },
        video_quality: { type: "string", description: "Quality-override (valgfri)" },
      },
      required: ["preset_name"],
    },
  },
  {
    name: "photoshop_resolve_power_grade_list",
    description:
      "List alle PowerGrade-albums i Resolve gallery med navn + still-count. PowerGrade-stills er gjenbrukbare color-grade-presets. Bruk dette for å se hvilke grades som er tilgjengelige før du foreslår grading-handlinger. Krever watch-resolve-commands.lua.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_power_grade_create",
    description:
      "Opprett et nytt PowerGrade-album i Resolve gallery med valgfritt navn. Brukes for å organisere AI-genererte grades. Returnerer det faktiske navnet (Resolve kan ha lagt til suffix hvis navn-kollisjon).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Album-navn (valgfri — Resolve velger default hvis utelatt)" },
      },
    },
  },
  {
    name: "photoshop_resolve_power_grade_export",
    description:
      "Eksporter alle stills fra et PowerGrade-album til disk som .drx (Resolve grade), .dpx (digital cinema), .tif/.jpg/.png. Bruk format='drx' for å BEVARE grade-data (kan importeres tilbake til andre Resolve-prosjekter), andre formater er rasterized previews.",
    input_schema: {
      type: "object",
      properties: {
        album_name: { type: "string" },
        folder_path: { type: "string", description: "Absolutt sti til output-folder" },
        prefix: { type: "string", description: "Filnavn-prefix (default 'postagent_grade')" },
        format: { type: "string", enum: ["drx", "dpx", "tif", "jpg", "png"], description: "Default 'drx'" },
      },
      required: ["album_name", "folder_path"],
    },
  },
  {
    name: "photoshop_resolve_audio_transcribe",
    description:
      "Resolve 21 AI: transkribér audio på spesifikk MediaPoolItem (via clip_id fra mediaPoolListItems) eller hele current folder. use_speaker_detection=true gjør at flere talere identifiseres. Krever AI Audio Transcription-modell nedlastet. Tar lang tid på store folders — timeout 5 min.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "MediaPoolItem unique-id (utelat for å transkribere hele folder)" },
        use_speaker_detection: { type: "boolean", description: "Identifiser ulike talere (default false)" },
      },
    },
  },
  {
    name: "photoshop_resolve_audio_classify",
    description:
      "Resolve 21 AI: klassifiser audio i kategorier (dialog/musikk/ambient/etc.) på spesifikk klipp eller folder. Brukes for å vekte picks i Story-tab (dialog > ambient for narrative beats). Krever AI Audio Classification-modell.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "MediaPoolItem unique-id (utelat for folder)" },
      },
    },
  },
  {
    name: "photoshop_resolve_speech_generate",
    description:
      "Resolve 21 AI Speech Generator: TTS som genererer audio-MediaPoolItem fra tekst. add_to_timeline=true plasserer auto på current timeline ved timecode. Voice/model er valgfri (default Resolve-default). Bruk for voiceover-spor.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        voice: { type: "string", description: "Voice-modell-navn (valgfri)" },
        timecode: { type: "string", description: "HH:MM:SS:FF — hvor klippet plasseres (default 00:00:00:00)" },
        model: { type: "string", description: "Modell-navn (valgfri)" },
        add_to_timeline: { type: "boolean", description: "Plasser auto på current timeline (default false)" },
      },
      required: ["text"],
    },
  },
  {
    name: "photoshop_resolve_slate_analyze",
    description:
      "Resolve 21 AI Slate ID: finn slates i video-klipp og opprett markers automatisk. marker_color (Yellow/Red/Green/Blue/etc.) styrer marker-fargen. Brukes for å auto-organisere klipp etter slate-metadata.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        marker_color: { type: "string", description: "Marker-farge (default 'Yellow')" },
      },
    },
  },
  {
    name: "photoshop_resolve_timeline_smart_reframe",
    description:
      "Resolve 21 AI SmartReframe: AI auto-reframer current timeline til ny aspect-ratio. Krever at brukeren har konfigurert target aspect i Project Settings → Image Scaling først. Bruk dette for å lage sosial-formats fra eksisterende timeline uten manuell crop per klipp.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_read_intellisearch",
    description:
      "Les den nyeste Resolve 21 AI IntelliSearch-analyse-filen som er eksportert av analyze-intellisearch.lua. Returnerer per-clip face/object-metadata fra Resolve sin native AI — bruk dette FØR du gjør innholds-baserte vurderinger som ellers ville krevd photoshop_see_canvas per klipp. clip_name_filter er valgfri (case-insensitive substring-match).",
    input_schema: {
      type: "object",
      properties: {
        clip_name_filter: { type: "string", description: "Filtrer items på clip-navn substring (valgfri)" },
      },
    },
  },
  {
    name: "photoshop_resolve_list_inbox",
    description:
      "List stills som DaVinci Resolve har eksportert til ~/PostAgent/inbox/ via export-still-to-postagent.lua. Hver item har path + filnavn + metadata (clip, frame, fps, project) hvis sidefil finnes. Sortert nyeste først.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_open_latest",
    description:
      "Åpne nyeste still fra Resolve-inbox i Photoshop. Bruk når brukeren sier 'åpne det jeg sendte fra Resolve' eller for å starte en touch-up-flyt fra video.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_export_back",
    description:
      "Eksporter aktivt Photoshop-dokument tilbake til ~/PostAgent/outbox/ slik at Resolve sin insert-from-postagent.lua kan importere det tilbake i Media Pool. Bruk når brukeren er ferdig med touch-up og vil tilbake til video.",
    input_schema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "tiff", "jpg", "psd"] },
        quality: { type: "number", description: "JPG-kvalitet 1-12, default 10" },
      },
    },
  },
  {
    name: "photoshop_see_canvas",
    description:
      "Hent et thumbnail av aktivt Photoshop-dokument og se det med vision. Returnerer bildet som image-content som du faktisk kan analysere visuelt — komposisjon, lighting, hva som er i scenen, hvor logo/text er plassert. Bruk dette FØR du foreslår endringer eller når brukeren ber om innholdsbasert hjelp.",
    input_schema: {
      type: "object",
      properties: {
        max_size: {
          type: "number",
          description: "Maks lengste side i piksel (default 1024). Mindre = raskere, men færre detaljer.",
        },
      },
    },
  },
  {
    name: "photoshop_list_layers",
    description:
      "List alle layers i aktivt dokument med metadata (navn, kind, visibility, has_text, is_smart_object). Layer-tre flatets ut — gruppe-medlemmer prefikses med parent-navn ('Background/Logo'). Brukes for å forstå strukturen i et åpent dokument før du redigerer eller for å gjette subjekt-navn.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_selection_info",
    description:
      "Hent bounding box (top/left/bottom/right) + coverage_pct av aktiv selection. Returnerer {exists: false} hvis ingen selection finnes. Brukes for å vite hvor i bildet en endring skal skje før gen.fill eller andre selection-baserte operasjoner.",
    input_schema: { type: "object", properties: {} },
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
    name: "photoshop_add_adjustment",
    description:
      "Legg til en ikke-destruktiv adjustment layer (brightness_contrast, hue_saturation, color_balance, curves) over aktivt dokument eller en navngitt target-layer. Brukes for å applisere look/color-grade uten å miste muligheten til å justere etterpå.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["brightness_contrast", "hue_saturation", "color_balance", "curves"],
        },
        params: {
          type: "object",
          description: "Type-spesifikke verdier. brightness_contrast: {brightness:-150..150, contrast:-150..150}. hue_saturation: {hue:-180..180, saturation:-100..100, lightness:-100..100}. color_balance: {midtones:[r,g,b], shadows?, highlights?} med verdier -100..100. curves: {points:[[x,y],...]} med 0..255-verdier på composite.",
        },
        name: { type: "string", description: "Layer-navn for adjustment (valgfri)" },
        target_layer_name: {
          type: "string",
          description: "Hvis satt, plasseres adjustment over denne layeren",
        },
      },
      required: ["type", "params"],
    },
  },
  {
    name: "photoshop_apply_style",
    description:
      "Applisere layer styles (drop_shadow, outer_glow, color_overlay) på en navngitt layer. Flere effekter kan settes samtidig — de kombineres på samme layer.",
    input_schema: {
      type: "object",
      properties: {
        layer_name: { type: "string" },
        effects: {
          type: "object",
          description:
            "Map av effekter. drop_shadow:{opacity?,angle?,distance?,size?,color?:{r,g,b}}. outer_glow:{opacity?,size?,color?}. color_overlay:{opacity?,color:{r,g,b},blend_mode?}",
          properties: {
            drop_shadow: { type: "object" },
            outer_glow: { type: "object" },
            color_overlay: { type: "object" },
          },
        },
      },
      required: ["layer_name", "effects"],
    },
  },
  {
    name: "photoshop_selection_select",
    description:
      "Sett aktiv selection i Photoshop. mode='all' velger hele canvas, 'none' deselect, 'invert' inverterer eksisterende selection. Brukes som forberedelse til gen.fill eller andre selection-baserte operasjoner.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["all", "none", "invert"] },
      },
      required: ["mode"],
    },
  },
  {
    name: "photoshop_gen_fill",
    description:
      "Kjør Adobe Firefly Generative Fill på nåværende selection. Tom prompt betyr 'remove/auto-fill background'. Krever Photoshop 2024+ med aktiv Firefly-konto. Resultatet kommer som ny generativ-layer over selection-området.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Beskrivelse av hva Firefly skal generere. Tom string = auto-fill basert på omgivelser.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "photoshop_gen_expand",
    description:
      "Generative Expand: utvid canvas til target_width × target_height med anchor-posisjon, og auto-fill de nye områdene via Firefly. Brukes for å gjøre 16:9 → 9:16, fjerne white-space, eller utvide bakgrunn. anchor styrer hvor original komposisjon plasseres.",
    input_schema: {
      type: "object",
      properties: {
        target_width: { type: "number", description: "Ny canvas-bredde i piksler" },
        target_height: { type: "number", description: "Ny canvas-høyde i piksler" },
        anchor: {
          type: "string",
          enum: [
            "topLeft", "topCenter", "topRight",
            "middleLeft", "middleCenter", "middleRight",
            "bottomLeft", "bottomCenter", "bottomRight",
          ],
          description: "Hvor original innhold plasseres i ny canvas. Default: middleCenter",
        },
        prompt: {
          type: "string",
          description: "Valgfri tekst-prompt for å styre auto-fill. Tom = bare utvid background.",
        },
      },
      required: ["target_width", "target_height"],
    },
  },
  {
    name: "photoshop_suggest_firefly_prompts",
    description:
      "Hent 1-4 best-practice Firefly-prompts for gen.fill eller gen.expand basert på intent og kontekst. Bruker Claude for målrettet generering (med lokal template-fallback). Bruk denne FØR du kaller gen.fill/gen.expand når du er usikker på hvordan prompten skal formuleres.",
    input_schema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: [
            "expand_background",
            "remove_object",
            "replace_background",
            "add_element",
            "fix_edges",
            "stylize",
            "generate_subject",
          ],
          description: "Hva brukeren prøver å oppnå",
        },
        user_intent: {
          type: "string",
          description: "Fri-tekst beskrivelse av hva brukeren ønsker (kan være på norsk)",
        },
        scene_type: {
          type: "string",
          enum: ["portrait", "landscape", "product", "interior", "event", "wedding", "studio", "outdoor", "urban"],
        },
        subject_description: {
          type: "string",
          description: "Hva som ER i bildet i dag (subjektet) — viktig for expand-prompts",
        },
        style_tags: {
          type: "array",
          items: { type: "string" },
          description: 'Stil-tags som "cinematic", "moody", "warm", "vibrant"',
        },
        lighting: { type: "string", description: 'Lyssetting hvis kjent (f.eks. "soft window light")' },
        time_of_day: {
          type: "string",
          enum: ["morning", "midday", "golden_hour", "blue_hour", "night"],
        },
        target_aspect: { type: "string", description: 'Aspect-ratio output ("9:16", "1:1" etc.)' },
        use_claude: {
          type: "boolean",
          description: "Hvis true, kall Claude for målrettet prompt-generering. Hvis false eller utelatt, kun lokale template-prompts.",
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "photoshop_multi_aspect_export",
    description:
      "Eksporter samme master-PSD til flere aspect-ratios. Bruker fill-by-resize + center-crop: bildet skaleres så det dekker target, overflod cropper bort fra senter. Brukes for sosial-pakker (1:1 + 9:16 + 4:5 + 16:9). target_long_edge styrer outputstørrelse — lengste side blir det tallet, kort side beregnes ut fra aspect.",
    input_schema: {
      type: "object",
      properties: {
        master_path: { type: "string", description: "Absolutt sti til master-PSD" },
        output_dir: { type: "string", description: "Mappe der outputs lagres" },
        base_name: { type: "string", description: "Filnavn-prefix (uten extension). Aspect appendes automatisk: name_1x1.jpg, name_9x16.jpg" },
        aspects: {
          type: "array",
          description: 'Liste av aspect-strenger som "1:1", "9:16", "16:9", "4:5"',
          items: { type: "string" },
        },
        target_long_edge: {
          type: "number",
          description: "Lengste side i piksel (typisk 1080, 1920, 2160)",
        },
        format: { type: "string", enum: ["jpg", "png", "psd", "tiff"] },
        quality: { type: "number", description: "JPG-kvalitet 1-12, default 10" },
      },
      required: ["master_path", "output_dir", "base_name", "aspects", "target_long_edge", "format"],
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
    // Special-case: photoshop_see_canvas returnerer image-content så
    // Claude vision-modellen kan se bildet, ikke bare lese base64.
    if (toolUse.name === "photoshop_see_canvas" && result && typeof result === "object") {
      const thumb = result as { base64?: string; width?: number; height?: number; doc_width?: number; doc_height?: number };
      if (typeof thumb.base64 === "string" && thumb.base64.length > 0) {
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: thumb.base64 },
            },
            {
              type: "text",
              text: `Captured thumbnail ${thumb.width}×${thumb.height}px (from doc ${thumb.doc_width}×${thumb.doc_height}px).`,
            },
          ],
        };
      }
    }
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
    case "photoshop_see_canvas":
      return photoshop.captureThumbnail(
        typeof input.max_size === "number" ? input.max_size : undefined,
      );
    case "photoshop_history_snapshot":
      return photoshop.historySnapshot(typeof input.name === "string" ? input.name : undefined);
    case "photoshop_history_revert":
      return photoshop.historyRevert(requireString(input, "name"));
    case "photoshop_selection_from_mask":
      return photoshop.selectionFromMask({
        mask_path: requireString(input, "mask_path"),
        threshold: typeof input.threshold === "number" ? input.threshold : undefined,
      });
    case "photoshop_resolve_list_inbox":
      return photoshop.resolveListInbox();
    case "photoshop_resolve_read_intellisearch":
      return photoshop.resolveReadIntellisearch(
        typeof input.clip_name_filter === "string" ? input.clip_name_filter : undefined,
      );
    case "photoshop_resolve_project_info":
      return photoshop.resolveProjectInfo();
    case "photoshop_resolve_media_pool_list_items":
      return photoshop.resolveMediaPoolListItems();
    case "photoshop_resolve_quick_export_list":
      return photoshop.resolveQuickExportList();
    case "photoshop_resolve_quick_export_run":
      return photoshop.resolveQuickExportRun({
        preset_name: requireString(input, "preset_name"),
        target_dir: typeof input.target_dir === "string" ? input.target_dir : undefined,
        custom_name: typeof input.custom_name === "string" ? input.custom_name : undefined,
        video_quality: typeof input.video_quality === "string" ? input.video_quality : undefined,
      });
    case "photoshop_resolve_power_grade_list":
      return photoshop.resolvePowerGradeList();
    case "photoshop_resolve_power_grade_create":
      return photoshop.resolvePowerGradeCreate(
        typeof input.name === "string" ? input.name : undefined,
      );
    case "photoshop_resolve_power_grade_export":
      return photoshop.resolvePowerGradeExport({
        album_name: requireString(input, "album_name"),
        folder_path: requireString(input, "folder_path"),
        prefix: typeof input.prefix === "string" ? input.prefix : undefined,
        format: input.format as "drx" | "dpx" | "tif" | "jpg" | "png" | undefined,
      });
    case "photoshop_resolve_audio_transcribe":
      return photoshop.resolveAudioTranscribe({
        clip_id: typeof input.clip_id === "string" ? input.clip_id : undefined,
        use_speaker_detection: input.use_speaker_detection === true,
      });
    case "photoshop_resolve_audio_classify":
      return photoshop.resolveAudioClassify({
        clip_id: typeof input.clip_id === "string" ? input.clip_id : undefined,
      });
    case "photoshop_resolve_speech_generate":
      return photoshop.resolveSpeechGenerate({
        text: requireString(input, "text"),
        voice: typeof input.voice === "string" ? input.voice : undefined,
        timecode: typeof input.timecode === "string" ? input.timecode : undefined,
        model: typeof input.model === "string" ? input.model : undefined,
        add_to_timeline: input.add_to_timeline === true,
      });
    case "photoshop_resolve_slate_analyze":
      return photoshop.resolveSlateAnalyze({
        clip_id: typeof input.clip_id === "string" ? input.clip_id : undefined,
        marker_color: typeof input.marker_color === "string" ? input.marker_color : undefined,
      });
    case "photoshop_resolve_timeline_smart_reframe":
      return photoshop.resolveTimelineSmartReframe();
    case "photoshop_resolve_open_latest":
      return photoshop.resolveOpenLatest();
    case "photoshop_resolve_export_back":
      return photoshop.resolveExportBack({
        format: input.format as ExportFormat | undefined,
        quality: input.quality as number | undefined,
      });
    case "photoshop_list_layers":
      return photoshop.listLayers();
    case "photoshop_selection_info":
      return photoshop.selectionInfo();
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
    case "photoshop_add_adjustment": {
      const type = requireString(input, "type") as
        | "brightness_contrast"
        | "hue_saturation"
        | "color_balance"
        | "curves";
      const params = input.params;
      if (!params || typeof params !== "object") {
        throw new Error('"params" må være et objekt');
      }
      return photoshop.addAdjustment({
        type,
        params: params as Record<string, unknown> as never,
        name: input.name as string | undefined,
        target_layer_name: input.target_layer_name as string | undefined,
      });
    }
    case "photoshop_apply_style": {
      const effects = input.effects;
      if (!effects || typeof effects !== "object") {
        throw new Error('"effects" må være et objekt');
      }
      return photoshop.applyStyle({
        layer_name: requireString(input, "layer_name"),
        effects: effects as never,
      });
    }
    case "photoshop_selection_select": {
      const mode = requireString(input, "mode") as "all" | "none" | "invert";
      if (mode !== "all" && mode !== "none" && mode !== "invert") {
        throw new Error(`Ukjent selection mode: ${mode}`);
      }
      return photoshop.selectionSelect(mode);
    }
    case "photoshop_gen_fill": {
      const prompt = typeof input.prompt === "string" ? input.prompt : "";
      return photoshop.generativeFill(prompt);
    }
    case "photoshop_gen_expand": {
      const targetW = input.target_width;
      const targetH = input.target_height;
      if (typeof targetW !== "number" || targetW <= 0) {
        throw new Error('"target_width" må være et positivt tall');
      }
      if (typeof targetH !== "number" || targetH <= 0) {
        throw new Error('"target_height" må være et positivt tall');
      }
      return photoshop.generativeExpand({
        target_width: targetW,
        target_height: targetH,
        anchor: input.anchor as never,
        prompt: typeof input.prompt === "string" ? input.prompt : undefined,
      });
    }
    case "photoshop_suggest_firefly_prompts": {
      const intent = requireString(input, "intent") as FireflyIntent;
      const ctx: FireflyContext = {
        user_intent: typeof input.user_intent === "string" ? input.user_intent : undefined,
        scene_type: input.scene_type as FireflyContext["scene_type"],
        subject_description: typeof input.subject_description === "string" ? input.subject_description : undefined,
        style_tags: Array.isArray(input.style_tags)
          ? (input.style_tags.filter((t) => typeof t === "string") as string[])
          : undefined,
        lighting: typeof input.lighting === "string" ? input.lighting : undefined,
        time_of_day: input.time_of_day as FireflyContext["time_of_day"],
        target_aspect: typeof input.target_aspect === "string" ? input.target_aspect : undefined,
      };
      const useClaude = input.use_claude === true;
      const suggestions = useClaude
        ? await suggestPromptsViaClaude(intent, ctx)
        : suggestPromptsLocal(intent, ctx);
      return { intent, source: useClaude ? "claude" : "local", suggestions };
    }
    case "photoshop_multi_aspect_export": {
      const aspectsRaw = input.aspects;
      if (!Array.isArray(aspectsRaw) || aspectsRaw.length === 0) {
        throw new Error('"aspects" må være en non-empty array');
      }
      const aspects = aspectsRaw.map((a, i) => {
        if (typeof a !== "string" || !a) throw new Error(`aspects[${i}] må være en string`);
        return a;
      });
      const targetLongEdge = input.target_long_edge;
      if (typeof targetLongEdge !== "number" || targetLongEdge <= 0) {
        throw new Error('"target_long_edge" må være et positivt tall');
      }
      return photoshop.multiAspectExport({
        master_path: requireString(input, "master_path"),
        output_dir: requireString(input, "output_dir"),
        base_name: requireString(input, "base_name"),
        aspects,
        target_long_edge: targetLongEdge,
        format: requireString(input, "format") as ExportFormat,
        quality: input.quality as number | undefined,
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
