export type ScriptStatus = "ready" | "stub" | "experimental" | "needs-check";

export type RiskLevel = "none" | "low" | "medium" | "high";

export interface ScriptCategory {
  id: string;
  name: string;
  icon: string;
}

export interface ScriptMeta {
  id: string;
  name: string;
  category: string;
  scriptPath: string;
  description: string;
  requiredInputs: string[];
  resolvePageDependency: string | null;
  riskLevel: RiskLevel;
  status: ScriptStatus;
  dryRunSupported: boolean;
  requiresProject: boolean;
  requiresTimeline: boolean;
  requiresEnv?: string[];
}

export interface Registry {
  categories: ScriptCategory[];
  scripts: ScriptMeta[];
}

export interface WorkflowStep {
  order: number;
  scriptId: string;
  label: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  projectTemplate?: string;
  steps: WorkflowStep[];
}

export type WorkflowMap = Record<string, Workflow>;

export interface ScriptEvent {
  type: "log" | "warn" | "error" | "result" | "stderr" | "started" | "finished" | "progress"
      | "shot_scored" | "picks_finalized";
  ts?: number;
  runId: string;
  scriptId?: string;
  scriptPath?: string;
  message?: string;
  value?: unknown;
  succeeded?: boolean;
  exitCode?: number | null;
  dryRun?: boolean;
  raw?: boolean;
  current?: number;
  total?: number;
  percent?: number;
  label?: string;
  // result payload (mockup_render_video m.fl. emitter disse top-level)
  outputPath?: string;
  format?: string;
  // shot_scored payload
  index?: number;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
  score?: number;
  thumbnailPath?: string | null;
  // picks_finalized payload
  indices?: number[];
  totalPicked?: number;
  totalShots?: number;
}

export interface RunSummary {
  run_id: string;
  script_id: string;
  exit_code: number | null;
  succeeded: boolean;
  events: ScriptEvent[];
  started_at: string;
  finished_at: string;
  dry_run: boolean;
}

export interface HealthStatus {
  pythonInstalled: boolean;
  pythonVersion: string;
  scriptingModuleFound: boolean;
  scriptingModulePath: string | null;
  fusionscriptLibPath?: string | null;
  resolveRunning: boolean;
  projectOpen: boolean;
  projectName: string | null;
  envResolveScriptApi: string | null;
  envResolveScriptLib?: string | null;
}

export interface RunRecord {
  runId: string;
  scriptId: string;
  scriptName: string;
  startedAt: string;
  finishedAt: string;
  succeeded: boolean;
  dryRun: boolean;
  exitCode: number | null;
  events: ScriptEvent[];
}

export interface HistoryRecord {
  run_id: string;
  script_id: string;
  started_at: string;
  finished_at: string;
  succeeded: boolean;
  exit_code: number | null;
  dry_run: boolean;
  tail_events: ScriptEvent[];
}

export interface CameraCardClip {
  path: string;
  name: string;
  size_bytes: number;
  extension: string;
}

export interface MountedCard {
  mount_path: string;
  volume_label: string;
  camera_guess: string | null;
  total_clips: number;
  total_bytes: number;
  layout_signals: string[];
  card_hash: string;
  clips: CameraCardClip[];
}

export type AudioConfidence = "confirmed" | "partial" | "metadata_only" | "unavailable";

export interface SimilarGroup {
  groupId: string;
  scene: string | null;
  startTimecode: string | null;
  clipPaths: string[];
  clipNames: string[];
  hero: string | null;
  heroReasoning: string | null;
  alternates: string[];
  rejects: string[];
  audioConfidence?: AudioConfidence;
  audioMatchNote?: string;
}

export interface CullPreflight {
  multiCamera: boolean;
  externalAudio: boolean;
  groupByTimecode: boolean;
  rejectTcDuplicates: boolean;
  projectTemplate: string;
}

export type CullDecisionValue = "keep" | "reject" | "maybe" | "pending";

export interface CullDecision {
  clipPath: string;
  clipName: string;
  thumbnails: string[];
  sizeBytes: number;
  durationSeconds: number | null;
  startTimecode?: string | null;
  decision: CullDecisionValue;
  aiSuggestion: CullDecisionValue | null;
  scene: string | null;
  qualityScore: number | null;
  highlightScore: number | null;
  fullFilmScore: number | null;
  tags: string[];
  notes: string | null;
  userOverrode: boolean;
}

export interface CullSession {
  sessionId: string;
  sourcePath: string;
  sourceLabel: string;
  cardHash?: string;
  createdAt: string;
  updatedAt: string;
  preflight: CullPreflight;
  decisions: CullDecision[];
  similarGroups?: SimilarGroup[];
}

export interface CullSessionSummary {
  sessionId: string;
  sourceLabel: string;
  sourcePath: string;
  updatedAt: string;
  totalClips: number;
  kept: number;
  rejected: number;
  pending: number;
}

export interface LookComponents {
  lut?: string;
  cdl?: {
    slope: [number, number, number];
    offset: [number, number, number];
    power: [number, number, number];
    saturation: number;
  };
  grain?: string | null;
  halation?: string;
  vignette?: string;
  outputTransform?: string;
  skinToneProtection?: string;
}

export interface Look {
  id: string;
  name: string;
  bestFor: string[];
  components: LookComponents;
}

export interface LookPack {
  name: string;
  id: string;
  version: string;
  description: string;
  looks: Look[];
  sceneToLookMap: Record<string, string>;
}

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  file: string;
  description: string;
  lookPackId?: string;
  plugin?: boolean;
  pluginNote?: string;
}

export interface ProjectTemplateIndex {
  default: string;
  templates: ProjectTemplateSummary[];
}

export interface LookPackSummary {
  id: string;
  file: string;
  scope: "general" | "plugin";
  pluginFor?: string;
}

export interface LookPackIndex {
  default: string;
  packs: LookPackSummary[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  bins: string[];
  defaultTimelines: string[];
  audioLayout: Array<{ track: number; label: string }>;
  sceneMarkers: Array<{ name: string; color: string }>;
  highlightTags: string[];
  musicBeats: string[];
  lookPackId?: string;
  deliveryTargets?: string[];
}
