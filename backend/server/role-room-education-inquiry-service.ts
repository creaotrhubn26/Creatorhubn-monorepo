/**
 * role-room-education-inquiry-service.ts
 *
 * Service-lag for /api/role-room/education-inquiries-endpointet:
 * validering, spam-deteksjon, IP-rate-limit, BRREG-koblet duplikat-
 * sjekk og admin-notifikasjons-e-post (Gmail API → SMTP fallback).
 *
 * Design:
 *   - Education-spesifikke konstanter, types og IP-attempt-state bor i
 *     denne modulen (delt med ingen andre endpoints).
 *   - Delte index.ts-helpers (pool, hasTable, getTableColumns, mail-
 *     rendering, invite-request-upsert m.fl.) passes via deps.
 *   - Eksporterer `createRoleRoomEducationInquiryService(deps)` som
 *     returnerer 8 funksjoner samt LABELS/types som routes-modulen
 *     trenger ved metadata-bygging.
 *
 * Kalles av role-room-education-inquiries-routes.ts (egen modul).
 */

import type express from "express";
import type { Pool } from "pg";
import { google } from "googleapis";
import type { Transporter } from "nodemailer";

// ── Types ────────────────────────────────────────────────────────────

export type RoleRoomEducationInstitutionType =
  | "upper_secondary"
  | "folk_high_school"
  | "vocational_college"
  | "higher_education"
  | "private_school";

export type RoleRoomEducationSeatRange =
  | "up_to_15"
  | "up_to_30"
  | "up_to_60"
  | "up_to_120"
  | "more_than_120";

export type RoleRoomEducationStartWindow =
  | "this_semester"
  | "next_semester"
  | "next_academic_year"
  | "exploring";

export type RoleRoomEducationInquirySpamReason =
  | "bot_filtered"
  | "submitted_too_fast"
  | "rate_limited"
  | "disposable_email_blocked"
  | "turnstile_failed";

export type RoleRoomEducationInquirySpamSignal = {
  reason: RoleRoomEducationInquirySpamReason;
  reasonLabel: string;
  recordedAt: string;
  ipAddress: string;
  detail?: string | null;
};

export type RoleRoomEducationInquiryMetadata = {
  kind: "role_room_education_inquiry";
  version: 1;
  companyName: string;
  organizationNumber: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  institutionType: RoleRoomEducationInstitutionType;
  institutionTypeLabel: string;
  programName: string;
  studentSeatRange: RoleRoomEducationSeatRange;
  studentSeatLabel: string;
  staffSeatRange: RoleRoomEducationSeatRange;
  staffSeatLabel: string;
  desiredStartWindow: RoleRoomEducationStartWindow;
  desiredStartWindowLabel: string;
  useCase: string;
  taxMode: "ex_vat";
  spamSignals?: RoleRoomEducationInquirySpamSignal[];
};

type RoleRoomEducationSpamAttemptMetadata = {
  kind: "role_room_education_spam_attempt";
  version: 1;
  companyName: string;
  organizationNumber: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  institutionType: string | null;
  institutionTypeLabel: string | null;
  programName: string;
  studentSeatRange: string | null;
  studentSeatLabel: string | null;
  staffSeatRange: string | null;
  staffSeatLabel: string | null;
  desiredStartWindow: string | null;
  desiredStartWindowLabel: string | null;
  useCase: string;
  taxMode: "ex_vat";
  spamReason: RoleRoomEducationInquirySpamReason;
  spamReasonLabel: string;
  spamRecordedAt: string;
  ipAddress: string;
  detail?: string | null;
};

// ── Constants ────────────────────────────────────────────────────────

export const ROLE_ROOM_EDUCATION_INSTITUTION_TYPE_LABELS: Record<
  RoleRoomEducationInstitutionType,
  string
> = {
  upper_secondary: "Videregående skole",
  folk_high_school: "Folkehøyskole",
  vocational_college: "Fagskole",
  higher_education: "Høyskole / universitet",
  private_school: "Privat skole / kursaktør",
};

export const ROLE_ROOM_EDUCATION_STUDENT_RANGE_LABELS: Record<
  RoleRoomEducationSeatRange,
  string
> = {
  up_to_15: "Opptil 15 studenter",
  up_to_30: "16–30 studenter",
  up_to_60: "31–60 studenter",
  up_to_120: "61–120 studenter",
  more_than_120: "120+ studenter",
};

export const ROLE_ROOM_EDUCATION_STAFF_RANGE_LABELS: Record<
  RoleRoomEducationSeatRange,
  string
