/**
 * Story Graph — delte typer for frontend. Speiler
 * backend/server/role-room-narrative-service.ts 1:1 (camelCase-JSON fra API).
 */

export type NarrativeElementKind = 'element' | 'branch' | 'jumper' | 'note';
export type NarrativeAttributeOwnerKind = 'element' | 'component' | 'board';
export type NarrativeAttributeType =
  | 'rich_text' | 'string' | 'bool' | 'int' | 'float' | 'component_list' | 'asset_list';
export type NarrativeVariableType = 'bool' | 'int' | 'float' | 'string';
export type NarrativeAssetKind = 'image' | 'audio' | 'video' | 'file';

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
  /** Aktiverte locale-koder; første er kildespråket (nb). */
  locales: string[];
  i18n: Record<string, { title?: string }>;
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
  /** Per-locale overrides (kun prose; skript flettes fra kilden ved oppslag). */
  i18n: Record<string, { titleHtml?: string; contentHtml?: string }>;
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
  i18n: Record<string, { labelHtml?: string }>;
}

export type NarrativeComponentKind = 'character' | 'location' | 'item' | 'faction' | 'other';
export const NARRATIVE_COMPONENT_KINDS: readonly NarrativeComponentKind[] = ['character', 'location', 'item', 'faction', 'other'];

/** Fase 7: typet profil per komponent-kind (lagres som fri JSONB). */
export interface NarrativeMemoryTrack { code: string; title: string; image?: string; knownAfter?: string }
export interface NarrativeCharacterProfile {
  drive?: string;
  changeAction?: string;
  establishNow?: string;
  firstPersonalScene?: string;
  revealLater?: string;
  sourceStatus?: string;
  /** Forfatterfasit — intern, aldri i spillerflater. */
  authorTruth?: string;
  observable?: string;
  ages?: Partial<Record<'1797' | '1802' | '1817', string>>;
  voiceCast?: { child?: string; adult?: string };
  memoryTrack?: NarrativeMemoryTrack[];
  powers?: { mental?: string[]; active?: { name: string; tier: 0 | 1 | 2 | 3 } };
  notes?: string;
}
export interface NarrativeLocationProfile {
  eras?: Array<'pre' | '1797' | '1802' | '1817'>;
  continuity?: string;
  geometryStatus?: string;
  props?: string[];
  notes?: string;
}
export type NarrativeComponentProfile = (NarrativeCharacterProfile & NarrativeLocationProfile & { summary?: string; rules?: string[] }) & Record<string, unknown>;

