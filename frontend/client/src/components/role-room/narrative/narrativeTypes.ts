/**
 * Story Graph — delte typer for frontend. Speiler
 * backend/server/role-room-narrative-service.ts 1:1 (camelCase-JSON fra API).
 */

export type NarrativeElementKind = 'element' | 'branch' | 'jumper' | 'note';
export type NarrativeAttributeOwnerKind = 'element' | 'component' | 'board';
export type NarrativeAttributeType =
  | 'rich_text' | 'string' | 'bool' | 'int' | 'float' | 'component_list' | 'asset_list';
export type NarrativeVariableType = 'bool' | 'int' | 'float' | 'string';
export type NarrativeAssetKind = 'image' | 'audio' | 'video';

export const NARRATIVE_ELEMENT_KINDS: readonly NarrativeElementKind[] = ['element', 'branch', 'jumper', 'note'];
export const NARRATIVE_VARIABLE_TYPES: readonly NarrativeVariableType[] = ['bool', 'int', 'float', 'string'];
export const NARRATIVE_ATTRIBUTE_TYPES: readonly NarrativeAttributeType[] =
  ['rich_text', 'string', 'bool', 'int', 'float', 'component_list', 'asset_list'];
export const NARRATIVE_ASSET_KINDS: readonly NarrativeAssetKind[] = ['image', 'audio', 'video'];

/** Tema-farger på elementer (Arcweave: colour themes). */
export const NARRATIVE_THEMES = [
  'default', 'green', 'blue', 'purple', 'amber', 'red', 'teal', 'pink', 'gray',
] as const;
export type NarrativeTheme = (typeof NARRATIVE_THEMES)[number];

export interface NarrativeSettings {
  projectId: string;
  title: string | null;
  startingElementId: string | null;
  coverAssetId: string | null;
  schemaVersion: number;
  updatedAt: string | null;
}

export interface NarrativeBoard {
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

export interface NarrativeBranchCondition {
  id: string;
  script: string | null;
  label: string | null;
}

export interface NarrativeElement {
  id: string;
  projectId: string;
  boardId: string;
  kind: NarrativeElementKind;
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
  branchConditions: NarrativeBranchCondition[];
  version: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeConnection {
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
}

export interface NarrativeComponent {
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

export interface NarrativeElementComponent {
  elementId: string;
  componentId: string;
  sortOrder: number;
}

export interface NarrativeAttribute {
  id: string;
  projectId: string;
  ownerKind: NarrativeAttributeOwnerKind;
  ownerId: string;
  name: string;
  type: NarrativeAttributeType;
  value: unknown;
  customId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeVariable {
  id: string;
  projectId: string;
  name: string;
  type: NarrativeVariableType;
  defaultValue: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeAsset {
  id: string;
  projectId: string;
  kind: NarrativeAssetKind;
  name: string;
  storageKey: string | null;
  externalUrl: string | null;
  mime: string | null;
  sizeBytes: number | null;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeRevisionMeta {
  id: string;
  projectId: string;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
  counts: { boards: number; elements: number; connections: number; components: number };
}

export interface NarrativeGraph {
  settings: NarrativeSettings;
  boards: NarrativeBoard[];
  elements: NarrativeElement[];
  connections: NarrativeConnection[];
  components: NarrativeComponent[];
  elementComponents: NarrativeElementComponent[];
  attributes: NarrativeAttribute[];
  variables: NarrativeVariable[];
  assets: NarrativeAsset[];
}

export function emptyGraph(projectId: string): NarrativeGraph {
  return {
    settings: { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null },
    boards: [],
    elements: [],
    connections: [],
    components: [],
    elementComponents: [],
    attributes: [],
    variables: [],
    assets: [],
  };
}

/** Enkel HTML→tekst for node-etiketter (tittel/innhold er riktekst-HTML). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const ELEMENT_KIND_LABELS: Record<NarrativeElementKind, string> = {
  element: 'Element',
  branch: 'Forgrening',
  jumper: 'Jumper',
  note: 'Notat',
};

export const VARIABLE_TYPE_LABELS: Record<NarrativeVariableType, string> = {
  bool: 'Sann/usann',
  int: 'Heltall',
  float: 'Desimaltall',
  string: 'Tekst',
};

export const ATTRIBUTE_TYPE_LABELS: Record<NarrativeAttributeType, string> = {
  rich_text: 'Riktekst',
  string: 'Tekst',
  bool: 'Sann/usann',
  int: 'Heltall',
  float: 'Desimaltall',
  component_list: 'Komponentliste',
  asset_list: 'Ressursliste',
};