> = {
  up_to_15: "1–2 faglærere / koordinatorer",
  up_to_30: "3–5 faglærere / koordinatorer",
  up_to_60: "6–10 faglærere / koordinatorer",
  up_to_120: "11–20 faglærere / koordinatorer",
  more_than_120: "20+ faglærere / koordinatorer",
};

export const ROLE_ROOM_EDUCATION_START_WINDOW_LABELS: Record<
  RoleRoomEducationStartWindow,
  string
> = {
  this_semester: 'Så snart som mulig',
  next_semester: 'Neste semester',
  next_academic_year: 'Neste studieår',
  exploring: 'Vi sonderer fortsatt',
};

const ROLE_ROOM_EDUCATION_INQUIRY_IP_WINDOW_MS = 60 * 60 * 1000;
const ROLE_ROOM_EDUCATION_INQUIRY_IP_MAX_ATTEMPTS = 6;
const ROLE_ROOM_EDUCATION_INQUIRY_CONTACT_COOLDOWN_MS = 30 * 60 * 1000;
const ROLE_ROOM_EDUCATION_INQUIRY_ORG_NOTIFICATION_COOLDOWN_MS =
  6 * 60 * 60 * 1000;
const ROLE_ROOM_EDUCATION_DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "trashmail.com",
  "yopmail.com",
]);
const ROLE_ROOM_EDUCATION_SPAM_REASON_LABELS: Record<
  RoleRoomEducationInquirySpamReason,
  string
> = {
  bot_filtered: "Honeypot trigget",
  submitted_too_fast: "Sendt inn for raskt",
  rate_limited: "Rate limit trigget",
  disposable_email_blocked: "Midlertidig e-post blokkert",
  turnstile_failed: "Turnstile verifisering feilet",
};

// ── Dep types for shared helpers from index.ts ──────────────────────

export interface AdminInviteRequestUpsertInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profession?: string | null;
  businessName?: string | null;
  organizationNumber?: string | null;
  status?: string | null;
  userJourneyStatus?: string | null;
  source?: string | null;
  selectedPlan?: string | null;
  planName?: string | null;
  planPrice?: number | null;
  paymentCompleted?: boolean | null;
  message?: string | null;
  sendInvite?: boolean;
  processed?: boolean;
  registeredUserId?: string | null;
  processedBy?: string | null;
}

export interface RenderedRoleRoomPlatformEmail {
  subject: string;
  html: string;
  text: string;
  replyToEmail: string;
}

export interface RoleRoomEducationInquiryGmailSender {
  adminEmail: string;
  senderEmail: string;
  authorized: {
    oauthClient: ConstructorParameters<typeof google.auth.OAuth2>[number] extends never
      ? unknown
      : InstanceType<typeof google.auth.OAuth2>;
  };
}

export interface RoleRoomEducationInquiryServiceDeps {
  pool: Pool;
  hasTable: (tableName: string) => Promise<boolean>;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  normalizeMailConfigValue: (value: unknown) => string;
  splitRoleRoomContactName: (name: string) => {
    firstName: string;
    lastName: string;
  };
  findAdminInviteRequest: (
    identifier: string,
    emailHint?: string | null,
  ) => Promise<Record<string, unknown> | null>;
  upsertAdminInviteRequest: (
    input: AdminInviteRequestUpsertInput,
  ) => Promise<Record<string, unknown> | null>;
  getRoleRoomEducationInquiryMailer: () => Transporter | null;
  renderRoleRoomPlatformEmail: (input: {
    templateId: string;
    variables: Record<string, string | number | null | undefined>;
    ctaUrl?: string | null;
    replyToEmail?: string | null;
    detailRows?: Array<{ label: string; value: string }>;
    noticeSection?: {
      label?: string;
      body: string;
      tone?: "neutral" | "danger";
    } | null;
  }) => Promise<RenderedRoleRoomPlatformEmail>;
  resolveRoleRoomEducationInquiryGmailSender: () => Promise<RoleRoomEducationInquiryGmailSender | null>;
  buildGmailRawMessage: (options: {
    to: string;
    from: string;
    replyTo?: string | null;
    subject: string;
    text?: string | null;
    html: string;
  }) => Promise<string>;
}

// ── Service-output ───────────────────────────────────────────────────

export interface RoleRoomEducationInquiryAdminEmailResult {
  sent: boolean;
  reason: string | null;
  accepted: string[];
  provider?: string;
  messageId?: string;
}

