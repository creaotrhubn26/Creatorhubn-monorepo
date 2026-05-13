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
  | 'content_producer'
  | 'client_reviewer'
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
  canEditShotLists?: boolean;
  canApprove?: boolean;
  canEditScript?: boolean;
  canLockScript?: boolean;
  canRunTableRead?: boolean;
  canComment?: boolean;
  canRequestChanges?: boolean;
  canViewEconomy?: boolean;
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

export type RoleRoomGoogleConnectionState = 'disconnected' | 'connected' | 'expired' | 'error';

export type RoleRoomLinkedInConnectionState = 'disconnected' | 'connected' | 'expired' | 'error';

export interface RoleRoomGoogleConnection {
  id: string;
  userId: string;
  roleRoomEmail?: string | null;
  googleEmail?: string | null;
  googleSubject?: string | null;
  scopes: string[];
  state: RoleRoomGoogleConnectionState;
  lastError?: string | null;
  profile: Record<string, unknown>;
  expiryDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
}

export interface RoleRoomLinkedInConnection {
  id: string;
  userId: string;
  roleRoomEmail?: string | null;
  linkedInMemberId?: string | null;
  linkedInEmail?: string | null;
  linkedInName?: string | null;
  scopes: string[];
  state: RoleRoomLinkedInConnectionState;
  lastError?: string | null;
  profile: Record<string, unknown>;
  expiryDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
}

