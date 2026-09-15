/**
 * Story Graph — strukturelle runtime-typer.
 *
 * Bevisst et DELSETT av grafen, uten import fra `client/src` (backend kan ikke
 * nå den). Både frontendens `NarrativeGraph` og backendens service-graf
 * tilfredsstiller disse typene strukturelt.
 */

export type RuntimeElementKind = 'element' | 'branch' | 'jumper' | 'note';
export type RuntimeVariableType = 'bool' | 'int' | 'float' | 'string';

export interface RuntimeBranchCondition {
  id: string;
  script: string | null;
  label: string | null;
}

export interface RuntimeElement {
  id: string;
  boardId: string;
  kind: RuntimeElementKind;
  titleHtml: string;
  contentHtml: string;
  customId?: string | null;
  jumperTargetId: string | null;
  branchConditions: RuntimeBranchCondition[];
  sortOrder?: number;
}

export interface RuntimeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey: string;
  labelHtml: string;
  sortOrder?: number;
}

export interface RuntimeBoard {
  id: string;
  name: string;
  customId?: string | null;
}

export interface RuntimeComponent {
  id: string;
  name: string;
  customId?: string | null;
}

export interface RuntimeElementComponent {
  elementId: string;
  componentId: string;
  sortOrder?: number;
}

export interface RuntimeAttribute {
  ownerKind: 'element' | 'component' | 'board';
  ownerId: string;
  name: string;
  type: string;
  value: unknown;
}

export interface RuntimeVariable {
  id?: string;
  name: string;
  type: RuntimeVariableType;
  defaultValue: unknown;
}

export interface RuntimeGraph {
  settings: { startingElementId: string | null };
  boards: RuntimeBoard[];
  elements: RuntimeElement[];
  connections: RuntimeConnection[];
  components: RuntimeComponent[];
  elementComponents: RuntimeElementComponent[];
  attributes: RuntimeAttribute[];
  variables: RuntimeVariable[];
}

export interface GraphIssue {
  level: 'warning' | 'error';
  elementId: string | null;
  message: string;
}