export interface RoleRoomEducationInquiryService {
  isRoleRoomEducationInstitutionType: (
    value: unknown,
  ) => value is RoleRoomEducationInstitutionType;
  isRoleRoomEducationSeatRange: (
    value: unknown,
  ) => value is RoleRoomEducationSeatRange;
  isRoleRoomEducationStartWindow: (
    value: unknown,
  ) => value is RoleRoomEducationStartWindow;
  isRoleRoomEducationDisposableEmail: (email: string) => boolean;
  getRoleRoomRequestIpAddress: (req: express.Request) => string;
  registerRoleRoomEducationInquiryIpAttempt: (
    ipAddress: string,
  ) => { allowed: boolean; retryAfterSeconds: number };
  recordRoleRoomEducationInquirySpamAttempt: (input: {
    organizationNumber: string;
    companyName?: string | null;
    contactName: string;
    contactEmail: string;
    contactRole?: string | null;
    institutionType?: unknown;
    programName?: string | null;
    studentSeatRange?: unknown;
    staffSeatRange?: unknown;
    desiredStartWindow?: unknown;
    useCase?: string | null;
    ipAddress: string;
    reason: RoleRoomEducationInquirySpamReason;
    detail?: string | null;
  }) => Promise<Record<string, unknown> | null>;
  readRoleRoomEducationInquirySpamState: (input: {
    contactEmail: string;
    organizationNumber: string;
  }) => Promise<{
    recentSameContactRequestId: string | null;
    suppressAdminNotification: boolean;
  }>;
  sendRoleRoomEducationInquiryAdminEmail: (options: {
    requestId: string;
    companyName: string;
    organizationNumber: string;
    contactName: string;
    contactEmail: string;
    metadata: RoleRoomEducationInquiryMetadata;
  }) => Promise<RoleRoomEducationInquiryAdminEmailResult>;
}