export interface NarrativeComponent {
  id: string;
  projectId: string;
  name: string;
  folderPath: string;
  coverAssetId: string | null;
  customId: string | null;
  sortOrder: number;
  kind: NarrativeComponentKind;
  profile: NarrativeComponentProfile;
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
    settings: { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null, locales: ['nb'], i18n: {} },
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

// ─── Fase 3: deling og import ───────────────────────────────────────────

export type NarrativeShareMode = 'view_play' | 'play_only';
export const NARRATIVE_SHARE_MODES: readonly NarrativeShareMode[] = ['view_play', 'play_only'];
export const SHARE_MODE_LABELS: Record<NarrativeShareMode, string> = {
  play_only: 'Kun spill',
  view_play: 'Spill + debugger',
};

export interface NarrativeShareLink {
  id: string;
  projectId: string;
  mode: NarrativeShareMode;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface NarrativeImportWarning {
  message: string;
  ref?: string;
}

export interface NarrativePublicStory {
  title: string;
  mode: NarrativeShareMode;
  graph: NarrativeGraph;
}

// ─── Fase 6: Scener & gameplay + Review & Godkjenning ──────────────────

export type NarrativeSceneStatus = 'idea' | 'in_progress' | 'in_review' | 'changes_requested' | 'approved' | 'implemented';
export type NarrativeSceneTaskStatus = 'todo' | 'doing' | 'done';
export type NarrativeSceneReviewStatus = 'in_review' | 'changes_requested' | 'approved' | 'superseded';
export type NarrativeSceneLinkKind = 'element' | 'board' | 'component';

export const NARRATIVE_SCENE_STATUSES: readonly NarrativeSceneStatus[] =
  ['idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented'];

export interface NarrativeScene {
  id: string;
  projectId: string;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  challenge: string;
  gameplayMechanic: string;
  environment: string;
  status: NarrativeSceneStatus;
  assigneeUserId: string | null;
  dueAt: string | null;
  heroAssetId: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Fase 7: scenekort v2
  beforeState: string;
  action: string;
  control: string;
  afterState: string;
  audio: string;
  changeNote: string;
  bridge: string;
  timeNote: string;
  knowledge: NarrativeSceneKnowledge;
  era: NarrativeSceneEra;
  episodeId: string | null;
  startAt: string | null;
  sourceRefs: NarrativeSourceRef[];
  workingId: string | null;
}

export type NarrativeSceneEra = 'pre' | '1797' | '1802' | '1817' | 'other';
export const NARRATIVE_SCENE_ERAS: readonly NarrativeSceneEra[] = ['pre', '1797', '1802', '1817', 'other'];
export const NARRATIVE_SCENE_ERA_LABELS: Record<NarrativeSceneEra, string> = { pre: 'Før 1797', '1797': '1797 · barndom', '1802': '1802 · ungdom', '1817': '1817 · voksen', other: 'Annet' };
export type NarrativeSourceTag = 'W' | 'K' | 'U' | 'A' | 'E' | 'T';
export const NARRATIVE_SOURCE_TAGS: readonly NarrativeSourceTag[] = ['W', 'K', 'U', 'A', 'E', 'T'];
export const NARRATIVE_SOURCE_TAG_LABELS: Record<NarrativeSourceTag, string> = {
  W: 'Word-manus (kildehendelse)', K: 'Kult-PDF (kildehendelse)', U: 'Brukertillegg', A: 'Iscenesettelsesforslag', E: 'Bevart engelsk', T: 'Ny oversettelse',
};
export interface NarrativeSourceRef { tag: NarrativeSourceTag; ref: string; field?: string; note?: string }
export interface NarrativeSceneKnowledge { actualPast?: string; recollection?: string; ownerPerspective?: string; othersObserve?: string; audienceKnows?: string; saidAloud?: string }
export const NARRATIVE_KNOWLEDGE_LABELS: Record<keyof NarrativeSceneKnowledge, string> = {
  actualPast: 'Faktisk fortid', recollection: 'Slik det huskes', ownerPerspective: 'Eierens perspektiv', othersObserve: 'Hva andre ser', audienceKnows: 'Hva publikum vet', saidAloud: 'Hva som sies høyt',
};

export interface NarrativeSceneLink {
  sceneId: string;
  ownerKind: NarrativeSceneLinkKind;
  ownerId: string;
  sortOrder: number;
}

export interface NarrativeSceneFrame {
  id: string;
  sceneId: string;
  projectId: string;
  assetId: string | null;
  externalUrl: string | null;
  caption: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSceneTask {
  id: string;
  sceneId: string;
  projectId: string;
  title: string;
  status: NarrativeSceneTaskStatus;
  assigneeUserId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSceneReview {
  id: string;
  sceneId: string;
  projectId: string;
  round: number;
  status: NarrativeSceneReviewStatus;
  requestedBy: string | null;
  requestedAt: string;
  requestNote: string | null;
  decidedByUserId: string | null;
  decidedByLabel: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  snapshotHash: string;
}

export interface NarrativeSceneSummary extends NarrativeScene {
  latestReview: Pick<NarrativeSceneReview, 'id' | 'round' | 'status' | 'requestedAt' | 'decidedAt'> | null;
  taskCounts: { total: number; done: number };
}

export interface NarrativeSceneDetail {
  scene: NarrativeScene;
  links: NarrativeSceneLink[];
  frames: NarrativeSceneFrame[];
  tasks: NarrativeSceneTask[];
  reviews: NarrativeSceneReview[];
  gates: NarrativeSceneGate[];
  lines: NarrativeSceneLine[];
  currentSnapshotHash: string;
}

// ─── Fase 7: produksjons-OS ────────────────────────────────────────────

export type NarrativeGateKey = 'script_coverage' | 'greybox' | 'characters_animation' | 'playthrough' | 'picture' | 'audio';
export const NARRATIVE_GATE_KEYS: readonly NarrativeGateKey[] = ['script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio'];
export const NARRATIVE_GATE_LABELS: Record<NarrativeGateKey, string> = {
  script_coverage: 'Manusdekning', greybox: 'Gråboks / regelprøve', characters_animation: 'Karakterer og animasjon',
  playthrough: 'iPad-gjennomspilling', picture: 'Bilde', audio: 'Foley / dialog / miks',
};
export type NarrativeGateStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';
export const NARRATIVE_GATE_STATUS_LABELS: Record<NarrativeGateStatus, string> = { not_started: 'Ikke startet', in_progress: 'Pågår', passed: 'Bestått', failed: 'Feilet' };
export interface NarrativeSceneGate {
  sceneId: string;
  projectId: string;
  gateKey: NarrativeGateKey;
  status: NarrativeGateStatus;
  evidence: string;
  evidenceRefs: string[];
  checkedBy: string | null;
  checkedAt: string | null;
  updatedAt: string | null;
}

export type NarrativeLineSourceType = 'E' | 'T' | 'E+T' | 'U' | 'A';
export const NARRATIVE_LINE_SOURCE_TYPES: readonly NarrativeLineSourceType[] = ['E', 'T', 'E+T', 'U', 'A'];
export type NarrativeLineRecordingStatus = 'none' | 'needs_take' | 'recorded' | 'approved';
export const NARRATIVE_RECORDING_LABELS: Record<NarrativeLineRecordingStatus, string> = { none: 'Ikke bestilt', needs_take: 'Trenger take', recorded: 'Innspilt', approved: 'Godkjent' };
export interface NarrativeSceneLine {
  id: string;
  sceneId: string;
  projectId: string;
  cueId: string;
  speakerComponentId: string | null;
  speakerLabel: string;
  perspective: string;
  textEn: string;
  textNb: string;
  sourceType: NarrativeLineSourceType;
  recordingStatus: NarrativeLineRecordingStatus;
  note: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
export const NARRATIVE_CUE_ID_RE = /^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?(\.[0-9]{1,3})?$/;

export type NarrativeEpisodeStatus = 'draft' | 'locked';
export interface NarrativeEpisode {
  id: string;
  projectId: string;
  code: string;
  title: string;
  summary: string;
  playersLearn: string;
  sourceNote: string;
  status: NarrativeEpisodeStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type NarrativeQuestionKind = 'question' | 'check';
export type NarrativeQuestionStatus = 'open' | 'done' | 'dropped';
export interface NarrativeOpenQuestion {
  id: string;
  projectId: string;
  code: string;
  kind: NarrativeQuestionKind;
  question: string;
  context: string;
  status: NarrativeQuestionStatus;
  decision: string;
  decidedBy: string | null;
  decidedAt: string | null;
  sourceRefs: NarrativeSourceRef[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type NarrativeSourceKind = 'docx' | 'pdf' | 'md' | 'txt' | 'other';
export interface NarrativeSource {
  id: string;
  projectId: string;
  code: string;
  label: string;
  kind: NarrativeSourceKind;
  sha256: string | null;
  pathHint: string;
  notes: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type NarrativeMilestoneLane = 'story' | 'greybox' | 'characters' | 'playtest' | 'picture_audio' | 'engineering' | 'other';
export const NARRATIVE_MILESTONE_LANES: readonly NarrativeMilestoneLane[] = ['story', 'greybox', 'characters', 'playtest', 'picture_audio', 'engineering', 'other'];
export const NARRATIVE_LANE_LABELS: Record<NarrativeMilestoneLane, string> = {
  story: 'Manus', greybox: 'Gråboks', characters: 'Karakterer', playtest: 'Gjennomspilling', picture_audio: 'Bilde & lyd', engineering: 'Teknikk', other: 'Annet',
};
export type NarrativeMilestoneStatus = 'planned' | 'in_progress' | 'done' | 'blocked';
export const NARRATIVE_MILESTONE_STATUS_LABELS: Record<NarrativeMilestoneStatus, string> = { planned: 'Planlagt', in_progress: 'Pågår', done: 'Ferdig', blocked: 'Blokkert' };
export interface NarrativeMilestone {
  id: string;
  projectId: string;
  title: string;
  lane: NarrativeMilestoneLane;
  startAt: string | null;
  dueAt: string | null;
  status: NarrativeMilestoneStatus;
  ownerUserId: string | null;
  description: string;
  acceptance: string;
  evidence: string;
  sortOrder: number;
  sceneIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type NarrativePlatform = 'ipad' | 'iphone' | 'mac' | 'pc' | 'console' | 'web' | 'other';
export const NARRATIVE_PLATFORMS: readonly NarrativePlatform[] = ['ipad', 'iphone', 'mac', 'pc', 'console', 'web', 'other'];
export const NARRATIVE_PLATFORM_LABELS: Record<NarrativePlatform, string> = { ipad: 'iPad', iphone: 'iPhone', mac: 'Mac', pc: 'PC', console: 'Konsoll', web: 'Nett', other: 'Annet' };
export interface NarrativePlatformRequirement { code: string; text: string; status: 'unverified' | 'verified' | 'failed'; evidence?: string; source?: string }
export interface NarrativePlatformTarget {
  id: string;
  projectId: string;
  name: string;
  platform: NarrativePlatform;
  isPrimary: boolean;
  engine: string;
  osMin: string;
  deviceMin: string;
  inputModel: string;
  budgets: Record<string, unknown>;
  requirements: NarrativePlatformRequirement[];
  visualDirection: Record<string, unknown>;
  notes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeActivityItem {
  kind: 'scene' | 'review' | 'task' | 'gate' | 'milestone' | 'revision';
  id: string;
  title: string;
  detail: string;
  at: string;
  sceneId: string | null;
}
export interface NarrativeProjectOverview {
  scenes: { total: number; byStatus: Record<NarrativeSceneStatus, number>; byEra: Record<string, number>; withoutDates: number };
  gates: { total: number; passed: number; failed: number; byKey: Record<NarrativeGateKey, { passed: number; total: number }> };
  tasks: { open: number; overdue: number; done: number };
  reviews: { open: number };
  lines: { total: number; approved: number };
  questions: { open: number; checksOpen: number };
  /** Fase 8d: ventende manusvakt-funn. Valgfri for eldre mocks. */
  guardian?: { pending: number; high: number };
  /** Fase 8e: spilltest siste 7 dager. */
  playtest?: { sessions7d: number; worstDropOff: { sceneCode: string; sessions: number } | null };
  platform: { requirements: number; verified: number; primaryName: string | null };
  milestones: NarrativeMilestone[];
  episodes: Array<{ id: string; code: string; title: string; sceneCount: number; approvedCount: number }>;
  activity: NarrativeActivityItem[];
  unreadInbox: number;
  /** Fase 9: neste scene å bygge (første uferdige scene uten bestått gråboks). */
  nextScene?: { id: string; code: string; title: string; scriptCovered: boolean; openTasks: number } | null;
}
export interface NarrativeInboxItem {
  id: string;
  eventType: string;
  title: string;
  message: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
}

export interface NarrativeMemberLite {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  isOwner: boolean;
}

// ─── Fase 7e-2: gjeste-reviewere ───────────────────────────────────────
export type NarrativeReviewAccessMode = 'view' | 'comment' | 'approve';
export const NARRATIVE_REVIEW_ACCESS_LABELS: Record<NarrativeReviewAccessMode, string> = { view: 'Bare se', comment: 'Se og kommentere', approve: 'Kommentere og beslutte' };
export interface NarrativeReviewShareLink {
  id: string;
  projectId: string;
  sceneId: string;
  reviewId: string;
  accessMode: NarrativeReviewAccessMode;
  requireIdentity: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdBy: string;
  createdAt: string;
}
export interface NarrativeReviewSnapshot {
  v?: number;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  challenge: string;
  gameplayMechanic: string;
  environment: string;
  heroAssetId: string | null;
  frames: Array<{ assetId: string | null; externalUrl: string | null; caption: string }>;
  links: Array<{ ownerKind: string; ownerId: string; title: string }>;
  script?: { beforeState: string; action: string; control: string; afterState: string; audio: string; changeNote: string; bridge: string; timeNote: string; knowledge: NarrativeSceneKnowledge };
  era?: NarrativeSceneEra;
  sourceRefs?: NarrativeSourceRef[];
  lines?: Array<{ cueId: string; speakerLabel: string; textEn: string; textNb: string; sourceType: NarrativeLineSourceType; perspective: string }>;
}
export interface NarrativeGuestReview {
  requiresIdentity: boolean;
  scene: { id?: string; code: string; title: string; status?: NarrativeSceneStatus };
  round: { id: string; round: number; status: NarrativeSceneReviewStatus; requestedAt: string; requestNote: string | null; decidedAt: string | null; decidedByLabel: string | null; decisionNote: string | null; snapshotHash: string };
  snapshot?: NarrativeReviewSnapshot;
  share: { accessMode: NarrativeReviewAccessMode; requireIdentity: boolean; expiresAt: string | null };
  reviewer: { id: string; displayName: string; email: string | null } | null;
}
