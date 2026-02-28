/**
 * Role Room domain model
 * Centralized type and helper exports consumed across role-room modules.
 */

export type UserRoleType =
  | 'director'
  | 'producer'
  | 'casting_director'
  | 'production_manager'
  | 'camera_team'
  | 'agency'
  | 'writer'
  | 'script_editor'
  | 'reader';

export interface UserRolePermissions {
  canViewAll?: boolean;
  canEditCasting?: boolean;
  canEditProduction?: boolean;
  canManageCrew?: boolean;
  canManageLocations?: boolean;
  canEditShots?: boolean;
  canApprove?: boolean;
  canEditScript?: boolean;
  canLockScript?: boolean;
  canRunTableRead?: boolean;
}

export interface UserRole {
  id: string;
  projectId?: string;
  project_id?: string;
  userId?: string;
  user_id?: string;
  email?: string;
  role: UserRoleType;
  permissions?: UserRolePermissions;
  addedBy?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export type CrewDepartment =
  | 'camera'
  | 'sound'
  | 'lighting'
  | 'production'
  | 'post'
  | 'art'
  | 'wardrobe'
  | 'other';

export type CrewRole =
  | 'director'
  | 'producer'
  | 'casting_director'
  | 'production_manager'
  | 'production_assistant'
  | 'script_supervisor'
  | 'location_manager'
  | 'camera_operator'
  | 'camera_assistant'
  | 'cinematographer'
  | 'drone_pilot'
  | 'gaffer'
  | 'grip'
  | 'sound_engineer'
  | 'audio_mixer'
  | 'video_editor'
  | 'colorist'
  | 'vfx_artist'
  | 'motion_graphics'
  | 'production_designer'
  | 'makeup_artist'
  | 'wardrobe'
  | 'stylist'
  | 'collaborator'
  | 'other'
  | (string & {});

export type CrewStatus = 'confirmed' | 'pending' | 'invited' | 'unavailable' | (string & {});

export interface ContactInfo {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  description?: string;
  ageRange?: string;
  age_range?: string;
  gender?: string;
  ethnicity?: string;
  roleType?: string;
  role_type?: string;
  sceneIds?: string[];
  scene_ids?: string[];
  status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Candidate {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  photos?: string[];
  videos?: string[];
  photoFocalPoints?: Array<{ x: number; y: number }>;
  email?: string;
  phone?: string;
  agency?: string;
  notes?: string;
  status?: string;
  roleId?: string;
  role_id?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CrewMember {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  role: CrewRole;
  department?: CrewDepartment;
  status?: CrewStatus;
  contactInfo?: ContactInfo;
  contact_info?: ContactInfo;
  rate?: number;
  notes?: string;
  assignedScenes?: string[];
  assigned_scenes?: string[];
  availability?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CrewAssignment {
  id?: string;
  crewMemberId: string;
  crew_member_id?: string;
  shootDayId: string;
  shoot_day_id?: string;
  projectId?: string;
  role?: string;
  callTime?: string;
  wrapTime?: string;
  notes?: string;
  status?: string;
}

export interface CrewConflict {
  id?: string;
  type: 'double_booking' | 'day_off' | 'max_hours' | 'availability' | 'time_overlap' | string;
  crewMemberId?: string;
  shootDayId?: string;
  message?: string;
  severity?: 'low' | 'medium' | 'high' | string;
  [key: string]: unknown;
}

export interface AvailabilityCell {
  date: string;
  status: 'available' | 'unavailable' | 'tentative' | string;
  reason?: string;
  [key: string]: unknown;
}

export interface Schedule {
  id: string;
  projectId?: string;
  project_id?: string;
  title?: string;
  candidateId?: string;
  candidate_id?: string;
  roleId?: string;
  role_id?: string;
  sceneId?: string;
  scene_id?: string;
  locationId?: string;
  location_id?: string;
  date?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  type?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Location {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  contactInfo?: ContactInfo;
  contact_info?: ContactInfo;
  accessNotes?: string;
  assignedScenes?: string[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Prop {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  category?: string;
  description?: string;
  quantity?: number;
  assignedScenes?: string[];
  availability?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ProductionPhase = 'planning' | 'shooting' | 'review' | 'delivery' | (string & {});
export type MediaType = 'photo' | 'video' | 'hybrid';
export type ShotPriority = 'critical' | 'important' | 'nice_to_have';
export type ShotStatus = 'not_started' | 'in_progress' | 'completed';
export type TakeStatus = 'pending' | 'selected' | 'rejected' | 'print' | 'alt' | (string & {});

export type ShotType =
  | 'Wide'
  | 'Medium'
  | 'Close-up'
  | 'Extreme Close-up'
  | 'Establishing'
  | 'Detail'
  | 'Two Shot'
  | 'Over Shoulder'
  | 'Point of View';

export type CameraAngle =
  | 'Eye Level'
  | 'High Angle'
  | 'Low Angle'
  | 'Birds Eye'
  | 'Worms Eye'
  | 'Dutch Angle'
  | 'Overhead'
  | (string & {});

export type CameraMovement =
  | 'Static'
  | 'Pan'
  | 'Tilt'
  | 'Dolly'
  | 'Truck'
  | 'Crane'
  | 'Handheld'
  | 'Steadicam'
  | 'Zoom'
  | 'Orbit'
  | (string & {});

export interface ShotCamera {
  angle?: CameraAngle;
  movement?: CameraMovement;
  focalLength?: number;
  aperture?: number;
  shutter?: number;
  iso?: number;
  fps?: number;
  resolution?: string;
  codec?: string;
  [key: string]: unknown;
}

export interface ShotLighting {
  setup?: string;
  keyLight?: string;
  fillLight?: string;
  backLight?: string;
  [key: string]: unknown;
}

export interface ShotAudio {
  channels?: number;
  notes?: string;
  [key: string]: unknown;
}

export type NoteTag = 'continuity' | 'safety' | 'performance' | 'technical' | string;
export type QuickActionType = 'note' | 'call' | 'sms' | 'email' | 'flag' | string;

export interface ShotNote {
  id: string;
  text: string;
  tag?: NoteTag;
  createdBy?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ShotComment {
  id: string;
  text: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
  resolved?: boolean;
  [key: string]: unknown;
}

export interface ShotAssignment {
  personId: string;
  roleId?: string;
  roleName?: string;
  name?: string;
  status?: 'pending' | 'confirmed' | 'rejected' | string;
  assignedAt?: string;
  [key: string]: unknown;
}

export interface CastingShot {
  id: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  description?: string;
  roleId?: string;
  sceneId?: string;
  locationId?: string;
  duration?: number;
  estimatedTime?: number;
  notes?: string;
  fieldNotes?: string;
  mediaType?: MediaType;
  priority?: ShotPriority;
  status?: ShotStatus;
  lensRecommendation?: string;
  lightingSetup?: string;
  backgroundRecommendation?: string;
  assigneeId?: string;
  assigneeName?: string;
  assignments?: ShotAssignment[];
  reservedBy?: string;
  comments?: ShotComment[];
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  camera?: ShotCamera;
  lighting?: ShotLighting;
  audio?: ShotAudio;
  notesList?: ShotNote[];
  [key: string]: unknown;
}

export type ProductionContext =
  | 'commercial'
  | 'music_video'
  | 'short_film'
  | 'feature_film'
  | 'documentary'
  | 'social_media'
  | 'event'
  | 'corporate'
  | 'wedding'
  | 'behind_the_scenes'
  | 'custom';

export interface ProductionPreset {
  id: ProductionContext;
  name: string;
  description: string;
  icon:
    | 'nature'
    | 'shopping_bag'
    | 'home'
    | 'movie'
    | 'videocam'
    | 'person'
    | 'event'
    | 'tune';
  defaultMediaType: MediaType;
  defaultPriority: ShotPriority;
  typicalDuration: number;
  suggestedLenses: string[];
  suggestedLighting: string[];
}

export interface ShotListDefaultAssignee {
  personId: string;
  roleId?: string;
  roleName?: string;
}

export interface ShotList {
  id: string;
  projectId?: string;
  project_id?: string;
  sceneId: string;
  scene_id?: string;
  sceneName?: string;
  shots: CastingShot[];
  cameraSettings?: Record<string, unknown>;
  equipment?: unknown[];
  notes?: string;
  productionContext?: ProductionContext;
  productionPhase?: ProductionPhase;
  deadline?: string;
  colorTag?: string;
  defaultAssignees?: ShotListDefaultAssignee[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ProductionDay {
  id: string;
  projectId?: string;
  date?: string;
  scenes: string[];
  callTime?: string;
  wrapTime?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type PersonType = 'cast' | 'crew' | 'both';

export interface Person {
  id: string;
  projectId?: string;
  name: string;
  personType: PersonType;
  crewRole?: CrewRole;
  characterName?: string;
  contactInfo?: ContactInfo;
  rate?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CastingProject {
  id: string;
  name: string;
  description?: string;
  status?: string;
  genre?: string;
  projectType?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  roles: Role[];
  candidates: Candidate[];
  crew: CrewMember[];
  schedules: Schedule[];
  locations: Location[];
  props: Prop[];
  productionDays?: ProductionDay[];
  shotLists?: ShotList[];
  sceneBreakdowns?: SceneBreakdown[];
  userRoles?: UserRole[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SceneBreakdown {
  id: string;
  manuscriptId?: string;
  projectId?: string;
  sceneNumber?: number | string;
  heading?: string;
  sceneName?: string;
  locationName?: string;
  intExt?: 'INT' | 'EXT' | 'INT/EXT' | string;
  timeOfDay?: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | string;
  pageLength?: number;
  colorTag?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DialogueLine {
  id: string;
  manuscriptId: string;
  sceneId?: string;
  characterName?: string;
  text: string;
  lineNumber?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Act {
  id: string;
  manuscriptId: string;
  title: string;
  index: number;
  summary?: string;
  [key: string]: unknown;
}

export interface ScriptRevision {
  id: string;
  manuscriptId: string;
  version: string;
  changeSummary?: string;
  content?: string;
  createdAt?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export interface Manuscript {
  id: string;
  projectId: string;
  title: string;
  content: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ManuscriptExport {
  manuscript: Manuscript;
  acts: Act[];
  scenes: SceneBreakdown[];
  dialogue: DialogueLine[];
  revisions?: ScriptRevision[];
  [key: string]: unknown;
}

export interface StoryboardFrame {
  id: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotType?: ShotType;
  cameraAngle?: CameraAngle;
  cameraMovement?: CameraMovement;
  title?: string;
  description?: string;
  duration?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LiveSetScene {
  id: string;
  sceneId?: string;
  shotListId?: string;
  name?: string;
  [key: string]: unknown;
}

export interface LiveSetCameraMetadata {
  deviceId?: string;
  lens?: string;
  fps?: number;
  resolution?: string;
  [key: string]: unknown;
}

export interface LiveSetTake {
  id: string;
  shotId: string;
  takeNumber: number;
  status?: TakeStatus;
  metadata?: LiveSetCameraMetadata;
  createdAt?: string;
  [key: string]: unknown;
}

export interface LiveSetNote {
  id: string;
  text: string;
  tag?: NoteTag;
  createdBy?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface LiveSetState {
  projectId: string;
  activeSceneId?: string;
  activeShotId?: string;
  takes?: LiveSetTake[];
  notes?: LiveSetNote[];
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | string;
  read: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'unassign'
  | 'status_change'
  | 'comment'
  | string;

export interface ActivityLogEntry {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: ActivityActionType;
  targetType: 'shot' | 'shotlist' | 'comment' | 'project' | string;
  targetId: string;
  targetName: string;
  details?: {
    previousValue?: unknown;
    newValue?: unknown;
    fieldChanged?: string;
    [key: string]: unknown;
  };
  timestamp: string;
  read?: boolean;
}

export type ConsentType =
  | 'photo_release'
  | 'video_release'
  | 'audio_release'
  | 'location_release'
  | 'minor_consent'
  | 'other';

export type ConsentInvitationStatus = 'not_sent' | 'sent' | 'viewed' | 'signed' | 'declined';

export interface ConsentSignatureData {
  signature: string;
  signed_by: string;
  signed_at: string;
  ip_address?: string;
  user_agent?: string;
  [key: string]: unknown;
}

export interface Consent {
  id: string;
  candidateId: string;
  candidate_id?: string;
  projectId: string;
  project_id?: string;
  type: ConsentType;
  title?: string;
  description?: string;
  document?: string;
  signed: boolean;
  date?: string;
  notes?: string;
  accessCode?: string;
  invitationStatus?: ConsentInvitationStatus;
  signatureData?: ConsentSignatureData;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export const PRODUCTION_PRESETS: Record<ProductionContext, ProductionPreset> = {
  feature_film: {
    id: 'feature_film',
    name: 'Feature Film',
    description: 'Narrative cinematic workflow with robust coverage.',
    icon: 'movie',
    defaultMediaType: 'hybrid',
    defaultPriority: 'important',
    typicalDuration: 8,
    suggestedLenses: ['24mm', '35mm', '50mm', '85mm'],
    suggestedLighting: ['3-point key/fill/back', 'motivated practicals'],
  },
  short_film: {
    id: 'short_film',
    name: 'Short Film',
    description: 'Fast narrative setup with high visual impact.',
    icon: 'movie',
    defaultMediaType: 'hybrid',
    defaultPriority: 'important',
    typicalDuration: 6,
    suggestedLenses: ['24mm', '35mm', '50mm'],
    suggestedLighting: ['soft key + negative fill', 'single-source practical'],
  },
  documentary: {
    id: 'documentary',
    name: 'Documentary',
    description: 'Observational approach prioritizing agility and coverage.',
    icon: 'nature',
    defaultMediaType: 'video',
    defaultPriority: 'important',
    typicalDuration: 5,
    suggestedLenses: ['24-70mm', '70-200mm'],
    suggestedLighting: ['available light', 'portable LED fill'],
  },
  commercial: {
    id: 'commercial',
    name: 'Commercial',
    description: 'High-control ad workflow with polished hero shots.',
    icon: 'shopping_bag',
    defaultMediaType: 'hybrid',
    defaultPriority: 'critical',
    typicalDuration: 10,
    suggestedLenses: ['35mm', '50mm', '85mm', '100mm macro'],
    suggestedLighting: ['soft key with edge light', 'product kicker'],
  },
  music_video: {
    id: 'music_video',
    name: 'Music Video',
    description: 'Stylized performance and motion-driven shot language.',
    icon: 'videocam',
    defaultMediaType: 'video',
    defaultPriority: 'important',
    typicalDuration: 6,
    suggestedLenses: ['16-35mm', '35mm', '50mm'],
    suggestedLighting: ['RGB practicals', 'backlight haze'],
  },
  social_media: {
    id: 'social_media',
    name: 'Social Media',
    description: 'Short-form output with fast turnaround cadence.',
    icon: 'person',
    defaultMediaType: 'hybrid',
    defaultPriority: 'important',
    typicalDuration: 4,
    suggestedLenses: ['24mm', '35mm'],
    suggestedLighting: ['ring/soft key', 'natural window fill'],
  },
  event: {
    id: 'event',
    name: 'Event',
    description: 'Live coverage balancing moments and safety shots.',
    icon: 'event',
    defaultMediaType: 'hybrid',
    defaultPriority: 'important',
    typicalDuration: 5,
    suggestedLenses: ['24-70mm', '70-200mm'],
    suggestedLighting: ['on-camera fill', 'ambient practicals'],
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    description: 'Interview + b-roll structure for brand communication.',
    icon: 'tune',
    defaultMediaType: 'video',
    defaultPriority: 'important',
    typicalDuration: 7,
    suggestedLenses: ['35mm', '50mm', '85mm'],
    suggestedLighting: ['interview 3-point', 'soft office practicals'],
  },
  wedding: {
    id: 'wedding',
    name: 'Wedding',
    description: 'Ceremony-first capture with documentary moments.',
    icon: 'event',
    defaultMediaType: 'hybrid',
    defaultPriority: 'critical',
    typicalDuration: 5,
    suggestedLenses: ['24-70mm', '70-200mm', '35mm'],
    suggestedLighting: ['natural light + fill', 'reception bounce'],
  },
  behind_the_scenes: {
    id: 'behind_the_scenes',
    name: 'Behind The Scenes',
    description: 'On-set capture for making-of and promos.',
    icon: 'videocam',
    defaultMediaType: 'video',
    defaultPriority: 'nice_to_have',
    typicalDuration: 4,
    suggestedLenses: ['24mm', '35mm', '50mm'],
    suggestedLighting: ['available light', 'small LED accents'],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Flexible preset for project-specific workflows.',
    icon: 'tune',
    defaultMediaType: 'hybrid',
    defaultPriority: 'important',
    typicalDuration: 5,
    suggestedLenses: ['35mm'],
    suggestedLighting: ['base key + fill'],
  },
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeAssignment(input: ShotAssignment): ShotAssignment | null {
  if (!hasText(input.personId)) return null;
  return {
    personId: input.personId,
    roleId: hasText(input.roleId) ? input.roleId : undefined,
    roleName: hasText(input.roleName) ? input.roleName : undefined,
    name: hasText(input.name) ? input.name : undefined,
    status: input.status ?? 'pending',
    assignedAt: input.assignedAt ?? new Date().toISOString(),
  };
}

/**
 * Inherit assignees from shot-list defaults when a shot has no explicit assignments.
 */
export function inheritAssignmentsFromShotList(
  list: ShotList,
  shot: CastingShot,
): ShotAssignment[] {
  const explicitAssignments = (shot.assignments ?? [])
    .map(normalizeAssignment)
    .filter((value): value is ShotAssignment => value !== null);

  if (explicitAssignments.length > 0) {
    return explicitAssignments;
  }

  const derived: ShotAssignment[] = [];

  if (hasText(shot.assigneeId)) {
    derived.push({
      personId: shot.assigneeId,
      roleName: hasText(shot.assigneeName) ? shot.assigneeName : undefined,
      status: 'pending',
      assignedAt: new Date().toISOString(),
    });
  }

  for (const defaultAssignee of list.defaultAssignees ?? []) {
    if (!hasText(defaultAssignee.personId)) continue;
    derived.push({
      personId: defaultAssignee.personId,
      roleId: hasText(defaultAssignee.roleId) ? defaultAssignee.roleId : undefined,
      roleName: hasText(defaultAssignee.roleName) ? defaultAssignee.roleName : undefined,
      status: 'pending',
      assignedAt: new Date().toISOString(),
    });
  }

  const deduped = new Map<string, ShotAssignment>();
  for (const assignment of derived) {
    const key = `${assignment.personId}:${assignment.roleId ?? ''}`;
    if (!deduped.has(key)) deduped.set(key, assignment);
  }

  return Array.from(deduped.values());
}
