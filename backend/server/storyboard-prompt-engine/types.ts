import type { StoryboardShotContext } from '../storyboard-ai-context.js';

export const PROMPT_ENGINE_VERSION = 'trr-prompt-engine-v1' as const;

export type PromptIntentKind = 'storyboard-image' | 'storyboard-video';

export type PromptModuleId =
  | 'base-cinematography'
  | 'project-style'
  | 'character'
  | 'wardrobe'
  | 'location'
  | 'prop'
  | 'shot'
  | 'camera'
  | 'lighting'
  | 'continuity'
  | 'user-intent'
  | 'model-rules';

export type PromptConstraintSource =
  | 'system'
  | 'project'
  | 'production'
  | 'shot'
  | 'user'
  | 'model-adapter';

export interface PromptConstraint {
  id: string;
  text: string;
  source: PromptConstraintSource;
  locked: boolean;
  priority: number;
}

export interface CompiledPromptModule {
  id: PromptModuleId;
  label: string;
  constraints: PromptConstraint[];
  renderedText: string;
}

export interface PromptValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  module?: PromptModuleId;
}

export interface PromptValidationReport {
  valid: boolean;
  issues: PromptValidationIssue[];
  compiledCharacters: number;
  maxCharacters: number;
}

export interface PromptModelView {
  id: string;
  label: string;
  provider: string;
  modality: 'image' | 'video';
}

export interface PromptInspectorView {
  intent: string;
  inheritedConstraintCount: number;
  characterCount: number;
  characterReferenceCount: number;
  locationReferenceCount: number;
  styleProfileId: string;
  styleProfileLabel: string;
  lockedProperties: string[];
  model: PromptModelView;
}

export interface CompiledStoryboardPrompt {
  version: typeof PROMPT_ENGINE_VERSION;
  contextVersion: StoryboardShotContext['version'];
  contextFingerprint: string;
  compilationFingerprint: string;
  intentKind: PromptIntentKind;
  modules: CompiledPromptModule[];
  compiledPrompt: string;
  validation: PromptValidationReport;
  inspector: PromptInspectorView;
}

export interface CompileStoryboardPromptInput {
  kind: PromptIntentKind;
  modelId: string;
  context: StoryboardShotContext;
  userAction?: string;
}

export interface ModelPromptAdapter {
  id: string;
  label: string;
  provider: string;
  modality: 'image' | 'video';
  maxCharacters: number;
  openingInstruction: string;
  rules: string[];
}

export interface GeneratedAssetValidation {
  valid: boolean;
  issues: PromptValidationIssue[];
  mediaType: 'image' | 'video';
  bytes?: number;
}
