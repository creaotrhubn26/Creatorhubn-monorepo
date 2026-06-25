/**
 * role-room-education-inquiries-routes.ts
 *
 * Setup-funksjon for /api/role-room/education-inquiries — offentlig
 * skjema for utdanningsinstitusjoner som ber om Role Room-pilot.
 *
 * 1 endpoint: POST /api/role-room/education-inquiries
 *
 * Mode-relevans: Dette er entry-point for Utdanningsinstitusjon-mode.
 *
 * Tilgang: åpen (ingen auth). Spam/abuse-beskyttelse via:
 *   - honeypot-felt (`website` / `websiteUrl`)
 *   - submitted-too-fast-deteksjon (`startedAt` < 2.5s siden form-mount)
 *   - per-IP-rate-limit (6 forsøk per 60 min vindu)
 *   - disposable-email-blokkering
 *   - Cloudflare Turnstile (når env-konfigurert)
 *   - BRREG-validering av organisasjonsnummer
 *
 * Resultat: invite_request opprettes/oppdateres med profession=
 * "education_institution" og source="role_room_education", proff-
 * screening kjøres mot BRREG, og admin-notifikasjon sendes via Gmail
 * API → SMTP-fallback.
 *
 * Service-laget bor i:
 *   - role-room-turnstile-service.ts (Turnstile verify-API)
 *   - role-room-education-inquiry-service.ts (validering + spam +
 *     IP-rate-limit + admin-mail)
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomEducationInquiriesRoutes } from
 *     "./role-room-education-inquiries-routes";
 *
 *   setupRoleRoomEducationInquiriesRoutes({
 *     app,
 *     pool,
 *     hasTable,
 *     getTableColumns,
 *     normalizeMailConfigValue,
 *     splitRoleRoomContactName,
 *     findAdminInviteRequest,
 *     upsertAdminInviteRequest,
 *     getRoleRoomEducationInquiryMailer,
 *     renderRoleRoomPlatformEmail,
 *     resolveRoleRoomEducationInquiryGmailSender,
 *     buildGmailRawMessage,
 *     getDefaultRoleRoomPublicOrigin,
 *     lookupInviteRequestBrregCompany,
 *     buildInviteRequestProffAnalysis,
 *     upsertInviteRequestProffScreening,
 *     isValidNorwegianOrgNumber,
 *   });
 */

import type express from "express";
import type { Pool } from "pg";

import {
  createRoleRoomEducationInquiryService,
  ROLE_ROOM_EDUCATION_INSTITUTION_TYPE_LABELS,
  ROLE_ROOM_EDUCATION_STAFF_RANGE_LABELS,
  ROLE_ROOM_EDUCATION_START_WINDOW_LABELS,
  ROLE_ROOM_EDUCATION_STUDENT_RANGE_LABELS,
  type AdminInviteRequestUpsertInput,
  type RenderedRoleRoomPlatformEmail,
  type RoleRoomEducationInquiryGmailSender,
  type RoleRoomEducationInquiryMetadata,
} from "./role-room-education-inquiry-service";
import { createRoleRoomTurnstileService } from "./role-room-turnstile-service";
import { notifyAdmins } from "./admin-notify";

const ROLE_ROOM_EDUCATION_INQUIRY_MIN_FILL_MS = 2500;
const ROLE_ROOM_TURNSTILE_EDUCATION_ACTION = "role_room_education_inquiry";

export interface RoleRoomEducationInquiriesRoutesDeps {
  app: express.Application;
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
  getRoleRoomEducationInquiryMailer: () => import("nodemailer").Transporter | null;
  // templateId-typen er en streng-union i index.ts; her relaxed til any
  // slik at dep-bindingen ikke krever importerbar union-type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderRoleRoomPlatformEmail: (input: any) => Promise<RenderedRoleRoomPlatformEmail>;
  resolveRoleRoomEducationInquiryGmailSender: () => Promise<RoleRoomEducationInquiryGmailSender | null>;
  buildGmailRawMessage: (options: {
    to: string;
    from: string;
    replyTo?: string | null;
    subject: string;
    text?: string | null;
    html: string;
  }) => Promise<string>;
  getDefaultRoleRoomPublicOrigin: () => string;
  // Typene under er løst typed slik at vi kan binde mot index.ts-
  // versjonene uten å duplisere deres komplekse strukturer her.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lookupInviteRequestBrregCompany: (organizationNumber: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildInviteRequestProffAnalysis: (input: any) => any;
  upsertInviteRequestProffScreening: (
    inviteRequestId: string,
    organizationNumber: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analysis: any,
  ) => Promise<void>;
  isValidNorwegianOrgNumber: (value: string) => boolean;
}

