/**
 * Arcweave `project.json` — typer verifisert 2026-09-15 mot
 * github.com/arcweave/arcweave-unity-example (Assets/Arcweave/project.json)
 * og plugin-loaderne (Unity 3.0.0 / Godot 3.0.0 / Unreal 2.0.0).
 *
 * Alle samlinger er objekter nøklet på id. Mappe-noder (`children`) kan ligge
 * i `boards`, `components`, `assets` og `variables`; rot-mappa har `root: true`.
 */

export interface ArcweaveFolder {
  name: string;
  children: string[];
  root?: boolean;
}

export interface ArcweaveBoard {
  name: string;
  customId?: string | null;
  notes: string[];
  jumpers: string[];
  branches: string[];
  elements: string[];
  connections: string[];
  /** 5.11: brett-skopede variabler som typede attributter (vår utvidelse er harmløs for plugins). */
  attributes?: string[];
}

export interface ArcweaveCover {
  id?: string;
  file?: string;
  type?: string;
}

export interface ArcweaveElement {
  x: number;
  y: number;
  width?: number;
  height?: number;
  theme: string;
  title: string;
  content: string;
  outputs: string[];
  components: string[];
  attributes: string[];
  assets: { cover?: ArcweaveCover | null };
  /** Ikke i Arcweaves kjerneskjema — bevares for stabil identitet over rundturer. */
  customId?: string | null;
}

export type ArcweaveConnectionSourceType = 'elements' | 'conditions';
export type ArcweaveConnectionTargetType = 'elements' | 'branches' | 'jumpers';

export interface ArcweaveConnection {
  type: 'Straight';
  theme: string;
  sourceid: string;
  targetid: string;
  sourceType: ArcweaveConnectionSourceType;
  targetType: ArcweaveConnectionTargetType;
  label: string | null;
}

export interface ArcweaveBranch {
  x: number;
  y: number;
  theme: string;
  conditions: {
    ifCondition: string;
    elseIfConditions?: string[];
    elseCondition?: string | null;
  };
}

export interface ArcweaveCondition {
  /** Mangler på else-betingelsen. */
  script?: string | null;
  /** Koblings-id (null = utgangen er ikke koblet). */
  output: string | null;
}

export interface ArcweaveJumper {
  x: number;
  y: number;
  elementId: string | null;
}

export interface ArcweaveNote {
  x: number;
  y: number;
  width?: number;
  height?: number;
  theme: string;
  content: string;
}

export interface ArcweaveComponent {
  name: string;
  customId?: string | null;
  attributes: string[];
  assets: { cover?: ArcweaveCover | null };
}

export type ArcweaveAttributeCType = 'elements' | 'components' | 'boards';
export type ArcweaveAttributeValueType =
  | 'string' | 'component-list' | 'asset-list' | 'integer' | 'float' | 'boolean';

export interface ArcweaveAttribute {
  cId: string;
  cType: ArcweaveAttributeCType;
  name: string;
  value: {
    data: unknown;
    type: ArcweaveAttributeValueType | string;
    /** Kun for `string`: true = ren tekst, false = riktekst-HTML. */
    plain?: boolean;
  };
}

export type ArcweaveVariableType = 'integer' | 'float' | 'boolean' | 'string';

export interface ArcweaveVariable {
  name: string;
  type: ArcweaveVariableType;
  cType?: 'global' | string;
  value: unknown;
}

export interface ArcweaveAsset {
  name: string;
  type: string;
  /** Vår utvidelse: ekstern URL for ressurser lagret utenfor Arcweave. */
  url?: string;
}

export interface ArcweaveProject {
  name: string;
  cover: ArcweaveCover | null;
  startingElement: string | null;
  boards: Record<string, ArcweaveBoard | ArcweaveFolder>;
  notes: Record<string, ArcweaveNote>;
  elements: Record<string, ArcweaveElement>;
  jumpers: Record<string, ArcweaveJumper>;
  connections: Record<string, ArcweaveConnection>;
  branches: Record<string, ArcweaveBranch>;
  components: Record<string, ArcweaveComponent | ArcweaveFolder>;
  attributes: Record<string, ArcweaveAttribute>;
  assets: Record<string, ArcweaveAsset | ArcweaveFolder>;
  variables: Record<string, ArcweaveVariable | ArcweaveFolder>;
  conditions: Record<string, ArcweaveCondition>;
}

export function isArcweaveFolder(value: unknown): value is ArcweaveFolder {
  return !!value && typeof value === 'object' && Array.isArray((value as { children?: unknown }).children);
}
