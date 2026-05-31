/**
 * photoshopBridgeService — typed klient mot Tauri-app'ens WebSocket-bro
 * til Adobe Photoshop UXP-pluginen ("Post Agent Bridge").
 *
 * Tauri-siden eier WS-serveren (port 1733). Denne service-en wrapper
 * `photoshop_send_command` / `photoshop_status` og `photoshop://*`
 * events slik at UI-laget kan jobbe mot et typestrengt vokabular i
 * stedet for løse invoke-strenger.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ---------------------------------------------------------------------------
// Status + events
// ---------------------------------------------------------------------------

export interface PhotoshopBridgeStatus {
  connected: boolean;
  plugin_version: string | null;
  photoshop_version: string | null;
  port: number;
}

export interface PhotoshopBridgeEvent {
  event: string;
  data: unknown;
}

export async function getStatus(): Promise<PhotoshopBridgeStatus> {
  return invoke<PhotoshopBridgeStatus>("photoshop_status");
}

export function onStatus(
  handler: (status: PhotoshopBridgeStatus) => void,
): Promise<UnlistenFn> {
  return listen<PhotoshopBridgeStatus>("photoshop://status", (e) =>
    handler(e.payload),
  );
}

export function onEvent(
  handler: (event: PhotoshopBridgeEvent) => void,
): Promise<UnlistenFn> {
  return listen<PhotoshopBridgeEvent>("photoshop://event", (e) =>
    handler(e.payload),
  );
}

// ---------------------------------------------------------------------------
// Command vocabulary
// ---------------------------------------------------------------------------

export interface DocumentSummary {
  id: number;
  name: string;
  width: number;
  height: number;
  resolution: number;
  path: string | null;
}

export interface AppInfo {
  photoshop_version: string | null;
  locale: string | null;
  active_document: DocumentSummary | null;
  documents: DocumentSummary[];
}

export type ExportFormat = "jpg" | "jpeg" | "png" | "psd" | "tiff" | "tif";

export type TemplateFieldType = "text" | "image" | "unsupported";

export interface TemplateField {
  key: string;
  type: TemplateFieldType;
  layer_name: string;
  kind: string;
}

export interface TemplateScanResult {
  template_path: string;
  template: DocumentSummary | null;
  fields: TemplateField[];
  /**
   * Alle text- og smart-object-layers — uavhengig av om de matcher
   * `{{key}}`-mønsteret. Bruk for å tilby auto-rename når Irlin har
   * et template uten konvensjon.
   */
  all_candidates?: Array<{
    layer_name: string;
    type: "text" | "image";
    has_field_pattern: boolean;
    suggested_key: string;
  }>;
}

export interface TemplateAutoRenameResult {
  template_path: string;
  output_path: string;
  renamed: Array<{ old_name: string; new_key: string }>;
  skipped: Array<{ layer_name: string; new_key: string; reason: string }>;
}

export interface TemplateRenderResult {
  template_path: string;
  output_path: string;
  format: ExportFormat;
  applied: Array<{ key: string; type: "text" | "image" }>;
  skipped: Array<{ key: string; reason: string }>;
}

async function send<T>(command: string, params?: unknown): Promise<T> {
  return invoke<T>("photoshop_send_command", { command, params: params ?? null });
}

export const photoshop = {
  ping: () => send<{ pong: true; time: number }>("ping"),

  appInfo: () => send<AppInfo>("app.info"),

  openDocument: (path: string) =>
    send<DocumentSummary>("doc.open", { path }),

  saveDocument: () => send<{ saved: true }>("doc.save"),

  exportDocument: (params: {
    path: string;
    format: ExportFormat;
    quality?: number;
  }) => send<{ path: string; format: ExportFormat }>("doc.export", params),

  replaceSmartObject: (params: { layer_name: string; file_path: string }) =>
    send<{ layer_name: string; file_path: string }>(
      "smartObject.replace",
      params,
    ),

  setTextContents: (params: { layer_name: string; contents: string }) =>
    send<{ layer_name: string; contents: string }>("text.setContents", params),

  toggleLayer: (params: { layer_name: string; visible: boolean }) =>
    send<{ layer_name: string; visible: boolean }>("layer.toggle", params),

  scanTemplate: (template_path: string) =>
    send<TemplateScanResult>("template.scan", { template_path }),

  renderTemplate: (params: {
    template_path: string;
    data: Record<string, string>;
    output_path: string;
    format: ExportFormat;
    quality?: number;
  }) => send<TemplateRenderResult>("template.render", params),

  autoRenameTemplate: (params: {
    template_path: string;
    output_path: string;
    mappings: Array<{ layer_name: string; new_key: string }>;
  }) => send<TemplateAutoRenameResult>("template.autoRename", params),
};