export function createRoleRoomEducationInquiryService(
  deps: RoleRoomEducationInquiryServiceDeps,
): RoleRoomEducationInquiryService {
  const {
    pool,
    hasTable,
    getTableColumns,
    normalizeMailConfigValue,
    splitRoleRoomContactName,
    findAdminInviteRequest,
    upsertAdminInviteRequest,
    getRoleRoomEducationInquiryMailer,
    renderRoleRoomPlatformEmail,
    resolveRoleRoomEducationInquiryGmailSender,
    buildGmailRawMessage,
  } = deps;

  const roleRoomEducationInquiryAttemptsByIp = new Map<
    string,
    {
      count: number;
      windowStartedAt: number;
      lastSeenAt: number;
    }
  >();

  function isRoleRoomEducationInstitutionType(
    value: unknown,
  ): value is RoleRoomEducationInstitutionType {
    return (
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(
        ROLE_ROOM_EDUCATION_INSTITUTION_TYPE_LABELS,
        value,
      )
    );
  }

  function isRoleRoomEducationSeatRange(
    value: unknown,
  ): value is RoleRoomEducationSeatRange {
    return (
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(
        ROLE_ROOM_EDUCATION_STUDENT_RANGE_LABELS,
        value,
      )
    );
  }

  function isRoleRoomEducationStartWindow(
    value: unknown,
  ): value is RoleRoomEducationStartWindow {
    return (
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(
        ROLE_ROOM_EDUCATION_START_WINDOW_LABELS,
        value,
      )
    );
  }

  function getRoleRoomRequestIpAddress(req: express.Request) {
    const forwarded = req.headers["x-forwarded-for"];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.split(",")[0]?.trim() || "unknown";
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  function getRoleRoomEducationEmailDomain(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const atIndex = normalizedEmail.lastIndexOf("@");
    return atIndex >= 0 ? normalizedEmail.slice(atIndex + 1) : "";
  }

  function isRoleRoomEducationDisposableEmail(email: string) {
    const domain = getRoleRoomEducationEmailDomain(email);
    return Boolean(
      domain && ROLE_ROOM_EDUCATION_DISPOSABLE_EMAIL_DOMAINS.has(domain),
    );
  }

  function registerRoleRoomEducationInquiryIpAttempt(ipAddress: string) {
    const normalizedIp = ipAddress.trim() || "unknown";
    const now = Date.now();

    for (const [key, entry] of roleRoomEducationInquiryAttemptsByIp.entries()) {
      if (now - entry.lastSeenAt > ROLE_ROOM_EDUCATION_INQUIRY_IP_WINDOW_MS * 2) {
        roleRoomEducationInquiryAttemptsByIp.delete(key);
      }
    }

    const existing = roleRoomEducationInquiryAttemptsByIp.get(normalizedIp);
    if (
      !existing ||
      now - existing.windowStartedAt > ROLE_ROOM_EDUCATION_INQUIRY_IP_WINDOW_MS
    ) {
      roleRoomEducationInquiryAttemptsByIp.set(normalizedIp, {
        count: 1,
        windowStartedAt: now,
        lastSeenAt: now,
      });
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    existing.count += 1;
    existing.lastSeenAt = now;
    roleRoomEducationInquiryAttemptsByIp.set(normalizedIp, existing);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (ROLE_ROOM_EDUCATION_INQUIRY_IP_WINDOW_MS -
          (now - existing.windowStartedAt)) /
          1000,
      ),
    );

    return {
      allowed: existing.count <= ROLE_ROOM_EDUCATION_INQUIRY_IP_MAX_ATTEMPTS,
      retryAfterSeconds,
    };
  }

  function appendRoleRoomEducationSpamSignalToMessage(
    existingMessage: unknown,
    signal: RoleRoomEducationInquirySpamSignal,
  ) {
    if (typeof existingMessage !== "string" || !existingMessage.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(existingMessage) as
        | (Record<string, unknown> & {
            kind?: unknown;
            spamSignals?: unknown;
          })
        | null;
      if (!parsed || parsed.kind !== "role_room_education_inquiry") {
        return null;
      }

      const currentSignals = Array.isArray(parsed.spamSignals)
        ? parsed.spamSignals.filter(
            (entry): entry is RoleRoomEducationInquirySpamSignal =>
              Boolean(entry) && typeof entry === "object",
          )
        : [];

      return JSON.stringify({
        ...parsed,
        spamSignals: [signal, ...currentSignals].slice(0, 5),
      });
    } catch {
      return null;
    }
  }

  async function recordRoleRoomEducationInquirySpamAttempt(input: {
    organizationNumber: string;
    companyName?: string | null;
    contactName: string;
    contactEmail: string;
    contactRole?: string | null;
    institutionType?: unknown;
    programName?: string | null;
    studentSeatRange?: unknown;
    staffSeatRange?: unknown;
    desiredStartWindow?: unknown;
    useCase?: string | null;
    ipAddress: string;
    reason: RoleRoomEducationInquirySpamReason;
    detail?: string | null;
  }) {
    if (!(await hasTable("invite_requests"))) {
      return null;
    }

    const normalizedEmail = normalizeMailConfigValue(input.contactEmail).toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return null;
    }

    const organizationNumber = String(input.organizationNumber || "").replace(/\D/g, "");
    const companyName =
      normalizeMailConfigValue(input.companyName) ||
      (organizationNumber ? `Foretak ${organizationNumber}` : "Ukjent institusjon");
    const spamSignal: RoleRoomEducationInquirySpamSignal = {
      reason: input.reason,
      reasonLabel: ROLE_ROOM_EDUCATION_SPAM_REASON_LABELS[input.reason],
      recordedAt: new Date().toISOString(),
      ipAddress: input.ipAddress || "unknown",
      detail: normalizeMailConfigValue(input.detail) || null,
    };
    const existingInvite = await findAdminInviteRequest(normalizedEmail, normalizedEmail);
    const existingStatus = normalizeMailConfigValue(existingInvite?.status);
    const existingJourneyStatus = normalizeMailConfigValue(
      existingInvite?.user_journey_status,
    );
    const mergedExistingMessage = appendRoleRoomEducationSpamSignalToMessage(
      existingInvite?.message,
      spamSignal,
    );
    const shouldPreserveExistingState = Boolean(
      existingInvite?.id &&
        normalizeMailConfigValue(existingInvite?.profession) ===
          "education_institution" &&
        normalizeMailConfigValue(existingInvite?.source || "role_room_education") ===
          "role_room_education" &&
        existingStatus &&
        existingStatus !== "spam_filtered" &&
        existingJourneyStatus !== "role_room_education_spam_filtered",
    );
    const { firstName, lastName } = splitRoleRoomContactName(input.contactName);
    const spamMetadata: RoleRoomEducationSpamAttemptMetadata = {
      kind: "role_room_education_spam_attempt",
      version: 1,
      companyName,
      organizationNumber,
      contactName: normalizeMailConfigValue(input.contactName),
      contactEmail: normalizedEmail,
      contactRole: normalizeMailConfigValue(input.contactRole),
      institutionType:
        typeof input.institutionType === "string" && input.institutionType.trim()
          ? input.institutionType.trim()
          : null,
      institutionTypeLabel: isRoleRoomEducationInstitutionType(input.institutionType)
        ? ROLE_ROOM_EDUCATION_INSTITUTION_TYPE_LABELS[input.institutionType]
        : null,
      programName: normalizeMailConfigValue(input.programName),
      studentSeatRange:
        typeof input.studentSeatRange === "string" && input.studentSeatRange.trim()
          ? input.studentSeatRange.trim()
          : null,
      studentSeatLabel: isRoleRoomEducationSeatRange(input.studentSeatRange)
        ? ROLE_ROOM_EDUCATION_STUDENT_RANGE_LABELS[input.studentSeatRange]
        : null,
      staffSeatRange:
        typeof input.staffSeatRange === "string" && input.staffSeatRange.trim()
          ? input.staffSeatRange.trim()
          : null,
      staffSeatLabel: isRoleRoomEducationSeatRange(input.staffSeatRange)
        ? ROLE_ROOM_EDUCATION_STAFF_RANGE_LABELS[input.staffSeatRange]
        : null,
      desiredStartWindow:
        typeof input.desiredStartWindow === "string" &&
        input.desiredStartWindow.trim()
          ? input.desiredStartWindow.trim()
          : null,
      desiredStartWindowLabel: isRoleRoomEducationStartWindow(
        input.desiredStartWindow,
      )
        ? ROLE_ROOM_EDUCATION_START_WINDOW_LABELS[input.desiredStartWindow]
        : null,
      useCase: normalizeMailConfigValue(input.useCase),
      taxMode: "ex_vat",
      spamReason: input.reason,
      spamReasonLabel: ROLE_ROOM_EDUCATION_SPAM_REASON_LABELS[input.reason],
      spamRecordedAt: spamSignal.recordedAt,
      ipAddress: spamSignal.ipAddress,
      detail: spamSignal.detail,
    };

    return upsertAdminInviteRequest({
      email: normalizedEmail,
      firstName,
      lastName,
      profession: "education_institution",
      businessName: companyName,
      organizationNumber,
      status: shouldPreserveExistingState ? existingStatus : "spam_filtered",
      userJourneyStatus: shouldPreserveExistingState
        ? existingJourneyStatus
        : "role_room_education_spam_filtered",
      source: "role_room_education",
      message: mergedExistingMessage || JSON.stringify(spamMetadata),
    });
  }

  async function readRoleRoomEducationInquirySpamState(input: {
    contactEmail: string;
    organizationNumber: string;
  }) {
    const inviteRequestColumns = await getTableColumns("invite_requests");
    const hasSourceColumn = inviteRequestColumns.has("source");
    const result = await pool.query<{
      id: string | null;
      email: string | null;
      organization_number: string | null;
      created_at: Date | string | null;
      updated_at: Date | string | null;
    }>(
      `SELECT id, email, organization_number, created_at, updated_at
       FROM invite_requests
       WHERE ${
         hasSourceColumn ? "source = 'role_room_education' AND " : ""
       }profession = 'education_institution'
         AND (
           LOWER(COALESCE(email, '')) = LOWER($1)
           OR COALESCE(organization_number, '') = $2
         )
       ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
       LIMIT 25`,
      [input.contactEmail, input.organizationNumber],
    );

    const now = Date.now();
    let recentSameContactRequestId: string | null = null;
    let suppressAdminNotification = false;

    for (const row of result.rows) {
      const rowEmail =
        typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
      const rowOrg =
        typeof row.organization_number === "string"
          ? row.organization_number.replace(/\D/g, "")
          : "";
      const updatedAtValue =
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : row.updated_at
            ? String(row.updated_at)
            : "";
      const createdAtValue =
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at
            ? String(row.created_at)
            : "";
      const timestamp = Date.parse(updatedAtValue || createdAtValue);
      if (!Number.isFinite(timestamp)) {
        continue;
      }

      const ageMs = Math.max(0, now - timestamp);
      const requestId = normalizeMailConfigValue(row.id) || null;

      if (
        !recentSameContactRequestId &&
        rowEmail === input.contactEmail &&
        rowOrg === input.organizationNumber &&
        ageMs <= ROLE_ROOM_EDUCATION_INQUIRY_CONTACT_COOLDOWN_MS
      ) {
        recentSameContactRequestId = requestId;
      }

      if (
        rowOrg === input.organizationNumber &&
        ageMs <= ROLE_ROOM_EDUCATION_INQUIRY_ORG_NOTIFICATION_COOLDOWN_MS
      ) {
        suppressAdminNotification = true;
      }
    }

    return {
      recentSameContactRequestId,
      suppressAdminNotification,
    };
  }

  async function sendRoleRoomEducationInquiryAdminEmail(options: {
    requestId: string;
    companyName: string;
    organizationNumber: string;
    contactName: string;
    contactEmail: string;
    metadata: RoleRoomEducationInquiryMetadata;
  }): Promise<RoleRoomEducationInquiryAdminEmailResult> {
    const transporter = getRoleRoomEducationInquiryMailer();
    if (!transporter) {
      return {
        sent: false,
        reason: "missing_email_config",
        accepted: [] as string[],
      };
    }

    const adminEmail =
      normalizeMailConfigValue(process.env.GOOGLE_ADMIN_EMAIL) ||
      "daniel@creatorhubn.com";
    const fromEmail =
      normalizeMailConfigValue(process.env.GMAIL_USER) ||
      normalizeMailConfigValue(process.env.GOOGLE_WORKSPACE_EMAIL) ||
      adminEmail;

    const { metadata } = options;
    const rendered = await renderRoleRoomPlatformEmail({
      templateId: "role_room_education_inquiry_admin",
      variables: {
        requestId: options.requestId,
        companyName: options.companyName,
        organizationNumber: options.organizationNumber,
        contactName: options.contactName,
        contactEmail: options.contactEmail,
        contactRole: metadata.contactRole,
        institutionTypeLabel: metadata.institutionTypeLabel,
        programName: metadata.programName,
        studentSeatLabel: metadata.studentSeatLabel,
        staffSeatLabel: metadata.staffSeatLabel,
        desiredStartWindowLabel: metadata.desiredStartWindowLabel,
        useCase: metadata.useCase,
      },
      replyToEmail: options.contactEmail,
      detailRows: [
        { label: "Forespørsel-ID", value: options.requestId },
        { label: "Institusjon", value: options.companyName },
        { label: "Organisasjonsnummer", value: options.organizationNumber },
        { label: "Kontaktperson", value: options.contactName },
        { label: "Stilling", value: metadata.contactRole },
        { label: "E-post", value: options.contactEmail },
        { label: "Institusjonstype", value: metadata.institutionTypeLabel },
        { label: "Studieprogram", value: metadata.programName },
        { label: "Studentomfang", value: metadata.studentSeatLabel },
        { label: "Faglærere / koordinatorer", value: metadata.staffSeatLabel },
        { label: "Ønsket oppstart", value: metadata.desiredStartWindowLabel },
      ],
      noticeSection: {
        label: "Bruksområde",
        body: metadata.useCase,
        tone: "neutral",
      },
    });

    const gmailSender = await resolveRoleRoomEducationInquiryGmailSender().catch(
      (error) => {
        console.error(
          "Role Room education inquiry Gmail API sender lookup failed:",
          error,
        );
        return null;
      },
    );

    if (gmailSender) {
      const gmail = google.gmail({
        version: "v1",
        auth: gmailSender.authorized.oauthClient,
      });

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: await buildGmailRawMessage({
            to: gmailSender.adminEmail,
            from: `CreatorHub Norge <${gmailSender.senderEmail}>`,
            replyTo: options.contactEmail,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
          }),
        },
      });

      return {
        sent: true,
        reason: null,
        accepted: [gmailSender.adminEmail],
        provider: "gmail_api",
        messageId: normalizeMailConfigValue(response.data.id),
      };
    }

    const info = await transporter.sendMail({
      from: `CreatorHub Norge <${fromEmail}>`,
      to: adminEmail,
      replyTo: options.contactEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    return {
      sent: true,
      reason: null,
      accepted: Array.isArray(info.accepted)
        ? (info.accepted as unknown[]).map((value) => String(value))
        : [],
      provider: "smtp",
      messageId: normalizeMailConfigValue(info.messageId),
    };
  }

  return {
    isRoleRoomEducationInstitutionType,
    isRoleRoomEducationSeatRange,
    isRoleRoomEducationStartWindow,
    isRoleRoomEducationDisposableEmail,
    getRoleRoomRequestIpAddress,
    registerRoleRoomEducationInquiryIpAttempt,
    recordRoleRoomEducationInquirySpamAttempt,
    readRoleRoomEducationInquirySpamState,
    sendRoleRoomEducationInquiryAdminEmail,
  };
}
