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

import {
  photoshop,
  type ExportFormat,
  type SlateMarkerColor,
  SLATE_MARKER_COLORS,
  type ResolvePage,
  RESOLVE_PAGES,
  type ResolveClipColor,
  RESOLVE_CLIP_COLORS,
  type ResolveTrackType,
  type ResolveMarkerColor,
  RESOLVE_MARKER_COLORS,
} from "../services/photoshopBridgeService";
import {
  suggestPromptsLocal,
  suggestPromptsViaClaude,
  type FireflyIntent,
  type FireflyContext,
} from "../lib/fireflyPromptHelper";
import { getCatalog, validateSetting } from "../lib/resolveSettingsCatalog";
import {
  getFusionCatalog,
  type FusionToolCategory,
} from "../lib/fusionToolsCatalog";

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
      "Resolve 21 AI Slate ID: finn slates i video-klipp og opprett markers automatisk. clip_id valgfri (mangler → folder-scope). marker_color må være én av 16 gyldige Resolve-konstanter (default 'Yellow'). Brukes for å auto-organisere klipp etter slate-metadata.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: {
          type: "string",
          description: "MediaPoolItem-id for per-item-analyse. Utelat for folder-scope.",
        },
        marker_color: {
          type: "string",
          enum: [
            "Blue", "Cyan", "Green", "Yellow", "Red", "Pink", "Purple", "Fuchsia",
            "Rose", "Lavender", "Sky", "Mint", "Lemon", "Sand", "Cocoa", "Cream",
          ],
          description: "Marker-farge (default 'Yellow'). Må være én av 16 Resolve-konstanter.",
        },
      },
    },
  },
  {
    name: "photoshop_resolve_intellisearch_analyze",
    description:
      "Resolve 21 AI IntelliSearch: trigger native AI-analyse av folder eller spesifikt MediaPoolItem. identify_faces=true lager person-clusters (krever ekstra tid). better_mode=true gir høyere kvalitet men er treigere. Resultatet skrives ikke til disk her — kjør analyze-intellisearch.lua etterpå og les via photoshop_resolve_read_intellisearch.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: {
          type: "string",
          description: "MediaPoolItem-id for per-item-analyse. Utelat for folder-scope.",
        },
        identify_faces: {
          type: "boolean",
          description: "Identifiser ansikt-clusters. Default false.",
        },
        better_mode: {
          type: "boolean",
          description: "Bruk Better-mode (treigere, høyere kvalitet). Default false (Faster).",
        },
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
    name: "photoshop_resolve_timeline_get_current_item",
    description:
      "Hent referanse til CURRENTLY SELECTED video-klipp på timeline. Returnerer name, frame-range, duration og MediaPoolItem-id. Brukes FØR magic-mask-operasjoner som krever et valgt item.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_magic_mask_create",
    description:
      "Resolve 21 AI Magic Mask: auto-mask av et hovedobjekt på CURRENTLY SELECTED video-item. mode: 'F' forward-tracking (kun fremover fra playhead), 'B' backward, 'BI' bidirectional (default). Krever AI Magic Mask-modell nedlastet. Bruk dette i stedet for Photoshop selection.fromMask når masken skal følge bevegelse over flere frames.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["F", "B", "BI"], description: "Default 'BI' (bidirectional)" },
      },
    },
  },
  {
    name: "photoshop_resolve_magic_mask_regenerate",
    description:
      "Re-trigger eksisterende Magic Mask på CURRENTLY SELECTED video-item. Brukes etter at brukeren har justert mask-control-punkter manuelt og vil at AI'en skal regenerere.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_dolby_vision_analyze",
    description:
      "Resolve 21: Analyser Dolby Vision-metadata på alle items i current timeline. Brukes for HDR-leveranser. Krever Resolve Studio + Dolby Vision-lisens.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_render_add_job",
    description:
      "Legg til render-job i Resolve render queue basert på CURRENT render settings. preset_name kaller LoadRenderPreset først. target_dir/custom_name overstyrer settings før job lages. Returnerer unik job_id som start/delete bruker. Komplettere enn quickExport for proff render-pipeline.",
    input_schema: {
      type: "object",
      properties: {
        preset_name: { type: "string", description: "Load preset før job (valgfri)" },
        target_dir: { type: "string", description: "Override output-mappe" },
        custom_name: { type: "string", description: "Override filnavn" },
      },
    },
  },
  {
    name: "photoshop_resolve_render_list",
    description:
      "List alle jobs i Resolve render queue med job_id + timeline_name + output_filename + status. Brukes for å se hva som er queued før start.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_render_start",
    description:
      "Start render. job_id kjører spesifikk job; utelat for å kjøre alle queued. interactive_mode=true åpner Resolve sin render-dialog først.",
    input_schema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        interactive_mode: { type: "boolean" },
      },
    },
  },
  {
    name: "photoshop_resolve_render_stop",
    description: "Stopp pågående render umiddelbart.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_render_status",
    description: "Returner { in_progress: boolean } — sjekk om render-pipelinen er aktiv.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_render_delete_job",
    description: "Fjern queued job fra render queue. job_id fra render_list.",
    input_schema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "photoshop_resolve_markers_list",
    description:
      "List alle markers på current timeline. Hver marker har frame + color + name + note + duration + custom_data. Brukes for å se hva slate.analyze har funnet eller hva brukeren har manuelt markert.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_markers_add",
    description:
      "Lag en marker på current timeline ved frame N. color (Yellow/Red/Green/Blue/Cyan/Magenta/Pink/Mint/Lavender/Sand/Sea/Forest/Lemon/Cocoa/Cream). duration (default 1), custom_data for å henge metadata på markeren.",
    input_schema: {
      type: "object",
      properties: {
        frame: { type: "number" },
        color: { type: "string", description: "Default 'Yellow'" },
        name: { type: "string" },
        note: { type: "string" },
        duration: { type: "number", description: "Default 1 frame" },
        custom_data: { type: "string", description: "Custom user-data" },
      },
      required: ["frame"],
    },
  },
  {
    name: "photoshop_resolve_markers_delete_by_color",
    description:
      "Slett alle markers av spesifisert farge på current timeline. 'All' sletter alle markers uansett farge.",
    input_schema: {
      type: "object",
      properties: { color: { type: "string", description: "Default 'All'" } },
    },
  },
  {
    name: "photoshop_resolve_grades_copy_to_timeline",
    description:
      "Kopier grade fra CURRENTLY SELECTED video-item til alle andre items på timeline. Brukes for å applisere én grade-look på hele timelinen i ett trekk.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_grades_export_lut",
    description:
      "Eksporter grade fra CURRENTLY SELECTED item som .cube LUT-fil. export_type styrer LUT-presisjon: '17Point' (rask, små filer), '33Point' (standard, default), '65Point' (høy presisjon, store filer).",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolutt sti til .cube output-fil" },
        export_type: {
          type: "string",
          enum: ["17Point", "33Point", "65Point"],
          description: "Default '33Point'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "photoshop_resolve_subtitles_create_from_audio",
    description:
      "Resolve 21 AI Auto-Captions: lager subtitle-track automatisk fra audio på current timeline. Støtter 16 språk inkludert NORWEGIAN. preset: 'DEFAULT' (42 chars/line) eller 'NETFLIX' (16 chars/line). Krever AI Auto-Caption-modell nedlastet (Preferences → AI).",
    input_schema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: [
            "AUTO", "DANISH", "DUTCH", "ENGLISH", "FRENCH", "GERMAN", "ITALIAN",
            "JAPANESE", "KOREAN", "MANDARIN_SIMPLIFIED", "MANDARIN_TRADITIONAL",
            "NORWEGIAN", "PORTUGUESE", "RUSSIAN", "SPANISH", "SWEDISH",
          ],
          description: "Default 'AUTO'",
        },
        preset: { type: "string", enum: ["DEFAULT", "NETFLIX"] },
        chars_per_line: { type: "number", description: "1-60, default 42 (16 for NETFLIX)" },
        line_break: { type: "string", enum: ["SINGLE", "DOUBLE"] },
        gap: { type: "number", description: "0-10 frames mellom captions, default 0" },
      },
    },
  },
  {
    name: "photoshop_resolve_track_add",
    description:
      "Legg til ny track på current timeline. track_type: 'video' (default), 'audio' eller 'subtitle'. sub_track_type for audio kan være 'mono', 'stereo', '5.1', '7.1', '5.1film', '7.1film', 'adaptive1' through 'adaptive24'.",
    input_schema: {
      type: "object",
      properties: {
        track_type: { type: "string", enum: ["video", "audio", "subtitle"] },
        sub_track_type: { type: "string", description: "Audio-only — mono/stereo/5.1/etc." },
      },
      required: ["track_type"],
    },
  },
  {
    name: "photoshop_resolve_track_delete",
    description: "Slett track ved index. 1-basert. Track-type må matche faktisk track-type på timeline.",
    input_schema: {
      type: "object",
      properties: {
        track_type: { type: "string", enum: ["video", "audio", "subtitle"] },
        index: { type: "number" },
      },
      required: ["track_type", "index"],
    },
  },
  {
    name: "photoshop_resolve_track_get_name",
    description: "Hent track-navn for track ved index. Brukes for å vite hva som er på hver track før edit.",
    input_schema: {
      type: "object",
      properties: {
        track_type: { type: "string", enum: ["video", "audio", "subtitle"] },
        index: { type: "number" },
      },
      required: ["track_type", "index"],
    },
  },
  {
    name: "photoshop_resolve_track_set_name",
    description: "Sett navn på track ved index. Praktisk etter add_track for å gi mening til layout.",
    input_schema: {
      type: "object",
      properties: {
        track_type: { type: "string", enum: ["video", "audio", "subtitle"] },
        index: { type: "number" },
        name: { type: "string" },
      },
      required: ["track_type", "index", "name"],
    },
  },
  {
    name: "photoshop_resolve_lut_refresh",
    description:
      "Refresh Resolve sin LUT-liste fra disk. Kjør dette FØR graph.applyLUT hvis brukeren nettopp har lagt LUTs i project-folderen eller master-LUT-folderen.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_graph_get_nodes",
    description:
      "List alle nodes på color-graphen for CURRENTLY SELECTED timeline-item. Returnerer index + label + applied LUT + tools per node. Brukes for å forstå grade-strukturen før edit.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_graph_apply_lut",
    description:
      "Applisere en LUT-fil på spesifikk node i color-graphen til CURRENTLY SELECTED item. lut_path kan være absolutt eller relativ (basert på custom LUT-paths / master LUT-path). Bruk graph.getNodes først for å vite hvilken node-index.",
    input_schema: {
      type: "object",
      properties: {
        node_index: { type: "number", description: "1-basert" },
        lut_path: { type: "string", description: "Absolutt eller relativ sti til .cube" },
      },
      required: ["node_index", "lut_path"],
    },
  },
  {
    name: "photoshop_resolve_graph_apply_grade_from_drx",
    description:
      "Applisere lagret .drx grade-fil på CURRENTLY SELECTED item. grade_mode: 0='No keyframes' (default), 1='Source Timecode aligned', 2='Start Frames aligned'.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolutt sti til .drx-fil" },
        grade_mode: { type: "number", enum: [0, 1, 2] },
      },
      required: ["path"],
    },
  },
  {
    name: "photoshop_resolve_graph_reset_all_grades",
    description:
      "Reset ALLE noder + grades på CURRENTLY SELECTED item. Bruk forsiktig — kan ikke angres uten Resolve sin undo. Vurder history.snapshot via Photoshop FØR du kaller dette hvis du vil ha rollback-mulighet i Post Agent-logikken.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_graph_set_node_enabled",
    description:
      "Skru node av/på på color-graphen. Brukes for å midlertidig deaktivere effekter uten å slette dem.",
    input_schema: {
      type: "object",
      properties: {
        node_index: { type: "number" },
        enabled: { type: "boolean" },
      },
      required: ["node_index", "enabled"],
    },
  },
  {
    name: "photoshop_resolve_voice_get_isolation_state",
    description:
      "Les Voice Isolation-state. Hvis track_index er gitt: les fra audio-track i aktiv timeline. Hvis utelatt: les fra currently selected video item. Returnerer { scope, ref, is_enabled, amount(0-100) }.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "number",
          description: "1-basert audio-track-indeks i timeline. Utelat for å lese fra valgt item.",
        },
      },
    },
  },
  {
    name: "photoshop_resolve_voice_set_isolation_state",
    description:
      "Sett Voice Isolation på audio-track (track_index gitt) eller currently selected item (utelat track_index). amount er 0-100. Bruk dette for å rydde dialog-spor i støyete opptak før eksport. Resolve 21 native AI — gratis, GPU-akselerert.",
    input_schema: {
      type: "object",
      properties: {
        track_index: {
          type: "number",
          description: "1-basert audio-track-indeks. Utelat for å sette på valgt item.",
        },
        is_enabled: { type: "boolean" },
        amount: {
          type: "number",
          description: "Isolation-styrke 0-100. 50 er nøytralt startpunkt.",
        },
      },
      required: ["is_enabled", "amount"],
    },
  },
  {
    name: "photoshop_resolve_gallery_import_stills",
    description:
      "Importer .drx/.dpx/.lut/.cube etc. fra disk inn i Gallery — current album hvis album_name utelates, ellers spesifikt navngitt Stills/PowerGrade-album. Bruk dette for å laste eksterne PowerGrade-presets eller LUT-stills som så kan appliseres via graph.applyGradeFromDRX.",
    input_schema: {
      type: "object",
      properties: {
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Absolutte path til filer som skal importeres (minst én).",
        },
        album_name: {
          type: "string",
          description: "Navn på mål-album. Utelat for å bruke current.",
        },
      },
      required: ["file_paths"],
    },
  },
  {
    name: "photoshop_resolve_subtitle_import_from_file",
    description:
      "Importer en undertekst-fil (.srt / .ass / .vtt) fra disk inn i Media Pool. Hvis append_to_timeline=true blir clipen droppet på aktiv timeline (Resolve velger subtitle-track automatisk basert på filtype). Bruk dette når brukeren har en ekstern transkripsjon eller oversettelses-SRT som skal inn i prosjektet — alternativet er CreateSubtitlesFromAudio som genererer ny tekst.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Absolutt path til subtitle-filen (.srt, .ass, .vtt).",
        },
        append_to_timeline: {
          type: "boolean",
          description: "Drop clipen på aktiv timeline med en gang. Default false (kun Media Pool).",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "photoshop_resolve_project_get_setting",
    description:
      "Les prosjekt-innstilling fra Resolve. Hvis key utelates returneres ALLE settings som dict (timeline-fps, color-space, output-resolusjon, etc.). Bruk dette først for å forstå hva som er konfigurert før du foreslår endringer.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "Setting-nøkkel, f.eks. 'timelineFrameRate', 'colorScienceMode'. Utelat for full snapshot.",
        },
      },
    },
  },
  {
    name: "photoshop_resolve_project_set_setting",
    description:
      "Sett prosjekt-innstilling i Resolve. Resolve godtar kun string-verdier — konverter numbers/bools til strings før kall. ADVARSEL: endrer prosjekt-state; vurder å lese current value først.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Setting-nøkkel." },
        value: { type: "string", description: "Ny verdi som string." },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "photoshop_resolve_timeline_get_setting",
    description:
      "Les timeline-innstilling for aktiv timeline. Hvis key utelates returneres ALLE settings (timeline-fps, resolusjon, output-format, etc.) som dict. Krever aktiv timeline.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Setting-nøkkel. Utelat for full snapshot." },
      },
    },
  },
  {
    name: "photoshop_resolve_timeline_set_setting",
    description:
      "Sett timeline-innstilling for aktiv timeline. Resolve godtar kun string-verdier. ADVARSEL: endrer timeline-state.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Setting-nøkkel." },
        value: { type: "string", description: "Ny verdi som string." },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "photoshop_resolve_page_open",
    description:
      "Bytt til en av Resolves 7 sider. Bruk dette FØR operasjoner som krever spesifikk page-kontekst (f.eks. visse color-operasjoner trenger Color-page aktiv).",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["media", "cut", "edit", "fusion", "color", "fairlight", "deliver"],
        },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_page_current",
    description:
      "Hent currently displayed page i Resolve. Returnerer null hvis ingen prosjekt åpen.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_clip_get_property",
    description:
      "Les clip-attribute fra MediaPoolItem (fps, resolution, codec, audio-channels, etc.). Når key utelates returneres ALLE properties som dict — bruk dette for å forstå hva som finnes før spesifikke spørringer.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "MediaPoolItem-id." },
        key: { type: "string", description: "Property-nøkkel. Utelat for full dict." },
      },
      required: ["clip_id"],
    },
  },
  {
    name: "photoshop_resolve_clip_set_property",
    description:
      "Sett clip-attribute på MediaPoolItem. Strings only. ADVARSEL: endrer clip-metadata permanent.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["clip_id", "key", "value"],
    },
  },
  {
    name: "photoshop_resolve_timeline_get_current_timecode",
    description:
      "Les playhead-timecode (HH:MM:SS:FF) fra aktiv timeline. Krever at Resolve er på Cut/Edit/Color/Fairlight/Deliver-page.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_timeline_set_current_timecode",
    description:
      "Flytt playhead til timecode (HH:MM:SS:FF). Nyttig før operasjoner som virker på current frame (export still, magic mask, add marker).",
    input_schema: {
      type: "object",
      properties: {
        timecode: { type: "string", description: "HH:MM:SS:FF" },
      },
      required: ["timecode"],
    },
  },
  {
    name: "photoshop_resolve_timeline_get_item_list_in_track",
    description:
      "List alle items på en spesifikk timeline-track. Returnerer name + start/end/duration i frames per item. Bruk dette for å mappe tidslinjen før jump-operations.",
    input_schema: {
      type: "object",
      properties: {
        track_type: {
          type: "string",
          enum: ["video", "audio", "subtitle"],
          description: "Default 'video'.",
        },
        track_index: { type: "number", description: "1-basert track-indeks." },
      },
      required: ["track_index"],
    },
  },
  {
    name: "photoshop_resolve_clip_get_color",
    description:
      "Les clip-color-label (Orange/Yellow/Green/etc.) — fra MediaPoolItem hvis clip_id, ellers fra currently selected timeline-item.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "Utelat for selected timeline-item." },
      },
    },
  },
  {
    name: "photoshop_resolve_clip_set_color",
    description:
      "Sett clip-color-label på MediaPoolItem (med clip_id) eller selected timeline-item. Brukes for workflow-organisering: 'merk uvurderte klipp gule', 'merk dårlig audio rød', etc. 16 gyldige farger.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        color: {
          type: "string",
          enum: [
            "Orange", "Apricot", "Yellow", "Lime", "Olive", "Green", "Teal", "Navy",
            "Blue", "Purple", "Violet", "Pink", "Tan", "Beige", "Brown", "Chocolate",
          ],
        },
      },
      required: ["color"],
    },
  },
  {
    name: "photoshop_resolve_clip_clear_color",
    description: "Fjern clip-color-label fra MediaPoolItem eller selected timeline-item.",
    input_schema: {
      type: "object",
      properties: { clip_id: { type: "string" } },
    },
  },
  {
    name: "photoshop_resolve_clip_markers_list",
    description:
      "List ALLE markers på MediaPoolItem (frameId → {color, name, note, duration, customData}). Bruk dette for å lese ekte AI-Slate-markers fra slate_analyze, eller manuelt-satte review-markers.",
    input_schema: {
      type: "object",
      properties: { clip_id: { type: "string" } },
      required: ["clip_id"],
    },
  },
  {
    name: "photoshop_resolve_clip_markers_add",
    description:
      "Opprett en marker på MediaPoolItem ved frame_id. Brukes for å tagge interessante frames (highlight, retake, color-mismatch) som review-notater. 16 marker-farger.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        frame_id: { type: "number", description: "0-basert frame i kildeklippet." },
        color: {
          type: "string",
          enum: [
            "Blue", "Cyan", "Green", "Yellow", "Red", "Pink", "Purple", "Fuchsia",
            "Rose", "Lavender", "Sky", "Mint", "Lemon", "Sand", "Cocoa", "Cream",
          ],
        },
        name: { type: "string" },
        note: { type: "string" },
        duration: { type: "number", description: "Frames. Default 1." },
        custom_data: { type: "string", description: "Valgfri payload for lookup." },
      },
      required: ["clip_id", "frame_id"],
    },
  },
  {
    name: "photoshop_resolve_clip_markers_delete_by_color",
    description:
      "Slett alle markers av en farge på MediaPoolItem. Bruk 'All' for å slette alle.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        color: {
          type: "string",
          description:
            "Marker-farge (Blue/Cyan/Green/Yellow/Red/Pink/Purple/Fuchsia/Rose/Lavender/Sky/Mint/Lemon/Sand/Cocoa/Cream) eller 'All'.",
        },
      },
      required: ["clip_id", "color"],
    },
  },
  {
    name: "photoshop_resolve_clip_markers_delete_at_frame",
    description: "Slett marker på spesifikk frame i MediaPoolItem.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string" },
        frame_id: { type: "number" },
      },
      required: ["clip_id", "frame_id"],
    },
  },
  {
    name: "photoshop_resolve_version_add",
    description:
      "Opprett ny color version på currently selected timeline-item. version_type 0=local (default), 1=remote. Bruk dette FØR eksperimentell grading så brukeren kan switche tilbake.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version_type: { type: "number", enum: [0, 1] },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_version_get_current",
    description:
      "Hent navn + type på currently active color version for selected timeline-item.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_version_get_names",
    description: "List alle color version-navn for selected timeline-item (default local).",
    input_schema: {
      type: "object",
      properties: { version_type: { type: "number", enum: [0, 1] } },
    },
  },
  {
    name: "photoshop_resolve_version_load",
    description: "Bytt til color version på selected timeline-item.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version_type: { type: "number", enum: [0, 1] },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_version_rename",
    description: "Døp om color version på selected timeline-item.",
    input_schema: {
      type: "object",
      properties: {
        old_name: { type: "string" },
        new_name: { type: "string" },
        version_type: { type: "number", enum: [0, 1] },
      },
      required: ["old_name", "new_name"],
    },
  },
  {
    name: "photoshop_resolve_version_delete",
    description: "Slett color version på selected timeline-item.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version_type: { type: "number", enum: [0, 1] },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_folder_list_all",
    description:
      "List ALLE Media Pool-folders rekursivt med path/name/clip_count/subfolder_count. Bruk dette først når du skal organisere klipp — du må vite hva som finnes før du kan flytte ting.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_folder_get_current",
    description:
      "Hent currently selected Media Pool folder (navn + telling). Bruk dette for å forstå hvilken kontekst brukeren jobber i.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_folder_set_current",
    description:
      "Bytt selected Media Pool folder via path. Path er '/'-separert (eksempel: 'Master/Wedding/Day 1'). 'Master' er root. ImportMedia uten target-folder lander i current — bruk dette FØR import-operasjoner.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "F.eks. 'Master/Wedding/Day 1'." },
      },
      required: ["path"],
    },
  },
  {
    name: "photoshop_resolve_folder_create",
    description:
      "Opprett ny undermappe under parent_path. Hvis parent_path utelates blir den lagt under root (Master). Bruk dette for å organisere store prosjekter ('A-Roll', 'B-Roll', 'Approved', 'Pending Review').",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Navn på den nye mappa." },
        parent_path: {
          type: "string",
          description: "Path til parent (default root/Master).",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_folder_move_clips",
    description:
      "Flytt MediaPoolItems til target folder. clip_ids er array av MediaPoolItem-IDer. Bruk dette for batch-organisering — 'flytt alle approved-klipp til Master/Approved' etter en review-runde.",
    input_schema: {
      type: "object",
      properties: {
        clip_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array av MediaPoolItem-IDer som skal flyttes (minst én).",
        },
        target_path: {
          type: "string",
          description: "Folder-path mål (f.eks. 'Master/Approved').",
        },
      },
      required: ["clip_ids", "target_path"],
    },
  },
  {
    name: "photoshop_resolve_pm_get_info",
    description:
      "Snapshot fra Project Manager: currently loaded project, current PM-folder, projects + subfolders i denne folderen. PM-folders er DATABASE-folders (ulik Media Pool-folders). Én call dekker alt for navigasjon.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_pm_create_project",
    description:
      "Opprett nytt Resolve-prosjekt i current PM-folder. Returnerer feil hvis duplikat-navn. media_path er valgfri media-location-path.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        media_path: { type: "string", description: "Valgfri media-location-path." },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_pm_load_project",
    description:
      "Last et eksisterende prosjekt fra current PM-folder. Project må finnes i SAMME folder som pm.getInfo viser — navigér først med pm.navigateFolder hvis nødvendig.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_pm_save_project",
    description: "Lagre currently loaded prosjekt med eksisterende navn.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_pm_delete_project",
    description:
      "Slett prosjekt fra current PM-folder. Kan IKKE slette currently loaded — bytt eller close først. ADVARSEL: irreversibel.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_pm_create_folder",
    description:
      "Opprett ny PM-folder under current PM-folder. Returnerer feil hvis duplikat-navn.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_pm_navigate_folder",
    description:
      "Bytt current PM-folder. 'root' går til root, 'parent' går opp ett nivå, ellers behandles 'to' som folder-navn under nåværende folder (OpenFolder).",
    input_schema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "'root', 'parent', eller folder-navn å åpne.",
        },
      },
      required: ["to"],
    },
  },
  {
    name: "photoshop_resolve_fusion_get_comp_names",
    description:
      "List alle Fusion-comps på currently selected timeline-item. Returnerer item-navn + count + array av comp-navn. Bruk dette først for å forstå hva som finnes før load/rename/delete-operasjoner.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_fusion_add_comp",
    description:
      "Opprett en ny tom Fusion-comp på selected timeline-item. Brukes for å starte motion-graphics/title-arbeid uten å gå manuelt inn på Fusion-page.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_fusion_load_comp",
    description:
      "Bytt til en navngitt Fusion-comp som active på selected timeline-item (samme item kan ha flere comps).",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_rename_comp",
    description: "Døp om Fusion-comp på selected timeline-item.",
    input_schema: {
      type: "object",
      properties: {
        old_name: { type: "string" },
        new_name: { type: "string" },
      },
      required: ["old_name", "new_name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_delete_comp",
    description:
      "Slett Fusion-comp på selected timeline-item. ADVARSEL: irreversibel.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_import_comp",
    description:
      "Importer en Fusion .setting-fil fra disk og legg den til selected timeline-item som en ny comp.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolutt path til .setting-fil.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "photoshop_resolve_fusion_export_comp",
    description:
      "Eksporter en Fusion-comp (1-basert comp_index) på selected timeline-item til disk som .setting-fil.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        comp_index: { type: "number", description: "1-basert indeks." },
      },
      required: ["path", "comp_index"],
    },
  },
  {
    name: "photoshop_resolve_settings_reference",
    description:
      "Hent katalog over kjente Resolve project/timeline/clip setting-keys med valid value-formats og enum-verdier. Bruk dette FØR du kaller setSetting/clipSetProperty for å vite hvilke nøkler som finnes og hva som er gyldige verdier (f.eks. timelineFrameRate krever '24' ikke 24, colorScienceMode er enum). Filter på scope ('project'/'timeline'/'clip') og kategori for å minske respons-størrelse.",
    input_schema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["project", "timeline", "clip"],
          description: "Filter på scope. Utelat for alle.",
        },
        category: {
          type: "string",
          description:
            "Filter på kategori: timeline, monitoring, colorScience, ai, performance, audio, cameraRaw, delivery, metadata.",
        },
      },
    },
  },
  {
    name: "photoshop_resolve_media_pool_import_timeline_from_file",
    description:
      "Importer ferdig timeline-skjelett fra fil. Støtter .aaf/.edl/.xml/.fcpxml/.drt/.adl/.otio. .drt er DaVinci Resolve Timeline-mal (typisk brukt for repetitive prosjekt-skjeletter — Wedding A/B-roll-struktur, Promo-mal). NB: timeline_name + import_source_clips ignoreres for DRT. interlace_processing kun for AAF.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Absolutt path til .aaf/.edl/.xml/.fcpxml/.drt/.adl/.otio-fil.",
        },
        timeline_name: {
          type: "string",
          description: "Navn på den nye timelinen (ikke gyldig for DRT).",
        },
        import_source_clips: {
          type: "boolean",
          description: "Default true. Sett false for å kun importere timeline-struktur.",
        },
        source_clips_path: {
          type: "string",
          description: "Fallback-path å lete etter source clips hvis original-paths er døde.",
        },
        interlace_processing: {
          type: "boolean",
          description: "AAF-only: aktiver interlace-prosessering.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "photoshop_resolve_media_pool_delete_timelines",
    description:
      "Slett en eller flere timelines fra Media Pool ved navn. ADVARSEL: irreversibel.",
    input_schema: {
      type: "object",
      properties: {
        timeline_names: {
          type: "array",
          items: { type: "string" },
          description: "Array av timeline-navn (minst én).",
        },
      },
      required: ["timeline_names"],
    },
  },
  {
    name: "photoshop_resolve_pm_import_project",
    description:
      "Importer .drp-prosjekt-arkiv inn i current PM-folder. project_name overstyrer navn i .drp. Hele operasjonen kan ta minutter (timeout 300s).",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Absolutt path til .drp-fil.",
        },
        project_name: {
          type: "string",
          description: "Overstyr navn i .drp.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "photoshop_resolve_pm_export_project",
    description:
      "Eksporter et prosjekt fra current PM-folder som .drp-arkiv. Default tar med stills og LUTs. Kan ta minutter — timeout 600s.",
    input_schema: {
      type: "object",
      properties: {
        project_name: { type: "string" },
        file_path: { type: "string", description: "Output .drp-path." },
        with_stills_and_luts: {
          type: "boolean",
          description: "Default true.",
        },
      },
      required: ["project_name", "file_path"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_get_info",
    description:
      "Snapshot av Fusion-comp på selected timeline-item. Returnerer {comp_name, tool_count, tools: [{name, type}]}. comp_name valgfri — utelat for å bruke siste comp i listen. Bruk FØR addTool/setInput for å se hva som finnes.",
    input_schema: {
      type: "object",
      properties: {
        comp_name: {
          type: "string",
          description: "Comp-navn (fra fusion.getCompNames). Utelat for siste comp.",
        },
      },
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_add_tool",
    description:
      "Legg til en Fusion-node i comp på selected timeline-item. tool_type må være en gyldig RegID (kall photoshop_resolve_fusion_tools_reference for liste). Returnerer name + posisjon. Bruk dette for å bygge titler ('TextPlus'), bakgrunn ('Background'), comp ('Merge'), effekter ('Blur', 'Glow').",
    input_schema: {
      type: "object",
      properties: {
        tool_type: {
          type: "string",
          description:
            "Tool RegID, f.eks. 'TextPlus', 'Background', 'Merge', 'Blur'. Case-sensitivt.",
        },
        name: {
          type: "string",
          description: "Override default tool-navn (settes via SetAttrs).",
        },
        x: { type: "number", description: "Node-graph X-posisjon (default -1)." },
        y: { type: "number", description: "Node-graph Y-posisjon (default -1)." },
        comp_name: { type: "string" },
      },
      required: ["tool_type"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_delete_tool",
    description: "Slett en Fusion-node ved navn.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        comp_name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_set_input",
    description:
      "Sett en input på en Fusion-node. value tolkes som tall ('1.0'), boolean ('true'/'false') eller string. Bruk reference-tool for å se common inputs per tool-type.",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: {
          type: "string",
          description: "F.eks. 'StyledText', 'Size', 'TopLeftRed', 'XBlurSize'.",
        },
        value: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
          description: "Verdi — konverteres til string for transport.",
        },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name", "value"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_connect_input",
    description:
      "Koble en src-tool's output til en dest-tool's input. Standard src_output = 'Output'. Eksempel: Merge.Background ← Background.Output.",
    input_schema: {
      type: "object",
      properties: {
        dest_tool: { type: "string" },
        dest_input: { type: "string", description: "F.eks. 'Foreground', 'Background', 'Input'." },
        src_tool: { type: "string" },
        src_output: {
          type: "string",
          description: "Default 'Output'.",
        },
        comp_name: { type: "string" },
      },
      required: ["dest_tool", "dest_input", "src_tool"],
    },
  },
  {
    name: "photoshop_resolve_fusion_tools_reference",
    description:
      "Hent katalog over vanlige Fusion tool-types (med tool_type RegID + common inputs). Bruk FØR fusionComp.addTool. Kategorier: generator, effect, merge, text, transform, mask, color, tracker, output.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "generator",
            "effect",
            "merge",
            "text",
            "transform",
            "mask",
            "color",
            "tracker",
            "output",
          ],
        },
      },
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_add_keyframe",
    description:
      "Animér en Fusion-input — oppretter keyframe på spesifikt frame med spesifikk verdi. Hvis input ikke er animert fra før, kobles automatisk en BezierSpline til den. Brukes for fade-in (Blend over frames), tittel-reveal (Size 0→1), pan/zoom (Center.X over tid). Bruk fusionComp.tools_reference for å se common inputs per tool.",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: {
          type: "string",
          description: "F.eks. 'StyledText', 'Blend', 'Size', 'Center'.",
        },
        time: {
          type: "number",
          description: "Frame-number (kan være float for sub-frame).",
        },
        value: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
          description: "Verdi ved dette frame.",
        },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name", "time", "value"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_remove_keyframe",
    description:
      "Slett keyframe ved et spesifikt frame. Disconnecter ikke splinen — fjerner bare keyframen.",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: { type: "string" },
        time: { type: "number" },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name", "time"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_list_keyframes",
    description:
      "List alle keyframes på en input. Returnerer { animated, keyframes: [{time, value}, ...] }. Hvis input ikke er animert: animated=false, keyframes=[].",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: { type: "string" },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_set_expression",
    description:
      "Bind en input til en expression. Expression er Fusion-script som evalueres per frame. Eksempler: 'time/100' (rampe 0→1 over 100 frames), 'sin(time/10)' (oscillering), 'Background1.Size' (mirror annen input). Tom string rydder expression. ALTERNATIV til keyframes — bruk én eller den andre, ikke begge.",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: { type: "string" },
        expression: {
          type: "string",
          description: "Fusion-script-expression. Tom for å rydde.",
        },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name", "expression"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_remove_animation",
    description:
      "Rydd ALL animasjon på en input — disconnecter spline + rydder expression. Verdi blir statisk på nåværende snapshot. Bruk dette for å reset en input før ny animasjon, eller for å frigjøre input fra tracker-binding.",
    input_schema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        input_name: { type: "string" },
        comp_name: { type: "string" },
      },
      required: ["tool_name", "input_name"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_set_render_range",
    description:
      "Sett Fusion-comp sin render-range (start og end frame). Påvirker både Global og Render-range. Bruk dette FØR animasjon for å definere hvor lenge comp-en er.",
    input_schema: {
      type: "object",
      properties: {
        start: { type: "number", description: "Frame-number for start." },
        end: { type: "number", description: "Frame-number for end (>= start)." },
        comp_name: { type: "string" },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "photoshop_resolve_fusion_comp_set_current_time",
    description:
      "Flytt Fusion-comp playhead til spesifikt frame. Påvirker hva SetInput uten time-arg skriver til (creates keyframe at this time if input is animated).",
    input_schema: {
      type: "object",
      properties: {
        time: { type: "number" },
        comp_name: { type: "string" },
      },
      required: ["time"],
    },
  },
  {
    name: "photoshop_resolve_clip_stabilize",
    description:
      "Trigg AI stabilisering på currently selected timeline-item. Bruker prosjekt-/timeline-stabiliserings-settings (useStabilizationSmoothCam m.fl. — sett dem først via setSetting). Kan ta opptil 3 min på lange klipp.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_folder_intelli_reset",
    description:
      "Slett IntelliSearch-analyse på current MediaPool-folder. Brukes før re-analyse med andre settings (better-mode på/av, identifyFaces på/av) for å sikre ren start.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "photoshop_resolve_clip_load_burn_in_preset",
    description:
      "Last data burn-in preset (timecode, clip-name, custom-data overlays) på selected timeline-item. preset_name må matche et eksisterende preset i Resolves burn-in-bibliotek (Workspace → Data Burn-In).",
    input_schema: {
      type: "object",
      properties: {
        preset_name: {
          type: "string",
          description: "Navn på burn-in preset (f.eks. 'Timecode + Clip Name').",
        },
      },
      required: ["preset_name"],
    },
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
    case "photoshop_resolve_slate_analyze": {
      let markerColor: SlateMarkerColor | undefined;
      if (typeof input.marker_color === "string") {
        if (!(SLATE_MARKER_COLORS as readonly string[]).includes(input.marker_color)) {
          throw new Error(
            `Ugyldig marker_color: ${input.marker_color} (gyldige: ${SLATE_MARKER_COLORS.join(", ")})`,
          );
        }
        markerColor = input.marker_color as SlateMarkerColor;
      }
      return photoshop.resolveSlateAnalyze({
        clip_id: typeof input.clip_id === "string" ? input.clip_id : undefined,
        marker_color: markerColor,
      });
    }
    case "photoshop_resolve_intellisearch_analyze":
      return photoshop.resolveIntellisearchAnalyze({
        clip_id: typeof input.clip_id === "string" ? input.clip_id : undefined,
        identify_faces: input.identify_faces === true,
        better_mode: input.better_mode === true,
      });
    case "photoshop_resolve_timeline_smart_reframe":
      return photoshop.resolveTimelineSmartReframe();
    case "photoshop_resolve_timeline_get_current_item":
      return photoshop.resolveTimelineGetCurrentItem();
    case "photoshop_resolve_magic_mask_create":
      return photoshop.resolveMagicMaskCreate(
        input.mode as "F" | "B" | "BI" | undefined,
      );
    case "photoshop_resolve_magic_mask_regenerate":
      return photoshop.resolveMagicMaskRegenerate();
    case "photoshop_resolve_dolby_vision_analyze":
      return photoshop.resolveDolbyVisionAnalyze();
    case "photoshop_resolve_render_add_job":
      return photoshop.resolveRenderAddJob({
        preset_name: typeof input.preset_name === "string" ? input.preset_name : undefined,
        target_dir: typeof input.target_dir === "string" ? input.target_dir : undefined,
        custom_name: typeof input.custom_name === "string" ? input.custom_name : undefined,
      });
    case "photoshop_resolve_render_list":
      return photoshop.resolveRenderList();
    case "photoshop_resolve_render_start":
      return photoshop.resolveRenderStart({
        job_id: typeof input.job_id === "string" ? input.job_id : undefined,
        interactive_mode: input.interactive_mode === true,
      });
    case "photoshop_resolve_render_stop":
      return photoshop.resolveRenderStop();
    case "photoshop_resolve_render_status":
      return photoshop.resolveRenderStatus();
    case "photoshop_resolve_render_delete_job":
      return photoshop.resolveRenderDeleteJob(requireString(input, "job_id"));
    case "photoshop_resolve_markers_list":
      return photoshop.resolveMarkersList();
    case "photoshop_resolve_markers_add": {
      const frame = input.frame;
      if (typeof frame !== "number") {
        throw new Error("frame må være et tall");
      }
      return photoshop.resolveMarkersAdd({
        frame,
        color: typeof input.color === "string" ? input.color : undefined,
        name: typeof input.name === "string" ? input.name : undefined,
        note: typeof input.note === "string" ? input.note : undefined,
        duration: typeof input.duration === "number" ? input.duration : undefined,
        custom_data: typeof input.custom_data === "string" ? input.custom_data : undefined,
      });
    }
    case "photoshop_resolve_markers_delete_by_color":
      return photoshop.resolveMarkersDeleteByColor(
        typeof input.color === "string" ? input.color : undefined,
      );
    case "photoshop_resolve_grades_copy_to_timeline":
      return photoshop.resolveGradesCopyToTimeline();
    case "photoshop_resolve_grades_export_lut":
      return photoshop.resolveGradesExportLUT({
        path: requireString(input, "path"),
        export_type: input.export_type as "17Point" | "33Point" | "65Point" | undefined,
      });
    case "photoshop_resolve_subtitles_create_from_audio":
      return photoshop.resolveSubtitlesCreateFromAudio({
        language: input.language as never,
        preset: input.preset as "DEFAULT" | "NETFLIX" | undefined,
        chars_per_line: typeof input.chars_per_line === "number" ? input.chars_per_line : undefined,
        line_break: input.line_break as "SINGLE" | "DOUBLE" | undefined,
        gap: typeof input.gap === "number" ? input.gap : undefined,
      });
    case "photoshop_resolve_track_add":
      return photoshop.resolveTrackAdd({
        track_type: requireString(input, "track_type") as "video" | "audio" | "subtitle",
        sub_track_type: typeof input.sub_track_type === "string" ? input.sub_track_type : undefined,
      });
    case "photoshop_resolve_track_delete": {
      const index = input.index;
      if (typeof index !== "number") throw new Error("index må være et tall");
      return photoshop.resolveTrackDelete({
        track_type: requireString(input, "track_type") as "video" | "audio" | "subtitle",
        index,
      });
    }
    case "photoshop_resolve_track_get_name": {
      const index = input.index;
      if (typeof index !== "number") throw new Error("index må være et tall");
      return photoshop.resolveTrackGetName({
        track_type: requireString(input, "track_type") as "video" | "audio" | "subtitle",
        index,
      });
    }
    case "photoshop_resolve_track_set_name": {
      const index = input.index;
      if (typeof index !== "number") throw new Error("index må være et tall");
      return photoshop.resolveTrackSetName({
        track_type: requireString(input, "track_type") as "video" | "audio" | "subtitle",
        index,
        name: requireString(input, "name"),
      });
    }
    case "photoshop_resolve_lut_refresh":
      return photoshop.resolveLutRefresh();
    case "photoshop_resolve_graph_get_nodes":
      return photoshop.resolveGraphGetNodes();
    case "photoshop_resolve_graph_apply_lut": {
      const nodeIndex = input.node_index;
      if (typeof nodeIndex !== "number") throw new Error("node_index må være et tall");
      return photoshop.resolveGraphApplyLUT({
        node_index: nodeIndex,
        lut_path: requireString(input, "lut_path"),
      });
    }
    case "photoshop_resolve_graph_apply_grade_from_drx": {
      const gradeMode = input.grade_mode;
      return photoshop.resolveGraphApplyGradeFromDRX({
        path: requireString(input, "path"),
        grade_mode: typeof gradeMode === "number" && gradeMode >= 0 && gradeMode <= 2
          ? (gradeMode as 0 | 1 | 2)
          : undefined,
      });
    }
    case "photoshop_resolve_graph_reset_all_grades":
      return photoshop.resolveGraphResetAllGrades();
    case "photoshop_resolve_graph_set_node_enabled": {
      const nodeIndex = input.node_index;
      if (typeof nodeIndex !== "number") throw new Error("node_index må være et tall");
      return photoshop.resolveGraphSetNodeEnabled({
        node_index: nodeIndex,
        enabled: input.enabled === true,
      });
    }
    case "photoshop_resolve_voice_get_isolation_state": {
      const params: { track_index?: number } = {};
      if (typeof input.track_index === "number") params.track_index = input.track_index;
      return photoshop.resolveVoiceGetIsolationState(params);
    }
    case "photoshop_resolve_voice_set_isolation_state": {
      const amount = input.amount;
      if (typeof amount !== "number") throw new Error("amount må være et tall (0-100)");
      if (amount < 0 || amount > 100) throw new Error("amount må være 0-100");
      const params: { track_index?: number; is_enabled: boolean; amount: number } = {
        is_enabled: input.is_enabled === true,
        amount,
      };
      if (typeof input.track_index === "number") params.track_index = input.track_index;
      return photoshop.resolveVoiceSetIsolationState(params);
    }
    case "photoshop_resolve_gallery_import_stills": {
      const filePaths = input.file_paths;
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error("file_paths må være en ikke-tom array");
      }
      for (const p of filePaths) {
        if (typeof p !== "string") throw new Error("Alle file_paths må være strings");
      }
      const params: { file_paths: string[]; album_name?: string } = {
        file_paths: filePaths as string[],
      };
      if (typeof input.album_name === "string" && input.album_name.length > 0) {
        params.album_name = input.album_name;
      }
      return photoshop.resolveGalleryImportStills(params);
    }
    case "photoshop_resolve_subtitle_import_from_file": {
      const filePath = input.file_path;
      if (typeof filePath !== "string" || filePath.length === 0) {
        throw new Error("file_path må være en ikke-tom string");
      }
      return photoshop.resolveSubtitleImportFromFile({
        file_path: filePath,
        append_to_timeline: input.append_to_timeline === true,
      });
    }
    case "photoshop_resolve_project_get_setting":
      return photoshop.resolveProjectGetSetting({
        key: typeof input.key === "string" ? input.key : undefined,
      });
    case "photoshop_resolve_project_set_setting": {
      if (typeof input.key !== "string" || input.key.length === 0) {
        throw new Error("key må være en ikke-tom string");
      }
      if (typeof input.value !== "string") {
        throw new Error("value må være en string (Resolve godtar kun string-verdier)");
      }
      const v = validateSetting("project", input.key, input.value);
      if (!v.ok) {
        throw new Error(
          `${v.warning}. Kall photoshop_resolve_settings_reference for å se gyldige verdier.`,
        );
      }
      return photoshop.resolveProjectSetSetting({ key: input.key, value: input.value });
    }
    case "photoshop_resolve_timeline_get_setting":
      return photoshop.resolveTimelineGetSetting({
        key: typeof input.key === "string" ? input.key : undefined,
      });
    case "photoshop_resolve_timeline_set_setting": {
      if (typeof input.key !== "string" || input.key.length === 0) {
        throw new Error("key må være en ikke-tom string");
      }
      if (typeof input.value !== "string") {
        throw new Error("value må være en string (Resolve godtar kun string-verdier)");
      }
      const v = validateSetting("timeline", input.key, input.value);
      if (!v.ok) {
        throw new Error(
          `${v.warning}. Kall photoshop_resolve_settings_reference for å se gyldige verdier.`,
        );
      }
      return photoshop.resolveTimelineSetSetting({ key: input.key, value: input.value });
    }
    case "photoshop_resolve_page_open": {
      const name = input.name;
      if (typeof name !== "string" || !(RESOLVE_PAGES as readonly string[]).includes(name)) {
        throw new Error(
          `Ugyldig page-name: ${String(name)} (gyldige: ${RESOLVE_PAGES.join(", ")})`,
        );
      }
      return photoshop.resolvePageOpen({ name: name as ResolvePage });
    }
    case "photoshop_resolve_page_current":
      return photoshop.resolvePageCurrent();
    case "photoshop_resolve_clip_get_property": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      return photoshop.resolveClipGetProperty({
        clip_id: input.clip_id,
        key: typeof input.key === "string" ? input.key : undefined,
      });
    }
    case "photoshop_resolve_clip_set_property": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      if (typeof input.key !== "string" || input.key.length === 0) {
        throw new Error("key må være en ikke-tom string");
      }
      if (typeof input.value !== "string") {
        throw new Error("value må være en string (Resolve godtar kun string-verdier)");
      }
      const v = validateSetting("clip", input.key, input.value);
      if (!v.ok) {
        throw new Error(
          `${v.warning}. Kall photoshop_resolve_settings_reference for å se gyldige verdier.`,
        );
      }
      return photoshop.resolveClipSetProperty({
        clip_id: input.clip_id,
        key: input.key,
        value: input.value,
      });
    }
    case "photoshop_resolve_timeline_get_current_timecode":
      return photoshop.resolveTimelineGetCurrentTimecode();
    case "photoshop_resolve_timeline_set_current_timecode": {
      if (typeof input.timecode !== "string" || input.timecode.length === 0) {
        throw new Error("timecode må være en string (HH:MM:SS:FF)");
      }
      return photoshop.resolveTimelineSetCurrentTimecode({ timecode: input.timecode });
    }
    case "photoshop_resolve_timeline_get_item_list_in_track": {
      const VALID: ResolveTrackType[] = ["video", "audio", "subtitle"];
      const trackType =
        typeof input.track_type === "string" && (VALID as readonly string[]).includes(input.track_type)
          ? (input.track_type as ResolveTrackType)
          : "video";
      if (typeof input.track_index !== "number" || input.track_index < 1) {
        throw new Error("track_index må være et tall >= 1");
      }
      return photoshop.resolveTimelineGetItemListInTrack({
        track_type: trackType,
        track_index: input.track_index,
      });
    }
    case "photoshop_resolve_clip_get_color":
      return photoshop.resolveClipGetColor({
        clip_id: typeof input.clip_id === "string" && input.clip_id.length > 0 ? input.clip_id : undefined,
      });
    case "photoshop_resolve_clip_set_color": {
      const color = input.color;
      if (typeof color !== "string" || !(RESOLVE_CLIP_COLORS as readonly string[]).includes(color)) {
        throw new Error(
          `Ugyldig color: ${String(color)} (gyldige: ${RESOLVE_CLIP_COLORS.join(", ")})`,
        );
      }
      return photoshop.resolveClipSetColor({
        clip_id: typeof input.clip_id === "string" && input.clip_id.length > 0 ? input.clip_id : undefined,
        color: color as ResolveClipColor,
      });
    }
    case "photoshop_resolve_clip_clear_color":
      return photoshop.resolveClipClearColor({
        clip_id: typeof input.clip_id === "string" && input.clip_id.length > 0 ? input.clip_id : undefined,
      });
    case "photoshop_resolve_clip_markers_list": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      return photoshop.resolveClipMarkersList({ clip_id: input.clip_id });
    }
    case "photoshop_resolve_clip_markers_add": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      if (typeof input.frame_id !== "number" || input.frame_id < 0) {
        throw new Error("frame_id må være et tall >= 0");
      }
      let color: ResolveMarkerColor | undefined;
      if (typeof input.color === "string") {
        if (!(RESOLVE_MARKER_COLORS as readonly string[]).includes(input.color)) {
          throw new Error(
            `Ugyldig color: ${input.color} (gyldige: ${RESOLVE_MARKER_COLORS.join(", ")})`,
          );
        }
        color = input.color as ResolveMarkerColor;
      }
      return photoshop.resolveClipMarkersAdd({
        clip_id: input.clip_id,
        frame_id: input.frame_id,
        color,
        name: typeof input.name === "string" ? input.name : undefined,
        note: typeof input.note === "string" ? input.note : undefined,
        duration: typeof input.duration === "number" ? input.duration : undefined,
        custom_data: typeof input.custom_data === "string" ? input.custom_data : undefined,
      });
    }
    case "photoshop_resolve_clip_markers_delete_by_color": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      if (typeof input.color !== "string" || input.color.length === 0) {
        throw new Error("color må være en ikke-tom string (eller 'All')");
      }
      if (
        input.color !== "All" &&
        !(RESOLVE_MARKER_COLORS as readonly string[]).includes(input.color)
      ) {
        throw new Error(
          `Ugyldig color: ${input.color} (gyldige: ${RESOLVE_MARKER_COLORS.join(", ")}, All)`,
        );
      }
      return photoshop.resolveClipMarkersDeleteByColor({
        clip_id: input.clip_id,
        color: input.color as ResolveMarkerColor | "All",
      });
    }
    case "photoshop_resolve_clip_markers_delete_at_frame": {
      if (typeof input.clip_id !== "string" || input.clip_id.length === 0) {
        throw new Error("clip_id må være en ikke-tom string");
      }
      if (typeof input.frame_id !== "number" || input.frame_id < 0) {
        throw new Error("frame_id må være et tall >= 0");
      }
      return photoshop.resolveClipMarkersDeleteAtFrame({
        clip_id: input.clip_id,
        frame_id: input.frame_id,
      });
    }
    case "photoshop_resolve_version_add": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const vt = input.version_type === 1 ? 1 : 0;
      return photoshop.resolveVersionAdd({ name: input.name, version_type: vt });
    }
    case "photoshop_resolve_version_get_current":
      return photoshop.resolveVersionGetCurrent();
    case "photoshop_resolve_version_get_names": {
      const vt = input.version_type === 1 ? 1 : 0;
      return photoshop.resolveVersionGetNames({ version_type: vt });
    }
    case "photoshop_resolve_version_load": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const vt = input.version_type === 1 ? 1 : 0;
      return photoshop.resolveVersionLoad({ name: input.name, version_type: vt });
    }
    case "photoshop_resolve_version_rename": {
      if (typeof input.old_name !== "string" || input.old_name.length === 0) {
        throw new Error("old_name må være en ikke-tom string");
      }
      if (typeof input.new_name !== "string" || input.new_name.length === 0) {
        throw new Error("new_name må være en ikke-tom string");
      }
      const vt = input.version_type === 1 ? 1 : 0;
      return photoshop.resolveVersionRename({
        old_name: input.old_name,
        new_name: input.new_name,
        version_type: vt,
      });
    }
    case "photoshop_resolve_version_delete": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const vt = input.version_type === 1 ? 1 : 0;
      return photoshop.resolveVersionDelete({ name: input.name, version_type: vt });
    }
    case "photoshop_resolve_folder_list_all":
      return photoshop.resolveFolderListAll();
    case "photoshop_resolve_folder_get_current":
      return photoshop.resolveFolderGetCurrent();
    case "photoshop_resolve_folder_set_current": {
      if (typeof input.path !== "string" || input.path.length === 0) {
        throw new Error("path må være en ikke-tom string");
      }
      return photoshop.resolveFolderSetCurrent({ path: input.path });
    }
    case "photoshop_resolve_folder_create": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const params: { name: string; parent_path?: string } = { name: input.name };
      if (typeof input.parent_path === "string" && input.parent_path.length > 0) {
        params.parent_path = input.parent_path;
      }
      return photoshop.resolveFolderCreate(params);
    }
    case "photoshop_resolve_folder_move_clips": {
      const clipIds = input.clip_ids;
      if (!Array.isArray(clipIds) || clipIds.length === 0) {
        throw new Error("clip_ids må være en ikke-tom array");
      }
      for (const id of clipIds) {
        if (typeof id !== "string") {
          throw new Error("Alle clip_ids må være strings");
        }
      }
      if (typeof input.target_path !== "string" || input.target_path.length === 0) {
        throw new Error("target_path må være en ikke-tom string");
      }
      return photoshop.resolveFolderMoveClips({
        clip_ids: clipIds as string[],
        target_path: input.target_path,
      });
    }
    case "photoshop_resolve_pm_get_info":
      return photoshop.resolvePmGetInfo();
    case "photoshop_resolve_pm_create_project": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const params: { name: string; media_path?: string } = { name: input.name };
      if (typeof input.media_path === "string" && input.media_path.length > 0) {
        params.media_path = input.media_path;
      }
      return photoshop.resolvePmCreateProject(params);
    }
    case "photoshop_resolve_pm_load_project": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      return photoshop.resolvePmLoadProject({ name: input.name });
    }
    case "photoshop_resolve_pm_save_project":
      return photoshop.resolvePmSaveProject();
    case "photoshop_resolve_pm_delete_project": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      return photoshop.resolvePmDeleteProject({ name: input.name });
    }
    case "photoshop_resolve_pm_create_folder": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      return photoshop.resolvePmCreateFolder({ name: input.name });
    }
    case "photoshop_resolve_pm_navigate_folder": {
      if (typeof input.to !== "string" || input.to.length === 0) {
        throw new Error("to må være 'root', 'parent' eller folder-navn");
      }
      return photoshop.resolvePmNavigateFolder({ to: input.to });
    }
    case "photoshop_resolve_fusion_get_comp_names":
      return photoshop.resolveFusionGetCompNames();
    case "photoshop_resolve_fusion_add_comp":
      return photoshop.resolveFusionAddComp();
    case "photoshop_resolve_fusion_load_comp": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      return photoshop.resolveFusionLoadComp({ name: input.name });
    }
    case "photoshop_resolve_fusion_rename_comp": {
      if (typeof input.old_name !== "string" || input.old_name.length === 0) {
        throw new Error("old_name må være en ikke-tom string");
      }
      if (typeof input.new_name !== "string" || input.new_name.length === 0) {
        throw new Error("new_name må være en ikke-tom string");
      }
      return photoshop.resolveFusionRenameComp({
        old_name: input.old_name,
        new_name: input.new_name,
      });
    }
    case "photoshop_resolve_fusion_delete_comp": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      return photoshop.resolveFusionDeleteComp({ name: input.name });
    }
    case "photoshop_resolve_fusion_import_comp": {
      if (typeof input.path !== "string" || input.path.length === 0) {
        throw new Error("path må være en ikke-tom string");
      }
      return photoshop.resolveFusionImportComp({ path: input.path });
    }
    case "photoshop_resolve_fusion_export_comp": {
      if (typeof input.path !== "string" || input.path.length === 0) {
        throw new Error("path må være en ikke-tom string");
      }
      if (typeof input.comp_index !== "number" || input.comp_index < 1) {
        throw new Error("comp_index må være et tall >= 1 (1-basert)");
      }
      return photoshop.resolveFusionExportComp({
        path: input.path,
        comp_index: input.comp_index,
      });
    }
    case "photoshop_resolve_settings_reference": {
      // Lokal lookup — INGEN bridge-call. runPhotoshopTool gjør
      // JSON.stringify på return-verdien, så vi returnerer objekt.
      const scope =
        typeof input.scope === "string"
          ? (input.scope as "project" | "timeline" | "clip")
          : undefined;
      const category =
        typeof input.category === "string" ? input.category : undefined;
      const entries = getCatalog({ scope, category });
      return {
        count: entries.length,
        filter: { scope: scope ?? null, category: category ?? null },
        entries,
      };
    }
    case "photoshop_resolve_media_pool_import_timeline_from_file": {
      if (typeof input.file_path !== "string" || input.file_path.length === 0) {
        throw new Error("file_path må være en ikke-tom string");
      }
      const VALID_EXT = [".aaf", ".edl", ".xml", ".fcpxml", ".drt", ".adl", ".otio"];
      const lower = input.file_path.toLowerCase();
      const matches = VALID_EXT.some((ext) => lower.endsWith(ext));
      if (!matches) {
        throw new Error(
          `Ugyldig filtype for file_path. Gyldige: ${VALID_EXT.join(", ")}`,
        );
      }
      const params: {
        file_path: string;
        timeline_name?: string;
        import_source_clips?: boolean;
        source_clips_path?: string;
        interlace_processing?: boolean;
      } = { file_path: input.file_path };
      if (typeof input.timeline_name === "string" && input.timeline_name.length > 0) {
        params.timeline_name = input.timeline_name;
      }
      if (typeof input.source_clips_path === "string" && input.source_clips_path.length > 0) {
        params.source_clips_path = input.source_clips_path;
      }
      if (typeof input.import_source_clips === "boolean") {
        params.import_source_clips = input.import_source_clips;
      }
      if (typeof input.interlace_processing === "boolean") {
        params.interlace_processing = input.interlace_processing;
      }
      return photoshop.resolveMediaPoolImportTimelineFromFile(params);
    }
    case "photoshop_resolve_media_pool_delete_timelines": {
      const names = input.timeline_names;
      if (!Array.isArray(names) || names.length === 0) {
        throw new Error("timeline_names må være en ikke-tom array");
      }
      for (const n of names) {
        if (typeof n !== "string" || n.length === 0) {
          throw new Error("Alle timeline_names må være ikke-tomme strings");
        }
      }
      return photoshop.resolveMediaPoolDeleteTimelines({
        timeline_names: names as string[],
      });
    }
    case "photoshop_resolve_pm_import_project": {
      if (typeof input.file_path !== "string" || input.file_path.length === 0) {
        throw new Error("file_path må være en ikke-tom string");
      }
      if (!input.file_path.toLowerCase().endsWith(".drp")) {
        throw new Error("file_path må peke til en .drp-fil");
      }
      const params: { file_path: string; project_name?: string } = {
        file_path: input.file_path,
      };
      if (typeof input.project_name === "string" && input.project_name.length > 0) {
        params.project_name = input.project_name;
      }
      return photoshop.resolvePmImportProject(params);
    }
    case "photoshop_resolve_pm_export_project": {
      if (typeof input.project_name !== "string" || input.project_name.length === 0) {
        throw new Error("project_name må være en ikke-tom string");
      }
      if (typeof input.file_path !== "string" || input.file_path.length === 0) {
        throw new Error("file_path må være en ikke-tom string");
      }
      const params: {
        project_name: string;
        file_path: string;
        with_stills_and_luts?: boolean;
      } = { project_name: input.project_name, file_path: input.file_path };
      if (typeof input.with_stills_and_luts === "boolean") {
        params.with_stills_and_luts = input.with_stills_and_luts;
      }
      return photoshop.resolvePmExportProject(params);
    }
    case "photoshop_resolve_fusion_comp_get_info": {
      const params: { comp_name?: string } = {};
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompGetInfo(params);
    }
    case "photoshop_resolve_fusion_comp_add_tool": {
      if (typeof input.tool_type !== "string" || input.tool_type.length === 0) {
        throw new Error("tool_type må være en ikke-tom string");
      }
      const params: {
        tool_type: string;
        name?: string;
        x?: number;
        y?: number;
        comp_name?: string;
      } = { tool_type: input.tool_type };
      if (typeof input.name === "string" && input.name.length > 0) params.name = input.name;
      if (typeof input.x === "number") params.x = input.x;
      if (typeof input.y === "number") params.y = input.y;
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompAddTool(params);
    }
    case "photoshop_resolve_fusion_comp_delete_tool": {
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new Error("name må være en ikke-tom string");
      }
      const params: { name: string; comp_name?: string } = { name: input.name };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompDeleteTool(params);
    }
    case "photoshop_resolve_fusion_comp_set_input": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      if (input.value === undefined || input.value === null) {
        throw new Error("value mangler");
      }
      const params: {
        tool_name: string;
        input_name: string;
        value: string;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
        value: typeof input.value === "string" ? input.value : String(input.value),
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompSetInput(params);
    }
    case "photoshop_resolve_fusion_comp_connect_input": {
      if (typeof input.dest_tool !== "string" || input.dest_tool.length === 0) {
        throw new Error("dest_tool må være en ikke-tom string");
      }
      if (typeof input.dest_input !== "string" || input.dest_input.length === 0) {
        throw new Error("dest_input må være en ikke-tom string");
      }
      if (typeof input.src_tool !== "string" || input.src_tool.length === 0) {
        throw new Error("src_tool må være en ikke-tom string");
      }
      const params: {
        dest_tool: string;
        dest_input: string;
        src_tool: string;
        src_output?: string;
        comp_name?: string;
      } = {
        dest_tool: input.dest_tool,
        dest_input: input.dest_input,
        src_tool: input.src_tool,
      };
      if (typeof input.src_output === "string" && input.src_output.length > 0) {
        params.src_output = input.src_output;
      }
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompConnectInput(params);
    }
    case "photoshop_resolve_fusion_tools_reference": {
      // Lokal lookup — INGEN bridge-call.
      const category =
        typeof input.category === "string"
          ? (input.category as FusionToolCategory)
          : undefined;
      const entries = getFusionCatalog({ category });
      return {
        count: entries.length,
        filter: { category: category ?? null },
        entries,
      };
    }
    case "photoshop_resolve_fusion_comp_add_keyframe": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      if (typeof input.time !== "number") {
        throw new Error("time må være et tall (frame-number)");
      }
      if (input.value === undefined || input.value === null) {
        throw new Error("value mangler");
      }
      const params: {
        tool_name: string;
        input_name: string;
        time: number;
        value: string;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
        time: input.time,
        value: typeof input.value === "string" ? input.value : String(input.value),
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompAddKeyframe(params);
    }
    case "photoshop_resolve_fusion_comp_remove_keyframe": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      if (typeof input.time !== "number") {
        throw new Error("time må være et tall");
      }
      const params: {
        tool_name: string;
        input_name: string;
        time: number;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
        time: input.time,
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompRemoveKeyframe(params);
    }
    case "photoshop_resolve_fusion_comp_list_keyframes": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      const params: {
        tool_name: string;
        input_name: string;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompListKeyframes(params);
    }
    case "photoshop_resolve_fusion_comp_set_expression": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      if (typeof input.expression !== "string") {
        throw new Error("expression må være en string (tom for å rydde)");
      }
      const params: {
        tool_name: string;
        input_name: string;
        expression: string;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
        expression: input.expression,
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompSetExpression(params);
    }
    case "photoshop_resolve_fusion_comp_remove_animation": {
      if (typeof input.tool_name !== "string" || input.tool_name.length === 0) {
        throw new Error("tool_name må være en ikke-tom string");
      }
      if (typeof input.input_name !== "string" || input.input_name.length === 0) {
        throw new Error("input_name må være en ikke-tom string");
      }
      const params: {
        tool_name: string;
        input_name: string;
        comp_name?: string;
      } = {
        tool_name: input.tool_name,
        input_name: input.input_name,
      };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompRemoveAnimation(params);
    }
    case "photoshop_resolve_fusion_comp_set_render_range": {
      if (typeof input.start !== "number") {
        throw new Error("start må være et tall (frame-number)");
      }
      if (typeof input.end !== "number") {
        throw new Error("end må være et tall");
      }
      if (input.end < input.start) {
        throw new Error("end må være >= start");
      }
      const params: {
        start: number;
        end: number;
        comp_name?: string;
      } = { start: input.start, end: input.end };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompSetRenderRange(params);
    }
    case "photoshop_resolve_fusion_comp_set_current_time": {
      if (typeof input.time !== "number") {
        throw new Error("time må være et tall");
      }
      const params: { time: number; comp_name?: string } = { time: input.time };
      if (typeof input.comp_name === "string" && input.comp_name.length > 0) {
        params.comp_name = input.comp_name;
      }
      return photoshop.resolveFusionCompSetCurrentTime(params);
    }
    case "photoshop_resolve_clip_stabilize":
      return photoshop.resolveClipStabilize();
    case "photoshop_resolve_folder_intelli_reset":
      return photoshop.resolveFolderIntelliReset();
    case "photoshop_resolve_clip_load_burn_in_preset": {
      if (typeof input.preset_name !== "string" || input.preset_name.length === 0) {
        throw new Error("preset_name må være en ikke-tom string");
      }
      return photoshop.resolveClipLoadBurnInPreset({ preset_name: input.preset_name });
    }
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