export function setupRoleRoomEducationInquiriesRoutes(
  deps: RoleRoomEducationInquiriesRoutesDeps,
): void {
  const {
    app,
    normalizeMailConfigValue,
    findAdminInviteRequest,
    upsertAdminInviteRequest,
    getDefaultRoleRoomPublicOrigin,
    lookupInviteRequestBrregCompany,
    buildInviteRequestProffAnalysis,
    upsertInviteRequestProffScreening,
    isValidNorwegianOrgNumber,
  } = deps;

  const turnstileService = createRoleRoomTurnstileService({
    normalizeMailConfigValue,
    getDefaultRoleRoomPublicOrigin,
  });

  const educationService = createRoleRoomEducationInquiryService({
    pool: deps.pool,
    hasTable: deps.hasTable,
    getTableColumns: deps.getTableColumns,
    normalizeMailConfigValue,
    splitRoleRoomContactName: deps.splitRoleRoomContactName,
    findAdminInviteRequest,
    upsertAdminInviteRequest,
    getRoleRoomEducationInquiryMailer: deps.getRoleRoomEducationInquiryMailer,
    renderRoleRoomPlatformEmail: deps.renderRoleRoomPlatformEmail,
    resolveRoleRoomEducationInquiryGmailSender:
      deps.resolveRoleRoomEducationInquiryGmailSender,
    buildGmailRawMessage: deps.buildGmailRawMessage,
  });

  app.post("/api/role-room/education-inquiries", async (req, res) => {
    try {
      const organizationNumber = String(req.body?.organizationNumber || "").replace(
        /\D/g,
        "",
      );
      const honeypotField = String(
        req.body?.website || req.body?.websiteUrl || "",
      ).trim();
      const startedAtRaw =
        typeof req.body?.startedAt === "string" || typeof req.body?.startedAt === "number"
          ? String(req.body?.startedAt)
          : "";
      const startedAtMs = startedAtRaw ? Date.parse(startedAtRaw) : Number.NaN;
      const ipAddress = educationService.getRoleRoomRequestIpAddress(req);
      const turnstileToken = normalizeMailConfigValue(
        req.body?.turnstileToken ||
          req.body?.cfTurnstileResponse ||
          req.body?.["cf-turnstile-response"],
      );
      const contactName = String(req.body?.contactName || "").trim();
      const contactEmail = String(req.body?.contactEmail || "")
        .trim()
        .toLowerCase();
      const contactRole = String(req.body?.contactRole || "").trim();
      const programName = String(req.body?.programName || "").trim();
      const useCase = String(req.body?.useCase || "").trim();
      const companyNameHint = String(req.body?.companyName || "").trim();
      const institutionType = req.body?.institutionType;
      const studentSeatRange = req.body?.studentSeatRange;
      const staffSeatRange = req.body?.staffSeatRange;
      const desiredStartWindow = req.body?.desiredStartWindow;

      if (honeypotField) {
        console.warn("Role Room education inquiry honeypot triggered", {
          ipAddress,
          contactEmail,
          organizationNumber,
        });
        await educationService
          .recordRoleRoomEducationInquirySpamAttempt({
            organizationNumber,
            companyName: companyNameHint,
            contactName,
            contactEmail,
            contactRole,
            institutionType,
            programName,
            studentSeatRange,
            staffSeatRange,
            desiredStartWindow,
            useCase,
            ipAddress,
            reason: "bot_filtered",
          })
          .catch(() => null);
        return res.status(202).json({
          success: true,
          requestId: null,
          companyName: null,
          organizationNumber,
          status: "accepted",
          notificationEmailSent: false,
          notificationAcceptedRecipients: [],
          notificationReason: "bot_filtered",
          message:
            "Forespørselen er mottatt. Vi tar kontakt for å sette opp en institusjonssamtale.",
        });
      }

      if (
        Number.isFinite(startedAtMs) &&
        Date.now() - startedAtMs < ROLE_ROOM_EDUCATION_INQUIRY_MIN_FILL_MS
      ) {
        await educationService
          .recordRoleRoomEducationInquirySpamAttempt({
            organizationNumber,
            companyName: companyNameHint,
            contactName,
            contactEmail,
            contactRole,
            institutionType,
            programName,
            studentSeatRange,
            staffSeatRange,
            desiredStartWindow,
            useCase,
            ipAddress,
            reason: "submitted_too_fast",
          })
          .catch(() => null);
        return res.status(429).json({
          error:
            "Forespørselen ble sendt litt for raskt. Gå gjennom feltene og prøv igjen om noen sekunder.",
        });
      }

      const ipAttempt =
        educationService.registerRoleRoomEducationInquiryIpAttempt(ipAddress);
      if (!ipAttempt.allowed) {
        await educationService
          .recordRoleRoomEducationInquirySpamAttempt({
            organizationNumber,
            companyName: companyNameHint,
            contactName,
            contactEmail,
            contactRole,
            institutionType,
            programName,
            studentSeatRange,
            staffSeatRange,
            desiredStartWindow,
            useCase,
            ipAddress,
            reason: "rate_limited",
            detail: `retry_after=${ipAttempt.retryAfterSeconds}`,
          })
          .catch(() => null);
        res.setHeader("Retry-After", String(ipAttempt.retryAfterSeconds));
        return res.status(429).json({
          error:
            "Vi har mottatt mange forespørsler fra denne forbindelsen på kort tid. Vent litt og prøv igjen.",
        });
      }

      if (!isValidNorwegianOrgNumber(organizationNumber)) {
        return res.status(400).json({
          error: "Organisasjonsnummer må være et gyldig norsk organisasjonsnummer.",
        });
      }

      if (!contactName || !contactRole || !programName || !useCase) {
        return res.status(400).json({
          error:
            "Kontaktperson, stilling, studieprogram og bruksområde må fylles ut.",
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return res.status(400).json({
          error: "Kontaktpersonen må ha en gyldig e-postadresse.",
        });
      }

      if (educationService.isRoleRoomEducationDisposableEmail(contactEmail)) {
        await educationService
          .recordRoleRoomEducationInquirySpamAttempt({
            organizationNumber,
            companyName: companyNameHint,
            contactName,
            contactEmail,
            contactRole,
            institutionType,
            programName,
            studentSeatRange,
            staffSeatRange,
            desiredStartWindow,
            useCase,
            ipAddress,
            reason: "disposable_email_blocked",
          })
          .catch(() => null);
        return res.status(400).json({
          error:
            "Bruk en jobb- eller institusjonse-post for institusjonsforespørsler.",
        });
      }

      if (
        contactName.length > 120 ||
        contactRole.length > 120 ||
        programName.length > 160 ||
        useCase.length > 2000
      ) {
        return res.status(400).json({
          error:
            "Noen felt er for lange. Kort ned kontaktinfo eller beskrivelse og prøv igjen.",
        });
      }

      if (!educationService.isRoleRoomEducationInstitutionType(institutionType)) {
        return res.status(400).json({
          error: "Velg institusjonstype.",
        });
      }

      if (!educationService.isRoleRoomEducationSeatRange(studentSeatRange)) {
        return res.status(400).json({
          error: "Velg studentomfang.",
        });
      }

      if (!educationService.isRoleRoomEducationSeatRange(staffSeatRange)) {
        return res.status(400).json({
          error: "Velg antall faglærere / koordinatorer.",
        });
      }

      if (!educationService.isRoleRoomEducationStartWindow(desiredStartWindow)) {
        return res.status(400).json({
          error: "Velg ønsket oppstart.",
        });
      }

      if (turnstileService.getRoleRoomTurnstileSecretKey()) {
        if (!turnstileToken) {
          return res.status(400).json({
            error:
              "Bekreft at du er et menneske før du sender institusjonsforespørselen.",
          });
        }

        const turnstileVerification = await turnstileService.verifyRoleRoomTurnstileToken({
          token: turnstileToken,
          ipAddress,
          expectedAction: ROLE_ROOM_TURNSTILE_EDUCATION_ACTION,
          expectedHostnames:
            turnstileService.getRoleRoomTurnstileExpectedHostnames(req),
        });

        if (!turnstileVerification.success) {
          console.warn("Role Room education inquiry turnstile rejected", {
            ipAddress,
            contactEmail,
            organizationNumber,
            reason: turnstileVerification.reason,
            errorCodes: turnstileVerification.errorCodes,
            hostname: turnstileVerification.hostname,
            action: turnstileVerification.action,
          });
          await educationService
            .recordRoleRoomEducationInquirySpamAttempt({
              organizationNumber,
              companyName: companyNameHint,
              contactName,
              contactEmail,
              contactRole,
              institutionType,
              programName,
              studentSeatRange,
              staffSeatRange,
              desiredStartWindow,
              useCase,
              ipAddress,
              reason: "turnstile_failed",
              detail: [
                turnstileVerification.reason,
                ...(turnstileVerification.errorCodes || []),
              ]
                .filter(Boolean)
                .join(", "),
            })
            .catch(() => null);

          return res.status(403).json({
            error:
              turnstileVerification.errorCodes.includes("timeout-or-duplicate")
                ? "Bekreftelsen utløp eller er allerede brukt. Bekreft på nytt og prøv igjen."
                : "Vi kunne ikke verifisere forespørselen. Prøv igjen.",
          });
        }
      }

      const brregLookup = await lookupInviteRequestBrregCompany(organizationNumber);
      if (brregLookup.lookupStatus === "not_found") {
        return res.status(400).json({
          error:
            "Organisasjonsnummeret ble ikke funnet i Brønnøysundregistrene.",
        });
      }

      const companyName =
        brregLookup.company?.name?.trim() ||
        String(req.body?.companyName || "").trim() ||
        `Foretak ${organizationNumber}`;
      const spamState = await educationService.readRoleRoomEducationInquirySpamState({
        contactEmail,
        organizationNumber,
      });
      const metadata: RoleRoomEducationInquiryMetadata = {
        kind: "role_room_education_inquiry",
        version: 1,
        companyName,
        organizationNumber,
        contactName,
        contactEmail,
        contactRole,
        institutionType,
        institutionTypeLabel:
          ROLE_ROOM_EDUCATION_INSTITUTION_TYPE_LABELS[institutionType],
        programName,
        studentSeatRange,
        studentSeatLabel:
          ROLE_ROOM_EDUCATION_STUDENT_RANGE_LABELS[studentSeatRange],
        staffSeatRange,
        staffSeatLabel: ROLE_ROOM_EDUCATION_STAFF_RANGE_LABELS[staffSeatRange],
        desiredStartWindow,
        desiredStartWindowLabel:
          ROLE_ROOM_EDUCATION_START_WINDOW_LABELS[desiredStartWindow],
        useCase,
        taxMode: "ex_vat",
      };
      const serializedMetadata = JSON.stringify(metadata);
      const existingInvite = await findAdminInviteRequest(contactEmail, contactEmail);
      const { firstName, lastName } = deps.splitRoleRoomContactName(contactName);
      const inviteRequest = await upsertAdminInviteRequest({
        email: contactEmail,
        firstName,
        lastName,
        profession: "education_institution",
        businessName: companyName,
        organizationNumber,
        status: normalizeMailConfigValue(existingInvite?.status) || "pending",
        userJourneyStatus:
          normalizeMailConfigValue(existingInvite?.user_journey_status) ||
          "role_room_education_pending_review",
        source: "role_room_education",
        message: serializedMetadata,
      });

      const inviteRequestId = normalizeMailConfigValue(inviteRequest?.id) || null;
      const proffAnalysis = buildInviteRequestProffAnalysis({
        organizationNumber,
        companyName,
        brregLookup,
      });

      if (inviteRequestId) {
        await upsertInviteRequestProffScreening(
          inviteRequestId,
          organizationNumber,
          proffAnalysis,
        );
      }

      const notification: {
        sent: boolean;
        reason: string | null;
        accepted: string[];
        provider?: string;
        messageId?: string;
      } = {
        sent: !spamState.suppressAdminNotification,
        reason: spamState.suppressAdminNotification
          ? "duplicate_suppressed"
          : "admin_notify_dispatched",
        accepted: [] as string[],
      };

      if (!spamState.suppressAdminNotification) {
        void notifyAdmins(deps.pool, {
          type: "education_inquiry",
          source: "theroleroom.com · institusjons-/utdanningsforespørsel",
          title: `Ny institusjonsforespørsel: ${companyName}`,
          summary: `${contactName} (${contactRole}) <${contactEmail}> · ${metadata.institutionTypeLabel} · ${programName} · studenter ${metadata.studentSeatLabel}`,
          link: "/admin",
          cta: (req.body && req.body.cta) || null,
          page: req.get("referer") || (req.body && req.body.page) || null,
          utm: (req.body && req.body.utm) || null,
          relatedId: inviteRequestId,
        });
      }

      return res.status(201).json({
        success: true,
        requestId: inviteRequestId || spamState.recentSameContactRequestId,
        companyName,
        organizationNumber,
        status: "pending",
        notificationEmailSent: notification.sent,
        notificationAcceptedRecipients: notification.accepted,
        notificationReason: notification.reason,
        notificationProvider: notification.provider ?? null,
        notificationMessageId: notification.messageId ?? null,
        message:
          spamState.recentSameContactRequestId
            ? "Vi har allerede mottatt en fersk institusjonsforespørsel fra dere. Teamet vårt følger opp den eksisterende henvendelsen."
            : "Forespørselen er mottatt. Vi tar kontakt for å sette opp en institusjonssamtale.",
      });
    } catch (error) {
      console.error("Error creating Role Room education inquiry:", error);
      return res.status(500).json({
        error: "Kunne ikke sende institusjonsforespørselen.",
      });
    }
  });
}
