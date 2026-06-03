/**
 * Role Room API Routes — Creatorhub Backend Integration
 *
 * Provides casting/role management endpoints with:
 *  • x-api-key enforcement for external clients
 *  • CORS allowlist via CORS_ALLOW_ORIGINS env var
 *  • Full CRUD for casting projects, roles, candidates, crew, schedules
 *  • Project sync between Creatorhub ↔ Role Room
 *  • API key management
 *  • Marketplace installation tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  persistOauthState,
  loadOauthState,
  deleteOauthState,
  persistOauthTransfer,
  loadOauthTransfer,
  deleteOauthTransfer,
} from './role-room-oauth-store.js';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import multer from 'multer';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { sendTransactionalEmail } from './transactional-email-service';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql, or, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { google } from 'googleapis';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import * as roleRoomSchema from '../migrations/role-room-schema.js';
import {
  getGoogleWorkspaceOauthConfig,
  resolveGoogleWorkspaceRequestOrigin,
} from './google-workspace-oauth.js';
import {
  loadPersistedAuthSession,
  persistAuthSession,
} from './auth-session-store.js';
import {
  grantConsent as grantAiConsent,
  getActiveConsent as getAiConsent,
  revokeConsent as revokeAiConsent,
  updateEntityLists as updateAiConsentEntities,
  RoleRoomAiConsentError,
  type RoleRoomAiConsentScope,
  type RoleRoomAiProcessor,
} from './role-room-ai-consent.js';
import { listAiCallsForUser, logAiCall } from './role-room-ai-audit.js';
import {
  invokeRoleRoomAgent,
  RoleRoomAgentDisabledError,
  RoleRoomAgentEntitlementError,
  type RoleRoomAgentAction,
} from './role-room-agent-runner.js';
import {
  adminGrantEntitlement,
  checkAgentEntitlement,
  getEntitlementConfig,
  listEntitlements,
  revokeEntitlement,
  startAgentTrial,
} from './role-room-agent-entitlements.js';
import {
  archiveThread,
  getThread,
  listThreads,
  updateThreadTitle,
} from './role-room-agent-threads.js';
import {
  checkAgentRateLimit,
  RateLimitExceededError,
} from './role-room-agent-ratelimit.js';
import { handleAgentStream } from './role-room-agent-stream.js';
import {
  generateMerchMockup,
  isPrintfulConfigured,
  PrintfulMockupError,
  type MerchMockupProductId,
} from './role-room-merch-mockup.js';
import {
  generateMerchCooperationDraft,
  MerchCooperationError,
  type MerchDealType,
  type MerchPartnerType,
} from './role-room-merch-cooperation.js';
import {
  discoverMerchPartners,
  enrichMerchPartner,
  type MerchPartnerCandidate,
  type MerchPartnerType as DiscoveryPartnerType,
} from './role-room-merch-partner-discovery.js';
import { fetchBrregCompany } from './role-room-agent.js';
import { findCustomerLegalEntityCandidates } from './role-room-legal-entity.js';
import {
  sendMerchPartnerEmail,
  listMerchPartnerEmails,
  logMerchPartnerReply,
  listMerchPartnerReplies,
  type MerchReplySentiment,
} from './role-room-merch-partner-email.js';
import { pollPartnerReplies } from './role-room-merch-partner-reply-poller.js';
import {
  getAiGovernanceOverview,
  getAuditTrail,
  getConsentList,
} from './role-room-ai-governance.js';
import {
  recommendAdsBudget,
  INDUSTRY_FACTORS,
  buildChannelResults,
  type IndustryCategory,
  type AdsGoal,
  type AdsPlatform,
  type GrowthPhase,
} from './role-room-ads-shared.js';
import {
  analyzeWebsite,
  hashUrl,
  normalizeUrl,
} from './role-room-website-analyzer.js';
import { generateWeekPlan } from './role-room-content-strategist.js';
import {
  generateCarouselDraft,
} from './role-room-carousel-generator.js';
import { makeDefaultResolverContext } from './role-room-carousel-image-resolver.js';
import {
  generateAiImage,
  makeReplicateClient,
} from './role-room-carousel-ai-image.js';
import { findGalleryMatches } from './role-room-carousel-gallery-match.js';
import {
  publishCarouselPost,
  ValidationFailedError,
  type PublishablePost,
  type PublishableSlide,
} from './role-room-carousel-publisher.js';
import {
  listAdAccounts as listMetaAdAccounts,
  createCampaign as createMetaCampaign,
  pauseCampaign as pauseMetaCampaign,
  resumeCampaign as resumeMetaCampaign,
  endCampaign as endMetaCampaign,
  createAdSet as createMetaAdSet,
  createAd as createMetaAd,
  hasMetaAdAccountAccess,
  listManagedPages as listMetaManagedPages,
  metaTaskLabel,
  MetaAdsApiError,
  type MetaCampaignObjective,
  type MetaTargeting,
} from './role-room-meta-ads.js';
import {
  listGrantedLinkedInAssets,
  linkedInRoleLabel,
  createLinkedInCampaign,
  setLinkedInCampaignStatus,
  hasLinkedInAdAccountAccess,
  listManagedAdAccounts as listLinkedInManagedAdAccounts,
  listLinkedInCampaignGroups,
  LinkedInAdsApiError,
  type LinkedInAdsAuth,
} from './role-room-linkedin-ads.js';
import {
  insertCampaign,
  updateCampaignStatus,
  getCampaignById,
  listCampaignsForUser,
  sumManagementFeeForPeriod,
  sumSpendForProjectPeriod,
  getChannelResultRows,
} from './role-room-ads-db.js';
import {
  getBudget,
  setBudget,
  requestOverage,
  approveOverage,
  assertWithinBudget,
  computeBudgetStatus,
  computeBudgetPacing,
  setAutoPauseOnCap,
  BudgetExceededError,
} from './role-room-ads-budget.js';
import { syncMetaCampaignSpend, syncCampaignSpend } from './role-room-ads-sync.js';
import {
  generateAdCreatives,
  checkAdGenerationReadiness,
  type AdGenerationContext,
} from './role-room-ad-creatives.js';
import { fetchActiveMarketingPlan } from './role-room-marketing-plan.js';
import {
  buildAdsConnectorRegistry,
  buildPlatformTokenResolver,
  runAdsRecommendationsForProject,
} from './role-room-ads-cron.js';
import { fetchAdRecommendations } from './role-room-ads-db.js';
import {
  buildAdsAuthUrl,
  exchangeAdsCodeForToken,
  adsOauthClientCreds,
  upsertAdsOauthConnection,
  listAdsOauthConnections,
  resolveAdsAccessToken,
  ADS_OAUTH_SCOPES,
} from './role-room-ads-oauth.js';
import {
  createGoogleCampaign,
  setGoogleCampaignStatus,
  hasGoogleCustomerAccess,
  listAccessibleCustomers as listGoogleAccessibleCustomers,
  parseCampaignResourceName as parseGoogleCampaignResourceName,
  GoogleAdsApiError,
  type GoogleAdsAuth,
} from './role-room-google-ads.js';
import {
  listInstagramConnections,
  ensureFreshConnection,
} from './role-room-instagram-oauth.js';

// ── Types ────────────────────────────────────────────────────

interface RoleRoomApiKeyRow {
  id: string;
  key_hash: string;
  name: string;
  user_id: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface CastingProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_by_label?: string | null;
  genre: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  currency: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  creatorhub_project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleRoomStoryLogicRow {
  project_id: string;
  story_logic: Record<string, unknown> | null;
  version: number;
  updated_by_user_id: string | null;
  updated_by_role: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleRoomCoverageReviewRow {
  project_id: string;
  take_reviews: Record<string, unknown> | null;
  shot_line_coverage: Record<string, unknown> | null;
  version: number;
  updated_by_user_id: string | null;
  updated_by_role: string | null;
  created_at: string;
  updated_at: string;
}

type SyncDirection = 'creatorhub_to_roleroom' | 'roleroom_to_creatorhub';

interface ProjectSyncPayload {
  creatorhubProjectId: string;
  castingProjectId?: string;
  projectName: string;
  projectType?: string;
  clientName?: string;
  description?: string;
  eventDate?: string;
  budget?: number;
  userId: string;
}

type ProducerPhase = 'preproduction' | 'production' | 'postproduction';
type ProducerReviewDecision = 'approved' | 'rejected' | 'changes_requested';
type RoleRoomGoogleConnectionState = 'disconnected' | 'connected' | 'expired' | 'error';
type RoleRoomGoogleOauthMode = 'login' | 'link';
type RoleRoomLinkedInConnectionState = 'disconnected' | 'connected' | 'expired' | 'error';
type ProducerAccountAccessPlatform =
  | 'google'
  | 'meta'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';
type RoleRoomAccessVaultSecretStatus =
  | 'not_shared'
  | 'requested'
  | 'stored_externally'
  | 'revoked';
type RoleRoomAccessVaultRevealPolicy =
  | 'approval_required'
  | 'one_time'
  | 'manual_only'
  // Krever 2FA-step-up (TOTP fra Authenticator eller e-post-kode) ved
  // hver reveal-request, uavhengig av om bruker har 2FA aktivert generelt.
  // Brukes for høy-risiko-secrets (admin-passord, signing-keys).
  | 'mfa_required';

interface RoleRoomGoogleConnectionRow {
  id: string;
  user_id: string;
  role_room_email: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes: unknown;
  connection_state: RoleRoomGoogleConnectionState | null;
  last_error: string | null;
  profile: Record<string, unknown> | null;
  oauth_app: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface RoleRoomGoogleProjectBindingRow {
  id: string;
  project_id: string;
  connected_user_id: string | null;
  drive_root_folder_id: string | null;
  calendar_id: string | null;
  contacts_context: Record<string, unknown> | null;
  meet_creation_enabled: boolean | null;
  audit_signature_storage_enabled: boolean | null;
  folder_layout: Record<string, unknown> | null;
  sync_status: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_drive_sync_at: string | null;
  last_calendar_sync_at: string | null;
}

interface RoleRoomGoogleArtifactRow {
  id: string;
  project_id: string;
  local_entity_type: string;
  local_entity_id: string;
  artifact_type: string;
  source_label: string | null;
  drive_file_id: string | null;
  calendar_event_id: string | null;
  meet_url: string | null;
  web_view_url: string | null;
  web_content_link: string | null;
  mime_type: string | null;
  folder_key: string | null;
  sync_status: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type RoleRoomGoogleAgreementSignatureStatus =
  | 'not_started'
  | 'prepared'
  | 'sent'
  | 'opened_in_google'
  | 'signed'
  | 'rejected'
  | 'changes_requested'
  | 'error';

interface RoleRoomGoogleAgreementSignatureRow {
  id: string;
  project_id: string;
  agreement_id: string;
  provider: string;
  status: RoleRoomGoogleAgreementSignatureStatus | null;
  document_title: string | null;
  drive_source_file_id: string | null;
  signed_drive_file_id: string | null;
  audit_artifact_id: string | null;
  request_url: string | null;
  web_view_url: string | null;
  requested_by: string | null;
  requested_by_email: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  prepared_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  last_opened_at: string | null;
  last_synced_at: string | null;
  signature_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface RoleRoomGoogleOauthState {
  mode: RoleRoomGoogleOauthMode;
  returnPath: string;
  browserOrigin?: string | null;
  redirectUri?: string | null;
  loginAs?: string | null;
  requestedRole?: string | null;
  projectId?: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
  createdAt: number;
}

interface RoleRoomGoogleTransferPayload {
  mode: RoleRoomGoogleOauthMode;
  createdAt: number;
  projectId?: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
  autoConfiguredProjectBinding?: boolean | null;
  sessionToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    display_name: string;
    loginAs?: string;
    requestedRole?: string | null;
  };
  googleEmail: string;
  googleSubject: string;
  profile: Record<string, unknown>;
  tokenBundle?: {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
    scopes: string[];
  };
}

interface RoleRoomClientInviteRow {
  id: string;
  project_id: string;
  email: string | null;
  token_hash: string;
  status: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  last_sent_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

type RoleRoomClientInviteAccessDuration = 'forever' | 'project_end';

interface RoleRoomClientInviteTransferPayload {
  createdAt: number;
  projectId: string;
  sessionToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    display_name: string;
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

interface RoleRoomLinkedInConnectionRow {
  id: string;
  user_id: string;
  role_room_email: string | null;
  linkedin_member_id: string | null;
  linkedin_email: string | null;
  linkedin_name: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes: unknown;
  connection_state: RoleRoomLinkedInConnectionState | null;
  last_error: string | null;
  profile: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface RoleRoomLinkedInOauthState {
  returnPath: string;
  browserOrigin?: string | null;
  projectId?: string | null;
  createdByUserId?: string | null;
  createdAt: number;
}

interface RoleRoomLinkedInTransferPayload {
  mode: 'link';
  createdAt: number;
  linkedInMemberId: string;
  linkedInEmail?: string | null;
  linkedInName?: string | null;
  profile: Record<string, unknown>;
  tokenBundle: {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
    scopes: string[];
  };
}

interface ProjectRoleRecord {
  role: string;
  permissions: Record<string, boolean>;
}

interface ApiKeyUserContext {
  userId: string;
  email?: string;
  role?: string;
  scopes: string[];
}

interface RoleRoomPublicTestimonialRow {
  id: string;
  role_id: string;
  quote_text: string;
  author_name: string;
  author_title: string | null;
  author_user_id: string | null;
  author_email: string | null;
  status: string;
  is_featured: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleRoomTalentPortalCandidateRow {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  agency: string | null;
  photos: unknown;
  videos: unknown;
  notes: string | null;
  status: string | null;
  assigned_roles: unknown;
  rating: number | null;
  metadata: Record<string, unknown> | null;
  emergency_contact: Record<string, unknown> | null;
  consent_status: string | null;
  reminder_prefs: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
  project_description?: string | null;
  project_status?: string | null;
  project_type?: string | null;
  project_start_date?: string | null;
  project_end_date?: string | null;
}

interface RoleRoomTalentPortalRoleRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  age_range: string | null;
  gender: string | null;
  role_type: string | null;
  requirements: Record<string, unknown> | null;
  status: string | null;
  assigned_candidate_id: string | null;
  candidate_ids: unknown;
}

interface RoleRoomTalentPortalScheduleRow {
  id: string;
  project_id: string;
  candidate_id: string | null;
  role_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  type: string | null;
  status: string | null;
  notes: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  role_name?: string | null;
}

interface RoleRoomTalentInviteRow {
  id: string;
  project_id: string;
  candidate_id: string;
  email: string | null;
  token_hash: string;
  status: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  last_sent_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface RoleRoomTalentActivityRow {
  id: string;
  project_id: string;
  candidate_id: string;
  entry_type: string | null;
  title: string;
  body: string | null;
  visibility: string | null;
  metadata: Record<string, unknown> | null;
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: string;
}

interface RoleRoomTalentUploadRow {
  id: string;
  project_id: string;
  candidate_id: string;
  media_kind: string | null;
  original_name: string;
  stored_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  access_token_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function buildSessionScopes(role?: string): string[] {
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';

  if (normalizedRole === 'admin' || normalizedRole === 'super_admin') {
    return ['read', 'write', 'admin'];
  }

  if (
    normalizedRole === 'client'
    || normalizedRole === 'client_reviewer'
    || normalizedRole === 'agency'
    || normalizedRole === 'reader'
    || normalizedRole === 'talent'
    || normalizedRole === 'actor'
  ) {
    return ['read'];
  }

  if (normalizedRole) {
    return ['read', 'write'];
  }

  return ['read'];
}

// ── Utility Helpers ──────────────────────────────────────────

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  return `rr_${crypto.randomBytes(32).toString('hex')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return crypto.randomUUID();
}

function sanitizeRoleRoomTalentFileSegment(value: string, fallback = 'file'): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function buildRoleRoomTalentInviteToken(): string {
  return `rrtal_${crypto.randomBytes(24).toString('hex')}`;
}

function hashRoleRoomTalentInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildRoleRoomClientInviteToken(): string {
  return `rrcli_${crypto.randomBytes(24).toString('hex')}`;
}

function hashRoleRoomClientInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECT_FILE_STORAGE_ROOT = path.join(REPO_ROOT, 'uploads', 'project-files');
const ROLE_ROOM_TALENT_UPLOAD_ROOT = path.join(REPO_ROOT, 'uploads', 'role-room-talent');
const ROLE_ROOM_RECEIPT_UPLOAD_ROOT = path.join(REPO_ROOT, 'uploads', 'role-room-receipts');
const ROLE_ROOM_RECEIPT_OCR_CACHE_ROOT = path.join(REPO_ROOT, 'uploads', 'role-room-ocr-cache');
const ROLE_ROOM_TALENT_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;
const ROLE_ROOM_RECEIPT_UPLOAD_MAX_BYTES = 35 * 1024 * 1024;
const ROLE_ROOM_RECEIPT_OCR_ENABLED = process.env.ROLE_ROOM_RECEIPT_OCR_ENABLED !== 'false';
const ROLE_ROOM_RECEIPT_OCR_LANGUAGES = process.env.ROLE_ROOM_RECEIPT_OCR_LANGUAGES || 'nor+eng';
const ROLE_ROOM_RECEIPT_OCR_TIMEOUT_MS = Math.max(15_000, Number.parseInt(process.env.ROLE_ROOM_RECEIPT_OCR_TIMEOUT_MS ?? '', 10) || 90_000);
const ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES = Math.max(1, Number.parseInt(process.env.ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES ?? '', 10) || 4);
const ROLE_ROOM_RECEIPT_OCR_IMAGE_WIDTH = Math.max(900, Number.parseInt(process.env.ROLE_ROOM_RECEIPT_OCR_IMAGE_WIDTH ?? '', 10) || 1800);
const ROLE_ROOM_RECEIPT_OCR_MIN_TEXT_CHARS = 24;
const DEFAULT_ROLE_ROOM_TALENT_PUBLIC_ORIGIN = 'https://theroleroom.com';
const roleRoomTalentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ROLE_ROOM_TALENT_UPLOAD_MAX_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const mimetype = String(file.mimetype || '').toLowerCase();
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedMimetypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-m4v',
      'video/webm',
      'video/mpeg',
      'video/3gpp',
      'video/x-msvideo',
      'video/x-ms-wmv',
    ];
    const allowedExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mpeg', '.mpg', '.3gp', '.avi', '.wmv'];

    if (allowedMimetypes.includes(mimetype) || allowedExtensions.includes(extension)) {
      cb(null, true);
      return;
    }

    cb(new Error('Ugyldig self tape-format. Bruk MP4, MOV, WebM eller lignende videofil.'));
  },
});
const roleRoomReceiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ROLE_ROOM_RECEIPT_UPLOAD_MAX_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const mimetype = String(file.mimetype || '').toLowerCase();
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedMimetypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/tiff',
    ];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff'];

    if (allowedMimetypes.includes(mimetype) || allowedExtensions.includes(extension)) {
      cb(null, true);
      return;
    }

    cb(new Error('Ugyldig kvitteringsformat. Bruk PDF, JPG, PNG, WebP, HEIC eller TIFF.'));
  },
});
const ROLE_ROOM_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  // Full Drive access is required for Showcase and other workspace flows
  // that list, create, move, and share arbitrary Drive files/folders.
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/documents',
  // Full Calendar access is required when Role Room creates dedicated
  // secondary project calendars in addition to event sync / Meet sessions.
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  // Compose covers both draft handling and message sending for Gmail flows.
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  // Publishing requires both direct uploads and full video management.
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  // ── KPI-tracking scopes (Datakilder-fanen) ─────────────────────────
  // GA4 Data API — read-only sessions/users/conversions per property.
  'https://www.googleapis.com/auth/analytics.readonly',
  // Google Business Profile Performance API — local-business insights
  // (calls, directions, search-queries, photo-views per location).
  'https://www.googleapis.com/auth/business.manage',
  // Search Console — clicks/impressions/CTR/position per query.
  'https://www.googleapis.com/auth/webmasters.readonly',
  // YouTube Analytics — channel + video performance metrics.
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
] as const;
const ROLE_ROOM_LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
] as const;
const ROLE_ROOM_GOOGLE_DRIVE_FOLDERS = [
  { key: 'brief', label: '01 Brief' },
  { key: 'materials', label: '02 Materiale' },
  { key: 'brand', label: '03 Merkevare' },
  { key: 'delivery', label: '04 Levering' },
  { key: 'approvals', label: '05 Godkjenning' },
  { key: 'meetings', label: '06 Møter' },
] as const;
const ROLE_ROOM_GOOGLE_STATE_TTL_MS = 15 * 60 * 1000;
const ROLE_ROOM_CLIENT_PORTAL_WORKSPACES = [
  'brief',
  'materials',
  'storyboard',
  'manuscript',
  'shotlist',
  'brand',
  'accounts',
  'delivery',
  'meetings',
] as const;
const ROLE_ROOM_CLIENT_PORTAL_TABS = ['media', 'reviews', 'export'] as const;
const ROLE_ROOM_CLIENT_INVITE_DEFAULT_EXPIRES_IN_DAYS = 14;

const roleRoomGoogleOauthStateStore = new Map<string, RoleRoomGoogleOauthState>();
const roleRoomGoogleTransferStore = new Map<string, RoleRoomGoogleTransferPayload>();
const roleRoomLinkedInOauthStateStore = new Map<string, RoleRoomLinkedInOauthState>();
const roleRoomLinkedInTransferStore = new Map<string, RoleRoomLinkedInTransferPayload>();
const roleRoomClientInviteTransferStore = new Map<string, RoleRoomClientInviteTransferPayload>();

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeEmailValue(value: unknown): string | null {
  const email = readStringValue(value);
  return email ? email.toLowerCase() : null;
}

function readBooleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

interface CandidateReminderPrefs {
  sms24h: boolean;
  sms1h: boolean;
  email24h: boolean;
  email1h: boolean;
}

const DEFAULT_CANDIDATE_REMINDER_PREFS: CandidateReminderPrefs = {
  sms24h: true,
  sms1h: true,
  email24h: true,
  email1h: true,
};

function normalizeReminderPrefs(value: unknown): CandidateReminderPrefs {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CANDIDATE_REMINDER_PREFS };
  }
  const r = value as Record<string, unknown>;
  return {
    sms24h: typeof r.sms24h === 'boolean' ? r.sms24h : DEFAULT_CANDIDATE_REMINDER_PREFS.sms24h,
    sms1h: typeof r.sms1h === 'boolean' ? r.sms1h : DEFAULT_CANDIDATE_REMINDER_PREFS.sms1h,
    email24h: typeof r.email24h === 'boolean' ? r.email24h : DEFAULT_CANDIDATE_REMINDER_PREFS.email24h,
    email1h: typeof r.email1h === 'boolean' ? r.email1h : DEFAULT_CANDIDATE_REMINDER_PREFS.email1h,
  };
}

function normalizeRoleRoomClientInviteAccessDuration(
  value: unknown,
): RoleRoomClientInviteAccessDuration {
  return readStringValue(value)?.trim().toLowerCase() === 'project_end'
    ? 'project_end'
    : 'forever';
}

function escapeRoleRoomClientInviteEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceRoleRoomClientInviteVariables(
  template: string,
  variables: Record<string, string | null | undefined>,
  mode: 'text' | 'html' = 'text',
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const rawValue = variables[String(key).trim()] ?? '';
    const resolved = String(rawValue);
    return mode === 'html'
      ? escapeRoleRoomClientInviteEmailHtml(resolved)
      : resolved;
  });
}

function renderRoleRoomClientInviteBodyHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '';
  }

  return paragraphs
    .map((paragraph) => (
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#e8ecf4;white-space:pre-wrap">${escapeRoleRoomClientInviteEmailHtml(
        paragraph,
      )}</p>`
    ))
    .join('');
}

function formatRoleRoomClientInviteDateLabel(value: string | null | undefined): string | null {
  const rawValue = readStringValue(value);
  if (!rawValue) {
    return null;
  }

  const parsed = Date.parse(rawValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'long',
  }).format(new Date(parsed));
}

function normalizeRoleRoomProjectAccessExpiry(value: string | null | undefined): string | null {
  const rawValue = readStringValue(value);
  if (!rawValue) {
    return null;
  }

  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${year}-${month}-${day}T23:59:59.999Z`;
  }

  const parsed = Date.parse(rawValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readRecordValue(value: unknown): Record<string, unknown> | null {
  return isRecordValue(value) ? value : null;
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (isRecordValue(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return isRecordValue(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function readJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function readExternalUrlValue(value: unknown): string | null {
  const raw = readStringValue(value);
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim());
      }
    } catch {
      return [value.trim()];
    }
  }
  return [];
}

function normalizeRoleRoomClientPortalWorkspace(value: unknown): typeof ROLE_ROOM_CLIENT_PORTAL_WORKSPACES[number] {
  const normalized = readStringValue(value)?.toLowerCase();
  if (
    normalized
    && ROLE_ROOM_CLIENT_PORTAL_WORKSPACES.includes(
      normalized as (typeof ROLE_ROOM_CLIENT_PORTAL_WORKSPACES)[number],
    )
  ) {
    return normalized as (typeof ROLE_ROOM_CLIENT_PORTAL_WORKSPACES)[number];
  }
  return 'brief';
}

function normalizeRoleRoomClientPortalTab(value: unknown): typeof ROLE_ROOM_CLIENT_PORTAL_TABS[number] {
  const normalized = readStringValue(value)?.toLowerCase();
  if (
    normalized
    && ROLE_ROOM_CLIENT_PORTAL_TABS.includes(
      normalized as (typeof ROLE_ROOM_CLIENT_PORTAL_TABS)[number],
    )
  ) {
    return normalized as (typeof ROLE_ROOM_CLIENT_PORTAL_TABS)[number];
  }
  return 'media';
}

function pruneExpiredRoleRoomGoogleState(): void {
  const now = Date.now();
  for (const [key, value] of roleRoomGoogleOauthStateStore.entries()) {
    if (now - value.createdAt > ROLE_ROOM_GOOGLE_STATE_TTL_MS) {
      roleRoomGoogleOauthStateStore.delete(key);
    }
  }
  for (const [key, value] of roleRoomGoogleTransferStore.entries()) {
    if (now - value.createdAt > ROLE_ROOM_GOOGLE_STATE_TTL_MS) {
      roleRoomGoogleTransferStore.delete(key);
    }
  }
  for (const [key, value] of roleRoomLinkedInOauthStateStore.entries()) {
    if (now - value.createdAt > ROLE_ROOM_GOOGLE_STATE_TTL_MS) {
      roleRoomLinkedInOauthStateStore.delete(key);
    }
  }
  for (const [key, value] of roleRoomLinkedInTransferStore.entries()) {
    if (now - value.createdAt > ROLE_ROOM_GOOGLE_STATE_TTL_MS) {
      roleRoomLinkedInTransferStore.delete(key);
    }
  }
  for (const [key, value] of roleRoomClientInviteTransferStore.entries()) {
    if (now - value.createdAt > ROLE_ROOM_GOOGLE_STATE_TTL_MS) {
      roleRoomClientInviteTransferStore.delete(key);
    }
  }
}

function deriveRoleRoomServiceEncryptionKey(primaryEnvKey: string): Buffer | null {
  const secret = readStringValue(
    process.env[primaryEnvKey]
    ?? process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.AUTH_SECRET,
  );
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function deriveRoleRoomGoogleEncryptionKey(): Buffer | null {
  return deriveRoleRoomServiceEncryptionKey('ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY');
}

function deriveRoleRoomLinkedInEncryptionKey(): Buffer | null {
  return deriveRoleRoomServiceEncryptionKey('ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY');
}

function deriveRoleRoomVaultEncryptionKey(): Buffer | null {
  return deriveRoleRoomServiceEncryptionKey('ROLE_ROOM_VAULT_ENCRYPTION_KEY');
}

function encryptRoleRoomGoogleToken(value: string): string {
  const key = deriveRoleRoomGoogleEncryptionKey();
  if (!key) {
    throw new Error('ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY mangler');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

// Slice 9X.80 — delegerer til shared dekryptor
import { decryptGoogleToken as sharedDecryptGoogleToken } from './google-oauth-shared.js';
function decryptRoleRoomGoogleToken(value: string | null | undefined): string | null {
  return sharedDecryptGoogleToken(value);
}

function encryptRoleRoomLinkedInToken(value: string): string {
  const key = deriveRoleRoomLinkedInEncryptionKey();
  if (!key) {
    throw new Error('ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY mangler');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptRoleRoomLinkedInToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const key = deriveRoleRoomLinkedInEncryptionKey();
  if (!key) {
    return null;
  }
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function encryptRoleRoomVaultSecret(value: string): string {
  const key = deriveRoleRoomVaultEncryptionKey();
  if (!key) {
    throw new Error('ROLE_ROOM_VAULT_ENCRYPTION_KEY mangler');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptRoleRoomVaultSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const key = deriveRoleRoomVaultEncryptionKey();
  if (!key) {
    return null;
  }
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function normalizeProducerAccountAccessPlatform(value: unknown): ProducerAccountAccessPlatform | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized === 'google'
    || normalized === 'meta'
    || normalized === 'linkedin'
    || normalized === 'youtube'
    || normalized === 'tiktok'
  ) {
    return normalized as ProducerAccountAccessPlatform;
  }
  return null;
}

function normalizeRoleRoomVaultRevealPolicy(value: unknown): RoleRoomAccessVaultRevealPolicy {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'one_time' || normalized === 'manual_only' || normalized === 'mfa_required') {
    return normalized;
  }
  return 'approval_required';
}

function normalizeRoleRoomVaultSecretStatus(value: unknown): RoleRoomAccessVaultSecretStatus {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'requested' || normalized === 'stored_externally' || normalized === 'revoked') {
    return normalized;
  }
  return 'not_shared';
}

function normalizeRoleRoomVaultRoleTargets(value: unknown): string[] {
  const targets = readJsonArray(value)
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => (
      entry === 'client_owner'
      || entry === 'producer'
      || entry === 'editor'
      || entry === 'social_media_manager'
      || entry === 'admin'
    ));
  return Array.from(new Set(targets));
}

function maskRoleRoomVaultSecretValue(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }
  return `••••${trimmed.slice(-4)}`;
}

function readVaultTimestamp(value: unknown): string | null {
  const timestamp = readStringValue(value);
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function getRoleRoomGoogleRedirectUri(req?: Request): string | null {
  const configured = readStringValue(process.env.ROLE_ROOM_GOOGLE_REDIRECT_URI);
  if (configured) {
    return configured;
  }

  const requestOrigin = resolveGoogleWorkspaceRequestOrigin('role_room', req);
  return requestOrigin ? `${requestOrigin}/api/role-room/google/oauth/callback` : null;
}

function getRoleRoomLinkedInRedirectUri(req?: Request): string | null {
  const configured = readStringValue(process.env.ROLE_ROOM_LINKEDIN_REDIRECT_URI);
  if (configured) {
    return configured;
  }

  if (!req) {
    return null;
  }
  const host = req.get('host');
  if (!host) {
    return null;
  }
  const forwardedProto = readStringValue(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto ?? req.protocol ?? 'http';
  return `${protocol}://${host}/api/auth/linkedin/callback`;
}

function getRoleRoomRequestOrigin(req?: Request): string | null {
  return resolveGoogleWorkspaceRequestOrigin('role_room', req);
}

function sanitizeRoleRoomBrowserOrigin(value: unknown): string | null {
  const candidate = readStringValue(value);
  if (!candidate) {
    return null;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    return null;
  }
  return null;
}

function getRoleRoomGoogleConfig(
  req?: Request,
  redirectUriOverride?: string | null,
) {
  const oauthConfig = getGoogleWorkspaceOauthConfig('role_room', req);
  const encryptionKey = deriveRoleRoomGoogleEncryptionKey();
  const redirectUri = readStringValue(redirectUriOverride)
    ?? oauthConfig.redirectUri
    ?? getRoleRoomGoogleRedirectUri(req);
  return {
    clientId: oauthConfig.clientId,
    clientSecret: oauthConfig.clientSecret,
    redirectUri,
    configured: Boolean(oauthConfig.clientId && oauthConfig.clientSecret && redirectUri && encryptionKey),
    missing: [
      ...oauthConfig.missing,
      !encryptionKey ? 'ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY' : null,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

function getRoleRoomLinkedInConfig(req?: Request) {
  const clientId = readStringValue(process.env.ROLE_ROOM_LINKEDIN_CLIENT_ID ?? process.env.LINKEDIN_CLIENT_ID);
  const clientSecret = readStringValue(process.env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET ?? process.env.LINKEDIN_CLIENT_SECRET);
  const redirectUri = getRoleRoomLinkedInRedirectUri(req);
  const encryptionKey = deriveRoleRoomLinkedInEncryptionKey();
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri && encryptionKey),
    missing: [
      !clientId ? 'ROLE_ROOM_LINKEDIN_CLIENT_ID' : null,
      !clientSecret ? 'ROLE_ROOM_LINKEDIN_CLIENT_SECRET' : null,
      !redirectUri ? 'ROLE_ROOM_LINKEDIN_REDIRECT_URI' : null,
      !encryptionKey ? 'ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY' : null,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

function createRoleRoomGoogleOAuthClient(
  req?: Request,
  redirectUriOverride?: string | null,
) {
  const config = getRoleRoomGoogleConfig(req, redirectUriOverride);
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    return null;
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

class RoleRoomGoogleAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'RoleRoomGoogleAuthError';
    this.statusCode = statusCode;
  }
}

function isRoleRoomGoogleAuthError(error: unknown): error is RoleRoomGoogleAuthError {
  return error instanceof RoleRoomGoogleAuthError;
}

function normalizeRoleRoomGoogleAuthError(error: unknown): { message: string; state: RoleRoomGoogleConnectionState } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Google token refresh failed');
  const payload = JSON.stringify((error as { response?: { data?: unknown } } | undefined)?.response?.data ?? {});
  const combined = `${rawMessage} ${payload}`.toLowerCase();

  if (combined.includes('invalid_rapt') || combined.includes('reauth related error')) {
    return {
      message: 'Google Workspace-koblingen krever ny innlogging. Koble Google på nytt i Role Room.',
      state: 'expired',
    };
  }

  if (combined.includes('unauthorized_client')) {
    return {
      message: 'Google Workspace-tokenet tilhører en annen OAuth-klient. Koble Google på nytt i Role Room.',
      state: 'error',
    };
  }

  if (combined.includes('invalid_grant')) {
    return {
      message: 'Google Workspace-koblingen er ikke lenger gyldig. Koble Google på nytt i Role Room.',
      state: 'expired',
    };
  }

  return {
    message: rawMessage,
    state: 'error',
  };
}

function readRoleRoomGoogleUpstreamErrorMessage(error: unknown): string | null {
  const responseData = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const responseObject = readJsonObject(responseData);
  const nestedError = readJsonObject(responseObject.error);
  return readStringValue(nestedError.message)
    ?? readStringValue(responseObject.error_description)
    ?? readStringValue(responseObject.message)
    ?? null;
}

function sendRoleRoomGoogleError(res: Response, error: unknown, fallbackMessage: string) {
  if (isRoleRoomGoogleAuthError(error)) {
    res.status(error.statusCode).json({ error: error.message, reconnectRequired: true });
    return;
  }

  const upstreamMessage = readRoleRoomGoogleUpstreamErrorMessage(error);
  console.error(fallbackMessage, error);
  res.status(500).json({
    error: upstreamMessage ? `${fallbackMessage}: ${upstreamMessage}` : fallbackMessage,
  });
}

const ROLE_ROOM_CANONICAL_PATH = '/theroleroom';
const ROLE_ROOM_LEGACY_PATH = '/casting.html';

function normalizeRoleRoomReturnPath(pathname: string): string {
  const trimmedPath = pathname.trim();
  if (!trimmedPath) {
    return ROLE_ROOM_CANONICAL_PATH;
  }

  const [pathOnly, hashPart = ''] = trimmedPath.split('#', 2);
  const [basePath, queryString = ''] = pathOnly.split('?', 2);
  const normalizedBasePath = basePath.trim().toLowerCase() === ROLE_ROOM_LEGACY_PATH
    ? ROLE_ROOM_CANONICAL_PATH
    : basePath;

  return `${normalizedBasePath}${queryString ? `?${queryString}` : ''}${hashPart ? `#${hashPart}` : ''}`;
}

function sanitizeRoleRoomReturnPath(rawValue: unknown, req?: Request): string {
  const fallback = ROLE_ROOM_CANONICAL_PATH;
  const value = readStringValue(rawValue);
  if (!value) {
    return fallback;
  }
  if (value.startsWith('/')) {
    return normalizeRoleRoomReturnPath(value);
  }
  if (req) {
    try {
      const host = req.get('host');
      const forwardedProto = readStringValue(req.headers['x-forwarded-proto']);
      const protocol = forwardedProto ?? req.protocol ?? 'http';
      const expectedOrigin = `${protocol}://${host}`;
      const parsed = new URL(value);
      if (parsed.origin === expectedOrigin) {
        return normalizeRoleRoomReturnPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function appendQueryParamsToPath(pathname: string, params: Record<string, string | null | undefined>): string {
  const safePath = normalizeRoleRoomReturnPath(pathname.trim().length > 0 ? pathname : ROLE_ROOM_CANONICAL_PATH);
  const [pathOnly, hashPart = ''] = safePath.split('#', 2);
  const [basePath, queryString = ''] = pathOnly.split('?', 2);
  const searchParams = new URLSearchParams(queryString);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      searchParams.delete(key);
      return;
    }
    searchParams.set(key, value);
  });
  const nextQuery = searchParams.toString();
  return `${basePath}${nextQuery ? `?${nextQuery}` : ''}${hashPart ? `#${hashPart}` : ''}`;
}

function resolveRoleRoomBrowserOrigin(
  req?: Request,
  browserOrigin?: string | null,
): string | null {
  return resolveGoogleWorkspaceRequestOrigin('role_room', req, sanitizeRoleRoomBrowserOrigin(browserOrigin));
}

function buildRoleRoomGoogleReturnUrl(
  returnPath: string,
  params: Record<string, string | null | undefined>,
  browserOrigin?: string | null,
): string {
  const nextPath = appendQueryParamsToPath(returnPath, params);
  if (browserOrigin && nextPath.startsWith('/')) {
    return `${browserOrigin}${nextPath}`;
  }
  return nextPath;
}

function buildRoleRoomClientPortalReturnPath(options: {
  projectId: string;
  workspace?: string | null;
  tab?: string | null;
  sectionId?: string | null;
  pageId?: string | null;
  reviewId?: string | null;
  artifactId?: string | null;
}): string {
  return appendQueryParamsToPath(ROLE_ROOM_CANONICAL_PATH, {
    portal: 'client',
    projectId: options.projectId,
    tab: normalizeRoleRoomClientPortalTab(options.tab),
    workspace: normalizeRoleRoomClientPortalWorkspace(options.workspace),
    section: readStringValue(options.sectionId),
    page: readStringValue(options.pageId),
    reviewId: readStringValue(options.reviewId),
    artifactId: readStringValue(options.artifactId),
  });
}

function getRoleRoomGoogleFolderKeyForFile(fileRecord: Record<string, unknown>): string {
  const metadata = readJsonObject(fileRecord.metadata);
  const source = readStringValue(metadata.source) ?? '';
  const entryType = readStringValue(metadata.entryType) ?? '';
  if (source === 'role_room_client_handoff_package' || source === 'role_room_delivery_workspace') {
    return 'delivery';
  }
  if (source === 'role_room_client_material' && entryType === 'brand_asset') {
    return 'brand';
  }
  if (source === 'role_room_client_material') {
    return 'materials';
  }
  return 'brief';
}

// ── CORS Configuration ──────────────────────────────────────

function buildCorsOptions(): cors.CorsOptionsDelegate<Request> {
  const raw = process.env.CORS_ALLOW_ORIGINS ?? '';
  const configuredOrigins = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const defaultDevOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5001',
        'http://127.0.0.1:5001',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];
  const allowList = Array.from(
    new Set(
      [
        ...configuredOrigins,
        ...defaultDevOrigins,
        DEFAULT_ROLE_ROOM_TALENT_PUBLIC_ORIGIN,
        'https://www.theroleroom.com',
      ].filter((entry): entry is string => Boolean(readStringValue(entry))),
    ),
  );

  const baseOptions: cors.CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
    maxAge: 600,
  };

  return (req, callback) => {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

    // Server-to-server / curl / no-origin → allow
    if (!origin) return callback(null, { ...baseOptions, origin: true });

    // Same-origin requests must always be allowed. Browseren sender Origin-
    // header på POST selv når det er same-origin (f.eks. fra admin-pages som
    // ligger på selve backend-en), og uten denne sjekken vil
    // serverens egen origin bli avvist hvis den ikke er i allowlist-en.
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined) ??
      (req.protocol === 'http' ? 'http' : 'https');
    const host =
      (req.headers['x-forwarded-host'] as string | undefined) ??
      (typeof req.headers.host === 'string' ? req.headers.host : undefined);
    if (host && origin === `${proto}://${host}`) {
      return callback(null, { ...baseOptions, origin: true });
    }

    if (allowList.includes(origin) || allowList.includes('*')) {
      return callback(null, { ...baseOptions, origin: true });
    }

    callback(new Error(`Origin ${origin} blocked by CORS_ALLOW_ORIGINS policy`));
  };
}

// ── Auth Session Type ────────────────────────────────────────

type SessionData = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  displayName?: string;
  picture?: string;
  verified_email?: boolean;
  requestedRole?: string | null;
  loginAs?: string;
};

function isRoleRoomDevBypassEnabled(): boolean {
  if (process.env.ROLE_ROOM_DEV_AUTH_BYPASS === '1') return true;
  if (process.env.ROLE_ROOM_DEV_AUTH_BYPASS === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

function deriveDevUserIdFromBearer(token: string): string {
  const fallback = 'dev-session-user';
  const trimmed = token.trim();
  if (!trimmed) return fallback;

  const jwtParts = trimmed.split('.');
  if (jwtParts.length >= 2) {
    try {
      const payloadJson = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as { sub?: string; userId?: string; id?: string };
      const fromPayload = payload.sub ?? payload.userId ?? payload.id;
      if (typeof fromPayload === 'string' && fromPayload.trim()) {
        return fromPayload.trim();
      }
    } catch {
      // Ignore decode errors and continue with deterministic fallback.
    }
  }

  return `dev-${hashApiKey(trimmed).slice(0, 16)}`;
}

function readOptionalHeaderValue(req: Request, headerName: string): string | undefined {
  const raw = req.headers[headerName.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRoleRoomDevUserId(req: Request, bearer?: string): string {
  const headerUserId =
    readOptionalHeaderValue(req, 'x-role-room-user-id')
    ?? readOptionalHeaderValue(req, 'x-user-id');
  return headerUserId ?? (bearer ? deriveDevUserIdFromBearer(bearer) : 'dev-local-user');
}

function readRoleRoomDevUserEmail(req: Request): string | undefined {
  return readOptionalHeaderValue(req, 'x-role-room-email')
    ?? readOptionalHeaderValue(req, 'x-user-email');
}

function readRoleRoomDevUserRole(req: Request): string | undefined {
  return readOptionalHeaderValue(req, 'x-role-room-role')
    ?? readOptionalHeaderValue(req, 'x-user-role');
}

function isEphemeralRoleRoomDevUserId(userId: string | null | undefined): boolean {
  if (typeof userId !== 'string') return false;
  return userId === 'dev-local-user' || userId.startsWith('dev-');
}

function isRoleRoomLocalDevelopmentUserId(userId: string | null | undefined): boolean {
  if (!isRoleRoomDevBypassEnabled() || typeof userId !== 'string') {
    return false;
  }

  return userId === 'local-admin' || isEphemeralRoleRoomDevUserId(userId);
}

async function resolveRoleRoomSessionFromBearer(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const sessionToken = typeof bearer === 'string' ? bearer.trim() : '';
  if (!sessionToken) {
    return null;
  }

  const inMemorySession = activeSessions?.get(sessionToken) ?? null;
  if (inMemorySession) {
    return inMemorySession;
  }

  const persistedSession = await loadPersistedAuthSession<SessionData>(
    pool,
    sessionToken,
  );
  if (persistedSession) {
    activeSessions?.set(sessionToken, persistedSession);
    return persistedSession;
  }

  return null;
}

async function resolveOptionalRequestUser(
  req: Request,
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): Promise<ApiKeyUserContext | null> {
  const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
  if (apiKeyReq.apiKeyUser?.userId) {
    return apiKeyReq.apiKeyUser;
  }

  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  const session = await resolveRoleRoomSessionFromBearer(pool, activeSessions, bearer);
  if (session) {
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      scopes: buildSessionScopes(session.role),
    };
  }

  if (isRoleRoomDevBypassEnabled()) {
    const headerEmail = readRoleRoomDevUserEmail(req);
    const headerRole = readRoleRoomDevUserRole(req)?.toLowerCase();
    const userId = readRoleRoomDevUserId(req, bearer);
    return {
      userId,
      email: headerEmail,
      role: headerRole,
      scopes: headerRole ? buildSessionScopes(headerRole) : ['read', 'write', 'admin'],
    };
  }

  return null;
}

// ── API Key Middleware ───────────────────────────────────────

/**
 * Dual-auth middleware: accepts either
 *   • x-api-key header  (external integrations)
 *   • Authorization: Bearer <session-token>  (in-app users)
 */
function apiKeyAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const devBypassEnabled = isRoleRoomDevBypassEnabled();

    // ── 1. Try Bearer token (in-app session) ──────────────
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveRoleRoomSessionFromBearer(pool, activeSessions, bearer);
    if (session) {
      (req as Request & { apiKeyUser: ApiKeyUserContext }).apiKeyUser = {
        userId: session.userId,
        email: session.email,
        role: session.role,
        scopes: buildSessionScopes(session.role),
      };
      next();
      return;
    }

    // ── 1b. Dev-mode bypass for local UI integration ───────
    if (devBypassEnabled) {
      const headerEmail = readRoleRoomDevUserEmail(req);
      const headerRole = readRoleRoomDevUserRole(req)?.toLowerCase();
      const userId = readRoleRoomDevUserId(req, bearer);
      (req as Request & { apiKeyUser: ApiKeyUserContext }).apiKeyUser = {
        userId,
        email: headerEmail,
        role: headerRole,
        scopes: headerRole ? buildSessionScopes(headerRole) : ['read', 'write', 'admin'],
      };
      next();
      return;
    }

    // ── 2. Try x-api-key header (external clients) ────────
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string' || !key) {
      res.status(401).json({ error: 'Mangler x-api-key header eller gyldig session' });
      return;
    }

    const keyHash = hashApiKey(key);
    try {
      const result = await pool.query<RoleRoomApiKeyRow>(
        `SELECT * FROM role_room_api_keys 
         WHERE key_hash = $1 AND is_active = TRUE 
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [keyHash]
      );

      if (result.rowCount === 0) {
        res.status(403).json({ error: 'Ugyldig eller utløpt API-nøkkel' });
        return;
      }

      const apiKeyRecord = result.rows[0];

      // Update last_used_at
      await pool.query(
        `UPDATE role_room_api_keys SET last_used_at = NOW() WHERE id = $1`,
        [apiKeyRecord.id]
      );

      // Attach user context to request
      (req as Request & { apiKeyUser: ApiKeyUserContext }).apiKeyUser = {
        userId: apiKeyRecord.user_id,
        scopes: Array.isArray(apiKeyRecord.scopes) ? apiKeyRecord.scopes : ['read'],
      };

      next();
    } catch (err) {
      console.error('API key auth error:', err);
      res.status(500).json({ error: 'Intern autentiseringsfeil' });
    }
  };
}

// ── Request helpers ──────────────────────────────────────────

function getUserId(req: Request): string {
  const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
  return apiKeyReq.apiKeyUser?.userId ?? 'anonymous';
}

function requireScope(req: Request, scope: string): boolean {
  const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
  const scopes = apiKeyReq.apiKeyUser?.scopes ?? [];
  return scopes.includes(scope) || scopes.includes('admin');
}

// ── Router Factory ───────────────────────────────────────────

export function createRoleRoomRouter(pool: Pool, activeSessions?: Map<string, SessionData>): Router {
  const router = Router();
  const LEGACY_COMPAT_TABLE_NAME = 'legacy_compat_store';
  let legacyCompatTableReadyPromise: Promise<boolean> | null = null;

  async function ensureLegacyCompatTable(): Promise<boolean> {
    if (legacyCompatTableReadyPromise) return legacyCompatTableReadyPromise;
    legacyCompatTableReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ${LEGACY_COMPAT_TABLE_NAME} (
            store_key TEXT PRIMARY KEY,
            store_value JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        return true;
      } catch (error) {
        console.warn('Role Room compat store unavailable:', error);
        return false;
      }
    })();
    return legacyCompatTableReadyPromise;
  }

  async function compatStoreGet<T>(storeKey: string): Promise<T | null> {
    if (!(await ensureLegacyCompatTable())) return null;
    try {
      const result = await pool.query(
        `SELECT store_value FROM ${LEGACY_COMPAT_TABLE_NAME} WHERE store_key = $1 LIMIT 1`,
        [storeKey],
      );
      if (!Array.isArray(result.rows) || result.rows.length === 0) return null;
      return (result.rows[0]?.store_value as T | undefined) ?? null;
    } catch (error) {
      console.warn('Role Room compatStoreGet failed:', { storeKey, error });
      return null;
    }
  }

  async function compatStoreSet(storeKey: string, storeValue: unknown): Promise<void> {
    if (!(await ensureLegacyCompatTable())) return;
    try {
      await pool.query(
        `INSERT INTO ${LEGACY_COMPAT_TABLE_NAME} (store_key, store_value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (store_key)
         DO UPDATE SET
           store_value = EXCLUDED.store_value,
           updated_at = NOW()`,
        [storeKey, JSON.stringify(storeValue ?? null) ?? 'null'],
      );
    } catch (error) {
      console.warn('Role Room compatStoreSet failed:', { storeKey, error });
    }
  }

  function legacyProjectAgreementsKey(projectId: string): string {
    return `casting:project-agreements:${projectId}`;
  }

  function getOptionalRequestUser(req: Request): ApiKeyUserContext | null {
    const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
    if (apiKeyReq.apiKeyUser?.userId) {
      return apiKeyReq.apiKeyUser;
    }

    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (bearer && activeSessions) {
      const session = activeSessions.get(bearer);
      if (session) {
        return {
          userId: session.userId,
          email: session.email,
          role: session.role,
          scopes: buildSessionScopes(session.role),
        };
      }
    }

    if (isRoleRoomDevBypassEnabled()) {
      const headerEmail = readRoleRoomDevUserEmail(req);
      const headerRole = readRoleRoomDevUserRole(req)?.toLowerCase();
      const userId = readRoleRoomDevUserId(req, bearer);
      return {
        userId,
        email: headerEmail,
        role: headerRole,
        scopes: headerRole ? buildSessionScopes(headerRole) : ['read', 'write', 'admin'],
      };
    }

    return null;
  }

  let roleRoomGoogleTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomGoogleTables(): Promise<boolean> {
    if (roleRoomGoogleTablesReadyPromise) return roleRoomGoogleTablesReadyPromise;
    roleRoomGoogleTablesReadyPromise = (async () => {
      try {
        const castingProjectsReady = await ensureCastingProjectsTable();
        if (!castingProjectsReady) {
          return false;
        }

        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_google_connections (
            id UUID PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            role_room_email VARCHAR(255),
            google_email VARCHAR(255),
            google_subject VARCHAR(255),
            access_token_encrypted TEXT,
            refresh_token_encrypted TEXT,
            expiry_date TIMESTAMPTZ,
            scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
            connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
            last_error TEXT,
            profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ
          );
          ALTER TABLE role_room_google_connections
            ADD COLUMN IF NOT EXISTS oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room';
          UPDATE role_room_google_connections
             SET oauth_app = 'role_room'
           WHERE oauth_app IS NULL OR TRIM(oauth_app) = '';
          DROP INDEX IF EXISTS idx_rr_google_connections_user_id_unique;
          DROP INDEX IF EXISTS idx_rr_google_connections_subject_unique;
          CREATE INDEX IF NOT EXISTS idx_rr_google_connections_user_id ON role_room_google_connections(user_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_connections_email ON role_room_google_connections(google_email);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_user_app_unique
            ON role_room_google_connections(user_id, oauth_app);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_subject_app_unique
            ON role_room_google_connections(google_subject, oauth_app)
            WHERE google_subject IS NOT NULL;

          CREATE TABLE IF NOT EXISTS role_room_google_project_bindings (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            connected_user_id VARCHAR(255),
            drive_root_folder_id VARCHAR(255),
            calendar_id VARCHAR(255),
            contacts_context JSONB NOT NULL DEFAULT '{}'::jsonb,
            meet_creation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            audit_signature_storage_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            folder_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
            sync_status JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_drive_sync_at TIMESTAMPTZ,
            last_calendar_sync_at TIMESTAMPTZ
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_project_binding_project_unique ON role_room_google_project_bindings(project_id);

          CREATE TABLE IF NOT EXISTS role_room_google_artifacts (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            local_entity_type VARCHAR(100) NOT NULL,
            local_entity_id VARCHAR(255) NOT NULL,
            artifact_type VARCHAR(64) NOT NULL,
            source_label VARCHAR(255),
            drive_file_id VARCHAR(255),
            calendar_event_id VARCHAR(255),
            meet_url TEXT,
            web_view_url TEXT,
            web_content_link TEXT,
            mime_type VARCHAR(255),
            folder_key VARCHAR(64),
            sync_status VARCHAR(32) NOT NULL DEFAULT 'synced',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_artifact_local_unique
            ON role_room_google_artifacts(project_id, local_entity_type, local_entity_id, artifact_type);
          CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_project ON role_room_google_artifacts(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_drive_file ON role_room_google_artifacts(drive_file_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_calendar_event ON role_room_google_artifacts(calendar_event_id);

          CREATE TABLE IF NOT EXISTS role_room_google_agreement_signatures (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            agreement_id VARCHAR(255) NOT NULL,
            provider VARCHAR(64) NOT NULL DEFAULT 'google_workspace',
            status VARCHAR(64) NOT NULL DEFAULT 'not_started',
            document_title TEXT,
            drive_source_file_id VARCHAR(255),
            signed_drive_file_id VARCHAR(255),
            audit_artifact_id VARCHAR(255),
            request_url TEXT,
            web_view_url TEXT,
            requested_by VARCHAR(255),
            requested_by_email VARCHAR(255),
            counterparty_name TEXT,
            counterparty_email VARCHAR(255),
            prepared_at TIMESTAMPTZ,
            sent_at TIMESTAMPTZ,
            signed_at TIMESTAMPTZ,
            declined_at TIMESTAMPTZ,
            last_opened_at TIMESTAMPTZ,
            last_synced_at TIMESTAMPTZ,
            signature_hash TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_agreement_signature_unique
            ON role_room_google_agreement_signatures(project_id, agreement_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_project
            ON role_room_google_agreement_signatures(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_status
            ON role_room_google_agreement_signatures(status);
          CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_drive_source
            ON role_room_google_agreement_signatures(drive_source_file_id);
          CREATE INDEX IF NOT EXISTS idx_rr_google_agreement_signatures_signed_drive
            ON role_room_google_agreement_signatures(signed_drive_file_id);
        `);

        return true;
      } catch (error) {
        console.warn('Role Room Google tables unavailable:', error);
        return false;
      }
    })();
    return roleRoomGoogleTablesReadyPromise;
  }

  let roleRoomLinkedInTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomLinkedInTables(): Promise<boolean> {
    if (roleRoomLinkedInTablesReadyPromise) return roleRoomLinkedInTablesReadyPromise;
    roleRoomLinkedInTablesReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_linkedin_connections (
            id UUID PRIMARY KEY,
            user_id TEXT NOT NULL,
            role_room_email TEXT,
            linkedin_member_id TEXT,
            linkedin_email TEXT,
            linkedin_name TEXT,
            access_token_encrypted TEXT,
            refresh_token_encrypted TEXT,
            expiry_date TIMESTAMPTZ,
            scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
            connection_state TEXT NOT NULL DEFAULT 'disconnected',
            last_error TEXT,
            profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_connections_user_id_unique ON role_room_linkedin_connections(user_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_connections_member_id_unique ON role_room_linkedin_connections(linkedin_member_id);
          CREATE INDEX IF NOT EXISTS idx_rr_linkedin_connections_email ON role_room_linkedin_connections(linkedin_email);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room LinkedIn tables unavailable:', error);
        return false;
      }
    })();
    return roleRoomLinkedInTablesReadyPromise;
  }

  async function getRoleRoomGoogleConnectionByUserId(userId: string): Promise<RoleRoomGoogleConnectionRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomGoogleConnectionRow>(
      `SELECT *
       FROM role_room_google_connections
       WHERE user_id = $1
         AND oauth_app = 'role_room'
       ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async function getRoleRoomLinkedInConnectionByUserId(userId: string): Promise<RoleRoomLinkedInConnectionRow | null> {
    if (!(await ensureRoleRoomLinkedInTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomLinkedInConnectionRow>(
      `SELECT * FROM role_room_linkedin_connections WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async function getRoleRoomLinkedInConnectionByMemberId(memberId: string): Promise<RoleRoomLinkedInConnectionRow | null> {
    if (!(await ensureRoleRoomLinkedInTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomLinkedInConnectionRow>(
      `SELECT * FROM role_room_linkedin_connections WHERE linkedin_member_id = $1 LIMIT 1`,
      [memberId],
    );
    return result.rows[0] ?? null;
  }

  async function getRoleRoomGoogleProjectBinding(projectId: string): Promise<RoleRoomGoogleProjectBindingRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomGoogleProjectBindingRow>(
      `SELECT * FROM role_room_google_project_bindings WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    return result.rows[0] ?? null;
  }

  async function upsertRoleRoomGoogleConnection(
    userId: string,
    roleRoomEmail: string | null,
    googleProfile: { email: string; subject: string; profile: Record<string, unknown> },
    tokenBundle: NonNullable<RoleRoomGoogleTransferPayload['tokenBundle']>,
  ): Promise<RoleRoomGoogleConnectionRow> {
    if (!(await ensureRoleRoomGoogleTables())) {
      throw new Error('Role Room Google tables unavailable');
    }

    const accessTokenEncrypted = tokenBundle.accessToken ? encryptRoleRoomGoogleToken(tokenBundle.accessToken) : null;
    const refreshTokenEncrypted = tokenBundle.refreshToken ? encryptRoleRoomGoogleToken(tokenBundle.refreshToken) : null;
    const expiryDate = typeof tokenBundle.expiryDate === 'number' && Number.isFinite(tokenBundle.expiryDate)
      ? new Date(tokenBundle.expiryDate).toISOString()
      : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingByUserResult = await client.query<RoleRoomGoogleConnectionRow>(
        `SELECT *
         FROM role_room_google_connections
         WHERE user_id = $1
           AND oauth_app = 'role_room'
         LIMIT 1`,
        [userId],
      );
      const existingByUser = existingByUserResult.rows[0] ?? null;

      const existingBySubjectResult = await client.query<RoleRoomGoogleConnectionRow>(
        `SELECT *
         FROM role_room_google_connections
         WHERE google_subject = $1
           AND oauth_app = 'role_room'
         LIMIT 1`,
        [googleProfile.subject],
      );
      const existingBySubject = existingBySubjectResult.rows[0] ?? null;

      if (existingBySubject && existingByUser && existingBySubject.id !== existingByUser.id) {
        await client.query(
          `DELETE FROM role_room_google_connections WHERE id = $1`,
          [existingByUser.id],
        );
      }

      if (existingBySubject) {
        const updateResult = await client.query<RoleRoomGoogleConnectionRow>(
          `UPDATE role_room_google_connections
           SET user_id = $2,
               role_room_email = $3,
               google_email = $4,
               google_subject = $5,
               access_token_encrypted = COALESCE($6, access_token_encrypted),
               refresh_token_encrypted = COALESCE($7, refresh_token_encrypted),
               expiry_date = COALESCE($8, expiry_date),
               scopes = $9::jsonb,
               connection_state = 'connected',
               last_error = NULL,
               profile = $10::jsonb,
               oauth_app = 'role_room',
               updated_at = NOW(),
               last_used_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            existingBySubject.id,
            userId,
            roleRoomEmail,
            googleProfile.email,
            googleProfile.subject,
            accessTokenEncrypted,
            refreshTokenEncrypted,
            expiryDate,
            JSON.stringify(tokenBundle.scopes ?? []),
            JSON.stringify(googleProfile.profile),
          ],
        );
        await client.query('COMMIT');
        return updateResult.rows[0];
      }

      const result = await client.query<RoleRoomGoogleConnectionRow>(
        `INSERT INTO role_room_google_connections (
          id, user_id, role_room_email, google_email, google_subject,
          access_token_encrypted, refresh_token_encrypted, expiry_date, scopes,
          connection_state, last_error, profile, oauth_app, created_at, updated_at, last_used_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9::jsonb,
          'connected', NULL, $10::jsonb, 'role_room', NOW(), NOW(), NOW()
        )
        ON CONFLICT (user_id, oauth_app) DO UPDATE SET
          role_room_email = EXCLUDED.role_room_email,
          google_email = EXCLUDED.google_email,
          google_subject = EXCLUDED.google_subject,
          access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, role_room_google_connections.access_token_encrypted),
          refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, role_room_google_connections.refresh_token_encrypted),
          expiry_date = COALESCE(EXCLUDED.expiry_date, role_room_google_connections.expiry_date),
          scopes = EXCLUDED.scopes,
          connection_state = 'connected',
          last_error = NULL,
          profile = EXCLUDED.profile,
          updated_at = NOW(),
          last_used_at = NOW()
        RETURNING *`,
        [
          crypto.randomUUID(),
          userId,
          roleRoomEmail,
          googleProfile.email,
          googleProfile.subject,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          expiryDate,
          JSON.stringify(tokenBundle.scopes ?? []),
          JSON.stringify(googleProfile.profile),
        ],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function upsertRoleRoomLinkedInConnection(
    userId: string,
    roleRoomEmail: string | null,
    linkedInProfile: {
      memberId: string;
      email?: string | null;
      name?: string | null;
      profile: Record<string, unknown>;
    },
    tokenBundle: RoleRoomLinkedInTransferPayload['tokenBundle'],
  ): Promise<RoleRoomLinkedInConnectionRow> {
    if (!(await ensureRoleRoomLinkedInTables())) {
      throw new Error('Role Room LinkedIn tables unavailable');
    }

    const accessTokenEncrypted = tokenBundle.accessToken ? encryptRoleRoomLinkedInToken(tokenBundle.accessToken) : null;
    const refreshTokenEncrypted = tokenBundle.refreshToken ? encryptRoleRoomLinkedInToken(tokenBundle.refreshToken) : null;
    const expiryDate = typeof tokenBundle.expiryDate === 'number' && Number.isFinite(tokenBundle.expiryDate)
      ? new Date(tokenBundle.expiryDate).toISOString()
      : null;

    const result = await pool.query<RoleRoomLinkedInConnectionRow>(
      `INSERT INTO role_room_linkedin_connections (
        id, user_id, role_room_email, linkedin_member_id, linkedin_email, linkedin_name,
        access_token_encrypted, refresh_token_encrypted, expiry_date, scopes,
        connection_state, last_error, profile, created_at, updated_at, last_used_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::jsonb,
        'connected', NULL, $11::jsonb, NOW(), NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        role_room_email = EXCLUDED.role_room_email,
        linkedin_member_id = EXCLUDED.linkedin_member_id,
        linkedin_email = EXCLUDED.linkedin_email,
        linkedin_name = EXCLUDED.linkedin_name,
        access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, role_room_linkedin_connections.access_token_encrypted),
        refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, role_room_linkedin_connections.refresh_token_encrypted),
        expiry_date = COALESCE(EXCLUDED.expiry_date, role_room_linkedin_connections.expiry_date),
        scopes = EXCLUDED.scopes,
        connection_state = 'connected',
        last_error = NULL,
        profile = EXCLUDED.profile,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING *`,
      [
        crypto.randomUUID(),
        userId,
        roleRoomEmail,
        linkedInProfile.memberId,
        linkedInProfile.email ?? null,
        linkedInProfile.name ?? null,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiryDate,
        JSON.stringify(tokenBundle.scopes ?? []),
        JSON.stringify(linkedInProfile.profile),
      ],
    );
    return result.rows[0];
  }

  function canBootstrapRoleRoomGoogleConnection(role: string | null | undefined): boolean {
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    return [
      'admin',
      'super_admin',
      'director',
      'producer',
      'production_manager',
      'content_producer',
    ].includes(normalizedRole);
  }

  function isRoleRoomGoogleEnvBootstrapEnabled(): boolean {
    const explicit = readStringValue(process.env.ROLE_ROOM_GOOGLE_ALLOW_ENV_BOOTSTRAP);
    if (explicit === '1' || explicit?.toLowerCase() === 'true') {
      return true;
    }
    if (explicit === '0' || explicit?.toLowerCase() === 'false') {
      return false;
    }
    return isRoleRoomDevBypassEnabled();
  }

  function shouldForceRoleRoomGoogleAccessTokenRefresh(expiryDate?: number | null): boolean {
    return !Number.isFinite(expiryDate) || Number(expiryDate) <= Date.now() + 60_000;
  }

  async function bootstrapRoleRoomGoogleConnectionFromEnv(req: Request, userId: string): Promise<RoleRoomGoogleConnectionRow | null> {
    if (!isRoleRoomGoogleEnvBootstrapEnabled()) {
      return null;
    }

    const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
    if (!canBootstrapRoleRoomGoogleConnection(requestUser?.role)) {
      return null;
    }

    const refreshToken = readStringValue(process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN);
    const oauthClient = createRoleRoomGoogleOAuthClient();
    if (!refreshToken || !oauthClient) {
      return null;
    }

    oauthClient.setCredentials({
      refresh_token: refreshToken,
    });

    try {
      await oauthClient.getAccessToken();
      const oauth2Api = google.oauth2({ version: 'v2', auth: oauthClient });
      const profileResponse = await oauth2Api.userinfo.get();
      const googleEmail = readStringValue(profileResponse.data.email)
        ?? readStringValue(process.env.GOOGLE_WORKSPACE_EMAIL)
        ?? readStringValue(process.env.GOOGLE_ADMIN_EMAIL)
        ?? readStringValue(process.env.GOOGLE_IMPERSONATE_USER);
      const googleSubject = readStringValue(profileResponse.data.id)
        ?? (googleEmail ? `env-bootstrap:${googleEmail}` : null);

      if (!googleEmail || !googleSubject) {
        return null;
      }

      const existingSubjectConnection = await getRoleRoomGoogleConnectionBySubject(googleSubject);
      if (existingSubjectConnection && existingSubjectConnection.user_id !== userId) {
        return null;
      }

      const rawScopes = oauthClient.credentials.scope;
      const scopes = Array.isArray(rawScopes)
        ? readStringArray(rawScopes)
        : typeof rawScopes === 'string' && rawScopes.trim().length > 0
          ? rawScopes.split(' ').filter((entry) => entry.trim().length > 0)
          : [...ROLE_ROOM_GOOGLE_SCOPES];

      return await upsertRoleRoomGoogleConnection(
        userId,
        requestUser?.email ?? null,
        {
          email: googleEmail,
          subject: googleSubject,
          profile: readJsonObject({
            id: profileResponse.data.id ?? googleSubject,
            email: profileResponse.data.email ?? googleEmail,
            verified_email: profileResponse.data.verified_email ?? null,
            name: profileResponse.data.name ?? googleEmail,
            given_name: profileResponse.data.given_name ?? null,
            family_name: profileResponse.data.family_name ?? null,
            picture: profileResponse.data.picture ?? null,
            source: 'env_refresh_token',
          }),
        },
        {
          accessToken: readStringValue(oauthClient.credentials.access_token),
          refreshToken,
          expiryDate: typeof oauthClient.credentials.expiry_date === 'number'
            ? oauthClient.credentials.expiry_date
            : null,
          scopes,
        },
      );
    } catch (error) {
      console.warn('Role Room Google env bootstrap failed:', error);
      return null;
    }
  }

  async function ensureRoleRoomGoogleConnectionForRequest(req: Request, userId: string): Promise<RoleRoomGoogleConnectionRow | null> {
    const existingConnection = await getRoleRoomGoogleConnectionByUserId(userId);
    if (existingConnection) {
      return existingConnection;
    }
    return bootstrapRoleRoomGoogleConnectionFromEnv(req, userId);
  }

  async function buildAuthorizedRoleRoomGoogleClient(req: Request, userId: string) {
    const connection = await ensureRoleRoomGoogleConnectionForRequest(req, userId);
    const oauthClient = createRoleRoomGoogleOAuthClient(req);
    if (!connection || !oauthClient) {
      return null;
    }

    const accessToken = decryptRoleRoomGoogleToken(connection.access_token_encrypted);
    const refreshToken = decryptRoleRoomGoogleToken(connection.refresh_token_encrypted);
    oauthClient.setCredentials({
      access_token: accessToken ?? undefined,
      refresh_token: refreshToken ?? undefined,
      expiry_date: connection.expiry_date ? Date.parse(connection.expiry_date) : undefined,
    });

    try {
      const expiryTimestamp = connection.expiry_date ? Date.parse(connection.expiry_date) : NaN;
      if (refreshToken && shouldForceRoleRoomGoogleAccessTokenRefresh(expiryTimestamp)) {
        oauthClient.setCredentials({ refresh_token: refreshToken });
        // Slice 9X.80 — wrapper markerer needs_reauth ved invalid_grant
        const { refreshAccessTokenWithStateTracking } = await import('./google-oauth-shared.js');
        await refreshAccessTokenWithStateTracking(oauthClient, {
          pool,
          userId: connection.user_id,
          context: 'role_room_routes_refresh',
        });
      } else {
        await oauthClient.getAccessToken();
      }
      const nextAccessToken = readStringValue(oauthClient.credentials.access_token);
      const nextRefreshToken = readStringValue(oauthClient.credentials.refresh_token) ?? refreshToken;
      const nextExpiryDate = typeof oauthClient.credentials.expiry_date === 'number'
        ? new Date(oauthClient.credentials.expiry_date).toISOString()
        : connection.expiry_date;

      await pool.query(
        `UPDATE role_room_google_connections
         SET access_token_encrypted = $2,
             refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
             expiry_date = $4,
             connection_state = 'connected',
             last_error = NULL,
             last_used_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1`,
        [
          userId,
          nextAccessToken ? encryptRoleRoomGoogleToken(nextAccessToken) : connection.access_token_encrypted,
          nextRefreshToken ? encryptRoleRoomGoogleToken(nextRefreshToken) : null,
          nextExpiryDate,
        ],
      );
    } catch (error) {
      const normalizedError = normalizeRoleRoomGoogleAuthError(error);
      await pool.query(
        `UPDATE role_room_google_connections
         SET connection_state = $2,
             last_error = $3,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, normalizedError.state, normalizedError.message],
      ).catch(() => undefined);
      throw new RoleRoomGoogleAuthError(normalizedError.message);
    }

    return { oauthClient, connection };
  }

  async function readLegacyProjectMetadata(projectId: string): Promise<Record<string, unknown>> {
    try {
      const result = await pool.query(
        `SELECT metadata FROM legacy.projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      if (!result.rowCount || result.rowCount === 0) {
        return {};
      }
      return readJsonObject(result.rows[0]?.metadata);
    } catch {
      return {};
    }
  }

  async function readLegacyProjectFiles(projectId: string): Promise<Record<string, unknown>[]> {
    const metadata = await readLegacyProjectMetadata(projectId);
    return Array.isArray(metadata.files)
      ? metadata.files.filter((entry): entry is Record<string, unknown> => isRecordValue(entry))
      : [];
  }

  async function upsertRoleRoomGoogleArtifact(
    projectId: string,
    payload: {
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
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
    },
  ): Promise<RoleRoomGoogleArtifactRow> {
    const result = await pool.query<RoleRoomGoogleArtifactRow>(
      `INSERT INTO role_room_google_artifacts (
        id, project_id, local_entity_type, local_entity_id, artifact_type,
        source_label, drive_file_id, calendar_event_id, meet_url, web_view_url,
        web_content_link, mime_type, folder_key, sync_status, metadata, created_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15::jsonb, $16,
        NOW(), NOW()
      )
      ON CONFLICT (project_id, local_entity_type, local_entity_id, artifact_type)
      DO UPDATE SET
        source_label = EXCLUDED.source_label,
        drive_file_id = COALESCE(EXCLUDED.drive_file_id, role_room_google_artifacts.drive_file_id),
        calendar_event_id = COALESCE(EXCLUDED.calendar_event_id, role_room_google_artifacts.calendar_event_id),
        meet_url = COALESCE(EXCLUDED.meet_url, role_room_google_artifacts.meet_url),
        web_view_url = COALESCE(EXCLUDED.web_view_url, role_room_google_artifacts.web_view_url),
        web_content_link = COALESCE(EXCLUDED.web_content_link, role_room_google_artifacts.web_content_link),
        mime_type = COALESCE(EXCLUDED.mime_type, role_room_google_artifacts.mime_type),
        folder_key = COALESCE(EXCLUDED.folder_key, role_room_google_artifacts.folder_key),
        sync_status = COALESCE(EXCLUDED.sync_status, role_room_google_artifacts.sync_status),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        crypto.randomUUID(),
        projectId,
        payload.localEntityType,
        payload.localEntityId,
        payload.artifactType,
        payload.sourceLabel ?? null,
        payload.driveFileId ?? null,
        payload.calendarEventId ?? null,
        payload.meetUrl ?? null,
        payload.webViewUrl ?? null,
        payload.webContentLink ?? null,
        payload.mimeType ?? null,
        payload.folderKey ?? null,
        payload.syncStatus ?? 'synced',
        JSON.stringify(payload.metadata ?? {}),
        payload.createdBy ?? null,
      ],
    );
    return result.rows[0];
  }

  async function ensureRoleRoomGoogleDriveFolder(
    driveApi: ReturnType<typeof google.drive>,
    folderName: string,
    parentFolderId?: string | null,
  ): Promise<string> {
    const parentQuery = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
    const existing = await driveApi.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false${parentQuery}`,
      fields: 'files(id,name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existingId = existing.data.files?.[0]?.id;
    if (existingId) {
      return existingId;
    }
    const created = await driveApi.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    if (!created.data.id) {
      throw new Error(`Kunne ikke opprette Drive-mappen ${folderName}`);
    }
    return created.data.id;
  }

  async function ensureRoleRoomGoogleDriveLayout(
    driveApi: ReturnType<typeof google.drive>,
    projectName: string,
    rootFolderId?: string | null,
  ): Promise<{ rootFolderId: string; folderLayout: Record<string, string> }> {
    const resolvedRootFolderId = rootFolderId
      ?? await ensureRoleRoomGoogleDriveFolder(driveApi, `Role Room · ${projectName}`);
    const folderLayout: Record<string, string> = {};
    for (const folder of ROLE_ROOM_GOOGLE_DRIVE_FOLDERS) {
      folderLayout[folder.key] = await ensureRoleRoomGoogleDriveFolder(driveApi, folder.label, resolvedRootFolderId);
    }
    return {
      rootFolderId: resolvedRootFolderId,
      folderLayout,
    };
  }

  async function getRoleRoomGoogleConnectionBySubject(subject: string): Promise<RoleRoomGoogleConnectionRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomGoogleConnectionRow>(
      `SELECT *
       FROM role_room_google_connections
       WHERE google_subject = $1
         AND oauth_app = 'role_room'
       LIMIT 1`,
      [subject],
    );
    return result.rows[0] ?? null;
  }

  async function reassignRoleRoomGoogleConnectionOwner(
    connectionId: string,
    userId: string,
    roleRoomEmail: string | null,
  ): Promise<RoleRoomGoogleConnectionRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM role_room_google_connections
         WHERE user_id = $2
           AND oauth_app = 'role_room'
           AND id <> $1`,
        [connectionId, userId],
      );

      const result = await client.query<RoleRoomGoogleConnectionRow>(
        `UPDATE role_room_google_connections
         SET user_id = $2,
             role_room_email = $3,
             updated_at = NOW(),
             last_used_at = NOW()
         WHERE id = $1
           AND oauth_app = 'role_room'
         RETURNING *`,
        [connectionId, userId, roleRoomEmail],
      );
      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  function matchesExistingRoleRoomGoogleConnectionOwner(
    connection: RoleRoomGoogleConnectionRow,
    options: {
      userIds?: Array<string | null | undefined>;
      emails?: Array<string | null | undefined>;
    },
  ): boolean {
    const candidateUserIds = (options.userIds ?? [])
      .map((value) => readStringValue(value))
      .filter((value): value is string => Boolean(value));

    if (candidateUserIds.includes(connection.user_id)) {
      return true;
    }

    const candidateEmails = (options.emails ?? [])
      .map((value) => normalizeEmailValue(value))
      .filter((value): value is string => Boolean(value));

    if (candidateEmails.length === 0) {
      return false;
    }

    const existingEmails = [
      normalizeEmailValue(connection.role_room_email),
      normalizeEmailValue(connection.google_email),
    ].filter((value): value is string => Boolean(value));

    return existingEmails.some((email) => candidateEmails.includes(email));
  }

  async function getRoleRoomGoogleArtifactsByProject(projectId: string): Promise<RoleRoomGoogleArtifactRow[]> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return [];
    }
    const result = await pool.query<RoleRoomGoogleArtifactRow>(
      `SELECT * FROM role_room_google_artifacts WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId],
    );
    return result.rows;
  }

  function buildRoleRoomGoogleAgreementSignatureResponse(
    signature: RoleRoomGoogleAgreementSignatureRow,
  ) {
    const metadata = readJsonObject(signature.metadata);
    return {
      id: signature.id,
      projectId: signature.project_id,
      agreementId: signature.agreement_id,
      provider: 'google_workspace' as const,
      status: signature.status ?? 'not_started',
      documentTitle: readStringValue(signature.document_title),
      driveSourceFileId: readStringValue(signature.drive_source_file_id),
      signedDriveFileId: readStringValue(signature.signed_drive_file_id),
      auditArtifactId: readStringValue(signature.audit_artifact_id),
      sourceArtifactId: readStringValue(metadata.sourceArtifactId),
      pdfSnapshotArtifactId: readStringValue(metadata.pdfSnapshotArtifactId),
      signedPdfArtifactId: readStringValue(metadata.signedPdfArtifactId),
      requestUrl: readStringValue(signature.request_url),
      webViewUrl: readStringValue(signature.web_view_url),
      requestedBy: readStringValue(signature.requested_by),
      requestedByEmail: readStringValue(signature.requested_by_email),
      counterpartyName: readStringValue(signature.counterparty_name),
      counterpartyEmail: readStringValue(signature.counterparty_email),
      preparedAt: signature.prepared_at,
      sentAt: signature.sent_at,
      signedAt: signature.signed_at,
      declinedAt: signature.declined_at,
      lastOpenedAt: signature.last_opened_at,
      lastSyncedAt: signature.last_synced_at,
      signatureHash: readStringValue(signature.signature_hash),
      metadata,
      createdAt: signature.created_at,
      updatedAt: signature.updated_at,
    };
  }

  async function getRoleRoomGoogleAgreementSignatureByAgreementId(
    projectId: string,
    agreementId: string,
  ): Promise<RoleRoomGoogleAgreementSignatureRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomGoogleAgreementSignatureRow>(
      `SELECT * FROM role_room_google_agreement_signatures
       WHERE project_id = $1 AND agreement_id = $2
       LIMIT 1`,
      [projectId, agreementId],
    );
    return result.rows[0] ?? null;
  }

  async function getRoleRoomGoogleAgreementSignaturesByProject(
    projectId: string,
  ): Promise<RoleRoomGoogleAgreementSignatureRow[]> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return [];
    }
    const result = await pool.query<RoleRoomGoogleAgreementSignatureRow>(
      `SELECT * FROM role_room_google_agreement_signatures
       WHERE project_id = $1
       ORDER BY updated_at DESC, created_at DESC`,
      [projectId],
    );
    return result.rows;
  }

  async function upsertRoleRoomGoogleAgreementSignature(
    projectId: string,
    agreementId: string,
    payload: {
      status?: RoleRoomGoogleAgreementSignatureStatus;
      documentTitle?: string | null;
      driveSourceFileId?: string | null;
      signedDriveFileId?: string | null;
      auditArtifactId?: string | null;
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
      metadata?: Record<string, unknown>;
    },
  ): Promise<RoleRoomGoogleAgreementSignatureRow> {
    if (!(await ensureRoleRoomGoogleTables())) {
      throw new Error('Role Room Google tables unavailable');
    }

    const existing = await getRoleRoomGoogleAgreementSignatureByAgreementId(projectId, agreementId);
    const nextMetadata = {
      ...(existing?.metadata ?? {}),
      ...(payload.metadata ?? {}),
    };

    const result = await pool.query<RoleRoomGoogleAgreementSignatureRow>(
      `INSERT INTO role_room_google_agreement_signatures (
        id, project_id, agreement_id, provider, status, document_title,
        drive_source_file_id, signed_drive_file_id, audit_artifact_id,
        request_url, web_view_url, requested_by, requested_by_email,
        counterparty_name, counterparty_email,
        prepared_at, sent_at, signed_at, declined_at, last_opened_at, last_synced_at,
        signature_hash, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'google_workspace', $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22::jsonb, NOW(), NOW()
      )
      ON CONFLICT (project_id, agreement_id) DO UPDATE SET
        status = COALESCE(EXCLUDED.status, role_room_google_agreement_signatures.status),
        document_title = COALESCE(EXCLUDED.document_title, role_room_google_agreement_signatures.document_title),
        drive_source_file_id = COALESCE(EXCLUDED.drive_source_file_id, role_room_google_agreement_signatures.drive_source_file_id),
        signed_drive_file_id = COALESCE(EXCLUDED.signed_drive_file_id, role_room_google_agreement_signatures.signed_drive_file_id),
        audit_artifact_id = COALESCE(EXCLUDED.audit_artifact_id, role_room_google_agreement_signatures.audit_artifact_id),
        request_url = COALESCE(EXCLUDED.request_url, role_room_google_agreement_signatures.request_url),
        web_view_url = COALESCE(EXCLUDED.web_view_url, role_room_google_agreement_signatures.web_view_url),
        requested_by = COALESCE(EXCLUDED.requested_by, role_room_google_agreement_signatures.requested_by),
        requested_by_email = COALESCE(EXCLUDED.requested_by_email, role_room_google_agreement_signatures.requested_by_email),
        counterparty_name = COALESCE(EXCLUDED.counterparty_name, role_room_google_agreement_signatures.counterparty_name),
        counterparty_email = COALESCE(EXCLUDED.counterparty_email, role_room_google_agreement_signatures.counterparty_email),
        prepared_at = COALESCE(EXCLUDED.prepared_at, role_room_google_agreement_signatures.prepared_at),
        sent_at = COALESCE(EXCLUDED.sent_at, role_room_google_agreement_signatures.sent_at),
        signed_at = COALESCE(EXCLUDED.signed_at, role_room_google_agreement_signatures.signed_at),
        declined_at = COALESCE(EXCLUDED.declined_at, role_room_google_agreement_signatures.declined_at),
        last_opened_at = COALESCE(EXCLUDED.last_opened_at, role_room_google_agreement_signatures.last_opened_at),
        last_synced_at = COALESCE(EXCLUDED.last_synced_at, role_room_google_agreement_signatures.last_synced_at),
        signature_hash = COALESCE(EXCLUDED.signature_hash, role_room_google_agreement_signatures.signature_hash),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        existing?.id ?? crypto.randomUUID(),
        projectId,
        agreementId,
        payload.status ?? existing?.status ?? 'not_started',
        payload.documentTitle ?? existing?.document_title ?? null,
        payload.driveSourceFileId ?? existing?.drive_source_file_id ?? null,
        payload.signedDriveFileId ?? existing?.signed_drive_file_id ?? null,
        payload.auditArtifactId ?? existing?.audit_artifact_id ?? null,
        payload.requestUrl ?? existing?.request_url ?? null,
        payload.webViewUrl ?? existing?.web_view_url ?? null,
        payload.requestedBy ?? existing?.requested_by ?? null,
        payload.requestedByEmail ?? existing?.requested_by_email ?? null,
        payload.counterpartyName ?? existing?.counterparty_name ?? null,
        payload.counterpartyEmail ?? existing?.counterparty_email ?? null,
        payload.preparedAt ?? existing?.prepared_at ?? null,
        payload.sentAt ?? existing?.sent_at ?? null,
        payload.signedAt ?? existing?.signed_at ?? null,
        payload.declinedAt ?? existing?.declined_at ?? null,
        payload.lastOpenedAt ?? existing?.last_opened_at ?? null,
        payload.lastSyncedAt ?? existing?.last_synced_at ?? null,
        payload.signatureHash ?? existing?.signature_hash ?? null,
        JSON.stringify(nextMetadata),
      ],
    );
    return result.rows[0];
  }

  async function readLegacyProjectAgreements(projectId: string): Promise<Record<string, unknown>[]> {
    const stored = await compatStoreGet<Record<string, unknown>[]>(legacyProjectAgreementsKey(projectId));
    return Array.isArray(stored)
      ? stored.filter((entry): entry is Record<string, unknown> => isRecordValue(entry))
      : [];
  }

  async function writeLegacyProjectAgreements(projectId: string, agreements: Record<string, unknown>[]): Promise<void> {
    await compatStoreSet(legacyProjectAgreementsKey(projectId), agreements);
  }

  async function updateLegacyProjectAgreement(
    projectId: string,
    agreementId: string,
    updater: (agreement: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const agreements = await readLegacyProjectAgreements(projectId);
    let updatedAgreement: Record<string, unknown> | null = null;
    const nextAgreements = agreements.map((agreement) => {
      if (readStringValue(agreement.id) !== agreementId) {
        return agreement;
      }
      updatedAgreement = updater(agreement);
      return updatedAgreement;
    });
    if (!updatedAgreement) {
      return null;
    }
    await writeLegacyProjectAgreements(projectId, nextAgreements);
    return updatedAgreement;
  }

  function serializeRoleRoomAgreementDocument(agreement: Record<string, unknown>): string {
    const sections = Array.isArray(agreement.sections)
      ? agreement.sections.filter((section): section is Record<string, unknown> => isRecordValue(section))
      : [];
    const parts = [
      readStringValue(agreement.title) ?? 'Prosjektavtale',
      '',
      `Avtaletype: ${readStringValue(agreement.agreement_type) ?? 'ukjent'}`,
      `Motpart: ${readStringValue(agreement.counterparty_name) ?? 'ukjent'}`,
      `Selskap: ${readStringValue(agreement.counterparty_company_name) ?? 'ikke oppgitt'}`,
      `E-post: ${readStringValue(agreement.counterparty_email) ?? 'ikke oppgitt'}`,
      '',
      `Formål: ${readStringValue(agreement.purpose) ?? 'ikke oppgitt'}`,
      '',
    ];

    for (const section of sections) {
      parts.push(readStringValue(section.heading) ?? 'Paragraf');
      parts.push(readStringValue(section.body) ?? '');
      parts.push('');
    }

    return parts.join('\n').trim();
  }

  async function createRoleRoomGoogleAgreementDocument(
    docsApi: ReturnType<typeof google.docs>,
    driveApi: ReturnType<typeof google.drive>,
    agreement: Record<string, unknown>,
    parentFolderId: string,
  ): Promise<{ fileId: string; webViewUrl: string | null; webContentLink: string | null; mimeType: string | null }> {
    const title = readStringValue(agreement.title) ?? 'Prosjektavtale';
    const createdDocument = await docsApi.documents.create({
      requestBody: {
        title,
      },
    });
    const fileId = readStringValue(createdDocument.data.documentId);
    if (!fileId) {
      throw new Error('Kunne ikke opprette Google-dokument for avtalen');
    }

    const documentText = serializeRoleRoomAgreementDocument(agreement);
    await docsApi.documents.batchUpdate({
      documentId: fileId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: documentText,
            },
          },
        ],
      },
    });

    const currentFile = await driveApi.files.get({
      fileId,
      fields: 'parents',
      supportsAllDrives: true,
    });
    const previousParents = readStringArray(currentFile.data.parents).join(',');
    const movedFile = await driveApi.files.update({
      fileId,
      addParents: parentFolderId,
      removeParents: previousParents || undefined,
      fields: 'id,webViewLink,webContentLink,mimeType',
      supportsAllDrives: true,
    });

    return {
      fileId,
      webViewUrl: readStringValue(movedFile.data.webViewLink),
      webContentLink: readStringValue(movedFile.data.webContentLink),
      mimeType: readStringValue(movedFile.data.mimeType),
    };
  }

  function toRoleRoomGoogleDownloadBuffer(payload: unknown): Buffer {
    if (Buffer.isBuffer(payload)) {
      return payload;
    }
    if (payload instanceof ArrayBuffer) {
      return Buffer.from(payload);
    }
    if (ArrayBuffer.isView(payload)) {
      return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    }
    if (typeof payload === 'string') {
      return Buffer.from(payload, 'utf8');
    }
    throw new Error('Ukjent Google-nedlastingsformat');
  }

  function toRoleRoomGoogleUploadBody(payload: Buffer | Uint8Array | string): Readable {
    return Readable.from(payload);
  }

  async function getRoleRoomGoogleArtifactByType(
    projectId: string,
    localEntityType: string,
    localEntityId: string,
    artifactType: string,
  ): Promise<RoleRoomGoogleArtifactRow | null> {
    if (!(await ensureRoleRoomGoogleTables())) {
      return null;
    }
    const result = await pool.query<RoleRoomGoogleArtifactRow>(
      `SELECT * FROM role_room_google_artifacts
       WHERE project_id = $1
         AND local_entity_type = $2
         AND local_entity_id = $3
         AND artifact_type = $4
       LIMIT 1`,
      [projectId, localEntityType, localEntityId, artifactType],
    );
    return result.rows[0] ?? null;
  }

  async function exportRoleRoomGoogleAgreementPdfArtifact(
    driveApi: ReturnType<typeof google.drive>,
    projectId: string,
    agreement: Record<string, unknown>,
    sourceFileId: string,
    parentFolderId: string,
    artifactType: 'google_signature_pdf_snapshot' | 'google_signature_signed_pdf',
    createdBy: string,
  ): Promise<RoleRoomGoogleArtifactRow> {
    const agreementId = readStringValue(agreement.id);
    if (!agreementId) {
      throw new Error('Avtalen mangler id for PDF-eksport');
    }

    const pdfResponse = await driveApi.files.export(
      {
        fileId: sourceFileId,
        mimeType: 'application/pdf',
      },
      {
        responseType: 'arraybuffer',
      },
    );
    const pdfBuffer = toRoleRoomGoogleDownloadBuffer(pdfResponse.data);
    const title = readStringValue(agreement.title) ?? 'Prosjektavtale';
    const suffix = artifactType === 'google_signature_signed_pdf' ? 'signert' : 'grunnlag';
    const fileName = `${title} · ${suffix}.pdf`;
    const existingArtifact = await getRoleRoomGoogleArtifactByType(
      projectId,
      'project_agreement',
      agreementId,
      artifactType,
    );
    const driveResponse = existingArtifact?.drive_file_id
      ? await driveApi.files.update({
          fileId: existingArtifact.drive_file_id,
          requestBody: { name: fileName },
          media: { mimeType: 'application/pdf', body: toRoleRoomGoogleUploadBody(pdfBuffer) },
          fields: 'id,webViewLink,webContentLink,mimeType',
          supportsAllDrives: true,
        })
      : await driveApi.files.create({
          requestBody: {
            name: fileName,
            parents: [parentFolderId],
          },
          media: { mimeType: 'application/pdf', body: toRoleRoomGoogleUploadBody(pdfBuffer) },
          fields: 'id,webViewLink,webContentLink,mimeType',
          supportsAllDrives: true,
        });

    return upsertRoleRoomGoogleArtifact(projectId, {
      localEntityType: 'project_agreement',
      localEntityId: agreementId,
      artifactType,
      sourceLabel: artifactType,
      driveFileId: readStringValue(driveResponse.data.id),
      webViewUrl: readStringValue(driveResponse.data.webViewLink),
      webContentLink: readStringValue(driveResponse.data.webContentLink),
      mimeType: readStringValue(driveResponse.data.mimeType) ?? 'application/pdf',
      folderKey: 'approvals',
      syncStatus: 'synced',
      metadata: {
        agreementTitle: title,
        artifactKind: suffix,
      },
      createdBy,
    });
  }

  async function shareRoleRoomGoogleAgreementSourceFile(
    driveApi: ReturnType<typeof google.drive>,
    fileId: string,
    counterpartyEmail: string,
  ): Promise<void> {
    try {
      await driveApi.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role: 'reader',
          emailAddress: counterpartyEmail,
        },
        sendNotificationEmail: true,
        supportsAllDrives: true,
        fields: 'id',
      });
    } catch (error) {
      const apiError = isRecordValue(error) ? error : null;
      const nestedResponse = apiError && isRecordValue(apiError.response) ? apiError.response : null;
      const errorCode = apiError && typeof apiError.code === 'number'
        ? apiError.code
        : nestedResponse && typeof nestedResponse.status === 'number'
          ? nestedResponse.status
          : null;
      if (errorCode === 409) {
        return;
      }
      throw error;
    }
  }

  async function syncRoleRoomGoogleDriveArtifactFromGoogle(
    driveApi: ReturnType<typeof google.drive>,
    payload: {
      projectId: string;
      localEntityType: string;
      localEntityId: string;
      artifactType: string;
      driveFileId?: string | null;
      sourceLabel?: string | null;
      folderKey?: string | null;
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
    },
  ): Promise<RoleRoomGoogleArtifactRow | null> {
    const driveFileId = readStringValue(payload.driveFileId);
    if (!driveFileId) {
      return null;
    }

    const existingArtifact = await getRoleRoomGoogleArtifactByType(
      payload.projectId,
      payload.localEntityType,
      payload.localEntityId,
      payload.artifactType,
    );
    const nextMetadata = {
      ...(existingArtifact ? readJsonObject(existingArtifact.metadata) : {}),
      ...(payload.metadata ?? {}),
    };
    const syncedAt = new Date().toISOString();

    try {
      const fileResponse = await driveApi.files.get({
        fileId: driveFileId,
        fields: 'id,name,webViewLink,webContentLink,mimeType,modifiedTime,trashed',
        supportsAllDrives: true,
      });

      return upsertRoleRoomGoogleArtifact(payload.projectId, {
        localEntityType: payload.localEntityType,
        localEntityId: payload.localEntityId,
        artifactType: payload.artifactType,
        sourceLabel: payload.sourceLabel ?? readStringValue(existingArtifact?.source_label),
        driveFileId: readStringValue(fileResponse.data.id) ?? driveFileId,
        webViewUrl: readStringValue(fileResponse.data.webViewLink),
        webContentLink: readStringValue(fileResponse.data.webContentLink),
        mimeType: readStringValue(fileResponse.data.mimeType),
        folderKey: payload.folderKey ?? readStringValue(existingArtifact?.folder_key),
        syncStatus: readBooleanValue(fileResponse.data.trashed) ? 'trashed' : 'synced',
        metadata: {
          ...nextMetadata,
          driveFileName: readStringValue(fileResponse.data.name),
          driveModifiedTime: readStringValue(fileResponse.data.modifiedTime),
          syncedFromGoogleAt: syncedAt,
          trashed: readBooleanValue(fileResponse.data.trashed),
          lastSyncError: null,
        },
        createdBy: payload.createdBy ?? readStringValue(existingArtifact?.created_by),
      });
    } catch (error) {
      const apiError = isRecordValue(error) ? error : null;
      const nestedResponse = apiError && isRecordValue(apiError.response) ? apiError.response : null;
      const errorCode = apiError && typeof apiError.code === 'number'
        ? apiError.code
        : nestedResponse && typeof nestedResponse.status === 'number'
          ? nestedResponse.status
          : null;
      const syncStatus = errorCode === 404 ? 'missing' : 'error';

      return upsertRoleRoomGoogleArtifact(payload.projectId, {
        localEntityType: payload.localEntityType,
        localEntityId: payload.localEntityId,
        artifactType: payload.artifactType,
        sourceLabel: payload.sourceLabel ?? readStringValue(existingArtifact?.source_label),
        driveFileId,
        webViewUrl: readStringValue(existingArtifact?.web_view_url),
        webContentLink: readStringValue(existingArtifact?.web_content_link),
        mimeType: readStringValue(existingArtifact?.mime_type),
        folderKey: payload.folderKey ?? readStringValue(existingArtifact?.folder_key),
        syncStatus,
        metadata: {
          ...nextMetadata,
          syncedFromGoogleAt: syncedAt,
          lastSyncError: error instanceof Error ? error.message : 'Google Drive sync failed',
          lastSyncErrorCode: errorCode,
        },
        createdBy: payload.createdBy ?? readStringValue(existingArtifact?.created_by),
      });
    }
  }

  function getAgreementStatusFromGoogleSignature(
    signatureStatus: RoleRoomGoogleAgreementSignatureStatus,
  ): 'draft' | 'sent' | 'signed' {
    if (signatureStatus === 'signed') {
      return 'signed';
    }
    if (signatureStatus === 'prepared' || signatureStatus === 'not_started') {
      return 'draft';
    }
    return 'sent';
  }

  function buildAgreementSignatureMetadataSnapshot(
    signature: RoleRoomGoogleAgreementSignatureRow,
  ): Record<string, unknown> {
    const metadata = readJsonObject(signature.metadata);
    return {
      googleSignatureId: signature.id,
      googleSignatureStatus: signature.status ?? 'not_started',
      googleSignatureDriveFileId: readStringValue(signature.drive_source_file_id),
      googleSignatureSignedDriveFileId: readStringValue(signature.signed_drive_file_id),
      googleSignatureAuditArtifactId: readStringValue(signature.audit_artifact_id),
      googleSignatureSourceArtifactId: readStringValue(metadata.sourceArtifactId),
      googleSignaturePdfSnapshotArtifactId: readStringValue(metadata.pdfSnapshotArtifactId),
      googleSignatureSignedPdfArtifactId: readStringValue(metadata.signedPdfArtifactId),
      googleSignatureRequestUrl: readStringValue(signature.request_url),
      googleSignatureWebViewUrl: readStringValue(signature.web_view_url),
      googleSignatureSignedAt: signature.signed_at,
      googleSignatureLastSyncedAt: signature.last_synced_at,
    };
  }

  async function syncAgreementSignatureSnapshot(
    projectId: string,
    agreementId: string,
    signature: RoleRoomGoogleAgreementSignatureRow,
  ): Promise<Record<string, unknown> | null> {
    return updateLegacyProjectAgreement(projectId, agreementId, (agreement) => {
      const metadata = readJsonObject(agreement.metadata);
      const nextMetadata = {
        ...metadata,
        ...buildAgreementSignatureMetadataSnapshot(signature),
      };
      return {
        ...agreement,
        status: getAgreementStatusFromGoogleSignature(signature.status ?? 'not_started'),
        signed_date: signature.status === 'signed' ? signature.signed_at ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        metadata: nextMetadata,
        google_signature: buildRoleRoomGoogleAgreementSignatureResponse(signature),
      };
    });
  }

  async function updateRoleRoomGoogleProjectBinding(
    projectId: string,
    payload: {
      connectedUserId?: string | null;
      driveRootFolderId?: string | null;
      calendarId?: string | null;
      contactsContext?: Record<string, unknown>;
      meetCreationEnabled?: boolean | null;
      auditSignatureStorageEnabled?: boolean | null;
      folderLayout?: Record<string, unknown>;
      syncStatus?: Record<string, unknown>;
      lastDriveSyncAt?: string | null;
      lastCalendarSyncAt?: string | null;
    },
  ): Promise<RoleRoomGoogleProjectBindingRow> {
    if (!(await ensureRoleRoomGoogleTables())) {
      throw new Error('Role Room Google tables unavailable');
    }

    const existing = await getRoleRoomGoogleProjectBinding(projectId);
    const nextContactsContext = {
      ...(existing?.contacts_context ?? {}),
      ...(payload.contactsContext ?? {}),
    };
    const nextFolderLayout = {
      ...(existing?.folder_layout ?? {}),
      ...(payload.folderLayout ?? {}),
    };
    const nextSyncStatus = {
      ...(existing?.sync_status ?? {}),
      ...(payload.syncStatus ?? {}),
    };

    const result = await pool.query<RoleRoomGoogleProjectBindingRow>(
      `INSERT INTO role_room_google_project_bindings (
        id, project_id, connected_user_id, drive_root_folder_id, calendar_id,
        contacts_context, meet_creation_enabled, audit_signature_storage_enabled,
        folder_layout, sync_status, created_at, updated_at, last_drive_sync_at, last_calendar_sync_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7, $8,
        $9::jsonb, $10::jsonb, NOW(), NOW(), $11, $12
      )
      ON CONFLICT (project_id) DO UPDATE SET
        connected_user_id = COALESCE(EXCLUDED.connected_user_id, role_room_google_project_bindings.connected_user_id),
        drive_root_folder_id = COALESCE(EXCLUDED.drive_root_folder_id, role_room_google_project_bindings.drive_root_folder_id),
        calendar_id = COALESCE(EXCLUDED.calendar_id, role_room_google_project_bindings.calendar_id),
        contacts_context = EXCLUDED.contacts_context,
        meet_creation_enabled = COALESCE(EXCLUDED.meet_creation_enabled, role_room_google_project_bindings.meet_creation_enabled),
        audit_signature_storage_enabled = COALESCE(EXCLUDED.audit_signature_storage_enabled, role_room_google_project_bindings.audit_signature_storage_enabled),
        folder_layout = EXCLUDED.folder_layout,
        sync_status = EXCLUDED.sync_status,
        updated_at = NOW(),
        last_drive_sync_at = COALESCE(EXCLUDED.last_drive_sync_at, role_room_google_project_bindings.last_drive_sync_at),
        last_calendar_sync_at = COALESCE(EXCLUDED.last_calendar_sync_at, role_room_google_project_bindings.last_calendar_sync_at)
      RETURNING *`,
      [
        existing?.id ?? crypto.randomUUID(),
        projectId,
        payload.connectedUserId ?? existing?.connected_user_id ?? null,
        payload.driveRootFolderId ?? existing?.drive_root_folder_id ?? null,
        payload.calendarId ?? existing?.calendar_id ?? null,
        JSON.stringify(nextContactsContext),
        payload.meetCreationEnabled ?? existing?.meet_creation_enabled ?? true,
        payload.auditSignatureStorageEnabled ?? existing?.audit_signature_storage_enabled ?? true,
        JSON.stringify(nextFolderLayout),
        JSON.stringify(nextSyncStatus),
        payload.lastDriveSyncAt ?? existing?.last_drive_sync_at ?? null,
        payload.lastCalendarSyncAt ?? existing?.last_calendar_sync_at ?? null,
      ],
    );
    return result.rows[0];
  }

  async function readCastingProjectRow(projectId: string): Promise<CastingProjectRow | null> {
    if (!(await ensureCastingProjectsTable())) {
      return null;
    }
    const result = await pool.query<CastingProjectRow>(
      `SELECT * FROM casting_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    return result.rows[0] ?? null;
  }

  async function getRoleRoomProjectName(projectId: string): Promise<string> {
    const castingProject = await readCastingProjectRow(projectId);
    if (readStringValue(castingProject?.name)) {
      return readStringValue(castingProject?.name) ?? normalizeRoleRoomProjectName(projectId);
    }

    const legacyMetadata = await readLegacyProjectMetadata(projectId);
    const fallbackName = readStringValue(legacyMetadata.title)
      ?? readStringValue(legacyMetadata.name)
      ?? readStringValue(legacyMetadata.projectName);
    return fallbackName ?? normalizeRoleRoomProjectName(projectId);
  }

  function normalizeRequestedCastingProjectId(value: unknown): string | null {
    const requestedId = readStringValue(value);
    if (!requestedId) {
      return null;
    }

    const normalized = requestedId.slice(0, 255);
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,254}$/.test(normalized) ? normalized : null;
  }

  function readRoleRoomArrayMetadata(value: unknown): unknown[] | null {
    return Array.isArray(value) ? value : null;
  }

  function readRoleRoomObjectMetadata(value: unknown): Record<string, unknown> | null {
    return readRecordValue(value);
  }

  function buildCastingProjectMetadataFromPayload(
    payload: Record<string, unknown>,
    existingMetadata: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const explicitMetadata = readJsonObject(payload.metadata);
    const metadata: Record<string, unknown> = {
      ...existingMetadata,
      ...explicitMetadata,
    };

    const stringFields = [
      'clientName',
      'clientEmail',
      'clientPhone',
      'clientCompanyName',
      'clientOrganizationNumber',
      'clientCompanyAddress',
      'eventDate',
      'location',
      'projectType',
      'guestCount',
      'projectOwnerName',
      'projectOwnerEmail',
      'projectOwnerPhone',
      'projectOwnerRole',
    ];

    for (const field of stringFields) {
      const value = readStringValue(payload[field]);
      if (value !== null) {
        metadata[field] = value;
      }
    }

    const socialProfiles = readRoleRoomArrayMetadata(payload.socialProfiles);
    if (socialProfiles) {
      metadata.socialProfiles = socialProfiles;
    }

    const collaborators = readRoleRoomArrayMetadata(payload.collaborators);
    if (collaborators) {
      metadata.collaborators = collaborators;
    }

    const competitorAnalysis = readRoleRoomObjectMetadata(payload.competitorAnalysis);
    if (competitorAnalysis) {
      metadata.competitorAnalysis = competitorAnalysis;
    }

    const localPresencePlan = readRoleRoomObjectMetadata(payload.localPresencePlan);
    if (localPresencePlan) {
      metadata.localPresencePlan = localPresencePlan;
    }

    const roleRoomAgentPrefill = readRoleRoomObjectMetadata(payload.roleRoomAgentPrefill);
    if (roleRoomAgentPrefill) {
      metadata.roleRoomAgentPrefill = roleRoomAgentPrefill;
    }

    const splitSheetData = readRoleRoomObjectMetadata(payload.splitSheetData);
    if (splitSheetData) {
      metadata.splitSheetData = splitSheetData;
    }

    const enableSplitSheet = readBooleanValue(payload.enableSplitSheet);
    if (enableSplitSheet !== null) {
      metadata.enableSplitSheet = enableSplitSheet;
    }

    metadata.roleRoomPersistence = {
      ...(readRoleRoomObjectMetadata(metadata.roleRoomPersistence) ?? {}),
      source: 'casting_projects.metadata',
      lastPersistedAt: new Date().toISOString(),
    };

    return metadata;
  }

  function buildCastingProjectResponse(
    row: CastingProjectRow,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const metadata = readJsonObject(row.metadata);
    return {
      ...row,
      ...extra,
      metadata,
      projectId: row.id,
      projectName: row.name,
      projectType: readStringValue(metadata.projectType) ?? row.project_type,
      clientName: readStringValue(metadata.clientName) ?? '',
      clientEmail: readStringValue(metadata.clientEmail) ?? '',
      clientPhone: readStringValue(metadata.clientPhone) ?? '',
      clientCompanyName: readStringValue(metadata.clientCompanyName) ?? '',
      clientOrganizationNumber: readStringValue(metadata.clientOrganizationNumber) ?? '',
      clientCompanyAddress: readStringValue(metadata.clientCompanyAddress) ?? '',
      eventDate: readStringValue(metadata.eventDate) ?? '',
      location: readStringValue(metadata.location) ?? '',
      guestCount: readStringValue(metadata.guestCount) ?? '',
      socialProfiles: readRoleRoomArrayMetadata(metadata.socialProfiles) ?? [],
      collaborators: readRoleRoomArrayMetadata(metadata.collaborators) ?? [],
      competitorAnalysis: readRoleRoomObjectMetadata(metadata.competitorAnalysis),
      localPresencePlan: readRoleRoomObjectMetadata(metadata.localPresencePlan),
      roleRoomAgentPrefill: readRoleRoomObjectMetadata(metadata.roleRoomAgentPrefill),
      splitSheetData: readRoleRoomObjectMetadata(metadata.splitSheetData),
      enableSplitSheet: readBooleanValue(metadata.enableSplitSheet) ?? false,
    };
  }

  function canAutoConfigureRoleRoomGoogleWorkspaceForRole(role: string | null | undefined): boolean {
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    return ['director', 'producer', 'production_manager', 'content_producer'].includes(normalizedRole);
  }

  async function ensureRoleRoomGoogleProjectBindingReady(
    projectId: string,
    userId: string,
    oauthClient: NonNullable<ReturnType<typeof createRoleRoomGoogleOAuthClient>>,
    payload: {
      driveRootFolderId?: string | null;
      calendarId?: string | null;
      contactsContext?: Record<string, unknown>;
      meetCreationEnabled?: boolean | null;
      auditSignatureStorageEnabled?: boolean | null;
      folderLayout?: Record<string, unknown>;
      createDriveLayout?: boolean | null;
      createCalendar?: boolean | null;
    } = {},
  ): Promise<RoleRoomGoogleProjectBindingRow> {
    const driveApi = google.drive({ version: 'v3', auth: oauthClient });
    const calendarApi = google.calendar({ version: 'v3', auth: oauthClient });
    const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
    const projectName = await getRoleRoomProjectName(projectId);

    const requestedDriveRootFolderId = readStringValue(payload.driveRootFolderId)
      ?? existingBinding?.drive_root_folder_id
      ?? null;
    const requestedCalendarId = readStringValue(payload.calendarId)
      ?? existingBinding?.calendar_id
      ?? null;
    const createDriveLayout = typeof payload.createDriveLayout === 'boolean'
      ? payload.createDriveLayout
      : !requestedDriveRootFolderId;
    const createCalendar = typeof payload.createCalendar === 'boolean'
      ? payload.createCalendar
      : !requestedCalendarId;

    let driveRootFolderId = requestedDriveRootFolderId;
    let folderLayout = {
      ...readJsonObject(existingBinding?.folder_layout),
      ...readJsonObject(payload.folderLayout),
    };

    if (!driveRootFolderId || createDriveLayout) {
      const driveLayout = await ensureRoleRoomGoogleDriveLayout(driveApi, projectName, driveRootFolderId);
      driveRootFolderId = driveLayout.rootFolderId;
      folderLayout = {
        ...folderLayout,
        ...driveLayout.folderLayout,
      };
    }

    const calendarId = createCalendar
      ? await resolveRoleRoomGoogleCalendarId(calendarApi, projectName, requestedCalendarId)
      : await resolveRoleRoomGoogleCalendarId(
          calendarApi,
          projectName,
          requestedCalendarId ?? existingBinding?.calendar_id,
        );

    return updateRoleRoomGoogleProjectBinding(projectId, {
      connectedUserId: userId,
      driveRootFolderId,
      calendarId,
      contactsContext: readJsonObject(payload.contactsContext),
      meetCreationEnabled: payload.meetCreationEnabled,
      auditSignatureStorageEnabled: payload.auditSignatureStorageEnabled,
      folderLayout,
      syncStatus: {
        ...readJsonObject(existingBinding?.sync_status),
        state: 'connected',
        lastConfiguredBy: userId,
        lastConfiguredAt: new Date().toISOString(),
      },
    });
  }

  type RoleRoomGoogleResolvedUser = {
    userId: string;
    email: string;
    name: string;
    role: string;
  };

  function isRoleRoomPlatformAdminRole(role: string | null | undefined): boolean {
    const normalizedRole = readStringValue(role)?.toLowerCase() ?? '';
    return normalizedRole === 'admin' || normalizedRole === 'super_admin';
  }

  async function findRoleRoomUserByEmail(email: string): Promise<RoleRoomGoogleResolvedUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, email, username, first_name, last_name, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail],
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return {
      userId: String(row.id),
      email: readStringValue(row.email) ?? normalizedEmail,
      name: [
        readStringValue(row.first_name),
        readStringValue(row.last_name),
      ].filter((value): value is string => Boolean(value)).join(' ')
        || readStringValue(row.username)
        || normalizedEmail.split('@')[0]
        || 'Role Room',
      role: readStringValue(row.role)?.toLowerCase() ?? 'user',
    };
  }

  async function ensureRoleRoomUserByEmail(email: string, profile?: Record<string, unknown>): Promise<RoleRoomGoogleResolvedUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await findRoleRoomUserByEmail(normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    const usernameBase = normalizedEmail
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
      || 'role-room-user';
    const inferredFirstName = readStringValue(profile?.given_name)
      ?? readStringValue(profile?.name)
      ?? usernameBase;
    const nextUsername = `${usernameBase}-${hashApiKey(normalizedEmail).slice(0, 6)}`;

    // Sikkerhetsfix (#4): tidligere brukte vi tom passord-streng for
    // Google-login-brukere. Hvis lokal-login noensinne hadde tolket tom
    // streng som match (eller bcrypt med tomme verdier hadde fungert),
    // ga det en account-takeover-vektor. Bruker en bcrypt-hashed random
    // 64-byte streng — bruker kan likevel ikke logge inn med passord
    // (de må bruke Google), men feltet er aldri tomt.
    const bcrypt = await import('bcrypt');
    const placeholderPassword = await bcrypt.default.hash(
      crypto.randomBytes(64).toString('base64'),
      10,
    );
    const inserted = await pool.query(
      `INSERT INTO users (email, username, first_name, role, password, created_at, updated_at)
       VALUES ($1, $2, $3, 'user', $4, NOW(), NOW())
       RETURNING id, email, username, first_name, last_name, role`,
      [normalizedEmail, nextUsername, inferredFirstName, placeholderPassword],
    );

    return {
      userId: String(inserted.rows[0].id),
      email: readStringValue(inserted.rows[0].email) ?? normalizedEmail,
      name: [
        readStringValue(inserted.rows[0].first_name),
        readStringValue(inserted.rows[0].last_name),
      ].filter((value): value is string => Boolean(value)).join(' ')
        || readStringValue(inserted.rows[0].username)
        || normalizedEmail.split('@')[0]
        || 'Role Room',
      role: readStringValue(inserted.rows[0].role)?.toLowerCase() ?? 'user',
    };
  }

  function resolveRoleRoomSessionRole(
    loginAs: string | null | undefined,
    requestedRole: string | null | undefined,
    fallbackRole: string,
  ): string {
    const normalizedLoginAs = readStringValue(loginAs)?.toLowerCase() ?? '';
    const normalizedRequestedRole = readStringValue(requestedRole)?.toLowerCase() ?? '';
    const normalizedFallbackRole = readStringValue(fallbackRole)?.toLowerCase() ?? 'user';

    if (normalizedLoginAs === 'content_producer') {
      return normalizedRequestedRole === 'client' || normalizedRequestedRole === 'client_reviewer'
        ? 'client_reviewer'
        : 'content_producer';
    }

    if (normalizedLoginAs === 'production_team') {
      return normalizedRequestedRole || normalizedFallbackRole;
    }

    if (normalizedRequestedRole) {
      if (normalizedRequestedRole === 'client') {
        return 'client_reviewer';
      }

      if (
        [
          'client_reviewer',
          'content_producer',
          'producer',
          'production_manager',
          'director',
        ].includes(normalizedRequestedRole)
      ) {
        return normalizedRequestedRole;
      }
    }

    return normalizedFallbackRole;
  }

  function isRoleRoomClientReviewerRole(
    role: string | null | undefined,
  ): boolean {
    const normalizedRole = readStringValue(role)?.toLowerCase() ?? '';
    return normalizedRole === 'client' || normalizedRole === 'client_reviewer';
  }

  function isRoleRoomCommercialGoogleLoginIntent(
    state: Pick<RoleRoomGoogleOauthState, 'loginAs' | 'requestedRole' | 'projectId'>,
  ): boolean {
    const normalizedLoginAs = readStringValue(state.loginAs)?.toLowerCase() ?? '';
    if (normalizedLoginAs === 'production_team') {
      return true;
    }

    if (normalizedLoginAs === 'content_producer') {
      if (state.projectId) {
        return false;
      }
      return !isRoleRoomClientReviewerRole(state.requestedRole);
    }

    return false;
  }

  function parseRoleRoomCommercialInviteActivation(
    value: unknown,
  ): {
    kind: 'role_room_commercial_access';
    activationStatus: 'pending_approval' | 'approved' | null;
    activationApprovedAt: string | null;
  } | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (readStringValue(parsed.kind) !== 'role_room_commercial_access') {
        return null;
      }

      const activationStatus = readStringValue(parsed.activationStatus);
      return {
        kind: 'role_room_commercial_access',
        activationStatus:
          activationStatus === 'pending_approval' || activationStatus === 'approved'
            ? activationStatus
            : null,
        activationApprovedAt: readStringValue(parsed.activationApprovedAt),
      };
    } catch {
      return null;
    }
  }

  async function getRoleRoomCommercialGoogleLoginGate(
    email: string,
    state: Pick<RoleRoomGoogleOauthState, 'loginAs' | 'requestedRole' | 'projectId'>,
  ): Promise<{
    required: boolean;
    allowed: boolean;
    reason: string | null;
  }> {
    if (!isRoleRoomCommercialGoogleLoginIntent(state)) {
      return {
        required: false,
        allowed: true,
        reason: null,
      };
    }

    const inviteResult = await pool.query(
      `SELECT *
       FROM invite_requests
       WHERE LOWER(email) = LOWER($1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    ).catch(() => ({ rows: [], rowCount: 0 }));
    const inviteRequest = inviteResult.rows[0] as Record<string, unknown> | undefined;
    const activation = parseRoleRoomCommercialInviteActivation(
      inviteRequest?.message,
    );

    if (!inviteRequest || !activation) {
      return {
        required: true,
        allowed: false,
        reason:
          'Kontoen din er ikke aktivert for The Role Room. Fullfør bestilling og kontogodkjenning først.',
      };
    }

    if (inviteRequest.payment_completed !== true) {
      return {
        required: true,
        allowed: false,
        reason:
          'Betalingen er ikke bekreftet ennå. Fullfør Stripe-betalingen før du logger inn.',
      };
    }

    if (
      activation.activationStatus !== 'approved' &&
      !activation.activationApprovedAt
    ) {
      return {
        required: true,
        allowed: false,
        reason:
          'Sjekk e-posten din og godkjenn kontoen før første innlogging i The Role Room.',
      };
    }

    return {
      required: true,
      allowed: true,
      reason: null,
    };
  }

  async function resolveRoleRoomGoogleLoginUser(
    googleEmail: string,
    googleProfile: Record<string, unknown>,
    state: RoleRoomGoogleOauthState,
  ): Promise<(RoleRoomGoogleResolvedUser & { autoAssignProjectRole?: string | null }) | null> {
    const normalizedEmail = googleEmail.trim().toLowerCase();
    const localUser = await findRoleRoomUserByEmail(normalizedEmail);
    if (localUser && isRoleRoomPlatformAdminRole(localUser.role)) {
      return {
        ...localUser,
        role: localUser.role,
      };
    }

    const commercialGate = await getRoleRoomCommercialGoogleLoginGate(
      normalizedEmail,
      state,
    );
    if (!commercialGate.allowed) {
      throw new Error(
        commercialGate.reason ||
          'Kontoen må godkjennes før du kan logge inn i The Role Room.',
      );
    }

    if (localUser) {
      return {
        ...localUser,
        role: resolveRoleRoomSessionRole(state.loginAs, state.requestedRole, localUser.role),
      };
    }

    if (commercialGate.required) {
      const ensuredUser = await ensureRoleRoomUserByEmail(normalizedEmail, {
        ...googleProfile,
        name: readStringValue(googleProfile.name),
      });

      return {
        ...ensuredUser,
        role: resolveRoleRoomSessionRole(
          state.loginAs,
          state.requestedRole,
          ensuredUser.role,
        ),
      };
    }

    const projectId = readStringValue(state.projectId);
    if (!projectId) {
      return null;
    }

    const scopedRoleResult = await pool.query(
      `SELECT role
       FROM casting_user_roles
       WHERE project_id = $1
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (
           LOWER(COALESCE(email, '')) = LOWER($2)
           OR LOWER(COALESCE(user_id, '')) = LOWER($2)
         )
       ORDER BY created_at ASC
       LIMIT 1`,
      [projectId, normalizedEmail],
    );

    const intakeResult = await pool.query(
      `SELECT contact_name
       FROM role_room_client_intake
       WHERE project_id = $1
         AND LOWER(COALESCE(contact_email, '')) = LOWER($2)
       LIMIT 1`,
      [projectId, normalizedEmail],
    ).catch(() => ({ rows: [], rowCount: 0 }));

    const legacyProjectResult = await pool.query(
      `SELECT client_name, client_email
       FROM legacy.projects
       WHERE id = $1
         AND LOWER(COALESCE(client_email, '')) = LOWER($2)
       LIMIT 1`,
      [projectId, normalizedEmail],
    ).catch(() => ({ rows: [], rowCount: 0 }));

    const castingProjectResult = await pool.query(
      `SELECT metadata
       FROM casting_projects
       WHERE id = $1
       LIMIT 1`,
      [projectId],
    );
    const castingMetadata = readJsonObject(castingProjectResult.rows[0]?.metadata);
    const metadataClientEmail = readStringValue(castingMetadata.clientEmail)
      ?? readStringValue(castingMetadata.client_email);

    const hasScopedAccess = Boolean(
      scopedRoleResult.rowCount
      || intakeResult.rowCount
      || legacyProjectResult.rowCount
      || (metadataClientEmail && metadataClientEmail.toLowerCase() === normalizedEmail),
    );

    if (!hasScopedAccess) {
      return null;
    }

    const ensuredUser = await ensureRoleRoomUserByEmail(normalizedEmail, {
      ...googleProfile,
      name: readStringValue(intakeResult.rows[0]?.contact_name)
        ?? readStringValue(legacyProjectResult.rows[0]?.client_name)
        ?? readStringValue(googleProfile.name),
    });

    return {
      ...ensuredUser,
      role: 'client_reviewer',
      autoAssignProjectRole: readStringValue(scopedRoleResult.rows[0]?.role)?.toLowerCase() ?? 'client_reviewer',
    };
  }

  async function ensureRoleRoomProjectRoleAssignment(
    projectId: string,
    userId: string,
    email: string,
    role: string,
    addedBy: string | null,
    options?: {
      expiresAt?: string | null;
    },
  ): Promise<void> {
    await pool.query(
      `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (project_id, user_id) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         permissions = EXCLUDED.permissions,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [
        crypto.randomUUID(),
        projectId,
        userId,
        email,
        role,
        JSON.stringify(buildProjectRolePermissions(role)),
        addedBy,
        readStringValue(options?.expiresAt),
      ],
    );
  }

  function buildRoleRoomGoogleConnectionResponse(
    connection: RoleRoomGoogleConnectionRow | null,
    config: ReturnType<typeof getRoleRoomGoogleConfig>,
  ) {
    if (!connection) {
      return {
        configured: config.configured,
        missing: config.missing,
        state: 'disconnected' as const,
        connection: null,
        oauthRefreshAlert: config.configured ? null : {
          severity: 'warning',
          message: 'Google Workspace mangler serverkonfigurasjon.',
        },
      };
    }
    const hasRefreshToken = Boolean(readStringValue(connection.refresh_token_encrypted));
    const expiryTimestamp = connection.expiry_date ? Date.parse(connection.expiry_date) : null;
    const accessTokenExpiresSoon = typeof expiryTimestamp === 'number'
      && Number.isFinite(expiryTimestamp)
      && expiryTimestamp <= Date.now() + 5 * 60 * 1000;
    const derivedState = connection.connection_state === 'connected'
      && accessTokenExpiresSoon
      && !hasRefreshToken
        ? 'expired'
        : (connection.connection_state ?? 'disconnected');
    const oauthRefreshAlert = derivedState === 'expired'
      ? {
        severity: 'warning',
        message: 'Google Workspace-tilgangen er utløpt eller utløper straks. Logg inn med Google på nytt.',
      }
      : connection.connection_state === 'error'
        ? {
          severity: 'error',
          message: readStringValue(connection.last_error) ?? 'Google Workspace svarte med feil. Forny koblingen.',
        }
        : !hasRefreshToken
          ? {
            severity: 'info',
            message: 'Google Workspace mangler refresh token. Forny SSO hvis Drive eller kalender stopper.',
          }
          : null;

    return {
      configured: config.configured,
      missing: config.missing,
      state: derivedState,
      oauthRefreshAlert,
      connection: {
        id: connection.id,
        userId: connection.user_id,
        roleRoomEmail: readStringValue(connection.role_room_email),
        googleEmail: readStringValue(connection.google_email),
        googleSubject: readStringValue(connection.google_subject),
        scopes: readStringArray(connection.scopes),
        state: derivedState,
        lastError: readStringValue(connection.last_error),
        profile: readJsonObject(connection.profile),
        expiryDate: connection.expiry_date,
        createdAt: connection.created_at,
        updatedAt: connection.updated_at,
        lastUsedAt: connection.last_used_at,
      },
    };
  }

  function buildRoleRoomLinkedInConnectionResponse(
    connection: RoleRoomLinkedInConnectionRow | null,
    config: ReturnType<typeof getRoleRoomLinkedInConfig>,
  ) {
    if (!connection) {
      return {
        configured: config.configured,
        missing: config.missing,
        state: 'disconnected' as const,
        connection: null,
      };
    }

    const expiryTimestamp = connection.expiry_date ? Date.parse(connection.expiry_date) : null;
    const derivedState = connection.connection_state === 'connected'
      && typeof expiryTimestamp === 'number'
      && Number.isFinite(expiryTimestamp)
      && expiryTimestamp <= Date.now()
        ? 'expired'
        : (connection.connection_state ?? 'disconnected');

    return {
      configured: config.configured,
      missing: config.missing,
      state: derivedState,
      connection: {
        id: connection.id,
        userId: connection.user_id,
        roleRoomEmail: readStringValue(connection.role_room_email),
        linkedInMemberId: readStringValue(connection.linkedin_member_id),
        linkedInEmail: readStringValue(connection.linkedin_email),
        linkedInName: readStringValue(connection.linkedin_name),
        scopes: readStringArray(connection.scopes),
        state: derivedState,
        lastError: readStringValue(connection.last_error),
        profile: readJsonObject(connection.profile),
        expiryDate: connection.expiry_date,
        createdAt: connection.created_at,
        updatedAt: connection.updated_at,
        lastUsedAt: connection.last_used_at,
      },
    };
  }

  function buildRoleRoomGoogleProjectBindingResponse(
    binding: RoleRoomGoogleProjectBindingRow | null,
    artifacts: RoleRoomGoogleArtifactRow[],
  ) {
    if (!binding) {
      return {
        binding: null,
        artifacts: [],
      };
    }

    return {
      binding: {
        id: binding.id,
        projectId: binding.project_id,
        connectedUserId: readStringValue(binding.connected_user_id),
        driveRootFolderId: readStringValue(binding.drive_root_folder_id),
        calendarId: readStringValue(binding.calendar_id),
        contactsContext: readJsonObject(binding.contacts_context),
        meetCreationEnabled: binding.meet_creation_enabled ?? true,
        auditSignatureStorageEnabled: binding.audit_signature_storage_enabled ?? true,
        folderLayout: readJsonObject(binding.folder_layout),
        syncStatus: readJsonObject(binding.sync_status),
        createdAt: binding.created_at,
        updatedAt: binding.updated_at,
        lastDriveSyncAt: binding.last_drive_sync_at,
        lastCalendarSyncAt: binding.last_calendar_sync_at,
      },
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        projectId: artifact.project_id,
        localEntityType: artifact.local_entity_type,
        localEntityId: artifact.local_entity_id,
        artifactType: artifact.artifact_type,
        sourceLabel: readStringValue(artifact.source_label),
        driveFileId: readStringValue(artifact.drive_file_id),
        calendarEventId: readStringValue(artifact.calendar_event_id),
        meetUrl: readStringValue(artifact.meet_url),
        webViewUrl: readStringValue(artifact.web_view_url),
        webContentLink: readStringValue(artifact.web_content_link),
        mimeType: readStringValue(artifact.mime_type),
        folderKey: readStringValue(artifact.folder_key),
        syncStatus: readStringValue(artifact.sync_status),
        metadata: readJsonObject(artifact.metadata),
        createdBy: readStringValue(artifact.created_by),
        createdAt: artifact.created_at,
        updatedAt: artifact.updated_at,
      })),
    };
  }

  function buildRoleRoomGoogleCalendarRecord(calendar: Record<string, unknown>) {
    return {
      id: readStringValue(calendar.id) ?? crypto.randomUUID(),
      summary: readStringValue(calendar.summary) ?? 'Uten navn',
      description: readStringValue(calendar.description),
      primary: readBooleanValue(calendar.primary) === true,
      accessRole: readStringValue(calendar.accessRole),
      backgroundColor: readStringValue(calendar.backgroundColor),
      foregroundColor: readStringValue(calendar.foregroundColor),
      timeZone: readStringValue(calendar.timeZone),
      selected: readBooleanValue(calendar.selected) === true,
      hidden: readBooleanValue(calendar.hidden) === true,
    };
  }

  function buildRoleRoomGoogleCalendarAclRecord(rule: Record<string, unknown>) {
    const scope = readJsonObject(rule.scope);
    const scopeType = readStringValue(scope.type) ?? 'default';
    const scopeValue = readStringValue(scope.value);
    const label = scopeType === 'user'
      ? scopeValue ?? 'Bruker'
      : scopeType === 'domain'
        ? scopeValue ?? 'Domene'
        : scopeType === 'default'
          ? 'Standard'
          : scopeType;

    return {
      id: readStringValue(rule.id) ?? crypto.randomUUID(),
      role: readStringValue(rule.role) ?? 'reader',
      scopeType,
      scopeValue,
      label,
    };
  }

  function buildRoleRoomGoogleCalendarEventSummary(event: Record<string, unknown>) {
    const start = readJsonObject(event.start);
    const end = readJsonObject(event.end);
    return {
      id: readStringValue(event.id) ?? crypto.randomUUID(),
      title: readStringValue(event.summary) ?? 'Kalenderhendelse',
      description: readStringValue(event.description),
      status: readStringValue(event.status),
      location: readStringValue(event.location),
      start: readStringValue(start.dateTime) ?? readStringValue(start.date),
      end: readStringValue(end.dateTime) ?? readStringValue(end.date),
      htmlLink: readStringValue(event.htmlLink),
      meetUrl: readStringValue(event.hangoutLink),
    };
  }

  async function listRoleRoomGoogleCalendarAclRecords(
    calendarApi: ReturnType<typeof google.calendar>,
    calendarId: string,
  ) {
    const aclResponse = await calendarApi.acl.list({ calendarId });
    return Array.isArray(aclResponse.data.items)
      ? aclResponse.data.items.map((rule) => buildRoleRoomGoogleCalendarAclRecord(rule as unknown as Record<string, unknown>))
      : [];
  }

  async function createRoleRoomGoogleCalendar(
    calendarApi: ReturnType<typeof google.calendar>,
    projectName: string,
  ): Promise<string> {
    const created = await calendarApi.calendars.insert({
      requestBody: {
        summary: `Role Room · ${projectName}`,
        description: `Ekstern prosjektkalender for ${projectName}`,
        timeZone: process.env.TZ ?? 'Europe/Oslo',
      },
    });

    const calendarId = readStringValue(created.data.id);
    if (!calendarId) {
      throw new Error('Kunne ikke opprette Google-kalender for prosjektet');
    }
    return calendarId;
  }

  async function resolveRoleRoomGoogleCalendarId(
    calendarApi: ReturnType<typeof google.calendar>,
    projectName: string,
    preferredCalendarId?: string | null,
  ): Promise<string> {
    const existingCalendarId = readStringValue(preferredCalendarId);
    if (existingCalendarId) {
      return existingCalendarId;
    }

    try {
      return await createRoleRoomGoogleCalendar(calendarApi, projectName);
    } catch (error) {
      const apiError = isRecordValue(error) ? error : null;
      const nestedResponse = apiError && isRecordValue(apiError.response) ? apiError.response : null;
      const errorCode = apiError && typeof apiError.code === 'number'
        ? apiError.code
        : nestedResponse && typeof nestedResponse.status === 'number'
          ? nestedResponse.status
          : null;
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';

      const insufficientCalendarScope = errorCode === 403
        || errorMessage.includes('insufficient')
        || errorMessage.includes('forbidden')
        || errorMessage.includes('calendar');

      if (insufficientCalendarScope) {
        return 'primary';
      }

      throw error;
    }
  }

  async function syncRoleRoomGoogleCalendarEvent(
    calendarApi: ReturnType<typeof google.calendar>,
    calendarId: string,
    projectId: string,
    eventPayload: Record<string, unknown>,
    userId: string,
  ): Promise<RoleRoomGoogleArtifactRow> {
    const localEntityType = readStringValue(eventPayload.entityType) ?? 'timeline_item';
    const localEntityId = readStringValue(eventPayload.entityId) ?? crypto.randomUUID();
    const title = readStringValue(eventPayload.title) ?? 'Role Room-hendelse';
    const description = readStringValue(eventPayload.description);
    const startValue = readStringValue(eventPayload.start);
    const endValue = readStringValue(eventPayload.end);
    const location = readStringValue(eventPayload.location);
    const phase = readStringValue(eventPayload.phase);
    const allDay = readBooleanValue(eventPayload.allDay) === true;
    const includeMeet = readBooleanValue(eventPayload.includeMeet) === true;
    const attendees = Array.isArray(eventPayload.attendees)
      ? eventPayload.attendees
          .filter((entry): entry is Record<string, unknown> => {
            if (!isRecordValue(entry)) {
              return false;
            }
            return Boolean(readStringValue(entry.email));
          })
          .map((entry) => ({
            email: readStringValue(entry.email) ?? '',
            displayName: readStringValue(entry.displayName) ?? undefined,
          }))
      : [];

    if (!startValue) {
      throw new Error(`Kalenderhendelsen ${title} mangler start`);
    }

    const existingArtifactResult = await pool.query<RoleRoomGoogleArtifactRow>(
      `SELECT * FROM role_room_google_artifacts
       WHERE project_id = $1
         AND local_entity_type = $2
         AND local_entity_id = $3
         AND artifact_type = 'calendar_event'
       LIMIT 1`,
      [projectId, localEntityType, localEntityId],
    );
    const existingArtifact = existingArtifactResult.rows[0] ?? null;

    const requestBody: Record<string, unknown> = {
      summary: title,
      description: description ?? undefined,
      location: location ?? undefined,
      attendees,
      extendedProperties: {
        private: {
          roleRoomProjectId: projectId,
          roleRoomEntityType: localEntityType,
          roleRoomEntityId: localEntityId,
          roleRoomPhase: phase ?? '',
        },
      },
    };

    if (allDay) {
      const startDate = startValue.slice(0, 10);
      const endDate = (endValue ?? startValue).slice(0, 10);
      requestBody.start = { date: startDate };
      requestBody.end = { date: endDate };
    } else {
      requestBody.start = { dateTime: startValue, timeZone: process.env.TZ ?? 'Europe/Oslo' };
      requestBody.end = { dateTime: endValue ?? startValue, timeZone: process.env.TZ ?? 'Europe/Oslo' };
    }

    if (includeMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = existingArtifact?.calendar_event_id
      ? await calendarApi.events.patch({
          calendarId,
          eventId: existingArtifact.calendar_event_id,
          conferenceDataVersion: includeMeet ? 1 : 0,
          requestBody,
        })
      : await calendarApi.events.insert({
          calendarId,
          conferenceDataVersion: includeMeet ? 1 : 0,
          requestBody,
        });

    return upsertRoleRoomGoogleArtifact(projectId, {
      localEntityType,
      localEntityId,
      artifactType: 'calendar_event',
      sourceLabel: title,
      calendarEventId: readStringValue(response.data.id),
      meetUrl: readStringValue(response.data.hangoutLink),
      webViewUrl: readStringValue(response.data.htmlLink),
      mimeType: 'application/vnd.google-apps.calendar-event',
      folderKey: 'meetings',
      syncStatus: 'synced',
      metadata: {
        phase,
        allDay,
        attendees,
        status: readStringValue(response.data.status) ?? 'confirmed',
      },
      createdBy: userId,
    });
  }

  const PRODUCER_PHASES: readonly ProducerPhase[] = ['preproduction', 'production', 'postproduction'];
  const PRODUCER_DECISIONS: readonly ProducerReviewDecision[] = ['approved', 'rejected', 'changes_requested'];

  function isProducerPhase(value: unknown): value is ProducerPhase {
    return typeof value === 'string' && PRODUCER_PHASES.includes(value as ProducerPhase);
  }

  function isProducerReviewDecision(value: unknown): value is ProducerReviewDecision {
    return typeof value === 'string' && PRODUCER_DECISIONS.includes(value as ProducerReviewDecision);
  }

  function parseRolePermissions(raw: unknown): Record<string, boolean> {
    if (!raw || typeof raw !== 'object') return {};
    const input = raw as Record<string, unknown>;
    return Object.entries(input).reduce<Record<string, boolean>>((acc, [key, value]) => {
      if (typeof value === 'boolean') acc[key] = value;
      return acc;
    }, {});
  }

  function getDefaultProjectRolePermissions(role: string): Record<string, boolean> {
    switch (role) {
      case 'director':
      case 'producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canManageCrew: true,
          canManageLocations: true,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: true,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'content_producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canManageCrew: false,
          canManageLocations: true,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: false,
          canEditScript: true,
          canLockScript: false,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'client_reviewer':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: true,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'casting_director':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'production_manager':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: true,
          canManageCrew: true,
          canManageLocations: true,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'camera_team':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: true,
          canEditShotLists: true,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'writer':
      case 'script_editor':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: role === 'script_editor',
          canRunTableRead: true,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      default:
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canManageCrew: false,
          canManageLocations: false,
          canEditShots: false,
          canEditShotLists: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
    }
  }

  function buildProjectRolePermissions(role: string, overrides?: unknown): Record<string, boolean> {
    return {
      ...getDefaultProjectRolePermissions(role),
      ...parseRolePermissions(overrides),
    };
  }

  function getUserIdentifiers(req: Request): string[] {
    const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
    const identifiers = [
      apiKeyReq.apiKeyUser?.userId,
      apiKeyReq.apiKeyUser?.email,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());

    return [...new Set(identifiers)];
  }

  async function getProjectRoleRecord(projectId: string, userIdentifiers: string | string[]): Promise<ProjectRoleRecord | null> {
    const identifiers = (Array.isArray(userIdentifiers) ? userIdentifiers : [userIdentifiers])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());

    if (identifiers.length === 0) {
      return null;
    }

    const result = await pool.query(
      `SELECT role, permissions
       FROM casting_user_roles
       WHERE project_id = $1
         AND user_id = ANY($2::text[])
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [projectId, identifiers],
    );
    let row = result.rows[0] as { role?: string; permissions?: unknown } | undefined;

    if (!row) {
      const fallbackResult = await pool.query(
        `SELECT role, permissions
         FROM casting_user_roles
         WHERE project_id = '__global__'
           AND user_id = ANY($1::text[])
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [identifiers],
      );
      row = fallbackResult.rows[0] as { role?: string; permissions?: unknown } | undefined;
    }

    if (!row) return null;
    if (!row?.role) return null;
    return {
      role: String(row.role),
      permissions: parseRolePermissions(row.permissions),
    };
  }

  function getSessionRoleRecord(req: Request): ProjectRoleRecord | null {
    const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
    const normalizedRole = typeof apiKeyReq.apiKeyUser?.role === 'string'
      ? apiKeyReq.apiKeyUser.role.trim().toLowerCase()
      : '';

    if (!normalizedRole) {
      return null;
    }

    return {
      role: normalizedRole,
      permissions: getDefaultProjectRolePermissions(normalizedRole),
    };
  }

  function isGenericProjectRole(role: string | null | undefined): boolean {
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    return ['user', 'member', 'viewer', 'guest'].includes(normalizedRole);
  }

  function getEffectiveProjectRoleRecord(req: Request, roleRecord: ProjectRoleRecord | null): ProjectRoleRecord | null {
    const sessionRoleRecord = getSessionRoleRecord(req);
    if (!roleRecord) {
      return sessionRoleRecord;
    }

    if (
      sessionRoleRecord
      && isGenericProjectRole(roleRecord.role)
      && !isGenericProjectRole(sessionRoleRecord.role)
    ) {
      return {
        role: sessionRoleRecord.role,
        permissions: {
          ...roleRecord.permissions,
          ...sessionRoleRecord.permissions,
        },
      };
    }

    return roleRecord;
  }

  function canReadProducerData(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if ([
      'director',
      'producer',
      'production_manager',
      'content_producer',
      'client_reviewer',
    ].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canViewAll === true
      || effectiveRoleRecord.permissions.canEditProduction === true
      || effectiveRoleRecord.permissions.canComment === true;
  }

  function canReadProducerEconomy(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'content_producer', 'client_reviewer'].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canViewEconomy === true;
  }

  function canWriteProducerData(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'production_manager', 'content_producer'].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canEditProduction === true;
  }

  function canReadStoryLogic(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (canReadProducerData(req, roleRecord)) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    return effectiveRoleRecord.permissions.canEditScript === true
      || effectiveRoleRecord.permissions.canRunTableRead === true;
  }

  function canWriteStoryLogic(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'content_producer', 'writer', 'script_editor'].includes(effectiveRoleRecord.role)) {
      return true;
    }
    return effectiveRoleRecord.permissions.canEditScript === true;
  }

  function canReadCoverageReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (canReadProducerData(req, roleRecord)) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['script_supervisor', 'video_assist', 'editor', 'assistant_editor'].includes(effectiveRoleRecord.role)) {
      return true;
    }
    return effectiveRoleRecord.permissions.canEditScript === true
      || effectiveRoleRecord.permissions.canEditShots === true
      || effectiveRoleRecord.permissions.canEditShotLists === true
      || effectiveRoleRecord.permissions.canComment === true;
  }

  function canWriteCoverageReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if ([
      'director',
      'producer',
      'content_producer',
      'production_manager',
      'camera_team',
      'script_supervisor',
      'video_assist',
      'editor',
      'assistant_editor',
    ].includes(effectiveRoleRecord.role)) {
      return true;
    }
    return effectiveRoleRecord.permissions.canEditProduction === true
      || effectiveRoleRecord.permissions.canEditScript === true
      || effectiveRoleRecord.permissions.canEditShots === true
      || effectiveRoleRecord.permissions.canEditShotLists === true;
  }

  function canCommentProducerReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'content_producer', 'client_reviewer'].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canComment === true;
  }

  function canDecideProducerReview(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'client_reviewer'].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canApprove === true || effectiveRoleRecord.permissions.canRequestChanges === true;
  }

  function canWriteProducerClientInput(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    if (['director', 'producer', 'content_producer', 'client_reviewer'].includes(effectiveRoleRecord.role)) return true;
    return effectiveRoleRecord.permissions.canEditProduction === true || effectiveRoleRecord.permissions.canComment === true;
  }

  function canManageProducerAccessVault(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    return ['director', 'producer', 'content_producer'].includes(effectiveRoleRecord.role)
      || effectiveRoleRecord.permissions.canEditProduction === true;
  }

  function canRequestProducerAccessVaultReveal(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    return ['director', 'producer', 'content_producer', 'production_manager'].includes(effectiveRoleRecord.role)
      || effectiveRoleRecord.permissions.canViewAll === true;
  }

  function canApproveProducerAccessVaultReveal(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    if (requireScope(req, 'admin')) return true;
    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) return false;
    return ['director', 'producer', 'client_reviewer'].includes(effectiveRoleRecord.role)
      || effectiveRoleRecord.permissions.canApprove === true;
  }

  type ProducerReviewRow = {
    id: string;
    review_type?: string | null;
    title?: string | null;
    description?: string | null;
    target_entity_type?: string | null;
    target_entity_id?: string | null;
    due_at?: string | null;
    status?: string | null;
    decision_reason?: string | null;
    metadata?: Record<string, unknown> | null;
  };

  type ProducerClientIntakeRow = {
    project_id: string;
    project_goal?: string | null;
    deliverables?: string | null;
    target_audience?: string | null;
    key_message?: string | null;
    timing_constraints?: string | null;
    brand_notes?: string | null;
    material_overview?: string | null;
    reference_links?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    additional_notes?: string | null;
    metadata?: Record<string, unknown> | null;
    updated_by_user_id?: string | null;
    updated_by_role?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

  type ProducerClientMaterialRow = {
    id: string;
    project_id: string;
    entry_type?: string | null;
    title?: string | null;
    description?: string | null;
    external_url?: string | null;
    phase?: string | null;
    linked_shot_list_id?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
    created_by_user_id?: string | null;
    created_by_role?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

  type ProducerNotificationAudience = 'producer_team' | 'client' | 'all';

  type ProducerProjectNotificationRow = {
    id: string;
    project_id: string;
    audience?: string | null;
    event_type?: string | null;
    inbox_type?: string | null;
    title?: string | null;
    message?: string | null;
    client_name?: string | null;
    client_email?: string | null;
    linked_entity_type?: string | null;
    linked_entity_id?: string | null;
    assigned_to_user_id?: string | null;
    assigned_to_label?: string | null;
    due_at?: string | null;
    resolved_at?: string | null;
    resolved_by_user_id?: string | null;
    archived_at?: string | null;
    archived_by_user_id?: string | null;
    mention_user_ids?: unknown;
    mention_emails?: unknown;
    metadata?: Record<string, unknown> | null;
    created_by_user_id?: string | null;
    created_by_role?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    read?: boolean | null;
    read_at?: string | null;
  };

  type RoleRoomPushScope = 'producer_team';

  type RoleRoomExpenseRow = {
    id: string;
    project_id: string;
    title?: string | null;
    description?: string | null;
    merchant_name?: string | null;
    expense_date?: string | null;
    amount?: string | number | null;
    vat_amount?: string | number | null;
    currency?: string | null;
    category?: string | null;
    paid_by_user_id?: string | null;
    paid_by_label?: string | null;
    cost_owner?: string | null;
    refund_status?: string | null;
    client_approval_status?: string | null;
    duplicate_of_expense_id?: string | null;
    ocr_status?: string | null;
    ocr_confidence?: string | number | null;
    ocr_review_required?: boolean | null;
    amount_validation_status?: string | null;
    vat_validation_status?: string | null;
    privacy_notice_acknowledged_at?: string | null;
    metadata?: Record<string, unknown> | null;
    created_by_user_id?: string | null;
    created_by_role?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

  type RoleRoomExpenseReceiptFileRow = {
    id: string;
    expense_id: string;
    project_id: string;
    file_name?: string | null;
    original_name?: string | null;
    mime_type?: string | null;
    file_size?: string | number | null;
    storage_path?: string | null;
    sha256?: string | null;
    page_count?: number | null;
    metadata?: Record<string, unknown> | null;
    uploaded_by_user_id?: string | null;
    uploaded_by_role?: string | null;
    created_at?: string | null;
  };

  type RoleRoomReceiptOcrJobRow = {
    id: string;
    expense_id: string;
    receipt_file_id?: string | null;
    project_id: string;
    status?: string | null;
    attempts?: number | null;
    confidence?: string | number | null;
    extracted_text?: string | null;
    extracted_data?: Record<string, unknown> | null;
    engine?: string | null;
    last_error?: string | null;
    queued_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    updated_at?: string | null;
  };

  type RoleRoomReceiptOcrAuditRow = {
    id: string;
    expense_id: string;
    receipt_file_id?: string | null;
    ocr_job_id?: string | null;
    project_id: string;
    action?: string | null;
    actor_user_id?: string | null;
    actor_role?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  };

  type RoleRoomPushSubscriptionRow = {
    id: string;
    user_id: string;
    project_id: string;
    scope?: string | null;
    endpoint?: string | null;
    p256dh?: string | null;
    auth?: string | null;
    user_agent?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_sent_at?: string | null;
    last_error?: string | null;
    disabled_at?: string | null;
  };

  type ProducerAccountAccessPlatform =
    | 'google'
    | 'meta'
    | 'linkedin'
    | 'youtube'
    | 'tiktok';

  type RoleRoomAccessVaultSecretStatus =
    | 'not_shared'
    | 'requested'
    | 'stored_externally'
    | 'revoked';

  type RoleRoomAccessVaultRevealPolicy =
    | 'approval_required'
    | 'one_time'
    | 'manual_only'
    | 'mfa_required';

  type RoleRoomAccessVaultRevealRequestStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'revealed'
    | 'expired';

  type RoleRoomAccessVaultAuditAction =
    | 'secret_saved'
    | 'secret_revoked'
    | 'reveal_requested'
    | 'reveal_approved'
    | 'reveal_rejected'
    | 'secret_revealed';

  type RoleRoomAccessVaultSecretRow = {
    id: string;
    project_id: string;
    platform: ProducerAccountAccessPlatform;
    label?: string | null;
    secret_type?: string | null;
    username_encrypted?: string | null;
    secret_encrypted?: string | null;
    backup_code_encrypted?: string | null;
    masked_reference?: string | null;
    tier?: string | null;
    risk_level?: string | null;
    reveal_policy?: RoleRoomAccessVaultRevealPolicy | null;
    status?: RoleRoomAccessVaultSecretStatus | null;
    owner_label?: string | null;
    shared_with_roles?: unknown;
    expires_at?: string | null;
    metadata?: Record<string, unknown> | null;
    created_by_user_id?: string | null;
    created_by_role?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_revealed_at?: string | null;
    revoked_at?: string | null;
  };

  type RoleRoomAccessVaultRevealRequestRow = {
    id: string;
    secret_id: string;
    project_id: string;
    platform: ProducerAccountAccessPlatform;
    status?: RoleRoomAccessVaultRevealRequestStatus | null;
    request_reason?: string | null;
    approval_notes?: string | null;
    requested_by_user_id?: string | null;
    requested_by_role?: string | null;
    approved_by_user_id?: string | null;
    approved_by_role?: string | null;
    requested_at?: string | null;
    approved_at?: string | null;
    rejected_at?: string | null;
    revealed_at?: string | null;
    expires_at?: string | null;
    updated_at?: string | null;
  };

  type RoleRoomAccessVaultAuditRow = {
    id: string;
    project_id: string;
    secret_id?: string | null;
    reveal_request_id?: string | null;
    platform?: ProducerAccountAccessPlatform | null;
    action?: RoleRoomAccessVaultAuditAction | null;
    actor_user_id?: string | null;
    actor_role?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  };

  const PRODUCER_NOTIFICATION_CLIENT_MATERIALS_ENTITY_ID = 'client-materials';

  type RoleRoomPushPayload = {
    title: string;
    body: string;
    url?: string | null;
    tag?: string | null;
    projectId?: string | null;
    eventType?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
  };

  function readTrimmedEnv(name: string): string | null {
    const value = process.env[name];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  function getRoleRoomPushConfig() {
    const publicKey = readTrimmedEnv('VAPID_PUBLIC_KEY');
    const privateKey = readTrimmedEnv('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      return null;
    }

    return {
      publicKey,
      privateKey,
      subject: readTrimmedEnv('VAPID_SUBJECT') ?? 'mailto:support@theroleroom.com',
    };
  }

  function normalizePushEndpoint(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  async function getConfiguredWebPushClient() {
    const config = getRoleRoomPushConfig();
    if (!config) {
      return null;
    }

    const webPushModule = await import('web-push');
    const webPushClient = (webPushModule.default ?? webPushModule) as typeof import('web-push');
    webPushClient.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    return webPushClient;
  }

  function toWebPushSubscription(row: RoleRoomPushSubscriptionRow) {
    const endpoint = normalizePushEndpoint(row.endpoint);
    const p256dh = typeof row.p256dh === 'string' ? row.p256dh.trim() : '';
    const auth = typeof row.auth === 'string' ? row.auth.trim() : '';
    if (!endpoint || !p256dh || !auth) {
      return null;
    }

    return {
      endpoint,
      expirationTime: null,
      keys: {
        p256dh,
        auth,
      },
    };
  }

  async function dispatchRoleRoomPushNotifications(
    subscriptions: RoleRoomPushSubscriptionRow[],
    payload: RoleRoomPushPayload,
  ): Promise<number> {
    const webPushClient = await getConfiguredWebPushClient();
    if (!webPushClient || subscriptions.length === 0) {
      return 0;
    }

    const serializedPayload = JSON.stringify({
      title: payload.title,
      message: payload.body,
      url: payload.url ?? '/',
      tag: payload.tag ?? undefined,
      projectId: payload.projectId ?? undefined,
      eventType: payload.eventType ?? undefined,
      linkedEntityType: payload.linkedEntityType ?? undefined,
      linkedEntityId: payload.linkedEntityId ?? undefined,
    });

    let sentCount = 0;
    for (const row of subscriptions) {
      const subscription = toWebPushSubscription(row);
      if (!subscription) {
        continue;
      }

      try {
        await webPushClient.sendNotification(subscription, serializedPayload);
        sentCount += 1;
        await pool.query(
          `UPDATE role_room_push_subscriptions
           SET last_sent_at = NOW(),
               last_error = NULL,
               disabled_at = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        );
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null
          ? Number((error as { statusCode?: unknown }).statusCode ?? 0)
          : 0;
        const errorMessage = error instanceof Error ? error.message : 'Push notification failed';
        const shouldDisable = statusCode === 404 || statusCode === 410;

        await pool.query(
          `UPDATE role_room_push_subscriptions
           SET last_error = $2,
               disabled_at = CASE WHEN $3 THEN NOW() ELSE disabled_at END,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id, errorMessage, shouldDisable],
        );
      }
    }

    return sentCount;
  }

  async function sendRoleRoomPushNotificationToAudience(input: {
    projectId: string;
    scope: RoleRoomPushScope;
    payload: RoleRoomPushPayload;
  }): Promise<number> {
    if (!(await ensureProducerWorkflowTables())) {
      return 0;
    }

    const subscriptionResult = await pool.query(
      `SELECT *
       FROM role_room_push_subscriptions
       WHERE project_id = $1
         AND scope = $2
         AND disabled_at IS NULL`,
      [input.projectId, input.scope],
    );

    return dispatchRoleRoomPushNotifications(
      subscriptionResult.rows as RoleRoomPushSubscriptionRow[],
      input.payload,
    );
  }

  function isClientReviewerProjectRole(role?: string | null): boolean {
    return String(role ?? '').trim().toLowerCase() === 'client_reviewer';
  }

  function getProducerNotificationAudiences(
    req: Request,
    roleRecord: ProjectRoleRecord | null,
  ): ProducerNotificationAudience[] {
    if (requireScope(req, 'admin')) {
      return ['producer_team', 'client', 'all'];
    }

    const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
    if (!effectiveRoleRecord) {
      return [];
    }

    if (isClientReviewerProjectRole(effectiveRoleRecord.role)) {
      return ['client', 'all'];
    }

    if ([
      'director',
      'producer',
      'production_manager',
      'content_producer',
    ].includes(effectiveRoleRecord.role)) {
      return ['producer_team', 'all'];
    }

    return [];
  }

  function canReadProducerNotifications(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    return getProducerNotificationAudiences(req, roleRecord).length > 0;
  }

  function canManageProducerPushNotifications(req: Request, roleRecord: ProjectRoleRecord | null): boolean {
    return getProducerNotificationAudiences(req, roleRecord).includes('producer_team');
  }

  function readDateValue(value: unknown): string | null {
    const rawValue = readStringValue(value);
    if (!rawValue) {
      return null;
    }

    const parsed = Date.parse(rawValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return new Date(parsed).toISOString();
  }

  function normalizeProducerInboxType(value: unknown, fallback = 'general'): string {
    const normalized = readStringValue(value)?.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return normalized && normalized.length <= 80 ? normalized : fallback;
  }

  function inferProducerInboxType(
    eventType: string,
    linkedEntityType?: string | null,
    metadata?: Record<string, unknown> | null,
  ): string {
    const explicitType = normalizeProducerInboxType(metadata?.inboxType ?? metadata?.inbox_type, '');
    if (explicitType) {
      return explicitType;
    }

    const normalizedEventType = eventType.trim().toLowerCase();
    const normalizedEntityType = String(linkedEntityType ?? '').trim().toLowerCase();
    if (normalizedEventType.includes('brief') || normalizedEntityType.includes('intake')) {
      return 'brief';
    }
    if (normalizedEventType.includes('review') || normalizedEventType.includes('approval')) {
      return 'approval';
    }
    if (normalizedEventType.includes('material') || normalizedEntityType.includes('material')) {
      return 'material';
    }
    if (normalizedEventType.includes('delivery') || normalizedEntityType.includes('delivery')) {
      return 'delivery';
    }
    if (normalizedEventType.includes('workspace') || normalizedEventType.includes('google')) {
      return 'workspace';
    }
    return 'general';
  }

  function extractProducerNotificationClient(metadata?: Record<string, unknown> | null) {
    return {
      clientName: readStringValue(
        metadata?.clientName
        ?? metadata?.client_name
        ?? metadata?.contactName
        ?? metadata?.contact_name,
      ),
      clientEmail: normalizeEmailValue(
        metadata?.clientEmail
        ?? metadata?.client_email
        ?? metadata?.contactEmail
        ?? metadata?.contact_email,
      ),
    };
  }

  function buildProducerProjectNotificationResponse(row: ProducerProjectNotificationRow) {
    const mentionUserIds = readStringArray(row.mention_user_ids);
    const mentionEmails = readStringArray(row.mention_emails).map((email) => email.toLowerCase());
    return {
      id: row.id,
      project_id: row.project_id,
      projectId: row.project_id,
      audience: row.audience ?? 'producer_team',
      event_type: row.event_type ?? 'unknown',
      eventType: row.event_type ?? 'unknown',
      inbox_type: row.inbox_type ?? 'general',
      inboxType: row.inbox_type ?? 'general',
      title: row.title ?? 'Nytt varsel',
      message: row.message ?? null,
      client_name: row.client_name ?? null,
      clientName: row.client_name ?? null,
      client_email: row.client_email ?? null,
      clientEmail: row.client_email ?? null,
      linked_entity_type: row.linked_entity_type ?? null,
      linkedEntityType: row.linked_entity_type ?? null,
      linked_entity_id: row.linked_entity_id ?? null,
      linkedEntityId: row.linked_entity_id ?? null,
      assigned_to_user_id: row.assigned_to_user_id ?? null,
      assignedToUserId: row.assigned_to_user_id ?? null,
      assigned_to_label: row.assigned_to_label ?? null,
      assignedToLabel: row.assigned_to_label ?? null,
      due_at: row.due_at ?? null,
      dueAt: row.due_at ?? null,
      resolved_at: row.resolved_at ?? null,
      resolvedAt: row.resolved_at ?? null,
      resolved_by_user_id: row.resolved_by_user_id ?? null,
      resolvedByUserId: row.resolved_by_user_id ?? null,
      archived_at: row.archived_at ?? null,
      archivedAt: row.archived_at ?? null,
      archived_by_user_id: row.archived_by_user_id ?? null,
      archivedByUserId: row.archived_by_user_id ?? null,
      mention_user_ids: mentionUserIds,
      mentionUserIds,
      mention_emails: mentionEmails,
      mentionEmails,
      metadata: readJsonObject(row.metadata),
      created_by_user_id: row.created_by_user_id ?? null,
      createdByUserId: row.created_by_user_id ?? null,
      created_by_role: row.created_by_role ?? null,
      createdByRole: row.created_by_role ?? null,
      created_at: row.created_at ?? null,
      createdAt: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      updatedAt: row.updated_at ?? null,
      read: Boolean(row.read),
      read_at: row.read_at ?? null,
      readAt: row.read_at ?? null,
    };
  }

  function readNumberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const normalized = value.replace(/\s+/g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function normalizeReceiptExpenseDate(value: unknown): string | null {
    const rawValue = readStringValue(value);
    if (!rawValue) {
      return null;
    }

    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const norwegianMatch = rawValue.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
    if (norwegianMatch) {
      const day = norwegianMatch[1].padStart(2, '0');
      const month = norwegianMatch[2].padStart(2, '0');
      const rawYear = norwegianMatch[3];
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      return `${year}-${month}-${day}`;
    }

    const parsed = Date.parse(rawValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return new Date(parsed).toISOString().slice(0, 10);
  }

  function normalizeExpenseStatus(value: unknown, allowed: string[], fallback: string): string {
    const normalized = readStringValue(value)?.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return normalized && allowed.includes(normalized) ? normalized : fallback;
  }

  function normalizeMerchantName(value: unknown): string | null {
    const merchant = readStringValue(value);
    return merchant ? merchant.replace(/\s+/g, ' ').slice(0, 255) : null;
  }

  type ReceiptOcrExtractionResult = {
    text: string;
    engine: string;
    confidence: number;
    pageCount: number | null;
    pagesProcessed: number;
    warnings: string[];
    metadata: Record<string, unknown>;
  };

  type PdfParseConstructor = new (options: { data: Buffer | Uint8Array }) => {
    getText(params?: Record<string, unknown>): Promise<{ text?: string; total?: number; pages?: unknown[] }>;
    getScreenshot(params?: Record<string, unknown>): Promise<{
      total?: number;
      pages?: Array<{
        data?: Uint8Array | Buffer;
        pageNumber?: number;
        width?: number;
        height?: number;
      }>;
    }>;
    destroy(): Promise<void>;
  };

  type TesseractWorkerLike = {
    recognize(input: Buffer): Promise<unknown>;
    terminate(): Promise<void>;
  };

  function normalizeReceiptOcrText(value: unknown): string {
    return (readStringValue(value) ?? '')
      .replace(/\u0000/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  }

  function isPdfReceiptFile(mimeType?: string | null, fileName?: string | null): boolean {
    const normalizedMimeType = String(mimeType || '').toLowerCase();
    const extension = path.extname(fileName || '').toLowerCase();
    return normalizedMimeType === 'application/pdf' || extension === '.pdf';
  }

  function isImageReceiptFile(mimeType?: string | null, fileName?: string | null): boolean {
    const normalizedMimeType = String(mimeType || '').toLowerCase();
    const extension = path.extname(fileName || '').toLowerCase();
    return normalizedMimeType.startsWith('image/')
      || ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff'].includes(extension);
  }

  function buildReceiptOcrFallbackResult(text: string, engine = 'manual-text'): ReceiptOcrExtractionResult {
    const normalizedText = normalizeReceiptOcrText(text);
    return {
      text: normalizedText,
      engine,
      confidence: normalizedText.length >= ROLE_ROOM_RECEIPT_OCR_MIN_TEXT_CHARS ? 0.55 : 0,
      pageCount: null,
      pagesProcessed: normalizedText ? 1 : 0,
      warnings: normalizedText ? [] : ['Ingen tekst tilgjengelig for OCR'],
      metadata: {
        source: engine,
        languages: ROLE_ROOM_RECEIPT_OCR_LANGUAGES,
      },
    };
  }

  async function runWithReceiptOcrTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} tidsavbrutt etter ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function preprocessReceiptImageForOcr(buffer: Buffer): Promise<{
    buffer: Buffer;
    metadata: Record<string, unknown>;
  }> {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    const image = sharp(buffer, {
      failOn: 'none',
      limitInputPixels: 120_000_000,
    }).rotate();
    const metadata = await image.metadata();
    const processed = image
      .resize({
        width: ROLE_ROOM_RECEIPT_OCR_IMAGE_WIDTH,
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 0.8 })
      .png({ compressionLevel: 6 });

    return {
      buffer: await processed.toBuffer(),
      metadata: {
        originalFormat: metadata.format ?? null,
        originalWidth: metadata.width ?? null,
        originalHeight: metadata.height ?? null,
        targetWidth: ROLE_ROOM_RECEIPT_OCR_IMAGE_WIDTH,
      },
    };
  }

  async function recognizeReceiptImageWithTesseract(buffer: Buffer, label: string): Promise<{
    text: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }> {
    await fs.mkdir(ROLE_ROOM_RECEIPT_OCR_CACHE_ROOT, { recursive: true });
    const tesseractModule = await import('tesseract.js') as unknown as {
      createWorker: (
        langs?: string,
        oem?: number,
        options?: Record<string, unknown>,
        config?: Record<string, unknown>,
      ) => Promise<TesseractWorkerLike>;
      OEM?: { LSTM_ONLY?: number };
      PSM?: { AUTO?: number };
    };
    const worker = await runWithReceiptOcrTimeout(
      tesseractModule.createWorker(
        ROLE_ROOM_RECEIPT_OCR_LANGUAGES,
        tesseractModule.OEM?.LSTM_ONLY ?? 1,
        {
          cachePath: ROLE_ROOM_RECEIPT_OCR_CACHE_ROOT,
          logger: () => undefined,
        },
        {
          tessedit_pageseg_mode: tesseractModule.PSM?.AUTO ?? 3,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        },
      ),
      ROLE_ROOM_RECEIPT_OCR_TIMEOUT_MS,
      `OCR worker (${label})`,
    );

    try {
      const result = await runWithReceiptOcrTimeout(
        worker.recognize(buffer),
        ROLE_ROOM_RECEIPT_OCR_TIMEOUT_MS,
        `OCR analyse (${label})`,
      );
      const data = readRecordValue((result as { data?: unknown }).data) ?? {};
      const rawConfidence = readNumberValue(data.confidence) ?? 0;
      return {
        text: normalizeReceiptOcrText(data.text),
        confidence: Math.max(0, Math.min(1, rawConfidence / 100)),
        metadata: {
          label,
          rawConfidence,
          languages: ROLE_ROOM_RECEIPT_OCR_LANGUAGES,
        },
      };
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  }

  async function extractReceiptOcrFromImageBuffer(buffer: Buffer, input: {
    label: string;
    engine: string;
  }): Promise<ReceiptOcrExtractionResult> {
    const preprocessed = await preprocessReceiptImageForOcr(buffer);
    const recognized = await recognizeReceiptImageWithTesseract(preprocessed.buffer, input.label);
    return {
      text: recognized.text,
      engine: input.engine,
      confidence: recognized.confidence,
      pageCount: 1,
      pagesProcessed: 1,
      warnings: recognized.text.length >= ROLE_ROOM_RECEIPT_OCR_MIN_TEXT_CHARS ? [] : ['OCR fant lite eller ingen tekst i bildet'],
      metadata: {
        ...preprocessed.metadata,
        ...recognized.metadata,
      },
    };
  }

  async function extractReceiptOcrFromPdfBuffer(buffer: Buffer, label: string): Promise<ReceiptOcrExtractionResult> {
    const pdfParseModule = await import('pdf-parse') as unknown as { PDFParse: PdfParseConstructor };
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const warnings: string[] = [];
    try {
      const textResult = await parser.getText({
        first: ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES,
        pageJoiner: '\n-- page_number of total_number --',
      });
      const extractedText = normalizeReceiptOcrText(textResult.text);
      const pageCount = readNumberValue(textResult.total) ?? textResult.pages?.length ?? null;
      const textInference = inferReceiptOcrFromText(extractedText);

      if (
        extractedText.length >= ROLE_ROOM_RECEIPT_OCR_MIN_TEXT_CHARS
        && textInference.confidence >= 0.45
      ) {
        return {
          text: extractedText,
          engine: 'pdf-parse-text',
          confidence: Math.max(0.58, textInference.confidence),
          pageCount,
          pagesProcessed: textResult.pages?.length ?? Math.min(pageCount ?? 1, ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES),
          warnings,
          metadata: {
            source: 'embedded-pdf-text',
            maxPdfPages: ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES,
          },
        };
      }

      warnings.push('PDF hadde lite tekst, bruker sidebilder med Tesseract');
      const screenshots = await parser.getScreenshot({
        first: ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES,
        imageBuffer: true,
        imageDataUrl: false,
        desiredWidth: ROLE_ROOM_RECEIPT_OCR_IMAGE_WIDTH,
      });
      const pageTexts: string[] = [];
      const pageConfidences: number[] = [];

      for (const page of screenshots.pages ?? []) {
        if (!page.data || page.data.length === 0) {
          continue;
        }
        const pageBuffer = Buffer.from(page.data);
        const recognized = await recognizeReceiptImageWithTesseract(pageBuffer, `${label} side ${page.pageNumber ?? pageTexts.length + 1}`);
        if (recognized.text) {
          pageTexts.push(recognized.text);
        }
        pageConfidences.push(recognized.confidence);
      }

      const renderedText = normalizeReceiptOcrText(pageTexts.join('\n\n'));
      const averageConfidence = pageConfidences.length > 0
        ? pageConfidences.reduce((sum, value) => sum + value, 0) / pageConfidences.length
        : 0;

      return {
        text: renderedText || extractedText,
        engine: renderedText ? 'pdf-render+tesseract.js' : 'pdf-parse-text-low-confidence',
        confidence: renderedText ? averageConfidence : Math.max(0.1, textInference.confidence),
        pageCount: readNumberValue(screenshots.total) ?? pageCount,
        pagesProcessed: screenshots.pages?.length ?? 0,
        warnings: renderedText ? warnings : [...warnings, 'Tesseract fant ikke lesbar tekst i PDF-sidebilder'],
        metadata: {
          source: renderedText ? 'rendered-pdf-pages' : 'embedded-pdf-text-low-confidence',
          embeddedTextLength: extractedText.length,
          maxPdfPages: ROLE_ROOM_RECEIPT_OCR_MAX_PDF_PAGES,
          renderedPages: screenshots.pages?.length ?? 0,
        },
      };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  async function loadReceiptFileForOcr(input: {
    projectId: string;
    expenseId: string;
    receiptFileId?: string | null;
  }): Promise<RoleRoomExpenseReceiptFileRow | null> {
    const values: unknown[] = [input.projectId, input.expenseId];
    const conditions = ['project_id = $1', 'expense_id = $2'];
    const receiptFileId = readStringValue(input.receiptFileId);
    if (receiptFileId) {
      values.push(receiptFileId);
      conditions.push(`id = $${values.length}`);
    }
    const result = await pool.query(
      `SELECT *
       FROM role_room_expense_receipt_files
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 1`,
      values,
    );
    return (result.rows[0] as RoleRoomExpenseReceiptFileRow | undefined) ?? null;
  }

  async function extractReceiptOcrText(input: {
    receiptFile?: RoleRoomExpenseReceiptFileRow | null;
    fallbackText?: string | null;
    requestedEngine?: string | null;
  }): Promise<ReceiptOcrExtractionResult> {
    const fallbackText = normalizeReceiptOcrText(input.fallbackText);
    if (!ROLE_ROOM_RECEIPT_OCR_ENABLED) {
      return buildReceiptOcrFallbackResult(fallbackText, 'ocr-disabled');
    }

    const receiptFile = input.receiptFile ?? null;
    const storagePath = readStringValue(receiptFile?.storage_path);
    if (!storagePath) {
      return buildReceiptOcrFallbackResult(fallbackText, fallbackText ? 'manual-text' : 'missing-receipt-file');
    }
    if (!existsSync(storagePath)) {
      if (fallbackText) {
        return buildReceiptOcrFallbackResult(fallbackText, 'manual-text-missing-file');
      }
      throw new Error('Kvitteringsfilen finnes ikke på disk');
    }

    const buffer = await fs.readFile(storagePath);
    const label = receiptFile?.original_name ?? receiptFile?.file_name ?? 'receipt';
    const requestedEngine = readStringValue(input.requestedEngine);

    try {
      if (isPdfReceiptFile(receiptFile?.mime_type, receiptFile?.original_name ?? receiptFile?.file_name)) {
        return await extractReceiptOcrFromPdfBuffer(buffer, label);
      }

      if (isImageReceiptFile(receiptFile?.mime_type, receiptFile?.original_name ?? receiptFile?.file_name)) {
        return await extractReceiptOcrFromImageBuffer(buffer, {
          label,
          engine: requestedEngine?.includes('heic') || String(receiptFile?.mime_type || '').toLowerCase().includes('heic')
            ? 'sharp-heic+tesseract.js'
            : 'sharp-image+tesseract.js',
        });
      }
    } catch (error) {
      if (fallbackText) {
        return {
          ...buildReceiptOcrFallbackResult(fallbackText, 'manual-text-after-ocr-error'),
          warnings: [
            `Filbasert OCR feilet: ${error instanceof Error ? error.message : String(error)}`,
          ],
        };
      }
      throw error;
    }

    if (fallbackText) {
      return buildReceiptOcrFallbackResult(fallbackText, 'manual-text-unsupported-file');
    }
    throw new Error('Kvitteringsformatet støttes ikke av OCR-motoren');
  }

  function inferReceiptOcrFromText(text: string): {
    merchantName: string | null;
    expenseDate: string | null;
    amount: number | null;
    vatAmount: number | null;
    lineItems: Array<Record<string, unknown>>;
    confidence: number;
  } {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const merchantName = lines.find((line) => /[A-Za-zÆØÅæøå]{3,}/.test(line))?.slice(0, 120) ?? null;
    const expenseDate = normalizeReceiptExpenseDate(text);
    const amountMatches = Array.from(text.matchAll(/(?:total|sum|beløp|amount|nok|kr)\D{0,12}(\d{1,7}(?:[.,]\d{2})?)/gi))
      .map((match) => readNumberValue(match[1]))
      .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
    const fallbackAmounts = Array.from(text.matchAll(/\b(\d{1,7}[.,]\d{2})\b/g))
      .map((match) => readNumberValue(match[1]))
      .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
    const amount = amountMatches.at(-1) ?? fallbackAmounts.at(-1) ?? null;
    const vatMatch = text.match(/(?:mva|vat|tax)\D{0,12}(\d{1,7}(?:[.,]\d{2})?)/i);
    const vatAmount = vatMatch ? readNumberValue(vatMatch[1]) : null;
    const lineItems = lines
      .filter((line) => /\d{1,7}[.,]\d{2}/.test(line))
      .slice(0, 30)
      .map((line) => ({ raw: line }));
    const confidence = [
      merchantName ? 0.25 : 0,
      expenseDate ? 0.25 : 0,
      amount ? 0.35 : 0,
      vatAmount !== null ? 0.15 : 0,
    ].reduce((sum, value) => sum + value, 0);

    return {
      merchantName,
      expenseDate,
      amount,
      vatAmount,
      lineItems,
      confidence: Math.min(1, confidence),
    };
  }

  function validateExpenseAmount(amount: number | null): string {
    if (amount === null) {
      return 'missing';
    }
    return amount > 0 ? 'valid' : 'invalid';
  }

  function validateExpenseVat(amount: number | null, vatAmount: number | null): string {
    if (vatAmount === null) {
      return 'missing';
    }
    if (amount === null || amount <= 0 || vatAmount < 0 || vatAmount > amount) {
      return 'invalid';
    }
    const expectedNorwegianVat = Number((amount * 0.2).toFixed(2));
    return Math.abs(vatAmount - expectedNorwegianVat) <= 1 ? 'valid' : 'review';
  }

  async function appendReceiptOcrAuditEvent(input: {
    req: Request;
    projectId: string;
    expenseId: string;
    receiptFileId?: string | null;
    ocrJobId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const actor = getOptionalRequestUser(input.req);
    await pool.query(
      `INSERT INTO role_room_receipt_ocr_audit_events (
        id, expense_id, receipt_file_id, ocr_job_id, project_id,
        action, actor_user_id, actor_role, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9::jsonb, NOW()
      )`,
      [
        crypto.randomUUID(),
        input.expenseId,
        input.receiptFileId ?? null,
        input.ocrJobId ?? null,
        input.projectId,
        input.action,
        actor?.userId ?? null,
        actor?.role ?? null,
        JSON.stringify({
          ...(input.metadata ?? {}),
          ip: input.req.ip ?? null,
          userAgent: readOptionalHeaderValue(input.req, 'user-agent') ?? null,
        }),
      ],
    );
  }

  function buildRoleRoomExpenseResponse(row: RoleRoomExpenseRow, receipts: RoleRoomExpenseReceiptFileRow[] = [], jobs: RoleRoomReceiptOcrJobRow[] = []) {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title ?? 'Utlegg',
      description: row.description ?? null,
      merchantName: row.merchant_name ?? null,
      expenseDate: row.expense_date ?? null,
      amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
      vatAmount: row.vat_amount === null || row.vat_amount === undefined ? null : Number(row.vat_amount),
      currency: row.currency ?? 'NOK',
      category: row.category ?? null,
      paidByUserId: row.paid_by_user_id ?? null,
      paidByLabel: row.paid_by_label ?? null,
      costOwner: row.cost_owner ?? 'client',
      refundStatus: row.refund_status ?? 'not_requested',
      clientApprovalStatus: row.client_approval_status ?? 'pending',
      duplicateOfExpenseId: row.duplicate_of_expense_id ?? null,
      ocrStatus: row.ocr_status ?? 'pending',
      ocrConfidence: row.ocr_confidence === null || row.ocr_confidence === undefined ? null : Number(row.ocr_confidence),
      ocrReviewRequired: Boolean(row.ocr_review_required),
      amountValidationStatus: row.amount_validation_status ?? 'pending',
      vatValidationStatus: row.vat_validation_status ?? 'pending',
      privacyNoticeAcknowledgedAt: row.privacy_notice_acknowledged_at ?? null,
      metadata: readJsonObject(row.metadata),
      createdByUserId: row.created_by_user_id ?? null,
      createdByRole: row.created_by_role ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      receipts: receipts.map((receipt) => ({
        id: receipt.id,
        expenseId: receipt.expense_id,
        projectId: receipt.project_id,
        fileName: receipt.file_name ?? null,
        originalName: receipt.original_name ?? null,
        mimeType: receipt.mime_type ?? null,
        fileSize: receipt.file_size === null || receipt.file_size === undefined ? null : Number(receipt.file_size),
        sha256: receipt.sha256 ?? null,
        pageCount: receipt.page_count ?? null,
        metadata: readJsonObject(receipt.metadata),
        createdAt: receipt.created_at ?? null,
      })),
      ocrJobs: jobs.map((job) => ({
        id: job.id,
        expenseId: job.expense_id,
        receiptFileId: job.receipt_file_id ?? null,
        projectId: job.project_id,
        status: job.status ?? 'queued',
        attempts: Number(job.attempts ?? 0),
        confidence: job.confidence === null || job.confidence === undefined ? null : Number(job.confidence),
        extractedText: job.extracted_text ?? null,
        extractedData: readJsonObject(job.extracted_data),
        engine: job.engine ?? 'server-heuristic',
        lastError: job.last_error ?? null,
        queuedAt: job.queued_at ?? null,
        startedAt: job.started_at ?? null,
        completedAt: job.completed_at ?? null,
        updatedAt: job.updated_at ?? null,
      })),
    };
  }

  async function runReceiptOcrJob(input: {
    req: Request;
    projectId: string;
    expenseId: string;
    receiptFileId?: string | null;
    extractedText?: string | null;
    engine?: string;
  }): Promise<RoleRoomReceiptOcrJobRow> {
    const ocrJobId = crypto.randomUUID();
    const fallbackText = normalizeReceiptOcrText(input.extractedText);
    const receiptFile = await loadReceiptFileForOcr({
      projectId: input.projectId,
      expenseId: input.expenseId,
      receiptFileId: input.receiptFileId,
    });
    const receiptFileId = input.receiptFileId ?? receiptFile?.id ?? null;
    await pool.query(
      `INSERT INTO role_room_receipt_ocr_jobs (
        id, expense_id, receipt_file_id, project_id, status, attempts,
        extracted_text, extracted_data, engine, queued_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'queued', 0,
        $5, '{}'::jsonb, $6, NOW(), NOW()
      )`,
      [
        ocrJobId,
        input.expenseId,
        receiptFileId,
        input.projectId,
        fallbackText || null,
        input.engine ?? 'server-ocr',
      ],
    );

    await appendReceiptOcrAuditEvent({
      req: input.req,
      projectId: input.projectId,
      expenseId: input.expenseId,
      receiptFileId,
      ocrJobId,
      action: 'queued',
      metadata: {
        privacyNotice: 'Kvitteringer kan inneholde persondata. Systemet lagrer OCR-resultat, filmetadata og audit for kontroll og refusjon.',
        requestedEngine: input.engine ?? null,
        hasReceiptFile: Boolean(receiptFile),
        hasFallbackText: Boolean(fallbackText),
      },
    });

    await pool.query(
      `UPDATE role_room_receipt_ocr_jobs
       SET status = 'processing',
           attempts = attempts + 1,
           started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [ocrJobId],
    );

    let extraction: ReceiptOcrExtractionResult;
    try {
      extraction = await extractReceiptOcrText({
        receiptFile,
        fallbackText,
        requestedEngine: input.engine,
      });
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      const failedData = {
        error: lastError,
        requestedEngine: input.engine ?? null,
        receiptFileId,
        supportedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tiff'],
        confidenceReviewRequired: true,
      };
      await pool.query(
        `UPDATE role_room_receipt_ocr_jobs
         SET status = 'failed',
             last_error = $2,
             extracted_data = $3::jsonb,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [ocrJobId, lastError, JSON.stringify(failedData)],
      );
      await pool.query(
        `UPDATE role_room_expenses
         SET ocr_status = 'failed',
             ocr_confidence = 0,
             ocr_review_required = TRUE,
             amount_validation_status = CASE WHEN amount IS NULL THEN 'missing' ELSE amount_validation_status END,
             vat_validation_status = CASE WHEN vat_amount IS NULL THEN 'missing' ELSE vat_validation_status END,
             privacy_notice_acknowledged_at = COALESCE(privacy_notice_acknowledged_at, NOW()),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [input.expenseId, input.projectId],
      );
      await appendReceiptOcrAuditEvent({
        req: input.req,
        projectId: input.projectId,
        expenseId: input.expenseId,
        receiptFileId,
        ocrJobId,
        action: 'failed',
        metadata: failedData,
      });
      const failedResult = await pool.query(
        `SELECT *
         FROM role_room_receipt_ocr_jobs
         WHERE id = $1`,
        [ocrJobId],
      );
      return failedResult.rows[0] as RoleRoomReceiptOcrJobRow;
    }

    if (receiptFileId) {
      await pool.query(
        `UPDATE role_room_expense_receipt_files
         SET page_count = COALESCE(page_count, $2),
             metadata = COALESCE(metadata, '{}'::jsonb)
               || $3::jsonb
         WHERE id = $1 AND project_id = $4`,
        [
          receiptFileId,
          extraction.pageCount,
          JSON.stringify({
            ocrEngine: extraction.engine,
            ocrPagesProcessed: extraction.pagesProcessed,
            ocrWarnings: extraction.warnings,
            ocrMetadata: extraction.metadata,
          }),
          input.projectId,
        ],
      );
    }

    const extractedText = extraction.text;
    const inferred = inferReceiptOcrFromText(extractedText);
    const amountValidationStatus = validateExpenseAmount(inferred.amount);
    const vatValidationStatus = validateExpenseVat(inferred.amount, inferred.vatAmount);
    const combinedConfidence = Math.min(
      1,
      Math.max(
        inferred.confidence,
        (inferred.confidence * 0.75) + (extraction.confidence * 0.25),
      ),
    );
    const reviewRequired = combinedConfidence < 0.82
      || amountValidationStatus !== 'valid'
      || vatValidationStatus === 'invalid';
    const ocrStatus = reviewRequired ? 'needs_review' : 'completed';
    const extractedData = {
      merchantName: inferred.merchantName,
      expenseDate: inferred.expenseDate,
      amount: inferred.amount,
      vatAmount: inferred.vatAmount,
      currency: 'NOK',
      lineItems: inferred.lineItems,
      amountValidationStatus,
      vatValidationStatus,
      sourceEngine: extraction.engine,
      rawOcrConfidence: extraction.confidence,
      pagesProcessed: extraction.pagesProcessed,
      pageCount: extraction.pageCount,
      warnings: extraction.warnings,
      extractionMetadata: extraction.metadata,
      supportedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tiff'],
      confidenceReviewRequired: reviewRequired,
    };

    await pool.query(
      `UPDATE role_room_receipt_ocr_jobs
       SET status = $2,
           confidence = $3,
           extracted_text = $4,
           extracted_data = $5::jsonb,
           engine = $6,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [
        ocrJobId,
        ocrStatus,
        combinedConfidence,
        extractedText || null,
        JSON.stringify(extractedData),
        extraction.engine,
      ],
    );

    const currentExpenseResult = await pool.query(
      `SELECT *
       FROM role_room_expenses
       WHERE id = $1 AND project_id = $2
       LIMIT 1`,
      [input.expenseId, input.projectId],
    );
    const currentExpense = currentExpenseResult.rows[0] as RoleRoomExpenseRow | undefined;
    const nextMerchantName = currentExpense?.merchant_name ?? inferred.merchantName;
    const nextExpenseDate = currentExpense?.expense_date ?? inferred.expenseDate;
    const nextAmount = currentExpense?.amount !== null && currentExpense?.amount !== undefined
      ? Number(currentExpense.amount)
      : inferred.amount;
    const nextVatAmount = currentExpense?.vat_amount !== null && currentExpense?.vat_amount !== undefined
      ? Number(currentExpense.vat_amount)
      : inferred.vatAmount;

    let duplicateOfExpenseId: string | null = null;
    if (nextMerchantName && nextExpenseDate && nextAmount !== null) {
      const duplicateResult = await pool.query(
        `SELECT id
         FROM role_room_expenses
         WHERE project_id = $1
           AND id <> $2
           AND LOWER(COALESCE(merchant_name, '')) = LOWER($3)
           AND expense_date = $4::date
           AND amount = $5
         ORDER BY created_at ASC
         LIMIT 1`,
        [input.projectId, input.expenseId, nextMerchantName, nextExpenseDate, nextAmount],
      );
      duplicateOfExpenseId = readStringValue(duplicateResult.rows[0]?.id);
    }

    await pool.query(
      `UPDATE role_room_expenses
       SET merchant_name = COALESCE(merchant_name, $2),
           expense_date = COALESCE(expense_date, $3::date),
           amount = COALESCE(amount, $4),
           vat_amount = COALESCE(vat_amount, $5),
           duplicate_of_expense_id = COALESCE(duplicate_of_expense_id, $6::uuid),
           ocr_status = $7,
           ocr_confidence = $8,
           ocr_review_required = $9,
           amount_validation_status = $10,
           vat_validation_status = $11,
           privacy_notice_acknowledged_at = COALESCE(privacy_notice_acknowledged_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND project_id = $12`,
      [
        input.expenseId,
        nextMerchantName,
        nextExpenseDate,
        nextAmount,
        nextVatAmount,
        duplicateOfExpenseId,
        ocrStatus,
        combinedConfidence,
        reviewRequired,
        validateExpenseAmount(nextAmount),
        validateExpenseVat(nextAmount, nextVatAmount),
        input.projectId,
      ],
    );

    if (nextMerchantName) {
      await pool.query(
        `INSERT INTO role_room_receipt_merchant_registry (
          id, project_id, merchant_name, normalized_name, default_category, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, LOWER($3), $4, '{}'::jsonb, NOW(), NOW()
        )
        ON CONFLICT (project_id, normalized_name)
        DO UPDATE SET merchant_name = EXCLUDED.merchant_name,
                      default_category = COALESCE(role_room_receipt_merchant_registry.default_category, EXCLUDED.default_category),
                      updated_at = NOW()`,
        [crypto.randomUUID(), input.projectId, nextMerchantName, currentExpense?.category ?? null],
      );
    }

    await appendReceiptOcrAuditEvent({
      req: input.req,
      projectId: input.projectId,
      expenseId: input.expenseId,
      receiptFileId,
      ocrJobId,
      action: ocrStatus,
      metadata: {
        confidence: combinedConfidence,
        rawOcrConfidence: extraction.confidence,
        engine: extraction.engine,
        pagesProcessed: extraction.pagesProcessed,
        amountValidationStatus: validateExpenseAmount(nextAmount),
        vatValidationStatus: validateExpenseVat(nextAmount, nextVatAmount),
        duplicateOfExpenseId,
      },
    });

    const result = await pool.query(
      `SELECT *
       FROM role_room_receipt_ocr_jobs
       WHERE id = $1`,
      [ocrJobId],
    );
    return result.rows[0] as RoleRoomReceiptOcrJobRow;
  }

  async function loadRoleRoomExpenseBundle(projectId: string, expenseId: string) {
    const expenseResult = await pool.query(
      `SELECT *
       FROM role_room_expenses
       WHERE id = $1 AND project_id = $2
       LIMIT 1`,
      [expenseId, projectId],
    );
    const expense = expenseResult.rows[0] as RoleRoomExpenseRow | undefined;
    if (!expense) {
      return null;
    }

    const [receiptResult, jobResult] = await Promise.all([
      pool.query(
        `SELECT *
         FROM role_room_expense_receipt_files
         WHERE expense_id = $1 AND project_id = $2
         ORDER BY created_at DESC`,
        [expenseId, projectId],
      ),
      pool.query(
        `SELECT *
         FROM role_room_receipt_ocr_jobs
         WHERE expense_id = $1 AND project_id = $2
         ORDER BY queued_at DESC`,
        [expenseId, projectId],
      ),
    ]);

    return buildRoleRoomExpenseResponse(
      expense,
      receiptResult.rows as RoleRoomExpenseReceiptFileRow[],
      jobResult.rows as RoleRoomReceiptOcrJobRow[],
    );
  }

  async function upsertProducerProjectNotification(input: {
    projectId: string;
    audience: ProducerNotificationAudience;
    eventType: string;
    title: string;
    message?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
    metadata?: Record<string, unknown>;
    createdByUserId?: string | null;
    createdByRole?: string | null;
  }): Promise<ProducerProjectNotificationRow> {
    const {
      projectId,
      audience,
      eventType,
      title,
      message,
      linkedEntityType,
      linkedEntityId,
      metadata,
      createdByUserId,
      createdByRole,
    } = input;
    const notificationMetadata = metadata ?? {};
    const inboxType = inferProducerInboxType(eventType, linkedEntityType, notificationMetadata);
    const { clientName, clientEmail } = extractProducerNotificationClient(notificationMetadata);
    const mentionUserIds = readStringArray(
      notificationMetadata.mentionUserIds
      ?? notificationMetadata.mention_user_ids
      ?? notificationMetadata.mentions,
    );
    const mentionEmails = readStringArray(
      notificationMetadata.mentionEmails
      ?? notificationMetadata.mention_emails,
    ).map((email) => email.toLowerCase());

    const existingResult = await pool.query(
      `SELECT id
       FROM role_room_project_notifications
       WHERE project_id = $1
         AND audience = $2
         AND event_type = $3
         AND COALESCE(linked_entity_type, '') = COALESCE($4, '')
         AND COALESCE(linked_entity_id, '') = COALESCE($5, '')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [projectId, audience, eventType, linkedEntityType ?? null, linkedEntityId ?? null],
    );

    const serializedMetadata = JSON.stringify(notificationMetadata);

    const deliverPushNotification = async () => {
      if (audience !== 'producer_team') {
        return;
      }

      try {
        await sendRoleRoomPushNotificationToAudience({
          projectId,
          scope: 'producer_team',
          payload: {
            title: title.trim(),
            body: typeof message === 'string' && message.trim().length > 0
              ? message.trim()
              : title.trim(),
            url: '/',
            tag: `role-room:${projectId}:${eventType.trim()}:${linkedEntityType ?? 'general'}:${linkedEntityId ?? 'all'}`,
            projectId,
            eventType: eventType.trim(),
            linkedEntityType: linkedEntityType ?? null,
            linkedEntityId: linkedEntityId ?? null,
          },
        });
      } catch (error) {
        console.warn('Role Room push delivery skipped:', error);
      }
    };

    if ((existingResult.rowCount ?? 0) > 0) {
      const notificationId = String(existingResult.rows[0]?.id ?? '');
      const updatedResult = await pool.query(
        `UPDATE role_room_project_notifications
         SET title = $1,
             message = $2,
             metadata = $3::jsonb,
             created_by_user_id = $4,
             created_by_role = $5,
             inbox_type = $6,
             client_name = $7,
             client_email = $8,
             mention_user_ids = $9::jsonb,
             mention_emails = $10::jsonb,
             resolved_at = NULL,
             resolved_by_user_id = NULL,
             archived_at = NULL,
             archived_by_user_id = NULL,
             updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          title.trim(),
          typeof message === 'string' && message.trim().length > 0 ? message.trim() : null,
          serializedMetadata,
          createdByUserId ?? null,
          createdByRole ?? null,
          inboxType,
          clientName,
          clientEmail,
          JSON.stringify(mentionUserIds),
          JSON.stringify(mentionEmails),
          notificationId,
        ],
      );

      await pool.query(
        `DELETE FROM role_room_project_notification_reads
         WHERE notification_id = $1`,
        [notificationId],
      );

      await deliverPushNotification();
      return updatedResult.rows[0] as ProducerProjectNotificationRow;
    }

    const insertedResult = await pool.query(
      `INSERT INTO role_room_project_notifications (
        id, project_id, audience, event_type, title, message,
        linked_entity_type, linked_entity_id, inbox_type, client_name, client_email,
        mention_user_ids, mention_emails, metadata, created_by_user_id, created_by_role, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, NOW(), NOW()
      )
      RETURNING *`,
      [
        crypto.randomUUID(),
        projectId,
        audience,
        eventType.trim(),
        title.trim(),
        typeof message === 'string' && message.trim().length > 0 ? message.trim() : null,
        linkedEntityType ?? null,
        linkedEntityId ?? null,
        inboxType,
        clientName,
        clientEmail,
        JSON.stringify(mentionUserIds),
        JSON.stringify(mentionEmails),
        serializedMetadata,
        createdByUserId ?? null,
        createdByRole ?? null,
      ],
    );

    await deliverPushNotification();
    return insertedResult.rows[0] as ProducerProjectNotificationRow;
  }

  function buildClientBriefNotificationMessage(intake: ProducerClientIntakeRow): string {
    const parts = [
      typeof intake.project_goal === 'string' && intake.project_goal.trim().length > 0
        ? `Mål: ${intake.project_goal.trim()}`
        : null,
      typeof intake.deliverables === 'string' && intake.deliverables.trim().length > 0
        ? `Leveranser: ${intake.deliverables.trim()}`
        : null,
      [
        intake.contact_name,
        intake.contact_email,
        intake.contact_phone,
      ]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
        .join(' · '),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return parts.join(' · ') || 'Klienten har fylt ut eller oppdatert prosjektbriefen.';
  }

  async function notifyProducerTeamAboutClientBrief(
    projectId: string,
    intake: ProducerClientIntakeRow,
    userId: string | null,
    actorRole: string | null,
  ): Promise<void> {
    await upsertProducerProjectNotification({
      projectId,
      audience: 'producer_team',
      eventType: 'client_brief_updated',
      title: 'Klienten har oppdatert briefen',
      message: buildClientBriefNotificationMessage(intake),
      linkedEntityType: 'client_intake',
      linkedEntityId: 'client-intake',
      metadata: {
        source: 'client_intake',
        updatedByRole: actorRole ?? null,
        contactName: intake.contact_name ?? null,
        contactEmail: intake.contact_email ?? null,
      },
      createdByUserId: userId,
      createdByRole: actorRole,
    });
  }

  async function notifyProducerTeamAboutClientMaterial(
    projectId: string,
    material: ProducerClientMaterialRow | null,
    userId: string | null,
    actorRole: string | null,
    mutation: 'created' | 'updated' | 'deleted',
  ): Promise<void> {
    const actionLabel = mutation === 'created'
      ? 'lagt til'
      : mutation === 'deleted'
        ? 'fjernet'
        : 'oppdatert';

    const title = mutation === 'created'
      ? 'Klienten har lagt til prosjektmateriale'
      : mutation === 'deleted'
        ? 'Klienten har fjernet prosjektmateriale'
        : 'Klienten har oppdatert prosjektmateriale';

    const messageParts = [
      typeof material?.title === 'string' && material.title.trim().length > 0
        ? `${material.title.trim()} er ${actionLabel}`
        : `Klienten har ${actionLabel} prosjektmateriale`,
      typeof material?.entry_type === 'string' && material.entry_type.trim().length > 0
        ? `Type: ${material.entry_type.trim()}`
        : null,
      typeof material?.description === 'string' && material.description.trim().length > 0
        ? material.description.trim()
        : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    await upsertProducerProjectNotification({
      projectId,
      audience: 'producer_team',
      eventType: 'client_materials_updated',
      title,
      message: messageParts.join(' · ') || title,
      linkedEntityType: 'client_material',
      linkedEntityId: PRODUCER_NOTIFICATION_CLIENT_MATERIALS_ENTITY_ID,
      metadata: {
        source: 'client_material',
        mutation,
        materialId: material?.id ?? null,
        entryType: material?.entry_type ?? null,
        title: material?.title ?? null,
        phase: material?.phase ?? null,
      },
      createdByUserId: userId,
      createdByRole: actorRole,
    });
  }

  async function notifyProducerTeamAboutClientReviewDecision(
    projectId: string,
    review: ProducerReviewRow,
    userId: string | null,
    actorRole: string | null,
  ): Promise<void> {
    const normalizedStatus = String(review.status ?? '').trim().toLowerCase();
    const title = normalizedStatus === 'approved'
      ? `Klienten har godkjent «${String(review.title ?? 'leveransen').trim()}»`
      : normalizedStatus === 'changes_requested'
        ? `Klienten ønsker endringer i «${String(review.title ?? 'leveransen').trim()}»`
        : normalizedStatus === 'rejected'
          ? `Klienten har avslått «${String(review.title ?? 'leveransen').trim()}»`
          : `Klienten har oppdatert «${String(review.title ?? 'review').trim()}»`;

    const messageParts = [
      typeof review.description === 'string' && review.description.trim().length > 0
        ? review.description.trim()
        : null,
      typeof review.decision_reason === 'string' && review.decision_reason.trim().length > 0
        ? `Begrunnelse: ${review.decision_reason.trim()}`
        : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    await upsertProducerProjectNotification({
      projectId,
      audience: 'producer_team',
      eventType: 'client_review_decision',
      title,
      message: messageParts.join(' · ') || title,
      linkedEntityType: 'client_review',
      linkedEntityId: review.id,
      metadata: {
        source: 'client_review',
        reviewType: review.review_type ?? null,
        reviewStatus: review.status ?? null,
        targetEntityType: review.target_entity_type ?? null,
        targetEntityId: review.target_entity_id ?? null,
      },
      createdByUserId: userId,
      createdByRole: actorRole,
    });
  }

  async function notifyProducerTeamAboutClientReviewComment(input: {
    projectId: string;
    reviewId: string;
    reviewTitle: string;
    commentText: string;
    timestampSeconds?: number | null;
    userId: string | null;
    actorRole: string | null;
  }): Promise<void> {
    const { projectId, reviewId, reviewTitle, commentText, timestampSeconds, userId, actorRole } = input;
    const trimmedComment = commentText.trim();
    const preview = trimmedComment.length > 180
      ? `${trimmedComment.slice(0, 177).trimEnd()}...`
      : trimmedComment;

    await upsertProducerProjectNotification({
      projectId,
      audience: 'producer_team',
      eventType: 'client_review_comment',
      title: `Klienten har kommentert «${reviewTitle.trim() || 'review'}»`,
      message: timestampSeconds !== null && timestampSeconds !== undefined
        ? `${preview} · Tidskode ${timestampSeconds}s`
        : preview,
      linkedEntityType: 'client_review',
      linkedEntityId: reviewId,
      metadata: {
        source: 'client_review_comment',
        timestampSeconds: timestampSeconds ?? null,
      },
      createdByUserId: userId,
      createdByRole: actorRole,
    });
  }

  function buildRoleRoomVaultAuditMetadata(req: Request, metadata?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      ip: req.ip ?? null,
      userAgent: readOptionalHeaderValue(req, 'user-agent') ?? null,
    };
  }

  async function appendRoleRoomAccessVaultAuditEvent(input: {
    req: Request;
    projectId: string;
    secretId?: string | null;
    revealRequestId?: string | null;
    platform?: ProducerAccountAccessPlatform | null;
    action: RoleRoomAccessVaultAuditAction;
    actorUserId?: string | null;
    actorRole?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO role_room_access_vault_audit_events (
        id, project_id, secret_id, reveal_request_id, platform, action,
        actor_user_id, actor_role, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9::jsonb, NOW()
      )`,
      [
        crypto.randomUUID(),
        input.projectId,
        input.secretId ?? null,
        input.revealRequestId ?? null,
        input.platform ?? null,
        input.action,
        input.actorUserId ?? null,
        input.actorRole ?? null,
        JSON.stringify(buildRoleRoomVaultAuditMetadata(input.req, input.metadata)),
      ],
    );
  }

  function buildRoleRoomStoryLogicResponse(row: RoleRoomStoryLogicRow) {
    return {
      success: true,
      projectId: row.project_id,
      storyLogic: readJsonObject(row.story_logic),
      version: Number(row.version) || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedByUserId: row.updated_by_user_id,
      updatedByRole: row.updated_by_role,
    };
  }

  function normalizeCoverageReviewDecision(value: unknown): Record<string, unknown> | null {
    const record = readRecordValue(value);
    if (!record) return null;

    const next: Record<string, unknown> = {};
    for (const key of ['performance', 'framing', 'continuity', 'selected', 'sentToPost']) {
      const boolValue = readBooleanValue(record[key]);
      if (boolValue !== null) {
        next[key] = boolValue;
      }
    }

    for (const key of ['directorNote', 'editorNote', 'updatedAt']) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const rawValue = record[key];
        next[key] = typeof rawValue === 'string' ? rawValue.slice(0, 10000) : '';
      }
    }

    return next;
  }

  function normalizeCoverageReviewTakeReviews(value: unknown): Record<string, unknown> {
    const record = readRecordValue(value);
    if (!record) return {};

    return Object.entries(record).reduce<Record<string, unknown>>((acc, [takeId, decision]) => {
      const normalizedTakeId = readStringValue(takeId);
      const normalizedDecision = normalizeCoverageReviewDecision(decision);
      if (normalizedTakeId && normalizedDecision) {
        acc[normalizedTakeId] = normalizedDecision;
      }
      return acc;
    }, {});
  }

  function normalizeCoverageLineIndex(value: unknown): number {
    const numberValue = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : 0;
    return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
  }

  function normalizeCoverageReviewShotLineCoverage(value: unknown): Record<string, unknown> {
    const record = readRecordValue(value);
    if (!record) return {};

    return Object.entries(record).reduce<Record<string, unknown>>((acc, [shotId, coverage]) => {
      const normalizedShotId = readStringValue(shotId);
      const coverageRecord = readRecordValue(coverage);
      if (!normalizedShotId || !coverageRecord) return acc;

      const dialogueIds = Array.isArray(coverageRecord.dialogueIds)
        ? coverageRecord.dialogueIds
            .map((dialogueId) => readStringValue(dialogueId))
            .filter((dialogueId): dialogueId is string => Boolean(dialogueId))
            .slice(0, 500)
        : [];

      acc[normalizedShotId] = {
        startLine: normalizeCoverageLineIndex(coverageRecord.startLine),
        endLine: normalizeCoverageLineIndex(coverageRecord.endLine),
        dialogueIds,
      };
      return acc;
    }, {});
  }

  function buildRoleRoomCoverageReviewResponse(row: RoleRoomCoverageReviewRow | null, projectId: string) {
    return {
      success: true,
      projectId,
      takeReviews: row ? normalizeCoverageReviewTakeReviews(row.take_reviews) : {},
      shotLineCoverage: row ? normalizeCoverageReviewShotLineCoverage(row.shot_line_coverage) : {},
      version: row ? Number(row.version) || 1 : 0,
      createdAt: row?.created_at ?? null,
      updatedAt: row?.updated_at ?? null,
      updatedByUserId: row?.updated_by_user_id ?? null,
      updatedByRole: row?.updated_by_role ?? null,
    };
  }

  async function appendRoleRoomCoverageReviewAuditEvent(input: {
    req: Request;
    projectId: string;
    action: string;
    previousVersion?: number | null;
    nextVersion?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const actor = getOptionalRequestUser(input.req);
    await pool.query(
      `INSERT INTO role_room_coverage_review_audit_events (
        id, project_id, action, actor_user_id, actor_role,
        previous_version, next_version, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, NOW()
      )`,
      [
        crypto.randomUUID(),
        input.projectId,
        input.action,
        actor?.userId ?? null,
        actor?.role ?? null,
        input.previousVersion ?? null,
        input.nextVersion ?? null,
        JSON.stringify({
          ...(input.metadata ?? {}),
          ip: input.req.ip ?? null,
          userAgent: readOptionalHeaderValue(input.req, 'user-agent') ?? null,
        }),
      ],
    );
  }

  async function appendRoleRoomStoryLogicAuditEvent(input: {
    req: Request;
    projectId: string;
    action: string;
    previousVersion?: number | null;
    nextVersion?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const actor = getOptionalRequestUser(input.req);
    await pool.query(
      `INSERT INTO role_room_story_logic_audit_events (
        id, project_id, action, actor_user_id, actor_role,
        previous_version, next_version, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, NOW()
      )`,
      [
        crypto.randomUUID(),
        input.projectId,
        input.action,
        actor?.userId ?? null,
        actor?.role ?? null,
        input.previousVersion ?? null,
        input.nextVersion ?? null,
        JSON.stringify({
          ...(input.metadata ?? {}),
          ip: input.req.ip ?? null,
          userAgent: readOptionalHeaderValue(input.req, 'user-agent') ?? null,
        }),
      ],
    );
  }

  function buildRoleRoomAccessVaultSecretSummary(row: RoleRoomAccessVaultSecretRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      platform: row.platform,
      label: readStringValue(row.label),
      secretType: readStringValue(row.secret_type),
      maskedReference: readStringValue(row.masked_reference),
      tier: readStringValue(row.tier),
      riskLevel: readStringValue(row.risk_level),
      revealPolicy: normalizeRoleRoomVaultRevealPolicy(row.reveal_policy),
      status: normalizeRoleRoomVaultSecretStatus(row.status),
      ownerName: readStringValue(row.owner_label),
      sharedWithRoles: normalizeRoleRoomVaultRoleTargets(row.shared_with_roles),
      expiresAt: row.expires_at ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      lastRevealedAt: row.last_revealed_at ?? null,
      revokedAt: row.revoked_at ?? null,
      hasStoredSecret: Boolean(readStringValue(row.secret_encrypted)),
      hasUsername: Boolean(readStringValue(row.username_encrypted)),
      hasBackupCode: Boolean(readStringValue(row.backup_code_encrypted)),
    };
  }

  function buildRoleRoomAccessVaultRevealRequestResponse(row: RoleRoomAccessVaultRevealRequestRow) {
    return {
      id: row.id,
      secretId: row.secret_id,
      projectId: row.project_id,
      platform: row.platform,
      status: (() => {
        const normalized = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        if (
          normalized === 'approved'
          || normalized === 'rejected'
          || normalized === 'revealed'
          || normalized === 'expired'
        ) {
          return normalized as RoleRoomAccessVaultRevealRequestStatus;
        }
        return 'pending' as const;
      })(),
      requestReason: readStringValue(row.request_reason),
      approvalNotes: readStringValue(row.approval_notes),
      requestedByUserId: readStringValue(row.requested_by_user_id),
      requestedByRole: readStringValue(row.requested_by_role),
      approvedByUserId: readStringValue(row.approved_by_user_id),
      approvedByRole: readStringValue(row.approved_by_role),
      requestedAt: row.requested_at ?? null,
      approvedAt: row.approved_at ?? null,
      rejectedAt: row.rejected_at ?? null,
      revealedAt: row.revealed_at ?? null,
      expiresAt: row.expires_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }

  function buildRoleRoomAccessVaultAuditResponse(row: RoleRoomAccessVaultAuditRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      secretId: readStringValue(row.secret_id),
      revealRequestId: readStringValue(row.reveal_request_id),
      platform: normalizeProducerAccountAccessPlatform(row.platform),
      action: readStringValue(row.action),
      actorUserId: readStringValue(row.actor_user_id),
      actorRole: readStringValue(row.actor_role),
      metadata: readJsonObject(row.metadata),
      createdAt: row.created_at ?? null,
    };
  }

  async function getRoleRoomAccessVaultSecretByPlatform(
    projectId: string,
    platform: ProducerAccountAccessPlatform,
  ): Promise<RoleRoomAccessVaultSecretRow | null> {
    const result = await pool.query(
      `SELECT *
       FROM role_room_access_vault_secrets
       WHERE project_id = $1
         AND platform = $2
       LIMIT 1`,
      [projectId, platform],
    );
    return (result.rows[0] as RoleRoomAccessVaultSecretRow | undefined) ?? null;
  }

  function readProducerPhaseFromMetadata(metadata?: Record<string, unknown> | null): string | null {
    const phase = typeof metadata?.focusedPhase === 'string'
      ? metadata.focusedPhase.trim().toLowerCase()
      : typeof metadata?.phase === 'string'
        ? metadata.phase.trim().toLowerCase()
        : '';

    if (phase === 'preproduction' || phase === 'production' || phase === 'postproduction') {
      return phase;
    }
    return null;
  }

  function getProducerReviewTimelinePhase(
    reviewType?: string | null,
    targetEntityType?: string | null,
    metadata?: Record<string, unknown> | null,
  ): string {
    const normalizedReviewType = String(reviewType ?? '').trim().toLowerCase();
    const normalizedTargetEntityType = String(targetEntityType ?? '').trim().toLowerCase();
    const metadataPhase = readProducerPhaseFromMetadata(metadata);

    if (metadataPhase) {
      return metadataPhase;
    }

    if (normalizedReviewType === 'budget_package' || normalizedTargetEntityType === 'economy') {
      return 'preproduction';
    }

    if (normalizedReviewType === 'change_order') {
      return 'production';
    }

    if (normalizedReviewType === 'phase_checkpoint' || normalizedTargetEntityType === 'phase_plan') {
      return 'preproduction';
    }

    if (normalizedReviewType === 'content_delivery' || normalizedTargetEntityType === 'content_calendar') {
      return 'postproduction';
    }

    if (['storyboard', 'manuscript', 'shotlist', 'scene_notes', 'location_plan', 'equipment_plan'].includes(normalizedReviewType)) {
      return 'preproduction';
    }

    if (normalizedTargetEntityType === 'shot') {
      return 'production';
    }

    return 'preproduction';
  }

  function getProducerReviewTimelineStatus(reviewStatus?: string | null): string {
    switch (String(reviewStatus ?? '').trim().toLowerCase()) {
      case 'approved':
        return 'completed';
      case 'rejected':
      case 'changes_requested':
        return 'blocked';
      case 'in_progress':
        return 'in_progress';
      default:
        return 'planned';
    }
  }

  function getProducerReviewTimelineDescription(review: ProducerReviewRow): string | null {
    const parts = [
      typeof review.description === 'string' && review.description.trim() ? review.description.trim() : null,
      review.status === 'approved'
        ? 'Godkjent av klient.'
        : review.status === 'changes_requested'
          ? 'Klienten har bedt om endringer.'
          : review.status === 'rejected'
            ? 'Klienten har avslått leveransen.'
            : 'Venter på klientgodkjenning.',
      typeof review.decision_reason === 'string' && review.decision_reason.trim() ? review.decision_reason.trim() : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' ') : null;
  }

  async function upsertProducerReviewTimelineItem(
    projectId: string,
    review: ProducerReviewRow,
    userId: string | null,
  ): Promise<void> {
    const existingResult = await pool.query(
      `SELECT id
       FROM role_room_phase_timeline_items
       WHERE project_id = $1
         AND linked_entity_type = 'client_review'
         AND linked_entity_id = $2
       ORDER BY created_at ASC`,
      [projectId, review.id],
    );

    const title = `Klientgodkjenning · ${String(review.title ?? 'Review').trim()}`;
    const description = getProducerReviewTimelineDescription(review);
    const phase = getProducerReviewTimelinePhase(review.review_type, review.target_entity_type, review.metadata ?? null);
    const status = getProducerReviewTimelineStatus(review.status);
    const metadata = JSON.stringify({
      ...(review.metadata ?? {}),
      source: 'review-sync',
      reviewId: review.id,
      reviewType: review.review_type ?? null,
      reviewStatus: review.status ?? null,
      targetEntityType: review.target_entity_type ?? null,
      targetEntityId: review.target_entity_id ?? null,
    });

    const primaryExistingId = existingResult.rows[0]?.id as string | undefined;

    if (primaryExistingId) {
      await pool.query(
        `UPDATE role_room_phase_timeline_items
         SET phase = $1,
             title = $2,
             description = $3,
             due_at = $4,
             status = $5,
             metadata = $6::jsonb,
             updated_at = NOW()
         WHERE id = $7`,
        [
          phase,
          title,
          description,
          review.due_at ?? null,
          status,
          metadata,
          primaryExistingId,
        ],
      );

      const duplicateIds = existingResult.rows
        .slice(1)
        .map((row) => row.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (duplicateIds.length > 0) {
        await pool.query(
          `DELETE FROM role_room_phase_timeline_items
           WHERE project_id = $1
             AND id = ANY($2::uuid[])`,
          [projectId, duplicateIds],
        );
      }

      return;
    }

    await pool.query(
      `INSERT INTO role_room_phase_timeline_items (
        id, project_id, phase, title, description, due_at, status,
        linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'client_review', $8, 0, $9::jsonb, $10, NOW(), NOW()
      )`,
      [
        crypto.randomUUID(),
        projectId,
        phase,
        title,
        description,
        review.due_at ?? null,
        status,
        review.id,
        metadata,
        userId,
      ],
    );
  }

  let producerWorkflowTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureProducerWorkflowTables(): Promise<boolean> {
    if (producerWorkflowTablesReadyPromise) return producerWorkflowTablesReadyPromise;
    producerWorkflowTablesReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_phase_timeline_items (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            phase VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            owner_user_id VARCHAR(255),
            due_at TIMESTAMPTZ,
            status VARCHAR(32) NOT NULL DEFAULT 'planned',
            linked_entity_type VARCHAR(100),
            linked_entity_id VARCHAR(255),
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_project ON role_room_phase_timeline_items(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_phase ON role_room_phase_timeline_items(phase);

          CREATE TABLE IF NOT EXISTS role_room_budget_items (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            phase VARCHAR(32) NOT NULL,
            category VARCHAR(120) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            description TEXT,
            estimate NUMERIC(12, 2) NOT NULL DEFAULT 0,
            approved NUMERIC(12, 2) NOT NULL DEFAULT 0,
            actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'NOK',
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            client_visible BOOLEAN NOT NULL DEFAULT TRUE,
            linked_entity_type VARCHAR(100),
            linked_entity_id VARCHAR(255),
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_budget_project ON role_room_budget_items(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_budget_phase ON role_room_budget_items(phase);

          CREATE TABLE IF NOT EXISTS role_room_client_reviews (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            review_type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            target_entity_type VARCHAR(100),
            target_entity_id VARCHAR(255),
            requested_by_user_id VARCHAR(255),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            due_at TIMESTAMPTZ,
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            decision_by_user_id VARCHAR(255),
            decision_at TIMESTAMPTZ,
            decision_reason TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_project ON role_room_client_reviews(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_status ON role_room_client_reviews(status);

          CREATE TABLE IF NOT EXISTS role_room_client_review_comments (
            id UUID PRIMARY KEY,
            review_id UUID NOT NULL REFERENCES role_room_client_reviews(id) ON DELETE CASCADE,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            author_user_id VARCHAR(255),
            author_role VARCHAR(80),
            comment_text TEXT NOT NULL,
            timestamp_seconds INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_review_comments_project ON role_room_client_review_comments(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_review_comments_review ON role_room_client_review_comments(review_id);

          CREATE TABLE IF NOT EXISTS role_room_client_intake (
            project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
            project_goal TEXT,
            deliverables TEXT,
            target_audience TEXT,
            key_message TEXT,
            timing_constraints TEXT,
            brand_notes TEXT,
            material_overview TEXT,
            reference_links TEXT,
            contact_name TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            additional_notes TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            updated_by_user_id TEXT,
            updated_by_role TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS role_room_client_materials (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            entry_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            external_url TEXT,
            phase TEXT,
            linked_shot_list_id TEXT,
            status TEXT DEFAULT 'provided',
            metadata JSONB DEFAULT '{}'::jsonb,
            created_by_user_id TEXT,
            created_by_role TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_client_materials_project ON role_room_client_materials(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_client_materials_phase ON role_room_client_materials(phase);

          CREATE TABLE IF NOT EXISTS role_room_story_logic (
            project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
            story_logic JSONB NOT NULL DEFAULT '{}'::jsonb,
            version INTEGER NOT NULL DEFAULT 1,
            updated_by_user_id VARCHAR(255),
            updated_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS role_room_story_logic_audit_events (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            action VARCHAR(80) NOT NULL,
            actor_user_id VARCHAR(255),
            actor_role VARCHAR(80),
            previous_version INTEGER,
            next_version INTEGER,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_story_logic_audit_project
            ON role_room_story_logic_audit_events(project_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_coverage_reviews (
            project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
            take_reviews JSONB NOT NULL DEFAULT '{}'::jsonb,
            shot_line_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
            version INTEGER NOT NULL DEFAULT 1,
            updated_by_user_id VARCHAR(255),
            updated_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS role_room_coverage_review_audit_events (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            action VARCHAR(80) NOT NULL,
            actor_user_id VARCHAR(255),
            actor_role VARCHAR(80),
            previous_version INTEGER,
            next_version INTEGER,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_coverage_review_audit_project
            ON role_room_coverage_review_audit_events(project_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_project_notifications (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            audience VARCHAR(32) NOT NULL DEFAULT 'producer_team',
            event_type VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            linked_entity_type VARCHAR(100),
            linked_entity_id VARCHAR(255),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by_user_id VARCHAR(255),
            created_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_project ON role_room_project_notifications(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_audience ON role_room_project_notifications(audience);
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_updated ON role_room_project_notifications(updated_at DESC);
          ALTER TABLE role_room_project_notifications
            ADD COLUMN IF NOT EXISTS inbox_type VARCHAR(80) NOT NULL DEFAULT 'general',
            ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS assigned_to_label VARCHAR(255),
            ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS resolved_by_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS archived_by_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS mention_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS mention_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_inbox_type
            ON role_room_project_notifications(project_id, inbox_type, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_client
            ON role_room_project_notifications(project_id, client_email, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_due
            ON role_room_project_notifications(project_id, due_at)
            WHERE due_at IS NOT NULL AND resolved_at IS NULL AND archived_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_rr_project_notifications_open
            ON role_room_project_notifications(project_id, updated_at DESC)
            WHERE archived_at IS NULL;

          CREATE TABLE IF NOT EXISTS role_room_project_notification_reads (
            notification_id UUID NOT NULL REFERENCES role_room_project_notifications(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL,
            read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (notification_id, user_id)
          );
          CREATE INDEX IF NOT EXISTS idx_rr_notification_reads_user ON role_room_project_notification_reads(user_id, read_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_expenses (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            merchant_name VARCHAR(255),
            expense_date DATE,
            amount NUMERIC(12,2),
            vat_amount NUMERIC(12,2),
            currency VARCHAR(12) NOT NULL DEFAULT 'NOK',
            category VARCHAR(120),
            paid_by_user_id VARCHAR(255),
            paid_by_label VARCHAR(255),
            cost_owner VARCHAR(120) NOT NULL DEFAULT 'client',
            refund_status VARCHAR(80) NOT NULL DEFAULT 'not_requested',
            client_approval_status VARCHAR(80) NOT NULL DEFAULT 'pending',
            duplicate_of_expense_id UUID REFERENCES role_room_expenses(id) ON DELETE SET NULL,
            ocr_status VARCHAR(80) NOT NULL DEFAULT 'pending',
            ocr_confidence NUMERIC(5,4),
            ocr_review_required BOOLEAN NOT NULL DEFAULT TRUE,
            amount_validation_status VARCHAR(80) NOT NULL DEFAULT 'pending',
            vat_validation_status VARCHAR(80) NOT NULL DEFAULT 'pending',
            privacy_notice_acknowledged_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by_user_id VARCHAR(255),
            created_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_expenses_project
            ON role_room_expenses(project_id, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_expenses_refund
            ON role_room_expenses(project_id, refund_status, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_expenses_client_approval
            ON role_room_expenses(project_id, client_approval_status, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_expenses_duplicate_lookup
            ON role_room_expenses(project_id, merchant_name, expense_date, amount);

          CREATE TABLE IF NOT EXISTS role_room_expense_receipt_files (
            id UUID PRIMARY KEY,
            expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            file_name VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            mime_type VARCHAR(160),
            file_size BIGINT,
            storage_path TEXT NOT NULL,
            sha256 VARCHAR(128),
            page_count INTEGER,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            uploaded_by_user_id VARCHAR(255),
            uploaded_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_expense_receipts_expense
            ON role_room_expense_receipt_files(expense_id, created_at DESC);
          DROP INDEX IF EXISTS idx_rr_expense_receipts_hash;
          CREATE INDEX IF NOT EXISTS idx_rr_expense_receipts_hash
            ON role_room_expense_receipt_files(project_id, sha256)
            WHERE sha256 IS NOT NULL;

          CREATE TABLE IF NOT EXISTS role_room_receipt_ocr_jobs (
            id UUID PRIMARY KEY,
            expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
            receipt_file_id UUID REFERENCES role_room_expense_receipt_files(id) ON DELETE SET NULL,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            status VARCHAR(80) NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            confidence NUMERIC(5,4),
            extracted_text TEXT,
            extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
            engine VARCHAR(120) NOT NULL DEFAULT 'server-heuristic',
            last_error TEXT,
            queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_jobs_project
            ON role_room_receipt_ocr_jobs(project_id, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_jobs_status
            ON role_room_receipt_ocr_jobs(status, queued_at);

          CREATE TABLE IF NOT EXISTS role_room_receipt_ocr_audit_events (
            id UUID PRIMARY KEY,
            expense_id UUID NOT NULL REFERENCES role_room_expenses(id) ON DELETE CASCADE,
            receipt_file_id UUID REFERENCES role_room_expense_receipt_files(id) ON DELETE SET NULL,
            ocr_job_id UUID REFERENCES role_room_receipt_ocr_jobs(id) ON DELETE SET NULL,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL,
            actor_user_id VARCHAR(255),
            actor_role VARCHAR(80),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_receipt_ocr_audit_project
            ON role_room_receipt_ocr_audit_events(project_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_receipt_merchant_registry (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            merchant_name VARCHAR(255) NOT NULL,
            normalized_name VARCHAR(255) NOT NULL,
            default_category VARCHAR(120),
            organization_number VARCHAR(64),
            vat_registered BOOLEAN,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_receipt_merchants_unique
            ON role_room_receipt_merchant_registry(project_id, normalized_name);

          CREATE TABLE IF NOT EXISTS role_room_push_subscriptions (
            id UUID PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            scope VARCHAR(32) NOT NULL DEFAULT 'producer_team',
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_sent_at TIMESTAMPTZ,
            last_error TEXT,
            disabled_at TIMESTAMPTZ
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_push_subscriptions_unique_endpoint
            ON role_room_push_subscriptions(project_id, scope, endpoint);
          CREATE INDEX IF NOT EXISTS idx_rr_push_subscriptions_project
            ON role_room_push_subscriptions(project_id, scope, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_push_subscriptions_user
            ON role_room_push_subscriptions(user_id, updated_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_access_vault_secrets (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            platform VARCHAR(32) NOT NULL,
            label VARCHAR(255),
            secret_type VARCHAR(120),
            username_encrypted TEXT,
            secret_encrypted TEXT,
            backup_code_encrypted TEXT,
            masked_reference TEXT,
            tier VARCHAR(32) NOT NULL DEFAULT 'sensitive_secret',
            risk_level VARCHAR(32) NOT NULL DEFAULT 'medium',
            reveal_policy VARCHAR(32) NOT NULL DEFAULT 'approval_required',
            status VARCHAR(32) NOT NULL DEFAULT 'not_shared',
            owner_label VARCHAR(255),
            shared_with_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
            expires_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by_user_id VARCHAR(255),
            created_by_role VARCHAR(80),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_revealed_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_access_vault_secrets_platform
            ON role_room_access_vault_secrets(project_id, platform);
          CREATE INDEX IF NOT EXISTS idx_rr_access_vault_secrets_project
            ON role_room_access_vault_secrets(project_id, updated_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_access_vault_reveal_requests (
            id UUID PRIMARY KEY,
            secret_id UUID NOT NULL REFERENCES role_room_access_vault_secrets(id) ON DELETE CASCADE,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            platform VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            request_reason TEXT,
            approval_notes TEXT,
            requested_by_user_id VARCHAR(255),
            requested_by_role VARCHAR(80),
            approved_by_user_id VARCHAR(255),
            approved_by_role VARCHAR(80),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            approved_at TIMESTAMPTZ,
            rejected_at TIMESTAMPTZ,
            revealed_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_access_vault_requests_project
            ON role_room_access_vault_reveal_requests(project_id, requested_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_access_vault_requests_secret
            ON role_room_access_vault_reveal_requests(secret_id, requested_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_access_vault_audit_events (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            secret_id UUID REFERENCES role_room_access_vault_secrets(id) ON DELETE SET NULL,
            reveal_request_id UUID REFERENCES role_room_access_vault_reveal_requests(id) ON DELETE SET NULL,
            platform VARCHAR(32),
            action VARCHAR(64) NOT NULL,
            actor_user_id VARCHAR(255),
            actor_role VARCHAR(80),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_access_vault_audit_project
            ON role_room_access_vault_audit_events(project_id, created_at DESC);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room producer workflow tables unavailable:', error);
        return false;
      }
    })();
    return producerWorkflowTablesReadyPromise;
  }

  let roleRoomPublicProofTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomPublicProofTables(): Promise<boolean> {
    if (roleRoomPublicProofTablesReadyPromise) return roleRoomPublicProofTablesReadyPromise;
    roleRoomPublicProofTablesReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_testimonials (
            id UUID PRIMARY KEY,
            role_id VARCHAR(100) NOT NULL,
            quote_text TEXT NOT NULL,
            author_name VARCHAR(255) NOT NULL,
            author_title VARCHAR(255),
            author_user_id VARCHAR(255),
            author_email VARCHAR(255),
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            is_featured BOOLEAN NOT NULL DEFAULT FALSE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            approved_by_user_id VARCHAR(255),
            approved_at TIMESTAMPTZ,
            rejected_reason TEXT,
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_testimonials_status ON role_room_testimonials(status);
          CREATE INDEX IF NOT EXISTS idx_rr_testimonials_role ON role_room_testimonials(role_id);
          CREATE INDEX IF NOT EXISTS idx_rr_testimonials_sort ON role_room_testimonials(is_featured DESC, sort_order ASC, published_at DESC, created_at DESC);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room public proof tables unavailable:', error);
        return false;
      }
    })();
    return roleRoomPublicProofTablesReadyPromise;
  }

  let roleRoomTalentPortalTablesReadyPromise: Promise<boolean> | null = null;
  let roleRoomClientInviteTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomTalentPortalTables(): Promise<boolean> {
    if (roleRoomTalentPortalTablesReadyPromise) return roleRoomTalentPortalTablesReadyPromise;
    roleRoomTalentPortalTablesReadyPromise = (async () => {
      try {
        const castingProjectsReady = await ensureCastingProjectsTable();
        if (!castingProjectsReady) {
          return false;
        }

        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_talent_invites (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
            email VARCHAR(255),
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            status VARCHAR(40) NOT NULL DEFAULT 'sent',
            created_by_user_id VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_sent_at TIMESTAMPTZ,
            last_viewed_at TIMESTAMPTZ,
            accepted_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
          );
          CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_project ON role_room_talent_invites(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_candidate ON role_room_talent_invites(candidate_id);
          CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_email ON role_room_talent_invites(email);
          CREATE INDEX IF NOT EXISTS idx_rr_talent_invites_status ON role_room_talent_invites(status);

          CREATE TABLE IF NOT EXISTS role_room_talent_activity (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
            entry_type VARCHAR(80) NOT NULL DEFAULT 'update',
            title TEXT NOT NULL,
            body TEXT,
            visibility VARCHAR(40) NOT NULL DEFAULT 'shared',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by_user_id VARCHAR(255),
            created_by_role VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_talent_activity_candidate ON role_room_talent_activity(candidate_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_talent_activity_project ON role_room_talent_activity(project_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS role_room_talent_uploads (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
            media_kind VARCHAR(40) NOT NULL DEFAULT 'video',
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            mime_type VARCHAR(255),
            size_bytes BIGINT,
            access_token_hash VARCHAR(255),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by_user_id VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_talent_uploads_candidate ON role_room_talent_uploads(candidate_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rr_talent_uploads_project ON role_room_talent_uploads(project_id, created_at DESC);
        `);

        await fs.mkdir(ROLE_ROOM_TALENT_UPLOAD_ROOT, { recursive: true });
        return true;
      } catch (error) {
        console.warn('Role Room talent portal tables unavailable:', error);
        return false;
      }
    })();
    return roleRoomTalentPortalTablesReadyPromise;
  }

  async function ensureRoleRoomClientInviteTables(): Promise<boolean> {
    if (roleRoomClientInviteTablesReadyPromise) return roleRoomClientInviteTablesReadyPromise;
    roleRoomClientInviteTablesReadyPromise = (async () => {
      try {
        const castingProjectsReady = await ensureCastingProjectsTable();
        if (!castingProjectsReady) {
          return false;
        }

        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_client_invites (
            id UUID PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            status VARCHAR(40) NOT NULL DEFAULT 'sent',
            created_by_user_id VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_sent_at TIMESTAMPTZ,
            last_viewed_at TIMESTAMPTZ,
            accepted_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
          );
          CREATE INDEX IF NOT EXISTS idx_rr_client_invites_project ON role_room_client_invites(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_client_invites_email ON role_room_client_invites(email);
          CREATE INDEX IF NOT EXISTS idx_rr_client_invites_status ON role_room_client_invites(status);
        `);

        return true;
      } catch (error) {
        console.warn('Role Room client invite tables unavailable:', error);
        return false;
      }
    })();
    return roleRoomClientInviteTablesReadyPromise;
  }

  function normalizeRoleRoomTestimonialRoleId(value: unknown): string {
    const normalized = readStringValue(value)?.trim().toLowerCase() ?? '';
    if (!normalized) {
      return 'talent';
    }

    const aliases: Record<string, string> = {
      reader: 'talent',
      actor: 'talent',
      skuespiller: 'talent',
      content_producer: 'film_photographer',
      client_reviewer: 'client',
      camera_team: 'camera_operator',
      photo_assistant: 'photo_assistant',
    };

    return aliases[normalized] ?? normalized;
  }

  function getRoleRoomTestimonialDefaultTitle(roleId: string): string {
    switch (roleId) {
      case 'casting_director':
        return 'Casting Director';
      case 'director':
        return 'Regissor';
      case 'producer':
        return 'Produsent';
      case 'film_photographer':
        return 'Innholdsprodusent';
      case 'photographer':
        return 'Fotograf';
      case 'photo_director':
        return 'Fotodirektor';
      case 'photo_assistant':
        return 'Fotoassistent';
      case 'camera_operator':
        return 'Kamera';
      case 'talent':
        return 'Skuespiller';
      case 'agent':
        return 'Agent';
      case 'client':
        return 'Klient';
      default:
        return 'Creator';
    }
  }

  function mapRoleRoomPublicTestimonial(row: Partial<RoleRoomPublicTestimonialRow>) {
    const roleId = normalizeRoleRoomTestimonialRoleId(row.role_id);
    return {
      id: readStringValue(row.id) ?? makeId(),
      roleId,
      quote: readStringValue(row.quote_text) ?? '',
      author: readStringValue(row.author_name) ?? 'Anonym',
      title: readStringValue(row.author_title) ?? getRoleRoomTestimonialDefaultTitle(roleId),
      featured: row.is_featured === true,
      publishedAt: readStringValue(row.published_at) ?? readStringValue(row.created_at),
    };
  }

  function normalizeRoleRoomTalentMediaEntry(
    entry: unknown,
    kind: 'video' | 'photo',
  ): Record<string, unknown> | null {
    if (typeof entry === 'string') {
      const url = readExternalUrlValue(entry);
      if (!url) {
        return null;
      }
      return {
        id: makeId(),
        kind,
        title: kind === 'video' ? 'Innsendt video' : 'Profilbilde',
        url,
      };
    }

    const record = readRecordValue(entry);
    if (!record) {
      return null;
    }

    const internalUrl = readStringValue(record.url)?.startsWith('/api/')
      ? readStringValue(record.url)
      : readStringValue(record.downloadUrl)?.startsWith('/api/')
        ? readStringValue(record.downloadUrl)
        : null;
    const url = internalUrl
      ?? readExternalUrlValue(record.url)
      ?? readExternalUrlValue(record.downloadUrl)
      ?? readExternalUrlValue(record.videoUrl)
      ?? readExternalUrlValue(record.photoUrl)
      ?? readExternalUrlValue(record.src)
      ?? readExternalUrlValue(record.href)
      ?? readExternalUrlValue(record.link);

    if (!url) {
      return null;
    }

    return {
      id: readStringValue(record.id) ?? makeId(),
      kind,
      title: readStringValue(record.title)
        ?? readStringValue(record.name)
        ?? (kind === 'video' ? 'Innsendt video' : 'Profilbilde'),
      url,
      thumbnailUrl: readExternalUrlValue(record.thumbnailUrl)
        ?? readExternalUrlValue(record.posterUrl)
        ?? readExternalUrlValue(record.previewUrl),
      notes: readStringValue(record.notes),
      source: readStringValue(record.source) ?? 'talent_portal',
      submittedAt: readStringValue(record.submittedAt)
        ?? readStringValue(record.createdAt)
        ?? readStringValue(record.updatedAt),
      requiresAuth: readBooleanValue(record.requiresAuth) ?? internalUrl !== null,
      mimeType: readStringValue(record.mimeType),
      sizeBytes:
        typeof record.sizeBytes === 'number' && Number.isFinite(record.sizeBytes)
          ? record.sizeBytes
          : typeof record.size === 'number' && Number.isFinite(record.size)
            ? record.size
            : null,
      downloadName: readStringValue(record.downloadName) ?? readStringValue(record.originalName),
      durationSeconds:
        typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
          ? record.durationSeconds
          : typeof record.duration === 'number' && Number.isFinite(record.duration)
            ? record.duration
            : null,
    };
  }

  function normalizeRoleRoomTalentMediaList(
    value: unknown,
    kind: 'video' | 'photo',
  ): Record<string, unknown>[] {
    return readJsonArray(value)
      .map((entry) => normalizeRoleRoomTalentMediaEntry(entry, kind))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }

  function buildRoleRoomTalentPortalCandidate(row: RoleRoomTalentPortalCandidateRow) {
    const metadata = readJsonObject(row.metadata);
    const talentProfile = readJsonObject(metadata.talentProfile);
    return {
      id: row.id,
      projectId: row.project_id,
      name: readStringValue(row.name) ?? 'Talent',
      email: normalizeEmailValue(row.email),
      phone: readStringValue(row.phone),
      agency: readStringValue(row.agency),
      notes: readStringValue(row.notes),
      status: readStringValue(row.status) ?? 'pending',
      rating: typeof row.rating === 'number' && Number.isFinite(row.rating) ? row.rating : null,
      assignedRoleIds: toStringArray(row.assigned_roles),
      consentStatus: readStringValue(row.consent_status),
      emergencyContact: readJsonObject(row.emergency_contact),
      photos: normalizeRoleRoomTalentMediaList(row.photos, 'photo'),
      videos: normalizeRoleRoomTalentMediaList(row.videos, 'video'),
      profile: {
        bio: readStringValue(talentProfile.bio),
        city: readStringValue(talentProfile.city),
        baseLocation: readStringValue(talentProfile.baseLocation),
        website: readExternalUrlValue(talentProfile.website),
        instagram: readExternalUrlValue(talentProfile.instagram),
        portfolioUrl: readExternalUrlValue(talentProfile.portfolioUrl),
        showreelUrl: readExternalUrlValue(talentProfile.showreelUrl),
        languages: toStringArray(talentProfile.languages),
      },
      reminderPrefs: normalizeReminderPrefs(row.reminder_prefs),
      metadata,
      createdAt: readStringValue(row.created_at),
      updatedAt: readStringValue(row.updated_at),
    };
  }

  function buildRoleRoomTalentPortalRole(row: RoleRoomTalentPortalRoleRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: readStringValue(row.name) ?? 'Ukjent rolle',
      description: readStringValue(row.description),
      ageRange: readStringValue(row.age_range),
      gender: readStringValue(row.gender),
      roleType: readStringValue(row.role_type),
      status: readStringValue(row.status) ?? 'open',
      assignedCandidateId: readStringValue(row.assigned_candidate_id),
      candidateIds: toStringArray(row.candidate_ids),
      requirements: readJsonObject(row.requirements),
    };
  }

  function buildRoleRoomTalentPortalSchedule(row: RoleRoomTalentPortalScheduleRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      candidateId: readStringValue(row.candidate_id),
      roleId: readStringValue(row.role_id),
      roleName: readStringValue(row.role_name),
      date: readStringValue(row.date),
      startTime: readStringValue(row.start_time),
      endTime: readStringValue(row.end_time),
      type: readStringValue(row.type) ?? 'audition',
      status: readStringValue(row.status) ?? 'scheduled',
      notes: readStringValue(row.notes),
      location: readStringValue(row.location),
      createdAt: readStringValue(row.created_at),
      updatedAt: readStringValue(row.updated_at),
    };
  }

  function isTalentScopedRole(role: string | null | undefined): boolean {
    const normalized = readStringValue(role)?.toLowerCase() ?? '';
    return ['talent', 'actor', 'reader'].includes(normalized);
  }

  function isTalentScopedRequest(req: Request): boolean {
    return isTalentScopedRole(getOptionalRequestUser(req)?.role);
  }

  async function createRoleRoomTalentActivityEntry(payload: {
    projectId: string;
    candidateId: string;
    entryType: string;
    title: string;
    body?: string | null;
    visibility?: string | null;
    metadata?: Record<string, unknown> | null;
    createdByUserId?: string | null;
    createdByRole?: string | null;
  }): Promise<void> {
    if (!(await ensureRoleRoomTalentPortalTables())) {
      return;
    }

    await pool.query(
      `INSERT INTO role_room_talent_activity (
        id, project_id, candidate_id, entry_type, title, body, visibility, metadata, created_by_user_id, created_by_role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        makeId(),
        payload.projectId,
        payload.candidateId,
        payload.entryType,
        payload.title,
        payload.body ?? null,
        readStringValue(payload.visibility) ?? 'shared',
        JSON.stringify(payload.metadata ?? {}),
        payload.createdByUserId ?? null,
        payload.createdByRole ?? null,
      ],
    );
  }

  async function getRoleRoomTalentScopedCandidates(
    projectId: string,
    requestEmail: string,
  ): Promise<RoleRoomTalentPortalCandidateRow[]> {
    const normalizedEmail = normalizeEmailValue(requestEmail);
    if (!normalizedEmail) {
      return [];
    }

    const result = await pool.query<RoleRoomTalentPortalCandidateRow>(
      `SELECT cc.*, cp.name AS project_name
         FROM casting_candidates cc
         INNER JOIN casting_projects cp
           ON cp.id = cc.project_id
        WHERE cc.project_id = $1
          AND LOWER(COALESCE(cc.email, '')) = LOWER($2)
        ORDER BY cc.updated_at DESC, cc.created_at DESC`,
      [projectId, normalizedEmail],
    );

    return result.rows;
  }

  function buildRoleRoomTalentPortalInvite(
    row: RoleRoomTalentInviteRow,
    options?: {
      inviteUrl?: string | null;
      previewUrl?: string | null;
    },
  ) {
    return {
      id: row.id,
      email: normalizeEmailValue(row.email),
      status: readStringValue(row.status) ?? 'sent',
      expiresAt: readStringValue(row.expires_at),
      lastSentAt: readStringValue(row.last_sent_at),
      lastViewedAt: readStringValue(row.last_viewed_at),
      acceptedAt: readStringValue(row.accepted_at),
      metadata: readJsonObject(row.metadata),
      inviteUrl: readStringValue(options?.inviteUrl ?? null),
      previewUrl: readStringValue(options?.previewUrl ?? null),
    };
  }

  function buildRoleRoomTalentPortalActivity(row: RoleRoomTalentActivityRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      candidateId: row.candidate_id,
      entryType: readStringValue(row.entry_type) ?? 'update',
      title: row.title,
      body: readStringValue(row.body),
      visibility: readStringValue(row.visibility) ?? 'shared',
      metadata: readJsonObject(row.metadata),
      createdByRole: readStringValue(row.created_by_role),
      createdAt: readStringValue(row.created_at),
    };
  }

  function getRoleRoomTalentUploadDownloadPath(uploadId: string): string {
    return `/api/role-room/talent/uploads/${uploadId}/content`;
  }

  function buildRoleRoomTalentUploadVideoRecord(options: {
    uploadId: string;
    title: string;
    notes?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    originalName?: string | null;
    submittedAt: string;
  }): Record<string, unknown> {
    return {
      id: options.uploadId,
      kind: 'video',
      title: options.title,
      url: getRoleRoomTalentUploadDownloadPath(options.uploadId),
      notes: options.notes ?? null,
      source: 'talent_upload',
      submittedAt: options.submittedAt,
      requiresAuth: true,
      mimeType: options.mimeType ?? null,
      sizeBytes: options.sizeBytes ?? null,
      downloadName: options.originalName ?? null,
    };
  }

  async function ensureRoleRoomTalentUploadDirectory(projectId: string, candidateId: string): Promise<string> {
    const directory = path.join(
      ROLE_ROOM_TALENT_UPLOAD_ROOT,
      sanitizeRoleRoomTalentFileSegment(projectId, 'project'),
      sanitizeRoleRoomTalentFileSegment(candidateId, 'candidate'),
    );
    await fs.mkdir(directory, { recursive: true });
    return directory;
  }

  function buildRoleRoomTalentInviteUrl(req: Request, options: {
    projectId: string;
    candidateId: string;
    inviteToken: string;
    browserOrigin?: string | null;
  }): string {
    const configuredOrigin = sanitizeRoleRoomBrowserOrigin(
      process.env.ROLE_ROOM_TALENT_PORTAL_ORIGIN
      ?? process.env.ROLE_ROOM_PUBLIC_ORIGIN
      ?? process.env.ROLE_ROOM_FRONTEND_ORIGIN,
    );
    const origin = sanitizeRoleRoomBrowserOrigin(options.browserOrigin)
      ?? configuredOrigin
      ?? getRoleRoomRequestOrigin(req)
      ?? DEFAULT_ROLE_ROOM_TALENT_PUBLIC_ORIGIN;
    const url = new URL('/theroleroom', origin);
    url.searchParams.set('portal', 'talent');
    url.searchParams.set('projectId', options.projectId);
    url.searchParams.set('candidateId', options.candidateId);
    url.searchParams.set('inviteToken', options.inviteToken);
    url.searchParams.set('section', 'overview');
    return url.toString();
  }

  function buildRoleRoomClientInviteUrl(_req: Request, options: {
    inviteToken: string;
    browserOrigin?: string | null;
  }): string {
    // Klientportalen er host'et eksklusivt på theroleroom.com — IKKE
    // creatorhubn.com eller andre admin-room-domener. Hvis Daniel åpnet
    // invite-flyten via creatorhubn.com (cross-domain admin), sendte
    // frontend tidligere browserOrigin='https://creatorhubn.com' som ble
    // brukt direkte i magic-linken og dro klienten til feil domene.
    // Nå ignoreres browserOrigin + request-origin helt for klient-invite-
    // URL-en. Kun env-konfigurert origin overstyrer default, og det skal
    // bare brukes ved spesialhosting (f.eks. partner-domene).
    const configuredOrigin = sanitizeRoleRoomBrowserOrigin(
      process.env.ROLE_ROOM_CLIENT_PORTAL_ORIGIN
      ?? process.env.ROLE_ROOM_PUBLIC_ORIGIN
      ?? process.env.ROLE_ROOM_FRONTEND_ORIGIN,
    );
    void options.browserOrigin;
    const origin = configuredOrigin ?? DEFAULT_ROLE_ROOM_TALENT_PUBLIC_ORIGIN;
    return new URL(`/api/role-room/client/invites/${encodeURIComponent(options.inviteToken)}/activate`, origin).toString();
  }

  function getRoleRoomClientInviteMailer() {
    const user = normalizeEmailValue(
      process.env.GMAIL_USER
      ?? process.env.GOOGLE_WORKSPACE_EMAIL
      ?? process.env.GOOGLE_ADMIN_EMAIL,
    );
    const password = readStringValue(process.env.GMAIL_APP_PASSWORD)?.replace(/\s+/g, '') ?? null;

    if (!user || !password) {
      return null;
    }

    return {
      user,
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass: password,
        },
      }),
    };
  }

  async function sendRoleRoomClientInviteEmail(options: {
    recipientEmail: string;
    replyToEmail?: string | null;
    subjectTemplate: string;
    bodyTemplate: string;
    inviteUrl: string;
    projectName: string;
    recipientName?: string | null;
    companyName?: string | null;
    senderName?: string | null;
    accessDuration: RoleRoomClientInviteAccessDuration;
    accessEndsAt?: string | null;
    inviteExpiresAt?: string | null;
    projectId?: string | null;
    sentByUserId?: string | null;
  }) {
    const mailer = getRoleRoomClientInviteMailer();
    if (!mailer) {
      return {
        sent: false,
        reason: 'missing_email_config',
        provider: null as string | null,
        messageId: null as string | null,
        accepted: [] as string[],
      };
    }

    const accessEndsAtLabel = formatRoleRoomClientInviteDateLabel(options.accessEndsAt);
    const inviteExpiresAtLabel = formatRoleRoomClientInviteDateLabel(options.inviteExpiresAt);
    const accessDurationLabel = options.accessDuration === 'project_end'
      ? 'Til prosjektets slutt'
      : 'For alltid';
    const accessNote = options.accessDuration === 'project_end'
      ? (accessEndsAtLabel
        ? `Tilgangen varer til prosjektet avsluttes ${accessEndsAtLabel}.`
        : 'Tilgangen varer til prosjektet avsluttes.')
      : 'Tilgangen forblir aktiv til den blir endret eller fjernet av teamet.';
    const variables = {
      recipientName: readStringValue(options.recipientName) ?? 'der',
      recipientEmail: options.recipientEmail,
      projectName: options.projectName,
      magicLink: options.inviteUrl,
      companyName: readStringValue(options.companyName) ?? 'The Role Room',
      senderName: readStringValue(options.senderName) ?? 'The Role Room-teamet',
      accessDurationLabel,
      accessEndsAt: accessEndsAtLabel ?? '',
      accessNote,
      inviteExpiresAt: inviteExpiresAtLabel ?? '',
      inviteExpiresNote: inviteExpiresAtLabel
        ? `Magic-linken er aktiv til ${inviteExpiresAtLabel}.`
        : '',
    };
    const subject = replaceRoleRoomClientInviteVariables(options.subjectTemplate, variables, 'text');
    const bodyText = replaceRoleRoomClientInviteVariables(options.bodyTemplate, variables, 'text');
    const htmlBody = renderRoleRoomClientInviteBodyHtml(
      replaceRoleRoomClientInviteVariables(options.bodyTemplate, variables, 'text'),
    );
    const replyToEmail = normalizeEmailValue(options.replyToEmail) ?? mailer.user;
    const fromLabel = readStringValue(options.companyName) ?? 'The Role Room';
    const accessHtml = options.accessDuration === 'project_end'
      ? (accessEndsAtLabel
        ? `Klienttilgangen er aktiv til <strong>${escapeRoleRoomClientInviteEmailHtml(accessEndsAtLabel)}</strong>.`
        : 'Klienttilgangen er aktiv frem til prosjektets slutt.')
      : 'Klienttilgangen er satt til <strong>for alltid</strong>.';
    const inviteExpiryHtml = inviteExpiresAtLabel
      ? `Magic-linken kan brukes frem til <strong>${escapeRoleRoomClientInviteEmailHtml(inviteExpiresAtLabel)}</strong>.`
      : 'Magic-linken er klar til bruk med en gang.';
    const html = `
      <div style="margin:0;background:#0b1020;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8ecf4">
        <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden">
          <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#1c2438 0%,#0f172a 100%)">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8dd3ff;font-weight:700;margin-bottom:12px">${escapeRoleRoomClientInviteEmailHtml(fromLabel)}</div>
            <h1 style="margin:0;font-size:28px;line-height:1.15;color:#ffffff">Klientinvitasjon til ${escapeRoleRoomClientInviteEmailHtml(options.projectName)}</h1>
          </div>
          <div style="padding:28px">
            ${htmlBody}
            <div style="margin:0 0 18px;padding:18px;border-radius:18px;background:#0f172a;border:1px solid rgba(141,211,255,0.16);font-size:14px;line-height:1.7;color:#cbd5e1">
              <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8dd3ff;font-weight:700;margin-bottom:10px">Tilgang og lenke</div>
              <div style="margin-bottom:8px">${accessHtml}</div>
              <div>${inviteExpiryHtml}</div>
            </div>
            <div style="margin:28px 0 0">
              <a href="${escapeRoleRoomClientInviteEmailHtml(options.inviteUrl)}" style="display:inline-block;padding:14px 20px;border-radius:14px;background:#00d4ff;color:#031019;text-decoration:none;font-weight:800">Åpne klientportalen</a>
            </div>
            <div style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#94a3b8;word-break:break-word">
              Hvis knappen ikke virker, kan du bruke denne lenken direkte:<br />
              <a href="${escapeRoleRoomClientInviteEmailHtml(options.inviteUrl)}" style="color:#93c5fd">${escapeRoleRoomClientInviteEmailHtml(options.inviteUrl)}</a>
            </div>
          </div>
        </div>
      </div>
    `;
    const text = [
      bodyText,
      '',
      accessNote,
      variables.inviteExpiresNote,
      '',
      `Åpne klientportalen: ${options.inviteUrl}`,
    ]
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .join('\n');

    // Send via transactional-email-service: Resend først (med
    // RESEND_API_KEY) eller Gmail SMTP-fallback. Logger til
    // transactional_email_log for Admin Room-dashboard. Den gamle direkte
    // nodemailer-call-en mailer.transporter.sendMail er erstattet.
    const result = await sendTransactionalEmail({
      to: options.recipientEmail,
      subject,
      html,
      text,
      replyTo: replyToEmail,
      fromLabel,
      kind: 'role_room_client_invite',
      projectId: options.projectId ?? null,
      sentByUserId: options.sentByUserId ?? null,
      pool,
    });

    return result;
  }

  function buildRoleRoomClientInvite(
    row: RoleRoomClientInviteRow,
    options?: {
      inviteUrl?: string | null;
    },
  ) {
    const metadata = readJsonObject(row.metadata);
    const delivery = readRecordValue(metadata.delivery);
    return {
      id: row.id,
      email: normalizeEmailValue(row.email),
      status: readStringValue(row.status) ?? 'sent',
      expiresAt: readStringValue(row.expires_at),
      accessDuration: normalizeRoleRoomClientInviteAccessDuration(metadata.accessDuration),
      accessEndsAt: readStringValue(metadata.accessEndsAt),
      lastSentAt: readStringValue(row.last_sent_at),
      lastViewedAt: readStringValue(row.last_viewed_at),
      acceptedAt: readStringValue(row.accepted_at),
      metadata,
      inviteUrl: readStringValue(options?.inviteUrl ?? null),
      workspace: normalizeRoleRoomClientPortalWorkspace(metadata.workspace),
      tab: normalizeRoleRoomClientPortalTab(metadata.tab),
      sectionId: readStringValue(metadata.sectionId),
      pageId: readStringValue(metadata.pageId),
      reviewId: readStringValue(metadata.reviewId),
      artifactId: readStringValue(metadata.artifactId),
      recipientName: readStringValue(metadata.recipientName),
      message: readStringValue(metadata.message),
      emailSubject: readStringValue(metadata.emailSubject),
      emailBody: readStringValue(metadata.emailBody),
      createdAt: readStringValue(row.created_at),
      updatedAt: readStringValue(row.updated_at),
      delivery: delivery
        ? {
            sent: readBooleanValue(delivery.sent) === true,
            reason: readStringValue(delivery.reason),
            provider: readStringValue(delivery.provider),
            messageId: readStringValue(delivery.messageId),
            accepted: Array.isArray(delivery.accepted)
              ? delivery.accepted
                .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
                .map((entry) => entry.trim())
              : [],
          }
        : null,
    };
  }

  async function getRoleRoomClientInviteByToken(inviteToken: string): Promise<RoleRoomClientInviteRow | null> {
    if (!(await ensureRoleRoomClientInviteTables())) {
      return null;
    }

    const tokenHash = hashRoleRoomClientInviteToken(inviteToken);
    const result = await pool.query<RoleRoomClientInviteRow>(
      `SELECT *
         FROM role_room_client_invites
        WHERE token_hash = $1
        LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  function isRoleRoomClientInviteExpired(invite: RoleRoomClientInviteRow | null | undefined): boolean {
    const expiresAt = readStringValue(invite?.expires_at);
    if (!expiresAt) {
      return false;
    }
    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) && parsed < Date.now();
  }

  async function syncRoleRoomClientInviteContactToProject(options: {
    projectId: string;
    email: string;
    recipientName?: string | null;
    updatedByUserId?: string | null;
    updatedByRole?: string | null;
  }): Promise<void> {
    const metadataPatch = {
      clientEmail: options.email,
      client_email: options.email,
      ...(readStringValue(options.recipientName)
        ? {
            clientName: readStringValue(options.recipientName),
            client_name: readStringValue(options.recipientName),
          }
        : {}),
    };

    await pool.query(
      `UPDATE casting_projects
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [options.projectId, JSON.stringify(metadataPatch)],
    ).catch((error) => {
      console.warn('Role Room client invite metadata sync failed:', error);
    });

    if (!(await ensureProducerWorkflowTables())) {
      return;
    }

    await pool.query(
      `INSERT INTO role_room_client_intake (
        project_id, contact_name, contact_email, metadata, updated_by_user_id, updated_by_role, created_at, updated_at
      ) VALUES (
        $1, $2, $3, '{}'::jsonb, $4, $5, NOW(), NOW()
      )
      ON CONFLICT (project_id) DO UPDATE SET
        contact_name = COALESCE(EXCLUDED.contact_name, role_room_client_intake.contact_name),
        contact_email = EXCLUDED.contact_email,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_by_role = EXCLUDED.updated_by_role,
        updated_at = NOW()`,
      [
        options.projectId,
        readStringValue(options.recipientName),
        options.email,
        options.updatedByUserId ?? null,
        options.updatedByRole ?? null,
      ],
    ).catch((error) => {
      console.warn('Role Room client invite contact sync failed:', error);
    });
  }

  async function getRoleRoomTalentInviteByToken(inviteToken: string): Promise<RoleRoomTalentInviteRow | null> {
    if (!(await ensureRoleRoomTalentPortalTables())) {
      return null;
    }

    const tokenHash = hashRoleRoomTalentInviteToken(inviteToken);
    const result = await pool.query<RoleRoomTalentInviteRow>(
      `SELECT *
         FROM role_room_talent_invites
        WHERE token_hash = $1
        LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  function isRoleRoomTalentInviteExpired(invite: RoleRoomTalentInviteRow | null | undefined): boolean {
    const expiresAt = readStringValue(invite?.expires_at);
    if (!expiresAt) {
      return false;
    }
    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) && parsed < Date.now();
  }

  async function getRoleRoomTalentInvitePreview(invite: RoleRoomTalentInviteRow) {
    const candidateResult = await pool.query<RoleRoomTalentPortalCandidateRow>(
      `SELECT
         cc.*,
         cp.name AS project_name,
         cp.description AS project_description,
         cp.status AS project_status,
         cp.project_type AS project_type,
         cp.start_date::text AS project_start_date,
         cp.end_date::text AS project_end_date
       FROM casting_candidates cc
       INNER JOIN casting_projects cp
         ON cp.id = cc.project_id
      WHERE cc.id = $1
        AND cc.project_id = $2
      LIMIT 1`,
      [invite.candidate_id, invite.project_id],
    );

    const candidateRow = candidateResult.rows[0] ?? null;
    if (!candidateRow) {
      return null;
    }

    const roleResult = await pool.query<RoleRoomTalentPortalRoleRow>(
      `SELECT *
         FROM casting_roles
        WHERE project_id = $1`,
      [invite.project_id],
    );

    const candidate = buildRoleRoomTalentPortalCandidate(candidateRow);
    const roles = roleResult.rows
      .filter((row) => {
        if (readStringValue(row.assigned_candidate_id) === invite.candidate_id) {
          return true;
        }

        if (toStringArray(row.candidate_ids).includes(invite.candidate_id)) {
          return true;
        }

        return candidate.assignedRoleIds.includes(row.id);
      })
      .map((row) => buildRoleRoomTalentPortalRole(row));

    return {
      invite: buildRoleRoomTalentPortalInvite(invite),
      project: {
        id: candidateRow.project_id,
        name: readStringValue(candidateRow.project_name) ?? 'Ukjent prosjekt',
        description: readStringValue(candidateRow.project_description),
        status: readStringValue(candidateRow.project_status) ?? 'active',
        type: readStringValue(candidateRow.project_type),
        startDate: readStringValue(candidateRow.project_start_date),
        endDate: readStringValue(candidateRow.project_end_date),
      },
      candidate,
      roles,
    };
  }

  async function resolveRoleRoomTalentAssignmentsForEmail(
    email: string,
    options?: {
      projectId?: string | null;
      candidateId?: string | null;
      req?: Request;
    },
  ) {
    const normalizedEmail = normalizeEmailValue(email);
    if (!normalizedEmail) {
      return [];
    }

    const candidateResult = await pool.query<RoleRoomTalentPortalCandidateRow>(
      `SELECT
         cc.*,
         cp.name AS project_name,
         cp.description AS project_description,
         cp.status AS project_status,
         cp.project_type AS project_type,
         cp.start_date::text AS project_start_date,
         cp.end_date::text AS project_end_date
       FROM casting_candidates cc
       INNER JOIN casting_projects cp
         ON cp.id = cc.project_id
      WHERE LOWER(COALESCE(cc.email, '')) = LOWER($1)
        AND ($2::text IS NULL OR cc.project_id = $2)
        AND ($3::text IS NULL OR cc.id = $3)
      ORDER BY cp.start_date ASC NULLS LAST, cp.created_at DESC, cc.created_at DESC`,
      [normalizedEmail, options?.projectId ?? null, options?.candidateId ?? null],
    );

    if (!candidateResult.rowCount) {
      return [];
    }

    const candidateRows = candidateResult.rows;
    const projectIds = Array.from(new Set(candidateRows.map((row) => row.project_id)));
    const candidateIds = Array.from(new Set(candidateRows.map((row) => row.id)));

    const talentTablesReady = await ensureRoleRoomTalentPortalTables();

    const [roleResult, scheduleResult, inviteResult, activityResult] = await Promise.all([
      pool.query<RoleRoomTalentPortalRoleRow>(
        `SELECT *
           FROM casting_roles
          WHERE project_id = ANY($1::text[])`,
        [projectIds],
      ),
      pool.query<RoleRoomTalentPortalScheduleRow>(
        `SELECT
           cs.*,
           cr.name AS role_name
         FROM casting_schedules cs
         LEFT JOIN casting_roles cr
           ON cr.id = cs.role_id
        WHERE cs.candidate_id = ANY($1::text[])
        ORDER BY cs.date ASC NULLS LAST, cs.start_time ASC NULLS LAST, cs.created_at DESC`,
        [candidateIds],
      ),
      talentTablesReady
        ? pool.query<RoleRoomTalentInviteRow>(
            `SELECT DISTINCT ON (candidate_id) *
               FROM role_room_talent_invites
              WHERE candidate_id = ANY($1::text[])
              ORDER BY candidate_id, created_at DESC`,
            [candidateIds],
          )
        : Promise.resolve({ rows: [] } as { rows: RoleRoomTalentInviteRow[] }),
      talentTablesReady
        ? pool.query<RoleRoomTalentActivityRow>(
            `SELECT *
               FROM role_room_talent_activity
              WHERE candidate_id = ANY($1::text[])
              ORDER BY created_at DESC
              LIMIT 200`,
            [candidateIds],
          )
        : Promise.resolve({ rows: [] } as { rows: RoleRoomTalentActivityRow[] }),
    ]);

    const latestInviteByCandidate = new Map(
      inviteResult.rows.map((row) => [row.candidate_id, row] as const),
    );

    return candidateRows.map((candidateRow) => {
      const candidate = buildRoleRoomTalentPortalCandidate(candidateRow);
      const schedules = scheduleResult.rows
        .filter((row) => readStringValue(row.candidate_id) === candidateRow.id)
        .map((row) => buildRoleRoomTalentPortalSchedule(row));

      const candidateRoleIds = new Set(candidate.assignedRoleIds);
      const scheduleRoleIds = new Set(
        schedules
          .map((schedule) => schedule.roleId)
          .filter((roleId): roleId is string => typeof roleId === 'string' && roleId.length > 0),
      );

      const roles = roleResult.rows
        .filter((row) => {
          if (row.project_id !== candidateRow.project_id) {
            return false;
          }

          if (candidateRoleIds.has(row.id) || scheduleRoleIds.has(row.id)) {
            return true;
          }

          if (readStringValue(row.assigned_candidate_id) === candidateRow.id) {
            return true;
          }

          return toStringArray(row.candidate_ids).includes(candidateRow.id);
        })
        .map((row) => buildRoleRoomTalentPortalRole(row));

      const inviteRow = latestInviteByCandidate.get(candidateRow.id) ?? null;
      const activities = activityResult.rows
        .filter((row) => row.candidate_id === candidateRow.id)
        .map((row) => buildRoleRoomTalentPortalActivity(row));

      return {
        project: {
          id: candidateRow.project_id,
          name: readStringValue(candidateRow.project_name) ?? 'Ukjent prosjekt',
          description: readStringValue(candidateRow.project_description),
          status: readStringValue(candidateRow.project_status) ?? 'active',
          type: readStringValue(candidateRow.project_type),
          startDate: readStringValue(candidateRow.project_start_date),
          endDate: readStringValue(candidateRow.project_end_date),
        },
        candidate,
        roles,
        schedules,
        invite: inviteRow ? buildRoleRoomTalentPortalInvite(inviteRow) : null,
        activity: activities,
        stats: {
          roleCount: roles.length,
          scheduleCount: schedules.length,
          selfTapeCount: candidate.videos.length,
          photoCount: candidate.photos.length,
          activityCount: activities.length,
        },
      };
    });
  }

  async function resolveRoleRoomTalentCandidateForRequest(
    req: Request,
    projectId: string,
    candidateId: string,
  ): Promise<RoleRoomTalentPortalCandidateRow | null> {
    const requestUser = getOptionalRequestUser(req);
    const requestEmail = normalizeEmailValue(requestUser?.email);
    if (!requestEmail) {
      return null;
    }

    const result = await pool.query<RoleRoomTalentPortalCandidateRow>(
      `SELECT *
         FROM casting_candidates
        WHERE id = $1
          AND project_id = $2
          AND LOWER(COALESCE(email, '')) = LOWER($3)
        LIMIT 1`,
      [candidateId, projectId, requestEmail],
    );

    return result.rows[0] ?? null;
  }

  // Apply CORS to all Role Room routes
  router.use(cors(buildCorsOptions()));

  // ── Health / Connection Test ─────────────────────────────

  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT NOW() AS server_time');
      const tableCheck = await pool.query(
        `SELECT COUNT(*) AS count FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name LIKE 'casting_%'`
      );
      res.json({
        status: 'ok',
        service: 'role-room',
        serverTime: result.rows[0].server_time,
        castingTablesCount: parseInt(tableCheck.rows[0].count, 10),
        corsOrigins: (process.env.CORS_ALLOW_ORIGINS ?? '').split(',').filter(Boolean),
        apiKeyEnforced: true,
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  });

  // ── Connection Test (requires API key) ───────────────────

  router.get('/test-connection', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const result = await pool.query('SELECT NOW() AS server_time');
      res.json({
        status: 'connected',
        userId,
        serverTime: result.rows[0].server_time,
        message: 'API-nøkkel verifisert. Tilkobling vellykket.',
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Role Room Google Workspace Layer
  // ═══════════════════════════════════════════════════════════

  router.get('/google/status', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const config = getRoleRoomGoogleConfig(req);
      const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
      const projectId = readStringValue(req.query.projectId);

      const connection = requestUser?.userId
        ? await ensureRoleRoomGoogleConnectionForRequest(req, requestUser.userId)
        : null;

      let projectBindingResponse: ReturnType<typeof buildRoleRoomGoogleProjectBindingResponse> | null = null;
      if (projectId && requestUser?.userId && await ensureProjectAccess(projectId)) {
        const roleRecord = await getProjectRoleRecord(projectId, [
          requestUser.userId,
          requestUser.email ?? '',
        ]);
        if (canReadProducerData(req, roleRecord)) {
          const binding = await getRoleRoomGoogleProjectBinding(projectId);
          const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
          projectBindingResponse = buildRoleRoomGoogleProjectBindingResponse(binding, artifacts);
        }
      }

      res.json({
        ...buildRoleRoomGoogleConnectionResponse(connection, config),
        projectBinding: projectBindingResponse?.binding ?? null,
        artifacts: projectBindingResponse?.artifacts ?? [],
      });
    } catch (error) {
      console.error('Role Room Google status error:', error);
      res.status(500).json({ error: 'Kunne ikke hente Google-status' });
    }
  });

  router.post('/google/oauth/start', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const browserOrigin = sanitizeRoleRoomBrowserOrigin(req.body?.browserOrigin) ?? getRoleRoomRequestOrigin(req);
      const requestScopedRedirectUri = browserOrigin
        ? `${browserOrigin}/api/role-room/google/oauth/callback`
        : null;
      const config = getRoleRoomGoogleConfig(req, requestScopedRedirectUri);
      if (!config.configured) {
        res.status(400).json({
          error: 'Google Workspace er ikke konfigurert',
          missing: config.missing,
        });
        return;
      }

      const mode = readStringValue(req.body?.mode)?.toLowerCase() === 'link' ? 'link' : 'login';
      const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
      if (mode === 'link' && !requestUser?.userId) {
        res.status(401).json({ error: 'Må være innlogget for å koble Google Workspace' });
        return;
      }

      const oauthClient = createRoleRoomGoogleOAuthClient(req, config.redirectUri);
      if (!oauthClient) {
        res.status(500).json({ error: 'Google OAuth-klient er ikke tilgjengelig' });
        return;
      }

      const stateId = crypto.randomUUID();
      const loginAs = readStringValue(req.body?.loginAs)?.toLowerCase() ?? null;
      const requestedRole = readStringValue(req.body?.requestedRole ?? req.body?.role)?.toLowerCase() ?? null;
      const projectId = readStringValue(req.body?.projectId);
      const targetConnectionUserId = readStringValue(req.body?.targetConnectionUserId);
      const targetConnectionEmail = readStringValue(req.body?.targetConnectionEmail);
      const returnPath = sanitizeRoleRoomReturnPath(req.body?.returnPath, req);
      const loginEmail = readStringValue(req.body?.email)?.trim().toLowerCase() ?? null;

      if (mode === 'login' && loginEmail) {
        const existingLoginUser = await findRoleRoomUserByEmail(loginEmail);
        const canBypassCommercialGate =
          existingLoginUser && isRoleRoomPlatformAdminRole(existingLoginUser.role);

        if (!canBypassCommercialGate) {
          const loginGate = await getRoleRoomCommercialGoogleLoginGate(loginEmail, {
            loginAs,
            requestedRole,
            projectId,
          });
          if (!loginGate.allowed) {
            res.status(403).json({ error: loginGate.reason });
            return;
          }
        }
      }

      const oauthStatePayload: RoleRoomGoogleOauthState = {
        mode,
        returnPath,
        browserOrigin,
        redirectUri: config.redirectUri ?? null,
        loginAs,
        requestedRole,
        projectId,
        createdByUserId: requestUser?.userId ?? null,
        createdByEmail: requestUser?.email ?? null,
        targetConnectionUserId,
        targetConnectionEmail,
        createdAt: Date.now(),
      };
      roleRoomGoogleOauthStateStore.set(stateId, oauthStatePayload);
      // Sikkerhetsfix (#6): persister også til DB så multi-pod
      // setups (Render horizontal scaling) ikke mister state når
      // callback treffer en annen pod enn den som opprettet den.
      // 10 min TTL — samme som in-memory pruning.
      void persistOauthState(pool, stateId, oauthStatePayload, new Date(Date.now() + 10 * 60 * 1000));

      const loginHint = targetConnectionEmail ?? requestUser?.email ?? readStringValue(req.body?.email);
      const authorizationUrl = oauthClient.generateAuthUrl({
        access_type: 'offline',
        scope: [...ROLE_ROOM_GOOGLE_SCOPES],
        include_granted_scopes: true,
        prompt: 'consent',
        state: stateId,
        ...(loginHint ? { login_hint: loginHint } : {}),
      });

      res.json({
        success: true,
        mode,
        authorizationUrl,
        stateId,
      });
    } catch (error) {
      console.error('Role Room Google oauth start error:', error);
      res.status(500).json({ error: 'Kunne ikke starte Google OAuth' });
    }
  });

  router.get('/google/oauth/callback', async (req: Request, res: Response) => {
    pruneExpiredRoleRoomGoogleState();
    const fallbackReturnPath = sanitizeRoleRoomReturnPath(req.query.returnPath, req);
    const requestOrigin = resolveRoleRoomBrowserOrigin(req);

    const redirectWithError = (returnPath: string, message: string, browserOrigin?: string | null) => {
      res.redirect(
        buildRoleRoomGoogleReturnUrl(returnPath, {
          rrGoogleStatus: 'error',
          rrGoogleMessage: message,
        }, resolveRoleRoomBrowserOrigin(req, browserOrigin) ?? requestOrigin),
      );
    };

    const stateId = readStringValue(req.query.state);
    const code = readStringValue(req.query.code);
    // Sikkerhetsfix (#6): Map kan miste treff hvis callback treffer en
    // annen pod enn den som opprettet state. DB-fallback dekker det.
    let oauthState = stateId ? roleRoomGoogleOauthStateStore.get(stateId) : null;
    if (!oauthState && stateId) {
      const fromDb = await loadOauthState<RoleRoomGoogleOauthState>(pool, stateId);
      if (fromDb) {
        oauthState = fromDb;
        // Cache i Map for raskere oppslag senere i samme prosess.
        roleRoomGoogleOauthStateStore.set(stateId, fromDb);
      }
    }

    // Sikkerhetsfix (#5): bruker som klikker "Avbryt" på Googles consent-
    // skjerm sender ?error=access_denied. Tidligere fanget vi dette via
    // !code-grenen → generisk "Ugyldig Google-forespørsel". Nå viser vi
    // en forklarende melding så bruker forstår at de avbrøt selv.
    const oauthError = readStringValue(req.query.error);
    if (oauthError) {
      const errorMessage = oauthError === 'access_denied'
        ? 'Du avbrøt Google-innloggingen. Prøv igjen hvis du ønsker å logge inn.'
        : `Google avviste forespørselen: ${oauthError}`;
      redirectWithError(oauthState?.returnPath ?? fallbackReturnPath, errorMessage, oauthState?.browserOrigin);
      return;
    }

    const config = getRoleRoomGoogleConfig(req, oauthState?.redirectUri);
    if (!config.configured) {
      redirectWithError(oauthState?.returnPath ?? fallbackReturnPath, 'Google Workspace er ikke konfigurert', oauthState?.browserOrigin);
      return;
    }
    if (!oauthState || !code) {
      redirectWithError(oauthState?.returnPath ?? fallbackReturnPath, 'Ugyldig Google-forespørsel', oauthState?.browserOrigin);
      return;
    }

    roleRoomGoogleOauthStateStore.delete(stateId!);
    // Sikkerhetsfix (#6): slett også fra DB
    void deleteOauthState(pool, stateId!);

    try {
      const oauthClient = createRoleRoomGoogleOAuthClient(req, oauthState.redirectUri);
      if (!oauthClient) {
        redirectWithError(oauthState.returnPath, 'Google OAuth-klient er ikke tilgjengelig', oauthState.browserOrigin);
        return;
      }

      const tokenResult = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokenResult.tokens);

      const oauth2Api = google.oauth2({ version: 'v2', auth: oauthClient });
      const profileResponse = await oauth2Api.userinfo.get();
      const googleEmail = readStringValue(profileResponse.data.email);
      const googleSubject = readStringValue(profileResponse.data.id);
      const googleProfile = readJsonObject({
        id: profileResponse.data.id ?? null,
        email: profileResponse.data.email ?? null,
        verified_email: profileResponse.data.verified_email ?? null,
        name: profileResponse.data.name ?? null,
        given_name: profileResponse.data.given_name ?? null,
        family_name: profileResponse.data.family_name ?? null,
        picture: profileResponse.data.picture ?? null,
      });

      if (!googleEmail || !googleSubject) {
        redirectWithError(oauthState.returnPath, 'Google-kontoen mangler e-post eller identitet', oauthState.browserOrigin);
        return;
      }

      // Sikkerhetsfix (#3): avvis uverifiserte Google-kontoer. En
      // angriper kan opprette en Google-konto med vilkårlig e-post-
      // adresse uten å eie domenet; verified_email=true betyr at Google
      // har bekreftet at brukeren har tilgang til e-posten.
      if (profileResponse.data.verified_email !== true) {
        redirectWithError(
          oauthState.returnPath,
          'E-posten i Google-kontoen din er ikke verifisert. Bekreft den i Google først.',
          oauthState.browserOrigin,
        );
        return;
      }

      // Sikkerhetsfix (#2): valider hd-claim mot allow-list så "Google
      // WORKSPACE login" faktisk krever Workspace-domene (ikke gmail.com).
      // ROLE_ROOM_GOOGLE_ALLOWED_DOMAINS = "kunde1.no,kunde2.com" — hvis
      // tom, allow alle (backward compat). Hvis satt, må hd være i lista.
      const allowedDomainsRaw = (process.env.ROLE_ROOM_GOOGLE_ALLOWED_DOMAINS ?? '').trim();
      if (allowedDomainsRaw) {
        const allowedDomains = allowedDomainsRaw
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        // hd-claim ligger i id_token. Hvis ikke tilgjengelig (no Workspace
        // → personlig gmail), fall tilbake til e-post-domenet — gmail.com
        // vil da feile mot allow-list.
        let hostedDomain: string | null = null;
        const idToken = readStringValue(tokenResult.tokens.id_token);
        if (idToken) {
          try {
            const payloadB64 = idToken.split('.')[1] ?? '';
            const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
            const payload = JSON.parse(payloadJson) as { hd?: string };
            if (typeof payload.hd === 'string') hostedDomain = payload.hd.toLowerCase();
          } catch {
            // ignorer parse-feil — falle tilbake til e-post-domene
          }
        }
        if (!hostedDomain) {
          hostedDomain = googleEmail.split('@')[1]?.toLowerCase() ?? null;
        }
        if (!hostedDomain || !allowedDomains.includes(hostedDomain)) {
          redirectWithError(
            oauthState.returnPath,
            `E-postdomenet "${hostedDomain ?? 'ukjent'}" er ikke godkjent for innlogging. Kontakt administrator.`,
            oauthState.browserOrigin,
          );
          return;
        }
      }

      const existingSubjectConnection = await getRoleRoomGoogleConnectionBySubject(googleSubject);
      if (
        existingSubjectConnection
        && oauthState.mode === 'link'
        && !matchesExistingRoleRoomGoogleConnectionOwner(existingSubjectConnection, {
          userIds: [oauthState.createdByUserId, oauthState.targetConnectionUserId],
          emails: [oauthState.createdByEmail, oauthState.targetConnectionEmail],
        })
        && !(
          isRoleRoomLocalDevelopmentUserId(oauthState.createdByUserId)
          || isRoleRoomLocalDevelopmentUserId(oauthState.targetConnectionUserId)
          || isEphemeralRoleRoomDevUserId(existingSubjectConnection.user_id)
        )
      ) {
        redirectWithError(oauthState.returnPath, 'Denne Google-kontoen er allerede koblet til en annen bruker', oauthState.browserOrigin);
        return;
      }

      const tokenBundle: NonNullable<RoleRoomGoogleTransferPayload['tokenBundle']> = {
        accessToken: readStringValue(tokenResult.tokens.access_token),
        refreshToken: readStringValue(tokenResult.tokens.refresh_token),
        expiryDate: typeof tokenResult.tokens.expiry_date === 'number' ? tokenResult.tokens.expiry_date : null,
        scopes: readStringArray(tokenResult.tokens.scope?.split(' ') ?? tokenResult.tokens.scope ?? ROLE_ROOM_GOOGLE_SCOPES),
      };

      if (oauthState.mode === 'login') {
        const resolvedUser = await resolveRoleRoomGoogleLoginUser(googleEmail, googleProfile, oauthState);
        if (!resolvedUser) {
          redirectWithError(oauthState.returnPath, 'Google-kontoen er ikke invitert til dette Role Room-prosjektet', oauthState.browserOrigin);
          return;
        }

        if (oauthState.projectId && await ensureProjectAccess(oauthState.projectId)) {
          await ensureRoleRoomProjectRoleAssignment(
            oauthState.projectId,
            resolvedUser.userId,
            resolvedUser.email,
            resolvedUser.autoAssignProjectRole ?? resolvedUser.role,
            resolvedUser.userId,
          );
        }

        if (
          existingSubjectConnection
          && existingSubjectConnection.user_id !== resolvedUser.userId
          && matchesExistingRoleRoomGoogleConnectionOwner(existingSubjectConnection, {
            userIds: [resolvedUser.userId],
            emails: [resolvedUser.email],
          })
        ) {
          await reassignRoleRoomGoogleConnectionOwner(
            existingSubjectConnection.id,
            resolvedUser.userId,
            resolvedUser.email,
          );
        }

        await upsertRoleRoomGoogleConnection(
          resolvedUser.userId,
          resolvedUser.email,
          {
            email: googleEmail,
            subject: googleSubject,
            profile: googleProfile,
          },
          tokenBundle,
        );

        let autoConfiguredProjectBinding = false;
        if (
          oauthState.projectId
          && canAutoConfigureRoleRoomGoogleWorkspaceForRole(
            resolvedUser.autoAssignProjectRole ?? resolvedUser.role,
          )
        ) {
          try {
            await ensureRoleRoomGoogleProjectBindingReady(
              oauthState.projectId,
              resolvedUser.userId,
              oauthClient,
            );
            autoConfiguredProjectBinding = true;
          } catch (bindingError) {
            console.warn('Role Room Google auto-binding after login failed:', bindingError);
          }
        }

        const sessionToken = crypto.randomUUID();
        const sessionData: SessionData = {
          userId: resolvedUser.userId,
          email: resolvedUser.email,
          name: resolvedUser.name,
          role: resolvedUser.role,
          displayName: resolvedUser.name,
          picture: readStringValue(googleProfile?.picture) || undefined,
          verified_email: googleProfile?.verified_email === true,
          requestedRole: oauthState.requestedRole ?? null,
          loginAs: oauthState.loginAs ?? undefined,
          loginAt: new Date().toISOString(),
        };

        // Sikkerhetsfix (#1): bruker med TOTP aktivert via vanlig login
        // KUNNE tidligere gå rundt 2FA ved å bruke Google-login. Nå
        // sjekker vi totp-status FØR session committes, og hvis aktivert
        // redirecter vi til 2FA-prompt med en temp-token (samme mønster
        // som login/complete-2fa).
        try {
          const totpSvc = await import('./totp-2fa-service.js');
          const totpStatus = await totpSvc.getTotpStatus(pool, resolvedUser.userId);
          if (totpStatus.enabled) {
            // Lagre pending-state i transfer-store så frontend kan vise
            // 2FA-prompt og fullføre via /api/auth/login/complete-2fa.
            // Forventet payload-shape matcher det complete-2fa-endpointet
            // returnerer for vanlig login.
            const tempToken = crypto.randomUUID();
            const userPayload = {
              id: resolvedUser.userId,
              email: resolvedUser.email,
              role: resolvedUser.role,
              name: resolvedUser.name,
              display_name: resolvedUser.name,
              loginAs: oauthState.loginAs ?? undefined,
              requestedRole: oauthState.requestedRole ?? null,
            };
            // Bruker (activeSessions as any).__pendingTwoFactorLogins som
            // intern broker — settes opp i index.ts. Hvis Map mangler
            // (eldre prosesser), fall tilbake til å utstede session og
            // logge advarsel istedenfor å låse ute brukere.
            const pendingMap = (globalThis as any).__roleRoomPendingTwoFactorLogins as
              | Map<string, { userId: string; sessionData: SessionData; responsePayload: any; expiresAt: number }>
              | undefined;
            if (pendingMap) {
              pendingMap.set(tempToken, {
                userId: resolvedUser.userId,
                sessionData,
                responsePayload: { token: sessionToken, user: userPayload },
                expiresAt: Date.now() + 5 * 60 * 1000,
              });
              res.redirect(
                buildRoleRoomGoogleReturnUrl(oauthState.returnPath, {
                  rrGoogleStatus: 'needs_2fa',
                  rrGoogleMode: 'login',
                  rrGoogleTempToken: tempToken,
                }, resolveRoleRoomBrowserOrigin(req, oauthState.browserOrigin) ?? requestOrigin),
              );
              return;
            }
            console.warn('[Auth] 2FA pending-map mangler — Google-login fortsetter UTEN 2FA-gate.');
          }
        } catch (totpError) {
          console.error('[Auth] TOTP-status-sjekk i Google-callback feilet:', totpError);
          // Best-effort: hvis TOTP-stack er nede, ikke lås ute brukeren
          // som ikke har 2FA på. Logger varselet.
        }

        activeSessions?.set(sessionToken, sessionData);
        await persistAuthSession(pool, sessionToken, sessionData);

        const transferId = crypto.randomUUID();
        const transferPayload: RoleRoomGoogleTransferPayload = {
          mode: 'login',
          createdAt: Date.now(),
          projectId: oauthState.projectId ?? null,
          createdByUserId: resolvedUser.userId,
          createdByEmail: resolvedUser.email,
          autoConfiguredProjectBinding,
          sessionToken,
          user: {
            id: resolvedUser.userId,
            email: resolvedUser.email,
            role: resolvedUser.role,
            name: resolvedUser.name,
            display_name: resolvedUser.name,
            loginAs: oauthState.loginAs ?? undefined,
            requestedRole: oauthState.requestedRole ?? null,
          },
          googleEmail,
          googleSubject,
          profile: googleProfile,
        };
        roleRoomGoogleTransferStore.set(transferId, transferPayload);
        // Sikkerhetsfix (#6): persister også til DB for multi-pod
        void persistOauthTransfer(pool, transferId, transferPayload, new Date(Date.now() + 10 * 60 * 1000));

        res.redirect(
          buildRoleRoomGoogleReturnUrl(oauthState.returnPath, {
            rrGoogleStatus: 'success',
            rrGoogleMode: 'login',
            rrGoogleTransfer: transferId,
          }, resolveRoleRoomBrowserOrigin(req, oauthState.browserOrigin) ?? requestOrigin),
        );
        return;
      }

      const transferId = crypto.randomUUID();
      const linkTargetUserId = oauthState.targetConnectionUserId ?? oauthState.createdByUserId ?? null;
      const linkTargetEmail = oauthState.targetConnectionEmail ?? oauthState.createdByEmail ?? null;
      if (!linkTargetUserId) {
        redirectWithError(oauthState.returnPath, 'Fant ikke brukeren som skal kobles til Google Workspace', oauthState.browserOrigin);
        return;
      }

      if (
        existingSubjectConnection
        && existingSubjectConnection.user_id !== linkTargetUserId
        && (
          isEphemeralRoleRoomDevUserId(existingSubjectConnection.user_id)
          || matchesExistingRoleRoomGoogleConnectionOwner(existingSubjectConnection, {
            userIds: [linkTargetUserId, oauthState.createdByUserId, oauthState.targetConnectionUserId],
            emails: [linkTargetEmail, oauthState.createdByEmail, oauthState.targetConnectionEmail],
          })
        )
      ) {
        await reassignRoleRoomGoogleConnectionOwner(existingSubjectConnection.id, linkTargetUserId, linkTargetEmail);
      }

      await upsertRoleRoomGoogleConnection(
        linkTargetUserId,
        linkTargetEmail,
        {
          email: googleEmail,
          subject: googleSubject,
          profile: googleProfile,
        },
        tokenBundle,
      );

      const linkTransferPayload: RoleRoomGoogleTransferPayload = {
        mode: 'link',
        createdAt: Date.now(),
        projectId: oauthState.projectId ?? null,
        createdByUserId: oauthState.createdByUserId ?? null,
        createdByEmail: oauthState.createdByEmail ?? null,
        targetConnectionUserId: oauthState.targetConnectionUserId ?? null,
        targetConnectionEmail: oauthState.targetConnectionEmail ?? null,
        googleEmail,
        googleSubject,
        profile: googleProfile,
        tokenBundle,
      };
      roleRoomGoogleTransferStore.set(transferId, linkTransferPayload);
      // Sikkerhetsfix (#6): persister også til DB for multi-pod
      void persistOauthTransfer(pool, transferId, linkTransferPayload, new Date(Date.now() + 10 * 60 * 1000));

      res.redirect(
        buildRoleRoomGoogleReturnUrl(oauthState.returnPath, {
          rrGoogleStatus: 'success',
          rrGoogleMode: 'link',
          rrGoogleTransfer: transferId,
        }, resolveRoleRoomBrowserOrigin(req, oauthState.browserOrigin) ?? requestOrigin),
      );
    } catch (error) {
      console.error('Role Room Google callback error:', error);
      redirectWithError(
        oauthState.returnPath,
        error instanceof Error ? error.message : 'Google-innlogging feilet',
        oauthState.browserOrigin,
      );
    }
  });

  router.get('/google/oauth/session-result/:transferId', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const transferId = readStringValue(req.params.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId mangler' });
        return;
      }

      // Sikkerhetsfix (#6): Map miss → fallback til DB (multi-pod)
      let payload = roleRoomGoogleTransferStore.get(transferId);
      if (!payload) {
        const fromDb = await loadOauthTransfer<RoleRoomGoogleTransferPayload>(pool, transferId);
        if (fromDb) {
          payload = fromDb;
          roleRoomGoogleTransferStore.set(transferId, fromDb);
        }
      }
      if (!payload) {
        res.status(404).json({ error: 'Google-overføringen er utløpt eller brukt' });
        return;
      }

      if (payload.mode === 'login') {
        roleRoomGoogleTransferStore.delete(transferId);
        void deleteOauthTransfer(pool, transferId);
      }

      res.json({
        success: true,
        transferId,
        mode: payload.mode,
        projectId: payload.projectId ?? null,
        autoConfiguredProjectBinding: payload.autoConfiguredProjectBinding ?? null,
        sessionToken: payload.sessionToken ?? null,
        user: payload.user ?? null,
        google: {
          email: payload.googleEmail,
          subject: payload.googleSubject,
          profile: payload.profile,
        },
      });
    } catch (error) {
      console.error('Role Room Google session result error:', error);
      res.status(500).json({ error: 'Kunne ikke hente Google-overføringen' });
    }
  });

  router.post('/google/link', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const requestUser = getOptionalRequestUser(req);
      const transferId = readStringValue(req.body?.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId er påkrevd' });
        return;
      }

      // Sikkerhetsfix (#6): Map miss → fallback til DB (multi-pod)
      let payload = roleRoomGoogleTransferStore.get(transferId);
      if (!payload) {
        const fromDb = await loadOauthTransfer<RoleRoomGoogleTransferPayload>(pool, transferId);
        if (fromDb) {
          payload = fromDb;
          roleRoomGoogleTransferStore.set(transferId, fromDb);
        }
      }
      if (!payload || payload.mode !== 'link' || !payload.tokenBundle) {
        res.status(404).json({ error: 'Fant ikke en gyldig Google-kobling å fullføre' });
        return;
      }

      const payloadUserId = readStringValue(payload.createdByUserId);
      const targetConnectionUserId = readStringValue(payload.targetConnectionUserId);
      const targetConnectionEmail = readStringValue(payload.targetConnectionEmail);
      const userId = targetConnectionUserId || (!isEphemeralRoleRoomDevUserId(requestUser?.userId)
        ? (requestUser?.userId ?? null)
        : payloadUserId);
      if (!userId) {
        res.status(401).json({ error: 'Fant ikke brukeren som skal kobles til Google Workspace' });
        return;
      }

      const existingSubjectConnection = await getRoleRoomGoogleConnectionBySubject(payload.googleSubject);
      const roleRoomEmail = targetConnectionEmail ?? requestUser?.email ?? readStringValue(payload.createdByEmail) ?? null;
      if (
        existingSubjectConnection
        && existingSubjectConnection.user_id !== userId
        && !matchesExistingRoleRoomGoogleConnectionOwner(existingSubjectConnection, {
          userIds: [userId, payloadUserId, targetConnectionUserId],
          emails: [roleRoomEmail, targetConnectionEmail, payload.createdByEmail],
        })
        && !(
          isRoleRoomLocalDevelopmentUserId(userId)
          || isRoleRoomLocalDevelopmentUserId(payloadUserId)
          || isRoleRoomLocalDevelopmentUserId(targetConnectionUserId)
          || isEphemeralRoleRoomDevUserId(existingSubjectConnection.user_id)
        )
      ) {
        res.status(409).json({ error: 'Denne Google-kontoen er allerede koblet til en annen bruker' });
        return;
      }

      if (
        existingSubjectConnection
        && existingSubjectConnection.user_id !== userId
        && (
          isRoleRoomLocalDevelopmentUserId(userId)
          || isRoleRoomLocalDevelopmentUserId(payloadUserId)
          || isRoleRoomLocalDevelopmentUserId(targetConnectionUserId)
          || isEphemeralRoleRoomDevUserId(existingSubjectConnection.user_id)
          || matchesExistingRoleRoomGoogleConnectionOwner(existingSubjectConnection, {
            userIds: [userId, payloadUserId, targetConnectionUserId],
            emails: [roleRoomEmail, targetConnectionEmail, payload.createdByEmail],
          })
        )
      ) {
        await reassignRoleRoomGoogleConnectionOwner(existingSubjectConnection.id, userId, roleRoomEmail);
      }

      const connection = await upsertRoleRoomGoogleConnection(
        userId,
        roleRoomEmail,
        {
          email: payload.googleEmail,
          subject: payload.googleSubject,
          profile: payload.profile,
        },
        payload.tokenBundle,
      );

      let projectBindingResponse: ReturnType<typeof buildRoleRoomGoogleProjectBindingResponse> | null = null;
      if (payload.projectId && await ensureProjectAccess(payload.projectId)) {
        const roleRecord = await getProjectRoleRecord(payload.projectId, getUserIdentifiers(req));
        if (canWriteProducerData(req, roleRecord)) {
          try {
            const oauthClient = createRoleRoomGoogleOAuthClient(req);
            if (oauthClient) {
              oauthClient.setCredentials({
                access_token: payload.tokenBundle.accessToken ?? undefined,
                refresh_token: payload.tokenBundle.refreshToken ?? undefined,
                expiry_date: payload.tokenBundle.expiryDate ?? undefined,
              });
              const binding = await ensureRoleRoomGoogleProjectBindingReady(
                payload.projectId,
                userId,
                oauthClient,
              );
              const artifacts = await getRoleRoomGoogleArtifactsByProject(payload.projectId);
              projectBindingResponse = buildRoleRoomGoogleProjectBindingResponse(binding, artifacts);
            }
          } catch (bindingError) {
            console.warn('Role Room Google auto-binding after link failed:', bindingError);
          }
        }
      }

      roleRoomGoogleTransferStore.delete(transferId);
      void deleteOauthTransfer(pool, transferId);
      res.json({
        ...buildRoleRoomGoogleConnectionResponse(connection, getRoleRoomGoogleConfig(req)),
        projectBinding: projectBindingResponse?.binding ?? null,
        artifacts: projectBindingResponse?.artifacts ?? [],
      });
    } catch (error) {
      console.error('Role Room Google link error:', error);
      res.status(500).json({ error: 'Kunne ikke koble Google Workspace til brukeren' });
    }
  });

  router.delete('/google/link', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      await ensureRoleRoomGoogleTables();
      await pool.query(
        `DELETE FROM role_room_google_connections
         WHERE user_id = $1
           AND oauth_app = 'role_room'`,
        [userId],
      );
      await pool.query(
        `UPDATE role_room_google_project_bindings
         SET connected_user_id = NULL,
             updated_at = NOW()
         WHERE connected_user_id = $1`,
        [userId],
      );

      res.json({
        success: true,
        ...buildRoleRoomGoogleConnectionResponse(null, getRoleRoomGoogleConfig(req)),
      });
    } catch (error) {
      console.error('Role Room Google unlink error:', error);
      res.status(500).json({ error: 'Kunne ikke koble fra Google Workspace' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Role Room LinkedIn Layer
  // ═══════════════════════════════════════════════════════════

  router.get('/linkedin/status', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const config = getRoleRoomLinkedInConfig(req);
      const requestUser = getOptionalRequestUser(req);
      const connection = requestUser?.userId
        ? await getRoleRoomLinkedInConnectionByUserId(requestUser.userId)
        : null;
      res.json(buildRoleRoomLinkedInConnectionResponse(connection, config));
    } catch (error) {
      console.error('Role Room LinkedIn status error:', error);
      res.status(500).json({ error: 'Kunne ikke hente LinkedIn-status' });
    }
  });

  router.post('/linkedin/oauth/start', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const config = getRoleRoomLinkedInConfig(req);
      if (!config.configured || !config.clientId || !config.redirectUri) {
        res.status(400).json({
          error: 'LinkedIn er ikke konfigurert',
          missing: config.missing,
        });
        return;
      }

      const requestUser = getOptionalRequestUser(req);
      if (!requestUser?.userId) {
        res.status(401).json({ error: 'Må være innlogget for å koble LinkedIn' });
        return;
      }

      const stateId = crypto.randomUUID();
      const returnPath = sanitizeRoleRoomReturnPath(req.body?.returnPath, req);
      const projectId = readStringValue(req.body?.projectId);

      roleRoomLinkedInOauthStateStore.set(stateId, {
        returnPath,
        browserOrigin: sanitizeRoleRoomBrowserOrigin(req.body?.browserOrigin) ?? getRoleRoomRequestOrigin(req),
        projectId,
        createdByUserId: requestUser.userId,
        createdAt: Date.now(),
      });

      const authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${
        new URLSearchParams({
          response_type: 'code',
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: [...ROLE_ROOM_LINKEDIN_SCOPES].join(' '),
          state: stateId,
        }).toString()
      }`;

      res.json({
        success: true,
        mode: 'link' as const,
        authorizationUrl,
        stateId,
      });
    } catch (error) {
      console.error('Role Room LinkedIn oauth start error:', error);
      res.status(500).json({ error: 'Kunne ikke starte LinkedIn OAuth' });
    }
  });

  router.get('/linkedin/oauth/callback', async (req: Request, res: Response) => {
    pruneExpiredRoleRoomGoogleState();
    const config = getRoleRoomLinkedInConfig(req);
    const fallbackReturnPath = sanitizeRoleRoomReturnPath(req.query.returnPath, req);
    const requestOrigin = resolveRoleRoomBrowserOrigin(req);

    const redirectWithError = (returnPath: string, message: string, browserOrigin?: string | null) => {
      res.redirect(
        buildRoleRoomGoogleReturnUrl(returnPath, {
          rrLinkedInStatus: 'error',
          rrLinkedInMessage: message,
        }, resolveRoleRoomBrowserOrigin(req, browserOrigin) ?? requestOrigin),
      );
    };

    if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
      redirectWithError(fallbackReturnPath, 'LinkedIn er ikke konfigurert');
      return;
    }

    const stateId = readStringValue(req.query.state);
    const code = readStringValue(req.query.code);
    const oauthState = stateId ? roleRoomLinkedInOauthStateStore.get(stateId) : null;
    if (!oauthState || !code) {
      redirectWithError(oauthState?.returnPath ?? fallbackReturnPath, 'Ugyldig LinkedIn-forespørsel', oauthState?.browserOrigin);
      return;
    }

    roleRoomLinkedInOauthStateStore.delete(stateId!);

    try {
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      });

      const tokenPayload = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!tokenResponse.ok || !tokenPayload) {
        redirectWithError(
          oauthState.returnPath,
          readStringValue(tokenPayload?.error_description) ?? readStringValue(tokenPayload?.error) ?? 'LinkedIn OAuth-feil',
          oauthState.browserOrigin,
        );
        return;
      }

      const accessToken = readStringValue(tokenPayload.access_token);
      if (!accessToken) {
        redirectWithError(oauthState.returnPath, 'LinkedIn svarte uten access token', oauthState.browserOrigin);
        return;
      }

      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const profilePayload = await profileResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!profileResponse.ok || !profilePayload) {
        redirectWithError(
          oauthState.returnPath,
          readStringValue(profilePayload?.message) ?? 'Kunne ikke hente LinkedIn-profilen',
          oauthState.browserOrigin,
        );
        return;
      }

      const linkedInMemberId = readStringValue(profilePayload.sub ?? profilePayload.id);
      const linkedInEmail = readStringValue(profilePayload.email);
      const linkedInName = readStringValue(profilePayload.name)
        ?? [readStringValue(profilePayload.given_name), readStringValue(profilePayload.family_name)]
          .filter((value): value is string => Boolean(value))
          .join(' ')
        ?? linkedInEmail;

      if (!linkedInMemberId) {
        redirectWithError(oauthState.returnPath, 'LinkedIn-kontoen mangler identitet', oauthState.browserOrigin);
        return;
      }

      const existingConnection = await getRoleRoomLinkedInConnectionByMemberId(linkedInMemberId);
      if (existingConnection && existingConnection.user_id !== oauthState.createdByUserId) {
        redirectWithError(oauthState.returnPath, 'Denne LinkedIn-kontoen er allerede koblet til en annen bruker', oauthState.browserOrigin);
        return;
      }

      const expiryDate = typeof tokenPayload.expires_in === 'number'
        ? Date.now() + (Number(tokenPayload.expires_in) * 1000)
        : null;
      const rawScopes = readStringValue(tokenPayload.scope);
      const transferId = crypto.randomUUID();
      roleRoomLinkedInTransferStore.set(transferId, {
        mode: 'link',
        createdAt: Date.now(),
        linkedInMemberId,
        linkedInEmail,
        linkedInName,
        profile: readJsonObject(profilePayload),
        tokenBundle: {
          accessToken,
          refreshToken: readStringValue(tokenPayload.refresh_token),
          expiryDate,
          scopes: rawScopes
            ? rawScopes.split(' ').filter((entry) => entry.trim().length > 0)
            : [...ROLE_ROOM_LINKEDIN_SCOPES],
        },
      });

      res.redirect(
        buildRoleRoomGoogleReturnUrl(oauthState.returnPath, {
          rrLinkedInStatus: 'success',
          rrLinkedInMode: 'link',
          rrLinkedInTransfer: transferId,
        }, resolveRoleRoomBrowserOrigin(req, oauthState.browserOrigin) ?? requestOrigin),
      );
    } catch (error) {
      console.error('Role Room LinkedIn callback error:', error);
      redirectWithError(
        oauthState.returnPath,
        error instanceof Error ? error.message : 'LinkedIn-innlogging feilet',
        oauthState.browserOrigin,
      );
    }
  });

  router.get('/linkedin/oauth/session-result/:transferId', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const transferId = readStringValue(req.params.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId mangler' });
        return;
      }

      const payload = roleRoomLinkedInTransferStore.get(transferId);
      if (!payload) {
        res.status(404).json({ error: 'LinkedIn-overføringen er utløpt eller brukt' });
        return;
      }

      res.json({
        success: true,
        transferId,
        mode: payload.mode,
        linkedIn: {
          memberId: payload.linkedInMemberId,
          email: payload.linkedInEmail ?? null,
          name: payload.linkedInName ?? null,
          profile: payload.profile,
        },
      });
    } catch (error) {
      console.error('Role Room LinkedIn session result error:', error);
      res.status(500).json({ error: 'Kunne ikke hente LinkedIn-overføringen' });
    }
  });

  router.post('/linkedin/link', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const transferId = readStringValue(req.body?.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId er påkrevd' });
        return;
      }

      const payload = roleRoomLinkedInTransferStore.get(transferId);
      if (!payload) {
        res.status(404).json({ error: 'Fant ikke en gyldig LinkedIn-kobling å fullføre' });
        return;
      }

      const existingConnection = await getRoleRoomLinkedInConnectionByMemberId(payload.linkedInMemberId);
      if (existingConnection && existingConnection.user_id !== userId) {
        res.status(409).json({ error: 'Denne LinkedIn-kontoen er allerede koblet til en annen bruker' });
        return;
      }

      const roleRoomEmail = getOptionalRequestUser(req)?.email ?? null;
      const connection = await upsertRoleRoomLinkedInConnection(
        userId,
        roleRoomEmail,
        {
          memberId: payload.linkedInMemberId,
          email: payload.linkedInEmail ?? null,
          name: payload.linkedInName ?? null,
          profile: payload.profile,
        },
        payload.tokenBundle,
      );

      roleRoomLinkedInTransferStore.delete(transferId);
      res.json(buildRoleRoomLinkedInConnectionResponse(connection, getRoleRoomLinkedInConfig(req)));
    } catch (error) {
      console.error('Role Room LinkedIn link error:', error);
      res.status(500).json({ error: 'Kunne ikke koble LinkedIn til brukeren' });
    }
  });

  router.delete('/linkedin/link', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      await ensureRoleRoomLinkedInTables();
      await pool.query(`DELETE FROM role_room_linkedin_connections WHERE user_id = $1`, [userId]);
      res.json({
        success: true,
        ...buildRoleRoomLinkedInConnectionResponse(null, getRoleRoomLinkedInConfig(req)),
      });
    } catch (error) {
      console.error('Role Room LinkedIn unlink error:', error);
      res.status(500).json({ error: 'Kunne ikke koble fra LinkedIn' });
    }
  });

  router.get('/projects/:projectId/google/binding', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til Google Workspace-bindingen' });
        return;
      }

      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json(buildRoleRoomGoogleProjectBindingResponse(binding, artifacts));
    } catch (error) {
      console.error('Role Room Google binding fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente Google Workspace-bindingen' });
    }
  });

  router.post('/projects/:projectId/google/binding', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å konfigurere Google Workspace' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const binding = await ensureRoleRoomGoogleProjectBindingReady(projectId, userId, googleClient.oauthClient, {
        driveRootFolderId: readStringValue(req.body?.driveRootFolderId) ?? null,
        calendarId: readStringValue(req.body?.calendarId) ?? null,
        contactsContext: readJsonObject(req.body?.contactsContext),
        meetCreationEnabled: readBooleanValue(req.body?.meetCreationEnabled),
        auditSignatureStorageEnabled: readBooleanValue(req.body?.auditSignatureStorageEnabled),
        folderLayout: readJsonObject(req.body?.folderLayout),
        createDriveLayout: readBooleanValue(req.body?.createDriveLayout),
        createCalendar: readBooleanValue(req.body?.createCalendar),
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json(buildRoleRoomGoogleProjectBindingResponse(binding, artifacts));
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke lagre Google Workspace-bindingen');
    }
  });

  router.post('/projects/:projectId/google/provision', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å provisionere Google Workspace' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const binding = await ensureRoleRoomGoogleProjectBindingReady(projectId, userId, googleClient.oauthClient, {
        contactsContext: readJsonObject(req.body?.contactsContext),
        meetCreationEnabled: true,
        auditSignatureStorageEnabled: true,
        createDriveLayout: true,
        createCalendar: true,
      });

      const provisionedBinding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        syncStatus: {
          ...readJsonObject(binding.sync_status),
          drive: {
            state: readStringValue(binding.drive_root_folder_id) ? 'ready' : 'pending',
            folderId: readStringValue(binding.drive_root_folder_id),
            provisionedAt: nowISO(),
          },
          calendar: {
            state: readStringValue(binding.calendar_id) ? 'ready' : 'pending',
            calendarId: readStringValue(binding.calendar_id),
            provisionedAt: nowISO(),
          },
          meet: {
            state: binding.meet_creation_enabled ? 'ready' : 'disabled',
            provisionedAt: nowISO(),
          },
          docsAgreement: {
            state: binding.audit_signature_storage_enabled ? 'ready' : 'disabled',
            provisionedAt: nowISO(),
          },
          chat: {
            state: 'available',
            note: 'Google Chat scopes are linked. Dedicated space creation can run from the collaboration workspace when enabled.',
            provisionedAt: nowISO(),
          },
          people: {
            state: 'ready',
            fallback: 'local_contacts',
            provisionedAt: nowISO(),
          },
          oauth: {
            state: 'auto_linked',
            connectedUserId: userId,
            provisionedAt: nowISO(),
          },
        },
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        success: true,
        ...buildRoleRoomGoogleProjectBindingResponse(provisionedBinding, artifacts),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke provisionere Google Workspace');
    }
  });

  router.get('/projects/:projectId/google/calendars', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å lese kalendere' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      const response = await calendarApi.calendarList.list({
        maxResults: 50,
        showHidden: false,
      });

      res.json({
        calendars: Array.isArray(response.data.items)
          ? response.data.items.map((calendar) => buildRoleRoomGoogleCalendarRecord(calendar as unknown as Record<string, unknown>))
          : [],
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke hente brukerens Google-kalendere');
    }
  });

  router.get('/projects/:projectId/google/calendar', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til prosjektkalenderen' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      const requestedCalendarId = readStringValue(req.query.calendarId);
      const calendarId = requestedCalendarId ?? binding?.calendar_id;
      if (!calendarId) {
        res.json({
          calendar: null,
          shares: [],
          events: [],
        });
        return;
      }

      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      const [calendarResponse, shares, eventsResponse] = await Promise.all([
        calendarApi.calendars.get({ calendarId }),
        listRoleRoomGoogleCalendarAclRecords(calendarApi, calendarId),
        calendarApi.events.list({
          calendarId,
          singleEvents: true,
          orderBy: 'startTime',
          timeMin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          maxResults: 20,
        }),
      ]);

      res.json({
        calendar: buildRoleRoomGoogleCalendarRecord(calendarResponse.data as unknown as Record<string, unknown>),
        shares,
        events: Array.isArray(eventsResponse.data.items)
          ? eventsResponse.data.items.map((event) => buildRoleRoomGoogleCalendarEventSummary(event as unknown as Record<string, unknown>))
          : [],
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke hente prosjektkalenderen');
    }
  });

  router.post('/projects/:projectId/google/calendar/share', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å dele prosjektkalenderen' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
      const calendarId = await resolveRoleRoomGoogleCalendarId(
        calendarApi,
        await getRoleRoomProjectName(projectId),
        readStringValue(req.body?.calendarId) ?? existingBinding?.calendar_id,
      );

      const shareRole = readStringValue(req.body?.role) ?? 'reader';
      const scopeType = readStringValue(req.body?.scopeType) ?? (readStringValue(req.body?.domain) ? 'domain' : 'user');
      const email = readStringValue(req.body?.email);
      const domain = readStringValue(req.body?.domain);
      const scopeValue = scopeType === 'domain' ? domain : email;
      if (!scopeValue) {
        res.status(400).json({ error: 'Oppgi e-post eller domene som kalenderen skal deles med' });
        return;
      }

      const existingRules = await listRoleRoomGoogleCalendarAclRecords(calendarApi, calendarId);
      const existingRule = existingRules.find((rule) => (
        rule.scopeType === scopeType && (rule.scopeValue ?? '').toLowerCase() === scopeValue.toLowerCase()
      ));

      if (!existingRule || existingRule.role !== shareRole) {
        await calendarApi.acl.insert({
          calendarId,
          requestBody: {
            role: shareRole,
            scope: {
              type: scopeType,
              value: scopeValue,
            },
          },
          sendNotifications: false,
        });
      }

      const shares = await listRoleRoomGoogleCalendarAclRecords(calendarApi, calendarId);
      const updatedBinding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        calendarId,
        syncStatus: {
          ...readJsonObject(existingBinding?.sync_status),
          calendar: {
            ...readJsonObject(readJsonObject(existingBinding?.sync_status).calendar),
            state: 'shared',
            sharedWith: shares.length,
            syncedAt: new Date().toISOString(),
          },
        },
        lastCalendarSyncAt: new Date().toISOString(),
      });
      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);

      res.status(201).json({
        ...buildRoleRoomGoogleProjectBindingResponse(updatedBinding, artifacts),
        shares,
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke dele prosjektkalenderen');
    }
  });

  router.delete('/projects/:projectId/google/calendar/share/:ruleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId, ruleId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere kalenderdeling' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      const calendarId = readStringValue(req.query.calendarId) ?? binding?.calendar_id;
      if (!calendarId) {
        res.status(400).json({ error: 'Prosjektet mangler en Google-kalender' });
        return;
      }

      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      await calendarApi.acl.delete({
        calendarId,
        ruleId,
      });
      const shares = await listRoleRoomGoogleCalendarAclRecords(calendarApi, calendarId);

      res.json({
        success: true,
        shares,
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke fjerne kalenderdeling');
    }
  });

  router.get('/projects/:projectId/google/agreements/signatures', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å hente signaturflyten' });
        return;
      }

      const signatures = await getRoleRoomGoogleAgreementSignaturesByProject(projectId);
      res.json({
        signatures: signatures.map((signature) => buildRoleRoomGoogleAgreementSignatureResponse(signature)),
      });
    } catch (error) {
      console.error('Role Room Google agreement signature fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente Google-signaturer for avtaler' });
    }
  });

  router.post('/projects/:projectId/google/agreements/:agreementId/prepare', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId, agreementId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å klargjøre Google-signatur' });
        return;
      }

      const userId = getUserId(req);
      const requestUser = getOptionalRequestUser(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const agreements = await readLegacyProjectAgreements(projectId);
      const agreement = agreements.find((entry) => readStringValue(entry.id) === agreementId);
      if (!agreement) {
        res.status(404).json({ error: 'Avtalen ble ikke funnet' });
        return;
      }

      const driveApi = google.drive({ version: 'v3', auth: googleClient.oauthClient });
      const docsApi = google.docs({ version: 'v1', auth: googleClient.oauthClient });
      const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
      const projectName = await getRoleRoomProjectName(projectId);
      const driveLayout = !existingBinding?.drive_root_folder_id
        ? await ensureRoleRoomGoogleDriveLayout(driveApi, projectName)
        : {
            rootFolderId: existingBinding.drive_root_folder_id,
            folderLayout: {
              ...readJsonObject(existingBinding.folder_layout),
            },
          };

      if (!readStringValue(driveLayout.folderLayout.approvals)) {
        const refreshedDriveLayout = await ensureRoleRoomGoogleDriveLayout(
          driveApi,
          projectName,
          driveLayout.rootFolderId,
        );
        driveLayout.folderLayout = {
          ...driveLayout.folderLayout,
          ...refreshedDriveLayout.folderLayout,
        };
      }

      const approvalsFolderId = readStringValue(driveLayout.folderLayout.approvals) ?? driveLayout.rootFolderId;
      const document = await createRoleRoomGoogleAgreementDocument(docsApi, driveApi, agreement, approvalsFolderId);
      const signatureHash = crypto
        .createHash('sha256')
        .update(serializeRoleRoomAgreementDocument(agreement))
        .digest('hex');

      const artifact = await upsertRoleRoomGoogleArtifact(projectId, {
        localEntityType: 'project_agreement',
        localEntityId: agreementId,
        artifactType: 'google_signature_source',
        sourceLabel: 'google_signature_source',
        driveFileId: document.fileId,
        webViewUrl: document.webViewUrl,
        webContentLink: document.webContentLink,
        mimeType: document.mimeType,
        folderKey: 'approvals',
        syncStatus: 'synced',
        metadata: {
          agreementTitle: readStringValue(agreement.title),
          counterpartyName: readStringValue(agreement.counterparty_name),
          signatureHash,
        },
        createdBy: userId,
      });
      const pdfSnapshotArtifact = await exportRoleRoomGoogleAgreementPdfArtifact(
        driveApi,
        projectId,
        agreement,
        document.fileId,
        approvalsFolderId,
        'google_signature_pdf_snapshot',
        userId,
      );

      const now = new Date().toISOString();
      const signature = await upsertRoleRoomGoogleAgreementSignature(projectId, agreementId, {
        status: 'prepared',
        documentTitle: readStringValue(agreement.title) ?? 'Prosjektavtale',
        driveSourceFileId: document.fileId,
        requestUrl: document.webViewUrl,
        webViewUrl: document.webViewUrl,
        requestedBy: userId,
        requestedByEmail: requestUser?.email ?? readStringValue(googleClient.connection.role_room_email),
        counterpartyName: readStringValue(agreement.counterparty_name),
        counterpartyEmail: readStringValue(agreement.counterparty_email),
        preparedAt: now,
        lastSyncedAt: now,
        signatureHash,
        metadata: {
          sourceArtifactId: artifact.id,
          pdfSnapshotArtifactId: pdfSnapshotArtifact.id,
          agreementType: readStringValue(agreement.agreement_type),
          counterpartyType: readStringValue(agreement.counterparty_type),
        },
      });

      const updatedAgreement = await syncAgreementSignatureSnapshot(projectId, agreementId, signature);
      if (!updatedAgreement) {
        res.status(500).json({ error: 'Kunne ikke oppdatere avtalen etter klargjøring' });
        return;
      }

      const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        driveRootFolderId: driveLayout.rootFolderId,
        folderLayout: driveLayout.folderLayout,
        syncStatus: {
          drive: {
            state: 'synced',
            lastPreparedAgreementId: agreementId,
            syncedAt: now,
          },
        },
        lastDriveSyncAt: now,
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.status(201).json({
        binding: buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).binding,
        artifacts: buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).artifacts,
        agreement: updatedAgreement,
        signature: buildRoleRoomGoogleAgreementSignatureResponse(signature),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke klargjøre Google-signatur for avtalen');
    }
  });

  router.post('/projects/:projectId/google/agreements/:agreementId/send', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId, agreementId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å sende signeringslenken' });
        return;
      }

      const userId = getUserId(req);
      const agreements = await readLegacyProjectAgreements(projectId);
      const agreement = agreements.find((entry) => readStringValue(entry.id) === agreementId);
      if (!agreement) {
        res.status(404).json({ error: 'Avtalen ble ikke funnet' });
        return;
      }

      const existingSignature = await getRoleRoomGoogleAgreementSignatureByAgreementId(projectId, agreementId);
      if (!existingSignature || !readStringValue(existingSignature.drive_source_file_id)) {
        res.status(404).json({ error: 'Avtalen må klargjøres i Google før den kan sendes til signering' });
        return;
      }

      const counterpartyEmail = readStringValue(agreement.counterparty_email) ?? readStringValue(existingSignature.counterparty_email);
      if (!counterpartyEmail) {
        res.status(400).json({ error: 'Avtalen mangler e-postadresse for motparten' });
        return;
      }

      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const sourceFileId = existingSignature.drive_source_file_id;
      if (!sourceFileId) {
        res.status(400).json({ error: 'Avtalens kildefil mangler Google Drive-ID og kan ikke deles.' });
        return;
      }

      const driveApi = google.drive({ version: 'v3', auth: googleClient.oauthClient });
      await shareRoleRoomGoogleAgreementSourceFile(
        driveApi,
        sourceFileId,
        counterpartyEmail,
      );

      const now = new Date().toISOString();
      const signature = await upsertRoleRoomGoogleAgreementSignature(projectId, agreementId, {
        status: 'sent',
        sentAt: existingSignature.sent_at ?? now,
        lastSyncedAt: now,
        requestUrl: readStringValue(existingSignature.request_url) ?? readStringValue(existingSignature.web_view_url),
        metadata: {
          ...readJsonObject(existingSignature.metadata),
          dispatchedAt: now,
          dispatchedToEmail: counterpartyEmail,
        },
      });

      const updatedAgreement = await syncAgreementSignatureSnapshot(projectId, agreementId, signature);
      if (!updatedAgreement) {
        res.status(500).json({ error: 'Kunne ikke oppdatere avtalen etter utsendelse' });
        return;
      }

      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        binding: binding ? buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).binding : null,
        artifacts: buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).artifacts,
        agreement: updatedAgreement,
        signature: buildRoleRoomGoogleAgreementSignatureResponse(signature),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke sende Google-signaturflyten til motparten');
    }
  });

  router.post('/projects/:projectId/google/agreements/:agreementId/sync', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId, agreementId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å synkronisere Google-signaturflyten' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const agreements = await readLegacyProjectAgreements(projectId);
      const agreement = agreements.find((entry) => readStringValue(entry.id) === agreementId);
      if (!agreement) {
        res.status(404).json({ error: 'Avtalen ble ikke funnet' });
        return;
      }

      const existingSignature = await getRoleRoomGoogleAgreementSignatureByAgreementId(projectId, agreementId);
      if (!existingSignature) {
        res.status(404).json({ error: 'Google-signatur er ikke klargjort for denne avtalen ennå' });
        return;
      }

      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      const driveApi = google.drive({ version: 'v3', auth: googleClient.oauthClient });
      const signatureMetadata = readJsonObject(existingSignature.metadata);
      const existingPdfSnapshotArtifact = await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_pdf_snapshot',
      );
      const existingSignedPdfArtifact = await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_signed_pdf',
      );
      const existingAuditArtifact = await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_audit',
      );
      const syncedArtifacts = (await Promise.all([
        syncRoleRoomGoogleDriveArtifactFromGoogle(driveApi, {
          projectId,
          localEntityType: 'project_agreement',
          localEntityId: agreementId,
          artifactType: 'google_signature_source',
          driveFileId: readStringValue(existingSignature.drive_source_file_id),
          sourceLabel: 'google_signature_source',
          folderKey: 'approvals',
          metadata: {
            agreementTitle: readStringValue(agreement.title),
            counterpartyName: readStringValue(agreement.counterparty_name),
          },
          createdBy: userId,
        }),
        syncRoleRoomGoogleDriveArtifactFromGoogle(driveApi, {
          projectId,
          localEntityType: 'project_agreement',
          localEntityId: agreementId,
          artifactType: 'google_signature_pdf_snapshot',
          driveFileId: readStringValue(existingPdfSnapshotArtifact?.drive_file_id),
          sourceLabel: 'google_signature_pdf_snapshot',
          folderKey: 'approvals',
          metadata: {
            agreementTitle: readStringValue(agreement.title),
            artifactKind: 'grunnlag',
          },
          createdBy: userId,
        }),
        syncRoleRoomGoogleDriveArtifactFromGoogle(driveApi, {
          projectId,
          localEntityType: 'project_agreement',
          localEntityId: agreementId,
          artifactType: 'google_signature_signed_pdf',
          driveFileId: readStringValue(existingSignature.signed_drive_file_id)
            ?? readStringValue(existingSignedPdfArtifact?.drive_file_id),
          sourceLabel: 'google_signature_signed_pdf',
          folderKey: 'approvals',
          metadata: {
            agreementTitle: readStringValue(agreement.title),
            artifactKind: 'signert',
          },
          createdBy: userId,
        }),
        syncRoleRoomGoogleDriveArtifactFromGoogle(driveApi, {
          projectId,
          localEntityType: 'project_agreement',
          localEntityId: agreementId,
          artifactType: 'google_signature_audit',
          driveFileId: readStringValue(existingAuditArtifact?.drive_file_id),
          sourceLabel: 'google_signature_audit',
          folderKey: 'approvals',
          metadata: {
            agreementTitle: readStringValue(agreement.title),
            artifactKind: 'audit',
          },
          createdBy: userId,
        }),
      ])).filter((artifact): artifact is RoleRoomGoogleArtifactRow => Boolean(artifact));

      const sourceArtifact = syncedArtifacts.find((artifact) => artifact.artifact_type === 'google_signature_source') ?? await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_source',
      );
      const pdfSnapshotArtifact = syncedArtifacts.find((artifact) => artifact.artifact_type === 'google_signature_pdf_snapshot') ?? await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_pdf_snapshot',
      );
      const signedPdfArtifact = syncedArtifacts.find((artifact) => artifact.artifact_type === 'google_signature_signed_pdf') ?? await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_signed_pdf',
      );
      const auditArtifact = syncedArtifacts.find((artifact) => artifact.artifact_type === 'google_signature_audit') ?? await getRoleRoomGoogleArtifactByType(
        projectId,
        'project_agreement',
        agreementId,
        'google_signature_audit',
      );

      const now = new Date().toISOString();
      const inferredStatus = signedPdfArtifact?.sync_status === 'synced'
        ? 'signed'
        : sourceArtifact && (sourceArtifact.sync_status === 'missing' || sourceArtifact.sync_status === 'error')
          ? 'error'
          : existingSignature.status ?? 'not_started';

      const signature = await upsertRoleRoomGoogleAgreementSignature(projectId, agreementId, {
        status: inferredStatus,
        documentTitle: readStringValue(existingSignature.document_title) ?? readStringValue(agreement.title),
        driveSourceFileId: readStringValue(sourceArtifact?.drive_file_id) ?? readStringValue(existingSignature.drive_source_file_id),
        signedDriveFileId: readStringValue(signedPdfArtifact?.drive_file_id) ?? readStringValue(existingSignature.signed_drive_file_id),
        auditArtifactId: readStringValue(auditArtifact?.id) ?? readStringValue(existingSignature.audit_artifact_id),
        requestUrl: readStringValue(existingSignature.request_url) ?? readStringValue(sourceArtifact?.web_view_url),
        webViewUrl: readStringValue(sourceArtifact?.web_view_url) ?? readStringValue(existingSignature.web_view_url),
        lastSyncedAt: now,
        signedAt: inferredStatus === 'signed'
          ? existingSignature.signed_at ?? readStringValue(signedPdfArtifact?.updated_at) ?? now
          : undefined,
        metadata: {
          ...signatureMetadata,
          sourceArtifactId: readStringValue(sourceArtifact?.id) ?? readStringValue(signatureMetadata.sourceArtifactId),
          pdfSnapshotArtifactId: readStringValue(pdfSnapshotArtifact?.id) ?? readStringValue(signatureMetadata.pdfSnapshotArtifactId),
          signedPdfArtifactId: readStringValue(signedPdfArtifact?.id) ?? readStringValue(signatureMetadata.signedPdfArtifactId),
          auditArtifactId: readStringValue(auditArtifact?.id) ?? readStringValue(signatureMetadata.auditArtifactId),
          syncedFromGoogleAt: now,
        },
      });

      const updatedAgreement = await syncAgreementSignatureSnapshot(projectId, agreementId, signature);
      if (!updatedAgreement) {
        res.status(500).json({ error: 'Kunne ikke oppdatere avtalen etter Google-synkronisering' });
        return;
      }

      const updatedBinding = binding
        ? await updateRoleRoomGoogleProjectBinding(projectId, {
            syncStatus: {
              drive: {
                ...(readRecordValue(readJsonObject(binding.sync_status).drive) ?? {}),
                state: 'synced',
                lastAgreementSignatureSyncAt: now,
                lastAgreementId: agreementId,
              },
            },
            lastDriveSyncAt: now,
          })
        : null;
      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        binding: updatedBinding ? buildRoleRoomGoogleProjectBindingResponse(updatedBinding, artifacts).binding : null,
        artifacts: buildRoleRoomGoogleProjectBindingResponse(updatedBinding ?? binding, artifacts).artifacts,
        agreement: updatedAgreement,
        signature: buildRoleRoomGoogleAgreementSignatureResponse(signature),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke synkronisere Google-signaturflyten for avtalen');
    }
  });

  router.post('/projects/:projectId/google/agreements/:agreementId/status', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId, agreementId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const requestedStatus = readStringValue(req.body?.status) as RoleRoomGoogleAgreementSignatureStatus | undefined;
      const allowedStatuses: RoleRoomGoogleAgreementSignatureStatus[] = [
        'prepared',
        'sent',
        'opened_in_google',
        'signed',
        'rejected',
        'changes_requested',
        'error',
      ];
      if (!requestedStatus || !allowedStatuses.includes(requestedStatus)) {
        res.status(400).json({ error: 'Ugyldig Google-signaturstatus' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      const canUpdateSignature = requestedStatus === 'signed'
        || requestedStatus === 'rejected'
        || requestedStatus === 'changes_requested'
        ? (canWriteProducerData(req, roleRecord) || canDecideProducerReview(req, roleRecord))
        : canWriteProducerData(req, roleRecord);
      if (!canUpdateSignature) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere signaturstatus' });
        return;
      }

      const userId = getUserId(req);
      const requestUser = getOptionalRequestUser(req);
      const agreements = await readLegacyProjectAgreements(projectId);
      const agreement = agreements.find((entry) => readStringValue(entry.id) === agreementId);
      if (!agreement) {
        res.status(404).json({ error: 'Avtalen ble ikke funnet' });
        return;
      }

      const existingSignature = await getRoleRoomGoogleAgreementSignatureByAgreementId(projectId, agreementId);
      if (!existingSignature) {
        res.status(404).json({ error: 'Google-signatur er ikke klargjort for denne avtalen ennå' });
        return;
      }

      const now = new Date().toISOString();
      const nextMetadata = {
        ...readJsonObject(existingSignature.metadata),
        reason: readStringValue(req.body?.reason) ?? readStringValue(existingSignature.metadata?.reason),
      };

      let auditArtifactId: string | null = readStringValue(existingSignature.audit_artifact_id);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId).catch(() => null);
      const binding = await getRoleRoomGoogleProjectBinding(projectId);
      let signedPdfArtifactId = readStringValue(existingSignature.metadata?.signedPdfArtifactId);
      let signedDriveFileId = readStringValue(req.body?.signedDriveFileId) ?? readStringValue(existingSignature.signed_drive_file_id);

      if (googleClient && binding?.audit_signature_storage_enabled && (
        requestedStatus === 'signed'
        || requestedStatus === 'rejected'
        || requestedStatus === 'changes_requested'
      )) {
        const driveApi = google.drive({ version: 'v3', auth: googleClient.oauthClient });
        const projectName = await getRoleRoomProjectName(projectId);
        const driveLayout = !binding.drive_root_folder_id
          ? await ensureRoleRoomGoogleDriveLayout(driveApi, projectName)
          : {
              rootFolderId: binding.drive_root_folder_id,
              folderLayout: {
                ...readJsonObject(binding.folder_layout),
              },
            };
        const approvalsFolderId = readStringValue(driveLayout.folderLayout.approvals) ?? driveLayout.rootFolderId;
        const auditPayload = {
          agreementId,
          agreementTitle: readStringValue(agreement.title),
          status: requestedStatus,
          actorUserId: userId,
          actorEmail: requestUser?.email ?? readStringValue(existingSignature.requested_by_email),
          counterpartyName: readStringValue(agreement.counterparty_name),
          counterpartyEmail: readStringValue(agreement.counterparty_email),
          reason: readStringValue(req.body?.reason) ?? null,
          signatureHash: readStringValue(existingSignature.signature_hash),
          timestamp: now,
        };
        const auditBuffer = Buffer.from(JSON.stringify(auditPayload, null, 2), 'utf8');
        const existingAuditArtifactResult = await pool.query<RoleRoomGoogleArtifactRow>(
          `SELECT * FROM role_room_google_artifacts
           WHERE project_id = $1
             AND local_entity_type = 'project_agreement'
             AND local_entity_id = $2
             AND artifact_type = 'google_signature_audit'
           LIMIT 1`,
          [projectId, agreementId],
        );
        const existingAuditArtifact = existingAuditArtifactResult.rows[0] ?? null;
        const driveResponse = existingAuditArtifact?.drive_file_id
          ? await driveApi.files.update({
              fileId: existingAuditArtifact.drive_file_id,
              requestBody: { name: `${readStringValue(agreement.title) ?? 'Prosjektavtale'} · signaturspor.json` },
              media: { mimeType: 'application/json', body: toRoleRoomGoogleUploadBody(auditBuffer) },
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            })
          : await driveApi.files.create({
              requestBody: {
                name: `${readStringValue(agreement.title) ?? 'Prosjektavtale'} · signaturspor.json`,
                parents: [approvalsFolderId],
              },
              media: { mimeType: 'application/json', body: toRoleRoomGoogleUploadBody(auditBuffer) },
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            });
        const auditArtifact = await upsertRoleRoomGoogleArtifact(projectId, {
          localEntityType: 'project_agreement',
          localEntityId: agreementId,
          artifactType: 'google_signature_audit',
          sourceLabel: 'google_signature_audit',
          driveFileId: readStringValue(driveResponse.data.id),
          webViewUrl: readStringValue(driveResponse.data.webViewLink),
          webContentLink: readStringValue(driveResponse.data.webContentLink),
          mimeType: readStringValue(driveResponse.data.mimeType) ?? 'application/json',
          folderKey: 'approvals',
          syncStatus: 'synced',
          metadata: auditPayload,
          createdBy: userId,
        });
        auditArtifactId = auditArtifact.id;

        if (requestedStatus === 'signed' && readStringValue(existingSignature.drive_source_file_id)) {
          const signedPdfArtifact = await exportRoleRoomGoogleAgreementPdfArtifact(
            driveApi,
            projectId,
            agreement,
            readStringValue(existingSignature.drive_source_file_id)!,
            approvalsFolderId,
            'google_signature_signed_pdf',
            userId,
          );
          signedPdfArtifactId = signedPdfArtifact.id;
          signedDriveFileId = signedPdfArtifact.drive_file_id;
        }
      }

      const signature = await upsertRoleRoomGoogleAgreementSignature(projectId, agreementId, {
        status: requestedStatus,
        signedDriveFileId,
        requestUrl: readStringValue(req.body?.requestUrl),
        webViewUrl: readStringValue(req.body?.webViewUrl) ?? readStringValue(existingSignature.web_view_url),
        auditArtifactId,
        sentAt: requestedStatus === 'sent'
          ? now
          : requestedStatus === 'opened_in_google'
            ? existingSignature.sent_at ?? now
            : undefined,
        signedAt: requestedStatus === 'signed' ? now : undefined,
        declinedAt: requestedStatus === 'rejected' || requestedStatus === 'changes_requested' ? now : undefined,
        lastOpenedAt: requestedStatus === 'opened_in_google' ? now : undefined,
        lastSyncedAt: now,
        metadata: {
          ...nextMetadata,
          signedPdfArtifactId,
        },
      });

      const updatedAgreement = await syncAgreementSignatureSnapshot(projectId, agreementId, signature);
      if (!updatedAgreement) {
        res.status(500).json({ error: 'Kunne ikke oppdatere avtalen etter signaturstatusendring' });
        return;
      }

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        binding: binding ? buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).binding : null,
        artifacts: buildRoleRoomGoogleProjectBindingResponse(binding, artifacts).artifacts,
        agreement: updatedAgreement,
        signature: buildRoleRoomGoogleAgreementSignatureResponse(signature),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke oppdatere Google-signaturstatusen');
    }
  });

  router.post('/projects/:projectId/google/drive/sync', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å synkronisere Drive' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const driveApi = google.drive({ version: 'v3', auth: googleClient.oauthClient });
      const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
      const projectName = await getRoleRoomProjectName(projectId);
      const driveLayout = await ensureRoleRoomGoogleDriveLayout(
        driveApi,
        projectName,
        existingBinding?.drive_root_folder_id ?? null,
      );

      const legacyFiles = await readLegacyProjectFiles(projectId);
      const filteredLocalFiles = Array.isArray(req.body?.fileIds) && req.body.fileIds.length > 0
        ? legacyFiles.filter((fileRecord) => {
            const fileId = readStringValue(fileRecord.id);
            return fileId ? req.body.fileIds.includes(fileId) : false;
          })
        : legacyFiles;

      const uploadedArtifacts: RoleRoomGoogleArtifactRow[] = [];

      for (const fileRecord of filteredLocalFiles) {
        const fileId = readStringValue(fileRecord.id);
        const storagePath = readStringValue(fileRecord.storagePath);
        const originalName = readStringValue(fileRecord.name) ?? readStringValue(fileRecord.originalName) ?? fileId;
        if (!fileId || !storagePath || !originalName || !existsSync(storagePath)) {
          continue;
        }

        const folderKey = getRoleRoomGoogleFolderKeyForFile(fileRecord);
        const parentFolderId = driveLayout.folderLayout[folderKey] ?? driveLayout.rootFolderId;
        const existingArtifactResult = await pool.query<RoleRoomGoogleArtifactRow>(
          `SELECT * FROM role_room_google_artifacts
           WHERE project_id = $1
             AND local_entity_type = 'project_file'
             AND local_entity_id = $2
             AND artifact_type = 'drive_file'
           LIMIT 1`,
          [projectId, fileId],
        );
        const existingArtifact = existingArtifactResult.rows[0] ?? null;
        const fileBuffer = await fs.readFile(storagePath);
        const media = {
          mimeType: readStringValue(fileRecord.mimeType) ?? 'application/octet-stream',
          body: toRoleRoomGoogleUploadBody(fileBuffer),
        };

        const driveResponse = existingArtifact?.drive_file_id
          ? await driveApi.files.update({
              fileId: existingArtifact.drive_file_id,
              requestBody: { name: originalName },
              media,
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            })
          : await driveApi.files.create({
              requestBody: {
                name: originalName,
                parents: [parentFolderId],
              },
              media,
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            });

        uploadedArtifacts.push(await upsertRoleRoomGoogleArtifact(projectId, {
          localEntityType: 'project_file',
          localEntityId: fileId,
          artifactType: 'drive_file',
          sourceLabel: readStringValue(readJsonObject(fileRecord.metadata).source) ?? 'project_file',
          driveFileId: readStringValue(driveResponse.data.id),
          webViewUrl: readStringValue(driveResponse.data.webViewLink),
          webContentLink: readStringValue(driveResponse.data.webContentLink),
          mimeType: readStringValue(driveResponse.data.mimeType) ?? readStringValue(fileRecord.mimeType),
          folderKey,
          syncStatus: 'synced',
          metadata: {
            ...readJsonObject(fileRecord.metadata),
            name: originalName,
            size: fileRecord.size ?? null,
          },
          createdBy: userId,
        }));
      }

      const generatedArtifacts = Array.isArray(req.body?.generatedArtifacts)
        ? req.body.generatedArtifacts.filter(
          (entry: unknown): entry is Record<string, unknown> => isRecordValue(entry),
        )
        : [];

      for (const generatedArtifact of generatedArtifacts) {
        const localEntityType = readStringValue(generatedArtifact.localEntityType) ?? 'generated_artifact';
        const localEntityId = readStringValue(generatedArtifact.localEntityId) ?? crypto.randomUUID();
        const artifactType = readStringValue(generatedArtifact.artifactType) ?? 'drive_file';
        const title = readStringValue(generatedArtifact.title) ?? `${artifactType}-${localEntityId}`;
        const folderKey = readStringValue(generatedArtifact.folderKey) ?? 'delivery';
        const mimeType = readStringValue(generatedArtifact.mimeType) ?? 'application/json';
        const contentBase64 = readStringValue(generatedArtifact.contentBase64);
        const contentText = readStringValue(generatedArtifact.contentText);
        const contentBuffer = contentBase64
          ? Buffer.from(contentBase64, 'base64')
          : Buffer.from(contentText ?? JSON.stringify(readJsonObject(generatedArtifact.content), null, 2), 'utf8');

        const existingArtifactResult = await pool.query<RoleRoomGoogleArtifactRow>(
          `SELECT * FROM role_room_google_artifacts
           WHERE project_id = $1
             AND local_entity_type = $2
             AND local_entity_id = $3
             AND artifact_type = $4
           LIMIT 1`,
          [projectId, localEntityType, localEntityId, artifactType],
        );
        const existingArtifact = existingArtifactResult.rows[0] ?? null;
        const parentFolderId = driveLayout.folderLayout[folderKey] ?? driveLayout.rootFolderId;

        const driveResponse = existingArtifact?.drive_file_id
          ? await driveApi.files.update({
              fileId: existingArtifact.drive_file_id,
              requestBody: { name: title },
              media: { mimeType, body: toRoleRoomGoogleUploadBody(contentBuffer) },
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            })
          : await driveApi.files.create({
              requestBody: {
                name: title,
                parents: [parentFolderId],
              },
              media: { mimeType, body: toRoleRoomGoogleUploadBody(contentBuffer) },
              fields: 'id,webViewLink,webContentLink,mimeType',
              supportsAllDrives: true,
            });

        uploadedArtifacts.push(await upsertRoleRoomGoogleArtifact(projectId, {
          localEntityType,
          localEntityId,
          artifactType,
          sourceLabel: readStringValue(generatedArtifact.sourceLabel) ?? artifactType,
          driveFileId: readStringValue(driveResponse.data.id),
          webViewUrl: readStringValue(driveResponse.data.webViewLink),
          webContentLink: readStringValue(driveResponse.data.webContentLink),
          mimeType: readStringValue(driveResponse.data.mimeType) ?? mimeType,
          folderKey,
          syncStatus: 'synced',
          metadata: readJsonObject(generatedArtifact.metadata),
          createdBy: userId,
        }));
      }

      const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        driveRootFolderId: driveLayout.rootFolderId,
        folderLayout: driveLayout.folderLayout,
        syncStatus: {
          drive: {
            state: 'synced',
            syncedArtifacts: uploadedArtifacts.length,
            syncedAt: new Date().toISOString(),
          },
        },
        lastDriveSyncAt: new Date().toISOString(),
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        ...buildRoleRoomGoogleProjectBindingResponse(binding, artifacts),
        syncedArtifacts: uploadedArtifacts,
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke synkronisere filer til Google Drive');
    }
  });

  router.post('/projects/:projectId/google/calendar/sync', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å synkronisere kalenderen' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const events = Array.isArray(req.body?.events)
        ? req.body.events.filter(
          (entry: unknown): entry is Record<string, unknown> => isRecordValue(entry),
        )
        : [];
      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
      const calendarId = await resolveRoleRoomGoogleCalendarId(
        calendarApi,
        await getRoleRoomProjectName(projectId),
        readStringValue(req.body?.calendarId) ?? existingBinding?.calendar_id,
      );

      if (events.length === 0) {
        const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
          connectedUserId: userId,
          calendarId,
          syncStatus: {
            calendar: {
              state: 'idle',
              syncedEvents: 0,
              syncedAt: new Date().toISOString(),
            },
          },
          lastCalendarSyncAt: new Date().toISOString(),
        });

        const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
        res.json({
          ...buildRoleRoomGoogleProjectBindingResponse(binding, artifacts),
          syncedEvents: [],
          message: 'Ingen kalenderhendelser å synkronisere ennå',
        });
        return;
      }

      const syncedEvents: RoleRoomGoogleArtifactRow[] = [];
      for (const event of events) {
        syncedEvents.push(await syncRoleRoomGoogleCalendarEvent(calendarApi, calendarId, projectId, event, userId));
      }

      const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        calendarId,
        syncStatus: {
          calendar: {
            state: 'synced',
            syncedEvents: syncedEvents.length,
            syncedAt: new Date().toISOString(),
          },
        },
        lastCalendarSyncAt: new Date().toISOString(),
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.json({
        ...buildRoleRoomGoogleProjectBindingResponse(binding, artifacts),
        syncedEvents,
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke synkronisere kalenderen');
    }
  });

  router.post('/projects/:projectId/google/meet/session', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette møtesesjoner' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        res.status(400).json({ error: 'Google Workspace er ikke koblet til denne brukeren' });
        return;
      }

      const calendarApi = google.calendar({ version: 'v3', auth: googleClient.oauthClient });
      const existingBinding = await getRoleRoomGoogleProjectBinding(projectId);
      const calendarId = await resolveRoleRoomGoogleCalendarId(
        calendarApi,
        await getRoleRoomProjectName(projectId),
        existingBinding?.calendar_id,
      );

      const eventArtifact = await syncRoleRoomGoogleCalendarEvent(calendarApi, calendarId, projectId, {
        ...readJsonObject(req.body),
        includeMeet: true,
        entityType: readStringValue(req.body?.entityType) ?? 'meet_session',
        entityId: readStringValue(req.body?.entityId) ?? crypto.randomUUID(),
      }, userId);

      const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        calendarId,
        syncStatus: {
          meet: {
            state: 'ready',
            lastMeetUrl: readStringValue(eventArtifact.meet_url),
            syncedAt: new Date().toISOString(),
          },
        },
        lastCalendarSyncAt: new Date().toISOString(),
      });

      const artifacts = await getRoleRoomGoogleArtifactsByProject(projectId);
      res.status(201).json({
        ...buildRoleRoomGoogleProjectBindingResponse(binding, artifacts),
        event: {
          id: eventArtifact.id,
          meetUrl: readStringValue(eventArtifact.meet_url),
          calendarEventId: readStringValue(eventArtifact.calendar_event_id),
          webViewUrl: readStringValue(eventArtifact.web_view_url),
        },
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke opprette Google Meet-sesjonen');
    }
  });

  router.get('/projects/:projectId/google/people/search', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const query = readStringValue(req.query.q ?? req.query.name);
      if (!query) {
        res.json({ contacts: [] });
        return;
      }

      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til kontaktsøk' });
        return;
      }

      const userId = getUserId(req);
      const googleClient = await buildAuthorizedRoleRoomGoogleClient(req, userId);
      if (!googleClient) {
        const project = await readCastingProjectRow(projectId);
        const projectMetadata = readJsonObject(project?.metadata);
        const projectSettings = readJsonObject(project?.settings);
        const localRoleResult = await pool.query(
          `SELECT user_id, email, role
           FROM casting_user_roles
           WHERE project_id = $1
             AND (
               LOWER(COALESCE(email, '')) LIKE $2
               OR LOWER(COALESCE(user_id, '')) LIKE $2
               OR LOWER(COALESCE(role, '')) LIKE $2
             )
           ORDER BY updated_at DESC
           LIMIT 10`,
          [projectId, `%${query.toLowerCase()}%`],
        );
        const localContacts = [
          {
            resourceName: `project:${projectId}:client`,
            name: readStringValue(projectMetadata.clientName)
              ?? readStringValue(projectSettings.clientName)
              ?? readStringValue(projectMetadata.contactName)
              ?? null,
            email: normalizeEmailValue(projectMetadata.clientEmail)
              ?? normalizeEmailValue(projectSettings.clientEmail)
              ?? normalizeEmailValue(projectMetadata.contactEmail)
              ?? null,
            phone: readStringValue(projectMetadata.clientPhone)
              ?? readStringValue(projectSettings.clientPhone)
              ?? readStringValue(projectMetadata.contactPhone)
              ?? null,
            organization: readStringValue(projectMetadata.clientCompany)
              ?? readStringValue(projectSettings.clientCompany)
              ?? null,
            source: 'local_project',
          },
          ...localRoleResult.rows.map((row) => ({
            resourceName: `project:${projectId}:role:${readStringValue(row.user_id) ?? crypto.randomUUID()}`,
            name: readStringValue(row.user_id),
            email: normalizeEmailValue(row.email),
            phone: null,
            organization: readStringValue(row.role),
            source: 'local_role',
          })),
        ].filter((entry) => {
          const haystack = [entry.name, entry.email, entry.phone, entry.organization].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(query.toLowerCase());
        });

        res.json({
          contacts: localContacts,
          contactsContext: {
            lastQuery: query,
            lastResultCount: localContacts.length,
            lastQueriedAt: nowISO(),
            source: 'local_fallback',
            reason: 'google_workspace_not_connected',
          },
        });
        return;
      }

      const peopleApi = google.people({ version: 'v1', auth: googleClient.oauthClient });
      const result = await peopleApi.people.searchContacts({
        query,
        pageSize: 10,
        readMask: 'names,emailAddresses,phoneNumbers,organizations',
      });

      const contacts = (result.data.results ?? []).map((entry) => {
        const person = entry.person;
        const name = readStringValue(person?.names?.[0]?.displayName);
        const email = readStringValue(person?.emailAddresses?.[0]?.value);
        const phone = readStringValue(person?.phoneNumbers?.[0]?.value);
        const organization = readStringValue(person?.organizations?.[0]?.name);
        return {
          resourceName: readStringValue(person?.resourceName),
          name,
          email,
          phone,
          organization,
        };
      }).filter((entry) => entry.name || entry.email || entry.phone);

      const binding = await updateRoleRoomGoogleProjectBinding(projectId, {
        connectedUserId: userId,
        contactsContext: {
          lastQuery: query,
          lastResultCount: contacts.length,
          lastQueriedAt: new Date().toISOString(),
        },
      });

      res.json({
        contacts,
        contactsContext: readJsonObject(binding.contacts_context),
      });
    } catch (error) {
      sendRoleRoomGoogleError(res, error, 'Kunne ikke søke i Google-kontakter');
    }
  });

  // ═══════════════════════════════════════════════════════════
  // API Key Management (no auth required for create — bootstrap)
  // ═══════════════════════════════════════════════════════════

  router.post('/api-keys', async (req: Request, res: Response) => {
    const configuredBootstrapToken = readStringValue(process.env.ROLE_ROOM_API_KEY_BOOTSTRAP_TOKEN);
    const providedBootstrapToken = readOptionalHeaderValue(req, 'x-role-room-bootstrap-token');
    const hasValidBootstrapToken = !!configuredBootstrapToken && providedBootstrapToken === configuredBootstrapToken;

    const createApiKey = async (): Promise<void> => {
      const { name, userId, scopes, expiresInDays } = req.body as {
        name: string;
        userId: string;
        scopes?: string[];
        expiresInDays?: number;
      };

      if (!name || !userId) {
        res.status(400).json({ error: 'name og userId er påkrevd' });
        return;
      }

      const rawKey = generateApiKey();
      const keyHash = hashApiKey(rawKey);
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : null;

      try {
        await pool.query(
          `INSERT INTO role_room_api_keys (key_hash, name, user_id, scopes, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [keyHash, name, userId, JSON.stringify(scopes ?? ['read', 'write']), expiresAt]
        );

        res.status(201).json({
          apiKey: rawKey,
          name,
          userId,
          scopes: scopes ?? ['read', 'write'],
          expiresAt,
          message: 'Oppbevar denne nøkkelen trygt — den kan ikke gjenopprettes.',
        });
      } catch (err) {
        console.error('Create API key error:', err);
        res.status(500).json({ error: 'Kunne ikke opprette API-nøkkel' });
      }
    };

    if (hasValidBootstrapToken) {
      await createApiKey();
      return;
    }

    await apiKeyAuth(pool, activeSessions)(req, res, async () => {
      if (!requireScope(req, 'admin')) {
        res.status(403).json({ error: 'Admin-tilgang kreves for å opprette API-nøkler' });
        return;
      }

      await createApiKey();
    });
  });

  router.delete('/api-keys/:keyId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await pool.query(
        `UPDATE role_room_api_keys SET is_active = FALSE WHERE id = $1`,
        [req.params.keyId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Casting Projects CRUD
  // ═══════════════════════════════════════════════════════════

  async function bootstrapMissingCastingProjectForRoleRoomSession(
    req: Request,
    projectId: string,
  ): Promise<CastingProjectRow | null> {
    const normalizedProjectId = readStringValue(projectId);
    if (!normalizedProjectId || !requireScope(req, 'write')) {
      return null;
    }

    const userId = getUserId(req);
    const requestUser = getOptionalRequestUser(req);
    const legacyCompatProject = await compatStoreGet<Record<string, unknown>>(
      `casting:project:${normalizedProjectId}`,
    );
    const legacyProjectResult = await pool.query(
      `SELECT name, title, description, status, profession, category, budget, metadata
         FROM legacy.projects
        WHERE id = $1
        LIMIT 1`,
      [normalizedProjectId],
    ).catch(() => ({ rows: [], rowCount: 0 }));
    const legacyProject = readRecordValue(legacyProjectResult.rows[0]) ?? {};
    const sourceProject = legacyCompatProject && Object.keys(legacyCompatProject).length > 0
      ? legacyCompatProject
      : legacyProject;
    const sourceMetadata = readJsonObject(sourceProject.metadata);
    const name =
      readStringValue(sourceProject.name) ||
      readStringValue(sourceProject.title) ||
      readStringValue(sourceProject.projectName) ||
      normalizeRoleRoomProjectName(normalizedProjectId);
    const description =
      readStringValue(sourceProject.description) ||
      readStringValue(sourceMetadata.description);
    const genre =
      readStringValue(sourceProject.genre) ||
      readStringValue(sourceProject.profession) ||
      readStringValue(sourceMetadata.genre);
    const projectType =
      readStringValue(sourceProject.projectType) ||
      readStringValue(sourceProject.project_type) ||
      readStringValue(sourceProject.category) ||
      readStringValue(sourceMetadata.projectType) ||
      readStringValue(sourceMetadata.project_type) ||
      'content_production';
    const currency =
      readStringValue(sourceProject.currency) ||
      readStringValue(sourceMetadata.currency) ||
      'NOK';
    const rawBudget = sourceProject.budget ?? sourceMetadata.budget;
    const parsedBudget = typeof rawBudget === 'number'
      ? rawBudget
      : typeof rawBudget === 'string' && rawBudget.trim().length > 0
        ? Number(rawBudget)
        : null;
    const budget = parsedBudget !== null && Number.isFinite(parsedBudget)
      ? parsedBudget
      : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedProject = await client.query<CastingProjectRow>(
        `INSERT INTO casting_projects (
           id, name, description, status, created_by, genre, project_type,
           budget, currency, metadata, created_at, updated_at
         ) VALUES (
           $1, $2, $3, 'active', $4, $5, $6,
           $7, $8, $9::jsonb, NOW(), NOW()
         )
         ON CONFLICT (id) DO UPDATE SET
           name = COALESCE(NULLIF(casting_projects.name, ''), EXCLUDED.name),
           description = COALESCE(casting_projects.description, EXCLUDED.description),
           created_by = COALESCE(casting_projects.created_by, EXCLUDED.created_by),
           genre = COALESCE(casting_projects.genre, EXCLUDED.genre),
           project_type = COALESCE(casting_projects.project_type, EXCLUDED.project_type),
           budget = COALESCE(casting_projects.budget, EXCLUDED.budget),
           currency = COALESCE(casting_projects.currency, EXCLUDED.currency),
           metadata = COALESCE(casting_projects.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [
          normalizedProjectId,
          name,
          description ?? null,
          userId,
          genre ?? null,
          projectType,
          budget,
          currency,
          JSON.stringify({
            ...sourceMetadata,
            bootstrappedFromRoleRoomSession: true,
            bootstrappedFromLegacyCastingProject: Boolean(legacyCompatProject || legacyProjectResult.rowCount),
            bootstrappedAt: new Date().toISOString(),
            bootstrappedByUserId: userId,
            bootstrappedByEmail: requestUser?.email ?? null,
          }),
        ],
      );

      await client.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, $2, $3, $4, 'director', $5::jsonb, $6)
         ON CONFLICT (project_id, user_id) DO UPDATE SET
           role = COALESCE(casting_user_roles.role, EXCLUDED.role),
           permissions = COALESCE(casting_user_roles.permissions, EXCLUDED.permissions),
           email = COALESCE(casting_user_roles.email, EXCLUDED.email),
           updated_at = NOW()`,
        [
          makeId(),
          normalizedProjectId,
          userId,
          requestUser?.email ?? null,
          JSON.stringify(buildProjectRolePermissions('director')),
          userId,
        ],
      );

      await client.query('COMMIT');
      roleRoomProjectAccessCache.add(normalizedProjectId);
      return insertedProject.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.warn('Role Room project bootstrap failed:', {
        projectId: normalizedProjectId,
        error,
      });
      return null;
    } finally {
      client.release();
    }
  }

  async function resolveStoryLogicProjectContext(req: Request, projectId: string): Promise<{
    project: CastingProjectRow;
    roleRecord: ProjectRoleRecord | null;
  } | null> {
    const normalizedProjectId = readStringValue(projectId);
    if (!normalizedProjectId) {
      return null;
    }

    const projectsReady = await ensureCastingProjectsTable();
    const storyLogicTablesReady = await ensureProducerWorkflowTables();
    if (!projectsReady || !storyLogicTablesReady) {
      throw new Error('story_logic_tables_unavailable');
    }

    const projectResult = await pool.query<CastingProjectRow>(
      `SELECT * FROM casting_projects WHERE id = $1 LIMIT 1`,
      [normalizedProjectId],
    );
    const project = projectResult.rows[0]
      ?? await bootstrapMissingCastingProjectForRoleRoomSession(req, normalizedProjectId);
    if (!project) {
      return null;
    }

    const identifiers = getUserIdentifiers(req);
    let roleRecord = await getProjectRoleRecord(normalizedProjectId, identifiers);
    const ownsProject = identifiers.some((identifier) => identifier === project.created_by);
    if (!roleRecord && ownsProject) {
      roleRecord = {
        role: 'director',
        permissions: getDefaultProjectRolePermissions('director'),
      };
    }

    return { project, roleRecord };
  }

  router.get('/projects', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      if (isTalentScopedRequest(req)) {
        const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
        if (!requestEmail) {
          res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for talentprosjekter' });
          return;
        }

        const result = await pool.query<CastingProjectRow>(
          `SELECT DISTINCT cp.*
             FROM casting_projects cp
             INNER JOIN casting_candidates cc
               ON cc.project_id = cp.id
            WHERE LOWER(COALESCE(cc.email, '')) = LOWER($1)
            ORDER BY cp.updated_at DESC`,
          [requestEmail],
        );
        res.json(result.rows);
        return;
      }

      const result = await pool.query<CastingProjectRow>(
        `SELECT
           cp.*,
           COALESCE(
             NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.first_name, ''), NULLIF(u.last_name, ''))), ''),
             NULLIF(u.username, ''),
             NULLIF(u.email, ''),
             NULLIF(cp.created_by, '')
           ) AS created_by_label
         FROM casting_projects cp
         LEFT JOIN casting_user_roles cur ON cp.id = cur.project_id AND cur.user_id = $1
         LEFT JOIN users u ON CAST(u.id AS TEXT) = cp.created_by OR LOWER(COALESCE(u.email, '')) = LOWER(COALESCE(cp.created_by, ''))
         WHERE cp.created_by = $1 OR cur.user_id IS NOT NULL
         ORDER BY cp.updated_at DESC`,
        [userId]
      );
      res.json(result.rows.map((row) => buildCastingProjectResponse(row)));
    } catch (err) {
      console.error('Fetch projects error:', err);
      res.status(500).json({ error: 'Kunne ikke hente prosjekter' });
    }
  });

  router.get('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
        if (!requestEmail) {
          res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for talentprosjekter' });
          return;
        }

        const assignments = await resolveRoleRoomTalentAssignmentsForEmail(requestEmail, {
          projectId: req.params.id,
          req,
        });
        const assignment = assignments[0];
        if (!assignment) {
          res.status(404).json({ error: 'Prosjekt ikke funnet for innlogget talent' });
          return;
        }

        res.json({
          ...assignment.project,
          roles: assignment.roles,
          candidates: [assignment.candidate],
          crew: [],
          schedules: assignment.schedules,
          locations: [],
          props: [],
          shotLists: [],
          userRoles: [],
        });
        return;
      }

      const result = await pool.query<CastingProjectRow>(
        `SELECT
           cp.*,
           COALESCE(
             NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.first_name, ''), NULLIF(u.last_name, ''))), ''),
             NULLIF(u.username, ''),
             NULLIF(u.email, ''),
             NULLIF(cp.created_by, '')
           ) AS created_by_label
         FROM casting_projects cp
         LEFT JOIN users u ON CAST(u.id AS TEXT) = cp.created_by OR LOWER(COALESCE(u.email, '')) = LOWER(COALESCE(cp.created_by, ''))
         WHERE cp.id = $1`,
        [req.params.id]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      // Fetch all sub-entities
      const [roles, candidates, crew, schedules, locations, props, shotLists, userRoles] = await Promise.all([
        pool.query('SELECT * FROM casting_roles WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_candidates WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_crew WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_schedules WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_locations WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_props WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_shot_lists WHERE project_id = $1', [req.params.id]),
        pool.query('SELECT * FROM casting_user_roles WHERE project_id = $1', [req.params.id]),
      ]);

      res.json(buildCastingProjectResponse(result.rows[0], {
        roles: roles.rows,
        candidates: candidates.rows,
        crew: crew.rows,
        schedules: schedules.rows,
        locations: locations.rows,
        props: props.rows,
        shotLists: shotLists.rows,
        userRoles: userRoles.rows,
      }));
    } catch (err) {
      console.error('Fetch project error:', err);
      res.status(500).json({ error: 'Kunne ikke hente prosjekt' });
    }
  });

  router.get('/projects/:projectId/story-logic', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const projectId = readStringValue(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'project_id_required' });
      return;
    }

    // "Tom state" for GET: prosjekt finnes ikke ennå (fresh frontend-state),
    // eller prosjektet finnes men har ingen story-logic-rad. Begge er gyldige
    // tilstander for klient — vi returnerer 200 med null storyLogic i stedet
    // for 404 så DevTools-konsollen ikke fylles med falske feilmeldinger.
    // Skrivetilgang (POST) returnerer fortsatt 404 ved manglende prosjekt.
    try {
      const context = await resolveStoryLogicProjectContext(req, projectId);
      if (!context) {
        res.json({ success: true, projectId, storyLogic: null, version: 0 });
        return;
      }
      if (!canReadStoryLogic(req, context.roleRecord)) {
        res.status(403).json({ error: 'story_logic_read_access_denied' });
        return;
      }

      const result = await pool.query<RoleRoomStoryLogicRow>(
        `SELECT * FROM role_room_story_logic WHERE project_id = $1 LIMIT 1`,
        [projectId],
      );
      const row = result.rows[0];
      if (!row) {
        res.json({ success: true, projectId, storyLogic: null, version: 0 });
        return;
      }

      await appendRoleRoomStoryLogicAuditEvent({
        req,
        projectId,
        action: 'story_logic_read',
        nextVersion: Number(row.version) || 1,
      });
      res.json(buildRoleRoomStoryLogicResponse(row));
    } catch (err) {
      console.error('Fetch story logic error:', err);
      res.status(500).json({ error: 'story_logic_fetch_failed' });
    }
  });

  router.post('/projects/:projectId/story-logic', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'write_scope_required' });
      return;
    }

    const projectId = readStringValue(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'project_id_required' });
      return;
    }

    try {
      const context = await resolveStoryLogicProjectContext(req, projectId);
      if (!context) {
        res.status(404).json({ error: 'project_not_found' });
        return;
      }
      if (!canWriteStoryLogic(req, context.roleRecord)) {
        res.status(403).json({ error: 'story_logic_write_access_denied' });
        return;
      }

      const body = readRecordValue(req.body) ?? {};
      const payloadProjectId = readStringValue(body.projectId) ?? readStringValue(body.project_id);
      if (payloadProjectId && payloadProjectId !== projectId) {
        await appendRoleRoomStoryLogicAuditEvent({
          req,
          projectId,
          action: 'story_logic_cross_project_rejected',
          metadata: {
            payloadProjectId,
            routeProjectId: projectId,
          },
        });
        res.status(409).json({ error: 'cross_project_payload_rejected', projectId });
        return;
      }

      const storyLogic = readRecordValue(body.storyLogic);
      if (!storyLogic) {
        res.status(400).json({ error: 'story_logic_payload_required' });
        return;
      }

      const expectedVersionRaw = body.expectedVersion;
      const expectedVersion = typeof expectedVersionRaw === 'number' && Number.isFinite(expectedVersionRaw)
        ? Math.trunc(expectedVersionRaw)
        : null;
      const actor = getOptionalRequestUser(req);

      const existingResult = await pool.query<RoleRoomStoryLogicRow>(
        `SELECT * FROM role_room_story_logic WHERE project_id = $1 LIMIT 1`,
        [projectId],
      );
      const existing = existingResult.rows[0] ?? null;
      const currentVersion = existing ? Number(existing.version) || 1 : 0;
      if (existing && expectedVersion !== null && expectedVersion !== currentVersion) {
        await appendRoleRoomStoryLogicAuditEvent({
          req,
          projectId,
          action: 'story_logic_conflict',
          previousVersion: currentVersion,
          metadata: {
            expectedVersion,
            currentVersion,
          },
        });
        res.status(409).json({
          error: 'story_logic_conflict',
          projectId,
          current: buildRoleRoomStoryLogicResponse(existing),
        });
        return;
      }

      const nextVersion = existing ? currentVersion + 1 : 1;
      const savedResult = existing
        ? await pool.query<RoleRoomStoryLogicRow>(
          `UPDATE role_room_story_logic
              SET story_logic = $2::jsonb,
                  version = version + 1,
                  updated_by_user_id = $3,
                  updated_by_role = $4,
                  updated_at = NOW()
            WHERE project_id = $1
            RETURNING *`,
          [projectId, JSON.stringify(storyLogic), actor?.userId ?? null, actor?.role ?? null],
        )
        : await pool.query<RoleRoomStoryLogicRow>(
          `INSERT INTO role_room_story_logic (
             project_id, story_logic, version, updated_by_user_id, updated_by_role, created_at, updated_at
           ) VALUES (
             $1, $2::jsonb, 1, $3, $4, NOW(), NOW()
           )
           RETURNING *`,
          [projectId, JSON.stringify(storyLogic), actor?.userId ?? null, actor?.role ?? null],
      );
      const saved = savedResult.rows[0];
      if (!saved) {
        throw new Error('story_logic_save_returned_no_row');
      }

      await appendRoleRoomStoryLogicAuditEvent({
        req,
        projectId,
        action: existing ? 'story_logic_updated' : 'story_logic_created',
        previousVersion: existing ? currentVersion : null,
        nextVersion,
      });

      res.json(buildRoleRoomStoryLogicResponse(saved));
    } catch (err) {
      console.error('Save story logic error:', err);
      res.status(500).json({ error: 'story_logic_save_failed' });
    }
  });

  router.delete('/projects/:projectId/story-logic', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'write_scope_required' });
      return;
    }

    const projectId = readStringValue(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'project_id_required' });
      return;
    }

    try {
      const context = await resolveStoryLogicProjectContext(req, projectId);
      if (!context) {
        res.status(404).json({ error: 'project_not_found' });
        return;
      }
      if (!canWriteStoryLogic(req, context.roleRecord)) {
        res.status(403).json({ error: 'story_logic_write_access_denied' });
        return;
      }

      const existingResult = await pool.query<RoleRoomStoryLogicRow>(
        `DELETE FROM role_room_story_logic WHERE project_id = $1 RETURNING *`,
        [projectId],
      );
      const existing = existingResult.rows[0] ?? null;
      await appendRoleRoomStoryLogicAuditEvent({
        req,
        projectId,
        action: 'story_logic_deleted',
        previousVersion: existing ? Number(existing.version) || 1 : null,
      });
      res.json({ success: true, projectId });
    } catch (err) {
      console.error('Delete story logic error:', err);
      res.status(500).json({ error: 'story_logic_delete_failed' });
    }
  });

  router.get('/projects/:projectId/coverage-review', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const projectId = readStringValue(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'project_id_required' });
      return;
    }

    try {
      const context = await resolveStoryLogicProjectContext(req, projectId);
      if (!context) {
        res.status(404).json({ error: 'project_not_found' });
        return;
      }
      if (!canReadCoverageReview(req, context.roleRecord)) {
        res.status(403).json({ error: 'coverage_review_read_access_denied' });
        return;
      }

      const result = await pool.query<RoleRoomCoverageReviewRow>(
        `SELECT * FROM role_room_coverage_reviews WHERE project_id = $1 LIMIT 1`,
        [projectId],
      );
      const row = result.rows[0] ?? null;
      await appendRoleRoomCoverageReviewAuditEvent({
        req,
        projectId,
        action: 'coverage_review_read',
        nextVersion: row ? Number(row.version) || 1 : 0,
      });
      res.json(buildRoleRoomCoverageReviewResponse(row, projectId));
    } catch (err) {
      console.error('Fetch coverage review error:', err);
      res.status(500).json({ error: 'coverage_review_fetch_failed' });
    }
  });

  router.put('/projects/:projectId/coverage-review', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'write_scope_required' });
      return;
    }

    const projectId = readStringValue(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'project_id_required' });
      return;
    }

    try {
      const context = await resolveStoryLogicProjectContext(req, projectId);
      if (!context) {
        res.status(404).json({ error: 'project_not_found' });
        return;
      }
      if (!canWriteCoverageReview(req, context.roleRecord)) {
        res.status(403).json({ error: 'coverage_review_write_access_denied' });
        return;
      }

      const body = readRecordValue(req.body) ?? {};
      const payloadProjectId = readStringValue(body.projectId) ?? readStringValue(body.project_id);
      if (payloadProjectId && payloadProjectId !== projectId) {
        await appendRoleRoomCoverageReviewAuditEvent({
          req,
          projectId,
          action: 'coverage_review_cross_project_rejected',
          metadata: {
            payloadProjectId,
            routeProjectId: projectId,
          },
        });
        res.status(409).json({ error: 'cross_project_payload_rejected', projectId });
        return;
      }

      const takeReviews = normalizeCoverageReviewTakeReviews(body.takeReviews ?? body.take_reviews);
      const shotLineCoverage = normalizeCoverageReviewShotLineCoverage(body.shotLineCoverage ?? body.shot_line_coverage);
      const expectedVersionRaw = body.expectedVersion ?? body.expected_version;
      const expectedVersion = typeof expectedVersionRaw === 'number' && Number.isFinite(expectedVersionRaw)
        ? Math.trunc(expectedVersionRaw)
        : typeof expectedVersionRaw === 'string' && expectedVersionRaw.trim().length > 0 && Number.isFinite(Number(expectedVersionRaw))
          ? Math.trunc(Number(expectedVersionRaw))
          : null;
      const eventType = readStringValue(body.eventType) ?? readStringValue(body.event_type) ?? 'coverage_review_updated';
      const actor = getOptionalRequestUser(req);

      const existingResult = await pool.query<RoleRoomCoverageReviewRow>(
        `SELECT * FROM role_room_coverage_reviews WHERE project_id = $1 LIMIT 1`,
        [projectId],
      );
      const existing = existingResult.rows[0] ?? null;
      const currentVersion = existing ? Number(existing.version) || 1 : 0;
      if (existing && expectedVersion !== null && expectedVersion !== currentVersion) {
        await appendRoleRoomCoverageReviewAuditEvent({
          req,
          projectId,
          action: 'coverage_review_conflict',
          previousVersion: currentVersion,
          metadata: {
            expectedVersion,
            currentVersion,
            eventType,
            changedTakeId: readStringValue(body.changedTakeId) ?? null,
            changedShotId: readStringValue(body.changedShotId) ?? null,
          },
        });
        res.status(409).json({
          error: 'coverage_review_conflict',
          projectId,
          current: buildRoleRoomCoverageReviewResponse(existing, projectId),
        });
        return;
      }

      const nextVersion = existing ? currentVersion + 1 : 1;
      const savedResult = existing
        ? await pool.query<RoleRoomCoverageReviewRow>(
          `UPDATE role_room_coverage_reviews
              SET take_reviews = $2::jsonb,
                  shot_line_coverage = $3::jsonb,
                  version = version + 1,
                  updated_by_user_id = $4,
                  updated_by_role = $5,
                  updated_at = NOW()
            WHERE project_id = $1
            RETURNING *`,
          [
            projectId,
            JSON.stringify(takeReviews),
            JSON.stringify(shotLineCoverage),
            actor?.userId ?? null,
            actor?.role ?? null,
          ],
        )
        : await pool.query<RoleRoomCoverageReviewRow>(
          `INSERT INTO role_room_coverage_reviews (
             project_id, take_reviews, shot_line_coverage, version,
             updated_by_user_id, updated_by_role, created_at, updated_at
           ) VALUES (
             $1, $2::jsonb, $3::jsonb, 1,
             $4, $5, NOW(), NOW()
           )
           RETURNING *`,
          [
            projectId,
            JSON.stringify(takeReviews),
            JSON.stringify(shotLineCoverage),
            actor?.userId ?? null,
            actor?.role ?? null,
          ],
        );
      const saved = savedResult.rows[0];
      if (!saved) {
        throw new Error('coverage_review_save_returned_no_row');
      }

      await appendRoleRoomCoverageReviewAuditEvent({
        req,
        projectId,
        action: existing ? eventType : 'coverage_review_created',
        previousVersion: existing ? currentVersion : null,
        nextVersion,
        metadata: {
          eventType,
          changedTakeId: readStringValue(body.changedTakeId) ?? null,
          changedShotId: readStringValue(body.changedShotId) ?? null,
          takeReviewCount: Object.keys(takeReviews).length,
          shotCoverageCount: Object.keys(shotLineCoverage).length,
        },
      });

      res.json(buildRoleRoomCoverageReviewResponse(saved, projectId));
    } catch (err) {
      console.error('Save coverage review error:', err);
      res.status(500).json({ error: 'coverage_review_save_failed' });
    }
  });

  // Lett team-member-invite-email — sender enklere mail enn klient-invite
  // (uten access-duration / portal-form-fields). Brukes når et nytt prosjekt
  // opprettes og collaborators-arrayen inneholder e-poster.
  async function sendRoleRoomTeamMemberInviteEmail(opts: {
    recipientEmail: string;
    recipientName?: string | null;
    role?: string | null;
    projectName: string;
    inviterName?: string | null;
    inviterEmail?: string | null;
    inviteUrl: string;
  }): Promise<{ sent: boolean; reason?: string; messageId?: string | null }> {
    const mailer = getRoleRoomClientInviteMailer();
    if (!mailer) return { sent: false, reason: 'mailer_not_configured', messageId: null };

    const recipientLabel = readStringValue(opts.recipientName) ?? 'der';
    const roleLabel = readStringValue(opts.role);
    const inviterLabel = readStringValue(opts.inviterName) ?? 'En kollega';
    const subject = `Du er invitert til ${opts.projectName} på The Role Room`;
    const text = [
      `Hei ${recipientLabel}!`,
      '',
      `${inviterLabel} har invitert deg til prosjektet "${opts.projectName}"${roleLabel ? ` som ${roleLabel}` : ''}.`,
      '',
      'Klikk lenken under for å åpne prosjektet:',
      opts.inviteUrl,
      '',
      'Lenken sender deg til The Role Room. Hvis du ikke har konto, kan du opprette en der.',
      '',
      'Hilsen,',
      'CreatorHub / The Role Room',
    ].join('\n');
    const html = `
      <div style="margin:0;background:#0b1020;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8ecf4">
        <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden">
          <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#1c2438 0%,#0f172a 100%)">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8dd3ff;font-weight:700;margin-bottom:12px">The Role Room</div>
            <h1 style="margin:0;font-size:24px;line-height:1.2;color:#ffffff">Du er invitert til ${escapeRoleRoomClientInviteEmailHtml(opts.projectName)}</h1>
          </div>
          <div style="padding:24px 28px">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#cbd5e1">
              Hei ${escapeRoleRoomClientInviteEmailHtml(recipientLabel)}!
            </p>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#cbd5e1">
              <strong>${escapeRoleRoomClientInviteEmailHtml(inviterLabel)}</strong> har invitert deg til prosjektet
              <strong>${escapeRoleRoomClientInviteEmailHtml(opts.projectName)}</strong>${roleLabel ? ` som <strong>${escapeRoleRoomClientInviteEmailHtml(roleLabel)}</strong>` : ''}.
            </p>
            <div style="margin:24px 0">
              <a href="${escapeRoleRoomClientInviteEmailHtml(opts.inviteUrl)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#00d4ff;color:#031019;text-decoration:none;font-weight:800">Åpne prosjektet</a>
            </div>
            <div style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;word-break:break-word">
              Hvis knappen ikke virker, kopier denne lenken inn i nettleseren:<br />
              <a href="${escapeRoleRoomClientInviteEmailHtml(opts.inviteUrl)}" style="color:#93c5fd">${escapeRoleRoomClientInviteEmailHtml(opts.inviteUrl)}</a>
            </div>
          </div>
        </div>
      </div>
    `;
    const replyTo = normalizeEmailValue(opts.inviterEmail) ?? mailer.user;
    try {
      const info = await mailer.transporter.sendMail({
        from: `"The Role Room" <${mailer.user}>`,
        to: opts.recipientEmail,
        replyTo,
        subject,
        text,
        html,
      });
      return { sent: true, messageId: info.messageId ?? null };
    } catch (err) {
      console.error('Team-member invite email send failed:', err);
      return { sent: false, reason: String(err instanceof Error ? err.message : err), messageId: null };
    }
  }

  router.post('/projects', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const userId = getUserId(req);
    const body = readRecordValue(req.body) ?? {};
    const name = readStringValue(body.name) ?? readStringValue(body.projectName);
    const description = readStringValue(body.description);
    const genre = readStringValue(body.genre);
    const projectType = readStringValue(body.projectType) ?? readStringValue(body.project_type);
    const startDate = readStringValue(body.startDate) ?? readStringValue(body.start_date);
    const endDate = readStringValue(body.endDate) ?? readStringValue(body.end_date);
    const budget = readNumberValue(body.budget);
    const currency = readStringValue(body.currency) ?? 'NOK';
    const creatorhubProjectId = readStringValue(body.creatorhubProjectId) ?? readStringValue(body.creatorhub_project_id);

    if (!name) {
      res.status(400).json({ error: 'Prosjektnavn er påkrevd' });
      return;
    }

    const requestedProjectIdRaw = readStringValue(body.id) ?? readStringValue(body.projectId);
    const requestedProjectId = normalizeRequestedCastingProjectId(requestedProjectIdRaw);
    if (requestedProjectIdRaw && !requestedProjectId) {
      res.status(400).json({ error: 'invalid_project_id' });
      return;
    }
    const id = requestedProjectId ?? makeId();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingProjectResult = await client.query<CastingProjectRow>(
        'SELECT * FROM casting_projects WHERE id = $1 LIMIT 1',
        [id],
      );
      const existingProject = existingProjectResult.rows[0] ?? null;
      if (existingProject?.created_by && existingProject.created_by !== userId) {
        const roleAccessResult = await client.query(
          'SELECT 1 FROM casting_user_roles WHERE project_id = $1 AND user_id = $2 LIMIT 1',
          [id, userId],
        );
        if ((roleAccessResult.rowCount ?? 0) === 0) {
          await client.query('ROLLBACK');
          res.status(409).json({ error: 'project_id_already_exists', projectId: id });
          return;
        }
      }

      const metadata = buildCastingProjectMetadataFromPayload(body, readJsonObject(existingProject?.metadata));
      const savedProjectResult = await client.query<CastingProjectRow>(
        `INSERT INTO casting_projects (
           id, name, description, status, created_by, genre, project_type,
           start_date, end_date, budget, currency, creatorhub_project_id, metadata
         ) VALUES (
           $1, $2, $3, 'active', $4, $5, $6,
           $7, $8, $9, $10, $11, $12::jsonb
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = COALESCE(EXCLUDED.description, casting_projects.description),
           status = COALESCE(casting_projects.status, EXCLUDED.status),
           created_by = COALESCE(casting_projects.created_by, EXCLUDED.created_by),
           genre = COALESCE(EXCLUDED.genre, casting_projects.genre),
           project_type = COALESCE(EXCLUDED.project_type, casting_projects.project_type),
           start_date = COALESCE(EXCLUDED.start_date, casting_projects.start_date),
           end_date = COALESCE(EXCLUDED.end_date, casting_projects.end_date),
           budget = COALESCE(EXCLUDED.budget, casting_projects.budget),
           currency = COALESCE(EXCLUDED.currency, casting_projects.currency),
           creatorhub_project_id = COALESCE(EXCLUDED.creatorhub_project_id, casting_projects.creatorhub_project_id),
           metadata = COALESCE(casting_projects.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [
          id,
          name,
          description ?? null,
          userId,
          genre ?? null,
          projectType ?? null,
          startDate ?? null,
          endDate ?? null,
          budget,
          currency,
          creatorhubProjectId ?? null,
          JSON.stringify(metadata),
        ],
      );
      const savedProject = savedProjectResult.rows[0];
      if (!savedProject) {
        throw new Error('role_room_project_save_returned_no_row');
      }

      // Auto-assign creator as director
      const requestUser = getOptionalRequestUser(req);
      await client.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, $2, $3, $4, 'director', $5, $6)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [
          makeId(),
          id,
          userId,
          requestUser?.email ?? null,
          JSON.stringify(buildProjectRolePermissions('director')),
          userId,
        ]
      );

      await client.query('COMMIT');
      roleRoomProjectAccessCache.add(id);

      // ── Send invite-email til collaborators når prosjektet OPPRETTES ──
      // Best-effort: e-post-feil skal IKKE feile project-creation. Vi sender
      // kun på første opprettelse (existingProject == null) for å unngå
      // duplikater ved oppdatering av eksisterende prosjekt.
      if (!existingProject) {
        const collaboratorsRaw = readRoleRoomArrayMetadata(body.collaborators) ?? [];
        const proto = (req.headers['x-forwarded-proto'] as string | undefined)
          ?? (req.protocol === 'http' ? 'http' : 'https');
        const host = (req.headers['x-forwarded-host'] as string | undefined)
          ?? req.headers.host
          ?? 'creatorhubn.com';
        const inviteUrl = `${proto}://${host}/role-room/projects/${encodeURIComponent(id)}`;
        const sendResults: Array<{ email: string; sent: boolean; reason?: string }> = [];
        for (const rawCollaborator of collaboratorsRaw) {
          const collaborator = readRecordValue(rawCollaborator) ?? {};
          const email = normalizeEmailValue(readStringValue(collaborator.email));
          if (!email) continue;
          const result = await sendRoleRoomTeamMemberInviteEmail({
            recipientEmail: email,
            recipientName: readStringValue(collaborator.name),
            role: readStringValue(collaborator.role)
              ?? readStringValue(collaborator.roleLabel)
              ?? readStringValue(collaborator.position),
            projectName: name,
            inviterName: requestUser?.email ?? null,
            inviterEmail: requestUser?.email ?? null,
            inviteUrl,
          });
          sendResults.push({ email, sent: result.sent, reason: result.reason });
          if (!result.sent) {
            console.warn('Project invite email skipped:', { projectId: id, email, reason: result.reason });
          }
        }
        // Logg total-resultatet til console for debugging — dukker opp i Render-logs.
        if (sendResults.length > 0) {
          console.log(
            `Project ${id} invite emails: ${sendResults.filter((r) => r.sent).length}/${sendResults.length} sent`,
            sendResults,
          );
        }
      }

      res.status(existingProject ? 200 : 201).json({
        ...buildCastingProjectResponse(savedProject),
        ownerId: savedProject.created_by ?? userId,
        createdBy: savedProject.created_by ?? userId,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Create project rollback error:', rollbackError);
      });
      console.error('Create project error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette prosjekt' });
    } finally {
      client.release();
    }
  });

  router.put('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = readRecordValue(req.body) ?? {};
    const { name, description, status, genre, projectType } = body;
    const budget = readNumberValue(body.budget);
    try {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;

      if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
      if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
      if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
      if (genre !== undefined) { sets.push(`genre = $${idx++}`); vals.push(genre); }
      if (projectType !== undefined) { sets.push(`project_type = $${idx++}`); vals.push(projectType); }
      if (body.budget !== undefined) { sets.push(`budget = $${idx++}`); vals.push(budget); }

      const metadataPatch = buildCastingProjectMetadataFromPayload(body);
      if (Object.keys(metadataPatch).length > 1 || !readRoleRoomObjectMetadata(metadataPatch.roleRoomPersistence)) {
        sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
        vals.push(JSON.stringify(metadataPatch));
      }

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id);

      await pool.query(
        `UPDATE casting_projects SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Update project error:', err);
      res.status(500).json({ error: 'Kunne ikke oppdatere prosjekt' });
    }
  });

  router.delete('/projects/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'admin')) {
      res.status(403).json({ error: 'Admin-tilgang kreves for sletting' });
      return;
    }
    try {
      await pool.query('DELETE FROM casting_projects WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette prosjekt' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // User Roles (RBAC)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        res.json([]);
        return;
      }

      const result = await pool.query(
        'SELECT * FROM casting_user_roles WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente roller' });
    }
  });

  router.post('/projects/:projectId/roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { userId, email, role, permissions } = req.body as {
      userId: string;
      email?: string;
      role: string;
      permissions?: Record<string, boolean>;
    };

    if (!userId || !role) {
      res.status(400).json({ error: 'userId og role er påkrevd' });
      return;
    }

    const addedBy = getUserId(req);
    try {
      await pool.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $5, permissions = $6, email = $4, updated_at = NOW()`,
        [
          makeId(),
          req.params.projectId,
          userId,
          email ?? null,
          role,
          JSON.stringify(buildProjectRolePermissions(role, permissions)),
          addedBy,
        ]
      );
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke tildele rolle' });
    }
  });

  router.delete('/projects/:projectId/roles/:userId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await pool.query(
        'DELETE FROM casting_user_roles WHERE project_id = $1 AND user_id = $2',
        [req.params.projectId, req.params.userId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke fjerne rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Producer Workflow (Timeline / Economy / Client Reviews)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/producer/timeline', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til tidslinje' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_phase_timeline_items
         WHERE project_id = $1
         ORDER BY
           CASE phase
             WHEN 'preproduction' THEN 1
             WHEN 'production' THEN 2
             WHEN 'postproduction' THEN 3
             ELSE 4
           END,
           sort_order ASC,
           due_at NULLS LAST,
           created_at ASC`,
        [projectId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer timeline fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente tidslinje' });
    }
  });

  router.post('/projects/:projectId/producer/timeline', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      phase,
      title,
      description,
      ownerUserId,
      dueAt,
      status,
      linkedEntityType,
      linkedEntityId,
      sortOrder,
      metadata,
    } = req.body as Record<string, unknown>;

    if (!isProducerPhase(phase)) {
      res.status(400).json({ error: 'phase må være preproduction, production eller postproduction' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette tidslinjeelementer' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_phase_timeline_items (
          id, project_id, phase, title, description, owner_user_id, due_at, status,
          linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          phase,
          title.trim(),
          typeof description === 'string' ? description : null,
          typeof ownerUserId === 'string' ? ownerUserId : null,
          typeof dueAt === 'string' ? dueAt : null,
          typeof status === 'string' && status.trim() ? status : 'planned',
          typeof linkedEntityType === 'string' ? linkedEntityType : null,
          typeof linkedEntityId === 'string' ? linkedEntityId : null,
          typeof sortOrder === 'number' ? sortOrder : 0,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
          userId,
        ],
      );

      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer timeline create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette tidslinjeelement' });
    }
  });

  router.patch('/projects/:projectId/producer/timeline/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere tidslinjeelementer' });
        return;
      }

      const payload = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const addField = (column: string, value: unknown, cast?: string) => {
        const suffix = cast ? `::${cast}` : '';
        sets.push(`${column} = $${idx}${suffix}`);
        values.push(value);
        idx += 1;
      };

      if (isProducerPhase(payload.phase)) addField('phase', payload.phase);
      if (typeof payload.title === 'string') addField('title', payload.title.trim());
      if (typeof payload.description === 'string' || payload.description === null) addField('description', payload.description);
      if (typeof payload.ownerUserId === 'string' || payload.ownerUserId === null) addField('owner_user_id', payload.ownerUserId);
      if (typeof payload.dueAt === 'string' || payload.dueAt === null) addField('due_at', payload.dueAt);
      if (typeof payload.status === 'string') addField('status', payload.status.trim() || 'planned');
      if (typeof payload.linkedEntityType === 'string' || payload.linkedEntityType === null) addField('linked_entity_type', payload.linkedEntityType);
      if (typeof payload.linkedEntityId === 'string' || payload.linkedEntityId === null) addField('linked_entity_id', payload.linkedEntityId);
      if (typeof payload.sortOrder === 'number') addField('sort_order', payload.sortOrder);
      if (payload.metadata && typeof payload.metadata === 'object') addField('metadata', JSON.stringify(payload.metadata), 'jsonb');

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      values.push(projectId, itemId);

      const result = await pool.query(
        `UPDATE role_room_phase_timeline_items
         SET ${sets.join(', ')}
         WHERE project_id = $${idx} AND id = $${idx + 1}
         RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke tidslinjeelement' });
        return;
      }

      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer timeline update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere tidslinjeelement' });
    }
  });

  router.delete('/projects/:projectId/producer/timeline/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å fjerne tidslinjeelementer' });
        return;
      }

      const deleted = await pool.query(
        `DELETE FROM role_room_phase_timeline_items
         WHERE project_id = $1 AND id = $2
         RETURNING id`,
        [projectId, itemId],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke tidslinjeelement' });
        return;
      }

      res.json({ success: true, itemId });
    } catch (error) {
      console.error('Producer timeline delete error:', error);
      res.status(500).json({ error: 'Kunne ikke fjerne tidslinjeelement' });
    }
  });

  router.get('/projects/:projectId/producer/notifications', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til varsler' });
        return;
      }

      const audiences = getProducerNotificationAudiences(req, roleRecord);
      const values: unknown[] = [projectId, userId, audiences];
      const conditions = [
        'notification.project_id = $1',
        'notification.audience = ANY($3::text[])',
      ];
      const includeArchived = readBooleanValue(req.query.includeArchived)
        ?? readStringValue(req.query.includeArchived)?.toLowerCase() === 'true';
      if (!includeArchived) {
        conditions.push('notification.archived_at IS NULL');
      }

      const clientFilter = readStringValue(req.query.client);
      if (clientFilter) {
        values.push(`%${clientFilter.toLowerCase()}%`);
        conditions.push(`(
          LOWER(COALESCE(notification.client_name, '')) LIKE $${values.length}
          OR LOWER(COALESCE(notification.client_email, '')) LIKE $${values.length}
        )`);
      }

      const typeFilter = readStringValue(req.query.type);
      if (typeFilter && typeFilter !== 'all') {
        values.push(normalizeProducerInboxType(typeFilter));
        conditions.push(`notification.inbox_type = $${values.length}`);
      }

      const statusFilter = readStringValue(req.query.status)?.toLowerCase();
      if (statusFilter === 'resolved') {
        conditions.push('notification.resolved_at IS NOT NULL');
      } else if (statusFilter === 'open') {
        conditions.push('notification.resolved_at IS NULL');
      } else if (statusFilter === 'unread') {
        conditions.push('reads.read_at IS NULL');
      } else if (statusFilter === 'due') {
        conditions.push('notification.due_at IS NOT NULL AND notification.resolved_at IS NULL');
      } else if (statusFilter === 'archived') {
        conditions.push('notification.archived_at IS NOT NULL');
      }

      const assignedTo = readStringValue(req.query.assignedTo);
      if (assignedTo) {
        values.push(assignedTo);
        conditions.push(`(
          notification.assigned_to_user_id = $${values.length}
          OR notification.assigned_to_label = $${values.length}
        )`);
      }

      const mentions = readStringValue(req.query.mentions);
      if (mentions) {
        values.push(mentions.toLowerCase());
        conditions.push(`(
          notification.mention_user_ids ? $${values.length}
          OR notification.mention_emails ? $${values.length}
        )`);
      }

      const search = readStringValue(req.query.search);
      if (search) {
        values.push(`%${search.toLowerCase()}%`);
        conditions.push(`(
          LOWER(notification.title) LIKE $${values.length}
          OR LOWER(COALESCE(notification.message, '')) LIKE $${values.length}
          OR LOWER(COALESCE(notification.client_name, '')) LIKE $${values.length}
          OR LOWER(COALESCE(notification.client_email, '')) LIKE $${values.length}
          OR LOWER(COALESCE(notification.event_type, '')) LIKE $${values.length}
        )`);
      }

      const result = await pool.query(
        `SELECT notification.*,
                reads.read_at,
                CASE WHEN reads.read_at IS NULL THEN FALSE ELSE TRUE END AS read
         FROM role_room_project_notifications notification
         LEFT JOIN role_room_project_notification_reads reads
           ON reads.notification_id = notification.id
          AND reads.user_id = $2
         WHERE ${conditions.join(' AND ')}
         ORDER BY notification.updated_at DESC, notification.created_at DESC
         LIMIT 100`,
        values,
      );

      res.json({ items: result.rows.map((row) => buildProducerProjectNotificationResponse(row as ProducerProjectNotificationRow)) });
    } catch (error) {
      console.error('Producer notifications fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente varsler' });
    }
  });

  router.patch('/projects/:projectId/producer/notifications/:notificationId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const notificationId = req.params.notificationId;
    const userId = getUserId(req);
    const body = readRecordValue(req.body) ?? {};

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å styre innboksen' });
        return;
      }

      const existingResult = await pool.query(
        `SELECT *
         FROM role_room_project_notifications
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [notificationId, projectId],
      );
      if (existingResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke innbokselementet' });
        return;
      }

      const archived = readBooleanValue(body.archived);
      const resolved = readBooleanValue(body.resolved);
      const assignedToUserId = readStringValue(body.assignedToUserId ?? body.assigned_to_user_id);
      const assignedToLabel = readStringValue(body.assignedToLabel ?? body.assigned_to_label);
      const dueAt = body.dueAt === null || body.due_at === null
        ? null
        : readDateValue(body.dueAt ?? body.due_at);
      const dueAtProvided = Object.prototype.hasOwnProperty.call(body, 'dueAt')
        || Object.prototype.hasOwnProperty.call(body, 'due_at');
      const inboxType = Object.prototype.hasOwnProperty.call(body, 'inboxType')
        || Object.prototype.hasOwnProperty.call(body, 'inbox_type')
        ? normalizeProducerInboxType(body.inboxType ?? body.inbox_type)
        : null;
      const clientName = Object.prototype.hasOwnProperty.call(body, 'clientName')
        || Object.prototype.hasOwnProperty.call(body, 'client_name')
        ? readStringValue(body.clientName ?? body.client_name)
        : undefined;
      const clientEmail = Object.prototype.hasOwnProperty.call(body, 'clientEmail')
        || Object.prototype.hasOwnProperty.call(body, 'client_email')
        ? normalizeEmailValue(body.clientEmail ?? body.client_email)
        : undefined;
      const mentionUserIds = Object.prototype.hasOwnProperty.call(body, 'mentionUserIds')
        || Object.prototype.hasOwnProperty.call(body, 'mention_user_ids')
        ? readStringArray(body.mentionUserIds ?? body.mention_user_ids)
        : undefined;
      const mentionEmails = Object.prototype.hasOwnProperty.call(body, 'mentionEmails')
        || Object.prototype.hasOwnProperty.call(body, 'mention_emails')
        ? readStringArray(body.mentionEmails ?? body.mention_emails).map((email) => email.toLowerCase())
        : undefined;

      const updatedResult = await pool.query(
        `UPDATE role_room_project_notifications
         SET inbox_type = COALESCE($3, inbox_type),
             client_name = CASE WHEN $4 THEN $5 ELSE client_name END,
             client_email = CASE WHEN $6 THEN $7 ELSE client_email END,
             assigned_to_user_id = CASE WHEN $8 THEN $9 ELSE assigned_to_user_id END,
             assigned_to_label = CASE WHEN $8 THEN $10 ELSE assigned_to_label END,
             due_at = CASE WHEN $11 THEN $12::timestamptz ELSE due_at END,
             resolved_at = CASE
               WHEN $13::boolean IS TRUE THEN COALESCE(resolved_at, NOW())
               WHEN $13::boolean IS FALSE THEN NULL
               ELSE resolved_at
             END,
             resolved_by_user_id = CASE
               WHEN $13::boolean IS TRUE THEN $14
               WHEN $13::boolean IS FALSE THEN NULL
               ELSE resolved_by_user_id
             END,
             archived_at = CASE
               WHEN $15::boolean IS TRUE THEN COALESCE(archived_at, NOW())
               WHEN $15::boolean IS FALSE THEN NULL
               ELSE archived_at
             END,
             archived_by_user_id = CASE
               WHEN $15::boolean IS TRUE THEN $14
               WHEN $15::boolean IS FALSE THEN NULL
               ELSE archived_by_user_id
             END,
             mention_user_ids = CASE WHEN $16 THEN $17::jsonb ELSE mention_user_ids END,
             mention_emails = CASE WHEN $18 THEN $19::jsonb ELSE mention_emails END,
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [
          notificationId,
          projectId,
          inboxType,
          clientName !== undefined,
          clientName ?? null,
          clientEmail !== undefined,
          clientEmail ?? null,
          Object.prototype.hasOwnProperty.call(body, 'assignedToUserId')
            || Object.prototype.hasOwnProperty.call(body, 'assigned_to_user_id')
            || Object.prototype.hasOwnProperty.call(body, 'assignedToLabel')
            || Object.prototype.hasOwnProperty.call(body, 'assigned_to_label'),
          assignedToUserId,
          assignedToLabel,
          dueAtProvided,
          dueAt,
          resolved,
          userId,
          archived,
          mentionUserIds !== undefined,
          JSON.stringify(mentionUserIds ?? []),
          mentionEmails !== undefined,
          JSON.stringify(mentionEmails ?? []),
        ],
      );

      res.json({
        success: true,
        item: buildProducerProjectNotificationResponse(updatedResult.rows[0] as ProducerProjectNotificationRow),
      });
    } catch (error) {
      console.error('Producer notification update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere innbokselementet' });
    }
  });

  router.post('/projects/:projectId/producer/notifications/:notificationId/read', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const notificationId = req.params.notificationId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til varsler' });
        return;
      }

      const notificationCheck = await pool.query(
        `SELECT id
         FROM role_room_project_notifications
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [notificationId, projectId],
      );
      if (notificationCheck.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke varselet' });
        return;
      }

      await pool.query(
        `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET read_at = EXCLUDED.read_at`,
        [notificationId, userId],
      );

      res.json({ success: true, notificationId });
    } catch (error) {
      console.error('Producer notification mark-read error:', error);
      res.status(500).json({ error: 'Kunne ikke markere varsel som lest' });
    }
  });

  router.post('/projects/:projectId/producer/notifications/read-all', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til varsler' });
        return;
      }

      const audiences = getProducerNotificationAudiences(req, roleRecord);
      await pool.query(
        `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at)
         SELECT notification.id, $2, NOW()
         FROM role_room_project_notifications notification
         WHERE notification.project_id = $1
           AND notification.audience = ANY($3::text[])
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET read_at = EXCLUDED.read_at`,
        [projectId, userId, audiences],
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Producer notification mark-all-read error:', error);
      res.status(500).json({ error: 'Kunne ikke markere varsler som lest' });
    }
  });

  router.get('/projects/:projectId/producer/expenses', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til utlegg' });
        return;
      }

      const values: unknown[] = [projectId];
      const conditions = ['project_id = $1'];
      const refundStatus = readStringValue(req.query.refundStatus);
      if (refundStatus && refundStatus !== 'all') {
        values.push(refundStatus);
        conditions.push(`refund_status = $${values.length}`);
      }
      const approvalStatus = readStringValue(req.query.clientApprovalStatus);
      if (approvalStatus && approvalStatus !== 'all') {
        values.push(approvalStatus);
        conditions.push(`client_approval_status = $${values.length}`);
      }
      const search = readStringValue(req.query.search);
      if (search) {
        values.push(`%${search.toLowerCase()}%`);
        conditions.push(`(
          LOWER(title) LIKE $${values.length}
          OR LOWER(COALESCE(description, '')) LIKE $${values.length}
          OR LOWER(COALESCE(merchant_name, '')) LIKE $${values.length}
          OR LOWER(COALESCE(category, '')) LIKE $${values.length}
        )`);
      }

      const expenseResult = await pool.query(
        `SELECT *
         FROM role_room_expenses
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at DESC
         LIMIT 250`,
        values,
      );
      const expenseIds = expenseResult.rows.map((row) => String(row.id));
      const receiptResult = expenseIds.length > 0
        ? await pool.query(
          `SELECT *
           FROM role_room_expense_receipt_files
           WHERE project_id = $1 AND expense_id = ANY($2::uuid[])
           ORDER BY created_at DESC`,
          [projectId, expenseIds],
        )
        : { rows: [] };
      const jobResult = expenseIds.length > 0
        ? await pool.query(
          `SELECT *
           FROM role_room_receipt_ocr_jobs
           WHERE project_id = $1 AND expense_id = ANY($2::uuid[])
           ORDER BY queued_at DESC`,
          [projectId, expenseIds],
        )
        : { rows: [] };

      const receiptsByExpense = new Map<string, RoleRoomExpenseReceiptFileRow[]>();
      for (const receipt of receiptResult.rows as RoleRoomExpenseReceiptFileRow[]) {
        receiptsByExpense.set(receipt.expense_id, [...(receiptsByExpense.get(receipt.expense_id) ?? []), receipt]);
      }
      const jobsByExpense = new Map<string, RoleRoomReceiptOcrJobRow[]>();
      for (const job of jobResult.rows as RoleRoomReceiptOcrJobRow[]) {
        jobsByExpense.set(job.expense_id, [...(jobsByExpense.get(job.expense_id) ?? []), job]);
      }

      res.json({
        items: (expenseResult.rows as RoleRoomExpenseRow[]).map((expense) => buildRoleRoomExpenseResponse(
          expense,
          receiptsByExpense.get(expense.id) ?? [],
          jobsByExpense.get(expense.id) ?? [],
        )),
      });
    } catch (error) {
      console.error('Role Room expenses fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente utlegg' });
    }
  });

  router.post('/projects/:projectId/producer/expenses', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const body = readRecordValue(req.body) ?? {};
    const actor = getOptionalRequestUser(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette utlegg' });
        return;
      }

      const expenseId = crypto.randomUUID();
      const amount = readNumberValue(body.amount);
      const vatAmount = readNumberValue(body.vatAmount ?? body.vat_amount);
      const expenseDate = normalizeReceiptExpenseDate(body.expenseDate ?? body.expense_date);
      const merchantName = normalizeMerchantName(body.merchantName ?? body.merchant_name);
      const refundStatus = normalizeExpenseStatus(
        body.refundStatus ?? body.refund_status,
        ['not_requested', 'requested', 'approved', 'paid', 'rejected'],
        'not_requested',
      );
      const clientApprovalStatus = normalizeExpenseStatus(
        body.clientApprovalStatus ?? body.client_approval_status,
        ['pending', 'approved', 'changes_requested', 'rejected', 'not_required'],
        'pending',
      );
      const costOwner = normalizeExpenseStatus(
        body.costOwner ?? body.cost_owner,
        ['client', 'producer', 'shared', 'project_company', 'holding_company'],
        'client',
      );

      await pool.query(
        `INSERT INTO role_room_expenses (
          id, project_id, title, description, merchant_name, expense_date,
          amount, vat_amount, currency, category, paid_by_user_id, paid_by_label,
          cost_owner, refund_status, client_approval_status,
          amount_validation_status, vat_validation_status,
          privacy_notice_acknowledged_at, metadata, created_by_user_id, created_by_role,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6::date,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15,
          $16, $17,
          CASE WHEN $18::boolean THEN NOW() ELSE NULL END, $19::jsonb, $20, $21,
          NOW(), NOW()
        )`,
        [
          expenseId,
          projectId,
          readStringValue(body.title) ?? 'Utlegg',
          readStringValue(body.description),
          merchantName,
          expenseDate,
          amount,
          vatAmount,
          readStringValue(body.currency) ?? 'NOK',
          readStringValue(body.category),
          readStringValue(body.paidByUserId ?? body.paid_by_user_id) ?? actor?.userId ?? null,
          readStringValue(body.paidByLabel ?? body.paid_by_label) ?? actor?.email ?? null,
          costOwner,
          refundStatus,
          clientApprovalStatus,
          validateExpenseAmount(amount),
          validateExpenseVat(amount, vatAmount),
          Boolean(readBooleanValue(body.privacyNoticeAcknowledged ?? body.privacy_notice_acknowledged) ?? false),
          JSON.stringify(readJsonObject(body.metadata)),
          actor?.userId ?? null,
          actor?.role ?? null,
        ],
      );

      const ocrText = readStringValue(body.ocrText ?? body.extractedText ?? body.receiptText);
      if (ocrText || readBooleanValue(body.queueOcr) === true) {
        await runReceiptOcrJob({
          req,
          projectId,
          expenseId,
          extractedText: ocrText,
        });
      }

      await appendReceiptOcrAuditEvent({
        req,
        projectId,
        expenseId,
        action: 'expense_created',
        metadata: {
          refundStatus,
          clientApprovalStatus,
          costOwner,
          privacyNoticeAcknowledged: Boolean(readBooleanValue(body.privacyNoticeAcknowledged ?? body.privacy_notice_acknowledged) ?? false),
        },
      });

      const item = await loadRoleRoomExpenseBundle(projectId, expenseId);
      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error('Role Room expense create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette utlegg' });
    }
  });

  router.post('/projects/:projectId/producer/expenses/:expenseId/receipts', apiKeyAuth(pool, activeSessions), roleRoomReceiptUpload.single('file'), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const expenseId = req.params.expenseId;
    const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
    const actor = getOptionalRequestUser(req);

    if (!uploadedFile) {
      res.status(400).json({ error: 'Mangler kvitteringsfil' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å laste opp kvittering' });
        return;
      }

      const expenseCheck = await pool.query(
        `SELECT id
         FROM role_room_expenses
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [expenseId, projectId],
      );
      if (expenseCheck.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke utlegget' });
        return;
      }

      const sha256 = crypto.createHash('sha256').update(uploadedFile.buffer).digest('hex');
      const existingReceipt = await pool.query(
        `SELECT expense_id
         FROM role_room_expense_receipt_files
         WHERE project_id = $1 AND sha256 = $2
         LIMIT 1`,
        [projectId, sha256],
      );
      const duplicateExpenseId = readStringValue(existingReceipt.rows[0]?.expense_id);

      const receiptFileId = crypto.randomUUID();
      const safeOriginalName = sanitizeRoleRoomTalentFileSegment(uploadedFile.originalname || 'receipt');
      const extension = path.extname(safeOriginalName) || '.bin';
      const fileName = `${receiptFileId}${extension}`;
      const storageDirectory = path.join(ROLE_ROOM_RECEIPT_UPLOAD_ROOT, sanitizeRoleRoomTalentFileSegment(projectId), sanitizeRoleRoomTalentFileSegment(expenseId));
      await fs.mkdir(storageDirectory, { recursive: true });
      const storagePath = path.join(storageDirectory, fileName);
      await fs.writeFile(storagePath, uploadedFile.buffer);

      await pool.query(
        `INSERT INTO role_room_expense_receipt_files (
          id, expense_id, project_id, file_name, original_name, mime_type,
          file_size, storage_path, sha256, metadata, uploaded_by_user_id,
          uploaded_by_role, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10::jsonb, $11,
          $12, NOW()
        )`,
        [
          receiptFileId,
          expenseId,
          projectId,
          fileName,
          uploadedFile.originalname ?? fileName,
          uploadedFile.mimetype ?? null,
          uploadedFile.size,
          storagePath,
          sha256,
          JSON.stringify({
            duplicateExpenseId,
            privacyNotice: 'Kvitteringen lagres i prosjektets utleggsarkiv og OCR-kø for refusjon og klientgodkjenning.',
          }),
          actor?.userId ?? null,
          actor?.role ?? null,
        ],
      );

      if (duplicateExpenseId) {
        await pool.query(
          `UPDATE role_room_expenses
           SET duplicate_of_expense_id = COALESCE(duplicate_of_expense_id, $2::uuid),
               updated_at = NOW()
           WHERE id = $1 AND project_id = $3`,
          [expenseId, duplicateExpenseId, projectId],
        );
      }

      const ocrText = readStringValue(req.body?.ocrText ?? req.body?.extractedText ?? req.body?.receiptText);
      await runReceiptOcrJob({
        req,
        projectId,
        expenseId,
        receiptFileId,
        extractedText: ocrText,
        engine: uploadedFile.mimetype === 'application/pdf'
          ? 'server-heuristic-pdf'
          : uploadedFile.mimetype === 'image/heic' || uploadedFile.mimetype === 'image/heif'
            ? 'server-heuristic-heic'
            : 'server-heuristic-image',
      });

      await appendReceiptOcrAuditEvent({
        req,
        projectId,
        expenseId,
        receiptFileId,
        action: 'receipt_uploaded',
        metadata: {
          mimeType: uploadedFile.mimetype ?? null,
          fileSize: uploadedFile.size,
          duplicateExpenseId,
        },
      });

      const item = await loadRoleRoomExpenseBundle(projectId, expenseId);
      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error('Role Room receipt upload error:', error);
      res.status(500).json({ error: 'Kunne ikke laste opp kvittering' });
    }
  });

  router.post('/projects/:projectId/producer/expenses/:expenseId/ocr/retry', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const expenseId = req.params.expenseId;
    const body = readRecordValue(req.body) ?? {};

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å kjøre OCR på nytt' });
        return;
      }

      const expenseCheck = await pool.query(
        `SELECT id
         FROM role_room_expenses
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [expenseId, projectId],
      );
      if (expenseCheck.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke utlegget' });
        return;
      }

      const receiptFileId = readStringValue(body.receiptFileId ?? body.receipt_file_id);
      const ocrText = readStringValue(body.ocrText ?? body.extractedText ?? body.receiptText);
      await runReceiptOcrJob({
        req,
        projectId,
        expenseId,
        receiptFileId,
        extractedText: ocrText,
        engine: 'server-heuristic-retry',
      });

      const item = await loadRoleRoomExpenseBundle(projectId, expenseId);
      res.json({ success: true, item });
    } catch (error) {
      console.error('Role Room receipt OCR retry error:', error);
      res.status(500).json({ error: 'Kunne ikke kjøre OCR på nytt' });
    }
  });

  router.patch('/projects/:projectId/producer/expenses/:expenseId/ocr/correction', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const expenseId = req.params.expenseId;
    const body = readRecordValue(req.body) ?? {};

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å korrigere OCR' });
        return;
      }

      const merchantName = normalizeMerchantName(body.merchantName ?? body.merchant_name);
      const expenseDate = normalizeReceiptExpenseDate(body.expenseDate ?? body.expense_date);
      const amount = readNumberValue(body.amount);
      const vatAmount = readNumberValue(body.vatAmount ?? body.vat_amount);
      const existingExpenseResult = await pool.query(
        `SELECT *
         FROM role_room_expenses
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [expenseId, projectId],
      );
      const existingExpense = existingExpenseResult.rows[0] as RoleRoomExpenseRow | undefined;
      if (!existingExpense) {
        res.status(404).json({ error: 'Fant ikke utlegget' });
        return;
      }
      const nextAmount = amount ?? (
        existingExpense.amount === null || existingExpense.amount === undefined ? null : Number(existingExpense.amount)
      );
      const nextVatAmount = vatAmount ?? (
        existingExpense.vat_amount === null || existingExpense.vat_amount === undefined ? null : Number(existingExpense.vat_amount)
      );

      const updateResult = await pool.query(
        `UPDATE role_room_expenses
         SET merchant_name = COALESCE($3, merchant_name),
             expense_date = COALESCE($4::date, expense_date),
             amount = COALESCE($5, amount),
             vat_amount = COALESCE($6, vat_amount),
             category = COALESCE($7, category),
             ocr_status = 'corrected',
             ocr_review_required = FALSE,
             amount_validation_status = $8,
             vat_validation_status = $9,
             metadata = metadata || $10::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [
          expenseId,
          projectId,
          merchantName,
          expenseDate,
          amount,
          vatAmount,
          readStringValue(body.category),
          validateExpenseAmount(nextAmount),
          validateExpenseVat(nextAmount, nextVatAmount),
          JSON.stringify({
            manualCorrection: {
              correctedAt: nowISO(),
              correctedFields: Object.keys(body),
            },
          }),
        ],
      );
      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke utlegget' });
        return;
      }

      await appendReceiptOcrAuditEvent({
        req,
        projectId,
        expenseId,
        action: 'manual_correction',
        metadata: {
          correctedFields: Object.keys(body),
          amountValidationStatus: validateExpenseAmount(nextAmount),
          vatValidationStatus: validateExpenseVat(nextAmount, nextVatAmount),
        },
      });

      const item = await loadRoleRoomExpenseBundle(projectId, expenseId);
      res.json({ success: true, item });
    } catch (error) {
      console.error('Role Room receipt OCR correction error:', error);
      res.status(500).json({ error: 'Kunne ikke korrigere OCR' });
    }
  });

  router.patch('/projects/:projectId/producer/expenses/:expenseId/status', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const expenseId = req.params.expenseId;
    const body = readRecordValue(req.body) ?? {};

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere utleggstatus' });
        return;
      }

      const refundStatus = Object.prototype.hasOwnProperty.call(body, 'refundStatus')
        || Object.prototype.hasOwnProperty.call(body, 'refund_status')
        ? normalizeExpenseStatus(body.refundStatus ?? body.refund_status, ['not_requested', 'requested', 'approved', 'paid', 'rejected'], 'not_requested')
        : null;
      const clientApprovalStatus = Object.prototype.hasOwnProperty.call(body, 'clientApprovalStatus')
        || Object.prototype.hasOwnProperty.call(body, 'client_approval_status')
        ? normalizeExpenseStatus(body.clientApprovalStatus ?? body.client_approval_status, ['pending', 'approved', 'changes_requested', 'rejected', 'not_required'], 'pending')
        : null;

      const updateResult = await pool.query(
        `UPDATE role_room_expenses
         SET refund_status = COALESCE($3, refund_status),
             client_approval_status = COALESCE($4, client_approval_status),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [expenseId, projectId, refundStatus, clientApprovalStatus],
      );
      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke utlegget' });
        return;
      }

      await appendReceiptOcrAuditEvent({
        req,
        projectId,
        expenseId,
        action: 'status_updated',
        metadata: { refundStatus, clientApprovalStatus },
      });

      const item = await loadRoleRoomExpenseBundle(projectId, expenseId);
      res.json({ success: true, item });
    } catch (error) {
      console.error('Role Room expense status update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere utleggstatus' });
    }
  });

  router.get('/projects/:projectId/producer/expenses/export', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til eksport av utlegg' });
        return;
      }

      const expenseResult = await pool.query(
        `SELECT id, title, merchant_name, expense_date, amount, vat_amount, currency,
                category, paid_by_label, cost_owner, refund_status,
                client_approval_status, duplicate_of_expense_id,
                ocr_status, ocr_confidence, amount_validation_status, vat_validation_status,
                created_at, updated_at
         FROM role_room_expenses
         WHERE project_id = $1
         ORDER BY expense_date DESC NULLS LAST, updated_at DESC`,
        [projectId],
      );

      res.json({
        projectId,
        exportedAt: nowISO(),
        privacyNotice: 'Eksporten kan inneholde persondata fra kvitteringer og skal bare deles med autoriserte prosjekt-/kundeansvarlige.',
        items: expenseResult.rows,
      });
    } catch (error) {
      console.error('Role Room expenses export error:', error);
      res.status(500).json({ error: 'Kunne ikke eksportere utlegg' });
    }
  });

  router.get('/projects/:projectId/producer/push-subscription', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: 'Mangler bruker for push-varsler' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerPushNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til mobilvarsler' });
        return;
      }

      const result = await pool.query(
        `SELECT endpoint, last_sent_at, last_error, disabled_at, updated_at
         FROM role_room_push_subscriptions
         WHERE project_id = $1
           AND user_id = $2
           AND scope = 'producer_team'
         ORDER BY updated_at DESC`,
        [projectId, userId],
      );

      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer push subscription fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente mobilvarsler' });
    }
  });

  router.post('/projects/:projectId/producer/push-subscription', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const payload = req.body as Record<string, unknown>;
    const subscription = payload.subscription as Record<string, unknown> | null | undefined;
    const subscriptionKeys = subscription?.keys as Record<string, unknown> | null | undefined;
    const endpoint = normalizePushEndpoint(subscription?.endpoint);
    const p256dh = typeof subscriptionKeys?.p256dh === 'string' ? subscriptionKeys.p256dh.trim() : '';
    const auth = typeof subscriptionKeys?.auth === 'string' ? subscriptionKeys.auth.trim() : '';

    if (!userId) {
      res.status(401).json({ error: 'Mangler bruker for push-varsler' });
      return;
    }
    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: 'Ugyldig push-abonnement' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerPushNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til mobilvarsler' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO role_room_push_subscriptions (
           id, user_id, project_id, scope, endpoint, p256dh, auth, user_agent,
           created_at, updated_at, last_sent_at, last_error, disabled_at
         ) VALUES (
           $1, $2, $3, 'producer_team', $4, $5, $6, $7,
           NOW(), NOW(), NULL, NULL, NULL
         )
         ON CONFLICT (project_id, scope, endpoint)
         DO UPDATE SET
           user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           updated_at = NOW(),
           last_error = NULL,
           disabled_at = NULL
         RETURNING endpoint, last_sent_at, last_error, disabled_at, updated_at`,
        [
          crypto.randomUUID(),
          userId,
          projectId,
          endpoint,
          p256dh,
          auth,
          req.get('user-agent') ?? null,
        ],
      );

      res.status(201).json({ success: true, subscription: result.rows[0] });
    } catch (error) {
      console.error('Producer push subscription create error:', error);
      res.status(500).json({ error: 'Kunne ikke aktivere mobilvarsler' });
    }
  });

  router.delete('/projects/:projectId/producer/push-subscription', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const endpoint = normalizePushEndpoint((req.body as Record<string, unknown> | null | undefined)?.endpoint);

    if (!userId) {
      res.status(401).json({ error: 'Mangler bruker for push-varsler' });
      return;
    }
    if (!endpoint) {
      res.status(400).json({ error: 'endpoint er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerPushNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til mobilvarsler' });
        return;
      }

      await pool.query(
        `DELETE FROM role_room_push_subscriptions
         WHERE project_id = $1
           AND user_id = $2
           AND scope = 'producer_team'
           AND endpoint = $3`,
        [projectId, userId, endpoint],
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Producer push subscription delete error:', error);
      res.status(500).json({ error: 'Kunne ikke skru av mobilvarsler' });
    }
  });

  router.post('/projects/:projectId/producer/push-subscription/test', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: 'Mangler bruker for push-varsler' });
      return;
    }
    if (!getRoleRoomPushConfig()) {
      res.status(503).json({ error: 'Push-varsler er ikke konfigurert for denne installasjonen' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerPushNotifications(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til mobilvarsler' });
        return;
      }

      const subscriptionResult = await pool.query(
        `SELECT *
         FROM role_room_push_subscriptions
         WHERE project_id = $1
           AND user_id = $2
           AND scope = 'producer_team'
           AND disabled_at IS NULL`,
        [projectId, userId],
      );

      if ((subscriptionResult.rowCount ?? 0) === 0) {
        res.status(404).json({ error: 'Ingen aktive mobilvarsler funnet for dette prosjektet' });
        return;
      }

      const projectResult = await pool.query(
        `SELECT name
         FROM casting_projects
         WHERE id = $1
         LIMIT 1`,
        [projectId],
      );
      const projectName = String(projectResult.rows[0]?.name ?? 'The Role Room').trim() || 'The Role Room';

      const sent = await dispatchRoleRoomPushNotifications(
        subscriptionResult.rows as RoleRoomPushSubscriptionRow[],
        {
          title: 'The Role Room',
          body: `Mobilvarsler er aktive for ${projectName}.`,
          url: '/',
          tag: `role-room:test:${projectId}`,
          projectId,
          eventType: 'test',
        },
      );

      res.json({ success: true, sent });
    } catch (error) {
      console.error('Producer push subscription test error:', error);
      res.status(500).json({ error: 'Kunne ikke sende testvarsel' });
    }
  });

  router.get('/projects/:projectId/producer/economy/items', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerEconomy(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til økonomi' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_budget_items
         WHERE project_id = $1
         ORDER BY
           CASE phase
             WHEN 'preproduction' THEN 1
             WHEN 'production' THEN 2
             WHEN 'postproduction' THEN 3
             ELSE 4
           END,
           sort_order ASC,
           created_at ASC`,
        [projectId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer economy fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente økonomilinjer' });
    }
  });

  router.post('/projects/:projectId/producer/economy/items', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      phase,
      category,
      itemName,
      description,
      estimate,
      approved,
      actual,
      currency,
      status,
      clientVisible,
      linkedEntityType,
      linkedEntityId,
      sortOrder,
      metadata,
    } = req.body as Record<string, unknown>;

    if (!isProducerPhase(phase)) {
      res.status(400).json({ error: 'phase må være preproduction, production eller postproduction' });
      return;
    }
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'category er påkrevd' });
      return;
    }
    if (typeof itemName !== 'string' || !itemName.trim()) {
      res.status(400).json({ error: 'itemName er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette økonomilinjer' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_budget_items (
          id, project_id, phase, category, item_name, description,
          estimate, approved, actual, currency, status, client_visible,
          linked_entity_type, linked_entity_id, sort_order, metadata, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16::jsonb, $17, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          phase,
          category.trim(),
          itemName.trim(),
          typeof description === 'string' ? description : null,
          typeof estimate === 'number' ? estimate : 0,
          typeof approved === 'number' ? approved : 0,
          typeof actual === 'number' ? actual : 0,
          typeof currency === 'string' && currency.trim() ? currency.trim() : 'NOK',
          typeof status === 'string' && status.trim() ? status.trim() : 'draft',
          clientVisible !== false,
          typeof linkedEntityType === 'string' ? linkedEntityType : null,
          typeof linkedEntityId === 'string' ? linkedEntityId : null,
          typeof sortOrder === 'number' ? sortOrder : 0,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
          userId,
        ],
      );

      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer economy create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette økonomilinje' });
    }
  });

  router.patch('/projects/:projectId/producer/economy/items/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere økonomilinjer' });
        return;
      }

      const payload = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const addField = (column: string, value: unknown, cast?: string) => {
        const suffix = cast ? `::${cast}` : '';
        sets.push(`${column} = $${idx}${suffix}`);
        values.push(value);
        idx += 1;
      };

      if (isProducerPhase(payload.phase)) addField('phase', payload.phase);
      if (typeof payload.category === 'string') addField('category', payload.category.trim());
      if (typeof payload.itemName === 'string') addField('item_name', payload.itemName.trim());
      if (typeof payload.description === 'string' || payload.description === null) addField('description', payload.description);
      if (typeof payload.estimate === 'number') addField('estimate', payload.estimate);
      if (typeof payload.approved === 'number') addField('approved', payload.approved);
      if (typeof payload.actual === 'number') addField('actual', payload.actual);
      if (typeof payload.currency === 'string') addField('currency', payload.currency.trim() || 'NOK');
      if (typeof payload.status === 'string') addField('status', payload.status.trim() || 'draft');
      if (typeof payload.clientVisible === 'boolean') addField('client_visible', payload.clientVisible);
      if (typeof payload.linkedEntityType === 'string' || payload.linkedEntityType === null) addField('linked_entity_type', payload.linkedEntityType);
      if (typeof payload.linkedEntityId === 'string' || payload.linkedEntityId === null) addField('linked_entity_id', payload.linkedEntityId);
      if (typeof payload.sortOrder === 'number') addField('sort_order', payload.sortOrder);
      if (payload.metadata && typeof payload.metadata === 'object') addField('metadata', JSON.stringify(payload.metadata), 'jsonb');

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen felter å oppdatere' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      values.push(projectId, itemId);

      const result = await pool.query(
        `UPDATE role_room_budget_items
         SET ${sets.join(', ')}
         WHERE project_id = $${idx} AND id = $${idx + 1}
         RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke økonomilinje' });
        return;
      }

      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer economy update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere økonomilinje' });
    }
  });

  router.delete('/projects/:projectId/producer/economy/items/:itemId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const itemId = req.params.itemId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å slette økonomilinjer' });
        return;
      }

      const deleted = await pool.query(
        `DELETE FROM role_room_budget_items
         WHERE project_id = $1 AND id = $2
         RETURNING id`,
        [projectId, itemId],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke økonomilinje' });
        return;
      }

      res.json({ success: true, itemId });
    } catch (error) {
      console.error('Producer economy delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette økonomilinje' });
    }
  });

  // ── Budsjett-kategorier (system + per-prosjekt) ────────────────────
  router.get('/projects/:projectId/producer/economy/categories', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerEconomy(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til økonomi' });
        return;
      }
      const result = await pool.query(
        `SELECT id, project_id, parent_group, parent_group_label,
                category_name, description, sort_order, is_system, created_by, created_at
           FROM role_room_budget_categories
          WHERE (project_id IS NULL OR project_id = $1) AND is_archived = FALSE
          ORDER BY parent_group, sort_order ASC, category_name ASC`,
        [projectId],
      );
      res.json({ categories: result.rows });
    } catch (error) {
      console.error('Budget categories fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente kategorier' });
    }
  });

  router.post('/projects/:projectId/producer/economy/categories', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const { parentGroup, parentGroupLabel, categoryName, description, sortOrder } = req.body as Record<string, unknown>;

    if (typeof parentGroup !== 'string' || !parentGroup.trim()) {
      res.status(400).json({ error: 'parentGroup er påkrevd' });
      return;
    }
    if (typeof parentGroupLabel !== 'string' || !parentGroupLabel.trim()) {
      res.status(400).json({ error: 'parentGroupLabel er påkrevd' });
      return;
    }
    if (typeof categoryName !== 'string' || !categoryName.trim()) {
      res.status(400).json({ error: 'categoryName er påkrevd' });
      return;
    }
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette kategori' });
        return;
      }
      const result = await pool.query(
        `INSERT INTO role_room_budget_categories
           (project_id, parent_group, parent_group_label, category_name,
            description, sort_order, is_system, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
         RETURNING id, project_id, parent_group, parent_group_label,
                   category_name, description, sort_order, is_system,
                   created_by, created_at`,
        [
          projectId,
          parentGroup.trim(),
          parentGroupLabel.trim(),
          categoryName.trim(),
          typeof description === 'string' ? description : null,
          typeof sortOrder === 'number' ? sortOrder : 999,
          userId,
        ],
      );
      res.status(201).json({ category: result.rows[0] });
    } catch (error) {
      console.error('Budget category create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette kategori' });
    }
  });

  router.delete('/projects/:projectId/producer/economy/categories/:categoryId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const categoryId = req.params.categoryId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å slette kategori' });
        return;
      }
      // Slett kun bruker-opprettede kategorier (is_system=FALSE) for det
      // konkrete prosjektet — system-rader (project_id IS NULL) er
      // delte og kan ikke slettes via API.
      const deleted = await pool.query(
        `DELETE FROM role_room_budget_categories
          WHERE id = $1 AND project_id = $2 AND is_system = FALSE
          RETURNING id`,
        [categoryId, projectId],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke kategori (eller er system-kategori)' });
        return;
      }
      res.json({ success: true, categoryId });
    } catch (error) {
      console.error('Budget category delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette kategori' });
    }
  });

  router.get('/projects/:projectId/producer/reviews', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til godkjenningsflyt' });
        return;
      }

      const reviewsResult = await pool.query(
        `SELECT * FROM role_room_client_reviews
         WHERE project_id = $1
         ORDER BY requested_at DESC, created_at DESC`,
        [projectId],
      );
      const commentsResult = await pool.query(
        `SELECT * FROM role_room_client_review_comments
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId],
      );

      const commentsByReview = commentsResult.rows.reduce<Record<string, unknown[]>>((acc, row) => {
        const reviewId = String((row as { review_id?: string }).review_id ?? '');
        if (!reviewId) return acc;
        if (!acc[reviewId]) acc[reviewId] = [];
        acc[reviewId].push(row);
        return acc;
      }, {});

      const items = reviewsResult.rows.map((row) => ({
        ...row,
        comments: commentsByReview[String((row as { id?: string }).id ?? '')] ?? [],
      }));
      res.json({ items });
    } catch (error) {
      console.error('Producer reviews fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente review-flyt' });
    }
  });

  router.post('/projects/:projectId/producer/reviews', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      reviewType,
      title,
      description,
      targetEntityType,
      targetEntityId,
      dueAt,
      metadata,
    } = req.body as Record<string, unknown>;

    if (typeof reviewType !== 'string' || !reviewType.trim()) {
      res.status(400).json({ error: 'reviewType er påkrevd' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette review' });
        return;
      }

      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO role_room_client_reviews (
          id, project_id, review_type, title, description, target_entity_type, target_entity_id,
          requested_by_user_id, requested_at, due_at, status, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, NOW(), $9, 'pending', $10::jsonb, NOW(), NOW()
        )
        RETURNING *`,
        [
          id,
          projectId,
          reviewType.trim(),
          title.trim(),
          typeof description === 'string' ? description : null,
          typeof targetEntityType === 'string' ? targetEntityType : null,
          typeof targetEntityId === 'string' ? targetEntityId : null,
          userId,
          typeof dueAt === 'string' ? dueAt : null,
          JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
        ],
      );
      await upsertProducerReviewTimelineItem(projectId, result.rows[0] as ProducerReviewRow, userId);
      res.status(201).json({ review: result.rows[0] });
    } catch (error) {
      console.error('Producer review create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette review' });
    }
  });

  router.patch('/projects/:projectId/producer/reviews/:reviewId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;
    const {
      reviewType,
      title,
      description,
      targetEntityType,
      targetEntityId,
      dueAt,
      metadata,
    } = req.body as Record<string, unknown>;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere review' });
        return;
      }

      const existingResult = await pool.query(
        `SELECT * FROM role_room_client_reviews WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [reviewId, projectId],
      );
      if (existingResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      let parameterIndex = 1;
      const pushUpdate = (fragment: string, value: unknown) => {
        sets.push(`${fragment} = $${parameterIndex}`);
        values.push(value);
        parameterIndex += 1;
      };

      if (reviewType !== undefined) {
        if (typeof reviewType !== 'string' || !reviewType.trim()) {
          res.status(400).json({ error: 'reviewType må være en ikke-tom streng' });
          return;
        }
        pushUpdate('review_type', reviewType.trim());
      }
      if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
          res.status(400).json({ error: 'title må være en ikke-tom streng' });
          return;
        }
        pushUpdate('title', title.trim());
      }
      if (description !== undefined) {
        pushUpdate('description', typeof description === 'string' && description.trim().length > 0 ? description.trim() : null);
      }
      if (targetEntityType !== undefined) {
        pushUpdate('target_entity_type', typeof targetEntityType === 'string' && targetEntityType.trim().length > 0 ? targetEntityType.trim() : null);
      }
      if (targetEntityId !== undefined) {
        pushUpdate('target_entity_id', typeof targetEntityId === 'string' && targetEntityId.trim().length > 0 ? targetEntityId.trim() : null);
      }
      if (dueAt !== undefined) {
        pushUpdate('due_at', typeof dueAt === 'string' && dueAt.trim().length > 0 ? dueAt.trim() : null);
      }
      if (metadata !== undefined) {
        pushUpdate('metadata', JSON.stringify(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}));
        sets[sets.length - 1] = `${sets[sets.length - 1]}::jsonb`;
      }

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen review-felter å oppdatere' });
        return;
      }

      values.push(reviewId);
      values.push(projectId);
      const updatedResult = await pool.query(
        `UPDATE role_room_client_reviews
         SET ${sets.join(', ')},
             updated_at = NOW()
         WHERE id = $${parameterIndex} AND project_id = $${parameterIndex + 1}
         RETURNING *`,
        values,
      );

      await upsertProducerReviewTimelineItem(projectId, updatedResult.rows[0] as ProducerReviewRow, getUserId(req));
      res.json({ review: updatedResult.rows[0] });
    } catch (error) {
      console.error('Producer review patch error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere review' });
    }
  });

  router.post('/projects/:projectId/producer/reviews/:reviewId/comments', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;
    const userId = getUserId(req);
    const { commentText, timestampSeconds } = req.body as Record<string, unknown>;

    if (typeof commentText !== 'string' || !commentText.trim()) {
      res.status(400).json({ error: 'commentText er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canCommentProducerReview(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å kommentere review' });
        return;
      }

      const reviewCheck = await pool.query(
        `SELECT id, title FROM role_room_client_reviews WHERE id = $1 AND project_id = $2`,
        [reviewId, projectId],
      );
      if (reviewCheck.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      const id = crypto.randomUUID();
      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const result = await pool.query(
        `INSERT INTO role_room_client_review_comments (
          id, review_id, project_id, author_user_id, author_role, comment_text, timestamp_seconds, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          id,
          reviewId,
          projectId,
          userId,
          effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
          commentText.trim(),
          typeof timestampSeconds === 'number' ? Math.max(0, Math.floor(timestampSeconds)) : null,
        ],
      );
      await pool.query(`UPDATE role_room_client_reviews SET updated_at = NOW() WHERE id = $1`, [reviewId]);

      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientReviewComment({
          projectId,
          reviewId,
          reviewTitle: String(reviewCheck.rows[0]?.title ?? 'review'),
          commentText: commentText.trim(),
          timestampSeconds: typeof timestampSeconds === 'number' ? Math.max(0, Math.floor(timestampSeconds)) : null,
          userId,
          actorRole: effectiveRoleRecord?.role ?? null,
        });
      }

      res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
      console.error('Producer review comment create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette kommentar' });
    }
  });

  router.post('/projects/:projectId/producer/reviews/:reviewId/decision', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;
    const userId = getUserId(req);
    const { decision, reason, timestampSeconds } = req.body as Record<string, unknown>;

    if (!isProducerReviewDecision(decision)) {
      res.status(400).json({ error: 'decision må være approved, rejected eller changes_requested' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canDecideProducerReview(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å beslutte review' });
        return;
      }

      const reviewResult = await pool.query(
        `SELECT * FROM role_room_client_reviews WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [reviewId, projectId],
      );
      if (reviewResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      const updated = await pool.query(
        `UPDATE role_room_client_reviews
         SET status = $1,
             decision_by_user_id = $2,
             decision_at = NOW(),
             decision_reason = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [decision, userId, typeof reason === 'string' ? reason : null, reviewId],
      );

      if (typeof reason === 'string' && reason.trim()) {
        const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
        await pool.query(
          `INSERT INTO role_room_client_review_comments (
            id, review_id, project_id, author_user_id, author_role, comment_text, timestamp_seconds, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            crypto.randomUUID(),
            reviewId,
            projectId,
            userId,
            effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
            reason.trim(),
            typeof timestampSeconds === 'number' ? Math.max(0, Math.floor(timestampSeconds)) : null,
          ],
        );
      }

      await upsertProducerReviewTimelineItem(projectId, updated.rows[0] as ProducerReviewRow, userId);

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientReviewDecision(
          projectId,
          updated.rows[0] as ProducerReviewRow,
          userId,
          effectiveRoleRecord?.role ?? null,
        );
      }

      res.json({ review: updated.rows[0] });
    } catch (error) {
      console.error('Producer review decision error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere review-beslutning' });
    }
  });

  router.delete('/projects/:projectId/producer/reviews/:reviewId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const reviewId = req.params.reviewId;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å slette review' });
        return;
      }

      const deletedResult = await pool.query(
        `DELETE FROM role_room_client_reviews
         WHERE id = $1 AND project_id = $2
         RETURNING id`,
        [reviewId, projectId],
      );
      if (deletedResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke review' });
        return;
      }

      await pool.query(
        `DELETE FROM role_room_phase_timeline_items
         WHERE project_id = $1
           AND linked_entity_type = 'client_review'
           AND linked_entity_id = $2`,
        [projectId, reviewId],
      );

      res.status(204).send();
    } catch (error) {
      console.error('Producer review delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette review' });
    }
  });

  router.get('/projects/:projectId/producer/client-intake', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til klientbrief' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_client_intake WHERE project_id = $1 LIMIT 1`,
        [projectId],
      );
      res.json({ intake: result.rows[0] ?? null });
    } catch (error) {
      console.error('Producer client intake fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente klientbrief' });
    }
  });

  router.put('/projects/:projectId/producer/client-intake', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const body = req.body as Record<string, unknown>;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere klientbrief' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const values = [
        projectId,
        typeof body.projectGoal === 'string' ? body.projectGoal.trim() : null,
        typeof body.deliverables === 'string' ? body.deliverables.trim() : null,
        typeof body.targetAudience === 'string' ? body.targetAudience.trim() : null,
        typeof body.keyMessage === 'string' ? body.keyMessage.trim() : null,
        typeof body.timingConstraints === 'string' ? body.timingConstraints.trim() : null,
        typeof body.brandNotes === 'string' ? body.brandNotes.trim() : null,
        typeof body.materialOverview === 'string' ? body.materialOverview.trim() : null,
        typeof body.referenceLinks === 'string' ? body.referenceLinks.trim() : null,
        typeof body.contactName === 'string' ? body.contactName.trim() : null,
        typeof body.contactEmail === 'string' ? body.contactEmail.trim() : null,
        typeof body.contactPhone === 'string' ? body.contactPhone.trim() : null,
        typeof body.additionalNotes === 'string' ? body.additionalNotes.trim() : null,
        JSON.stringify(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
        userId,
        effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
      ];

      const result = await pool.query(
        `INSERT INTO role_room_client_intake (
          project_id, project_goal, deliverables, target_audience, key_message, timing_constraints,
          brand_notes, material_overview, reference_links, contact_name, contact_email, contact_phone,
          additional_notes, metadata, updated_by_user_id, updated_by_role, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14::jsonb, $15, $16, NOW(), NOW()
        )
        ON CONFLICT (project_id) DO UPDATE SET
          project_goal = EXCLUDED.project_goal,
          deliverables = EXCLUDED.deliverables,
          target_audience = EXCLUDED.target_audience,
          key_message = EXCLUDED.key_message,
          timing_constraints = EXCLUDED.timing_constraints,
          brand_notes = EXCLUDED.brand_notes,
          material_overview = EXCLUDED.material_overview,
          reference_links = EXCLUDED.reference_links,
          contact_name = EXCLUDED.contact_name,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          additional_notes = EXCLUDED.additional_notes,
          metadata = EXCLUDED.metadata,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_by_role = EXCLUDED.updated_by_role,
          updated_at = NOW()
        RETURNING *`,
        values,
      );

      // Versjonér intake: lagre snapshot etter hver write.
      // Best-effort — feiler ikke save-flowen hvis snapshot-en svikter.
      try {
        const mod = await import("./role-room-intake-versions-routes.js");
        await mod.snapshotIntakeVersion(pool, {
          projectId,
          generatedByUserId: userId,
          generatedByKind: 'user',
        });
      } catch (e) {
        console.warn("[intake-save] snapshot feilet", e);
      }

      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientBrief(
          projectId,
          result.rows[0] as ProducerClientIntakeRow,
          userId,
          effectiveRoleRecord?.role ?? null,
        );
      }

      // Activity-feed: logg én "brief_saved" + per-felt "field_edited" for felter
      // som faktisk var med i body. Vi spammer ikke feeden hvis ingen felter er
      // endret denne lagringen.
      if (await ensureBriefCollaborationTables()) {
        const actorRole = normaliseAuthorRoleForBrief(effectiveRoleRecord?.role);
        const editedFields = [
          'projectGoal', 'deliverables', 'targetAudience', 'keyMessage',
          'timingConstraints', 'brandNotes', 'materialOverview', 'referenceLinks',
          'contactName', 'contactEmail', 'contactPhone', 'additionalNotes',
        ].filter((key) => typeof body[key] === 'string' && (body[key] as string).trim().length > 0);

        await logBriefActivity(
          projectId,
          'brief_saved',
          { userId, role: actorRole, name: null },
          null,
          { fieldsEdited: editedFields },
        );
        for (const fieldKey of editedFields) {
          await logBriefActivity(
            projectId,
            'field_edited',
            { userId, role: actorRole, name: null },
            fieldKey,
            { length: (body[fieldKey] as string).length },
          );
        }
      }

      res.json({ intake: result.rows[0] });
    } catch (error) {
      console.error('Producer client intake save error:', error);
      res.status(500).json({ error: 'Kunne ikke lagre klientbrief' });
    }
  });

  // ----------------------------------------------------------------------
  // Creative Space Sync — inline-kommentarer + activity-feed
  // (migrasjon 0151_role_room_brief_comments.sql)
  // ----------------------------------------------------------------------

  let briefCollaborationTablesReadyPromise: Promise<boolean> | null = null;
  async function ensureBriefCollaborationTables(): Promise<boolean> {
    if (briefCollaborationTablesReadyPromise) return briefCollaborationTablesReadyPromise;
    briefCollaborationTablesReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_brief_comments (
            id               VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
            project_id       VARCHAR(64)  NOT NULL,
            field_key        VARCHAR(64)  NOT NULL,
            author_user_id   VARCHAR(255),
            author_role      VARCHAR(32)  NOT NULL CHECK (author_role IN ('client', 'producer', 'system')),
            author_name      VARCHAR(255),
            body             TEXT         NOT NULL,
            parent_id        VARCHAR(64)  REFERENCES role_room_brief_comments(id) ON DELETE CASCADE,
            resolved_at      TIMESTAMPTZ,
            resolved_by_role VARCHAR(32),
            created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS role_room_brief_comments_project_field_idx
            ON role_room_brief_comments (project_id, field_key, created_at);
          CREATE INDEX IF NOT EXISTS role_room_brief_comments_unresolved_idx
            ON role_room_brief_comments (project_id)
            WHERE resolved_at IS NULL;

          CREATE TABLE IF NOT EXISTS role_room_brief_activity (
            id            BIGSERIAL    PRIMARY KEY,
            project_id    VARCHAR(64)  NOT NULL,
            event_kind    VARCHAR(64)  NOT NULL,
            actor_user_id VARCHAR(255),
            actor_role    VARCHAR(32),
            actor_name    VARCHAR(255),
            field_key     VARCHAR(64),
            metadata      JSONB        DEFAULT '{}'::jsonb,
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS role_room_brief_activity_project_idx
            ON role_room_brief_activity (project_id, created_at DESC);
        `);
        return true;
      } catch (error) {
        console.error('[brief-collaboration] ensure tables failed:', error);
        briefCollaborationTablesReadyPromise = null;
        return false;
      }
    })();
    return briefCollaborationTablesReadyPromise;
  }

  function normaliseAuthorRoleForBrief(role: string | null | undefined): 'client' | 'producer' {
    if (!role) return 'producer';
    if (role === 'client_reviewer' || role === 'client') return 'client';
    return 'producer';
  }

  async function logBriefActivity(
    projectId: string,
    eventKind: string,
    actor: { userId: string | null; role: string | null; name: string | null },
    fieldKey: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO role_room_brief_activity
           (project_id, event_kind, actor_user_id, actor_role, actor_name, field_key, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          projectId,
          eventKind,
          actor.userId,
          actor.role,
          actor.name,
          fieldKey,
          JSON.stringify(metadata ?? {}),
        ],
      );
    } catch (error) {
      console.error('[brief-collaboration] activity log failed:', error);
    }
  }

  router.get('/projects/:projectId/brief-comments', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureBriefCollaborationTables())) {
      res.status(500).json({ error: 'Brief-tabeller er ikke tilgjengelige' });
      return;
    }
    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til brief-kommentarer' });
        return;
      }
      const fieldKey = typeof req.query.fieldKey === 'string' ? req.query.fieldKey.trim() : null;
      const includeResolved = req.query.includeResolved === '1' || req.query.includeResolved === 'true';

      const params: unknown[] = [projectId];
      let whereClause = 'project_id = $1';
      if (fieldKey) {
        params.push(fieldKey);
        whereClause += ` AND field_key = $${params.length}`;
      }
      if (!includeResolved) {
        whereClause += ' AND resolved_at IS NULL';
      }

      const result = await pool.query(
        `SELECT id, project_id, field_key, author_user_id, author_role, author_name,
                body, parent_id, resolved_at, resolved_by_role, created_at, updated_at
         FROM role_room_brief_comments
         WHERE ${whereClause}
         ORDER BY created_at ASC`,
        params,
      );
      res.json({ comments: result.rows });
    } catch (error) {
      console.error('Brief-comments fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente kommentarer' });
    }
  });

  router.post('/projects/:projectId/brief-comments', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureBriefCollaborationTables())) {
      res.status(500).json({ error: 'Brief-tabeller er ikke tilgjengelige' });
      return;
    }
    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const body = req.body as Record<string, unknown>;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å kommentere brief' });
        return;
      }

      const fieldKey = typeof body.fieldKey === 'string' ? body.fieldKey.trim() : '';
      const commentBody = typeof body.body === 'string' ? body.body.trim() : '';
      const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
      const authorName = typeof body.authorName === 'string' ? body.authorName.trim().slice(0, 255) : null;

      if (!fieldKey || !commentBody) {
        res.status(400).json({ error: 'fieldKey og body er påkrevd' });
        return;
      }
      if (commentBody.length > 4000) {
        res.status(400).json({ error: 'Kommentar er for lang (maks 4000 tegn)' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const authorRole = normaliseAuthorRoleForBrief(effectiveRoleRecord?.role);

      const inserted = await pool.query(
        `INSERT INTO role_room_brief_comments
           (project_id, field_key, author_user_id, author_role, author_name, body, parent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [projectId, fieldKey, userId, authorRole, authorName, commentBody, parentId],
      );

      await logBriefActivity(
        projectId,
        parentId ? 'comment_replied' : 'comment_added',
        { userId, role: authorRole, name: authorName },
        fieldKey,
        { commentId: inserted.rows[0].id, parentId },
      );

      res.status(201).json({ comment: inserted.rows[0] });
    } catch (error) {
      console.error('Brief-comments create error:', error);
      res.status(500).json({ error: 'Kunne ikke lagre kommentar' });
    }
  });

  router.post('/projects/:projectId/brief-comments/:commentId/resolve', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureBriefCollaborationTables())) {
      res.status(500).json({ error: 'Brief-tabeller er ikke tilgjengelige' });
      return;
    }
    const { projectId, commentId } = req.params;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å løse kommentar' });
        return;
      }
      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const role = normaliseAuthorRoleForBrief(effectiveRoleRecord?.role);

      const result = await pool.query(
        `UPDATE role_room_brief_comments
            SET resolved_at = NOW(), resolved_by_role = $3, updated_at = NOW()
          WHERE id = $1 AND project_id = $2 AND resolved_at IS NULL
          RETURNING *`,
        [commentId, projectId, role],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Kommentar ikke funnet eller allerede løst' });
        return;
      }
      await logBriefActivity(
        projectId,
        'comment_resolved',
        { userId, role, name: null },
        result.rows[0].field_key,
        { commentId },
      );
      res.json({ comment: result.rows[0] });
    } catch (error) {
      console.error('Brief-comment resolve error:', error);
      res.status(500).json({ error: 'Kunne ikke løse kommentar' });
    }
  });

  router.delete('/projects/:projectId/brief-comments/:commentId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureBriefCollaborationTables())) {
      res.status(500).json({ error: 'Brief-tabeller er ikke tilgjengelige' });
      return;
    }
    const { projectId, commentId } = req.params;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang' });
        return;
      }
      // Bare forfatter eller admin kan slette
      const existing = await pool.query(
        `SELECT author_user_id, field_key FROM role_room_brief_comments
          WHERE id = $1 AND project_id = $2`,
        [commentId, projectId],
      );
      if (existing.rowCount === 0) {
        res.status(404).json({ error: 'Kommentar ikke funnet' });
        return;
      }
      const isAuthor = existing.rows[0].author_user_id === userId;
      const isAdmin = requireScope(req, 'admin');
      if (!isAuthor && !isAdmin) {
        res.status(403).json({ error: 'Kun forfatter kan slette' });
        return;
      }
      await pool.query(
        `DELETE FROM role_room_brief_comments WHERE id = $1 AND project_id = $2`,
        [commentId, projectId],
      );
      await logBriefActivity(
        projectId,
        'comment_deleted',
        { userId, role: null, name: null },
        existing.rows[0].field_key,
        { commentId },
      );
      res.status(204).send();
    } catch (error) {
      console.error('Brief-comment delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette kommentar' });
    }
  });

  router.get('/projects/:projectId/brief-activity', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureBriefCollaborationTables())) {
      res.status(500).json({ error: 'Brief-tabeller er ikke tilgjengelige' });
      return;
    }
    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til activity-feed' });
        return;
      }
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
      const result = await pool.query(
        `SELECT id, project_id, event_kind, actor_user_id, actor_role, actor_name,
                field_key, metadata, created_at
           FROM role_room_brief_activity
          WHERE project_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [projectId, limit],
      );
      res.json({ activity: result.rows });
    } catch (error) {
      console.error('Brief-activity fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente activity' });
    }
  });

  router.get('/projects/:projectId/producer/client-materials', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til klientmateriale' });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM role_room_client_materials
         WHERE project_id = $1
         ORDER BY created_at DESC, updated_at DESC`,
        [projectId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error('Producer client materials fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente klientmateriale' });
    }
  });

  router.post('/projects/:projectId/producer/client-materials', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const userId = getUserId(req);
    const {
      entryType,
      title,
      description,
      externalUrl,
      phase,
      linkedShotListId,
      status,
      metadata,
    } = req.body as Record<string, unknown>;

    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title er påkrevd' });
      return;
    }
    if (typeof entryType !== 'string' || !entryType.trim()) {
      res.status(400).json({ error: 'entryType er påkrevd' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å opprette klientmateriale' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const result = await pool.query(
        `INSERT INTO role_room_client_materials (
          id, project_id, entry_type, title, description, external_url, phase,
          linked_shot_list_id, status, metadata, created_by_user_id, created_by_role, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10::jsonb, $11, $12, NOW(), NOW()
        )
        RETURNING *`,
        [
          crypto.randomUUID(),
          projectId,
          entryType.trim(),
          title.trim(),
          typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
          typeof externalUrl === 'string' && externalUrl.trim().length > 0 ? externalUrl.trim() : null,
          typeof phase === 'string' && phase.trim().length > 0 ? phase.trim() : null,
          typeof linkedShotListId === 'string' && linkedShotListId.trim().length > 0 ? linkedShotListId.trim() : null,
          typeof status === 'string' && status.trim().length > 0 ? status.trim() : 'provided',
          JSON.stringify(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          userId,
          effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
        ],
      );

      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientMaterial(
          projectId,
          result.rows[0] as ProducerClientMaterialRow,
          userId,
          effectiveRoleRecord?.role ?? null,
          'created',
        );
      }

      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer client material create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette klientmateriale' });
    }
  });

  router.patch('/projects/:projectId/producer/client-materials/:materialId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const materialId = req.params.materialId;
    const {
      entryType,
      title,
      description,
      externalUrl,
      phase,
      linkedShotListId,
      status,
      metadata,
    } = req.body as Record<string, unknown>;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å oppdatere klientmateriale' });
        return;
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      let parameterIndex = 1;
      const pushUpdate = (column: string, value: unknown, castJson = false) => {
        sets.push(`${column} = $${parameterIndex}${castJson ? '::jsonb' : ''}`);
        values.push(value);
        parameterIndex += 1;
      };

      if (entryType !== undefined) {
        pushUpdate('entry_type', typeof entryType === 'string' && entryType.trim().length > 0 ? entryType.trim() : null);
      }
      if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
          res.status(400).json({ error: 'title må være en ikke-tom streng' });
          return;
        }
        pushUpdate('title', title.trim());
      }
      if (description !== undefined) {
        pushUpdate('description', typeof description === 'string' && description.trim().length > 0 ? description.trim() : null);
      }
      if (externalUrl !== undefined) {
        pushUpdate('external_url', typeof externalUrl === 'string' && externalUrl.trim().length > 0 ? externalUrl.trim() : null);
      }
      if (phase !== undefined) {
        pushUpdate('phase', typeof phase === 'string' && phase.trim().length > 0 ? phase.trim() : null);
      }
      if (linkedShotListId !== undefined) {
        pushUpdate('linked_shot_list_id', typeof linkedShotListId === 'string' && linkedShotListId.trim().length > 0 ? linkedShotListId.trim() : null);
      }
      if (status !== undefined) {
        pushUpdate('status', typeof status === 'string' && status.trim().length > 0 ? status.trim() : null);
      }
      if (metadata !== undefined) {
        pushUpdate('metadata', JSON.stringify(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}), true);
      }

      if (sets.length === 0) {
        res.status(400).json({ error: 'Ingen klientmateriale-felter å oppdatere' });
        return;
      }

      values.push(materialId);
      values.push(projectId);
      const result = await pool.query(
        `UPDATE role_room_client_materials
         SET ${sets.join(', ')},
             updated_at = NOW()
         WHERE id = $${parameterIndex} AND project_id = $${parameterIndex + 1}
         RETURNING *`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke klientmateriale' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientMaterial(
          projectId,
          result.rows[0] as ProducerClientMaterialRow,
          getUserId(req),
          effectiveRoleRecord?.role ?? null,
          'updated',
        );
      }

      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error('Producer client material patch error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere klientmateriale' });
    }
  });

  router.delete('/projects/:projectId/producer/client-materials/:materialId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const materialId = req.params.materialId;

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerClientInput(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å slette klientmateriale' });
        return;
      }

      const existingMaterialResult = await pool.query(
        `SELECT * FROM role_room_client_materials
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [materialId, projectId],
      );
      if (existingMaterialResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke klientmateriale' });
        return;
      }

      const result = await pool.query(
        `DELETE FROM role_room_client_materials
         WHERE id = $1 AND project_id = $2
         RETURNING id`,
        [materialId, projectId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke klientmateriale' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      if (isClientReviewerProjectRole(effectiveRoleRecord?.role)) {
        await notifyProducerTeamAboutClientMaterial(
          projectId,
          existingMaterialResult.rows[0] as ProducerClientMaterialRow,
          getUserId(req),
          effectiveRoleRecord?.role ?? null,
          'deleted',
        );
      }

      res.status(204).send();
    } catch (error) {
      console.error('Producer client material delete error:', error);
      res.status(500).json({ error: 'Kunne ikke slette klientmateriale' });
    }
  });

  router.get('/projects/:projectId/producer/access-vault', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til Client Access Vault' });
        return;
      }

      const [secretsResult, requestsResult, auditResult] = await Promise.all([
        pool.query(
          `SELECT *
           FROM role_room_access_vault_secrets
           WHERE project_id = $1
           ORDER BY updated_at DESC, created_at DESC`,
          [projectId],
        ),
        pool.query(
          `SELECT *
           FROM role_room_access_vault_reveal_requests
           WHERE project_id = $1
           ORDER BY requested_at DESC, updated_at DESC`,
          [projectId],
        ),
        pool.query(
          `SELECT *
           FROM role_room_access_vault_audit_events
           WHERE project_id = $1
           ORDER BY created_at DESC
           LIMIT 80`,
          [projectId],
        ),
      ]);

      res.json({
        secrets: secretsResult.rows.map((row) => buildRoleRoomAccessVaultSecretSummary(row as RoleRoomAccessVaultSecretRow)),
        requests: requestsResult.rows.map((row) => buildRoleRoomAccessVaultRevealRequestResponse(row as RoleRoomAccessVaultRevealRequestRow)),
        audit: auditResult.rows.map((row) => buildRoleRoomAccessVaultAuditResponse(row as RoleRoomAccessVaultAuditRow)),
      });
    } catch (error) {
      console.error('Producer access vault fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente Client Access Vault' });
    }
  });

  router.put('/projects/:projectId/producer/access-vault/secrets/:platform', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const platform = normalizeProducerAccountAccessPlatform(req.params.platform);
    const userId = getUserId(req);
    if (!platform) {
      res.status(400).json({ error: 'Ugyldig plattform for vault' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerAccessVault(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å lagre sensitive secrets' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const existing = await getRoleRoomAccessVaultSecretByPlatform(projectId, platform);
      const label = readStringValue(req.body?.label) ?? readStringValue(existing?.label) ?? null;
      const secretType = readStringValue(req.body?.secretType) ?? readStringValue(existing?.secret_type) ?? null;
      const username = readStringValue(req.body?.username);
      const secretValue = readStringValue(req.body?.secretValue);
      const backupCode = readStringValue(req.body?.backupCode);
      const nextMaskedReference = readStringValue(req.body?.maskedReference)
        ?? (secretValue ? maskRoleRoomVaultSecretValue(secretValue) : readStringValue(existing?.masked_reference))
        ?? null;
      const revealPolicy = normalizeRoleRoomVaultRevealPolicy(req.body?.revealPolicy ?? existing?.reveal_policy);
      const status = normalizeRoleRoomVaultSecretStatus(req.body?.status ?? existing?.status);
      const tier = readStringValue(req.body?.tier) ?? readStringValue(existing?.tier) ?? 'sensitive_secret';
      const riskLevel = readStringValue(req.body?.riskLevel) ?? readStringValue(existing?.risk_level) ?? 'medium';
      const ownerName = readStringValue(req.body?.ownerName) ?? readStringValue(existing?.owner_label) ?? null;
      const expiresAt = readVaultTimestamp(req.body?.expiresAt) ?? existing?.expires_at ?? null;
      const sharedWithRoles = normalizeRoleRoomVaultRoleTargets(req.body?.sharedWithRoles ?? existing?.shared_with_roles);
      const metadata = readJsonObject(req.body?.metadata);

      if (!label && !secretType && !nextMaskedReference && !secretValue && !backupCode && !existing) {
        res.status(400).json({ error: 'Oppgi minst label, type, maskert referanse eller hemmelig verdi.' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO role_room_access_vault_secrets (
          id, project_id, platform, label, secret_type, username_encrypted, secret_encrypted,
          backup_code_encrypted, masked_reference, tier, risk_level, reveal_policy, status, owner_label,
          shared_with_roles, expires_at, metadata, created_by_user_id, created_by_role, created_at, updated_at, revoked_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15::jsonb, $16, $17::jsonb, $18, $19, NOW(), NOW(), NULL
        )
        ON CONFLICT (project_id, platform) DO UPDATE SET
          label = EXCLUDED.label,
          secret_type = EXCLUDED.secret_type,
          username_encrypted = COALESCE(EXCLUDED.username_encrypted, role_room_access_vault_secrets.username_encrypted),
          secret_encrypted = COALESCE(EXCLUDED.secret_encrypted, role_room_access_vault_secrets.secret_encrypted),
          backup_code_encrypted = COALESCE(EXCLUDED.backup_code_encrypted, role_room_access_vault_secrets.backup_code_encrypted),
          masked_reference = EXCLUDED.masked_reference,
          tier = EXCLUDED.tier,
          risk_level = EXCLUDED.risk_level,
          reveal_policy = EXCLUDED.reveal_policy,
          status = EXCLUDED.status,
          owner_label = EXCLUDED.owner_label,
          shared_with_roles = EXCLUDED.shared_with_roles,
          expires_at = EXCLUDED.expires_at,
          metadata = EXCLUDED.metadata,
          created_by_user_id = EXCLUDED.created_by_user_id,
          created_by_role = EXCLUDED.created_by_role,
          revoked_at = NULL,
          updated_at = NOW()
        RETURNING *`,
        [
          existing?.id ?? crypto.randomUUID(),
          projectId,
          platform,
          label,
          secretType,
          username ? encryptRoleRoomVaultSecret(username) : null,
          secretValue ? encryptRoleRoomVaultSecret(secretValue) : null,
          backupCode ? encryptRoleRoomVaultSecret(backupCode) : null,
          nextMaskedReference,
          tier,
          riskLevel,
          revealPolicy,
          status,
          ownerName,
          JSON.stringify(sharedWithRoles),
          expiresAt,
          JSON.stringify(metadata),
          userId,
          effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
        ],
      );

      const secretRow = result.rows[0] as RoleRoomAccessVaultSecretRow;
      await appendRoleRoomAccessVaultAuditEvent({
        req,
        projectId,
        secretId: secretRow.id,
        platform,
        action: 'secret_saved',
        actorUserId: userId,
        actorRole: effectiveRoleRecord?.role ?? null,
        metadata: {
          revealPolicy,
          status,
          hasStoredSecret: Boolean(secretValue || existing?.secret_encrypted),
          hasBackupCode: Boolean(backupCode || existing?.backup_code_encrypted),
        },
      });

      res.json({ secret: buildRoleRoomAccessVaultSecretSummary(secretRow) });
    } catch (error) {
      console.error('Producer access vault secret save error:', error);
      res.status(500).json({ error: 'Kunne ikke lagre secret i Client Access Vault' });
    }
  });

  router.delete('/projects/:projectId/producer/access-vault/secrets/:platform', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const platform = normalizeProducerAccountAccessPlatform(req.params.platform);
    const userId = getUserId(req);
    if (!platform) {
      res.status(400).json({ error: 'Ugyldig plattform for vault' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canManageProducerAccessVault(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å tilbakekalle secret' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const existing = await getRoleRoomAccessVaultSecretByPlatform(projectId, platform);
      if (!existing) {
        res.status(404).json({ error: 'Fant ikke secret for plattformen' });
        return;
      }

      const result = await pool.query(
        `UPDATE role_room_access_vault_secrets
         SET status = 'revoked',
             username_encrypted = NULL,
             secret_encrypted = NULL,
             backup_code_encrypted = NULL,
             revoked_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.id],
      );

      await appendRoleRoomAccessVaultAuditEvent({
        req,
        projectId,
        secretId: existing.id,
        platform,
        action: 'secret_revoked',
        actorUserId: userId,
        actorRole: effectiveRoleRecord?.role ?? null,
      });

      res.json({ secret: buildRoleRoomAccessVaultSecretSummary(result.rows[0] as RoleRoomAccessVaultSecretRow) });
    } catch (error) {
      console.error('Producer access vault revoke error:', error);
      res.status(500).json({ error: 'Kunne ikke tilbakekalle secret' });
    }
  });

  router.post('/projects/:projectId/producer/access-vault/secrets/:platform/request-reveal', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const platform = normalizeProducerAccountAccessPlatform(req.params.platform);
    const userId = getUserId(req);
    if (!platform) {
      res.status(400).json({ error: 'Ugyldig plattform for vault' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canRequestProducerAccessVaultReveal(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å be om reveal' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const secret = await getRoleRoomAccessVaultSecretByPlatform(projectId, platform);
      if (!secret || secret.revoked_at) {
        res.status(404).json({ error: 'Fant ikke aktiv secret for plattformen' });
        return;
      }

      // ── MFA step-up gate ──────────────────────────────────────────
      // Krev TOTP-kode (eller e-post-fallback) hvis:
      //   1. Secret har policy=mfa_required, ELLER
      //   2. Brukeren har TOTP aktivert på kontoen sin (vi krever det
      //      uansett — har du 2FA på, skal du måtte bekrefte med kode
      //      for å se passord, akkurat som 1Password / Bitwarden)
      //
      // Body kan inneholde { totpCode } eller { emailCode }. Hvis
      // ingen verifisering er gjort, returnerer vi 401 med info om
      // hvilke metoder som er tilgjengelige slik at frontend kan vise
      // riktig prompt.
      let mfaMethod: 'totp' | 'email_code' | 'none' = 'none';
      const policy = normalizeRoleRoomVaultRevealPolicy(secret.reveal_policy);
      const apiKeyReq = req as Request & { apiKeyUser?: ApiKeyUserContext };
      const userEmail = apiKeyReq.apiKeyUser?.email ?? null;
      const realUserId = apiKeyReq.apiKeyUser?.userId ?? null;
      try {
        const totpSvc = await import('./totp-2fa-service.js');
        const totpStatus = realUserId ? await totpSvc.getTotpStatus(pool, realUserId) : { enabled: false, pending: false };
        const requireMfa = policy === 'mfa_required' || totpStatus.enabled;

        if (requireMfa) {
          const totpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode : '';
          const emailCode = typeof req.body?.emailCode === 'string' ? req.body.emailCode : '';

          if (totpStatus.enabled && totpCode) {
            const result = realUserId
              ? await totpSvc.verifyLoginToken(pool, { userId: realUserId, token: totpCode })
              : { ok: false, reason: 'not_enrolled' as const };
            if (!result.ok) {
              res.status(401).json({
                error: 'mfa_required',
                method: 'totp',
                reason: result.reason,
                message: 'Feil TOTP-kode. Sjekk Authenticator-appen.',
              });
              return;
            }
            mfaMethod = 'totp';
          } else if (emailCode && userEmail) {
            const verifSvc = await import('./email-verification-service.js');
            const result = await verifSvc.verifyCode(pool, {
              email: userEmail,
              purpose: 'vault_reveal',
              code: emailCode,
            });
            if (!result.ok) {
              res.status(401).json({
                error: 'mfa_required',
                method: 'email_code',
                reason: result.reason,
                attemptsRemaining: result.attemptsRemaining,
                message: 'Feil eller utløpt e-post-kode.',
              });
              return;
            }
            mfaMethod = 'email_code';
          } else {
            // Ingen kode oppgitt — be om en
            res.status(401).json({
              error: 'mfa_required',
              availableMethods: {
                totp: totpStatus.enabled,
                emailCode: Boolean(userEmail),
              },
              policy,
              message: totpStatus.enabled
                ? 'Skriv inn 6-sifret kode fra Authenticator-appen for å se passordet.'
                : 'Be om en e-post-kode og skriv den inn for å se passordet.',
            });
            return;
          }
        }
      } catch (mfaError) {
        console.error('[vault] MFA-sjekk feilet:', mfaError);
        // Fail-closed: hvis MFA-stacken er nede og policy=mfa_required,
        // ikke slipp gjennom. For andre policies kan vi være pragmatiske.
        if (policy === 'mfa_required') {
          res.status(503).json({ error: 'mfa_service_unavailable' });
          return;
        }
      }

      const existingRequestResult = await pool.query(
        `SELECT *
         FROM role_room_access_vault_reveal_requests
         WHERE project_id = $1
           AND secret_id = $2
           AND requested_by_user_id = $3
           AND status IN ('pending', 'approved')
         ORDER BY requested_at DESC
         LIMIT 1`,
        [projectId, secret.id, userId],
      );
      if ((existingRequestResult.rowCount ?? 0) > 0) {
        res.json({ request: buildRoleRoomAccessVaultRevealRequestResponse(existingRequestResult.rows[0] as RoleRoomAccessVaultRevealRequestRow) });
        return;
      }

      const requestReason = readStringValue(req.body?.requestReason);
      const expiresAt = readVaultTimestamp(req.body?.expiresAt) ?? new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
      const result = await pool.query(
        `INSERT INTO role_room_access_vault_reveal_requests (
          id, secret_id, project_id, platform, status, request_reason,
          requested_by_user_id, requested_by_role, expires_at, requested_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'pending', $5,
          $6, $7, $8, NOW(), NOW()
        )
        RETURNING *`,
        [
          crypto.randomUUID(),
          secret.id,
          projectId,
          platform,
          requestReason,
          userId,
          effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
          expiresAt,
        ],
      );

      await appendRoleRoomAccessVaultAuditEvent({
        req,
        projectId,
        secretId: secret.id,
        revealRequestId: String(result.rows[0]?.id ?? ''),
        platform,
        action: 'reveal_requested',
        actorUserId: userId,
        actorRole: effectiveRoleRecord?.role ?? null,
        metadata: {
          requestReason,
          revealPolicy: secret.reveal_policy ?? null,
          mfaMethod,
        },
      });

      res.status(201).json({ request: buildRoleRoomAccessVaultRevealRequestResponse(result.rows[0] as RoleRoomAccessVaultRevealRequestRow) });
    } catch (error) {
      console.error('Producer access vault reveal request error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette reveal-forespørsel' });
    }
  });

  router.post('/projects/:projectId/producer/access-vault/reveal-requests/:requestId/decision', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const requestId = req.params.requestId;
    const userId = getUserId(req);
    const decision = readStringValue(req.body?.decision);
    const approvalNotes = readStringValue(req.body?.approvalNotes);

    if (decision !== 'approve' && decision !== 'reject') {
      res.status(400).json({ error: 'decision må være approve eller reject' });
      return;
    }

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canApproveProducerAccessVaultReveal(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å beslutte reveal-forespørselen' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const requestResult = await pool.query(
        `SELECT *
         FROM role_room_access_vault_reveal_requests
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [requestId, projectId],
      );
      if (requestResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke reveal-forespørselen' });
        return;
      }

      const requestRow = requestResult.rows[0] as RoleRoomAccessVaultRevealRequestRow;
      if (String(requestRow.status ?? '').trim().toLowerCase() !== 'pending') {
        res.status(409).json({ error: 'Reveal-forespørselen er ikke lenger åpen.' });
        return;
      }

      const result = await pool.query(
        decision === 'approve'
          ? `UPDATE role_room_access_vault_reveal_requests
             SET status = 'approved',
                 approval_notes = $2,
                 approved_by_user_id = $3,
                 approved_by_role = $4,
                 approved_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`
          : `UPDATE role_room_access_vault_reveal_requests
             SET status = 'rejected',
                 approval_notes = $2,
                 approved_by_user_id = $3,
                 approved_by_role = $4,
                 rejected_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
        [
          requestId,
          approvalNotes,
          userId,
          effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : 'unknown'),
        ],
      );

      await appendRoleRoomAccessVaultAuditEvent({
        req,
        projectId,
        secretId: requestRow.secret_id,
        revealRequestId: requestId,
        platform: requestRow.platform,
        action: decision === 'approve' ? 'reveal_approved' : 'reveal_rejected',
        actorUserId: userId,
        actorRole: effectiveRoleRecord?.role ?? null,
        metadata: {
          approvalNotes,
        },
      });

      res.json({ request: buildRoleRoomAccessVaultRevealRequestResponse(result.rows[0] as RoleRoomAccessVaultRevealRequestRow) });
    } catch (error) {
      console.error('Producer access vault reveal decision error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere reveal-forespørselen' });
    }
  });

  router.post('/projects/:projectId/producer/access-vault/reveal-requests/:requestId/reveal', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!(await ensureProducerWorkflowTables())) {
      res.status(500).json({ error: 'Producer-tabeller er ikke tilgjengelige' });
      return;
    }

    const projectId = req.params.projectId;
    const requestId = req.params.requestId;
    const userId = getUserId(req);

    try {
      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canRequestProducerAccessVaultReveal(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å åpne secret' });
        return;
      }

      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const requestResult = await pool.query(
        `SELECT *
         FROM role_room_access_vault_reveal_requests
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [requestId, projectId],
      );
      if (requestResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke reveal-forespørselen' });
        return;
      }

      const requestRow = requestResult.rows[0] as RoleRoomAccessVaultRevealRequestRow;
      if (requestRow.requested_by_user_id !== userId && !requireScope(req, 'admin')) {
        res.status(403).json({ error: 'Reveal er kun tilgjengelig for den som ba om innsyn.' });
        return;
      }
      if (String(requestRow.status ?? '').trim().toLowerCase() !== 'approved') {
        res.status(409).json({ error: 'Reveal-forespørselen er ikke godkjent.' });
        return;
      }
      if (requestRow.expires_at && Date.parse(requestRow.expires_at) < Date.now()) {
        await pool.query(
          `UPDATE role_room_access_vault_reveal_requests
           SET status = 'expired',
               updated_at = NOW()
           WHERE id = $1`,
          [requestId],
        );
        res.status(410).json({ error: 'Reveal-forespørselen har utløpt. Be om nytt innsyn.' });
        return;
      }

      const secretResult = await pool.query(
        `SELECT *
         FROM role_room_access_vault_secrets
         WHERE id = $1 AND project_id = $2
         LIMIT 1`,
        [requestRow.secret_id, projectId],
      );
      if (secretResult.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke secret' });
        return;
      }

      const secretRow = secretResult.rows[0] as RoleRoomAccessVaultSecretRow;
      if (normalizeRoleRoomVaultRevealPolicy(secretRow.reveal_policy) === 'manual_only') {
        res.status(409).json({ error: 'Denne secret-en kan ikke vises direkte. Bruk manuell handoff.' });
        return;
      }

      const secretValue = decryptRoleRoomVaultSecret(secretRow.secret_encrypted);
      const username = decryptRoleRoomVaultSecret(secretRow.username_encrypted);
      const backupCode = decryptRoleRoomVaultSecret(secretRow.backup_code_encrypted);
      if (!secretValue && !username && !backupCode) {
        res.status(404).json({ error: 'Ingen lagret hemmelig verdi er tilgjengelig for reveal.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await pool.query(
        `UPDATE role_room_access_vault_reveal_requests
         SET status = 'revealed',
             revealed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );
      await pool.query(
        `UPDATE role_room_access_vault_secrets
         SET last_revealed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [secretRow.id],
      );

      await appendRoleRoomAccessVaultAuditEvent({
        req,
        projectId,
        secretId: secretRow.id,
        revealRequestId: requestId,
        platform: secretRow.platform,
        action: 'secret_revealed',
        actorUserId: userId,
        actorRole: effectiveRoleRecord?.role ?? null,
        metadata: {
          revealPolicy: secretRow.reveal_policy ?? null,
          oneTime: normalizeRoleRoomVaultRevealPolicy(secretRow.reveal_policy) === 'one_time',
        },
      });

      res.json({
        reveal: {
          secretId: secretRow.id,
          platform: secretRow.platform,
          label: readStringValue(secretRow.label),
          secretType: readStringValue(secretRow.secret_type),
          username,
          secretValue,
          backupCode,
          maskedReference: readStringValue(secretRow.masked_reference),
          revealedAt: nowIso,
        },
      });
    } catch (error) {
      console.error('Producer access vault reveal error:', error);
      res.status(500).json({ error: 'Kunne ikke åpne secret' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Casting Roles (character roles)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/casting-roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
        if (!requestEmail) {
          res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for talentroller' });
          return;
        }

        const assignments = await resolveRoleRoomTalentAssignmentsForEmail(requestEmail, {
          projectId: req.params.projectId,
          req,
        });
        const allowedRoleIds = new Set(assignments.flatMap((assignment) => assignment.roles.map((role) => role.id)));
        const result = await pool.query(
          'SELECT * FROM casting_roles WHERE project_id = $1 ORDER BY created_at',
          [req.params.projectId],
        );
        res.json(result.rows.filter((row) => allowedRoleIds.has(String(row.id))));
        return;
      }

      const result = await pool.query(
        'SELECT * FROM casting_roles WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente casting-roller' });
    }
  });

  router.post('/projects/:projectId/casting-roles', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, description, ageRange, gender, roleType, requirements } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_roles (id, project_id, name, description, age_range, gender, role_type, requirements)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, req.params.projectId, name, description ?? null, ageRange ?? null, gender ?? null, roleType ?? null, JSON.stringify(requirements ?? {})]
      );
      res.status(201).json({ id, name });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke opprette casting-rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Candidates
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/candidates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
        if (!requestEmail) {
          res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for talentkandidater' });
          return;
        }

        const rows = await getRoleRoomTalentScopedCandidates(req.params.projectId, requestEmail);
        res.json(rows);
        return;
      }

      const result = await pool.query(
        'SELECT * FROM casting_candidates WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente kandidater' });
    }
  });

  router.post('/projects/:projectId/candidates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { name, email, phone, agency, notes } = req.body as Record<string, unknown>;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_candidates (id, project_id, name, email, phone, agency, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, req.params.projectId, name, email ?? null, phone ?? null, agency ?? null, notes ?? null]
      );
      res.status(201).json({ id, name });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke legge til kandidat' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Crew Members
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/crew', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        res.status(403).json({ error: 'Talentportalen har ikke tilgang til crewlisten' });
        return;
      }

      const result = await pool.query(
        'SELECT * FROM casting_crew WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente crew' });
    }
  });

  router.post('/projects/:projectId/crew', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const { name, role, email, phone, department, rate } = body;
    // Klient kan opt-out via { sendEmail: false } — default ER å sende.
    const shouldSendEmail = body.sendEmail !== false;
    const id = makeId();
    try {
      await pool.query(
        `INSERT INTO casting_crew (id, project_id, name, role, email, phone, department, rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, req.params.projectId, name, role, email ?? null, phone ?? null, department ?? null, rate ?? null]
      );

      // ── Send invitasjons-email til crew-medlem (best-effort) ──
      // Krever email + GMAIL_USER + GMAIL_APP_PASSWORD i Render env.
      // Logger feil men feiler IKKE crew-create.
      let emailStatus: { sent: boolean; reason?: string } = { sent: false, reason: 'no_email' };
      const recipientEmail = readStringValue(email);
      if (shouldSendEmail && recipientEmail) {
        try {
          // Hent prosjekt-navn for invitasjons-mail
          const projRes = await pool.query<{ name: string }>(
            'SELECT name FROM casting_projects WHERE id = $1 LIMIT 1',
            [req.params.projectId],
          );
          const projectName = projRes.rows[0]?.name ?? req.params.projectId;
          const proto = (req.headers['x-forwarded-proto'] as string | undefined)
            ?? (req.protocol === 'http' ? 'http' : 'https');
          const host = (req.headers['x-forwarded-host'] as string | undefined)
            ?? req.headers.host
            ?? 'creatorhubn.com';
          const inviteUrl = `${proto}://${host}/role-room/projects/${encodeURIComponent(req.params.projectId)}`;
          const requestUser = getOptionalRequestUser(req);
          const result = await sendRoleRoomTeamMemberInviteEmail({
            recipientEmail,
            recipientName: readStringValue(name) ?? null,
            role: readStringValue(role) ?? readStringValue(department) ?? 'crew',
            projectName,
            inviterName: requestUser?.email ?? null,
            inviterEmail: requestUser?.email ?? null,
            inviteUrl,
          });
          emailStatus = { sent: result.sent, reason: result.reason };
          console.log(
            `Crew invite email for ${id} (${recipientEmail}): ${result.sent ? 'sent' : 'skipped'}${
              result.reason ? ` (${result.reason})` : ''
            }`,
          );
        } catch (err) {
          console.warn('Crew invite email failed (non-fatal):', err);
          emailStatus = { sent: false, reason: String(err instanceof Error ? err.message : err) };
        }
      }
      res.status(201).json({ id, name, emailStatus });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke legge til crew-medlem' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Locations (compat routes expected by role-room frontend)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/locations', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (isTalentScopedRequest(req)) {
        res.status(403).json({ error: 'Talentportalen har ikke tilgang til lokasjoner' });
        return;
      }

      const result = await pool.query(
        'SELECT * FROM casting_locations WHERE project_id = $1 ORDER BY name',
        [req.params.projectId]
      );
      res.json({ locations: result.rows });
    } catch (err) {
      console.error('Fetch locations error:', err);
      res.status(500).json({ error: 'Kunne ikke hente lokasjoner' });
    }
  });

  router.post('/locations', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const projectId = body.project_id as string | undefined;
    const name = body.name as string | undefined;
    if (!projectId || !name) {
      res.status(400).json({ error: 'project_id og name er påkrevd' });
      return;
    }

    const id = makeId();
    const locationData = (body.location_data as Record<string, unknown> | undefined) ?? {};
    const coordinates = (locationData.coordinates as Record<string, unknown> | undefined)
      ?? (body.coordinates as Record<string, unknown> | undefined)
      ?? null;
    const contactInfo = (locationData.contact_info as Record<string, unknown> | undefined)
      ?? (body.contact_info as Record<string, unknown> | undefined)
      ?? {};
    const photos = Array.isArray(locationData.photos)
      ? locationData.photos
      : Array.isArray(body.photos)
        ? body.photos
        : [];

    try {
      const result = await pool.query(
        `INSERT INTO casting_locations
          (id, project_id, name, address, coordinates, type, contact_info, access_notes, photos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          projectId,
          name,
          (body.address as string | undefined) ?? (locationData.address as string | undefined) ?? null,
          coordinates ? JSON.stringify(coordinates) : null,
          (body.type as string | undefined) ?? (locationData.type as string | undefined) ?? null,
          JSON.stringify(contactInfo),
          (locationData.access_notes as string | undefined) ?? (body.access_notes as string | undefined) ?? null,
          JSON.stringify(photos),
        ]
      );
      res.status(201).json({ location: result.rows[0] });
    } catch (err) {
      console.error('Create location error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette lokasjon' });
    }
  });

  router.delete('/locations/:locationId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    try {
      await pool.query('DELETE FROM casting_locations WHERE id = $1', [req.params.locationId]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete location error:', err);
      res.status(500).json({ error: 'Kunne ikke slette lokasjon' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Schedules – full CRUD + list with filter/sort/counts
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /projects/:projectId/schedules
   *
   * Query params (all optional):
   *   status      – scheduled | completed | cancelled | pool
   *   roleId      – filter by role
   *   candidateId – filter by candidate
   *   dateFrom    – YYYY-MM-DD
   *   dateTo      – YYYY-MM-DD
   *   search      – full-text against candidate name, role name, location, notes
   *   sort        – date | candidate | role | status   (default: date)
   *   dir         – asc | desc                         (default: asc)
   *   limit       – integer (default: 200)
   *   offset      – integer (default: 0)
   *   userId      – if provided, marks favorite=true on rows starred by this user
   *
   * Returns:
   *   { items[], totalCount, counts{ total, scheduled, completed, cancelled, pool, today, favorites } }
   */
  router.get('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const {
      status, roleId, candidateId, dateFrom, dateTo, search,
      sort = 'date', dir = 'asc', limit = '200', offset = '0',
      userId,
    } = req.query as Record<string, string | undefined>;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      if (isTalentScopedRequest(req)) {
        const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
        if (!requestEmail) {
          res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for audition-oversikten' });
          return;
        }

        const scopedCandidates = await getRoleRoomTalentScopedCandidates(projectId, requestEmail);
        const scopedCandidateIds = scopedCandidates.map((row) => row.id);
        if (scopedCandidateIds.length === 0) {
          res.json({
            items: [],
            totalCount: 0,
            counts: {
              total: 0,
              scheduled: 0,
              completed: 0,
              cancelled: 0,
              pool: 0,
              today: 0,
              favorites: 0,
            },
          });
          return;
        }

        const result = await pool.query(
          `SELECT
             cs.id, cs.project_id, cs.candidate_id, cs.role_id, cs.scene_id,
             cs.location_id, cs.date, cs.start_time AS time, cs.end_time,
             cs.type, cs.status, cs.notes, cs.location, cs.created_at, cs.updated_at,
             COALESCE(cc.name, 'Ukjent kandidat') AS candidate_name,
             COALESCE(cr.name, 'Ukjent rolle')    AS role_name
           FROM casting_schedules cs
           LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
           LEFT JOIN casting_roles cr ON cr.id = cs.role_id
           WHERE cs.project_id = $1
             AND cs.candidate_id = ANY($2::text[])
           ORDER BY cs.date ASC NULLS LAST, cs.start_time ASC NULLS LAST, cs.created_at DESC`,
          [projectId, scopedCandidateIds],
        );

        const searchTerm = typeof search === 'string' && search.trim().length > 0
          ? search.trim().toLowerCase()
          : null;
        const filteredItems = result.rows.filter((row) => {
          if (status === 'pool' && row.date !== null) return false;
          if (status && status !== 'pool' && String(row.status || '') !== status) return false;
          if (roleId && String(row.role_id || '') !== roleId) return false;
          if (candidateId && String(row.candidate_id || '') !== candidateId) return false;
          if (dateFrom && String(row.date || '') < dateFrom) return false;
          if (dateTo && String(row.date || '') > dateTo) return false;
          if (searchTerm) {
            const haystack = [
              row.candidate_name,
              row.role_name,
              row.location,
              row.notes,
            ]
              .map((value) => String(value || '').toLowerCase())
              .join(' ');
            if (!haystack.includes(searchTerm)) {
              return false;
            }
          }
          return true;
        });

        const lim = Math.min(parseInt(limit, 10) || 200, 500);
        const off = parseInt(offset, 10) || 0;
        const pagedItems = filteredItems.slice(off, off + lim);

        res.json({
          items: pagedItems,
          totalCount: filteredItems.length,
          counts: {
            total: filteredItems.length,
            scheduled: filteredItems.filter((row) => String(row.status || '') === 'scheduled').length,
            completed: filteredItems.filter((row) => String(row.status || '') === 'completed').length,
            cancelled: filteredItems.filter((row) => String(row.status || '') === 'cancelled').length,
            pool: filteredItems.filter((row) => row.date === null).length,
            today: filteredItems.filter((row) => String(row.date || '') === today && String(row.status || '') === 'scheduled').length,
            favorites: 0,
          },
        });
        return;
      }

      // ── Build dynamic WHERE conditions ──────────────────────
      const conditions: string[] = ['cs.project_id = $1'];
      const params: unknown[] = [projectId];
      let p = 2;

      if (status === 'pool') {
        conditions.push('cs.date IS NULL');
      } else if (status) {
        conditions.push(`cs.status = $${p++}`);
        params.push(status);
      }

      if (roleId) { conditions.push(`cs.role_id = $${p++}`); params.push(roleId); }
      if (candidateId) { conditions.push(`cs.candidate_id = $${p++}`); params.push(candidateId); }
      if (dateFrom) { conditions.push(`cs.date >= $${p++}`); params.push(dateFrom); }
      if (dateTo)   { conditions.push(`cs.date <= $${p++}`); params.push(dateTo); }

      if (search) {
        const like = `%${search.toLowerCase()}%`;
        conditions.push(
          `(LOWER(COALESCE(cc.name,'')) LIKE $${p} OR LOWER(COALESCE(cr.name,'')) LIKE $${p} ` +
          `OR LOWER(COALESCE(cs.location,'')) LIKE $${p} OR LOWER(COALESCE(cs.notes,'')) LIKE $${p})`
        );
        params.push(like);
        p++;
      }

      const where = conditions.join(' AND ');

      // ── Sort column mapping ─────────────────────────────────
      const sortMap: Record<string, string> = {
        date:      "cs.date, cs.start_time",
        candidate: "cc.name",
        role:      "cr.name",
        status:    "cs.status",
      };
      const orderBy = sortMap[sort] ?? 'cs.date, cs.start_time';
      const direction = dir === 'desc' ? 'DESC' : 'ASC';

      // ── Pagination params ───────────────────────────────────
      const lim = Math.min(parseInt(limit) || 200, 500);
      const off = parseInt(offset) || 0;

      // ── Main list query (denormalized names + favorite flag) ─
      const favJoin = userId
        ? `LEFT JOIN casting_schedule_favorites csf
             ON csf.schedule_id = cs.id AND csf.user_id = $${p++}`
        : '';
      if (userId) params.push(userId);

      const favSelect = userId ? ', (csf.id IS NOT NULL) AS favorite' : ', false AS favorite';

      const listSql = `
        SELECT
          cs.id, cs.project_id, cs.candidate_id, cs.role_id, cs.scene_id,
          cs.location_id, cs.date, cs.start_time AS time, cs.end_time,
          cs.type, cs.status, cs.notes, cs.location, cs.created_at, cs.updated_at,
          COALESCE(cc.name, 'Ukjent kandidat') AS candidate_name,
          COALESCE(cr.name, 'Ukjent rolle')    AS role_name
          ${favSelect}
        FROM casting_schedules cs
        LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
        LEFT JOIN casting_roles      cr ON cr.id = cs.role_id
        ${favJoin}
        WHERE ${where}
        ORDER BY ${orderBy} ${direction} NULLS LAST
        LIMIT $${p++} OFFSET $${p++}
      `;
      params.push(lim, off);

      // ── Total count (same filters, no paging) ───────────────
      const countSql = `
        SELECT COUNT(*) AS total
        FROM casting_schedules cs
        LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
        LEFT JOIN casting_roles      cr ON cr.id = cs.role_id
        WHERE ${where}
      `;
      // params for count = everything except the last two (limit/offset)
      const countParams = params.slice(0, userId ? -3 : -2);
      // re-add userId param for the fav join in count if present – actually
      // for the count query we don't have the fav join, so strip userId too
      const countParamsClean = countParams.filter((_, i) => {
        // The userId param was inserted at position p-3 (before lim/off)
        // easier: just rebuild without paging and without favJoin
        return true;
      });

      // Rebuild count params without fav join param and without limit/offset
      const coreParams: unknown[] = [projectId];
      let cp = 2;
      if (status === 'pool') { /* no extra param */ }
      else if (status) { coreParams.push(status); cp++; }
      if (roleId)      { coreParams.push(roleId); cp++; }
      if (candidateId) { coreParams.push(candidateId); cp++; }
      if (dateFrom)    { coreParams.push(dateFrom); cp++; }
      if (dateTo)      { coreParams.push(dateTo); cp++; }
      if (search)      { coreParams.push(`%${search.toLowerCase()}%`); cp++; }
      void countSql; void countParamsClean; void cp;

      // ── Aggregate counts (separate sub-queries are fast via indexes) ─
      const aggSql = `
        SELECT
          COUNT(*)                                                      AS total,
          COUNT(*) FILTER (WHERE status = 'scheduled')                 AS scheduled,
          COUNT(*) FILTER (WHERE status = 'completed')                 AS completed,
          COUNT(*) FILTER (WHERE status = 'cancelled')                 AS cancelled,
          COUNT(*) FILTER (WHERE date IS NULL)                         AS pool,
          COUNT(*) FILTER (WHERE date = $2 AND status = 'scheduled')   AS today
        FROM casting_schedules
        WHERE project_id = $1
      `;

      // favorites count (only if userId given)
      const favCountSql = userId
        ? `SELECT COUNT(*) AS favorites FROM casting_schedule_favorites WHERE user_id = $1 AND project_id = $2`
        : null;

      const [listResult, aggResult, favCountResult] = await Promise.all([
        pool.query(listSql, params),
        pool.query(aggSql, [projectId, today]),
        favCountSql ? pool.query(favCountSql, [userId, projectId]) : Promise.resolve(null),
      ]);

      const agg = aggResult.rows[0];

      res.json({
        items: listResult.rows,
        totalCount: parseInt(String(agg.total), 10),
        counts: {
          total:     parseInt(String(agg.total),     10),
          scheduled: parseInt(String(agg.scheduled), 10),
          completed: parseInt(String(agg.completed), 10),
          cancelled: parseInt(String(agg.cancelled), 10),
          pool:      parseInt(String(agg.pool),      10),
          today:     parseInt(String(agg.today),     10),
          favorites: favCountResult ? parseInt(String(favCountResult.rows[0].favorites), 10) : 0,
        },
      });
    } catch (err) {
      console.error('GET schedules error:', err);
      res.status(500).json({ error: 'Kunne ikke hente tidsplan' });
    }
  });

  /**
   * POST /projects/:projectId/schedules – create a new slot
   */
  router.post('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const {
      candidateId, roleId, sceneId, locationId, date, startTime, endTime,
      type, notes, location, status = 'scheduled',
    } = req.body as Record<string, unknown>;
    const id = (req.body as Record<string, string>).id || makeId();
    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO casting_schedules
           (id, project_id, candidate_id, role_id, scene_id, location_id,
            date, start_time, end_time, type, notes, location, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [id, req.params.projectId,
         candidateId ?? null, roleId ?? null, sceneId ?? null, locationId ?? null,
         date ?? null, startTime ?? null, endTime ?? null,
         type ?? null, notes ?? null, location ?? null, status]
      );
      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      console.error('POST schedule error:', err);
      res.status(500).json({ error: 'Kunne ikke opprette tidsplan' });
    }
  });

  /**
   * PUT /projects/:projectId/schedules/:scheduleId – full update
   */
  router.put('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const {
      candidateId, roleId, sceneId, locationId, date, startTime, endTime,
      type, notes, location, status,
    } = req.body as Record<string, unknown>;
    try {
      const result = await pool.query(
        `UPDATE casting_schedules SET
           candidate_id = $1, role_id = $2, scene_id = $3, location_id = $4,
           date = $5, start_time = $6, end_time = $7, type = $8,
           notes = $9, location = $10, status = $11,
           updated_at = NOW()
         WHERE id = $12 AND project_id = $13`,
        [candidateId ?? null, roleId ?? null, sceneId ?? null, locationId ?? null,
         date ?? null, startTime ?? null, endTime ?? null, type ?? null,
         notes ?? null, location ?? null, status ?? 'scheduled',
         req.params.scheduleId, req.params.projectId]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('PUT schedule error:', err);
      res.status(500).json({ error: 'Kunne ikke oppdatere tidsplan' });
    }
  });

  /**
   * PATCH /projects/:projectId/schedules/:scheduleId – partial update (status only, etc.)
   */
  router.patch('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const allowed = ['status', 'notes', 'date', 'start_time', 'end_time', 'location', 'candidate_id', 'role_id'];
    const setClause = Object.keys(body)
      .filter(k => allowed.includes(k))
      .map((k, i) => `${k} = $${i + 3}`)
      .join(', ');
    const values = Object.entries(body)
      .filter(([k]) => allowed.includes(k))
      .map(([, v]) => v);
    if (!setClause) { res.status(400).json({ error: 'Ingen gyldige felt' }); return; }
    try {
      await pool.query(
        `UPDATE casting_schedules SET ${setClause}, updated_at = NOW() WHERE id = $1 AND project_id = $2`,
        [req.params.scheduleId, req.params.projectId, ...values]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke oppdatere' });
    }
  });

  /**
   * DELETE /projects/:projectId/schedules/:scheduleId – delete one
   */
  router.delete('/projects/:projectId/schedules/:scheduleId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    try {
      const result = await pool.query(
        'DELETE FROM casting_schedules WHERE id = $1 AND project_id = $2',
        [req.params.scheduleId, req.params.projectId]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette' });
    }
  });

  /**
   * DELETE /projects/:projectId/schedules – bulk delete
   * Body: { ids: string[] }
   */
  router.delete('/projects/:projectId/schedules', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids[] påkrevd' });
      return;
    }
    try {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      const result = await pool.query(
        `DELETE FROM casting_schedules WHERE project_id = $1 AND id IN (${placeholders})`,
        [req.params.projectId, ...ids]
      );
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (err) {
      res.status(500).json({ error: 'Bulk-sletting feilet' });
    }
  });

  /**
   * POST /projects/:projectId/schedules/:scheduleId/favorite
   * Body: { userId: string, favorite: boolean }
   */
  router.post('/projects/:projectId/schedules/:scheduleId/favorite', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    const { userId, favorite } = req.body as { userId?: string; favorite?: boolean };
    if (!userId) { res.status(400).json({ error: 'userId påkrevd' }); return; }
    try {
      if (favorite) {
        await pool.query(
          `INSERT INTO casting_schedule_favorites (user_id, project_id, schedule_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, schedule_id) DO NOTHING`,
          [userId, req.params.projectId, req.params.scheduleId]
        );
      } else {
        await pool.query(
          'DELETE FROM casting_schedule_favorites WHERE user_id = $1 AND schedule_id = $2',
          [userId, req.params.scheduleId]
        );
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Favoritt-oppdatering feilet' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Calendar Events (Role Room planner compatibility API)
  // ═══════════════════════════════════════════════════════════

  router.get('/projects/:projectId/calendar-events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (isTalentScopedRequest(req)) {
      res.status(403).json({ success: false, error: 'Talentportalen har ikke tilgang til produksjonskalenderen' });
      return;
    }
    const hasProjectAccess = await ensureProjectAccess(projectId);
    if (!hasProjectAccess) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT
          id,
          project_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          location_id,
          all_day,
          candidate_ids,
          crew_ids,
          equipment_ids,
          shot_list_ids,
          notes,
          status
         FROM role_room_calendar_events
         WHERE project_id = $1
         ORDER BY start_time ASC, created_at ASC`,
        [projectId],
      );
      const events = result.rows.map((row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        title: String(row.title),
        description: row.description ?? undefined,
        event_type: String(row.event_type || 'general'),
        start_time: row.start_time instanceof Date ? row.start_time.toISOString() : String(row.start_time),
        end_time: row.end_time instanceof Date ? row.end_time.toISOString() : (row.end_time ? String(row.end_time) : undefined),
        location_id: row.location_id ?? undefined,
        all_day: row.all_day === true,
        candidate_ids: toStringArray(row.candidate_ids),
        crew_ids: toStringArray(row.crew_ids),
        equipment_ids: toStringArray(row.equipment_ids),
        shot_list_ids: toStringArray(row.shot_list_ids),
        notes: row.notes ?? undefined,
        status: row.status ?? 'scheduled',
      }));
      res.json({ events });
    } catch (error) {
      console.error('GET calendar events error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke hente kalenderhendelser' });
    }
  });

  router.post('/calendar-events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const projectId = typeof body.projectId === 'string'
      ? body.projectId
      : typeof body.project_id === 'string'
        ? body.project_id
        : '';
    if (!projectId || !(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const startTimeRaw = typeof body.startTime === 'string'
      ? body.startTime
      : typeof body.start_time === 'string'
        ? body.start_time
        : '';
    const endTimeRaw = typeof body.endTime === 'string'
      ? body.endTime
      : typeof body.end_time === 'string'
        ? body.end_time
        : '';
    const startTime = Date.parse(startTimeRaw);
    const endTime = endTimeRaw ? Date.parse(endTimeRaw) : NaN;
    if (!title || !Number.isFinite(startTime)) {
      res.status(400).json({ success: false, error: 'Tittel og gyldig starttid er påkrevd' });
      return;
    }
    if (endTimeRaw && !Number.isFinite(endTime)) {
      res.status(400).json({ success: false, error: 'Sluttid er ugyldig' });
      return;
    }

    const eventId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : makeId();
    const eventType = typeof body.eventType === 'string'
      ? body.eventType
      : typeof body.event_type === 'string'
        ? body.event_type
        : 'general';
    const actorId = getUserId(req);

    try {
      await pool.query(
        `INSERT INTO role_room_calendar_events (
          id,
          project_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          location_id,
          all_day,
          candidate_ids,
          crew_ids,
          equipment_ids,
          shot_list_ids,
          notes,
          status,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16
        )`,
        [
          eventId,
          projectId,
          title,
          typeof body.description === 'string' ? body.description : null,
          eventType,
          new Date(startTime).toISOString(),
          Number.isFinite(endTime) ? new Date(endTime).toISOString() : null,
          typeof body.locationId === 'string'
            ? body.locationId
            : typeof body.location_id === 'string'
              ? body.location_id
              : null,
          body.allDay === true || body.all_day === true,
          JSON.stringify(toStringArray(body.candidateIds ?? body.candidate_ids)),
          JSON.stringify(toStringArray(body.crewIds ?? body.crew_ids)),
          JSON.stringify(toStringArray(body.equipmentIds ?? body.equipment_ids)),
          JSON.stringify(toStringArray(body.shotListIds ?? body.shot_list_ids)),
          typeof body.notes === 'string' ? body.notes : null,
          typeof body.status === 'string' ? body.status : 'scheduled',
          actorId,
        ],
      );
      res.status(201).json({ eventId });
    } catch (error) {
      console.error('POST calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke opprette kalenderhendelse' });
    }
  });

  router.put('/calendar-events/:eventId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }

    const { eventId } = req.params;
    const body = req.body as Record<string, unknown>;

    try {
      const existing = await pool.query(
        `SELECT project_id FROM role_room_calendar_events WHERE id = $1 LIMIT 1`,
        [eventId],
      );
      if ((existing.rowCount ?? 0) === 0) {
        res.status(404).json({ success: false, error: 'Kalenderhendelse ikke funnet' });
        return;
      }
      const projectId = String(existing.rows[0].project_id);
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
        return;
      }

      const updates: string[] = [];
      const values: unknown[] = [eventId];

      const setField = (column: string, value: unknown): void => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };

      if (typeof body.title === 'string') setField('title', body.title.trim());
      if ('description' in body) setField('description', typeof body.description === 'string' ? body.description : null);
      if (typeof body.eventType === 'string') setField('event_type', body.eventType);
      if (typeof body.event_type === 'string') setField('event_type', body.event_type);

      if (typeof body.startTime === 'string' || typeof body.start_time === 'string') {
        const raw = typeof body.startTime === 'string' ? body.startTime : body.start_time as string;
        const parsed = Date.parse(raw);
        if (!Number.isFinite(parsed)) {
          res.status(400).json({ success: false, error: 'Starttid er ugyldig' });
          return;
        }
        setField('start_time', new Date(parsed).toISOString());
      }

      if ('endTime' in body || 'end_time' in body) {
        const raw = typeof body.endTime === 'string'
          ? body.endTime
          : typeof body.end_time === 'string'
            ? body.end_time
            : '';
        if (!raw) {
          setField('end_time', null);
        } else {
          const parsed = Date.parse(raw);
          if (!Number.isFinite(parsed)) {
            res.status(400).json({ success: false, error: 'Sluttid er ugyldig' });
            return;
          }
          setField('end_time', new Date(parsed).toISOString());
        }
      }

      if ('locationId' in body || 'location_id' in body) {
        const locationId = typeof body.locationId === 'string'
          ? body.locationId
          : typeof body.location_id === 'string'
            ? body.location_id
            : null;
        setField('location_id', locationId);
      }
      if ('allDay' in body || 'all_day' in body) {
        setField('all_day', body.allDay === true || body.all_day === true);
      }
      if ('candidateIds' in body || 'candidate_ids' in body) {
        setField('candidate_ids', JSON.stringify(toStringArray(body.candidateIds ?? body.candidate_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('crewIds' in body || 'crew_ids' in body) {
        setField('crew_ids', JSON.stringify(toStringArray(body.crewIds ?? body.crew_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('equipmentIds' in body || 'equipment_ids' in body) {
        setField('equipment_ids', JSON.stringify(toStringArray(body.equipmentIds ?? body.equipment_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('shotListIds' in body || 'shot_list_ids' in body) {
        setField('shot_list_ids', JSON.stringify(toStringArray(body.shotListIds ?? body.shot_list_ids)));
        updates[updates.length - 1] += '::jsonb';
      }
      if ('notes' in body) {
        setField('notes', typeof body.notes === 'string' ? body.notes : null);
      }
      if ('status' in body) {
        setField('status', typeof body.status === 'string' ? body.status : 'scheduled');
      }

      if (updates.length === 0) {
        res.json({ ok: true });
        return;
      }

      await pool.query(
        `UPDATE role_room_calendar_events
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1`,
        values,
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('PUT calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke oppdatere kalenderhendelse' });
    }
  });

  router.delete('/calendar-events/:eventId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }
    if (!(await ensureRoleRoomCalendarEventsTable())) {
      res.status(500).json({ success: false, error: 'Kalenderlager ikke tilgjengelig' });
      return;
    }
    const { eventId } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_calendar_events WHERE id = $1`,
        [eventId],
      );
      if ((result.rowCount ?? 0) === 0) {
        res.status(404).json({ success: false, error: 'Kalenderhendelse ikke funnet' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE calendar event error:', error);
      res.status(500).json({ success: false, error: 'Kunne ikke slette kalenderhendelse' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Project Sync (Creatorhub ↔ Role Room)
  // ═══════════════════════════════════════════════════════════

  router.post('/sync/project', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    if (!requireScope(req, 'write')) {
      res.status(403).json({ error: 'Skrive-tilgang kreves' });
      return;
    }

    const payload = req.body as ProjectSyncPayload;
    const { creatorhubProjectId, projectName, projectType, description, eventDate, budget, userId } = payload;

    if (!creatorhubProjectId || !projectName) {
      res.status(400).json({ error: 'creatorhubProjectId og projectName er påkrevd' });
      return;
    }

    try {
      // Check if a casting project already linked to this Creatorhub project
      const existing = await pool.query<CastingProjectRow>(
        'SELECT * FROM casting_projects WHERE creatorhub_project_id = $1',
        [creatorhubProjectId]
      );

      let castingProjectId: string;

      if (existing.rowCount && existing.rowCount > 0) {
        // Update existing
        castingProjectId = existing.rows[0].id;
        await pool.query(
          `UPDATE casting_projects SET name = $1, description = $2, project_type = $3, updated_at = NOW()
           WHERE id = $4`,
          [projectName, description ?? null, projectType ?? null, castingProjectId]
        );
      } else {
        // Create new casting project linked to Creatorhub
        castingProjectId = makeId();
        await pool.query(
          `INSERT INTO casting_projects (id, name, description, status, created_by, project_type, start_date, budget, creatorhub_project_id)
           VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)`,
          [castingProjectId, projectName, description ?? null, userId, projectType ?? null, eventDate ?? null, budget ?? null, creatorhubProjectId]
        );

        // Auto-assign creator as director
        await pool.query(
          `INSERT INTO casting_user_roles (id, project_id, user_id, role, permissions)
           VALUES ($1, $2, $3, 'director', $4)
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [makeId(), castingProjectId, userId, JSON.stringify(buildProjectRolePermissions('director'))]
        );
      }

      // Log the sync
      await pool.query(
        `INSERT INTO casting_project_sync (creatorhub_project_id, casting_project_id, sync_direction, sync_status, sync_data, synced_at)
         VALUES ($1, $2, $3, 'completed', $4, NOW())`,
        [creatorhubProjectId, castingProjectId, 'creatorhub_to_roleroom' as SyncDirection, JSON.stringify({ projectName, projectType, userId })]
      );

      res.json({
        success: true,
        castingProjectId,
        creatorhubProjectId,
        isNew: !(existing.rowCount && existing.rowCount > 0),
        message: 'Prosjektsynkronisering fullført',
      });
    } catch (err) {
      console.error('Project sync error:', err);
      res.status(500).json({ error: 'Synkronisering feilet' });
    }
  });

  router.get('/sync/status/:creatorhubProjectId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT * FROM casting_project_sync 
         WHERE creatorhub_project_id = $1 
         ORDER BY created_at DESC LIMIT 10`,
        [req.params.creatorhubProjectId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente synkstatus' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Onboarding Role Registration
  // ═══════════════════════════════════════════════════════════

  router.post('/onboarding/register-role', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { userId, email, profession, role } = req.body as {
      userId: string;
      email?: string;
      profession: string;
      role?: string;
    };

    if (!userId || !profession) {
      res.status(400).json({ error: 'userId og profession er påkrevd' });
      return;
    }

    // Map Creatorhub profession to Role Room user role
    const roleMapping: Record<string, string> = {
      photographer: 'camera_team',
      videographer: 'camera_team',
      music_producer: 'producer',
      vendor: 'agency',
      enterprise: 'production_manager',
      admin: 'director',
    };

    const mappedRole = role ?? roleMapping[profession] ?? 'reader';

    try {
      // Store the user's role mapping for future project assignments
      await pool.query(
        `INSERT INTO casting_user_roles (id, project_id, user_id, email, role, permissions, added_by)
         VALUES ($1, '__global__', $2, $3, $4, $5, 'onboarding')
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $4, permissions = $5, email = $3, updated_at = NOW()`,
        [makeId(), userId, email ?? null, mappedRole, JSON.stringify(buildProjectRolePermissions(mappedRole))]
      );

      res.json({
        success: true,
        userId,
        roleRoomRole: mappedRole,
        profession,
        message: `Rolle '${mappedRole}' registrert i Role Room`,
      });
    } catch (err) {
      console.error('Onboarding role registration error:', err);
      res.status(500).json({ error: 'Kunne ikke registrere rolle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Marketplace Installation
  // ═══════════════════════════════════════════════════════════

  router.post('/marketplace/install', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { appId } = req.body as { appId: string };

    if (!appId) {
      res.status(400).json({ error: 'appId er påkrevd' });
      return;
    }

    try {
      await pool.query(
        `INSERT INTO marketplace_installations (user_id, app_id, is_active, settings)
         VALUES ($1, $2, TRUE, '{}')
         ON CONFLICT (user_id, app_id) DO UPDATE SET is_active = TRUE, installed_at = NOW()`,
        [userId, appId]
      );
      res.json({ success: true, appId, installed: true });
    } catch (err) {
      res.status(500).json({ error: 'Installasjon feilet' });
    }
  });

  router.get('/marketplace/installed', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const result = await pool.query(
        'SELECT * FROM marketplace_installations WHERE user_id = $1 AND is_active = TRUE',
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente installasjoner' });
    }
  });

  router.delete('/marketplace/uninstall/:appId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      await pool.query(
        'UPDATE marketplace_installations SET is_active = FALSE WHERE user_id = $1 AND app_id = $2',
        [userId, req.params.appId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Avinstallering feilet' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Public Stats — no auth, used on landing page stats bar
  // ═══════════════════════════════════════════════════════════

  const ROLE_ROOM_NON_LIVE_PROJECT_NAME_PATTERN = '(demo|test|verification|null|playwright|holy crust|invite test|storyboard test|subtabproject|ui-to-api|producer demo|content producer demo|troll project)';
  const ROLE_ROOM_NON_LIVE_PROJECT_ID_PATTERN = '(demo|test|verification|invite-test|holy-crust|troll-project|producer-demo|content-producer-demo|null)';
  const ROLE_ROOM_NON_LIVE_CREATOR_PATTERN = '^(e2e-test-user|dev-local-user|producer-verification|phase2-producer-)';

  const getRoleRoomStatsSummary = async () => {
    // Live-projects definert som rader som IKKE matcher test-/demo-mønstre
    const livePatternArgs = [
      ROLE_ROOM_NON_LIVE_PROJECT_NAME_PATTERN,
      ROLE_ROOM_NON_LIVE_PROJECT_ID_PATTERN,
      ROLE_ROOM_NON_LIVE_CREATOR_PATTERN,
    ];
    const liveProjectsCTE = `WITH live_projects AS (
      SELECT id
      FROM casting_projects
      WHERE COALESCE(name, '') !~* $1
        AND COALESCE(id, '') !~* $2
        AND COALESCE(created_by, '') <> ''
        AND COALESCE(created_by, '') !~* $3
    )`;

    // Helper for fallback ved query-feil (manglende tabell, syntax, etc.)
    const safeCount = async (sql: string): Promise<number> => {
      try {
        const r = await pool.query(sql, livePatternArgs);
        return parseInt(r.rows[0]?.n ?? '0', 10);
      } catch {
        return 0;
      }
    };

    const [kreative, produksjoner, rollerBesatt, kandidater, auditioner, crew, lokasjoner] = await Promise.all([
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(DISTINCT COALESCE(NULLIF(cur.email, ''), NULLIF(cur.user_id::text, ''))) AS n
         FROM casting_user_roles cur
         INNER JOIN live_projects lp ON lp.id = cur.project_id
         WHERE COALESCE(cur.role, '') <> 'admin'`),
      safeCount(`SELECT COUNT(*) AS n
         FROM casting_projects
         WHERE COALESCE(name, '') !~* $1
           AND COALESCE(id, '') !~* $2
           AND COALESCE(created_by, '') <> ''
           AND COALESCE(created_by, '') !~* $3`),
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(*) AS n
         FROM casting_roles
         INNER JOIN live_projects lp ON lp.id = casting_roles.project_id
         WHERE assigned_candidate_id IS NOT NULL
            OR LOWER(COALESCE(status, '')) IN ('filled', 'cast', 'booked', 'assigned')`),
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(*) AS n
         FROM casting_candidates
         INNER JOIN live_projects lp ON lp.id = casting_candidates.project_id`),
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(*) AS n
         FROM schedules
         INNER JOIN live_projects lp ON lp.id = schedules.project_id
         WHERE LOWER(COALESCE(schedules.status, '')) IN ('confirmed', 'completed')`),
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(*) AS n
         FROM crew
         INNER JOIN live_projects lp ON lp.id = crew.project_id`),
      safeCount(`${liveProjectsCTE}
         SELECT COUNT(*) AS n
         FROM locations
         INNER JOIN live_projects lp ON lp.id = locations.project_id`),
    ]);

    return { kreative, produksjoner, rollerBesatt, kandidater, auditioner, crew, lokasjoner };
  };

  router.get('/public/stats', async (_req: Request, res: Response) => {
    try {
      res.json(await getRoleRoomStatsSummary());
    } catch (err) {
      console.error('Role Room public stats error:', err);
      // Return sensible zeros on DB error — UI shows DEFAULT_STATS as fallback
      res.json({ kreative: 0, produksjoner: 0, rollerBesatt: 0 });
    }
  });

  router.get('/public/testimonials', async (_req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomPublicProofTables())) {
        res.json([]);
        return;
      }

      const result = await pool.query<RoleRoomPublicTestimonialRow>(
        `SELECT *
           FROM role_room_testimonials
          WHERE status = 'published'
          ORDER BY is_featured DESC, sort_order ASC, published_at DESC NULLS LAST, created_at DESC
          LIMIT 12`,
      );

      res.json(result.rows.map((row) => mapRoleRoomPublicTestimonial(row)));
    } catch (error) {
      console.error('Role Room public testimonials error:', error);
      res.json([]);
    }
  });

  router.post('/testimonials/submissions', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomPublicProofTables())) {
        res.status(503).json({ error: 'Testimonials er midlertidig utilgjengelig' });
        return;
      }

      const requestUser = getOptionalRequestUser(req);
      if (!requestUser?.userId) {
        res.status(401).json({ error: 'Innlogging kreves for a sende inn testimonial' });
        return;
      }

      const quote = readStringValue(req.body?.quote)?.trim();
      if (!quote || quote.length < 20) {
        res.status(400).json({ error: 'Testimonial ma vaere minst 20 tegn' });
        return;
      }

      const roleId = normalizeRoleRoomTestimonialRoleId(
        req.body?.roleId
        ?? req.body?.requestedRole
        ?? requestUser.role,
      );
      const authorName = readStringValue(req.body?.author)?.trim()
        ?? readStringValue(req.body?.authorName)?.trim()
        ?? readStringValue(req.body?.displayName)?.trim()
        ?? readStringValue(requestUser.email)?.split('@')[0]
        ?? 'Anonym';
      const authorTitle = readStringValue(req.body?.title)?.trim()
        ?? readStringValue(req.body?.authorTitle)?.trim()
        ?? getRoleRoomTestimonialDefaultTitle(roleId);
      const metadata = readJsonObject(req.body?.metadata);
      const id = makeId();

      await pool.query(
        `INSERT INTO role_room_testimonials (
          id, role_id, quote_text, author_name, author_title, author_user_id, author_email, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8::jsonb)`,
        [
          id,
          roleId,
          quote,
          authorName,
          authorTitle,
          requestUser.userId,
          requestUser.email ?? null,
          JSON.stringify(metadata),
        ],
      );

      res.status(201).json({
        success: true,
        submission: {
          id,
          roleId,
          quote,
          author: authorName,
          title: authorTitle,
          status: 'pending',
        },
      });
    } catch (error) {
      console.error('Role Room testimonial submission error:', error);
      res.status(500).json({ error: 'Kunne ikke sende inn testimonial' });
    }
  });

  router.post('/projects/:projectId/client-invites', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomClientInviteTables())) {
        res.status(503).json({ error: 'Klientinvitasjoner er midlertidig utilgjengelig' });
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å invitere klient' });
        return;
      }

      const targetEmail = normalizeEmailValue(req.body?.email);
      if (!targetEmail) {
        res.status(400).json({ error: 'Invitasjonen trenger en gyldig e-postadresse' });
        return;
      }

      const projectResult = await pool.query<CastingProjectRow>(
        `SELECT id, name, end_date, metadata
           FROM casting_projects
          WHERE id = $1
          LIMIT 1`,
        [projectId],
      );
      const projectRow = projectResult.rows[0] ?? null;
      if (!projectRow) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const requestedExpiresAt = readStringValue(req.body?.expiresAt);
      const fallbackDays = typeof req.body?.expiresInDays === 'number' && Number.isFinite(req.body.expiresInDays)
        ? Math.max(1, Math.min(30, Math.floor(req.body.expiresInDays)))
        : ROLE_ROOM_CLIENT_INVITE_DEFAULT_EXPIRES_IN_DAYS;
      const requestedExpiryTime = requestedExpiresAt ? Date.parse(requestedExpiresAt) : NaN;
      if (requestedExpiresAt && !Number.isFinite(requestedExpiryTime)) {
        res.status(400).json({ error: 'expiresAt er ugyldig' });
        return;
      }

      const recipientName = readStringValue(req.body?.recipientName);
      const accessDuration = normalizeRoleRoomClientInviteAccessDuration(req.body?.accessDuration);
      const sendEmail = readBooleanValue(req.body?.sendEmail) === true;
      const workspace = normalizeRoleRoomClientPortalWorkspace(req.body?.workspace);
      const tab = normalizeRoleRoomClientPortalTab(req.body?.tab);
      const sectionId = readStringValue(req.body?.sectionId);
      const pageId = readStringValue(req.body?.pageId);
      const reviewId = readStringValue(req.body?.reviewId);
      const artifactId = readStringValue(req.body?.artifactId);
      const projectMetadata = readJsonObject(projectRow.metadata);
      const accessEndsAt = accessDuration === 'project_end'
        ? normalizeRoleRoomProjectAccessExpiry(
          readStringValue(projectRow.end_date)
          ?? readStringValue(projectMetadata.endDate)
          ?? readStringValue(projectMetadata.end_date)
          ?? readStringValue(projectMetadata.eventDate)
          ?? readStringValue(projectMetadata.event_date),
        )
        : null;
      if (accessDuration === 'project_end' && !accessEndsAt) {
        res.status(400).json({ error: 'Prosjektet mangler sluttdato. Sett prosjektdato før du gir tilgang til prosjektets slutt.' });
        return;
      }

      const browserOrigin = sanitizeRoleRoomBrowserOrigin(req.body?.browserOrigin) ?? getRoleRoomRequestOrigin(req);
      const expiresAt = Number.isFinite(requestedExpiryTime)
        ? new Date(requestedExpiryTime).toISOString()
        : new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
      const requestUser = getOptionalRequestUser(req);
      const effectiveRoleRecord = getEffectiveProjectRoleRecord(req, roleRecord);
      const inviteToken = buildRoleRoomClientInviteToken();
      const inviteId = makeId();
      const emailSubject = readStringValue(req.body?.emailSubject)
        ?? 'Invitasjon til {{projectName}} i The Role Room';
      const emailBody = readStringValue(req.body?.emailBody)
        ?? [
          'Hei {{recipientName}},',
          '',
          'Du er invitert inn i The Role Room for prosjektet "{{projectName}}".',
          'Klikk på lenken under for å åpne klientportalen direkte.',
          '',
          'Magic-link: {{magicLink}}',
          '',
          'Tilgang: {{accessDurationLabel}}',
          '{{accessNote}}',
          '{{inviteExpiresNote}}',
          '',
          'Hilsen',
          '{{companyName}}',
        ].join('\n');
      const inviteMetadata = {
        createdFrom: 'producer_portal',
        browserOrigin: browserOrigin ?? null,
        recipientName,
        message: readStringValue(req.body?.message),
        emailSubject,
        emailBody,
        accessDuration,
        accessEndsAt,
        tab,
        workspace,
        sectionId,
        pageId,
        reviewId,
        artifactId,
      };
      const initialLastSentAt = null;

      await syncRoleRoomClientInviteContactToProject({
        projectId,
        email: targetEmail,
        recipientName,
        updatedByUserId: requestUser?.userId ?? null,
        updatedByRole: effectiveRoleRecord?.role ?? (requireScope(req, 'admin') ? 'admin' : requestUser?.role ?? null),
      });

      await pool.query(
        `INSERT INTO role_room_client_invites (
          id, project_id, email, token_hash, status, created_by_user_id, last_sent_at, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, 'sent', $5, $6, $7, $8::jsonb)`,
        [
          inviteId,
          projectId,
          targetEmail,
          hashRoleRoomClientInviteToken(inviteToken),
          requestUser?.userId ?? null,
          initialLastSentAt,
          expiresAt,
          JSON.stringify(inviteMetadata),
        ],
      );

      const inviteUrl = buildRoleRoomClientInviteUrl(req, {
        inviteToken,
        browserOrigin,
      });
      const senderName = requestUser?.email
        ? requestUser.email.split('@')[0] || 'The Role Room-teamet'
        : 'The Role Room-teamet';
      let delivery:
        | {
            sent: boolean;
            reason: string | null;
            provider: string | null;
            messageId: string | null;
            accepted: string[];
          }
        | null = null;

      if (sendEmail) {
        delivery = await sendRoleRoomClientInviteEmail({
          recipientEmail: targetEmail,
          replyToEmail: requestUser?.email ?? null,
          subjectTemplate: emailSubject,
          bodyTemplate: emailBody,
          inviteUrl,
          projectName: readStringValue(projectRow.name) ?? projectId,
          recipientName,
          companyName: 'The Role Room',
          senderName,
          accessDuration,
          accessEndsAt,
          inviteExpiresAt: expiresAt,
          projectId,
          sentByUserId: requestUser?.userId ?? null,
        });

        await pool.query(
          `UPDATE role_room_client_invites
              SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                  last_sent_at = CASE WHEN $3 THEN NOW() ELSE last_sent_at END,
                  updated_at = NOW()
            WHERE id = $1`,
          [
            inviteId,
            JSON.stringify({
              delivery,
            }),
            delivery.sent === true,
          ],
        ).catch((error) => {
          console.warn('Failed to persist Role Room client invite delivery metadata:', error);
        });
      } else {
        await pool.query(
          `UPDATE role_room_client_invites
              SET updated_at = NOW()
            WHERE id = $1`,
          [inviteId],
        ).catch(() => undefined);
      }

      res.status(201).json({
        invite: {
          ...buildRoleRoomClientInvite({
            id: inviteId,
            project_id: projectId,
            email: targetEmail,
            token_hash: '',
            status: 'sent',
            created_by_user_id: requestUser?.userId ?? null,
            created_at: nowISO(),
            updated_at: nowISO(),
            last_sent_at: delivery?.sent ? nowISO() : null,
            last_viewed_at: null,
            accepted_at: null,
            expires_at: expiresAt,
            metadata: {
              ...inviteMetadata,
              ...(delivery ? { delivery } : {}),
            },
          } as RoleRoomClientInviteRow, {
            inviteUrl,
          }),
          projectId,
          inviteToken,
        },
      });
    } catch (error) {
      console.error('Role Room client invite create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette klientinvitasjon' });
    }
  });

  router.get('/client/invites/:inviteToken/activate', async (req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomClientInviteTables())) {
        res.status(503).send('Klientinvitasjoner er midlertidig utilgjengelig');
        return;
      }

      pruneExpiredRoleRoomGoogleState();
      const inviteToken = readStringValue(req.params.inviteToken);
      if (!inviteToken) {
        res.status(400).send('inviteToken er påkrevd');
        return;
      }

      const invite = await getRoleRoomClientInviteByToken(inviteToken);
      if (!invite) {
        res.status(404).send('Fant ikke klientinvitasjonen');
        return;
      }

      const normalizedStatus = readStringValue(invite.status)?.toLowerCase() ?? 'sent';
      if (['cancelled', 'revoked'].includes(normalizedStatus)) {
        res.status(410).send('Invitasjonen er ikke lenger aktiv');
        return;
      }

      if (isRoleRoomClientInviteExpired(invite)) {
        await pool.query(
          `UPDATE role_room_client_invites
              SET status = 'expired',
                  updated_at = NOW()
            WHERE id = $1`,
          [invite.id],
        ).catch(() => undefined);
        res.status(410).send('Invitasjonen har utløpt');
        return;
      }

      const inviteEmail = normalizeEmailValue(invite.email);
      if (!inviteEmail) {
        res.status(400).send('Invitasjonen mangler mottakeradresse');
        return;
      }

      const inviteMetadata = readJsonObject(invite.metadata);
      const projectId = readStringValue(invite.project_id);
      const accessEndsAt = readStringValue(inviteMetadata.accessEndsAt);
      if (!projectId || !(await ensureProjectAccess(projectId, { allowBootstrap: false }))) {
        res.status(404).send('Prosjektet som invitasjonen peker til finnes ikke lenger');
        return;
      }

      const ensuredUser = await ensureRoleRoomUserByEmail(inviteEmail, {
        name: readStringValue(inviteMetadata.recipientName),
      });
      const existingRoleRecord = await getProjectRoleRecord(projectId, [
        ensuredUser.userId,
        ensuredUser.email,
      ]);

      if (
        !existingRoleRecord
        || isGenericProjectRole(existingRoleRecord.role)
        || isRoleRoomClientReviewerRole(existingRoleRecord.role)
      ) {
        await ensureRoleRoomProjectRoleAssignment(
          projectId,
          ensuredUser.userId,
          ensuredUser.email,
          'client_reviewer',
          readStringValue(invite.created_by_user_id),
          {
            expiresAt: accessEndsAt,
          },
        );
      }

      await pool.query(
        `UPDATE role_room_client_invites
            SET status = 'accepted',
                last_viewed_at = NOW(),
                accepted_at = COALESCE(accepted_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [invite.id],
      );

      const sessionToken = crypto.randomUUID();
      const sessionData: SessionData = {
        userId: ensuredUser.userId,
        email: ensuredUser.email,
        name: ensuredUser.name,
        role: 'client_reviewer',
        displayName: ensuredUser.name,
        requestedRole: 'client',
        loginAs: 'content_producer',
        loginAt: new Date().toISOString(),
      };
      activeSessions?.set(sessionToken, sessionData);
      await persistAuthSession(pool, sessionToken, sessionData);

      const transferId = crypto.randomUUID();
      roleRoomClientInviteTransferStore.set(transferId, {
        createdAt: Date.now(),
        projectId,
        sessionToken,
        user: {
          id: ensuredUser.userId,
          email: ensuredUser.email,
          role: 'client_reviewer',
          name: ensuredUser.name,
          display_name: ensuredUser.name,
          loginAs: 'content_producer',
          requestedRole: 'client',
        },
        invite: {
          id: invite.id,
          email: ensuredUser.email,
          status: 'accepted',
          expiresAt: readStringValue(invite.expires_at),
          acceptedAt: nowISO(),
        },
        portal: {
          tab: normalizeRoleRoomClientPortalTab(inviteMetadata.tab),
          workspace: normalizeRoleRoomClientPortalWorkspace(inviteMetadata.workspace),
          sectionId: readStringValue(inviteMetadata.sectionId),
          pageId: readStringValue(inviteMetadata.pageId),
          reviewId: readStringValue(inviteMetadata.reviewId),
          artifactId: readStringValue(inviteMetadata.artifactId),
        },
      });

      const returnPath = buildRoleRoomClientPortalReturnPath({
        projectId,
        tab: readStringValue(inviteMetadata.tab),
        workspace: readStringValue(inviteMetadata.workspace),
        sectionId: readStringValue(inviteMetadata.sectionId),
        pageId: readStringValue(inviteMetadata.pageId),
        reviewId: readStringValue(inviteMetadata.reviewId),
        artifactId: readStringValue(inviteMetadata.artifactId),
      });
      const browserOrigin = resolveRoleRoomBrowserOrigin(
        req,
        readStringValue(inviteMetadata.browserOrigin),
      ) ?? getRoleRoomRequestOrigin(req);

      res.redirect(
        buildRoleRoomGoogleReturnUrl(returnPath, {
          rrClientInviteStatus: 'success',
          rrClientInviteTransfer: transferId,
        }, browserOrigin),
      );
    } catch (error) {
      console.error('Role Room client invite activation error:', error);
      res.status(500).send(
        error instanceof Error ? error.message : 'Kunne ikke aktivere klientinvitasjonen',
      );
    }
  });

  router.get('/client/invites/session-result/:transferId', async (req: Request, res: Response) => {
    try {
      pruneExpiredRoleRoomGoogleState();
      const transferId = readStringValue(req.params.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId mangler' });
        return;
      }

      const payload = roleRoomClientInviteTransferStore.get(transferId);
      if (!payload) {
        res.status(404).json({ error: 'Klientinvitasjonen er utløpt eller brukt' });
        return;
      }

      roleRoomClientInviteTransferStore.delete(transferId);

      res.json({
        success: true,
        transferId,
        projectId: payload.projectId,
        sessionToken: payload.sessionToken,
        user: payload.user,
        invite: payload.invite,
        portal: payload.portal,
      });
    } catch (error) {
      console.error('Role Room client invite session result error:', error);
      res.status(500).json({ error: 'Kunne ikke hente klientinvitasjonen' });
    }
  });

  router.get('/projects/:projectId/talent-invites', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomTalentPortalTables())) {
        res.status(503).json({ error: 'Talentinvitasjoner er midlertidig utilgjengelig' });
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canReadProducerData(req, roleRecord) && !canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til talentinvitasjoner' });
        return;
      }

      const result = await pool.query(
        `SELECT rti.*, cc.name AS candidate_name
           FROM role_room_talent_invites rti
           INNER JOIN casting_candidates cc
             ON cc.id = rti.candidate_id
          WHERE rti.project_id = $1
          ORDER BY rti.created_at DESC`,
        [projectId],
      );

      res.json({
        invites: result.rows.map((row) => ({
          ...buildRoleRoomTalentPortalInvite(row as RoleRoomTalentInviteRow),
          projectId: row.project_id,
          candidateId: row.candidate_id,
          candidateName: readStringValue(row.candidate_name) ?? 'Talent',
        })),
      });
    } catch (error) {
      console.error('Role Room talent invites fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente talentinvitasjoner' });
    }
  });

  router.post('/projects/:projectId/talent-invites', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!(await ensureRoleRoomTalentPortalTables())) {
        res.status(503).json({ error: 'Talentinvitasjoner er midlertidig utilgjengelig' });
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureProjectAccess(projectId))) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const roleRecord = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
      if (!canWriteProducerData(req, roleRecord)) {
        res.status(403).json({ error: 'Mangler tilgang til å invitere talent' });
        return;
      }

      const candidateId = readStringValue(req.body?.candidateId);
      if (!candidateId) {
        res.status(400).json({ error: 'candidateId er påkrevd' });
        return;
      }

      const candidateResult = await pool.query<RoleRoomTalentPortalCandidateRow>(
        `SELECT *
           FROM casting_candidates
          WHERE id = $1
            AND project_id = $2
          LIMIT 1`,
        [candidateId, projectId],
      );
      const candidateRow = candidateResult.rows[0] ?? null;
      if (!candidateRow) {
        res.status(404).json({ error: 'Fant ikke talentprofilen som skal inviteres' });
        return;
      }

      const targetEmail = normalizeEmailValue(req.body?.email) ?? normalizeEmailValue(candidateRow.email);
      if (!targetEmail) {
        res.status(400).json({ error: 'Invitasjonen trenger en gyldig e-postadresse' });
        return;
      }

      if (normalizeEmailValue(candidateRow.email) !== targetEmail) {
        await pool.query(
          `UPDATE casting_candidates
              SET email = $1,
                  updated_at = NOW()
            WHERE id = $2
              AND project_id = $3`,
          [targetEmail, candidateId, projectId],
        );
      }

      const requestedExpiresAt = readStringValue(req.body?.expiresAt);
      const fallbackDays = typeof req.body?.expiresInDays === 'number' && Number.isFinite(req.body.expiresInDays)
        ? Math.max(1, Math.min(30, Math.floor(req.body.expiresInDays)))
        : 14;
      const requestedExpiryTime = requestedExpiresAt ? Date.parse(requestedExpiresAt) : NaN;
      if (requestedExpiresAt && !Number.isFinite(requestedExpiryTime)) {
        res.status(400).json({ error: 'expiresAt er ugyldig' });
        return;
      }
      const expiresAt = Number.isFinite(requestedExpiryTime)
        ? new Date(requestedExpiryTime).toISOString()
        : new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();

      const inviteToken = buildRoleRoomTalentInviteToken();
      const inviteId = makeId();
      const inviteMetadata = {
        message: readStringValue(req.body?.message),
        createdFrom: 'producer_portal',
      };
      const requestUser = getOptionalRequestUser(req);

      await pool.query(
        `INSERT INTO role_room_talent_invites (
          id, project_id, candidate_id, email, token_hash, status, created_by_user_id, last_sent_at, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, 'sent', $6, NOW(), $7, $8::jsonb)`,
        [
          inviteId,
          projectId,
          candidateId,
          targetEmail,
          hashRoleRoomTalentInviteToken(inviteToken),
          requestUser?.userId ?? null,
          expiresAt,
          JSON.stringify(inviteMetadata),
        ],
      );

      await createRoleRoomTalentActivityEntry({
        projectId,
        candidateId,
        entryType: 'invite_sent',
        title: 'Invitasjon sendt',
        body: readStringValue(req.body?.message) ?? 'Talentet fikk en invitasjonslenke til Talent Portal.',
        visibility: 'shared',
        metadata: {
          inviteId,
          email: targetEmail,
        },
        createdByUserId: requestUser?.userId ?? null,
        createdByRole: requestUser?.role ?? null,
      });

      const inviteUrl = buildRoleRoomTalentInviteUrl(req, {
        projectId,
        candidateId,
        inviteToken,
        browserOrigin: sanitizeRoleRoomBrowserOrigin(req.body?.browserOrigin),
      });

      res.status(201).json({
        invite: {
          ...buildRoleRoomTalentPortalInvite({
            id: inviteId,
            project_id: projectId,
            candidate_id: candidateId,
            email: targetEmail,
            token_hash: '',
            status: 'sent',
            created_by_user_id: requestUser?.userId ?? null,
            created_at: nowISO(),
            updated_at: nowISO(),
            last_sent_at: nowISO(),
            last_viewed_at: null,
            accepted_at: null,
            expires_at: expiresAt,
            metadata: inviteMetadata,
          } as RoleRoomTalentInviteRow, {
            inviteUrl,
            previewUrl: `${getRoleRoomRequestOrigin(req) ?? DEFAULT_ROLE_ROOM_TALENT_PUBLIC_ORIGIN}/api/role-room/talent/invites/${inviteToken}`,
          }),
          projectId,
          candidateId,
          candidateName: readStringValue(candidateRow.name) ?? 'Talent',
          inviteToken,
        },
      });
    } catch (error) {
      console.error('Role Room talent invite create error:', error);
      res.status(500).json({ error: 'Kunne ikke opprette talentinvitasjon' });
    }
  });

  router.get('/talent/invites/:inviteToken', async (req: Request, res: Response) => {
    try {
      const inviteToken = readStringValue(req.params.inviteToken);
      if (!inviteToken) {
        res.status(400).json({ error: 'inviteToken er påkrevd' });
        return;
      }

      const invite = await getRoleRoomTalentInviteByToken(inviteToken);
      if (!invite) {
        res.status(404).json({ error: 'Fant ikke invitasjonen' });
        return;
      }
      if (['cancelled', 'revoked'].includes(String(invite.status || '').trim().toLowerCase())) {
        res.status(410).json({ error: 'Invitasjonen er ikke lenger aktiv' });
        return;
      }

      if (isRoleRoomTalentInviteExpired(invite)) {
        res.status(410).json({ error: 'Invitasjonen har utløpt' });
        return;
      }

      const preview = await getRoleRoomTalentInvitePreview(invite);
      if (!preview) {
        res.status(404).json({ error: 'Fant ikke talentinvitasjonen' });
        return;
      }

      await pool.query(
        `UPDATE role_room_talent_invites
            SET last_viewed_at = NOW(),
                status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
                updated_at = NOW()
          WHERE id = $1`,
        [invite.id],
      );

      res.json({
        ...preview,
        requiresLogin: true,
      });
    } catch (error) {
      console.error('Role Room talent invite preview error:', error);
      res.status(500).json({ error: 'Kunne ikke hente talentinvitasjonen' });
    }
  });

  router.get('/talent/portal', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const requestUser = getOptionalRequestUser(req);
      const requestEmail = normalizeEmailValue(requestUser?.email);
      if (!requestEmail) {
        res.status(401).json({ error: 'Innlogging med gyldig e-post kreves for talentportalen' });
        return;
      }

      let projectId = readStringValue(req.query?.projectId);
      let candidateId = readStringValue(req.query?.candidateId);
      const inviteToken = readStringValue(req.query?.inviteToken);

      if (inviteToken) {
        const invite = await getRoleRoomTalentInviteByToken(inviteToken);
        if (!invite) {
          res.status(404).json({ error: 'Fant ikke invitasjonen til talentportalen' });
          return;
        }
        if (['cancelled', 'revoked'].includes(String(invite.status || '').trim().toLowerCase())) {
          res.status(410).json({ error: 'Invitasjonen er ikke lenger aktiv' });
          return;
        }
        if (isRoleRoomTalentInviteExpired(invite)) {
          res.status(410).json({ error: 'Invitasjonen til talentportalen har utløpt' });
          return;
        }

        const candidateResult = await pool.query<RoleRoomTalentPortalCandidateRow>(
          `SELECT *
             FROM casting_candidates
            WHERE id = $1
              AND project_id = $2
            LIMIT 1`,
          [invite.candidate_id, invite.project_id],
        );
        const candidateRow = candidateResult.rows[0] ?? null;
        if (!candidateRow) {
          res.status(404).json({ error: 'Fant ikke talentprofilen for invitasjonen' });
          return;
        }

        const expectedEmail = normalizeEmailValue(invite.email) ?? normalizeEmailValue(candidateRow.email);
        if (expectedEmail && expectedEmail !== requestEmail) {
          res.status(403).json({ error: 'Invitasjonen er knyttet til en annen e-postadresse' });
          return;
        }

        if (normalizeEmailValue(candidateRow.email) !== requestEmail) {
          await pool.query(
            `UPDATE casting_candidates
                SET email = $1,
                    updated_at = NOW()
              WHERE id = $2
                AND project_id = $3`,
            [requestEmail, invite.candidate_id, invite.project_id],
          );
        }

        const inviteWasAccepted = Boolean(readStringValue(invite.accepted_at));
        await pool.query(
          `UPDATE role_room_talent_invites
              SET last_viewed_at = NOW(),
                  accepted_at = COALESCE(accepted_at, NOW()),
                  status = CASE WHEN status IN ('sent', 'viewed') THEN 'accepted' ELSE status END,
                  updated_at = NOW()
            WHERE id = $1`,
          [invite.id],
        );

        if (!inviteWasAccepted) {
          await createRoleRoomTalentActivityEntry({
            projectId: invite.project_id,
            candidateId: invite.candidate_id,
            entryType: 'invite_accepted',
            title: 'Invitasjon aktivert',
            body: 'Talentet logget inn og aktiverte portalen for denne auditionen.',
            visibility: 'shared',
            metadata: { inviteId: invite.id },
            createdByUserId: requestUser?.userId ?? null,
            createdByRole: requestUser?.role ?? 'talent',
          });
        }

        projectId = projectId ?? invite.project_id;
        candidateId = candidateId ?? invite.candidate_id;
      }

      const assignments = await resolveRoleRoomTalentAssignmentsForEmail(requestEmail, {
        projectId,
        candidateId,
        req,
      });

      res.json({
        assignments,
        summary: {
          projectCount: assignments.length,
          auditionCount: assignments.reduce((sum, assignment) => sum + assignment.schedules.length, 0),
          selfTapeCount: assignments.reduce((sum, assignment) => sum + assignment.candidate.videos.length, 0),
        },
      });
    } catch (error) {
      console.error('Role Room talent portal fetch error:', error);
      res.status(500).json({ error: 'Kunne ikke hente talentportal' });
    }
  });

  router.patch('/talent/portal/profile', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const projectId = readStringValue(req.body?.projectId);
      const candidateId = readStringValue(req.body?.candidateId);
      if (!projectId || !candidateId) {
        res.status(400).json({ error: 'projectId og candidateId er påkrevd' });
        return;
      }

      const candidateRow = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      if (!candidateRow) {
        res.status(404).json({ error: 'Talentprofil ikke funnet for denne brukeren' });
        return;
      }

      const currentMetadata = readJsonObject(candidateRow.metadata);
      const currentTalentProfile = readJsonObject(currentMetadata.talentProfile);
      const currentEmergencyContact = readJsonObject(candidateRow.emergency_contact);

      const nextTalentProfile = {
        ...currentTalentProfile,
        bio: readStringValue(req.body?.bio) ?? readStringValue(currentTalentProfile.bio),
        city: readStringValue(req.body?.city) ?? readStringValue(currentTalentProfile.city),
        baseLocation: readStringValue(req.body?.baseLocation) ?? readStringValue(currentTalentProfile.baseLocation),
        website: readExternalUrlValue(req.body?.website) ?? readExternalUrlValue(currentTalentProfile.website),
        instagram: readExternalUrlValue(req.body?.instagram) ?? readExternalUrlValue(currentTalentProfile.instagram),
        portfolioUrl: readExternalUrlValue(req.body?.portfolioUrl) ?? readExternalUrlValue(currentTalentProfile.portfolioUrl),
        showreelUrl: readExternalUrlValue(req.body?.showreelUrl) ?? readExternalUrlValue(currentTalentProfile.showreelUrl),
        languages:
          toStringArray(req.body?.languages).length > 0
            ? toStringArray(req.body?.languages)
            : toStringArray(currentTalentProfile.languages),
      };

      const nextMetadata = {
        ...currentMetadata,
        talentProfile: nextTalentProfile,
        talentPortal: {
          ...readJsonObject(currentMetadata.talentPortal),
          lastProfileUpdateAt: nowISO(),
        },
      };

      const nextEmergencyContact = {
        ...currentEmergencyContact,
        name: readStringValue(req.body?.emergencyContact?.name)
          ?? readStringValue(req.body?.emergencyContactName)
          ?? readStringValue(currentEmergencyContact.name),
        phone: readStringValue(req.body?.emergencyContact?.phone)
          ?? readStringValue(req.body?.emergencyContactPhone)
          ?? readStringValue(currentEmergencyContact.phone),
        relationship: readStringValue(req.body?.emergencyContact?.relationship)
          ?? readStringValue(req.body?.emergencyContactRelationship)
          ?? readStringValue(currentEmergencyContact.relationship),
      };

      const phone = readStringValue(req.body?.phone) ?? readStringValue(candidateRow.phone);
      const agency = readStringValue(req.body?.agency) ?? readStringValue(candidateRow.agency);
      const requestUser = getOptionalRequestUser(req);

      const currentReminderPrefs = normalizeReminderPrefs(candidateRow.reminder_prefs);
      const inboundReminderPrefs = req.body?.reminderPrefs;
      const nextReminderPrefs: CandidateReminderPrefs =
        inboundReminderPrefs && typeof inboundReminderPrefs === 'object'
          ? {
              sms24h:
                typeof (inboundReminderPrefs as Record<string, unknown>).sms24h === 'boolean'
                  ? Boolean((inboundReminderPrefs as Record<string, unknown>).sms24h)
                  : currentReminderPrefs.sms24h,
              sms1h:
                typeof (inboundReminderPrefs as Record<string, unknown>).sms1h === 'boolean'
                  ? Boolean((inboundReminderPrefs as Record<string, unknown>).sms1h)
                  : currentReminderPrefs.sms1h,
              email24h:
                typeof (inboundReminderPrefs as Record<string, unknown>).email24h === 'boolean'
                  ? Boolean((inboundReminderPrefs as Record<string, unknown>).email24h)
                  : currentReminderPrefs.email24h,
              email1h:
                typeof (inboundReminderPrefs as Record<string, unknown>).email1h === 'boolean'
                  ? Boolean((inboundReminderPrefs as Record<string, unknown>).email1h)
                  : currentReminderPrefs.email1h,
            }
          : currentReminderPrefs;

      await pool.query(
        `UPDATE casting_candidates
            SET phone = $1,
                agency = $2,
                emergency_contact = $3::jsonb,
                metadata = $4::jsonb,
                reminder_prefs = $5::jsonb,
                updated_at = NOW()
          WHERE id = $6
            AND project_id = $7`,
        [
          phone,
          agency,
          JSON.stringify(nextEmergencyContact),
          JSON.stringify(nextMetadata),
          JSON.stringify(nextReminderPrefs),
          candidateId,
          projectId,
        ],
      );

      await createRoleRoomTalentActivityEntry({
        projectId,
        candidateId,
        entryType: 'profile_updated',
        title: 'Profil oppdatert',
        body: 'Kontaktinfo og profilfelt ble oppdatert i Talent Portal.',
        visibility: 'shared',
        metadata: {
          fields: ['phone', 'agency', 'bio', 'city', 'baseLocation', 'website', 'instagram', 'portfolioUrl', 'showreelUrl', 'languages'],
        },
        createdByUserId: requestUser?.userId ?? null,
        createdByRole: requestUser?.role ?? 'talent',
      });

      const refreshed = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      res.json({
        success: true,
        candidate: refreshed ? buildRoleRoomTalentPortalCandidate(refreshed) : null,
      });
    } catch (error) {
      console.error('Role Room talent profile update error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere talentprofilen' });
    }
  });

  router.post('/talent/portal/self-tapes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const projectId = readStringValue(req.body?.projectId);
      const candidateId = readStringValue(req.body?.candidateId);
      if (!projectId || !candidateId) {
        res.status(400).json({ error: 'projectId og candidateId er påkrevd' });
        return;
      }

      const candidateRow = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      if (!candidateRow) {
        res.status(404).json({ error: 'Talentprofil ikke funnet for denne brukeren' });
        return;
      }

      const title = readStringValue(req.body?.title) ?? 'Ny self tape';
      const videoUrl = readExternalUrlValue(req.body?.videoUrl ?? req.body?.url);
      if (!videoUrl) {
        res.status(400).json({ error: 'Gyldig videoUrl er påkrevd' });
        return;
      }

      const existingVideos = normalizeRoleRoomTalentMediaList(candidateRow.videos, 'video');
      const nextVideo = {
        id: makeId(),
        kind: 'video',
        title,
        url: videoUrl,
        thumbnailUrl: readExternalUrlValue(req.body?.thumbnailUrl),
        notes: readStringValue(req.body?.notes),
        source: 'talent_portal',
        submittedAt: nowISO(),
        durationSeconds:
          typeof req.body?.durationSeconds === 'number' && Number.isFinite(req.body.durationSeconds)
            ? req.body.durationSeconds
            : null,
      };
      const currentMetadata = readJsonObject(candidateRow.metadata);
      const nextMetadata = {
        ...currentMetadata,
        talentPortal: {
          ...readJsonObject(currentMetadata.talentPortal),
          lastSelfTapeSubmissionAt: nextVideo.submittedAt,
        },
      };

      await pool.query(
        `UPDATE casting_candidates
            SET videos = $1::jsonb,
                metadata = $2::jsonb,
                updated_at = NOW()
          WHERE id = $3
            AND project_id = $4`,
        [
          JSON.stringify([...existingVideos, nextVideo]),
          JSON.stringify(nextMetadata),
          candidateId,
          projectId,
        ],
      );

      const requestUser = getOptionalRequestUser(req);
      await createRoleRoomTalentActivityEntry({
        projectId,
        candidateId,
        entryType: 'self_tape_link',
        title: 'Self tape sendt inn',
        body: readStringValue(req.body?.notes) ?? 'Talentet leverte en self tape via sikker videolenke.',
        visibility: 'shared',
        metadata: {
          videoTitle: title,
          source: 'link',
        },
        createdByUserId: requestUser?.userId ?? null,
        createdByRole: requestUser?.role ?? 'talent',
      });

      const refreshed = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      res.status(201).json({
        success: true,
        video: nextVideo,
        candidate: refreshed ? buildRoleRoomTalentPortalCandidate(refreshed) : null,
      });
    } catch (error) {
      console.error('Role Room self tape submission error:', error);
      res.status(500).json({ error: 'Kunne ikke sende inn self tape' });
    }
  });

  router.post('/talent/portal/messages', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const projectId = readStringValue(req.body?.projectId);
      const candidateId = readStringValue(req.body?.candidateId);
      const body = readStringValue(req.body?.body ?? req.body?.message);
      if (!projectId || !candidateId) {
        res.status(400).json({ error: 'projectId og candidateId er påkrevd' });
        return;
      }
      if (!body || body.length < 5) {
        res.status(400).json({ error: 'Skriv en litt tydeligere melding til teamet' });
        return;
      }

      const candidateRow = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      if (!candidateRow) {
        res.status(404).json({ error: 'Talentprofil ikke funnet for denne brukeren' });
        return;
      }

      const requestUser = getOptionalRequestUser(req);
      await createRoleRoomTalentActivityEntry({
        projectId,
        candidateId,
        entryType: 'message',
        title: 'Ny melding til teamet',
        body,
        visibility: 'shared',
        metadata: {
          channel: 'talent_portal',
        },
        createdByUserId: requestUser?.userId ?? null,
        createdByRole: requestUser?.role ?? 'talent',
      });

      res.status(201).json({
        success: true,
        activity: {
          projectId,
          candidateId,
          entryType: 'message',
          title: 'Ny melding til teamet',
          body,
          visibility: 'shared',
          createdByRole: requestUser?.role ?? 'talent',
          createdAt: nowISO(),
        },
      });
    } catch (error) {
      console.error('Role Room talent message error:', error);
      res.status(500).json({ error: 'Kunne ikke sende meldingen' });
    }
  });

  router.post('/talent/portal/self-tapes/upload', apiKeyAuth(pool, activeSessions), roleRoomTalentUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const projectId = readStringValue(req.body?.projectId);
      const candidateId = readStringValue(req.body?.candidateId);
      if (!projectId || !candidateId) {
        res.status(400).json({ error: 'projectId og candidateId er påkrevd' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Videofil er påkrevd' });
        return;
      }

      if (!(await ensureRoleRoomTalentPortalTables())) {
        res.status(503).json({ error: 'Videoopplasting er midlertidig utilgjengelig' });
        return;
      }

      const candidateRow = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      if (!candidateRow) {
        res.status(404).json({ error: 'Talentprofil ikke funnet for denne brukeren' });
        return;
      }

      const requestUser = getOptionalRequestUser(req);
      const title = readStringValue(req.body?.title) ?? path.parse(req.file.originalname).name ?? 'Self tape';
      const notes = readStringValue(req.body?.notes);
      const submittedAt = nowISO();
      const uploadId = makeId();
      const storageDirectory = await ensureRoleRoomTalentUploadDirectory(projectId, candidateId);
      const safeExtension = path.extname(req.file.originalname || '').slice(0, 20) || '.mp4';
      const storedName = `${uploadId}-${sanitizeRoleRoomTalentFileSegment(path.parse(req.file.originalname || 'self-tape').name, 'self-tape')}${safeExtension}`;
      const storagePath = path.join(storageDirectory, storedName);

      await fs.writeFile(storagePath, req.file.buffer);

      const uploadMetadata = {
        title,
        notes,
      };

      await pool.query(
        `INSERT INTO role_room_talent_uploads (
          id, project_id, candidate_id, media_kind, original_name, stored_name, storage_path, mime_type, size_bytes, metadata, created_by_user_id
        ) VALUES ($1, $2, $3, 'video', $4, $5, $6, $7, $8, $9::jsonb, $10)`,
        [
          uploadId,
          projectId,
          candidateId,
          req.file.originalname,
          storedName,
          storagePath,
          req.file.mimetype || 'application/octet-stream',
          req.file.size,
          JSON.stringify(uploadMetadata),
          requestUser?.userId ?? null,
        ],
      );

      const existingVideos = normalizeRoleRoomTalentMediaList(candidateRow.videos, 'video');
      const nextVideo = buildRoleRoomTalentUploadVideoRecord({
        uploadId,
        title,
        notes,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        originalName: req.file.originalname,
        submittedAt,
      });
      const currentMetadata = readJsonObject(candidateRow.metadata);
      const nextMetadata = {
        ...currentMetadata,
        talentPortal: {
          ...readJsonObject(currentMetadata.talentPortal),
          lastSelfTapeSubmissionAt: submittedAt,
          lastUploadAt: submittedAt,
        },
      };

      await pool.query(
        `UPDATE casting_candidates
            SET videos = $1::jsonb,
                metadata = $2::jsonb,
                updated_at = NOW()
          WHERE id = $3
            AND project_id = $4`,
        [
          JSON.stringify([...existingVideos, nextVideo]),
          JSON.stringify(nextMetadata),
          candidateId,
          projectId,
        ],
      );

      await createRoleRoomTalentActivityEntry({
        projectId,
        candidateId,
        entryType: 'self_tape_upload',
        title: 'Self tape lastet opp',
        body: notes ?? 'Talentet lastet opp en self tape direkte i portalen.',
        visibility: 'shared',
        metadata: {
          uploadId,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
        createdByUserId: requestUser?.userId ?? null,
        createdByRole: requestUser?.role ?? 'talent',
      });

      const refreshed = await resolveRoleRoomTalentCandidateForRequest(req, projectId, candidateId);
      res.status(201).json({
        success: true,
        upload: {
          id: uploadId,
          url: getRoleRoomTalentUploadDownloadPath(uploadId),
          title,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype || 'application/octet-stream',
          sizeBytes: req.file.size,
          requiresAuth: true,
          submittedAt,
        },
        video: nextVideo,
        candidate: refreshed ? buildRoleRoomTalentPortalCandidate(refreshed) : null,
      });
    } catch (error) {
      console.error('Role Room self tape upload error:', error);
      res.status(500).json({ error: 'Kunne ikke laste opp self tape' });
    }
  });

  router.get('/talent/uploads/:uploadId/content', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const uploadId = readStringValue(req.params.uploadId);
      if (!uploadId || !(await ensureRoleRoomTalentPortalTables())) {
        res.status(404).json({ error: 'Fant ikke opplastingen' });
        return;
      }

      const uploadResult = await pool.query<RoleRoomTalentUploadRow & { candidate_email?: string | null }>(
        `SELECT rtu.*, cc.email AS candidate_email
           FROM role_room_talent_uploads rtu
           INNER JOIN casting_candidates cc
             ON cc.id = rtu.candidate_id
            AND cc.project_id = rtu.project_id
          WHERE rtu.id = $1
          LIMIT 1`,
        [uploadId],
      );
      const uploadRow = uploadResult.rows[0] ?? null;
      if (!uploadRow) {
        res.status(404).json({ error: 'Fant ikke opplastingen' });
        return;
      }

      const requestEmail = normalizeEmailValue(getOptionalRequestUser(req)?.email);
      if (!requestEmail || normalizeEmailValue(uploadRow.candidate_email) !== requestEmail) {
        res.status(403).json({ error: 'Du har ikke tilgang til denne self tapen' });
        return;
      }

      if (!existsSync(uploadRow.storage_path)) {
        res.status(404).json({ error: 'Fant ikke videofilen' });
        return;
      }

      res.setHeader('Content-Type', readStringValue(uploadRow.mime_type) ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${sanitizeRoleRoomTalentFileSegment(uploadRow.original_name, 'self-tape')}"`);
      res.sendFile(uploadRow.storage_path);
    } catch (error) {
      console.error('Role Room talent upload download error:', error);
      res.status(500).json({ error: 'Kunne ikke hente self tape' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Admin Stats — full breakdown for AdminStats dashboard
  // ═══════════════════════════════════════════════════════════

  router.get('/admin/stats', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!requireScope(req, 'admin')) {
        res.status(403).json({ error: 'Admin-tilgang kreves for Role Room-statistikk' });
        return;
      }

      const summary = await getRoleRoomStatsSummary();
      const [
        candidatesRes,
        marketplaceRes,
        activeKeysRes,
        recentProjectsRes,
        professionRes,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS n FROM casting_candidates`),
        pool.query(
          `SELECT COUNT(*) AS n FROM marketplace_installations
           WHERE is_active = TRUE AND (app_id ILIKE '%role%' OR app_id ILIKE '%casting%' OR app_id = 'role-room')`
        ),
        pool.query(`SELECT COUNT(*) AS n FROM role_room_api_keys WHERE is_active = TRUE`),
        pool.query(
          `SELECT id, name, status, created_at FROM casting_projects
           ORDER BY created_at DESC LIMIT 5`
        ),
        pool.query(
          `SELECT cur.role, COUNT(*) AS n
           FROM casting_user_roles cur
           GROUP BY cur.role
           ORDER BY n DESC`
        ),
      ]);

      res.json({
        ...summary,
        kandidater:          parseInt(candidatesRes.rows[0]?.n     ?? '0', 10),
        marketplaceInstalls: parseInt(marketplaceRes.rows[0]?.n    ?? '0', 10),
        activeApiKeys:       parseInt(activeKeysRes.rows[0]?.n     ?? '0', 10),
        recentProjects:      recentProjectsRes.rows,
        professionBreakdown: professionRes.rows,
      });
    } catch (err) {
      console.error('Role Room admin stats error:', err);
      res.status(500).json({ error: 'Kunne ikke hente statistikk' });
    }
  });

  router.get('/admin/testimonials', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!requireScope(req, 'admin')) {
        res.status(403).json({ error: 'Admin-tilgang kreves for testimonials' });
        return;
      }

      if (!(await ensureRoleRoomPublicProofTables())) {
        res.status(503).json({ error: 'Testimonials er midlertidig utilgjengelig' });
        return;
      }

      const result = await pool.query<RoleRoomPublicTestimonialRow>(
        `SELECT *
           FROM role_room_testimonials
          ORDER BY
            CASE status
              WHEN 'pending' THEN 0
              WHEN 'published' THEN 1
              WHEN 'rejected' THEN 2
              ELSE 3
            END,
            is_featured DESC,
            sort_order ASC,
            created_at DESC`,
      );

      res.json(result.rows.map((row) => ({
        ...mapRoleRoomPublicTestimonial(row),
        status: readStringValue(row.status) ?? 'pending',
        authorEmail: readStringValue(row.author_email),
        authorUserId: readStringValue(row.author_user_id),
        metadata: readJsonObject(row.metadata),
        approvedAt: readStringValue(row.approved_at),
        rejectedReason: readStringValue(row.rejected_reason),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      })));
    } catch (error) {
      console.error('Role Room admin testimonials error:', error);
      res.status(500).json({ error: 'Kunne ikke hente testimonials' });
    }
  });

  router.patch('/admin/testimonials/:testimonialId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!requireScope(req, 'admin')) {
        res.status(403).json({ error: 'Admin-tilgang kreves for testimonials' });
        return;
      }

      if (!(await ensureRoleRoomPublicProofTables())) {
        res.status(503).json({ error: 'Testimonials er midlertidig utilgjengelig' });
        return;
      }

      const testimonialId = readStringValue(req.params.testimonialId);
      if (!testimonialId) {
        res.status(400).json({ error: 'Mangler testimonial-id' });
        return;
      }

      const nextStatus = readStringValue(req.body?.status)?.trim().toLowerCase();
      const isFeatured = readBooleanValue(req.body?.isFeatured);
      const sortOrderRaw = Number(req.body?.sortOrder);
      const rejectedReason = readStringValue(req.body?.rejectedReason);
      const updates: string[] = [];
      const values: unknown[] = [];

      const push = (sqlFragment: string, value: unknown) => {
        values.push(value);
        updates.push(`${sqlFragment} = $${values.length}`);
      };

      if (nextStatus && ['pending', 'published', 'rejected'].includes(nextStatus)) {
        push('status', nextStatus);
        if (nextStatus === 'published') {
          updates.push('published_at = NOW()');
          updates.push('approved_at = NOW()');
          push('approved_by_user_id', getUserId(req));
          updates.push('rejected_reason = NULL');
        } else if (nextStatus === 'rejected') {
          push('rejected_reason', rejectedReason ?? 'Ikke godkjent');
        }
      }

      if (typeof isFeatured === 'boolean') {
        push('is_featured', isFeatured);
      }

      if (Number.isFinite(sortOrderRaw)) {
        push('sort_order', Math.max(0, Math.floor(sortOrderRaw)));
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'Ingen gyldige oppdateringer sendt inn' });
        return;
      }

      values.push(testimonialId);
      const result = await pool.query<RoleRoomPublicTestimonialRow>(
        `UPDATE role_room_testimonials
            SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *`,
        values,
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Fant ikke testimonial' });
        return;
      }

      res.json({
        success: true,
        testimonial: {
          ...mapRoleRoomPublicTestimonial(result.rows[0]),
          status: readStringValue(result.rows[0]?.status) ?? 'pending',
        },
      });
    } catch (error) {
      console.error('Role Room testimonial patch error:', error);
      res.status(500).json({ error: 'Kunne ikke oppdatere testimonial' });
    }
  });

  // ── Live Set endpoints ───────────────────────────────────────────────────
  //  TODO [Studio]: replace in-memory maps with Postgres tables.
  //  Tables needed:
  //    live_set_status  (projectId, shootingDayId, state JSONB)
  //    takes            (id, projectId, shooting_day_id, scene_id, shot_id, …)
  //    continuity_notes (id, project_id, shooting_day_id, scene_id, …)
  //    audit_log        (id, project_id, action, payload JSONB, user_id, created_at)

  type LiveSetEventTypeV2 =
    | 'roll'
    | 'cut'
    | 'capture_take'
    | 'set_take_status'
    | 'add_flag'
    | 'add_note'
    | 'update_note'
    | 'delete_note'
    | 'set_scene'
    | 'setup_complete'
    | 'advance_scene'
    | 'set_camera'
    | 'set_setup'
    | 'set_cam'
    | 'quick_action';

  interface LiveSetEventV2 {
    eventId: string;
    sessionId: string;
    seq: number;
    type: LiveSetEventTypeV2;
    payload: Record<string, unknown>;
    capturedAt: string;
    deviceId: string;
    operatorId: string;
    projectId: string;
    shootingDayId?: string;
    ingestedAt: string;
  }

  interface LiveSetSessionV2 {
    sessionId: string;
    projectId: string;
    operatorId: string;
    deviceId: string;
    shootingDayId?: string;
    startedAt: string;
    endedAt?: string;
    metadata?: Record<string, unknown>;
  }

  interface LiveSetConflictV2 {
    eventId?: string;
    sessionId?: string;
    seq?: number;
    type: string;
    reason: string;
    serverValue?: unknown;
    clientValue?: unknown;
    resolvedBy?: 'server' | 'client' | 'merge';
    timestamp?: string;
  }

  const liveSetEventTypeValues = [
    'roll',
    'cut',
    'capture_take',
    'set_take_status',
    'add_flag',
    'add_note',
    'update_note',
    'delete_note',
    'set_scene',
    'setup_complete',
    'advance_scene',
    'set_camera',
    'set_setup',
    'set_cam',
    'quick_action',
  ] as const satisfies readonly LiveSetEventTypeV2[];

  const liveSetSessionSchema = z.object({
    sessionId: z.string().min(2).max(128).optional(),
    operatorId: z.string().min(1).max(160),
    deviceId: z.string().min(1).max(240),
    shootingDayId: z.string().min(1).max(160).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const liveSetEventSchema = z.object({
    eventId: z.string().min(4).max(160),
    sessionId: z.string().min(2).max(128),
    seq: z.number().int().positive(),
    type: z.enum(liveSetEventTypeValues),
    payload: z.record(z.string(), z.unknown()).default({}),
    capturedAt: z.string().min(4),
    deviceId: z.string().min(1).max(240),
    operatorId: z.string().min(1).max(160),
    projectId: z.string().min(1).max(160).optional(),
    shootingDayId: z.string().max(160).optional(),
  });

  const liveSetBatchSchema = z.object({
    sessionId: z.string().min(2).max(128),
    events: z.array(liveSetEventSchema).min(1).max(500),
  });

  const liveSetAckSchema = z.object({
    sessionId: z.string().min(2).max(128),
    eventIds: z.array(z.string().min(4).max(160)).min(1).max(2000),
  });

  const liveSetSessionsStore = new Map<string, LiveSetSessionV2[]>();
  const liveSetEventsV2Store = new Map<string, LiveSetEventV2[]>();
  const liveSetAckStore = new Map<string, Record<string, string[]>>();

  const liveSetSessionsDbKey = (projectId: string) => `role-room:liveset:v2:sessions:${projectId}`;
  const liveSetEventsV2DbKey = (projectId: string) => `role-room:liveset:v2:events:${projectId}`;
  const liveSetAckDbKey = (projectId: string) => `role-room:liveset:v2:acks:${projectId}`;
  const roleRoomProjectAccessCache = new Set<string>();
  let castingProjectsTableReadyPromise: Promise<boolean> | null = null;

  function normalizeRoleRoomProjectName(projectId: string): string {
    const normalized = projectId
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return 'Role Room prosjekt';
    return normalized
      .split(' ')
      .map((segment) => (segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
      .join(' ')
      .slice(0, 255);
  }

  async function ensureCastingProjectsTable(): Promise<boolean> {
    if (castingProjectsTableReadyPromise) return castingProjectsTableReadyPromise;
    castingProjectsTableReadyPromise = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS casting_projects (
            id VARCHAR(255) PRIMARY KEY NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_by VARCHAR(255),
            genre VARCHAR(100),
            project_type VARCHAR(100),
            start_date DATE,
            end_date DATE,
            budget NUMERIC(12, 2),
            currency VARCHAR(10) DEFAULT 'NOK',
            settings JSONB DEFAULT '{}'::jsonb,
            metadata JSONB DEFAULT '{}'::jsonb,
            creatorhub_project_id VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
          );
          ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS creatorhub_project_id VARCHAR(255);
          CREATE INDEX IF NOT EXISTS casting_projects_created_by_idx ON casting_projects (created_by);
          CREATE INDEX IF NOT EXISTS casting_projects_status_idx ON casting_projects (status);
          CREATE INDEX IF NOT EXISTS casting_projects_creatorhub_project_id_idx ON casting_projects (creatorhub_project_id);

          CREATE TABLE IF NOT EXISTS casting_user_roles (
            id VARCHAR(255) PRIMARY KEY NOT NULL,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            role VARCHAR(50) NOT NULL,
            permissions JSONB DEFAULT '{}'::jsonb,
            added_by VARCHAR(255),
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(project_id, user_id)
          );
          ALTER TABLE casting_user_roles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
          CREATE INDEX IF NOT EXISTS casting_user_roles_user_id_idx ON casting_user_roles (user_id);
          CREATE INDEX IF NOT EXISTS casting_user_roles_project_user_idx ON casting_user_roles (project_id, user_id);
          CREATE INDEX IF NOT EXISTS casting_user_roles_expires_at_idx ON casting_user_roles (expires_at);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room casting_projects table unavailable:', error);
        return false;
      }
    })();
    return castingProjectsTableReadyPromise;
  }

  async function ensureProjectAccess(projectId: string, options?: { allowBootstrap?: boolean }): Promise<boolean> {
    const trimmedProjectId = projectId?.trim();
    if (!trimmedProjectId) return false;
    if (roleRoomProjectAccessCache.has(trimmedProjectId)) return true;
    const tableReady = await ensureCastingProjectsTable();
    if (!tableReady) {
      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    }
    try {
      const result = await pool.query('SELECT id FROM casting_projects WHERE id = $1 LIMIT 1', [trimmedProjectId]);
      if ((result.rowCount ?? 0) > 0) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }

      const allowBootstrap = options?.allowBootstrap ?? true;
      if (!allowBootstrap) {
        return false;
      }

      await pool.query(
        `INSERT INTO casting_projects
          (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [
          trimmedProjectId,
          normalizeRoleRoomProjectName(trimmedProjectId),
        ],
      );

      const postInsertResult = await pool.query(
        'SELECT id FROM casting_projects WHERE id = $1 LIMIT 1',
        [trimmedProjectId],
      );
      if ((postInsertResult.rowCount ?? 0) > 0) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }

      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    } catch {
      if (isRoleRoomDevBypassEnabled()) {
        roleRoomProjectAccessCache.add(trimmedProjectId);
        return true;
      }
      return false;
    }
  }

  let roleRoomCalendarEventsTableReadyPromise: Promise<boolean> | null = null;
  async function ensureRoleRoomCalendarEventsTable(): Promise<boolean> {
    if (roleRoomCalendarEventsTableReadyPromise) return roleRoomCalendarEventsTableReadyPromise;
    roleRoomCalendarEventsTableReadyPromise = (async () => {
      try {
        const castingProjectsReady = await ensureCastingProjectsTable();
        if (!castingProjectsReady) return false;
        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_room_calendar_events (
            id VARCHAR(255) PRIMARY KEY,
            project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            event_type VARCHAR(64) NOT NULL DEFAULT 'general',
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ,
            location_id VARCHAR(255),
            all_day BOOLEAN NOT NULL DEFAULT FALSE,
            candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            crew_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            shot_list_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_project ON role_room_calendar_events(project_id);
          CREATE INDEX IF NOT EXISTS idx_rr_calendar_events_start_time ON role_room_calendar_events(start_time);
        `);
        return true;
      } catch (error) {
        console.warn('Role Room calendar events table unavailable:', error);
        return false;
      }
    })();
    return roleRoomCalendarEventsTableReadyPromise;
  }

  function toStringArray(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
        }
      } catch {
        // ignore malformed json payloads
      }
      return raw.trim().length > 0 ? [raw.trim()] : [];
    }
    return [];
  }

  async function getLiveSetSessionsV2(projectId: string): Promise<LiveSetSessionV2[]> {
    const memory = liveSetSessionsStore.get(projectId);
    if (Array.isArray(memory)) return memory;
    const fromDb = await compatStoreGet<LiveSetSessionV2[]>(liveSetSessionsDbKey(projectId));
    if (Array.isArray(fromDb)) {
      liveSetSessionsStore.set(projectId, fromDb);
      return fromDb;
    }
    return [];
  }

  async function setLiveSetSessionsV2(projectId: string, sessions: LiveSetSessionV2[]): Promise<void> {
    liveSetSessionsStore.set(projectId, sessions);
    await compatStoreSet(liveSetSessionsDbKey(projectId), sessions.slice(-500));
  }

  async function getLiveSetEventsV2(projectId: string): Promise<LiveSetEventV2[]> {
    const memory = liveSetEventsV2Store.get(projectId);
    if (Array.isArray(memory)) return memory;
    const fromDb = await compatStoreGet<LiveSetEventV2[]>(liveSetEventsV2DbKey(projectId));
    if (Array.isArray(fromDb)) {
      liveSetEventsV2Store.set(projectId, fromDb);
      return fromDb;
    }
    return [];
  }

  async function setLiveSetEventsV2(projectId: string, events: LiveSetEventV2[]): Promise<void> {
    const trimmed = events.slice(-25000);
    liveSetEventsV2Store.set(projectId, trimmed);
    await compatStoreSet(liveSetEventsV2DbKey(projectId), trimmed);
  }

  async function getLiveSetAcks(projectId: string): Promise<Record<string, string[]>> {
    const memory = liveSetAckStore.get(projectId);
    if (memory && typeof memory === 'object') return memory;
    const fromDb = await compatStoreGet<Record<string, string[]>>(liveSetAckDbKey(projectId));
    if (fromDb && typeof fromDb === 'object') {
      liveSetAckStore.set(projectId, fromDb);
      return fromDb;
    }
    return {};
  }

  async function setLiveSetAcks(projectId: string, ackState: Record<string, string[]>): Promise<void> {
    liveSetAckStore.set(projectId, ackState);
    await compatStoreSet(liveSetAckDbKey(projectId), ackState);
  }

  function normalizeTakeStatus(raw: unknown): string {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : 'normal';
    if (value === 'circle') return 'circled';
    if (value === 'good') return 'selected';
    if (value === 'ok' || value === 'bad') return 'normal';
    if (['selected', 'circled', 'print', 'normal'].includes(value)) return value;
    return 'normal';
  }

  function statusPriority(raw: unknown): number {
    const normalized = normalizeTakeStatus(raw);
    if (normalized === 'selected') return 4;
    if (normalized === 'circled') return 3;
    if (normalized === 'print') return 2;
    return 1;
  }

  function extractTakeStatusSignal(event: LiveSetEventV2): { takeKey: string; status: string } | null {
    const payload = event.payload;
    const takeId = typeof payload.id === 'string'
      ? payload.id
      : typeof payload.takeId === 'string'
        ? payload.takeId
        : typeof payload.shotId === 'string'
          ? `shot:${payload.shotId}`
          : '';
    if (!takeId) return null;

    if (event.type === 'set_take_status') {
      return { takeKey: takeId, status: normalizeTakeStatus(payload.status) };
    }
    if (event.type === 'capture_take') {
      return { takeKey: takeId, status: normalizeTakeStatus(payload.quality ?? payload.status) };
    }
    return null;
  }

  const backupKeys = ['backupOriginal', 'backupPrimary', 'backupSecondary', 'backupOffsite'] as const;

  function hasBackupFields(payload: Record<string, unknown>): boolean {
    return backupKeys.some((field) => field in payload);
  }

  function toBoolean(raw: unknown): boolean {
    return raw === true;
  }

  interface WeatherCacheEntry {
    locationLabel: string;
    lat: number;
    lon: number;
    current: Record<string, unknown>;
    alerts: Array<Record<string, unknown>>;
    fetchedAt: number;
  }

  const liveWeatherCache = new Map<string, WeatherCacheEntry>();
  const LIVE_WEATHER_TTL_MS = 60_000;
  const LIVE_SET_RATE_LIMIT_WINDOW_MS = 10_000;
  const LIVE_SET_RATE_LIMIT_MAX_BATCHES = 20;

  const liveSetBatchRateLimit = new Map<string, { windowStart: number; count: number }>();
  const liveSetMetrics = {
    takeCaptureLatencyMs: [] as number[],
    syncQueueDepthSamples: [] as number[],
    syncFailures: 0,
    syncBatches: 0,
    weatherFetchErrors: 0,
  };

  function sampleMetric(values: number[], value: number, maxSamples = 1000): void {
    if (!Number.isFinite(value)) return;
    values.push(value);
    if (values.length > maxSamples) {
      values.splice(0, values.length - maxSamples);
    }
  }

  function isLiveSetBatchRateLimited(rateKey: string): boolean {
    const now = Date.now();
    const current = liveSetBatchRateLimit.get(rateKey);
    if (!current || now - current.windowStart > LIVE_SET_RATE_LIMIT_WINDOW_MS) {
      liveSetBatchRateLimit.set(rateKey, { windowStart: now, count: 1 });
      return false;
    }
    current.count += 1;
    liveSetBatchRateLimit.set(rateKey, current);
    return current.count > LIVE_SET_RATE_LIMIT_MAX_BATCHES;
  }

  function resolveWeatherCoordinates(location?: string, latRaw?: unknown, lonRaw?: unknown): {
    locationLabel: string;
    lat: number;
    lon: number;
  } {
    const lat = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : null;
    const lon = typeof lonRaw === 'number' && Number.isFinite(lonRaw) ? lonRaw : null;
    if (lat != null && lon != null) {
      return { locationLabel: location?.trim() || 'Scene', lat, lon };
    }

    const label = (location || 'oslo').trim().toLowerCase();
    const map: Record<string, { lat: number; lon: number; label: string }> = {
      oslo: { lat: 59.9139, lon: 10.7522, label: 'Oslo' },
      bergen: { lat: 60.3913, lon: 5.3221, label: 'Bergen' },
      trondheim: { lat: 63.4305, lon: 10.3951, label: 'Trondheim' },
      stavanger: { lat: 58.97, lon: 5.7331, label: 'Stavanger' },
      tromsø: { lat: 69.6492, lon: 18.9553, label: 'Tromsø' },
      kristiansand: { lat: 58.1467, lon: 7.9956, label: 'Kristiansand' },
    };
    const fallback = map[label] ?? map.oslo;
    return { locationLabel: fallback.label, lat: fallback.lat, lon: fallback.lon };
  }

  function normalizeWeatherAlerts(current: Record<string, unknown>): Array<Record<string, unknown>> {
    const alerts: Array<Record<string, unknown>> = [];
    const symbol = typeof current.symbolCode === 'string' ? current.symbolCode.toLowerCase() : '';
    const precipitation = typeof current.precipitation === 'number' ? current.precipitation : 0;
    const windSpeed = typeof current.windSpeed === 'number' ? current.windSpeed : 0;

    if (symbol.includes('thunder')) {
      alerts.push({
        id: `alert-thunder-${Date.now()}`,
        severity: 'critical',
        category: 'thunder',
        title: 'Tordenvær registrert',
        description: 'Sterk torden i området. Vurder å stoppe opptak utendørs.',
        recommendedAction: 'Stans utsatt opptak og sikre crew/utstyr.',
        blockingRisk: true,
        startsAt: nowISO(),
      });
    }
    if (windSpeed >= 14) {
      alerts.push({
        id: `alert-wind-${Date.now()}`,
        severity: windSpeed >= 20 ? 'critical' : 'warning',
        category: 'wind',
        title: 'Sterk vind varslet',
        description: `Vind opp til ${windSpeed} m/s.`,
        recommendedAction: 'Sikre lysrigg, stativer og lette rekvisitter.',
        blockingRisk: windSpeed >= 18,
        startsAt: nowISO(),
      });
    }
    if (precipitation >= 5) {
      alerts.push({
        id: `alert-rain-${Date.now()}`,
        severity: precipitation >= 8 ? 'critical' : 'warning',
        category: 'rain',
        title: 'Kraftig nedbør',
        description: `${precipitation} mm nedbør registrert/forventet.`,
        recommendedAction: 'Flytt til værbeskyttet oppsett eller dekk teknisk rigg.',
        blockingRisk: precipitation >= 8,
        startsAt: nowISO(),
      });
    }

    return alerts;
  }

  router.post('/projects/:projectId/live-set/sessions', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const parsed = liveSetSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig session payload', issues: parsed.error.issues });
      return;
    }

    const payload = parsed.data;
    const sessions = await getLiveSetSessionsV2(projectId);
    const existing = payload.sessionId
      ? sessions.find((entry) => entry.sessionId === payload.sessionId)
      : undefined;
    if (existing) {
      res.json({ success: true, session: existing });
      return;
    }

    const session: LiveSetSessionV2 = {
      sessionId: payload.sessionId || `liveset-${crypto.randomUUID()}`,
      projectId,
      operatorId: payload.operatorId,
      deviceId: payload.deviceId,
      shootingDayId: payload.shootingDayId,
      startedAt: nowISO(),
      metadata: payload.metadata,
    };
    sessions.push(session);
    await setLiveSetSessionsV2(projectId, sessions);
    await appendAudit(projectId, payload.shootingDayId ?? 'global', 'live_set_session_started', session, payload.operatorId);

    res.json({ success: true, session });
  });

  router.post('/projects/:projectId/live-set/events/batch', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const actorId = getUserId(req);
    const rateKey = `${projectId}:${actorId}`;
    if (isLiveSetBatchRateLimited(rateKey)) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded for live set batch ingest' });
      return;
    }

    const parsed = liveSetBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig batch payload', issues: parsed.error.issues });
      return;
    }

    const { sessionId, events } = parsed.data;
    const normalized = [...events].sort((left, right) => left.seq - right.seq);
    const sessions = await getLiveSetSessionsV2(projectId);
    const hasRegisteredSession = sessions.some((entry) => entry.sessionId === sessionId);
    if (!hasRegisteredSession) {
      const seedEvent = normalized[0];
      if (!seedEvent) {
        res.status(400).json({ success: false, error: 'Batch mangler events' });
        return;
      }

      const bootstrappedSession: LiveSetSessionV2 = {
        sessionId,
        projectId,
        operatorId: seedEvent.operatorId,
        deviceId: seedEvent.deviceId,
        shootingDayId: seedEvent.shootingDayId,
        startedAt: seedEvent.capturedAt || nowISO(),
        metadata: {
          source: 'batch-bootstrap',
        },
      };
      sessions.push(bootstrappedSession);
      await setLiveSetSessionsV2(projectId, sessions);
      await appendAudit(
        projectId,
        seedEvent.shootingDayId ?? 'global',
        'live_set_session_bootstrapped',
        {
          sessionId,
          operatorId: seedEvent.operatorId,
          deviceId: seedEvent.deviceId,
          seedEventId: seedEvent.eventId,
        },
        actorId,
      );
    }

    const storedEvents = await getLiveSetEventsV2(projectId);
    const existingById = new Map(storedEvents.map((event) => [event.eventId, event]));
    const highestSeqBySession = new Map<string, number>();
    const strongestStatusByTake = new Map<string, { status: string; priority: number; eventId: string }>();
    const backupState = {
      backupOriginal: false,
      backupPrimary: false,
      backupSecondary: false,
      backupOffsite: false,
    };

    for (const event of storedEvents) {
      highestSeqBySession.set(
        event.sessionId,
        Math.max(highestSeqBySession.get(event.sessionId) ?? 0, event.seq),
      );
      const signal = extractTakeStatusSignal(event);
      if (signal) {
        const priority = statusPriority(signal.status);
        const current = strongestStatusByTake.get(signal.takeKey);
        if (!current || priority >= current.priority) {
          strongestStatusByTake.set(signal.takeKey, { status: signal.status, priority, eventId: event.eventId });
        }
      }
      if (hasBackupFields(event.payload)) {
        backupKeys.forEach((field) => {
          if (toBoolean(event.payload[field])) {
            backupState[field] = true;
          }
        });
      }
    }

    const ackedEventIds: string[] = [];
    const rejected: Array<{ eventId: string; reason: string; code?: string }> = [];
    const conflicts: LiveSetConflictV2[] = [];
    const accepted: LiveSetEventV2[] = [];

    for (const incoming of normalized) {
      if (incoming.sessionId !== sessionId) {
        rejected.push({ eventId: incoming.eventId, reason: 'sessionId mismatch in batch', code: 'session_mismatch' });
        continue;
      }
      if (existingById.has(incoming.eventId)) {
        ackedEventIds.push(incoming.eventId);
        continue;
      }

      const highestSeq = highestSeqBySession.get(incoming.sessionId) ?? 0;
      if (incoming.seq <= highestSeq) {
        rejected.push({
          eventId: incoming.eventId,
          reason: `Sequence replay detected (${incoming.seq} <= ${highestSeq})`,
          code: 'seq_replay',
        });
        continue;
      }

      const payload: Record<string, unknown> = { ...incoming.payload };
      const event: LiveSetEventV2 = {
        eventId: incoming.eventId,
        sessionId: incoming.sessionId,
        seq: incoming.seq,
        type: incoming.type,
        payload,
        capturedAt: incoming.capturedAt,
        deviceId: incoming.deviceId,
        operatorId: incoming.operatorId,
        projectId,
        shootingDayId: incoming.shootingDayId,
        ingestedAt: nowISO(),
      };

      const signal = extractTakeStatusSignal(event);
      if (signal) {
        const incomingPriority = statusPriority(signal.status);
        const existing = strongestStatusByTake.get(signal.takeKey);
        if (existing && incomingPriority < existing.priority) {
          conflicts.push({
            eventId: event.eventId,
            sessionId: event.sessionId,
            seq: event.seq,
            type: 'take_status_priority',
            reason: 'Lower-priority take status was overridden by server',
            serverValue: existing.status,
            clientValue: signal.status,
            resolvedBy: 'server',
            timestamp: nowISO(),
          });
          payload.status = existing.status;
          payload.quality = existing.status;
        } else {
          strongestStatusByTake.set(signal.takeKey, {
            status: normalizeTakeStatus(payload.status ?? payload.quality),
            priority: Math.max(incomingPriority, existing?.priority ?? 0),
            eventId: event.eventId,
          });
        }
      }

      if (hasBackupFields(payload)) {
        backupKeys.forEach((field) => {
          if (backupState[field] && payload[field] === false) {
            conflicts.push({
              eventId: event.eventId,
              sessionId: event.sessionId,
              seq: event.seq,
              type: 'backup_monotonic',
              reason: `${field} cannot auto-downgrade once true`,
              serverValue: true,
              clientValue: false,
              resolvedBy: 'server',
              timestamp: nowISO(),
            });
            payload[field] = true;
          }
          if (toBoolean(payload[field])) {
            backupState[field] = true;
          }
        });
      }

      accepted.push(event);
      ackedEventIds.push(event.eventId);
      existingById.set(event.eventId, event);
      highestSeqBySession.set(event.sessionId, event.seq);
    }

    if (accepted.length > 0) {
      await setLiveSetEventsV2(projectId, [...storedEvents, ...accepted]);
      await appendAudit(projectId, accepted[0].shootingDayId ?? 'global', 'live_set_batch_ingest', {
        sessionId,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        conflictCount: conflicts.length,
      }, actorId);
      const now = Date.now();
      accepted.forEach((event) => {
        const captured = Date.parse(event.capturedAt);
        if (Number.isFinite(captured)) {
          sampleMetric(liveSetMetrics.takeCaptureLatencyMs, Math.max(0, now - captured));
        }
      });
    }

    liveSetMetrics.syncBatches += 1;
    if (rejected.length > 0) {
      liveSetMetrics.syncFailures += 1;
    }
    sampleMetric(liveSetMetrics.syncQueueDepthSamples, normalized.length);
    console.info('[liveset.batch_ingest]', {
      projectId,
      sessionId,
      actorId,
      batchSize: normalized.length,
      accepted: accepted.length,
      rejected: rejected.length,
      conflicts: conflicts.length,
      firstEventId: normalized[0]?.eventId,
      lastEventId: normalized[normalized.length - 1]?.eventId,
    });

    res.json({
      success: true,
      ackedEventIds,
      rejected,
      conflicts,
      serverTime: nowISO(),
    });
  });

  router.get('/projects/:projectId/live-set/events', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '';
    const sinceTs = sinceRaw ? Date.parse(sinceRaw) : NaN;
    const events = await getLiveSetEventsV2(projectId);
    const filtered = Number.isFinite(sinceTs)
      ? events.filter((event) => {
          const captured = Date.parse(event.capturedAt || event.ingestedAt);
          return Number.isFinite(captured) && captured > sinceTs;
        })
      : events;

    res.json({
      success: true,
      events: filtered.slice(-5000),
      conflicts: [],
      serverCursor: nowISO(),
    });
  });

  router.post('/projects/:projectId/live-set/sync/ack', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    const parsed = liveSetAckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ugyldig ack payload', issues: parsed.error.issues });
      return;
    }

    const { sessionId, eventIds } = parsed.data;
    const events = await getLiveSetEventsV2(projectId);
    const knownSet = new Set(events.map((event) => event.eventId));
    const ackedEventIds = eventIds.filter((eventId) => knownSet.has(eventId));
    const unknownEventIds = eventIds.filter((eventId) => !knownSet.has(eventId));

    const ackState = await getLiveSetAcks(projectId);
    const prev = Array.isArray(ackState[sessionId]) ? ackState[sessionId] : [];
    const merged = Array.from(new Set([...prev, ...ackedEventIds])).slice(-25000);
    ackState[sessionId] = merged;
    await setLiveSetAcks(projectId, ackState);

    res.json({
      success: true,
      ackedEventIds,
      unknownEventIds,
    });
  });

  router.get('/projects/:projectId/live-set/health', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!(await ensureProjectAccess(projectId))) {
      res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      return;
    }

    let dbStatus: 'ok' | 'degraded' | 'down' = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'down';
    }

    let weatherStatus: 'ok' | 'degraded' | 'down' = 'ok';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const weatherRes = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.9139&lon=10.7522', {
        headers: { 'User-Agent': 'CreatorHub-RoleRoom/1.0 https://creatorhub.no' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      weatherStatus = weatherRes.ok ? 'ok' : 'degraded';
    } catch {
      weatherStatus = 'degraded';
    }

    const websocketStatus: 'ok' | 'degraded' | 'down' =
      process.env.DISABLE_WEBSOCKET === '1' ? 'down' : 'ok';

    const hasDown = dbStatus === 'down' || websocketStatus === 'down';
    const hasDegraded = weatherStatus === 'degraded';
    const status: 'ok' | 'degraded' | 'down' =
      hasDown
        ? 'down'
        : hasDegraded
          ? 'degraded'
          : 'ok';

    res.json({
      success: true,
      status,
      dependencies: {
        db: dbStatus,
        weatherUpstream: weatherStatus,
        websocket: websocketStatus,
      },
      metrics: {
        take_capture_latency_ms: liveSetMetrics.takeCaptureLatencyMs.length > 0
          ? Math.round(liveSetMetrics.takeCaptureLatencyMs.reduce((sum, value) => sum + value, 0) / liveSetMetrics.takeCaptureLatencyMs.length)
          : 0,
        sync_queue_depth: liveSetMetrics.syncQueueDepthSamples.length > 0
          ? Math.round(liveSetMetrics.syncQueueDepthSamples.reduce((sum, value) => sum + value, 0) / liveSetMetrics.syncQueueDepthSamples.length)
          : 0,
        sync_failure_rate: liveSetMetrics.syncBatches > 0
          ? Number((liveSetMetrics.syncFailures / liveSetMetrics.syncBatches).toFixed(4))
          : 0,
        weather_fetch_error_rate: liveSetMetrics.syncBatches > 0
          ? Number((liveSetMetrics.weatherFetchErrors / liveSetMetrics.syncBatches).toFixed(4))
          : 0,
      },
      timestamp: nowISO(),
    });
  });

  router.get('/projects/:projectId/live-set/weather', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const hasProjectAccess = await ensureProjectAccess(projectId);
    if (!hasProjectAccess) {
      // Weather should still work for local/demo projects that are not yet persisted in backend DB.
      // We keep auth but allow weather fetch by location-only context.
      console.warn('[liveset.weather] project not found in DB, falling back to location-only weather', { projectId });
    }

    const location = typeof req.query.location === 'string' ? req.query.location : undefined;
    const lat = typeof req.query.lat === 'string' ? Number(req.query.lat) : undefined;
    const lon = typeof req.query.lon === 'string' ? Number(req.query.lon) : undefined;
    const coords = resolveWeatherCoordinates(location, lat, lon);
    const cacheKey = `${coords.locationLabel}:${coords.lat.toFixed(4)}:${coords.lon.toFixed(4)}`;
    const cached = liveWeatherCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < LIVE_WEATHER_TTL_MS) {
      res.json({
        success: true,
        current: cached.current,
        alerts: cached.alerts,
        cache: { hit: true, ttlMs: Math.max(0, LIVE_WEATHER_TTL_MS - (now - cached.fetchedAt)) },
      });
      return;
    }

    try {
      const weatherRes = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${coords.lat.toFixed(4)}&lon=${coords.lon.toFixed(4)}`,
        { headers: { 'User-Agent': 'CreatorHub-RoleRoom/1.0 https://creatorhub.no' } },
      );
      if (!weatherRes.ok) {
        throw new Error(`Weather upstream status ${weatherRes.status}`);
      }
      const weatherPayload = await weatherRes.json() as Record<string, unknown>;
      const timeseries = Array.isArray((weatherPayload as { properties?: { timeseries?: unknown[] } }).properties?.timeseries)
        ? ((weatherPayload as { properties?: { timeseries?: unknown[] } }).properties?.timeseries as Array<Record<string, unknown>>)
        : [];
      const first = timeseries[0] ?? {};
      const details = ((first.data as { instant?: { details?: Record<string, unknown> } })?.instant?.details) ?? {};
      const nextHour = ((first.data as { next_1_hours?: { details?: Record<string, unknown>; summary?: Record<string, unknown> } })?.next_1_hours) ?? {};
      const current = {
        location: coords.locationLabel,
        temperature: typeof details.air_temperature === 'number' ? details.air_temperature : undefined,
        precipitation: typeof nextHour.details?.precipitation_amount === 'number' ? nextHour.details.precipitation_amount : 0,
        windSpeed: typeof details.wind_speed === 'number' ? details.wind_speed : 0,
        symbolCode: typeof nextHour.summary?.symbol_code === 'string' ? nextHour.summary.symbol_code : undefined,
        source: 'yr_api',
        timestamp: typeof first.time === 'string' ? first.time : nowISO(),
      };
      const alerts = normalizeWeatherAlerts(current);
      const entry: WeatherCacheEntry = {
        locationLabel: coords.locationLabel,
        lat: coords.lat,
        lon: coords.lon,
        current,
        alerts,
        fetchedAt: Date.now(),
      };
      liveWeatherCache.set(cacheKey, entry);

      res.json({
        success: true,
        current,
        alerts,
        cache: { hit: false, ttlMs: LIVE_WEATHER_TTL_MS },
      });
    } catch (error) {
      liveSetMetrics.weatherFetchErrors += 1;
      if (cached) {
        res.json({
          success: true,
          current: cached.current,
          alerts: cached.alerts,
          cache: { hit: true, ttlMs: 0, stale: true },
          warning: error instanceof Error ? error.message : 'Weather upstream failed',
        });
        return;
      }
      res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Weather upstream failed' });
    }
  });

  type TakeStatus = 'good' | 'ok' | 'bad' | 'circle' | 'print';

  interface TakeRow {
    id: string; projectId: string; shootingDayId: string;
    sceneId: string; shotId: string; takeNumber: number;
    status: TakeStatus; duration: number;
    cameraId: string; camera?: string; lens?: string;
    fps?: number; iso?: number; ndFilter?: string;
    notes?: string; loggedBy?: string; loggedAt: string;
  }

  interface NoteRow {
    id: string; projectId: string; shootingDayId: string;
    sceneId: string; shotId?: string; takeId?: string;
    type: string; note: string; timestamp: string; createdBy: string;
  }

  // In-memory caches backed by legacy_compat_store for persistence across restarts
  const liveStatusStore  = new Map<string, Record<string, unknown>>();
  const takesStore       = new Map<string, TakeRow[]>();
  const notesStore       = new Map<string, NoteRow[]>();
  const auditLog         = new Map<string, Array<{ action: string; payload: unknown; userId: string; ts: string }>>();

  const storeKey = (pid: string, did: string) => `${pid}:${did}`;
  const livesetStatusDbKey = (pid: string, did: string) => `role-room:liveset:status:${pid}:${did}`;
  const livesetTakesDbKey = (pid: string, did: string) => `role-room:liveset:takes:${pid}:${did}`;
  const livesetNotesDbKey = (pid: string, did: string) => `role-room:liveset:notes:${pid}:${did}`;
  const livesetAuditDbKey = (pid: string, did: string) => `role-room:liveset:audit:${pid}:${did}`;

  async function getLiveStatus(pid: string, did: string): Promise<Record<string, unknown> | null> {
    const memory = liveStatusStore.get(storeKey(pid, did));
    if (memory) return memory;
    const dbValue = await compatStoreGet<Record<string, unknown>>(livesetStatusDbKey(pid, did));
    if (dbValue && typeof dbValue === 'object') {
      liveStatusStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return null;
  }

  async function getLiveTakes(pid: string, did: string): Promise<TakeRow[]> {
    const memory = takesStore.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<TakeRow[]>(livesetTakesDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      takesStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function getLiveNotes(pid: string, did: string): Promise<NoteRow[]> {
    const memory = notesStore.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<NoteRow[]>(livesetNotesDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      notesStore.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function getLiveAudit(pid: string, did: string): Promise<Array<{ action: string; payload: unknown; userId: string; ts: string }>> {
    const memory = auditLog.get(storeKey(pid, did));
    if (Array.isArray(memory)) return memory;
    const dbValue = await compatStoreGet<Array<{ action: string; payload: unknown; userId: string; ts: string }>>(livesetAuditDbKey(pid, did));
    if (Array.isArray(dbValue)) {
      auditLog.set(storeKey(pid, did), dbValue);
      return dbValue;
    }
    return [];
  }

  async function appendAudit(pid: string, did: string, action: string, payload: unknown, userId: string) {
    const k = storeKey(pid, did);
    const log = await getLiveAudit(pid, did);
    log.push({ action, payload, userId, ts: new Date().toISOString() });
    const trimmed = log.slice(-500); // keep last 500
    auditLog.set(k, trimmed);
    await compatStoreSet(livesetAuditDbKey(pid, did), trimmed);
  }

  // GET /api/liveset/:projectId/status?shootingDayId=
  router.get('/liveset/:projectId/status', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    const status = (await getLiveStatus(projectId, did)) ?? {
      currentScene: null, currentShot: null, currentTake: 1,
      isRolling: false, lastAction: '', lastActionTime: new Date().toISOString(),
    };
    res.json(status);
  });

  // POST /api/liveset/:projectId/roll
  router.post('/liveset/:projectId/roll', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !sceneId || !shotId) return res.status(400).json({ error: 'shootingDayId, sceneId, shotId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = (await getLiveStatus(projectId, shootingDayId)) ?? {};
    const next = { ...prev, currentScene: sceneId, currentShot: shotId, isRolling: true,
      lastAction: 'ROLLING', lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, next);
    await compatStoreSet(livesetStatusDbKey(projectId, shootingDayId), next);
    await appendAudit(projectId, shootingDayId, 'roll', { sceneId, shotId }, userId ?? 'unknown');
    res.json(next);
  });

  // POST /api/liveset/:projectId/cut
  router.post('/liveset/:projectId/cut', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, status, notes, cameraId, camera, lens, fps, iso, ndFilter,
            nextTake, loggedBy } = req.body as Record<string, string | number>;
    if (!shootingDayId || !status) return res.status(400).json({ error: 'shootingDayId, status required' });
    const k = storeKey(projectId, String(shootingDayId));
    const prev = ((await getLiveStatus(projectId, String(shootingDayId))) ?? { currentScene: null, currentShot: null, currentTake: 1 }) as Record<string, unknown>;
    const take: TakeRow = {
      id: `take-${Date.now()}`,
      projectId, shootingDayId: String(shootingDayId),
      sceneId:    String(prev.currentScene ?? ''),
      shotId:     String(prev.currentShot  ?? ''),
      takeNumber: Number(prev.currentTake  ?? 1),
      status:     status as TakeStatus,
      duration:   0, // TODO: compute from roll→cut timestamps
      cameraId:   String(cameraId ?? 'A'),
      camera:     camera  ? String(camera)  : undefined,
      lens:       lens    ? String(lens)    : undefined,
      fps:        fps     ? Number(fps)     : undefined,
      iso:        iso     ? Number(iso)     : undefined,
      ndFilter:   ndFilter ? String(ndFilter): undefined,
      notes:      notes   ? String(notes)   : undefined,
      loggedBy:   loggedBy ? String(loggedBy): undefined,
      loggedAt:   new Date().toISOString(),
    };
    const takes = await getLiveTakes(projectId, String(shootingDayId));
    takes.push(take);
    takesStore.set(k, takes);
    await compatStoreSet(livesetTakesDbKey(projectId, String(shootingDayId)), takes);
    const resolvedNext = nextTake ? Number(nextTake) : Number(prev.currentTake ?? 1) + 1;
    const nextStatus = { ...prev, currentTake: resolvedNext, isRolling: false,
      lastAction: `CUT - ${String(status).toUpperCase()}`, lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, nextStatus);
    await compatStoreSet(livesetStatusDbKey(projectId, String(shootingDayId)), nextStatus);
    await appendAudit(projectId, String(shootingDayId), 'cut', take, String(loggedBy ?? 'unknown'));
    res.json(take);
  });

  // POST /api/liveset/:projectId/circle
  router.post('/liveset/:projectId/circle', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, takeId, userId } = req.body as Record<string, string>;
    if (!shootingDayId || !takeId) return res.status(400).json({ error: 'shootingDayId, takeId required' });
    const k = storeKey(projectId, shootingDayId);
    const takes = await getLiveTakes(projectId, shootingDayId);
    const take = takes.find(t => t.id === takeId);
    if (!take) return res.status(404).json({ error: 'Take not found' });
    take.status = 'circle';
    takesStore.set(k, takes);
    await compatStoreSet(livesetTakesDbKey(projectId, shootingDayId), takes);
    await appendAudit(projectId, shootingDayId, 'circle_take', { takeId }, userId ?? 'unknown');
    res.json(take);
  });

  // GET /api/liveset/:projectId/takes?shootingDayId=
  router.get('/liveset/:projectId/takes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveTakes(projectId, did));
  });

  // POST /api/liveset/:projectId/notes
  router.post('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, takeId, type, note, createdBy } = req.body as Record<string, string>;
    if (!shootingDayId || !sceneId || !note) return res.status(400).json({ error: 'shootingDayId, sceneId, note required' });
    const k = storeKey(projectId, shootingDayId);
    const entry: NoteRow = {
      id: `note-${Date.now()}`,
      projectId, shootingDayId, sceneId, shotId, takeId,
      type:       type ?? 'general',
      note,
      timestamp:  new Date().toISOString(),
      createdBy:  createdBy ?? 'unknown',
    };
    const notes = await getLiveNotes(projectId, shootingDayId);
    notes.push(entry);
    notesStore.set(k, notes);
    await compatStoreSet(livesetNotesDbKey(projectId, shootingDayId), notes);
    await appendAudit(projectId, shootingDayId, 'add_note', entry, createdBy ?? 'unknown');
    res.json(entry);
  });

  // GET /api/liveset/:projectId/notes?shootingDayId=
  router.get('/liveset/:projectId/notes', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveNotes(projectId, did));
  });

  // POST /api/liveset/:projectId/setup-complete
  router.post('/liveset/:projectId/setup-complete', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { shootingDayId, sceneId, shotId, userId } = req.body as Record<string, string>;
    if (!shootingDayId) return res.status(400).json({ error: 'shootingDayId required' });
    const k = storeKey(projectId, shootingDayId);
    const prev = (await getLiveStatus(projectId, shootingDayId)) ?? {};
    const next = { ...prev, currentTake: 1, isRolling: false,
      lastAction: `SETUP COMPLETE — ${sceneId}/${shotId} — av ${userId}`,
      lastActionTime: new Date().toISOString() };
    liveStatusStore.set(k, next);
    await compatStoreSet(livesetStatusDbKey(projectId, shootingDayId), next);
    await appendAudit(projectId, shootingDayId, 'setup_complete', { sceneId, shotId }, userId ?? 'unknown');
    res.json({ ok: true });
  });

  // GET /api/liveset/:projectId/audit?shootingDayId=
  router.get('/liveset/:projectId/audit', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const did = req.query.shootingDayId as string;
    if (!did) return res.status(400).json({ error: 'shootingDayId required' });
    res.json(await getLiveAudit(projectId, did));
  });

  // ══════════════════════════════════════════════════════════
  //  MEMORY CARD BACKUP CONTROL (Shotlist-linked production log)
  // ══════════════════════════════════════════════════════════

  const defaultMemoryCardControlState = () => ({
    shootDayLabel: '',
    entries: [] as Array<Record<string, unknown>>,
    updatedAt: nowISO(),
  });

  const sanitizeMemoryCardControlState = (raw: unknown) => {
    const fallback = defaultMemoryCardControlState();
    if (!raw || typeof raw !== 'object') return fallback;
    const value = raw as Record<string, unknown>;

    const shootDayLabel =
      typeof value.shootDayLabel === 'string' ? value.shootDayLabel.trim() : fallback.shootDayLabel;
    const updatedAt =
      typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : nowISO();
    const entries = Array.isArray(value.entries)
      ? value.entries
          .filter((entry) => entry && typeof entry === 'object')
          .slice(0, 1500)
          .map((entry) => entry as Record<string, unknown>)
      : fallback.entries;

    return {
      shootDayLabel,
      entries,
      updatedAt,
    };
  };

  const computeMemoryCardControlReport = (state: {
    shootDayLabel: string;
    entries: Array<Record<string, unknown>>;
    updatedAt: string;
  }) => {
    const total = state.entries.length;
    const statusCounts = {
      not_backed_up: 0,
      backing_up: 0,
      verified: 0,
    };
    const lifecycleCounts = new Map<string, number>();
    const crewCounts = new Map<string, number>();
    let checksumVerifiedCount = 0;
    let fullyCompliantCount = 0;
    let offsiteCount = 0;
    let backup1Count = 0;
    let backup2Count = 0;

    const pendingOverSixHours: Array<{
      id: string;
      cardLabel: string;
      hours: number;
      updatedAt: string;
    }> = [];

    const duplicateLabelSet = new Set<string>();
    const knownLabels = new Set<string>();

    for (const entry of state.entries) {
      const status = typeof entry.status === 'string' ? entry.status : 'not_backed_up';
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts] += 1;
      }

      const lifecycleStage = typeof entry.lifecycleStage === 'string' ? entry.lifecycleStage : 'in_use';
      lifecycleCounts.set(lifecycleStage, (lifecycleCounts.get(lifecycleStage) ?? 0) + 1);

      const crewName = typeof entry.assignedCrewName === 'string' ? entry.assignedCrewName.trim() : '';
      if (crewName) {
        crewCounts.set(crewName, (crewCounts.get(crewName) ?? 0) + 1);
      }

      const cardLabel = typeof entry.cardLabel === 'string' ? entry.cardLabel.trim().toUpperCase() : '';
      if (cardLabel) {
        if (knownLabels.has(cardLabel)) duplicateLabelSet.add(cardLabel);
        knownLabels.add(cardLabel);
      }

      const backups = entry.backups && typeof entry.backups === 'object'
        ? (entry.backups as Record<string, unknown>)
        : {};
      const backup1 = Boolean(backups.backup1);
      const backup2 = Boolean(backups.backup2);
      const offsite = Boolean(backups.offsite);
      const checksumVerified = Boolean(entry.checksumVerified);

      if (backup1) backup1Count += 1;
      if (backup2) backup2Count += 1;
      if (offsite) offsiteCount += 1;
      if (checksumVerified) checksumVerifiedCount += 1;
      if (backup1 && backup2 && offsite && checksumVerified) {
        fullyCompliantCount += 1;
      }

      const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : '';
      const updatedTime = Date.parse(updatedAt);
      if (status !== 'verified' && Number.isFinite(updatedTime)) {
        const ageHours = (Date.now() - updatedTime) / (1000 * 60 * 60);
        if (ageHours >= 6) {
          pendingOverSixHours.push({
            id: typeof entry.id === 'string' ? entry.id : `entry-${pendingOverSixHours.length + 1}`,
            cardLabel: cardLabel || 'Uten etikett',
            hours: Math.round(ageHours),
            updatedAt,
          });
        }
      }
    }

    const compliancePercent = total > 0 ? Math.round((fullyCompliantCount / total) * 100) : 100;
    const copyCoveragePercent = total > 0 ? Math.round((backup1Count / total) * 100) : 100;
    const dualMediaCoveragePercent = total > 0 ? Math.round((backup2Count / total) * 100) : 100;
    const offsiteCoveragePercent = total > 0 ? Math.round((offsiteCount / total) * 100) : 100;

    const risks: string[] = [];
    if (statusCounts.not_backed_up > 0) risks.push(`${statusCounts.not_backed_up} lagringsenheter er ikke sikkerhetskopiert`);
    if (offsiteCount < total && total > 0) risks.push(`Manglende offsite-kopi på ${total - offsiteCount} lagringsenheter`);
    if (duplicateLabelSet.size > 0) risks.push(`Dupliserte etiketter: ${Array.from(duplicateLabelSet).join(', ')}`);
    if (pendingOverSixHours.length > 0) risks.push(`${pendingOverSixHours.length} enheter har vært uverifisert i over 6 timer`);

    return {
      shootDayLabel: state.shootDayLabel,
      updatedAt: state.updatedAt,
      summary: {
        total,
        notBackedUp: statusCounts.not_backed_up,
        backingUp: statusCounts.backing_up,
        verified: statusCounts.verified,
        checksumVerified: checksumVerifiedCount,
        fullyCompliant: fullyCompliantCount,
        compliancePercent,
        copyCoveragePercent,
        dualMediaCoveragePercent,
        offsiteCoveragePercent,
      },
      counts: {
        status: statusCounts,
        lifecycle: Array.from(lifecycleCounts.entries()).map(([key, value]) => ({ key, value })),
        crew: Array.from(crewCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([crewName, count]) => ({ crewName, count })),
      },
      alerts: {
        riskLevel: compliancePercent >= 90 ? 'low' : compliancePercent >= 70 ? 'medium' : 'high',
        risks,
        pendingOverSixHours: pendingOverSixHours.slice(0, 50),
      },
      rule321: {
        description: '3-2-1-regel: 3 kopier (original + 2 backup), 2 medier (SSD + RAID/NAS), 1 offsite.',
        original: total,
        backup1: backup1Count,
        backup2: backup2Count,
        offsite: offsiteCount,
      },
    };
  };

  router.get('/projects/:projectId/memory-card-control', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const settingsValue = result.rows[0]?.settings;
      const settings =
        settingsValue && typeof settingsValue === 'object'
          ? (settingsValue as Record<string, unknown>)
          : {};
      const controlState = sanitizeMemoryCardControlState(settings.memoryCardControl);

      res.json({
        state: controlState,
        source: 'casting_projects.settings.memoryCardControl',
      });
    } catch (err) {
      console.error('GET memory-card-control error:', err);
      res.status(500).json({ error: 'Kunne ikke hente minnekortkontroll' });
    }
  });

  router.put('/projects/:projectId/memory-card-control', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      if (!requireScope(req, 'write')) {
        res.status(403).json({ error: 'Skrive-tilgang kreves' });
        return;
      }

      const { projectId } = req.params;
      const body = req.body as Record<string, unknown>;
      const nextState = sanitizeMemoryCardControlState(body.state ?? body);

      const existing = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (existing.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const currentSettingsValue = existing.rows[0]?.settings;
      const currentSettings =
        currentSettingsValue && typeof currentSettingsValue === 'object'
          ? (currentSettingsValue as Record<string, unknown>)
          : {};

      const updatedSettings = {
        ...currentSettings,
        memoryCardControl: {
          ...nextState,
          updatedAt: nowISO(),
        },
      };

      await pool.query(
        'UPDATE casting_projects SET settings = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updatedSettings), projectId]
      );

      res.json({
        ok: true,
        state: updatedSettings.memoryCardControl,
      });
    } catch (err) {
      console.error('PUT memory-card-control error:', err);
      res.status(500).json({ error: 'Kunne ikke lagre minnekortkontroll' });
    }
  });

  router.get('/projects/:projectId/memory-card-control/report', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await pool.query<{ settings: unknown }>(
        'SELECT settings FROM casting_projects WHERE id = $1',
        [projectId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Prosjekt ikke funnet' });
        return;
      }

      const settingsValue = result.rows[0]?.settings;
      const settings =
        settingsValue && typeof settingsValue === 'object'
          ? (settingsValue as Record<string, unknown>)
          : {};
      const state = sanitizeMemoryCardControlState(settings.memoryCardControl);
      const report = computeMemoryCardControlReport(state);

      res.json({
        ok: true,
        projectId,
        report,
      });
    } catch (err) {
      console.error('GET memory-card-control report error:', err);
      res.status(500).json({ error: 'Kunne ikke hente minnekort-rapport' });
    }
  });

  router.post('/projects/:projectId/memory-card-control/qr-label', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const body = req.body as Record<string, unknown>;
      const requestedEntryId = typeof body.entryId === 'string' ? body.entryId : '';

      let selectedEntry: Record<string, unknown> | null = null;
      let shootDayLabel = typeof body.shootDayLabel === 'string' ? body.shootDayLabel : '';

      if (requestedEntryId) {
        const result = await pool.query<{ settings: unknown }>(
          'SELECT settings FROM casting_projects WHERE id = $1',
          [projectId]
        );
        if ((result.rowCount ?? 0) > 0) {
          const settingsValue = result.rows[0]?.settings;
          const settings =
            settingsValue && typeof settingsValue === 'object'
              ? (settingsValue as Record<string, unknown>)
              : {};
          const state = sanitizeMemoryCardControlState(settings.memoryCardControl);
          shootDayLabel = shootDayLabel || state.shootDayLabel;
          selectedEntry =
            state.entries.find(
              (entry) =>
                entry &&
                typeof entry === 'object' &&
                (entry as Record<string, unknown>).id === requestedEntryId
            ) ?? null;
        }
      }

      const cardLabel =
        typeof body.cardLabel === 'string'
          ? body.cardLabel.trim()
          : typeof selectedEntry?.cardLabel === 'string'
          ? selectedEntry.cardLabel.trim()
          : '';
      const cameraLabel =
        typeof body.cameraLabel === 'string'
          ? body.cameraLabel.trim()
          : typeof selectedEntry?.cameraLabel === 'string'
          ? selectedEntry.cameraLabel.trim()
          : '';
      const capacity =
        typeof body.capacity === 'string'
          ? body.capacity.trim()
          : typeof selectedEntry?.capacity === 'string'
          ? selectedEntry.capacity.trim()
          : '';
      const storageType =
        typeof body.storageType === 'string'
          ? body.storageType.trim()
          : typeof selectedEntry?.cardTypeName === 'string'
          ? selectedEntry.cardTypeName.trim()
          : '';

      if (!cardLabel) {
        res.status(400).json({ error: 'cardLabel er påkrevd for QR-etikett' });
        return;
      }

      const payload = {
        schema: 'role-room.memory-card-control.label.v1',
        projectId,
        entryId: requestedEntryId || (typeof selectedEntry?.id === 'string' ? selectedEntry.id : null),
        cardLabel,
        cameraLabel: cameraLabel || null,
        capacity: capacity || null,
        storageType: storageType || null,
        shootDayLabel: shootDayLabel || null,
        generatedAt: nowISO(),
      };
      const payloadString = JSON.stringify(payload);
      const qrDataUrl = await QRCode.toDataURL(payloadString, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
      });
      const safeLabel = cardLabel.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 48) || 'lagringsenhet';

      res.json({
        ok: true,
        payload,
        payloadString,
        qrDataUrl,
        suggestedFileName: `${safeLabel}-qr.png`,
      });
    } catch (err) {
      console.error('POST memory-card-control qr-label error:', err);
      res.status(500).json({ error: 'Kunne ikke generere QR-etikett' });
    }
  });

  // ══════════════════════════════════════════════════════════
  //  EQUIPMENT MANAGEMENT SYSTEM
  // ══════════════════════════════════════════════════════════

  const db2 = drizzle(pool, { schema: roleRoomSchema });
  const { castingEquipment, equipmentBookings, equipmentCheckouts, equipmentTemplates } = roleRoomSchema;

  // ── Inventory ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment
  router.get('/projects/:projectId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const rows = await db2
        .select()
        .from(castingEquipment)
        .where(or(
          eq(castingEquipment.projectId, projectId),
          eq(castingEquipment.isGlobal, true),
        ))
        .orderBy(desc(castingEquipment.createdAt));
      res.json({ equipment: rows });
    } catch (e) {
      console.error('GET equipment error:', e);
      res.status(500).json({ error: 'Failed to load equipment' });
    }
  });

  // POST /equipment  — create
  router.post('/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { project_id, name } = body as { project_id?: string; name?: string };
      if (!project_id || !name) return res.status(400).json({ error: 'project_id and name required' });
      const [row] = await db2
        .insert(castingEquipment)
        .values({
          projectId: project_id as string,
          name: name as string,
          brand: (body.brand as string) ?? null,
          model: (body.model as string) ?? null,
          category: (body.category as string) ?? null,
          status: (body.status as string) ?? 'available',
          condition: (body.condition as string) ?? 'good',
          serialNumber: (body.serial_number as string) ?? null,
          purchaseDate: (body.purchase_date as string) ?? null,
          purchasePrice: (body.purchase_price as string) ?? null,
          rentalRateDay: (body.rental_rate_day as string) ?? null,
          quantity: typeof body.quantity === 'number' ? body.quantity : 1,
          notes: (body.notes as string) ?? null,
          imageUrl: (body.image_url as string) ?? null,
          vendorUrl: (body.vendor_url as string) ?? null,
          isGlobal: Boolean(body.is_global),
          tags: Array.isArray(body.tags) ? body.tags : [],
          location: (body.location as string) ?? null,
          assignees: Array.isArray(body.assignees) ? body.assignees : [],
          bookingStart: (body.booking_start as string) ?? null,
          bookingEnd: (body.booking_end as string) ?? null,
          metadata: (body.metadata as Record<string, unknown>) ?? {},
          createdBy: getUserId(req),
        })
        .returning();
      res.status(201).json({ equipment: row });
    } catch (e) {
      console.error('POST equipment error:', e);
      res.status(500).json({ error: 'Failed to create equipment' });
    }
  });

  // PUT /equipment/:id  — update
  router.put('/equipment/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      const FIELDS: Record<string, string> = {
        name: 'name', brand: 'brand', model: 'model', category: 'category',
        status: 'status', condition: 'condition', serial_number: 'serialNumber',
        purchase_date: 'purchaseDate', purchase_price: 'purchasePrice',
        rental_rate_day: 'rentalRateDay', quantity: 'quantity',
        notes: 'notes', image_url: 'imageUrl', vendor_url: 'vendorUrl',
        is_global: 'isGlobal', tags: 'tags', location: 'location',
        assignees: 'assignees', booking_start: 'bookingStart',
        booking_end: 'bookingEnd', metadata: 'metadata',
      };
      for (const [bodyKey, schemaKey] of Object.entries(FIELDS)) {
        if (bodyKey in body) patch[schemaKey] = body[bodyKey];
      }
      patch.updatedAt = new Date().toISOString();
      const [row] = await db2
        .update(castingEquipment)
        .set(patch)
        .where(eq(castingEquipment.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Equipment not found' });
      res.json({ equipment: row });
    } catch (e) {
      console.error('PUT equipment error:', e);
      res.status(500).json({ error: 'Failed to update equipment' });
    }
  });

  // DELETE /equipment/:id
  router.delete('/equipment/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db2.delete(castingEquipment).where(eq(castingEquipment.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE equipment error:', e);
      res.status(500).json({ error: 'Failed to delete equipment' });
    }
  });

  // POST /equipment/:id/assign  — assign a crew member
  router.post('/equipment/:id/assign', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { crew_id } = req.body as { crew_id?: string };
      if (!crew_id) return res.status(400).json({ error: 'crew_id required' });
      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });
      const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
      if (!existing.includes(crew_id)) {
        await db2.update(castingEquipment)
          .set({ assignees: [...existing, crew_id], status: 'in_use', updatedAt: new Date().toISOString() })
          .where(eq(castingEquipment.id, id));
      }
      const [updated] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      res.json({ equipment: updated });
    } catch (e) {
      console.error('POST assign error:', e);
      res.status(500).json({ error: 'Failed to assign equipment' });
    }
  });

  // DELETE /equipment/:id/assign/:crewId  — unassign
  router.delete('/equipment/:id/assign/:crewId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id, crewId } = req.params;
      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });
      const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
      const next = existing.filter(c => c !== crewId);
      await db2.update(castingEquipment)
        .set({ assignees: next, status: next.length === 0 ? 'available' : 'in_use', updatedAt: new Date().toISOString() })
        .where(eq(castingEquipment.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE assign error:', e);
      res.status(500).json({ error: 'Failed to unassign equipment' });
    }
  });

  // POST /equipment/bulk-assign
  router.post('/equipment/bulk-assign', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { equipment_ids, crew_id } = req.body as { equipment_ids?: string[]; crew_id?: string };
      if (!equipment_ids?.length || !crew_id) return res.status(400).json({ error: 'equipment_ids and crew_id required' });
      for (const eqId of equipment_ids) {
        const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, eqId));
        if (!current) continue;
        const existing = Array.isArray(current.assignees) ? (current.assignees as string[]) : [];
        if (!existing.includes(crew_id)) {
          await db2.update(castingEquipment)
            .set({ assignees: [...existing, crew_id], status: 'in_use', updatedAt: new Date().toISOString() })
            .where(eq(castingEquipment.id, eqId));
        }
      }
      res.json({ ok: true, updated: equipment_ids.length });
    } catch (e) {
      console.error('POST bulk-assign error:', e);
      res.status(500).json({ error: 'Failed to bulk assign' });
    }
  });

  // GET /locations/:locationId/equipment
  router.get('/locations/:locationId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { locationId } = req.params;
      const rows = await db2.select().from(castingEquipment)
        .where(eq(castingEquipment.location, locationId));
      res.json({ equipment: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load location equipment' });
    }
  });

  // GET /crew/:crewId/equipment
  router.get('/crew/:crewId/equipment', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { crewId } = req.params;
      // assignees is a jsonb array of crew IDs
      const rows = await (pool.query(
        `SELECT * FROM casting_equipment WHERE assignees @> $1::jsonb`,
        [JSON.stringify([crewId])]
      ));
      res.json({ equipment: rows.rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load crew equipment' });
    }
  });

  // ── Bookings ─────────────────────────────────────────────

  // GET /equipment/:id/bookings
  router.get('/equipment/:id/bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await db2.select().from(equipmentBookings)
        .where(eq(equipmentBookings.equipmentId, id))
        .orderBy(desc(equipmentBookings.startDate));
      res.json({ bookings: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load bookings' });
    }
  });

  // GET /events/:eventId/equipment-bookings
  router.get('/events/:eventId/equipment-bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const rows = await db2.select().from(equipmentBookings)
        .where(eq(equipmentBookings.eventId, eventId));
      res.json({ bookings: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load event bookings' });
    }
  });

  // POST /equipment/:id/bookings
  router.post('/equipment/:id/bookings', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const { start_date, end_date } = body as { start_date?: string; end_date?: string };
      if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });
      const [row] = await db2.insert(equipmentBookings).values({
        equipmentId: id,
        projectId: body.project_id as string ?? '',
        bookedBy: (body.booked_by as string) ?? getUserId(req),
        eventId: (body.event_id as string) ?? null,
        startDate: start_date,
        endDate: end_date,
        status: (body.status as string) ?? 'confirmed',
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
        notes: (body.notes as string) ?? null,
      }).returning();
      res.status(201).json({ booking: row });
    } catch (e) {
      console.error('POST booking error:', e);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  });

  // PUT /equipment/bookings/:bookingId
  router.put('/equipment/bookings/:bookingId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const k of ['start_date','end_date','status','quantity','notes','event_id'] as const) {
        const map: Record<string, string> = { start_date: 'startDate', end_date: 'endDate', event_id: 'eventId', quantity: 'quantity', notes: 'notes', status: 'status' };
        if (k in body) patch[map[k]] = body[k];
      }
      const [row] = await db2.update(equipmentBookings).set(patch)
        .where(eq(equipmentBookings.id, bookingId)).returning();
      if (!row) return res.status(404).json({ error: 'Booking not found' });
      res.json({ booking: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update booking' });
    }
  });

  // DELETE /equipment/bookings/:bookingId
  router.delete('/equipment/bookings/:bookingId', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentBookings).where(eq(equipmentBookings.id, req.params.bookingId));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete booking' });
    }
  });

  // ── Availability (reuse bookings table with status='availability') ─────────
  // For MVP these share the bookings table – clients can filter by event_id

  // GET /equipment/:id/availability
  router.get('/equipment/:id/availability', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const rows = await db2.select().from(equipmentBookings)
        .where(and(eq(equipmentBookings.equipmentId, req.params.id), eq(equipmentBookings.status, 'confirmed')))
        .orderBy(equipmentBookings.startDate);
      res.json({ availability: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load availability' });
    }
  });

  // POST /equipment/:id/availability
  router.post('/equipment/:id/availability', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as { start_date: string; end_date: string; project_id?: string };
      const [row] = await db2.insert(equipmentBookings).values({
        equipmentId: req.params.id,
        projectId: body.project_id ?? '',
        bookedBy: getUserId(req),
        startDate: body.start_date,
        endDate: body.end_date,
        status: 'confirmed',
        quantity: 1,
      }).returning();
      res.status(201).json({ availability: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create availability' });
    }
  });

  // DELETE /equipment/availability/:id
  router.delete('/equipment/availability/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentBookings).where(eq(equipmentBookings.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete availability' });
    }
  });

  // ── Conflict Detection ────────────────────────────────────

  // POST /equipment/:id/conflicts/check
  router.post('/equipment/:id/conflicts/check', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { start_date, end_date, exclude_booking_id } = req.body as Record<string, string>;
      if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });

      // Overlapping: existing.start < req.end AND existing.end > req.start
      const overlapping = await db2.select().from(equipmentBookings)
        .where(and(
          eq(equipmentBookings.equipmentId, id),
          lte(equipmentBookings.startDate, end_date),
          gte(equipmentBookings.endDate, start_date),
          exclude_booking_id ? sql`${equipmentBookings.id} != ${exclude_booking_id}` : sql`true`,
        ));

      const conflicts = overlapping.map(b => ({
        booking_id: b.id,
        equipment_id: b.equipmentId,
        start_date: b.startDate,
        end_date: b.endDate,
        booked_by: b.bookedBy,
        status: b.status,
      }));

      res.json({ conflicts, has_conflicts: conflicts.length > 0 });
    } catch (e) {
      console.error('Conflict check error:', e);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  });

  // ── Checkouts ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment-checkouts?active=true&equipmentId=xxx
  router.get('/projects/:projectId/equipment-checkouts', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const activeOnly = req.query.active === 'true';
      const equipmentId = req.query.equipmentId as string | undefined;
      const conditions = [eq(equipmentCheckouts.projectId, projectId)];
      if (activeOnly) conditions.push(isNull(equipmentCheckouts.checkedInAt));
      if (equipmentId) conditions.push(eq(equipmentCheckouts.equipmentId, equipmentId));
      const rows = await db2.select().from(equipmentCheckouts)
        .where(and(...conditions))
        .orderBy(desc(equipmentCheckouts.checkedOutAt));
      res.json({ checkouts: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load checkouts' });
    }
  });

  // POST /equipment/:id/checkout
  router.post('/equipment/:id/checkout', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const checked_out_to = body.checked_out_to as string;
      if (!checked_out_to) return res.status(400).json({ error: 'checked_out_to required' });

      const [current] = await db2.select().from(castingEquipment).where(eq(castingEquipment.id, id));
      if (!current) return res.status(404).json({ error: 'Equipment not found' });

      const [checkout] = await db2.insert(equipmentCheckouts).values({
        equipmentId: id,
        projectId: (body.project_id as string) ?? current.projectId,
        checkedOutTo: checked_out_to,
        checkedOutBy: getUserId(req),
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
        purpose: (body.purpose as string) ?? null,
      }).returning();

      // Update equipment status to in_use
      await db2.update(castingEquipment)
        .set({ status: 'in_use', updatedAt: new Date().toISOString() })
        .where(eq(castingEquipment.id, id));

      res.status(201).json({ checkout });
    } catch (e) {
      console.error('POST checkout error:', e);
      res.status(500).json({ error: 'Failed to check out equipment' });
    }
  });

  // POST /equipment/checkouts/:checkoutId/checkin
  router.post('/equipment/checkouts/:checkoutId/checkin', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { checkoutId } = req.params;
      const body = req.body as { condition_on_return?: string; notes?: string };
      const [checkout] = await db2.select().from(equipmentCheckouts).where(eq(equipmentCheckouts.id, checkoutId));
      if (!checkout) return res.status(404).json({ error: 'Checkout not found' });

      const [updated] = await db2.update(equipmentCheckouts)
        .set({
          checkedInAt: new Date().toISOString(),
          conditionOnReturn: body.condition_on_return ?? null,
          notes: body.notes ?? checkout.notes,
        })
        .where(eq(equipmentCheckouts.id, checkoutId))
        .returning();

      // Update equipment status back to available and condition if provided
      const eqPatch: Record<string, unknown> = { status: 'available', updatedAt: new Date().toISOString() };
      if (body.condition_on_return) eqPatch.condition = body.condition_on_return;
      await db2.update(castingEquipment).set(eqPatch).where(eq(castingEquipment.id, checkout.equipmentId));

      res.json({ checkout: updated });
    } catch (e) {
      console.error('POST checkin error:', e);
      res.status(500).json({ error: 'Failed to check in equipment' });
    }
  });

  // ── Templates ─────────────────────────────────────────────

  // GET /projects/:projectId/equipment-templates
  router.get('/projects/:projectId/equipment-templates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const rows = await db2.select().from(equipmentTemplates)
        .where(eq(equipmentTemplates.projectId, req.params.projectId))
        .orderBy(desc(equipmentTemplates.createdAt));
      res.json({ templates: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load templates' });
    }
  });

  // GET /equipment-templates/:id
  router.get('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const [row] = await db2.select().from(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      if (!row) return res.status(404).json({ error: 'Template not found' });
      res.json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load template' });
    }
  });

  // POST /projects/:projectId/equipment-templates
  router.post('/projects/:projectId/equipment-templates', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body.name) return res.status(400).json({ error: 'name required' });
      const [row] = await db2.insert(equipmentTemplates).values({
        projectId: req.params.projectId,
        name: body.name as string,
        description: (body.description as string) ?? null,
        category: (body.category as string) ?? null,
        items: Array.isArray(body.items) ? body.items : [],
        createdBy: getUserId(req),
      }).returning();
      res.status(201).json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // PUT /equipment-templates/:id
  router.put('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const k of ['name','description','category','items'] as const) {
        if (k in body) patch[k] = body[k];
      }
      const [row] = await db2.update(equipmentTemplates).set(patch)
        .where(eq(equipmentTemplates.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: 'Template not found' });
      res.json({ template: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // DELETE /equipment-templates/:id
  router.delete('/equipment-templates/:id', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      await db2.delete(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // POST /equipment-templates/:id/apply — create equipment items from a template
  router.post('/equipment-templates/:id/apply', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const { project_id } = req.body as { project_id?: string };
      if (!project_id) return res.status(400).json({ error: 'project_id required' });
      const [template] = await db2.select().from(equipmentTemplates).where(eq(equipmentTemplates.id, req.params.id));
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const items = Array.isArray(template.items) ? template.items as Record<string, unknown>[] : [];
      const inserted: unknown[] = [];
      for (const item of items) {
        const [row] = await db2.insert(castingEquipment).values({
          projectId: project_id,
          name: (item.name as string) ?? 'Unnamed',
          brand: (item.brand as string) ?? null,
          model: (item.model as string) ?? null,
          category: (item.category as string) ?? template.category ?? null,
          status: 'available',
          condition: (item.condition as string) ?? 'good',
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          notes: (item.notes as string) ?? null,
          metadata: {},
          createdBy: getUserId(req),
        }).returning();
        inserted.push(row);
      }
      res.status(201).json({ equipment: inserted, count: inserted.length });
    } catch (e) {
      console.error('POST template apply error:', e);
      res.status(500).json({ error: 'Failed to apply template' });
    }
  });

  // ── Schedule-maintenance stub (used by EquipmentManagementPanel) ──────────
  // Patch the existing /api/equipment/schedule-maintenance into the Role Room namespace too
  router.post('/equipment/schedule-maintenance', apiKeyAuth(pool, activeSessions), async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { equipment_id, scheduled_date, type, notes } = body as Record<string, string>;
      if (!equipment_id) return res.status(400).json({ error: 'equipment_id required' });
      // Update condition to maintenance and record note
      await db2.update(castingEquipment)
        .set({
          status: 'maintenance',
          notes: notes ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(castingEquipment.id, equipment_id));
      res.json({ ok: true, scheduled_date, type });
    } catch (e) {
      res.status(500).json({ error: 'Failed to schedule maintenance' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GDPR — AI consent (Art. 6.1a / Art. 7) and audit (Art. 30)
  // ─────────────────────────────────────────────────────────────

  const VALID_SCOPES: RoleRoomAiConsentScope[] = [
    'brief_only',
    'brief_and_reviews',
    'full_context',
  ];
  const VALID_PROCESSORS: RoleRoomAiProcessor[] = ['cohere', 'anthropic'];

  router.get(
    '/projects/:projectId/ai-consent',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const processor = String(req.query.processor ?? 'anthropic') as RoleRoomAiProcessor;
        if (!VALID_PROCESSORS.includes(processor)) {
          return res.status(400).json({ error: 'invalid processor' });
        }
        const record = await getAiConsent(pool, req.params.projectId, processor);
        res.json({ consent: record });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load AI consent', detail: String(error) });
      }
    },
  );

  router.post(
    '/projects/:projectId/ai-consent',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { scope, processor, note, excludedEntityIds, includedEntityIds } = req.body ?? {};
        if (!VALID_SCOPES.includes(scope)) {
          return res.status(400).json({ error: 'invalid scope' });
        }
        if (!VALID_PROCESSORS.includes(processor)) {
          return res.status(400).json({ error: 'invalid processor' });
        }
        const record = await grantAiConsent(pool, {
          projectId: req.params.projectId,
          userId,
          scope,
          processor,
          note: typeof note === 'string' ? note : undefined,
          excludedEntityIds: Array.isArray(excludedEntityIds) ? excludedEntityIds : undefined,
          includedEntityIds: Array.isArray(includedEntityIds) ? includedEntityIds : undefined,
        });
        res.status(201).json({ consent: record });
      } catch (error) {
        res.status(500).json({ error: 'Failed to grant AI consent', detail: String(error) });
      }
    },
  );

  router.delete(
    '/projects/:projectId/ai-consent',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const processor = String(req.query.processor ?? 'anthropic') as RoleRoomAiProcessor;
        if (!VALID_PROCESSORS.includes(processor)) {
          return res.status(400).json({ error: 'invalid processor' });
        }
        await revokeAiConsent(pool, req.params.projectId, processor);
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to revoke AI consent', detail: String(error) });
      }
    },
  );

  router.patch(
    '/projects/:projectId/ai-consent/entities',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const processor = String(req.query.processor ?? 'anthropic') as RoleRoomAiProcessor;
        if (!VALID_PROCESSORS.includes(processor)) {
          return res.status(400).json({ error: 'invalid processor' });
        }
        const { excludedEntityIds, includedEntityIds } = req.body ?? {};
        const updated = await updateAiConsentEntities(pool, req.params.projectId, processor, {
          excludedEntityIds: Array.isArray(excludedEntityIds) ? excludedEntityIds : undefined,
          includedEntityIds: Array.isArray(includedEntityIds) ? includedEntityIds : undefined,
        });
        if (!updated) return res.status(404).json({ error: 'no active consent' });
        res.json({ consent: updated });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update entity lists', detail: String(error) });
      }
    },
  );

  // Role Room Agent (Claude) — protected endpoint that runs every call
  // through consent → pseudonymize → audit. Scope defaults to 'brief_only'
  // but the caller can request more via the body.
  router.post(
    '/projects/:projectId/agent/query',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const {
          action = 'query',
          userMessage,
          requiredScope = 'brief_only',
          context = {},
          threadId,
          persistThread,
        } = req.body ?? {};

        if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
          return res.status(400).json({ error: 'userMessage is required' });
        }
        if (userMessage.length > 4000) {
          return res.status(400).json({ error: 'userMessage too long (max 4000 chars)' });
        }
        const validScopes: RoleRoomAiConsentScope[] = [
          'brief_only',
          'brief_and_reviews',
          'full_context',
        ];
        if (!validScopes.includes(requiredScope)) {
          return res.status(400).json({ error: 'invalid requiredScope' });
        }

        try {
          checkAgentRateLimit(userId, req.params.projectId);
        } catch (rlError) {
          if (rlError instanceof RateLimitExceededError) {
            res.setHeader('Retry-After', String(rlError.retryAfterSeconds));
            return res.status(429).json({
              error: 'rate_limit_exceeded',
              detail: rlError.message,
              scope: rlError.scope,
              retryAfterSeconds: rlError.retryAfterSeconds,
            });
          }
          throw rlError;
        }

        const response = await invokeRoleRoomAgent({
          pool,
          projectId: req.params.projectId,
          userId,
          userRole: readRoleRoomDevUserRole(req),
          action: action as RoleRoomAgentAction,
          userMessage: userMessage.trim(),
          requiredScope,
          context,
          threadId: typeof threadId === 'string' ? threadId : null,
          persistThread: persistThread !== false,
        });

        res.json(response);
      } catch (error) {
        if (error instanceof RoleRoomAgentDisabledError) {
          return res.status(503).json({ error: 'agent_disabled', detail: error.message });
        }
        if (error instanceof RoleRoomAgentEntitlementError) {
          return res.status(402).json({
            error: 'entitlement_required',
            detail: error.entitlement.reason,
            entitlement: error.entitlement,
          });
        }
        if (error instanceof RoleRoomAiConsentError) {
          return res.status(403).json({ error: error.code, detail: error.message });
        }
        res.status(500).json({
          error: 'agent_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Streaming agent endpoint (SSE). Streams text deltas and emits a
  // `tool_use` event per tool the agent decides to call; the frontend
  // collects them and surfaces the same confirmation flow as /agent/query.
  router.post(
    '/projects/:projectId/agent/stream',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        await handleAgentStream(pool, req, res, userId, readRoleRoomDevUserRole(req));
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({ error: 'stream_failed', detail: String(error) });
        } else {
          res.end();
        }
      }
    },
  );

  // Tool-execution audit hook. Frontend POSTs after the user confirms a
  // tool_use so the audit log captures which proposals actually fired.
  // Body: { toolName, toolUseId?, status: 'ok' | 'error' | 'invalid_input', errorMessage? }
  router.post(
    '/projects/:projectId/agent/tool-result',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { toolName, toolUseId, status, errorMessage } = req.body ?? {};
        if (typeof toolName !== 'string' || toolName.trim().length === 0) {
          return res.status(400).json({ error: 'toolName required' });
        }
        const allowedStatus = new Set(['ok', 'error', 'invalid_input']);
        const normalisedStatus = typeof status === 'string' && allowedStatus.has(status)
          ? status
          : 'ok';
        await logAiCall(pool, {
          projectId: req.params.projectId,
          userId,
          processor: 'anthropic',
          model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
          action: 'tool_executed',
          status: normalisedStatus === 'ok' ? 'ok' : 'error',
          fieldCategories: [
            `executed_tool:${toolName}`,
            ...(toolUseId ? [`tool_use_id:${String(toolUseId).slice(0, 64)}`] : []),
            ...(normalisedStatus !== 'ok' ? [`tool_result:${normalisedStatus}`] : []),
          ],
          errorCode: normalisedStatus !== 'ok' ? normalisedStatus : null,
          errorMessage: typeof errorMessage === 'string' ? errorMessage.slice(0, 500) : null,
        });
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'tool_result_log_failed', detail: String(error) });
      }
    },
  );

  // Merch mockup generator — synchronous wrapper over Printful's
  // mockup-generator API. Given a productId (tshirt/hoodie/...) and
  // a public design image URL (typically the customer's logo from the
  // bootstrap result), returns the rendered photorealistic mockup URL.
  // Internal polling up to 30s; cached per (productId, designImageUrl).
  router.post(
    '/projects/:projectId/agent/merch-mockup',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        if (!isPrintfulConfigured()) {
          return res.status(503).json({
            error: 'mockup_provider_unconfigured',
            detail: 'Printful is not fully configured. Both PRINTFUL_API_KEY and PRINTFUL_STORE_ID must be set in Render env. Create a free Printful store under Stores → Add store, then add the numeric store id to env.',
          });
        }
        const { productId, designImageUrl, forceRefresh } = req.body ?? {};
        const allowedProducts = new Set<MerchMockupProductId>([
          'tshirt', 'hoodie', 'polo', 'cap', 'totebag', 'mug',
        ]);
        if (typeof productId !== 'string' || !allowedProducts.has(productId as MerchMockupProductId)) {
          return res.status(400).json({ error: 'invalid_product', detail: `productId must be one of: ${Array.from(allowedProducts).join(', ')}` });
        }
        if (typeof designImageUrl !== 'string' || !/^https?:\/\//i.test(designImageUrl)) {
          return res.status(400).json({ error: 'invalid_design_url', detail: 'designImageUrl must be a public http(s) URL' });
        }
        const result = await generateMerchMockup(pool, {
          productId: productId as MerchMockupProductId,
          designImageUrl,
          forceRefresh: forceRefresh === true,
        });
        res.json(result);
      } catch (error) {
        if (error instanceof PrintfulMockupError) {
          return res.status(error.httpStatus).json({
            error: 'mockup_generation_failed',
            detail: error.message,
          });
        }
        res.status(500).json({
          error: 'mockup_generation_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Merch cooperation draft — Claude-drevet samarbeidsforslag.
  // Tar kunde + motpart (klubb/event/skole/forening/bedrift) + ønsket
  // avtaletype og returnerer strukturert avtaleutkast (overskrift,
  // pitch, tilbud begge veier, paragrafer, risiko, neste steg).
  // Ingen PII til Claude — kun firmanavn + bransje + brief-sammendrag.
  router.post(
    '/projects/:projectId/agent/merch-cooperation',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const {
          customerName,
          customerIndustry,
          customerBriefSummary,
          partnerName,
          partnerType,
          partnerNotes,
          dealType,
          supplierContext,
        } = req.body ?? {};

        const allowedPartners = new Set<MerchPartnerType>([
          'sportsklubb', 'event', 'skole', 'forening', 'bedrift',
        ]);
        const allowedDeals = new Set<MerchDealType>([
          'sponsor', 'kit_supplier', 'cross_promo', 'give_away', 'long_term_partnership',
        ]);
        if (typeof customerName !== 'string' || customerName.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_customer_name' });
        }
        if (typeof partnerName !== 'string' || partnerName.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_partner_name' });
        }
        if (!allowedPartners.has(partnerType as MerchPartnerType)) {
          return res.status(400).json({ error: 'invalid_partner_type' });
        }
        if (!allowedDeals.has(dealType as MerchDealType)) {
          return res.status(400).json({ error: 'invalid_deal_type' });
        }

        const result = await generateMerchCooperationDraft({
          pool,
          projectId: req.params.projectId,
          userId,
          customerName: customerName.trim(),
          customerIndustry: typeof customerIndustry === 'string' ? customerIndustry.trim() : null,
          customerBriefSummary: typeof customerBriefSummary === 'string' ? customerBriefSummary.trim().slice(0, 1500) : null,
          partnerName: partnerName.trim(),
          partnerType: partnerType as MerchPartnerType,
          partnerNotes: typeof partnerNotes === 'string' ? partnerNotes.trim().slice(0, 800) : null,
          dealType: dealType as MerchDealType,
          supplierContext: supplierContext && typeof supplierContext === 'object' && supplierContext !== null
            ? {
                name: String(supplierContext.name ?? ''),
                techniques: Array.isArray(supplierContext.techniques) ? supplierContext.techniques.map(String) : [],
                productCategories: Array.isArray(supplierContext.productCategories) ? supplierContext.productCategories.map(String) : [],
              }
            : null,
        });
        res.json(result);
      } catch (error) {
        if (error instanceof MerchCooperationError) {
          return res.status(error.httpStatus).json({
            error: 'cooperation_generation_failed',
            detail: error.message,
          });
        }
        res.status(500).json({
          error: 'cooperation_generation_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Customer legal-entity discovery — when producer enters a brand
  // ("Holy Crust") or website ("holycrust.no"), surface 1-5 plausible
  // Brreg-registered legal entities so the customer can confirm
  // "yes, we're Macks Invest AS" before bootstrap continues.
  router.get(
    '/projects/:projectId/agent/legal-entity-candidates',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const brandName = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
        const websiteUrl = typeof req.query.website === 'string' ? req.query.website.trim() : null;
        const municipalityNumber = typeof req.query.kommunenummer === 'string'
          ? req.query.kommunenummer.trim()
          : null;
        if (brandName.length < 2 && !websiteUrl) {
          return res.status(400).json({ error: 'brand_or_website_required' });
        }
        const candidates = await findCustomerLegalEntityCandidates({
          brandName: brandName || (websiteUrl ?? ''),
          websiteUrl: websiteUrl || null,
          municipalityNumber: municipalityNumber || null,
        });
        res.json({ candidates });
      } catch (error) {
        res.status(500).json({
          error: 'legal_entity_lookup_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Merch partner-discovery — find local sport clubs / schools /
  // foreninger for a customer based on their bydel + Brreg NACE
  // (93.12 sportsklubber, 85.x skoler, 94.99 foreninger). Returns
  // ranked candidates so the cooperation-generator can pick a
  // realistic partner instead of the producer typing one in blind.
  router.get(
    '/projects/:projectId/agent/partner-discovery',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const partnerType = typeof req.query.partnerType === 'string'
          ? req.query.partnerType
          : '';
        const orgnr = typeof req.query.customerOrgnr === 'string'
          ? req.query.customerOrgnr.trim()
          : '';
        const areaOverride = typeof req.query.areaOverride === 'string'
          ? req.query.areaOverride.trim()
          : null;
        const allowed = new Set<DiscoveryPartnerType>(['sportsklubb', 'event', 'skole', 'forening', 'bedrift']);
        if (!allowed.has(partnerType as DiscoveryPartnerType)) {
          return res.status(400).json({ error: 'invalid_partner_type' });
        }
        if (!orgnr || orgnr.length !== 9) {
          return res.status(400).json({ error: 'customerOrgnr (9 digits) required' });
        }
        const brreg = await fetchBrregCompany({
          organizationNumber: orgnr,
          companyName: '',
          websiteUrl: null,
        } as unknown as Parameters<typeof fetchBrregCompany>[0]);
        if (!brreg || brreg.lookupStatus !== 'verified') {
          return res.status(404).json({ error: 'customer_brreg_not_found' });
        }
        const candidates = await discoverMerchPartners(
          { brregCompany: brreg, areaOverride: areaOverride || null },
          partnerType as DiscoveryPartnerType,
        );
        res.json({ candidates, customer: { orgnr: brreg.organizationNumber, name: brreg.name, kommunenummer: brreg.municipalityNumber, businessAddress: brreg.businessAddress } });
      } catch (error) {
        res.status(500).json({
          error: 'partner_discovery_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Merch partner-enrichment — given a partner candidate, run Brreg
  // full lookup + website scrape + Meta Page lookup so the cooperation
  // generator can reference real facts about the partner instead of
  // generic assumptions.
  router.post(
    '/projects/:projectId/agent/partner-enrichment',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const candidate = req.body?.candidate as MerchPartnerCandidate | undefined;
        if (!candidate || typeof candidate.name !== 'string') {
          return res.status(400).json({ error: 'candidate_required' });
        }
        const enrichment = await enrichMerchPartner(pool, candidate);
        res.json(enrichment);
      } catch (error) {
        res.status(500).json({
          error: 'partner_enrichment_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Merch partner-email — Slice 7b. Send a cooperation/outreach
  // email through the existing Gmail SMTP transport, BCC the producer
  // so they have a copy in their own Sent folder, and log the send to
  // role_room_merch_partner_emails so the agent UI can show "Sendt 4.
  // mai til Lindeberg SK Fotball ✓".
  router.post(
    '/projects/:projectId/agent/merch-partner-email/send',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const {
          partnerOrgnr,
          partnerName,
          partnerEmail,
          producerCcEmail,
          subject,
          bodyMarkdown,
          replyToEmail,
        } = req.body ?? {};

        if (typeof partnerName !== 'string' || partnerName.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_partner_name' });
        }
        if (typeof partnerEmail !== 'string' || partnerEmail.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_partner_email' });
        }
        if (typeof subject !== 'string' || subject.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_subject' });
        }
        if (typeof bodyMarkdown !== 'string' || bodyMarkdown.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_body' });
        }

        const result = await sendMerchPartnerEmail({
          pool,
          projectId: req.params.projectId,
          userId,
          partnerOrgnr: typeof partnerOrgnr === 'string' && partnerOrgnr.length > 0 ? partnerOrgnr : null,
          partnerName: partnerName.trim(),
          partnerEmail: partnerEmail.trim(),
          producerCcEmail: typeof producerCcEmail === 'string' ? producerCcEmail.trim() : null,
          subject: subject.trim(),
          bodyMarkdown: bodyMarkdown.trim(),
          replyToEmail: typeof replyToEmail === 'string' ? replyToEmail.trim() : null,
        });
        if (!result.ok) {
          return res.status(result.reason === 'missing_email_config' ? 503 : 400).json({
            error: result.reason ?? 'send_failed',
          });
        }
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: 'partner_email_send_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Slice 7c: log a partner reply for a previously sent cooperation email.
  // Producer-driven for now (paste 1-3 setninger summary + sentiment).
  // IMAP-poller will reuse the same endpoint with autoDetectedMessageId
  // populated.
  router.post(
    '/projects/:projectId/agent/merch-partner-email/:emailId/reply',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { replySummary, replyFullText, sentiment, repliedAt, autoDetectedMessageId } = req.body ?? {};
        if (typeof replySummary !== 'string' || replySummary.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_reply_summary' });
        }
        const allowed = new Set<MerchReplySentiment>(['positive', 'neutral', 'negative']);
        const finalSentiment: MerchReplySentiment = allowed.has(sentiment as MerchReplySentiment)
          ? (sentiment as MerchReplySentiment)
          : 'neutral';
        const entry = await logMerchPartnerReply({
          pool,
          sentEmailId: req.params.emailId,
          projectId: req.params.projectId,
          userId,
          replySummary: replySummary.trim().slice(0, 2000),
          replyFullText: typeof replyFullText === 'string' ? replyFullText.slice(0, 20000) : null,
          sentiment: finalSentiment,
          repliedAt: typeof repliedAt === 'string' ? repliedAt : null,
          autoDetectedMessageId: typeof autoDetectedMessageId === 'string' ? autoDetectedMessageId : null,
        });
        if (!entry) return res.status(500).json({ error: 'reply_log_failed' });
        res.json(entry);
      } catch (error) {
        res.status(500).json({
          error: 'reply_log_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Slice 7c+: trigger IMAP poll to auto-detect partner replies. Reads
  // GMAIL_USER's INBOX, searches for mail whose In-Reply-To/References
  // header matches one of our sent gmail_message_id values, logs new
  // replies. Idempotent. Producer hits "Sjekk for svar nå"-button in UI.
  router.post(
    '/projects/:projectId/agent/merch-partner-email/poll-replies',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const lookbackDays = typeof req.body?.lookbackDays === 'number' ? req.body.lookbackDays : undefined;
        const result = await pollPartnerReplies(pool, { lookbackDays });
        if (!result.ok) {
          return res.status(result.reason === 'missing_email_config' ? 503 : 502).json(result);
        }
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: 'reply_poll_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.get(
    '/projects/:projectId/agent/merch-partner-email/replies',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const partnerOrgnr = typeof req.query.partnerOrgnr === 'string'
          ? req.query.partnerOrgnr.trim()
          : null;
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const entries = await listMerchPartnerReplies(pool, {
          projectId: req.params.projectId,
          partnerOrgnr: partnerOrgnr || null,
          limit,
        });
        res.json({ entries });
      } catch (error) {
        res.status(500).json({
          error: 'replies_list_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.get(
    '/projects/:projectId/agent/merch-partner-email/history',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const partnerOrgnr = typeof req.query.partnerOrgnr === 'string'
          ? req.query.partnerOrgnr.trim()
          : null;
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const entries = await listMerchPartnerEmails(pool, {
          projectId: req.params.projectId,
          partnerOrgnr: partnerOrgnr || null,
          limit,
        });
        res.json({ entries });
      } catch (error) {
        res.status(500).json({
          error: 'partner_email_history_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Agent thread CRUD — persistent conversations per (project, user).
  router.get(
    '/projects/:projectId/agent/threads',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const includeArchived = req.query.includeArchived === 'true';
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const threads = await listThreads(pool, req.params.projectId, userId, {
          includeArchived,
          limit,
        });
        res.json({ threads });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list threads', detail: String(error) });
      }
    },
  );

  router.get(
    '/projects/:projectId/agent/threads/:threadId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const data = await getThread(pool, req.params.threadId, userId);
        if (!data) return res.status(404).json({ error: 'Not found' });
        res.json({ thread: data.thread, messages: data.messages });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load thread', detail: String(error) });
      }
    },
  );

  router.patch(
    '/projects/:projectId/agent/threads/:threadId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { title } = req.body ?? {};
        if (typeof title !== 'string' || title.trim().length === 0) {
          return res.status(400).json({ error: 'title required' });
        }
        const ok = await updateThreadTitle(pool, req.params.threadId, userId, title.trim().slice(0, 200));
        if (!ok) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to rename thread', detail: String(error) });
      }
    },
  );

  router.delete(
    '/projects/:projectId/agent/threads/:threadId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const ok = await archiveThread(pool, req.params.threadId, userId);
        if (!ok) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to archive thread', detail: String(error) });
      }
    },
  );

  // ───────────────────────────────────────────────
  // Monetization — entitlements, trial, add-on checkout.
  // ───────────────────────────────────────────────

  router.get(
    '/agent/entitlement',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const entitlement = await checkAgentEntitlement(pool, userId, readRoleRoomDevUserRole(req));
        const config = getEntitlementConfig();
        res.json({ entitlement, config });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load entitlement', detail: String(error) });
      }
    },
  );

  router.post(
    '/agent/entitlement/trial/start',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const result = await startAgentTrial(pool, userId);
        if (!result.ok) {
          return res.status(409).json({ error: result.error });
        }
        const entitlement = await checkAgentEntitlement(pool, userId, readRoleRoomDevUserRole(req));
        res.status(201).json({ trialEndsAt: result.trialEndsAt, entitlement });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start trial', detail: String(error) });
      }
    },
  );

  /**
   * Stripe add-on checkout. Stubbed until STRIPE_ROLE_ROOM_AGENT_PRICE_ID
   * + STRIPE_SECRET_KEY are configured. When env is not set, returns
   *  `status: 'not_configured'` so the frontend can show a waitlist CTA.
   */
  router.post(
    '/agent/entitlement/addon/checkout',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const priceId = process.env.STRIPE_ROLE_ROOM_AGENT_PRICE_ID;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const successUrl = process.env.ROLE_ROOM_AGENT_CHECKOUT_SUCCESS_URL
          || process.env.APP_URL
          || 'https://creatorhubn.com/dashboard';
        const cancelUrl = process.env.ROLE_ROOM_AGENT_CHECKOUT_CANCEL_URL
          || process.env.APP_URL
          || 'https://creatorhubn.com/dashboard';

        if (!priceId || !stripeKey) {
          return res.status(503).json({
            status: 'not_configured',
            detail: 'Stripe Role Room Agent add-on is not configured yet.',
          });
        }

        // Dynamic import so the Stripe SDK only loads when needed.
        // @ts-ignore — optional SDK
        const stripeMod: any = await import('stripe').catch(() => null);
        if (!stripeMod) {
          return res.status(503).json({ status: 'not_configured', detail: 'Stripe SDK unavailable' });
        }
        const StripeCtor = stripeMod.default ?? stripeMod.Stripe;
        const stripe = new StripeCtor(stripeKey);

        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: userId,
          metadata: {
            product: 'role_room_agent',
            role_room_user_id: userId,
          },
          subscription_data: {
            metadata: {
              product: 'role_room_agent',
              role_room_user_id: userId,
            },
          },
        });

        res.json({ status: 'ok', url: session.url, id: session.id });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create checkout', detail: String(error) });
      }
    },
  );

  // Admin-only: grant / revoke entitlements for support cases.
  router.post(
    '/admin/agent/entitlements/grant',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      const { userId, notes, trialDays } = req.body ?? {};
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        return res.status(400).json({ error: 'userId required' });
      }
      const trialEndsAt = typeof trialDays === 'number' && trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : undefined;
      try {
        await adminGrantEntitlement(pool, userId, {
          notes: typeof notes === 'string' ? notes : undefined,
          trialEndsAt,
        });
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to grant', detail: String(error) });
      }
    },
  );

  router.post(
    '/admin/agent/entitlements/revoke',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      const { userId, reason } = req.body ?? {};
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        return res.status(400).json({ error: 'userId required' });
      }
      try {
        await revokeEntitlement(pool, userId, typeof reason === 'string' ? reason : 'admin_revoke');
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to revoke', detail: String(error) });
      }
    },
  );

  router.get(
    '/admin/agent/entitlements',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      try {
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const rows = await listEntitlements(pool, { limit });
        res.json({ entitlements: rows });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list', detail: String(error) });
      }
    },
  );

  // DPO admin governance — read-only aggregated views of AI usage.
  // Admin-gated so consent records + audit rows (metadata only) are never
  // exposed to non-admins.
  router.get(
    '/admin/ai-governance/overview',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      try {
        const overview = await getAiGovernanceOverview(pool);
        res.json(overview);
      } catch (error) {
        res.status(500).json({ error: 'Failed to load overview', detail: String(error) });
      }
    },
  );

  router.get(
    '/admin/ai-governance/consents',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      try {
        const includeRevoked = req.query.includeRevoked === 'true';
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const consents = await getConsentList(pool, { includeRevoked, limit });
        res.json({ consents });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load consents', detail: String(error) });
      }
    },
  );

  router.get(
    '/admin/ai-governance/audit',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      if (!requireScope(req, 'admin')) {
        return res.status(403).json({ error: 'admin_only' });
      }
      try {
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const rows = await getAuditTrail(pool, { limit, projectId, status });
        res.json({ rows });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load audit trail', detail: String(error) });
      }
    },
  );

  // Art. 15 — user's right of access to their own AI-call audit log.
  router.get(
    '/me/ai-interactions',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const rows = await listAiCallsForUser(pool, userId, { projectId, limit });
        res.json({ interactions: rows });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load AI interactions', detail: String(error) });
      }
    },
  );

  // ── Ads 2.0 — budget recommendation engine ───────────────
  // Returns a recommended monthly ads budget based on industry, revenue
  // estimate, goal, and growth phase. Per-platform allocation included so
  // the Ad Builder can pre-fill Meta/Google/TikTok budgets.
  router.post(
    '/ads/budget/recommend',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const {
          industryCategory,
          monthlyRevenueNok,
          goal,
          growthPhase,
          businessProfileId,
        } = req.body ?? {};

        let resolvedIndustry = industryCategory;
        let resolvedRevenue = Number(monthlyRevenueNok);
        let resolvedGrowth = growthPhase;

        // If a businessProfileId is supplied, fall back to its stored values.
        if (businessProfileId && (!resolvedIndustry || !Number.isFinite(resolvedRevenue))) {
          const row = await pool.query<{
            industry_category: string | null;
            monthly_revenue_estimate_nok: string | null;
            growth_phase: string | null;
          }>(
            `SELECT industry_category, monthly_revenue_estimate_nok, growth_phase
             FROM business_profiles WHERE id = $1`,
            [businessProfileId],
          );
          if (row.rowCount && row.rows[0]) {
            resolvedIndustry = resolvedIndustry || row.rows[0].industry_category || 'other';
            if (!Number.isFinite(resolvedRevenue) && row.rows[0].monthly_revenue_estimate_nok) {
              resolvedRevenue = Number(row.rows[0].monthly_revenue_estimate_nok);
            }
            resolvedGrowth = resolvedGrowth || row.rows[0].growth_phase || 'established';
          }
        }

        if (!resolvedIndustry || !Number.isFinite(resolvedRevenue) || resolvedRevenue <= 0) {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'industryCategory + monthlyRevenueNok required (or businessProfileId pointing at a profile with both)',
          });
        }

        const recommendation = recommendAdsBudget({
          industryCategory: resolvedIndustry as IndustryCategory,
          monthlyRevenueNok: resolvedRevenue,
          goal: goal as AdsGoal | undefined,
          growthPhase: resolvedGrowth as GrowthPhase | undefined,
        });

        res.json({ recommendation });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to recommend ads budget',
          detail: String(error),
        });
      }
    },
  );

  // Static reference data — industry catalog for the picker UI.
  router.get(
    '/ads/budget/industries',
    apiKeyAuth(pool, activeSessions),
    async (_req: Request, res: Response) => {
      const industries = Object.entries(INDUSTRY_FACTORS).map(([key, value]) => ({
        key,
        description: value.description,
        marketingShareOfRevenue: value.marketingShareOfRevenue,
        digitalAdsShareOfMarketing: value.digitalAdsShareOfMarketing,
        platformAllocation: value.platformAllocation,
      }));
      res.json({ industries });
    },
  );

  // ── Ads 2.0 — Meta campaign lifecycle ────────────────────
  // Resolve the user's Meta access-token via the Instagram-OAuth connection
  // (same long-lived token covers ads_read + ads_management once the user
  // re-authorizes against the upgraded scope list).
  async function resolveMetaToken(userId: string): Promise<string | null> {
    const connections = await listInstagramConnections(pool, userId);
    if (!connections.length) return null;
    const fresh = await ensureFreshConnection(pool, connections[0]);
    return fresh.accessToken || null;
  }

  router.get(
    '/ads/meta/ad-accounts',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const token = await resolveMetaToken(userId);
        if (!token) {
          return res.status(412).json({
            error: 'meta_not_connected',
            detail: 'Connect Instagram/Meta first via /role-room/instagram/oauth/start',
          });
        }
        const accounts = await listMetaAdAccounts(token);
        res.json({ accounts });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to list Meta ad accounts', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/meta/campaigns',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const {
          projectId,
          businessProfileId,
          adAccountId,
          name,
          objective,
          dailyBudgetNok,
          goal,
          sourcePostId,
          sourceAssetId,
          audienceConfig,
          creativeConfig,
          managementFeeRate,
        } = req.body ?? {};

        if (!projectId || !adAccountId || !name || !objective) {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'projectId, adAccountId, name, objective required',
          });
        }

        const token = await resolveMetaToken(userId);
        if (!token) {
          return res.status(412).json({ error: 'meta_not_connected' });
        }

        // Verify the producer actually has advertise/manage access to the client's
        // ad account before running anything on it (granted-access check).
        if (!(await hasMetaAdAccountAccess(token, adAccountId))) {
          return res.status(403).json({
            error: 'no_ad_account_access',
            detail: 'Du har ikke annonserings-tilgang til denne annonsekontoen. Be kunden gi deg tilgang i Business Manager.',
          });
        }

        // Convert NOK daily budget → currency-cents (assume NOK ad-account; the
        // metrics poll will reconcile if account is in another currency).
        const dailyBudgetCents =
          typeof dailyBudgetNok === 'number' ? Math.round(dailyBudgetNok * 100) : undefined;

        // 1) Create the campaign on Meta (PAUSED by default — user activates from UI)
        const metaResult = await createMetaCampaign(token, {
          adAccountId,
          name,
          objective: objective as MetaCampaignObjective,
          dailyBudgetCents,
          status: 'PAUSED',
        });

        // 2) Persist locally so we own the campaign-list source-of-truth
        const row = await insertCampaign(pool, {
          projectId,
          userId,
          businessProfileId: businessProfileId ?? null,
          platform: 'meta',
          externalCampaignId: metaResult.id,
          sourcePostId: sourcePostId ?? null,
          sourceAssetId: sourceAssetId ?? null,
          status: 'paused',
          goal: goal ?? null,
          dailyBudgetNok: dailyBudgetNok ?? null,
          managementFeeRate:
            typeof managementFeeRate === 'number' ? managementFeeRate : null,
          audienceConfig: audienceConfig ?? null,
          creativeConfig: creativeConfig ?? null,
        });

        res.status(201).json({ campaign: row });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to create Meta campaign', detail: String(error) });
      }
    },
  );

  // Ad set (målgruppe + budsjett + plasseringer) under en kampanje. Opprettes
  // PAUSED. Krever ads_management (Meta App Review).
  router.post(
    '/ads/meta/campaigns/:campaignId/adsets',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (campaign.platform !== 'meta' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_meta_campaign' });
        }
        const { adAccountId, name, dailyBudgetNok, optimizationGoal, billingEvent, targeting, startTime, endTime } =
          req.body ?? {};
        if (!adAccountId || !name || typeof dailyBudgetNok !== 'number' || !targeting) {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'adAccountId, name, dailyBudgetNok, targeting required',
          });
        }
        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        const result = await createMetaAdSet(token, {
          adAccountId,
          campaignId: campaign.externalCampaignId,
          name,
          dailyBudgetCents: Math.round(dailyBudgetNok * 100),
          optimizationGoal,
          billingEvent,
          targeting: targeting as MetaTargeting,
          startTime,
          endTime,
          status: 'PAUSED',
        });
        res.status(201).json({ adSet: result });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to create ad set', detail: String(error) });
      }
    },
  );

  // Annonse (kreativ + adset-kobling) under et ad set. Opprettes PAUSED.
  router.post(
    '/ads/meta/adsets/:adSetId/ads',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { adAccountId, name, creativeId } = req.body ?? {};
        if (!adAccountId || !name || !creativeId) {
          return res.status(400).json({ error: 'invalid_input', detail: 'adAccountId, name, creativeId required' });
        }
        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        const result = await createMetaAd(token, {
          adAccountId,
          adSetId: req.params.adSetId,
          name,
          creativeId,
          status: 'PAUSED',
        });
        res.status(201).json({ ad: result });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to create ad', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/meta/campaigns/:campaignId/pause',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (campaign.platform !== 'meta' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_meta_campaign' });
        }

        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        await pauseMetaCampaign(token, campaign.externalCampaignId);
        const updated = await updateCampaignStatus(pool, campaign.id, 'paused');
        res.json({ campaign: updated });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to pause campaign', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/meta/campaigns/:campaignId/resume',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (campaign.platform !== 'meta' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_meta_campaign' });
        }

        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        // §2.3 budget gate: don't resume spending once the period cap is reached
        // (unless the client has approved a higher ramme).
        const period = new Date().toISOString().slice(0, 7);
        const spent = await sumSpendForProjectPeriod(pool, campaign.projectId, period);
        await assertWithinBudget(pool, campaign.projectId, period, spent);

        await resumeMetaCampaign(token, campaign.externalCampaignId);
        const updated = await updateCampaignStatus(pool, campaign.id, 'active');
        res.json({ campaign: updated });
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          return res.status(409).json({ error: 'budget_exceeded', detail: error.message, status: error.status });
        }
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to resume campaign', detail: String(error) });
      }
    },
  );

  router.delete(
    '/ads/meta/campaigns/:campaignId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (campaign.platform !== 'meta' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_meta_campaign' });
        }

        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        await endMetaCampaign(token, campaign.externalCampaignId);
        const updated = await updateCampaignStatus(pool, campaign.id, 'ended');
        res.json({ campaign: updated });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to end campaign', detail: String(error) });
      }
    },
  );

  // ── Google Ads — kampanje-livssyklus (full kontroll) ────
  // Krever Google ads-OAuth-connection + GOOGLE_ADS_DEVELOPER_TOKEN.
  async function resolveGoogleAdsAuth(userId: string, customerId: string): Promise<GoogleAdsAuth | null> {
    const accessToken = await resolveAdsAccessToken(pool, 'google', userId);
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!accessToken || !developerToken) return null;
    return {
      accessToken,
      developerToken,
      customerId,
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    };
  }

  // Tilgjengelige Google Ads-kontoer (kunde-id-velger i UI).
  router.get(
    '/ads/google/customers',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const accessToken = await resolveAdsAccessToken(pool, 'google', userId);
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!accessToken || !developerToken) {
          return res.status(412).json({ error: 'google_not_connected', detail: 'Koble Google Ads + sett GOOGLE_ADS_DEVELOPER_TOKEN' });
        }
        const customers = await listGoogleAccessibleCustomers({ accessToken, developerToken });
        res.json({ customers });
      } catch (error) {
        if (error instanceof GoogleAdsApiError) {
          return res.status(error.statusCode).json({ error: 'google_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to list Google customers', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/google/campaigns',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { projectId, customerId, name, dailyBudgetNok, channelType, businessProfileId, creativeConfig } = req.body ?? {};
        if (!projectId || !customerId || !name || typeof dailyBudgetNok !== 'number') {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId, customerId, name, dailyBudgetNok required' });
        }
        const auth = await resolveGoogleAdsAuth(userId, String(customerId));
        if (!auth) return res.status(412).json({ error: 'google_not_connected', detail: 'Koble Google Ads + sett GOOGLE_ADS_DEVELOPER_TOKEN' });

        // Verify granted access to the client's Google Ads customer first.
        if (!(await hasGoogleCustomerAccess(auth, String(customerId)))) {
          return res.status(403).json({
            error: 'no_ad_account_access',
            detail: 'Du har ikke tilgang til denne Google Ads-kontoen. Be kunden gi tilgang.',
          });
        }

        const created = await createGoogleCampaign({ ...auth, name, dailyBudgetNok, channelType });
        const row = await insertCampaign(pool, {
          projectId,
          userId,
          businessProfileId: businessProfileId ?? null,
          platform: 'google',
          externalCampaignId: created.campaignResourceName,
          status: 'paused',
          goal: name,
          dailyBudgetNok,
          creativeConfig: creativeConfig ?? null,
        });
        res.status(201).json({ campaign: row, budgetResourceName: created.budgetResourceName });
      } catch (error) {
        if (error instanceof GoogleAdsApiError) {
          return res.status(error.statusCode).json({ error: 'google_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to create Google campaign', detail: String(error) });
      }
    },
  );

  // Pause / resume / end a Google campaign. resume is budget-gated (§2.3).
  for (const action of ['pause', 'resume'] as const) {
    router.post(
      `/ads/google/campaigns/:campaignId/${action}`,
      apiKeyAuth(pool, activeSessions),
      async (req: Request, res: Response) => {
        try {
          const userId = getUserId(req);
          const campaign = await getCampaignById(pool, req.params.campaignId);
          if (!campaign || campaign.userId !== userId) return res.status(404).json({ error: 'campaign_not_found' });
          if (campaign.platform !== 'google' || !campaign.externalCampaignId) {
            return res.status(400).json({ error: 'not_a_google_campaign' });
          }
          const parsed = parseGoogleCampaignResourceName(campaign.externalCampaignId);
          if (!parsed) return res.status(400).json({ error: 'invalid_google_resource_name' });
          const auth = await resolveGoogleAdsAuth(userId, parsed.customerId);
          if (!auth) return res.status(412).json({ error: 'google_not_connected' });

          if (action === 'resume') {
            const period = new Date().toISOString().slice(0, 7);
            const spent = await sumSpendForProjectPeriod(pool, campaign.projectId, period);
            await assertWithinBudget(pool, campaign.projectId, period, spent);
          }
          await setGoogleCampaignStatus(auth, campaign.externalCampaignId, action === 'pause' ? 'PAUSED' : 'ENABLED');
          const updated = await updateCampaignStatus(pool, campaign.id, action === 'pause' ? 'paused' : 'active');
          res.json({ campaign: updated });
        } catch (error) {
          if (error instanceof BudgetExceededError) {
            return res.status(409).json({ error: 'budget_exceeded', detail: error.message, status: error.status });
          }
          if (error instanceof GoogleAdsApiError) {
            return res.status(error.statusCode).json({ error: 'google_api_error', detail: error.message });
          }
          res.status(500).json({ error: `Failed to ${action} Google campaign`, detail: String(error) });
        }
      },
    );
  }

  router.delete(
    '/ads/google/campaigns/:campaignId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) return res.status(404).json({ error: 'campaign_not_found' });
        if (campaign.platform !== 'google' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_google_campaign' });
        }
        const parsed = parseGoogleCampaignResourceName(campaign.externalCampaignId);
        if (!parsed) return res.status(400).json({ error: 'invalid_google_resource_name' });
        const auth = await resolveGoogleAdsAuth(userId, parsed.customerId);
        if (!auth) return res.status(412).json({ error: 'google_not_connected' });

        await setGoogleCampaignStatus(auth, campaign.externalCampaignId, 'REMOVED');
        const updated = await updateCampaignStatus(pool, campaign.id, 'ended');
        res.json({ campaign: updated });
      } catch (error) {
        if (error instanceof GoogleAdsApiError) {
          return res.status(error.statusCode).json({ error: 'google_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to end Google campaign', detail: String(error) });
      }
    },
  );

  // ── LinkedIn Ads — kampanje-livssyklus (full kontroll) ──
  async function resolveLinkedInAuth(userId: string): Promise<LinkedInAdsAuth | null> {
    const accessToken = await resolveAdsAccessToken(pool, 'linkedin', userId);
    if (!accessToken) return null;
    return { accessToken, apiVersion: process.env.LINKEDIN_API_VERSION || undefined };
  }

  // LinkedIn-annonsekontoer produsenten har tilgang til (kontovelger i UI).
  router.get(
    '/ads/linkedin/accounts',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const auth = await resolveLinkedInAuth(getUserId(req));
        if (!auth) return res.status(412).json({ error: 'linkedin_not_connected' });
        const accounts = (await listLinkedInManagedAdAccounts(auth.accessToken, auth.apiVersion))
          .filter((a) => a.assetType === 'ad_account');
        res.json({ accounts });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list LinkedIn accounts', detail: String(error) });
      }
    },
  );

  // Campaign groups under a LinkedIn ad account (kampanjegruppe-velger i UI).
  router.get(
    '/ads/linkedin/campaign-groups',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const accountUrn = typeof req.query.accountUrn === 'string' ? req.query.accountUrn : '';
        if (!accountUrn) return res.status(400).json({ error: 'accountUrn_required' });
        const auth = await resolveLinkedInAuth(getUserId(req));
        if (!auth) return res.status(412).json({ error: 'linkedin_not_connected' });
        const groups = await listLinkedInCampaignGroups(auth.accessToken, accountUrn, auth.apiVersion);
        res.json({ groups });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list LinkedIn campaign groups', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/linkedin/campaigns',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { projectId, accountUrn, campaignGroupUrn, name, dailyBudgetNok, objectiveType, businessProfileId, creativeConfig } =
          req.body ?? {};
        if (!projectId || !accountUrn || !campaignGroupUrn || !name || typeof dailyBudgetNok !== 'number') {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'projectId, accountUrn, campaignGroupUrn, name, dailyBudgetNok required',
          });
        }
        const auth = await resolveLinkedInAuth(userId);
        if (!auth) return res.status(412).json({ error: 'linkedin_not_connected' });
        if (!(await hasLinkedInAdAccountAccess(auth.accessToken, accountUrn, auth.apiVersion))) {
          return res.status(403).json({
            error: 'no_ad_account_access',
            detail: 'Du har ikke tilgang til denne LinkedIn-annonsekontoen. Be kunden gi tilgang.',
          });
        }
        const created = await createLinkedInCampaign({ ...auth, accountUrn, campaignGroupUrn, name, dailyBudgetNok, objectiveType });
        const row = await insertCampaign(pool, {
          projectId,
          userId,
          businessProfileId: businessProfileId ?? null,
          platform: 'linkedin',
          externalCampaignId: created.campaignUrn,
          status: 'draft',
          goal: name,
          dailyBudgetNok,
          creativeConfig: creativeConfig ?? null,
        });
        res.status(201).json({ campaign: row });
      } catch (error) {
        if (error instanceof LinkedInAdsApiError) {
          return res.status(error.statusCode).json({ error: 'linkedin_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to create LinkedIn campaign', detail: String(error) });
      }
    },
  );

  for (const action of ['pause', 'resume'] as const) {
    router.post(
      `/ads/linkedin/campaigns/:campaignId/${action}`,
      apiKeyAuth(pool, activeSessions),
      async (req: Request, res: Response) => {
        try {
          const userId = getUserId(req);
          const campaign = await getCampaignById(pool, req.params.campaignId);
          if (!campaign || campaign.userId !== userId) return res.status(404).json({ error: 'campaign_not_found' });
          if (campaign.platform !== 'linkedin' || !campaign.externalCampaignId) {
            return res.status(400).json({ error: 'not_a_linkedin_campaign' });
          }
          const auth = await resolveLinkedInAuth(userId);
          if (!auth) return res.status(412).json({ error: 'linkedin_not_connected' });

          if (action === 'resume') {
            const period = new Date().toISOString().slice(0, 7);
            const spent = await sumSpendForProjectPeriod(pool, campaign.projectId, period);
            await assertWithinBudget(pool, campaign.projectId, period, spent);
          }
          await setLinkedInCampaignStatus(auth, campaign.externalCampaignId, action === 'pause' ? 'PAUSED' : 'ACTIVE');
          const updated = await updateCampaignStatus(pool, campaign.id, action === 'pause' ? 'paused' : 'active');
          res.json({ campaign: updated });
        } catch (error) {
          if (error instanceof BudgetExceededError) {
            return res.status(409).json({ error: 'budget_exceeded', detail: error.message, status: error.status });
          }
          if (error instanceof LinkedInAdsApiError) {
            return res.status(error.statusCode).json({ error: 'linkedin_api_error', detail: error.message });
          }
          res.status(500).json({ error: `Failed to ${action} LinkedIn campaign`, detail: String(error) });
        }
      },
    );
  }

  router.delete(
    '/ads/linkedin/campaigns/:campaignId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) return res.status(404).json({ error: 'campaign_not_found' });
        if (campaign.platform !== 'linkedin' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_linkedin_campaign' });
        }
        const auth = await resolveLinkedInAuth(userId);
        if (!auth) return res.status(412).json({ error: 'linkedin_not_connected' });
        await setLinkedInCampaignStatus(auth, campaign.externalCampaignId, 'CANCELED');
        const updated = await updateCampaignStatus(pool, campaign.id, 'ended');
        res.json({ campaign: updated });
      } catch (error) {
        if (error instanceof LinkedInAdsApiError) {
          return res.status(error.statusCode).json({ error: 'linkedin_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to end LinkedIn campaign', detail: String(error) });
      }
    },
  );

  // Cross-platform list — UI consumes this for the "All campaigns" view.
  router.get(
    '/ads/campaigns',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
        const platform = typeof req.query.platform === 'string'
          ? (req.query.platform as 'meta' | 'google' | 'tiktok' | 'linkedin')
          : undefined;
        const status = typeof req.query.status === 'string'
          ? (req.query.status as 'draft' | 'active' | 'paused' | 'ended' | 'failed')
          : undefined;
        const campaigns = await listCampaignsForUser(pool, userId, { projectId, platform, status });
        res.json({ campaigns });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list campaigns', detail: String(error) });
      }
    },
  );

  // ── Ads 2.0 — spend sync + client innsyn (§4 + §5.3) ─────
  // Manual sync trigger: pull insights → attribution → påslag-ledger for one
  // campaign. The daily cron-sweep calls the same orchestrator over all users.
  router.post(
    '/ads/meta/campaigns/:campaignId/sync',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (campaign.platform !== 'meta' || !campaign.externalCampaignId) {
          return res.status(400).json({ error: 'not_a_meta_campaign' });
        }
        const token = await resolveMetaToken(userId);
        if (!token) return res.status(412).json({ error: 'meta_not_connected' });

        const sinceISO = typeof req.body?.sinceISO === 'string' ? req.body.sinceISO : undefined;
        const untilISO = typeof req.body?.untilISO === 'string' ? req.body.untilISO : undefined;

        const result = await syncMetaCampaignSpend(pool, {
          campaign,
          accessToken: token,
          sinceISO,
          untilISO,
        });
        res.json({ sync: result });
      } catch (error) {
        if (error instanceof MetaAdsApiError) {
          return res.status(error.statusCode).json({ error: 'meta_api_error', detail: error.message });
        }
        res.status(500).json({ error: 'Failed to sync campaign spend', detail: String(error) });
      }
    },
  );

  // Generic per-platform manual sync — works for Meta, Google Ads and LinkedIn
  // Ads via the connector registry + per-platform token resolver.
  router.post(
    '/ads/campaigns/:campaignId/sync',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const campaign = await getCampaignById(pool, req.params.campaignId);
        if (!campaign || campaign.userId !== userId) {
          return res.status(404).json({ error: 'campaign_not_found' });
        }
        if (!campaign.externalCampaignId) {
          return res.status(400).json({ error: 'missing_external_campaign_id' });
        }
        const connector = buildAdsConnectorRegistry()[campaign.platform];
        if (!connector) {
          return res.status(400).json({ error: 'unsupported_platform', detail: campaign.platform });
        }
        const token = await buildPlatformTokenResolver(pool)(campaign.platform, userId);
        if (!token) {
          return res.status(412).json({ error: 'platform_not_connected', detail: campaign.platform });
        }
        const sinceISO = typeof req.body?.sinceISO === 'string' ? req.body.sinceISO : undefined;
        const untilISO = typeof req.body?.untilISO === 'string' ? req.body.untilISO : undefined;
        const result = await syncCampaignSpend(
          pool,
          { campaign, accessToken: token, sinceISO, untilISO },
          { connector },
        );
        res.json({ sync: result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to sync campaign spend', detail: String(error) });
      }
    },
  );

  // Client-facing spend report (§5.3): faktisk annonsekostnad + 20 % påslag per
  // periode (YYYY-MM). This is the innsyn-grunnlaget the customer can verify.
  router.get(
    '/ads/spend/summary',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const period =
          typeof req.query.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
            ? req.query.period
            : new Date().toISOString().slice(0, 7);

        const summary = await sumManagementFeeForPeriod(pool, userId, period);
        res.json({
          period,
          spendNok: summary.totalSpendNok,
          managementFeeNok: summary.totalFeeNok,
          managementFeeInclVatNok: summary.totalInclVatNok,
          effectiveFeeRate: summary.effectiveFeeRate,
          perPlatform: summary.perPlatform,
          // Total invoiced to the client per §4.2: faktisk annonsekostnad + påslag.
          totalClientCostExVatNok: summary.totalSpendNok + summary.totalFeeNok,
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load spend summary', detail: String(error) });
      }
    },
  );

  // Per-channel results (reporting, §5.3): forbruk, visninger, klikk,
  // konverteringer, konverteringsverdi og ROAS per plattform for en periode.
  router.get(
    '/ads/results/summary',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
        if (!projectId) return res.status(400).json({ error: 'projectId_required' });
        const period =
          typeof req.query.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
            ? req.query.period
            : new Date().toISOString().slice(0, 7);
        const rows = await getChannelResultRows(pool, projectId, period);
        const results = buildChannelResults(rows);
        res.json({ period, ...results });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load channel results', detail: String(error) });
      }
    },
  );

  // ── Lag 2: AI-anbefalinger (kunden + produsenten ser hva agenten foreslår) ──
  router.get(
    '/ads/recommendations',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
        if (!projectId) return res.status(400).json({ error: 'projectId_required' });
        const period =
          typeof req.query.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
            ? req.query.period
            : new Date().toISOString().slice(0, 7);
        const persisted = await fetchAdRecommendations(pool, projectId, period);
        if (!persisted) {
          return res.json({ period, recommendations: [], overallNote: null, generatedAt: null, generatedWithModel: null });
        }
        const data = persisted.recommendations as { recommendations?: unknown[]; overallNote?: string | null } | null;
        res.json({
          period,
          recommendations: Array.isArray(data?.recommendations) ? data!.recommendations : [],
          overallNote: data?.overallNote ?? null,
          generatedAt: persisted.generatedAt,
          generatedWithModel: persisted.generatedWithModel,
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load recommendations', detail: String(error) });
      }
    },
  );

  // Manuell trigger — nyttig for å se anbefalinger UTEN å vente på neste cron.
  // Entitlement-gated (samme kvote som marketing-plan / ad-creatives).
  router.post(
    '/ads/recommendations/generate',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { projectId } = req.body ?? {};
        const period =
          typeof req.body?.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period)
            ? req.body.period
            : new Date().toISOString().slice(0, 7);
        if (!projectId || typeof projectId !== 'string') {
          return res.status(400).json({ error: 'projectId_required' });
        }
        const entitlement = await checkAgentEntitlement(pool, userId, readRoleRoomDevUserRole(req));
        if (!entitlement.allowed) {
          return res.status(402).json({ error: 'entitlement_required', entitlement });
        }
        const summary = await runAdsRecommendationsForProject(pool, projectId, period);
        if (!summary) {
          return res.status(503).json({ error: 'generator_unavailable', detail: 'AI-generatoren er utilgjengelig. Prøv igjen.' });
        }
        res.json({ period, ...summary });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate recommendations', detail: String(error) });
      }
    },
  );

  // ── Ad-creative-generering (Lag 1: agenten lager riktige ads) ─────────
  // Tar bedriftskontekst (auto-beriket fra aktiv marketing-plan) + ad-input
  // (mål, plattform, landingsside, tilbud, compliance) og lar Claude lage
  // plattform-tilpasset annonsetekst som produsenten redigerer/godkjenner.
  // Selve creative lagres på kampanjen (creative_config) ved opprettelse.
  const VALID_AD_PLATFORMS = new Set<AdsPlatform>(['meta', 'google', 'linkedin', 'tiktok']);
  const VALID_AD_GOALS = new Set<AdsGoal>([
    'brand_awareness',
    'engagement',
    'lead_generation',
    'ecommerce_conversion',
    'retargeting',
  ]);

  router.post(
    '/ads/creatives/generate',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const {
          projectId,
          platform,
          goal,
          businessName,
          productOrService,
          industry,
          targetAudience,
          keyMessage,
          landingUrl,
          offer,
          complianceNotes,
          language,
        } = req.body ?? {};

        if (!projectId || typeof projectId !== 'string') {
          return res.status(400).json({ error: 'projectId_required' });
        }
        if (!VALID_AD_PLATFORMS.has(platform)) {
          return res.status(400).json({ error: 'invalid_platform', detail: 'platform må være meta/google/linkedin/tiktok' });
        }
        if (!VALID_AD_GOALS.has(goal)) {
          return res.status(400).json({ error: 'invalid_goal' });
        }

        // AI-generering teller mot agent-kvoten (samme som marketing-plan).
        const entitlement = await checkAgentEntitlement(pool, userId, readRoleRoomDevUserRole(req));
        if (!entitlement.allowed) {
          return res.status(402).json({ error: 'entitlement_required', entitlement });
        }

        // Auto-berik med den sterkeste merkevare-konteksten vi har: den
        // aktive marketing-planen (posisjonering, tone, pilarer).
        const plan = await fetchActiveMarketingPlan(pool, projectId).catch(() => null);
        const context: AdGenerationContext = {
          businessName: typeof businessName === 'string' && businessName.trim() ? businessName.trim() : 'Bedriften',
          productOrService: productOrService ?? null,
          industry: industry ?? null,
          valueProp: plan?.strategy?.positioning?.valueProp ?? null,
          differentiator: plan?.strategy?.positioning?.differentiator ?? null,
          toneVoice: plan?.strategy?.toneOfVoice?.voice ?? null,
          toneDos: plan?.strategy?.toneOfVoice?.dos ?? undefined,
          toneDonts: plan?.strategy?.toneOfVoice?.donts ?? undefined,
          pillars: plan?.pillars?.map((p) => ({ name: p.name, description: p.description })) ?? undefined,
          targetAudience: targetAudience ?? null,
          keyMessage: keyMessage ?? null,
          landingUrl: landingUrl ?? null,
          offer: offer ?? null,
          complianceNotes: complianceNotes ?? null,
          language: language === 'en' ? 'en' : 'no',
        };

        const readiness = checkAdGenerationReadiness(context);
        if (!readiness.ready) {
          return res.status(422).json({ error: 'insufficient_context', missingFields: readiness.missingFields });
        }

        const creative = await generateAdCreatives({
          context,
          platform: platform as AdsPlatform,
          goal: goal as AdsGoal,
        });
        if (!creative) {
          return res.status(503).json({ error: 'generator_unavailable', detail: 'AI-generatoren er utilgjengelig. Prøv igjen.' });
        }
        res.json({ creative });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate ad creatives', detail: String(error) });
      }
    },
  );

  // ── Ads budsjett-tak (§3 / §2.3) ─────────────────────────
  // Kunden setter maks annonsekostnad per periode; produsenten kan ikke
  // overskride uten kundens skriftlige godkjenning (overage).
  async function isClientForProject(req: Request, projectId: string): Promise<boolean> {
    const record = await getProjectRoleRecord(projectId, getUserIdentifiers(req));
    const effective = getEffectiveProjectRoleRecord(req, record);
    const role = (effective?.role ?? '').toLowerCase();
    return role === 'client' || role === 'client_reviewer';
  }

  const currentPeriod = () => new Date().toISOString().slice(0, 7);

  router.get(
    '/ads/budget',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
        if (!projectId) return res.status(400).json({ error: 'projectId_required' });
        const period = typeof req.query.period === 'string' && /^\d{4}-\d{2}$/.test(req.query.period)
          ? req.query.period
          : currentPeriod();
        const budget = await getBudget(pool, projectId, period);
        const actualSpendNok = await sumSpendForProjectPeriod(pool, projectId, period);
        const status = computeBudgetStatus({
          hasBudget: !!budget,
          maxSpendNok: budget?.maxSpendNok ?? 0,
          approvedOverageNok: budget?.approvedOverageNok ?? 0,
          actualSpendNok,
          overageRequestedNok: budget?.overageRequestedNok ?? null,
        });
        const pacing = computeBudgetPacing({ status, period });
        const autoPauseOnCap = budget?.autoPauseOnCap ?? false;
        res.json({ period, status, pacing, autoPauseOnCap, canEdit: await isClientForProject(req, projectId) });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load budget', detail: String(error) });
      }
    },
  );

  router.put(
    '/ads/budget',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const { projectId, maxSpendNok } = req.body ?? {};
        const period = typeof req.body?.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period)
          ? req.body.period
          : currentPeriod();
        if (!projectId || typeof maxSpendNok !== 'number' || maxSpendNok < 0) {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId + maxSpendNok (>=0) required' });
        }
        if (!(await isClientForProject(req, projectId))) {
          return res.status(403).json({ error: 'client_only', detail: 'Bare kunden kan sette budsjettet (§3.1).' });
        }
        const identifiers = getUserIdentifiers(req);
        const budget = await setBudget(pool, projectId, period, maxSpendNok, identifiers[0] ?? 'klient');
        res.json({ budget });
      } catch (error) {
        res.status(500).json({ error: 'Failed to set budget', detail: String(error) });
      }
    },
  );

  // Lag 3b: klient-styrt auto-pause-toggle. Off by default; krever §2.3-skriftlig
  // godkjenning-prinsipp respektert (kunden er den eneste som kan slå på/av).
  router.put(
    '/ads/budget/auto-pause',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const { projectId, enabled } = req.body ?? {};
        const period = typeof req.body?.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period)
          ? req.body.period
          : currentPeriod();
        if (!projectId || typeof enabled !== 'boolean') {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId + enabled (boolean) required' });
        }
        if (!(await isClientForProject(req, projectId))) {
          return res.status(403).json({ error: 'client_only', detail: 'Bare kunden kan styre auto-pause (§2.3).' });
        }
        const identifiers = getUserIdentifiers(req);
        const budget = await setAutoPauseOnCap(pool, projectId, period, enabled, identifiers[0] ?? 'klient');
        res.json({ budget });
      } catch (error) {
        res.status(500).json({ error: 'Failed to set auto-pause', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/budget/request-overage',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const { projectId, requestedNok, note } = req.body ?? {};
        const period = typeof req.body?.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period)
          ? req.body.period
          : currentPeriod();
        if (!projectId || typeof requestedNok !== 'number' || requestedNok < 0) {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId + requestedNok (>=0) required' });
        }
        const identifiers = getUserIdentifiers(req);
        const budget = await requestOverage(
          pool, projectId, period, requestedNok,
          typeof note === 'string' ? note : null,
          identifiers[0] ?? 'produsent',
        );
        if (!budget) return res.status(404).json({ error: 'budget_not_set', detail: 'Kunden må sette et budsjett først.' });
        res.json({ budget });
      } catch (error) {
        res.status(500).json({ error: 'Failed to request overage', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/budget/approve-overage',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const { projectId, approvedOverageNok } = req.body ?? {};
        const period = typeof req.body?.period === 'string' && /^\d{4}-\d{2}$/.test(req.body.period)
          ? req.body.period
          : currentPeriod();
        if (!projectId || typeof approvedOverageNok !== 'number' || approvedOverageNok < 0) {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId + approvedOverageNok (>=0) required' });
        }
        if (!(await isClientForProject(req, projectId))) {
          return res.status(403).json({ error: 'client_only', detail: 'Bare kunden kan godkjenne en høyere ramme (§2.3).' });
        }
        const identifiers = getUserIdentifiers(req);
        const budget = await approveOverage(pool, projectId, period, approvedOverageNok, identifiers[0] ?? 'klient');
        if (!budget) return res.status(404).json({ error: 'budget_not_set' });
        res.json({ budget });
      } catch (error) {
        res.status(500).json({ error: 'Failed to approve overage', detail: String(error) });
      }
    },
  );

  // ── Ads OAuth — dedicated ads-scoped consent (Google Ads + LinkedIn Ads) ──
  // Deliberately separate from the Workspace/login OAuth so we never force
  // ads-consent on login users. Tokens land in role_room_ads_oauth_connections
  // and power resolveToken('google'|'linkedin', …) in the sweep.
  const ADS_OAUTH_PLATFORMS = new Set(['google', 'linkedin']);

  router.get(
    '/ads/connections',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const connections = await listAdsOauthConnections(pool, userId);
        res.json({
          connections: connections.map((c) => ({
            platform: c.platform,
            connectionState: c.connectionState,
            scopes: c.scopes,
            accountRef: c.accountRef,
            tokenExpiresAt: c.tokenExpiresAt,
          })),
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list ads connections', detail: String(error) });
      }
    },
  );

  // Granted-asset overview shown to the producer at login: which Pages / ad
  // accounts / Company Pages the CLIENT has given them access to — across Meta
  // and LinkedIn — with admin access clearly flagged.
  router.get(
    '/ads/assets',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const resolveToken = buildPlatformTokenResolver(pool);

        type AdminAsset = {
          platform: 'meta' | 'linkedin';
          assetType: string;
          id: string;
          name: string | null;
          logoUrl: string | null;
          accessSummary: string;
        };
        const adminAssets: AdminAsset[] = [];

        // ── Meta Pages ──
        let meta: Record<string, unknown> = { connected: false };
        const metaToken = await resolveToken('meta', userId).catch(() => null);
        if (metaToken) {
          const pages = await listMetaManagedPages(metaToken).catch(() => []);
          const decorated = pages.map((p) => ({
            ...p,
            accessLabels: p.tasks.map(metaTaskLabel),
          }));
          meta = {
            connected: true,
            pages: decorated,
            adminCount: pages.filter((p) => p.isAdmin).length,
          };
          for (const p of pages) {
            if (p.isAdmin) {
              adminAssets.push({
                platform: 'meta',
                assetType: p.instagramBusinessAccount ? 'page+instagram' : 'page',
                id: p.id,
                name: p.name,
                logoUrl: p.pictureUrl ?? p.instagramBusinessAccount?.profilePictureUrl ?? null,
                accessSummary: 'Full admin',
              });
            }
          }
        }

        // ── LinkedIn ad accounts + Company Pages ──
        let linkedin: Record<string, unknown> = { connected: false };
        const liToken = await resolveToken('linkedin', userId).catch(() => null);
        if (liToken) {
          const assets = await listGrantedLinkedInAssets(liToken).catch(() => []);
          const decorated = assets.map((a) => ({ ...a, roleLabel: linkedInRoleLabel(a.role) }));
          linkedin = {
            connected: true,
            assets: decorated,
            adminCount: assets.filter((a) => a.isAdmin).length,
          };
          for (const a of assets) {
            if (a.isAdmin) {
              adminAssets.push({
                platform: 'linkedin',
                assetType: a.assetType,
                id: a.id,
                name: a.name,
                logoUrl: a.logoUrl,
                accessSummary: linkedInRoleLabel(a.role),
              });
            }
          }
        }

        res.json({
          hasAdminAccess: adminAssets.length > 0,
          adminAssets,
          platforms: { meta, linkedin },
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to load granted assets', detail: String(error) });
      }
    },
  );

  router.post(
    '/ads/:platform/oauth/start',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const platform = String(req.params.platform);
        if (!ADS_OAUTH_PLATFORMS.has(platform)) {
          return res.status(400).json({ error: 'unsupported_platform', detail: platform });
        }
        const typedPlatform = platform as 'google' | 'linkedin';
        const creds = adsOauthClientCreds(typedPlatform);
        if (!creds) {
          return res.status(400).json({
            error: 'oauth_not_configured',
            detail: `${platform} ads OAuth client-creds mangler i env`,
          });
        }
        const browserOrigin =
          sanitizeRoleRoomBrowserOrigin(req.body?.browserOrigin) ?? getRoleRoomRequestOrigin(req);
        const redirectUri = `${browserOrigin}/api/role-room/ads/${platform}/oauth/callback`;
        const returnPath = typeof req.body?.returnPath === 'string' ? req.body.returnPath : '/';
        const stateId = crypto.randomUUID();
        await persistOauthState(
          pool,
          stateId,
          { platform, browserOrigin, redirectUri, returnPath, userId, createdAt: Date.now() },
          new Date(Date.now() + 10 * 60 * 1000),
        );
        const authorizationUrl = buildAdsAuthUrl(typedPlatform, {
          clientId: creds.clientId,
          redirectUri,
          state: stateId,
        });
        if (!authorizationUrl) return res.status(400).json({ error: 'unsupported_platform' });
        res.json({ success: true, authorizationUrl, stateId, scopes: ADS_OAUTH_SCOPES[typedPlatform] });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start ads OAuth', detail: String(error) });
      }
    },
  );

  router.get(
    '/ads/:platform/oauth/callback',
    async (req: Request, res: Response) => {
      try {
        const platform = String(req.params.platform);
        const stateId = typeof req.query.state === 'string' ? req.query.state : '';
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = stateId
          ? await loadOauthState<{
              platform: string;
              browserOrigin: string | null;
              redirectUri: string;
              returnPath: string;
              userId: string;
            }>(pool, stateId)
          : null;
        if (!state || state.platform !== platform || !code) {
          return res.status(400).json({ error: 'invalid_oauth_state' });
        }
        const typedPlatform = platform as 'google' | 'linkedin';
        const creds = adsOauthClientCreds(typedPlatform);
        if (!creds) return res.status(400).json({ error: 'oauth_not_configured' });

        const tokens = await exchangeAdsCodeForToken(typedPlatform, {
          code,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          redirectUri: state.redirectUri,
        });
        await upsertAdsOauthConnection(pool, {
          userId: state.userId,
          platform: typedPlatform,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          expiresInSec: tokens.expiresInSec,
          scopes: ADS_OAUTH_SCOPES[typedPlatform] ?? [],
        });
        const base = state.browserOrigin ?? '';
        res.redirect(`${base}${state.returnPath}?adsOauthStatus=connected&platform=${platform}`);
      } catch (error) {
        res.status(500).json({ error: 'ads_oauth_callback_failed', detail: String(error) });
      }
    },
  );

  // ── Carousel pipeline (Slice 1 + 2 + 3) ────────────────
  // Three composable endpoints + one orchestrator that runs the
  // whole pipeline in a single call — convenient for early demo
  // before the editor UI ships in Slice 4.

  router.post(
    '/carousel/analyze-website',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { url, skipClaude } = req.body ?? {};
        if (typeof url !== 'string' || !url.trim()) {
          return res.status(400).json({ error: 'invalid_input', detail: 'url required' });
        }
        const normalized = normalizeUrl(url);
        const urlHash = hashUrl(normalized);
        const cached = await pool.query<{
          id: string;
          brand_profile: Record<string, unknown>;
          fetched_at: string;
          expires_at: string;
        }>(
          `SELECT id, brand_profile, fetched_at, expires_at
             FROM website_analyses
            WHERE user_id = $1 AND url_hash = $2 AND expires_at > now()`,
          [userId, urlHash],
        );
        if (cached.rowCount && cached.rows[0]) {
          return res.json({
            analysisId: cached.rows[0].id,
            cached: true,
            brandProfile: cached.rows[0].brand_profile,
          });
        }
        const profile = await analyzeWebsite(url, { skipClaude: !!skipClaude });
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const inserted = await pool.query<{ id: string }>(
          `INSERT INTO website_analyses
             (user_id, url, url_hash, brand_profile, expires_at)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (user_id, url_hash) DO UPDATE SET
             brand_profile = EXCLUDED.brand_profile,
             fetched_at = now(),
             expires_at = EXCLUDED.expires_at
           RETURNING id`,
          [userId, profile.url, urlHash, JSON.stringify(profile), expiresAt],
        );
        res.json({
          analysisId: inserted.rows[0].id,
          cached: false,
          brandProfile: profile,
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to analyze website',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.post(
    '/carousel/generate-week',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { analysisId, weekStarting } = req.body ?? {};
        if (!analysisId || !weekStarting) {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'analysisId + weekStarting required',
          });
        }
        const row = await pool.query<{
          brand_profile: Record<string, unknown>;
        }>(
          `SELECT brand_profile FROM website_analyses
            WHERE id = $1 AND user_id = $2`,
          [analysisId, userId],
        );
        if (!row.rowCount) {
          return res.status(404).json({ error: 'analysis_not_found' });
        }
        const brand = row.rows[0].brand_profile as unknown as Parameters<typeof generateWeekPlan>[0];
        const plan = await generateWeekPlan(brand, weekStarting);
        res.json({ plan });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to generate week plan',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  // Orchestrator — analyze + plan + generate draft in one shot.
  router.post(
    '/carousel/generate-draft',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { url, weekStarting, skipClaude } = req.body ?? {};
        if (!url || !weekStarting) {
          return res.status(400).json({
            error: 'invalid_input',
            detail: 'url + weekStarting required',
          });
        }

        // 1) Analyze (with cache)
        const normalized = normalizeUrl(url);
        const urlHash = hashUrl(normalized);
        const cached = await pool.query<{ id: string; brand_profile: Record<string, unknown> }>(
          `SELECT id, brand_profile FROM website_analyses
            WHERE user_id = $1 AND url_hash = $2 AND expires_at > now()`,
          [userId, urlHash],
        );
        let analysisId: string;
        let brandProfile: Parameters<typeof generateWeekPlan>[0];
        if (cached.rowCount && cached.rows[0]) {
          analysisId = cached.rows[0].id;
          brandProfile = cached.rows[0].brand_profile as unknown as Parameters<typeof generateWeekPlan>[0];
        } else {
          brandProfile = await analyzeWebsite(url, { skipClaude: !!skipClaude });
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const inserted = await pool.query<{ id: string }>(
            `INSERT INTO website_analyses
               (user_id, url, url_hash, brand_profile, expires_at)
             VALUES ($1, $2, $3, $4::jsonb, $5)
             ON CONFLICT (user_id, url_hash) DO UPDATE SET
               brand_profile = EXCLUDED.brand_profile,
               fetched_at = now(),
               expires_at = EXCLUDED.expires_at
             RETURNING id`,
            [userId, brandProfile.url, urlHash, JSON.stringify(brandProfile), expiresAt],
          );
          analysisId = inserted.rows[0].id;
        }

        // 2) Strategist
        const plan = await generateWeekPlan(brandProfile, weekStarting);

        // 3) Generator (DB transaction inside)
        const fallbackColor = brandProfile.colors?.primary ?? '#0a0617';
        const resolverCtx = makeDefaultResolverContext(pool, fallbackColor);
        const draft = await generateCarouselDraft(
          pool,
          { userId, websiteAnalysisId: analysisId, weekPlan: plan, brand: brandProfile },
          resolverCtx,
        );

        res.status(201).json({ draft });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to generate draft',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.get(
    '/carousel/drafts/:draftId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const draft = await pool.query(
          `SELECT * FROM carousel_drafts WHERE id = $1 AND user_id = $2`,
          [req.params.draftId, userId],
        );
        if (!draft.rowCount) {
          return res.status(404).json({ error: 'draft_not_found' });
        }
        const posts = await pool.query(
          `SELECT * FROM carousel_posts WHERE draft_id = $1 ORDER BY day_of_week ASC`,
          [req.params.draftId],
        );
        const slides = await pool.query(
          `SELECT s.* FROM carousel_slides s
             JOIN carousel_posts p ON p.id = s.post_id
            WHERE p.draft_id = $1
            ORDER BY p.day_of_week ASC, s.slide_index ASC`,
          [req.params.draftId],
        );
        res.json({
          draft: draft.rows[0],
          posts: posts.rows,
          slides: slides.rows,
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load draft',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.get(
    '/carousel/drafts',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const result = await pool.query(
          `SELECT id, week_starting, status, total_posts, approved_post_count, created_at
             FROM carousel_drafts
            WHERE user_id = $1
            ORDER BY week_starting DESC
            LIMIT 50`,
          [userId],
        );
        res.json({ drafts: result.rows });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to list drafts',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  // Persistence for editor edits (Slice 4.5)
  // Each PATCH writes a row to carousel_versions for undo / audit.

  /**
   * Verify the slide / post belongs to the calling user. Throws 404 if not.
   * Returns the post-id (helps callers chain inserts to versions).
   */
  async function assertSlideOwnership(
    userId: string,
    slideId: string,
  ): Promise<{ postId: string } | null> {
    const result = await pool.query<{ post_id: string }>(
      `SELECT s.post_id
         FROM carousel_slides s
         JOIN carousel_posts p ON p.id = s.post_id
         JOIN carousel_drafts d ON d.id = p.draft_id
        WHERE s.id = $1 AND d.user_id = $2`,
      [slideId, userId],
    );
    if (!result.rowCount) return null;
    return { postId: result.rows[0].post_id };
  }

  async function assertPostOwnership(
    userId: string,
    postId: string,
  ): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM carousel_posts p
         JOIN carousel_drafts d ON d.id = p.draft_id
        WHERE p.id = $1 AND d.user_id = $2`,
      [postId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function snapshotPostVersion(
    postId: string,
    userId: string,
    summary: string,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO carousel_versions (post_id, version_number, snapshot, changed_by, change_summary)
       SELECT
         $1,
         COALESCE((SELECT MAX(version_number) FROM carousel_versions WHERE post_id = $1), 0) + 1,
         to_jsonb(p.*),
         $2,
         $3
       FROM carousel_posts p WHERE p.id = $1`,
      [postId, userId, summary],
    );
  }

  router.patch(
    '/carousel/slides/:slideId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { textBlocks, layout, imageRef } = req.body ?? {};
        const owner = await assertSlideOwnership(userId, req.params.slideId);
        if (!owner) return res.status(404).json({ error: 'slide_not_found' });

        const setExpr: string[] = [];
        const params: unknown[] = [req.params.slideId];
        if (textBlocks !== undefined) {
          params.push(JSON.stringify(textBlocks));
          setExpr.push(`text_blocks = $${params.length}::jsonb`);
        }
        if (layout !== undefined) {
          params.push(layout);
          setExpr.push(`layout = $${params.length}`);
        }
        if (imageRef !== undefined) {
          params.push(JSON.stringify(imageRef));
          setExpr.push(`image_ref = $${params.length}::jsonb`);
        }
        if (setExpr.length === 0) {
          return res.status(400).json({ error: 'invalid_input', detail: 'no patchable fields' });
        }

        await snapshotPostVersion(owner.postId, userId, `slide ${req.params.slideId} edited`);
        const result = await pool.query(
          `UPDATE carousel_slides SET ${setExpr.join(', ')}
            WHERE id = $1 RETURNING *`,
          params,
        );
        res.json({ slide: result.rows[0] });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to update slide',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.post(
    '/carousel/slides/:slideId/ai-image',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const owner = await assertSlideOwnership(userId, req.params.slideId);
        if (!owner) return res.status(404).json({ error: 'slide_not_found' });

        const { prompt, aspectRatio, brandColors, enrichWithBrand } = req.body ?? {};
        if (typeof prompt !== 'string' || !prompt.trim()) {
          return res.status(400).json({ error: 'invalid_input', detail: 'prompt required' });
        }
        const replicate = makeReplicateClient();
        // Minimal R2 stub — caller may wire a real one in a follow-up
        const r2 = {
          async upload(key: string, _buffer: Buffer, _ct: string): Promise<string> {
            // Without a writeable R2 binding we just hand back a deterministic
            // placeholder URL; caller swaps via env-injected uploader later.
            return `https://r2.creatorhubn.com/${key}`;
          },
        };
        const result = await generateAiImage(
          { replicate, r2, pool },
          {
            userId,
            slideId: req.params.slideId,
            prompt,
            brandColors: brandColors ?? { primary: '#0a0617', secondary: '#1a1133', accent: '#a855f7' },
            aspectRatio: aspectRatio ?? '1:1',
            enrichWithBrand: enrichWithBrand !== false,
          },
        );

        // Patch slide with the new imageRef
        await pool.query(
          `UPDATE carousel_slides
              SET image_ref = $2::jsonb
            WHERE id = $1`,
          [
            req.params.slideId,
            JSON.stringify({
              strategy: 'ai',
              prompt: result.prompt,
              generatedUrl: result.generatedUrl,
              cost: result.cost,
              model: result.model,
            }),
          ],
        );

        res.json({ result });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to generate AI image',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.post(
    '/carousel/slides/:slideId/gallery-matches',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const owner = await assertSlideOwnership(userId, req.params.slideId);
        if (!owner) return res.status(404).json({ error: 'slide_not_found' });
        const { prompt, projectId, limit } = req.body ?? {};
        if (typeof prompt !== 'string' || !prompt.trim()) {
          return res.status(400).json({ error: 'invalid_input', detail: 'prompt required' });
        }
        const matches = await findGalleryMatches(pool, {
          userId,
          prompt,
          preferredProjectId: projectId ?? null,
          limit: typeof limit === 'number' ? limit : 12,
        });
        res.json({ matches });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to find gallery matches',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.post(
    '/carousel/posts/:postId/approve-and-publish',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { projectId, scheduledAt } = req.body ?? {};
        if (!projectId) {
          return res.status(400).json({ error: 'invalid_input', detail: 'projectId required' });
        }
        const owns = await assertPostOwnership(userId, req.params.postId);
        if (!owns) return res.status(404).json({ error: 'post_not_found' });

        const postRow = await pool.query(
          `SELECT * FROM carousel_posts WHERE id = $1`,
          [req.params.postId],
        );
        if (!postRow.rowCount) return res.status(404).json({ error: 'post_not_found' });
        const dbPost = postRow.rows[0];

        const slidesRow = await pool.query(
          `SELECT * FROM carousel_slides WHERE post_id = $1 ORDER BY slide_index ASC`,
          [req.params.postId],
        );

        const post: PublishablePost = {
          id: dbPost.id,
          draftId: dbPost.draft_id,
          dayOfWeek: dbPost.day_of_week,
          format: dbPost.format,
          primaryPlatform: dbPost.primary_platform,
          hook: dbPost.hook,
          narrative: dbPost.narrative,
          caption: dbPost.caption,
          scheduledAt: scheduledAt ?? dbPost.scheduled_at ?? null,
        };

        const slides: PublishableSlide[] = slidesRow.rows.map((s) => ({
          id: s.id,
          postId: s.post_id,
          slideIndex: s.slide_index,
          imageRef: s.image_ref,
          textBlocks: s.text_blocks,
          brandOverlays: s.brand_overlays,
        }));

        const result = await publishCarouselPost(pool, userId, post, slides, {
          projectId,
        });

        // Update parent draft approved-count + status
        await pool.query(
          `UPDATE carousel_drafts d
              SET approved_post_count = (
                SELECT COUNT(*) FROM carousel_posts p
                 WHERE p.draft_id = d.id AND p.status IN ('approved','scheduled','published')
              )
            WHERE d.id = $1`,
          [dbPost.draft_id],
        );

        res.json({ result });
      } catch (error) {
        if (error instanceof ValidationFailedError) {
          return res.status(422).json({
            error: 'validation_failed',
            detail: error.message,
            errors: error.errors,
          });
        }
        res.status(500).json({
          error: 'Failed to approve and publish',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  router.patch(
    '/carousel/posts/:postId',
    apiKeyAuth(pool, activeSessions),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { caption, hook, narrative, scheduledAt, status } = req.body ?? {};
        const owns = await assertPostOwnership(userId, req.params.postId);
        if (!owns) return res.status(404).json({ error: 'post_not_found' });

        const setExpr: string[] = [];
        const params: unknown[] = [req.params.postId];
        if (caption !== undefined) {
          params.push(JSON.stringify(caption));
          setExpr.push(`caption = $${params.length}::jsonb`);
        }
        if (hook !== undefined) {
          params.push(hook);
          setExpr.push(`hook = $${params.length}`);
        }
        if (narrative !== undefined) {
          params.push(narrative);
          setExpr.push(`narrative = $${params.length}`);
        }
        if (scheduledAt !== undefined) {
          params.push(scheduledAt);
          setExpr.push(`scheduled_at = $${params.length}`);
        }
        if (status !== undefined) {
          params.push(status);
          setExpr.push(`status = $${params.length}`);
          if (status === 'approved') {
            setExpr.push('approved_at = now()');
            params.push(userId);
            setExpr.push(`approved_by = $${params.length}`);
          }
        }
        if (setExpr.length === 0) {
          return res.status(400).json({ error: 'invalid_input', detail: 'no patchable fields' });
        }

        await snapshotPostVersion(req.params.postId, userId, `post edited`);
        const result = await pool.query(
          `UPDATE carousel_posts SET ${setExpr.join(', ')}
            WHERE id = $1 RETURNING *`,
          params,
        );

        // Update approval count on parent draft when status changes to approved
        if (status === 'approved') {
          await pool.query(
            `UPDATE carousel_drafts d
                SET approved_post_count = (
                  SELECT COUNT(*) FROM carousel_posts p
                   WHERE p.draft_id = d.id AND p.status IN ('approved','scheduled','published')
                ),
                status = CASE
                  WHEN (SELECT COUNT(*) FROM carousel_posts p
                          WHERE p.draft_id = d.id AND p.status IN ('approved','scheduled','published')
                       ) >= total_posts THEN 'partially_approved'
                  ELSE status END
              FROM carousel_posts p
             WHERE p.id = $1 AND p.draft_id = d.id`,
            [req.params.postId],
          );
        }

        res.json({ post: result.rows[0] });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to update post',
          detail: String((error as Error)?.message ?? error),
        });
      }
    },
  );

  return router;
}
