/**
 * Story Graph — format-lagets graf-typer.
 *
 * `ExportGraph` er det STRUKTURELLE delsettet eksporten trenger (superset av
 * RuntimeGraph): både frontendens `NarrativeGraph` og backendens service-graf
 * tilfredsstiller den uten import fra `client/src`.
 *
 * `FormatGraph` er den FULLE formen import produserer — samme felt som
 * backendens `NarrativeGraph` (projectId, tidsstempler, versjon), så resultatet
 * kan sendes rett til `replaceGraph` og rett inn i frontend-storen.
 */

import type { RuntimeElementKind, RuntimeVariableType } from '../narrative-runtime/types';

export type FormatAttributeOwnerKind = 'element' | 'component' | 'board';
export type FormatAttributeType =
  | 'rich_text' | 'string' | 'bool' | 'int' | 'float' | 'component_list' | 'asset_list';
export type FormatAssetKind = 'image' | 'audio' | 'video';

export interface ExportSettings {
  title: string | null;
  startingElementId: string | null;
  coverAssetId?: string | null;
  /** Aktiverte locale-koder; første = kildespråk (`nb`). */
  locales?: string[];
  i18n?: Record<string, { title?: string }>;
}

export interface ExportBoard {
  id: string;
  name: string;
  customId?: string | null;
  folderPath?: string;
  sortOrder?: number;
}

export interface ExportBranchCondition {
  id: string;
  script: string | null;
  label: string | null;
}

export interface ExportElement {
  id: string;
  boardId: string;
  kind: RuntimeElementKind;
  titleHtml: string;
  contentHtml: string;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: string;
  coverAssetId: string | null;
  customId: string | null;
  jumperTargetId: string | null;
  branchConditions: ExportBranchCondition[];
  sortOrder?: number;
  /** Per-locale overrides (kun prose; kode flettes fra kilden). */
  i18n?: Record<string, { titleHtml?: string; contentHtml?: string }>;
}

export interface ExportConnection {
  id: string;
  boardId: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey: string;
  labelHtml: string;
  sortOrder?: number;
  i18n?: Record<string, { labelHtml?: string }>;
}

export interface ExportComponent {
  id: string;
  name: string;
  folderPath?: string;
  coverAssetId: string | null;
  customId: string | null;
  sortOrder?: number;
}

export interface ExportElementComponent {
  elementId: string;
  componentId: string;
  sortOrder?: number;
}

export interface ExportAttribute {
  id: string;
  ownerKind: FormatAttributeOwnerKind;
  ownerId: string;
  name: string;
  type: string;
  value: unknown;
  customId?: string | null;
  sortOrder?: number;
}

export interface ExportVariable {
  id: string;
  name: string;
  type: RuntimeVariableType;
  defaultValue: unknown;
  sortOrder?: number;
}

export interface ExportAsset {
  id: string;
  kind: FormatAssetKind | string;
  name: string;
  externalUrl?: string | null;
  storageKey?: string | null;
  mime?: string | null;
  folderPath?: string;
}

export interface ExportGraph {
  settings: ExportSettings;
  boards: ExportBoard[];
  elements: ExportElement[];
  connections: ExportConnection[];
  components: ExportComponent[];
  elementComponents: ExportElementComponent[];
  attributes: ExportAttribute[];
  variables: ExportVariable[];
  assets: ExportAsset[];
}

// ─── Full form (importresultat) ────────────────────────────────────────

export interface FormatSettings {
  projectId: string;
  title: string | null;
  startingElementId: string | null;
  coverAssetId: string | null;
  schemaVersion: number;
  updatedAt: string | null;
  locales: string[];
  i18n: Record<string, { title?: string }>;
}

export interface FormatBoard {
  id: string;
  projectId: string;
  name: string;
  customId: string | null;
  folderPath: string;
  sortOrder: number;
  viewport: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FormatElement {
  id: string;
  projectId: string;
  boardId: string;
  kind: RuntimeElementKind;
  titleHtml: string;
  contentHtml: string;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: string;
  coverAssetId: string | null;
  customId: string | null;
  jumperTargetId: string | null;
  branchConditions: ExportBranchCondition[];
  version: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  i18n: Record<string, { titleHtml?: string; contentHtml?: string }>;
}

export interface FormatConnection {
  id: string;
  projectId: string;
  boardId: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey: string;
  labelHtml: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  i18n: Record<string, { labelHtml?: string }>;
}

export interface FormatComponent {
  id: string;
  projectId: string;
  name: string;
  folderPath: string;
  coverAssetId: string | null;
  customId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormatElementComponent {
  elementId: string;
  componentId: string;
  sortOrder: number;
}

export interface FormatAttribute {
  id: string;
  projectId: string;
  ownerKind: FormatAttributeOwnerKind;
  ownerId: string;
  name: string;
  type: FormatAttributeType;
  value: unknown;
  customId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormatVariable {
  id: string;
  projectId: string;
  name: string;
  type: RuntimeVariableType;
  defaultValue: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormatAsset {
  id: string;
  projectId: string;
  kind: FormatAssetKind;
  name: string;
  storageKey: string | null;
  externalUrl: string | null;
  mime: string | null;
  sizeBytes: number | null;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormatGraph {
  settings: FormatSettings;
  boards: FormatBoard[];
  elements: FormatElement[];
  connections: FormatConnection[];
  components: FormatComponent[];
  elementComponents: FormatElementComponent[];
  attributes: FormatAttribute[];
  variables: FormatVariable[];
  assets: FormatAsset[];
}

export interface FormatWarning {
  /** Hva som gikk tapt/ble tilpasset — vises i UI etter import. */
  message: string;
  /** Arcweave-id eller vår id der det er relevant. */
  ref?: string;
}