export interface RoleRoomGoogleArtifactRef {
  id: string;
  projectId: string;
  localEntityType: string;
  localEntityId: string;
  artifactType: string;
  sourceLabel?: string | null;
  driveFileId?: string | null;
  calendarEventId?: string | null;
  meetUrl?: string | null;
  webViewUrl?: string | null;
  webContentLink?: string | null;
  mimeType?: string | null;
  folderKey?: string | null;
  syncStatus?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleRoomGoogleSyncStatus {
  drive?: Record<string, unknown>;
  calendar?: Record<string, unknown>;
  meet?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RoleRoomGoogleProjectBinding {
  id: string;
  projectId: string;
  connectedUserId?: string | null;
  driveRootFolderId?: string | null;
  calendarId?: string | null;
  contactsContext: Record<string, unknown>;
  meetCreationEnabled: boolean;
  auditSignatureStorageEnabled: boolean;
  folderLayout: Record<string, unknown>;
  syncStatus: RoleRoomGoogleSyncStatus;
  createdAt?: string;
  updatedAt?: string;
  lastDriveSyncAt?: string | null;
  lastCalendarSyncAt?: string | null;
}

export type RoleRoomGoogleAgreementSignatureStatus =
  | 'not_started'
  | 'prepared'
  | 'sent'
  | 'opened_in_google'
  | 'signed'
  | 'rejected'
  | 'changes_requested'
  | 'error';

export interface RoleRoomGoogleAgreementSignature {
  id: string;
  projectId: string;
  agreementId: string;
  provider: 'google_workspace';
  status: RoleRoomGoogleAgreementSignatureStatus;
  documentTitle?: string | null;
  driveSourceFileId?: string | null;
  signedDriveFileId?: string | null;
  auditArtifactId?: string | null;
  sourceArtifactId?: string | null;
  pdfSnapshotArtifactId?: string | null;
  signedPdfArtifactId?: string | null;
  requestUrl?: string | null;
  webViewUrl?: string | null;
  requestedBy?: string | null;
  requestedByEmail?: string | null;
  counterpartyName?: string | null;
  counterpartyEmail?: string | null;
  preparedAt?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  declinedAt?: string | null;
  lastOpenedAt?: string | null;
  lastSyncedAt?: string | null;
  signatureHash?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleRoomGoogleLoginResult {
  success: boolean;
  mode: 'login' | 'link';
  transferId: string;
  projectId?: string | null;
  autoConfiguredProjectBinding?: boolean | null;
  sessionToken?: string | null;
  user?: {
    id: number | string;
    email: string;
    role: string;
    display_name: string;
    name?: string;
    loginAs?: string;
    requestedRole?: string | null;
  } | null;
  google: {
    email: string;
    subject: string;
    profile: Record<string, unknown>;
  };
}

export interface RoleRoomClientInvite {
  id: string;
  email?: string | null;
  status: string;
  expiresAt?: string | null;
  accessDuration?: RoleRoomClientInviteAccessDuration | null;
  accessEndsAt?: string | null;
  lastSentAt?: string | null;
  lastViewedAt?: string | null;
  acceptedAt?: string | null;
  metadata: Record<string, unknown>;
  inviteUrl?: string | null;
  workspace?: string | null;
  tab?: string | null;
  sectionId?: string | null;
  pageId?: string | null;
  reviewId?: string | null;
  artifactId?: string | null;
  recipientName?: string | null;
  message?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  delivery?: {
    sent: boolean;
    reason?: string | null;
    provider?: string | null;
    messageId?: string | null;
    accepted?: string[];
  } | null;
}

export type RoleRoomClientInviteAccessDuration = 'forever' | 'project_end';

export interface RoleRoomClientInviteCreateInput {
  email: string;
  recipientName?: string | null;
  message?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  browserOrigin?: string;
  workspace?: string;
  tab?: string;
  sectionId?: string | null;
  pageId?: string | null;
  reviewId?: string | null;
  artifactId?: string | null;
  accessDuration?: RoleRoomClientInviteAccessDuration;
  sendEmail?: boolean;
  expiresAt?: string | null;
  expiresInDays?: number;
}

export interface RoleRoomClientInviteSessionResult {
  success: boolean;
  transferId: string;
  projectId: string;
  sessionToken: string;
  user: {
    id: number | string;
    email: string;
    role: string;
    display_name: string;
    name?: string;
    loginAs?: string;
    requestedRole?: string | null;
  };
  invite: {
    id: string;
    email: string;
    status: string;
    expiresAt?: string | null;
    acceptedAt?: string | null;
  };
  portal: {
    tab: string;
    workspace: string;
    sectionId?: string | null;
    pageId?: string | null;
    reviewId?: string | null;
    artifactId?: string | null;
  };
}

export interface RoleRoomLinkedInLinkResult {
  success: boolean;
  mode: 'link';
  transferId: string;
  linkedIn: {
    memberId: string;
    email?: string | null;
    name?: string | null;
    profile: Record<string, unknown>;
  };
}

export type RoleRoomGoogleFolderKey =
  | 'brief'
  | 'materials'
  | 'brand'
  | 'delivery'
  | 'approvals'
  | 'meetings';

export interface RoleRoomGoogleOauthStartInput {
  mode?: 'login' | 'link';
  returnPath?: string;
  browserOrigin?: string;
  loginAs?: string;
  requestedRole?: string | null;
  projectId?: string;
  email?: string;
}

export interface RoleRoomLinkedInOauthStartInput {
  mode?: 'link';
  returnPath?: string;
  browserOrigin?: string;
  projectId?: string;
  email?: string;
}

export interface RoleRoomGoogleProjectBindingUpdateInput {
  driveRootFolderId?: string | null;
  calendarId?: string | null;
  contactsContext?: Record<string, unknown>;
  meetCreationEnabled?: boolean;
  auditSignatureStorageEnabled?: boolean;
  folderLayout?: Record<string, unknown>;
  createDriveLayout?: boolean;
  createCalendar?: boolean;
}

export interface RoleRoomGoogleGeneratedArtifactInput {
  localEntityType: string;
  localEntityId: string;
  artifactType: 'drive_file';
  title: string;
  folderKey: RoleRoomGoogleFolderKey;
  mimeType?: string;
  sourceLabel?: string;
  contentText?: string;
  contentBase64?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RoleRoomGoogleCalendarAttendee {
  email: string;
  displayName?: string;
}

export interface RoleRoomGoogleCalendarEventInput {
  entityType: string;
  entityId: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  location?: string;
  phase?: string;
  allDay?: boolean;
  includeMeet?: boolean;
  attendees?: RoleRoomGoogleCalendarAttendee[];
}

export interface RoleRoomGoogleCalendarSyncInput {
  events: RoleRoomGoogleCalendarEventInput[];
  calendarId?: string;
}

export interface RoleRoomGoogleDriveSyncInput {
  fileIds?: string[];
  generatedArtifacts?: RoleRoomGoogleGeneratedArtifactInput[];
}

export interface RoleRoomGoogleMeetSessionInput extends RoleRoomGoogleCalendarEventInput {
  includeMeet?: true;
}

export interface RoleRoomGooglePersonContact {
  resourceName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
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
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: unknown;
}

export interface TravelCostBreakdown {
  kilometers?: number;
  fuelCost?: number;
  tollFees?: number;
  totalCost?: number;
  [key: string]: unknown;
}

export interface TravelCostEntry {
  breakdown?: TravelCostBreakdown;
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

export interface CandidateReminderPrefs {
  sms24h?: boolean;
  sms1h?: boolean;
  email24h?: boolean;
  email1h?: boolean;
  whatsapp24h?: boolean;
  whatsapp1h?: boolean;
}

export interface Candidate {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  photos?: string[];
  videos?: string[];
  photoFocalPoints?: Array<{ x: number; y: number }>;
  contactInfo?: ContactInfo;
  contact_info?: ContactInfo;
  email?: string;
  phone?: string;
  agency?: string;
  notes?: string;
  auditionNotes?: string;
  audition_notes?: string;
  status?: string;
  roleId?: string;
  role_id?: string;
  assignedRoles?: string[];
  assigned_roles?: string[];
  consent?: Array<Record<string, unknown>>;
  modelUrl?: string;
  personality?: string;
  reminderPrefs?: CandidateReminderPrefs;
  reminder_prefs?: CandidateReminderPrefs;
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
  notesAuthorName?: string;
  notesAuthorId?: string;
  notesUpdatedAt?: string;
  notesAuthor?: string;
  notesBy?: string;
  notesLastEditedAt?: string;
  notesTimestamp?: string;
  assignedScenes?: string[];
  assigned_scenes?: string[];
  travelCosts?: Record<string, TravelCostEntry>;
  travel_costs?: Record<string, TravelCostEntry>;
  availability?: {
    startDate?: string;
    endDate?: string;
    [key: string]: unknown;
  };
  availabilityCells?: AvailabilityCell[];
  splitSheet?: {
    percentage?: number;
    invitationStatus?: ConsentInvitationStatus;
    notes?: string;
    notesAuthorName?: string;
    notesAuthorId?: string;
    notesUpdatedAt?: string;
    notesAuthor?: string;
    notesBy?: string;
    notesLastEditedAt?: string;
    notesTimestamp?: string;
    [key: string]: unknown;
  };
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
  shootDayDate?: string;
  shoot_day_date?: string;
  projectId?: string;
  role?: string;
  unit?: 'A' | 'B' | (string & {});
  callTime?: string;
  wrapTime?: string;
  notes?: string;
  assignmentStatus?: 'assigned' | 'hold' | 'travel' | 'release' | (string & {});
  status?: string;
}

export interface CrewConflict {
  id?: string;
  type: 'double_booking' | 'day_off' | 'max_hours' | 'availability' | 'time_overlap' | string;
  crewMemberId: string;
  shootDayId?: string;
  date?: string;
  conflictType?: string;
  details?: string;
  message?: string;
  severity?: 'low' | 'medium' | 'high' | string;
  [key: string]: unknown;
}

export interface AvailabilityCell {
  date: string;
  availability?: 'available' | 'hold' | 'unavailable' | 'tentative' | string;
  status?: 'available' | 'unavailable' | 'tentative' | string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Audition-entitet — container som grupperer schedule-rader til én
 * logisk audition. Backend-store i `auditions`-tabell (migrasjon 140).
 *
 * Tidligere ble dette utledet synthetisk i frontend ved å gruppere
 * schedules på (date+time+roleId+locationId). Den syntetiske
 * grupperingen forblir aktivt som fallback for eldre data hvor
 * audition_id er null.
 */
export interface Audition {
  id: string;
  projectId?: string;
  project_id?: string;
  title: string;
  roleId?: string;
  role_id?: string;
  roleName?: string;
  role_name?: string;
  locationId?: string;
  location_id?: string;
  locationName?: string;
  location_name?: string;
  date: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  status?: 'scheduled' | 'confirmed' | 'awaiting_callback' | 'completed' | 'cancelled';
  /** Team-medlemmer for AvatarGroup-visning (casting director, assistants). */
  teamMembers?: Array<{ crewId: string; role: string }>;
  team_members?: Array<{ crewId: string; role: string }>;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  createdBy?: string;
  created_by?: string;
  updatedBy?: string;
  updated_by?: string;
  [key: string]: unknown;
}

export interface Schedule {
  id: string;
  projectId?: string;
  project_id?: string;
  /** Optional FK til auditions-tabellen. NULL for eldre rader uten grupperting. */
  auditionId?: string;
  audition_id?: string;
  title?: string;
  candidateId?: string;
  candidate_id?: string;
  candidateName?: string;
  candidate_name?: string;
  roleId?: string;
  role_id?: string;
  roleName?: string;
  role_name?: string;
  sceneId?: string;
  scene_id?: string;
  locationId?: string;
  location_id?: string;
  location?: string;
  date?: string;
  time?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  type?: string;
  status?: 'scheduled' | 'confirmed' | 'awaiting_callback' | 'completed' | 'cancelled' | 'pool';
  notes?: string;
  favorite?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface LocationPhotographySpot {
  name?: string;
  description?: string;
  lighting?: string;
  bestTimes?: string[];
  accessibility?: 'easy' | 'moderate' | 'difficult' | (string & {});
  notes?: string;
  restrictions?: string[];
  coordinates?: { lat: number; lng: number };
  [key: string]: unknown;
}

export interface LocationDroneRestrictions {
  allowed?: boolean;
  maxAltitude?: number;
  restrictions?: string[];
  noFlyZones?: Array<{ lat: number; lng: number }>;
  [key: string]: unknown;
}

export interface LocationWeatherExposure {
  windExposure?: 'low' | 'moderate' | 'high' | (string & {});
  sunExposure?: 'morning' | 'afternoon' | 'all-day' | (string & {});
  shelterOptions?: string[];
  droneSafety?: string;
  droneSafetyDescription?: string;
  windSpeedKmh?: number | null;
  windSpeed?: number | null;
  windDirection?: number | null;
  sunrise?: string;
  sunset?: string;
  daylightHours?: number | null;
  sunDescription?: string;
  [key: string]: unknown;
}

export interface LocationAccessSpot {
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  distance: number;
  spaces?: number;
  description?: string;
}

export interface LocationAccessAnalysis {
  accessibility?: 'wheelchair-accessible' | 'limited' | 'not-accessible' | (string & {});
  walkingDistance?: number;
  publicTransport?: string[];
  parkingSpots?: LocationAccessSpot[];
  evParking?: { distance?: number; description?: string };
  evCharging?: { distance?: number; description?: string };
  evParkingSpots?: LocationAccessSpot[];
  evChargingSpots?: LocationAccessSpot[];
  [key: string]: unknown;
}

export interface LocationPropertyAnalysis {
  photographySpots: LocationPhotographySpot[];
  droneRestrictions: LocationDroneRestrictions;
  weatherExposure: LocationWeatherExposure;
  accessAnalysis: LocationAccessAnalysis;
  manualNotes?: string;
  lastManualEditAt?: string;
  permitWorkflow?: {
    shootDate?: string;
    statuses?: Partial<Record<string, string>>;
    notes?: Partial<Record<string, string>>;
    operations?: Partial<Record<string, boolean>>;
    lastUpdated?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Location {
  id: string;
  projectId?: string;
  project_id?: string;
  name: string;
  type?: 'studio' | 'outdoor' | 'indoor' | 'virtual' | 'other' | (string & {});
  propertyId?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  capacity?: number;
  facilities?: string[];
  availability?: Record<string, unknown>;
  contactInfo?: ContactInfo;
  contact_info?: ContactInfo;
  accessNotes?: string;
  notes?: string;
  favorite?: boolean;
  isBasecamp?: boolean;
  media?: Record<string, unknown>;
  loadFlow?: {
    loadInAt?: string;
    shootStartAt?: string;
    wrapAt?: string;
    loadOutAt?: string;
    status?: 'planned' | 'ready' | 'in_progress' | 'completed' | (string & {});
    notes?: string;
    [key: string]: unknown;
  };
  notesAuthorName?: string;
  notesAuthorId?: string;
  notesUpdatedAt?: string;
  notesAuthor?: string;
  notesBy?: string;
  notesLastEditedAt?: string;
  notesTimestamp?: string;
  assignedScenes?: string[];
  propertyAnalysis?: LocationPropertyAnalysis;
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
  itemType?: 'equipment' | 'prop' | (string & {});
  category?: string;
  description?: string;
  quantity?: number;
  assignedScenes?: string[];
  availability?: Record<string, unknown> | string;
  images?: string[];
  location?: string;
  modelUrl?: string;
  notes?: string;
  notesAuthorId?: string;
  notesAuthorName?: string;
  notesUpdatedAt?: string;
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
  message?: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole?: UserRoleType | string;
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
  reservedByName?: string;
  reservedAt?: string;
  colorTag?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | string;
  imageUrl?: string;
  storyboardFrameId?: string;
  storyboardLibraryItemId?: string;
  storyboardLinkedSceneId?: string;
  storyboardSourceType?: 'scene-frame' | 'library-item';
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
  locationId?: string;
  crew: string[];
  props: string[];
  callTime?: string;
  wrapTime?: string;
  notes?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  weatherForecast?: {
    location: string;
    forecast: Array<{
      date: string;
      temperature: number;
      humidity: number;
      windSpeed: number;
      precipitation: number;
      symbol: string;
    }>;
    days: number;
    source: 'fallback' | 'yr_api';
  };
  lastModifiedBy?: string;
  createdBy?: string;
  changeLog?: Array<{
    timestamp: string;
    user: string;
    action: string;
    changes: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type ProducerPlanningPhase = 'preproduction' | 'production' | 'postproduction';

export type ProducerPlanningStatus =
  | 'planned'
  | 'in_progress'
  | 'at_risk'
  | 'review'
  | 'completed';

export type ProducerContentCalendarStatus =
  | 'planned'
  | 'in_review'
  | 'scheduled'
  | 'published';

export type ProducerBrandLogoVariantSelection =
  | 'auto'
  | ProducerBrandLogoVariantType;

export interface ProducerPhasePlanItem {
  phase: ProducerPlanningPhase;
  title?: string;
  objective?: string;
  startDate?: string;
  endDate?: string;
  owner?: string;
  clientCheckpoint?: string;
  status?: ProducerPlanningStatus;
  linkedShotListIds?: string[];
  notes?: string;
}

export interface ProducerContentCalendarItem {
  id: string;
  title: string;
  channel?: string;
  format?: string;
  logoVariantSelection?: ProducerBrandLogoVariantSelection;
  publishAt?: string;
  owner?: string;
  phase: ProducerPlanningPhase;
  status?: ProducerContentCalendarStatus;
  linkedShotListId?: string;
  notes?: string;
}

export interface ProducerBrandGuideColor {
  id: string;
  label: string;
  hex: string;
  usage?: string;
}

export type ProducerBrandLogoMarkType =
  | 'wordmark'
  | 'symbol'
  | 'combination';

export type ProducerBrandLogoVariantType =
  | 'primary'
  | 'light'
  | 'dark'
  | 'icon';

export interface ProducerBrandLogoDetection {
  sourceFileName?: string;
  sourceProjectFileId?: string;
  sourceProjectFileUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  aspectRatioLabel?: string;
  markType?: ProducerBrandLogoMarkType;
  hasTransparency?: boolean;
  dominantColors?: ProducerBrandGuideColor[];
  suggestedPlacement?: ProducerBrandLogoPlacement;
  suggestedTiming?: ProducerBrandLogoTiming;
  suggestedTreatment?: ProducerBrandLogoTreatment;
  suggestedOpacityPercent?: number;
  suggestedSafeZoneHorizontalPercent?: number;
  suggestedSafeZoneVerticalPercent?: number;
  suggestedMarginPixelsAt1080?: number;
  note?: string;
  detectedAt?: string;
}

export interface ProducerBrandLogoVariant {
  id: string;
  type: ProducerBrandLogoVariantType;
  label?: string;
  fileName?: string;
  logoUrl?: string;
  projectFileId?: string;
  projectFileUrl?: string;
  detection?: ProducerBrandLogoDetection;
  uploadedAt?: string;
}

export type ProducerBrandLogoPlacement =
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'center';

export type ProducerBrandLogoTiming =
  | 'intro'
  | 'outro'
  | 'throughout'
  | 'custom'
  | 'none';

export type ProducerBrandLogoTreatment =
  | 'clean'
  | 'badge'
  | 'watermark';

export interface ProducerBrandGuide {
  logoUrl?: string;
  activeLogoVariantType?: ProducerBrandLogoVariantType;
  logoPlacement?: ProducerBrandLogoPlacement;
  logoTiming?: ProducerBrandLogoTiming;
  logoStartSecond?: number;
  logoEndSecond?: number;
  logoTreatment?: ProducerBrandLogoTreatment;
  logoDetection?: ProducerBrandLogoDetection;
  logoVariants?: ProducerBrandLogoVariant[];
  fonts?: string[];
  toneOfVoice?: string;
  visualStyle?: string;
  dos?: string[];
  donts?: string[];
  colors?: ProducerBrandGuideColor[];
}

export type ProducerDeliveryPresetId =
  | 'social_pack'
  | 'web_pack'
  | 'campaign_pack'
  | 'training_pack';

export interface ProducerDeliveryWorkflow {
  presetId?: ProducerDeliveryPresetId;
  fileNamingConvention?: string;
  versioningRule?: string;
  folderStructure?: string;
  draftVsFinalRule?: string;
  backupRoutine?: string;
  deliveryCadence?: string;
}

export type ProducerCollaborationAgreementModel =
  | 'one_time_project'
  | 'retainer'
  | 'startup_growth'
  | 'startup_equity'
  | 'holding_company'
  | 'hybrid';

export type ProducerCollaborationStatus =
  | 'discovery'
  | 'proposal_sent'
  | 'under_review'
  | 'pilot_active'
  | 'active'
  | 'paused'
  | 'completed';

export type ProducerCollaborationCostCoverage =
  | 'client'
  | 'producer'
  | 'shared'
  | 'case_by_case';

export type ProducerCollaborationCompensationModel =
  | 'fixed_fee'
  | 'growth_based'
  | 'equity'
  | 'hybrid';

export interface ProducerCollaborationCostItem {
  id: string;
  label: string;
  /** Standard chart-of-accounts-kategori (samme som budget_categories).
   * Lagres som strengnavn for bakover-kompat — picker-en kan
   * fortsatt mappe til system + bruker-egne kategorier. */
  category?: string;
  coveredBy: ProducerCollaborationCostCoverage;
  notes?: string;
  amountLabel?: string;
  reimbursable?: boolean;
  receiptFileId?: string;
  receiptFileName?: string;
  receiptUrl?: string;
  receiptMerchant?: string;
  receiptDate?: string;
  receiptAmountValue?: number;
  ocrStatus?: 'pending' | 'completed' | 'failed' | 'not_supported';
  ocrConfidence?: 'low' | 'medium' | 'high';
}

export interface ProducerCollaborationTerms {
  status?: ProducerCollaborationStatus;
  agreementModel?: ProducerCollaborationAgreementModel;
  agreementLabel?: string;
  commercialVehicle?: string;
  agreementSummary?: string;
  deliverablesInScopeVisible?: boolean;
  deliverablesInScope?: string[];
  productionCadence?: string;
  productionResponsibilities?: string[];
  brandingResponsibilities?: string[];
  marketingResponsibilities?: string[];
  startupEconomicModel?: string;
  costItems?: ProducerCollaborationCostItem[];
  compensationModel?: ProducerCollaborationCompensationModel;
  compensationSummary?: string;
  evaluationPlan?: string;
  clientUsageRights?: string;
  producerPortfolioRights?: string;
  workloadCap?: string;
  liabilityExclusions?: string;
  // ── Produksjonsteam-spesifikke felter (film/TV/serie) ────────────
  // Kun synlig når Samarbeidsramme rendres i production_team-modus.
  // Innholdsprodusent-flyten ignorerer disse og påvirkes ikke.
  filmFeeStructure?: 'fixed_per_project' | 'day_rate' | 'per_episode' | 'royalty_share' | 'mixed';
  filmDayRate?: string;
  filmRoyaltySplit?: string;
  filmIpOwnership?: 'production_company' | 'client' | 'shared' | 'work_for_hire';
  filmDistributionRights?: string;
  filmFestivalRights?: string;
  filmSequelRights?: string;
  filmMusicClearance?: string;
  filmLikenessRights?: string;
  filmInsurancePolicy?: string;
  filmPerDiemPolicy?: string;
  filmSafetyRequirements?: string;
}

export interface ProducerClientIntake {
  projectGoal?: string;
  deliverables?: string;
  targetAudience?: string;
  keyMessage?: string;
  timingConstraints?: string;
  brandNotes?: string;
  materialOverview?: string;
  referenceLinks?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  additionalNotes?: string;
  updatedAt?: string;
  updatedByRole?: string;
}

export type ProducerClientMaterialType =
  | 'brief_note'
  | 'asset_link'
  | 'brand_asset'
  | 'reference'
  | 'document'
  | 'feedback';

export interface ProducerClientMaterial {
  id: string;
  project_id?: string;
  entry_type: ProducerClientMaterialType;
  title: string;
  description?: string | null;
  external_url?: string | null;
  phase?: ProducerPlanningPhase | null;
  linked_shot_list_id?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
  created_by_user_id?: string | null;
  created_by_role?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ProducerPlanningFrameworkStepKey =
  | 'strategy'
  | 'concept_development'
  | 'campaign_development'
  | 'content_production'
  | 'execution'
  | 'evaluation';

export interface ProducerPlanningFrameworkStep {
  key: ProducerPlanningFrameworkStepKey;
  focus?: string;
  output?: string;
  notes?: string;
}

export interface ProducerActivationPlan {
  direction?: string;
  idea?: string;
  activation?: string;
  targetAudience?: string;
  businessGoal?: string;
  coreMessage?: string;
  successSignals?: string[];
  framework?: ProducerPlanningFrameworkStep[];
}

export type ProducerClientLogicMode = 'content_logic' | 'activation_plan';

export interface ProducerContentLogic {
  mode?: ProducerClientLogicMode;
  objective?: string;
  audience?: string;
  hook?: string;
  coreMessage?: string;
  industry?: string;
  subIndustry?: string;
  businessModel?: string;
  contentCategory?: string;
  productionApproach?: string;
  proofPoints?: string[];
  callToAction?: string;
  distributionPlan?: string;
  successSignals?: string[];
}

export type ProducerAccountAccessPlatform =
  | 'google'
  | 'meta'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';

export type ProducerAccountAccessMethod =
  | 'oauth'
  | 'business_invite'
  | 'manual_handoff';

export type ProducerAccountAccessStatus =
  | 'not_started'
  | 'client_action'
  | 'invite_sent'
  | 'connected'
  | 'revoked';

export type ProducerAccountAccessTier =
  | 'delegated_access'
  | 'sensitive_secret';

export type ProducerAccountAccessRiskLevel =
  | 'low'
  | 'medium'
  | 'high';

export type ProducerAccountAccessTwoFactorStatus =
  | 'enabled'
  | 'missing'
  | 'unknown';

export type ProducerAccountAccessSecretStatus =
  | 'not_shared'
  | 'requested'
  | 'stored_externally'
  | 'revoked';

export type ProducerAccountAccessRevealPolicy =
  | 'approval_required'
  | 'one_time'
  | 'manual_only';

export type ProducerAccountAccessRoleTarget =
  | 'client_owner'
  | 'producer'
  | 'editor'
  | 'social_media_manager'
  | 'admin';

export type ProducerAccountAccessVaultTab =
  | 'accounts'
  | 'requests'
  | 'secrets'
  | 'permissions'
  | 'audit'
  | 'emergency';

export type RoleRoomAccessVaultRevealRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revealed'
  | 'expired';

export type RoleRoomAccessVaultAuditAction =
  | 'secret_saved'
  | 'secret_revoked'
  | 'reveal_requested'
  | 'reveal_approved'
  | 'reveal_rejected'
  | 'secret_revealed';

export interface RoleRoomAccessVaultSecretSummary {
  id: string;
  projectId: string;
  platform: ProducerAccountAccessPlatform;
  label?: string | null;
  secretType?: string | null;
  maskedReference?: string | null;
  tier?: ProducerAccountAccessTier | string | null;
  riskLevel?: ProducerAccountAccessRiskLevel | string | null;
  revealPolicy?: ProducerAccountAccessRevealPolicy | string | null;
  status?: ProducerAccountAccessSecretStatus | string | null;
  ownerName?: string | null;
  sharedWithRoles: ProducerAccountAccessRoleTarget[];
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastRevealedAt?: string | null;
  revokedAt?: string | null;
  hasStoredSecret: boolean;
  hasUsername: boolean;
  hasBackupCode: boolean;
}

export interface RoleRoomAccessVaultRevealRequest {
  id: string;
  secretId: string;
  projectId: string;
  platform: ProducerAccountAccessPlatform;
  status: RoleRoomAccessVaultRevealRequestStatus;
  requestReason?: string | null;
  approvalNotes?: string | null;
  requestedByUserId?: string | null;
  requestedByRole?: string | null;
  approvedByUserId?: string | null;
  approvedByRole?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  revealedAt?: string | null;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface RoleRoomAccessVaultAuditEvent {
  id: string;
  projectId: string;
  secretId?: string | null;
  revealRequestId?: string | null;
  platform?: ProducerAccountAccessPlatform | null;
  action?: RoleRoomAccessVaultAuditAction | string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string | null;
}

export interface RoleRoomAccessVaultState {
  secrets: RoleRoomAccessVaultSecretSummary[];
  requests: RoleRoomAccessVaultRevealRequest[];
  audit: RoleRoomAccessVaultAuditEvent[];
}

export interface RoleRoomAccessVaultRevealResult {
  secretId: string;
  platform: ProducerAccountAccessPlatform;
  label?: string | null;
  secretType?: string | null;
  username?: string | null;
  secretValue?: string | null;
  backupCode?: string | null;
  maskedReference?: string | null;
  revealedAt?: string | null;
}

export interface ProducerAccountAccessEntry {
  platform: ProducerAccountAccessPlatform;
  method: ProducerAccountAccessMethod;
  status: ProducerAccountAccessStatus;
  tier?: ProducerAccountAccessTier;
  riskLevel?: ProducerAccountAccessRiskLevel;
  accountLabel?: string;
  inviteTarget?: string;
  accessScope?: string;
  ownerName?: string;
  sharedWithRoles?: ProducerAccountAccessRoleTarget[];
  twoFactorStatus?: ProducerAccountAccessTwoFactorStatus;
  lastUsedAt?: string;
  expiresAt?: string;
  secretStatus?: ProducerAccountAccessSecretStatus;
  secretLabel?: string;
  maskedReference?: string;
  revealPolicy?: ProducerAccountAccessRevealPolicy;
  notes?: string;
  twoFactorRequired?: boolean;
  lastUpdatedAt?: string;
}

export interface ProducerAccountAccessWorkspace {
  entries: ProducerAccountAccessEntry[];
  activeVaultTab?: ProducerAccountAccessVaultTab;
  securityNotes?: string;
  revokePlan?: string;
  emergencyContactName?: string;
  emergencyContactEmail?: string;
  emergencyContactPhone?: string;
  emergencyAccessNotes?: string;
  updatedAt?: string;
}

export type ProducerWorkspaceSurfaceKey =
  | 'brief'
  | 'materials'
  | 'storyboard'
  | 'manuscript'
  | 'shotlist'
  | 'brand'
  | 'accounts'
  | 'delivery'
  | 'meetings';

export type ProducerWorkspaceLayout = 'focus' | 'split' | 'grid';

export type ProducerWorkspaceTabPlacement = 'top' | 'left';

export type ProducerWorkspacePagePlacement = 'left' | 'right';

export type ProducerMeetingWorkspaceStatus = 'planned' | 'lobby' | 'live' | 'follow_up';
export type ProducerPlannerMeetingType = 'casting' | 'production' | 'creative' | 'delivery';
export type ProducerPlannerMeetingMode = 'digital' | 'onsite';

export interface ProducerMeetingParticipant {
  id: string;
  label: string;
  role?: string;
  kind?: 'client' | 'crew' | 'cast' | 'internal' | 'location';
  required?: boolean;
  availability?: 'available' | 'tentative' | 'unavailable' | 'unknown';
  note?: string;
}

export interface ProducerMeetingAssetRef {
  id: string;
  label: string;
  type?: 'brief' | 'storyboard' | 'manuscript' | 'shotlist' | 'reference' | 'contract' | 'timeline';
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export interface ProducerMeetingAgendaItem {
  id: string;
  title: string;
  detail?: string;
  phase?: ProducerPlanningPhase;
  sourceType?: 'manual' | 'client_review' | 'timeline' | 'framework';
  linkedEntityType?: string;
  linkedEntityId?: string;
  completed?: boolean;
}

export interface ProducerMeetingDecisionItem {
  id: string;
  title: string;
  phase?: ProducerPlanningPhase;
  owner?: string;
  dueAt?: string;
  status?: 'open' | 'done';
  clientVisible?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  notes?: string;
}

export interface ProducerMeetingFollowUpItem {
  id: string;
  title: string;
  phase?: ProducerPlanningPhase;
  owner?: string;
  dueAt?: string;
  status?: 'planned' | 'in_progress' | 'done';
  linkedEntityType?: string;
  linkedEntityId?: string;
  notes?: string;
}

export interface ProducerMeetingWorkspace {
  status: ProducerMeetingWorkspaceStatus;
  sessionLabel?: string;
  meetingType?: ProducerPlannerMeetingType;
  meetingMode?: ProducerPlannerMeetingMode;
  phase?: ProducerPlanningPhase;
  scheduledAt?: string;
  locationLabel?: string;
  contextSummary?: string;
  expectations?: string[];
  participants?: ProducerMeetingParticipant[];
  assets?: ProducerMeetingAssetRef[];
  activeMeetUrl?: string;
  activeMeetArtifactId?: string;
  activeMeetCalendarEventId?: string;
  liveNotes?: string;
  agenda: ProducerMeetingAgendaItem[];
  decisions: ProducerMeetingDecisionItem[];
  followUps: ProducerMeetingFollowUpItem[];
  updatedAt?: string;
}

export interface ProducerWorkspacePage {
  id: string;
  title: string;
  surface: ProducerWorkspaceSurfaceKey;
  color?: string;
  pinned?: boolean;
  clientVisible?: boolean;
  order?: number;
  parentPageId?: string | null;
}

export interface ProducerWorkspaceSection {
  id: string;
  title: string;
  color?: string;
  pinned?: boolean;
  order?: number;
  layout?: ProducerWorkspaceLayout;
  pages: ProducerWorkspacePage[];
}

export interface ProducerWorkspaceNavigation {
  sectionTabPlacement?: ProducerWorkspaceTabPlacement;
  pageTabPlacement?: ProducerWorkspacePagePlacement;
  navigationPinned?: boolean;
  activeSectionId?: string;
  activePageId?: string;
  sections: ProducerWorkspaceSection[];
}

export interface ProducerProjectPlanning {
  activationPlan: ProducerActivationPlan;
  contentLogic?: ProducerContentLogic;
  phasePlan: ProducerPhasePlanItem[];
  contentCalendar: ProducerContentCalendarItem[];
  brandGuide: ProducerBrandGuide;
  accountAccess: ProducerAccountAccessWorkspace;
  deliveryWorkflow: ProducerDeliveryWorkflow;
  collaborationTerms?: ProducerCollaborationTerms;
  meetingWorkspace: ProducerMeetingWorkspace;
  workspaceNavigation?: ProducerWorkspaceNavigation;
  updatedAt?: string;
}

export type ProducerWorkflowProjectStatus =
  | 'planning'
  | 'awaiting_client'
  | 'changes_requested'
  | 'approved';

export interface ProducerWorkflowProjectMeta {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  changesRequestedReviews: number;
  budgetReviewCount: number;
  agreementReviewCount: number;
  deliverableReviewCount: number;
  lastReviewRequestedAt?: string | null;
  lastDecisionAt?: string | null;
  lastApprovedReviewId?: string | null;
  lastPendingReviewId?: string | null;
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
  projectKind?: 'workspace' | 'demo' | 'template';
  templateAudience?: 'content_producer' | 'production_team';
  templateStatus?: 'draft' | 'published' | 'archived';
  templateVersion?: number;
  templatePublishedAt?: string;
  templateCreatedBy?: string;
  templateSourceProjectId?: string;
  templateSourceProjectName?: string;
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
  lockedTemplate?: boolean;
  status?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerLabel?: string;
  createdBy?: string;
  createdByEmail?: string;
  createdByLabel?: string;
  archivedAt?: string;
  archivedBy?: string;
  archivedByLabel?: string;
  previousStatus?: string;
  genre?: string;
  projectType?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  clientName?: string;
  clientEmail?: string;
  clientCompanyName?: string;
  clientOrganizationNumber?: string;
  clientCompanyAddress?: string;
  producerPlanning?: ProducerProjectPlanning;
  producerWorkflowStatus?: ProducerWorkflowProjectStatus;
  producerWorkflowMeta?: ProducerWorkflowProjectMeta;
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
  sceneHeading?: string;
  sceneName?: string;
  locationName?: string;
  intExt?: 'INT' | 'EXT' | 'INT/EXT' | 'I/E';
  timeOfDay?: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | 'EVENING' | 'LATER' | 'CONTINUOUS' | 'MORNING';
  pageLength?: number;
  estimatedDuration?: number;
  colorTag?: string;
  description?: string;
  status?: string;
  characters?: string[];
  propsNeeded?: string[];
  vehicles?: string[];
  specialEffects?: string | boolean;
  stuntsNotes?: string;
  storyboardFrames?: StoryboardFrame[];
  metadata?: {
    camera?: string;
    lens?: string;
    rig?: string;
    shotType?: string;
    keyLight?: string;
    sideLight?: string;
    gel?: string;
    mic?: string;
    atmos?: string;
    lighting?: string;
    audio?: string;
    equipment?: string[];
    references?: string[];
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DialogueLine {
  id: string;
  manuscriptId: string;
  sceneId?: string;
  characterName: string;
  text?: string;
  dialogueText: string;
  dialogueType?: 'dialogue' | 'voiceover' | 'offscreen' | 'parenthetical' | 'action' | string;
  parenthetical?: string;
  emotionTag?: string;
  lineNumber?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Act {
  id: string;
  manuscriptId: string;
  projectId?: string;
  title: string;
  index?: number;
  actNumber?: number;
  summary?: string;
  description?: string;
  pageStart?: number;
  pageEnd?: number;
  estimatedRuntime?: number;
  colorCode?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ScriptRevision {
  id: string;
  manuscriptId: string;
  version: string;
  changeSummary?: string;
  changesSummary?: string;
  revisionNotes?: string;
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
  subtitle?: string;
  author?: string;
  status?: string;
  version?: string;
  format?: 'markdown' | 'fountain' | 'final-draft';
  pageCount?: number;
  wordCount?: number;
  coverImage?: string;
  coverFocalPoint?: { x: number; y: number };
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
