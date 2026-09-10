/**
 * prototype-tester-invites-routes.ts — Slice 9X.53
 *
 * Egen NDA + program-vilkår-flyt for prototype-testere (adskilt fra
 * role_room_tester_invites — det er kun for Role Room).
 *
 * Endpoints:
 *   POST   /api/prototype-tester-invites              — admin/auto-bro lager invitasjon
 *   GET    /api/prototype-tester-invites/:token       — public: hent for accept-page
 *   POST   /api/prototype-tester-invites/:token/accept — public: signer NDA + godta program-vilkår
 *   GET    /api/prototype-tester-invites/me/status    — innlogget bruker: er jeg aktiv tester?
 *
 * Auto-bro: når en invite_request med selected_plan='prototype_tester'
 * godkjennes via PUT /api/invites/admin/requests/:id/status, kalles
 * createInviteFromApprovedRequest() automatisk.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import crypto from "crypto";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactional-email-service.ts";
import { normalizeProfession } from "../../frontend/shared/profession-types.ts";
import { safeAppBaseUrl } from "./web-origin-allowlist.ts";
import {
  buildPrototypeTesterAgreementBundle,
  canonicalJsonStringify,
  DPA_VERSION,
  LETTER_OF_INTENT_VERSION,
  NDA_VERSION,
  PROGRAM_TERMS_VERSION,
  type PrototypeTesterAgreementDocument,
  type PrototypeTesterAgreementKey,
} from "../../frontend/shared/prototype-tester-agreements.ts";
import {
  buildPrototypeTesterSigningReceiptPdf,
  isPrototypeTesterReceiptSnapshotValid,
} from "./prototype-tester-signing-receipt.ts";

export type PrototypeTesterEmailDelivery = {
  sent: boolean;
  provider: string | null;
  reason: string | null;
  messageId: string | null;
};

export type PrototypeTesterApprovalEmailSender = (input: {
  recipientEmail: string;
  recipientName: string;
  inviteUrl: string;
  ctaUrl: string;
  trackingPixelUrl: string;
  inviteRequestId: string;
  sentByUserId: string | null;
  profession: string | null;
  company: string | null;
  programDurationWeeks: number;
  inviteExpiresDays: number;
}) => Promise<PrototypeTesterEmailDelivery>;

export type PrototypeTesterDirectInviteEmailSender = (input: {
  recipientEmail: string;
  recipientName: string;
  inviteUrl: string;
  ctaUrl: string;
  trackingPixelUrl: string;
  inviteId: string;
  sentByUserId: string | null;
  profession: string | null;
  company: string | null;
  testingAreas: string[];
  personalMessage: string | null;
  programDurationWeeks: number;
  inviteExpiresDays: number;
}) => Promise<PrototypeTesterEmailDelivery>;

export type PrototypeTesterInviteEmailPreviewer = (input: {
  recipientEmail: string;
  recipientName: string;
  inviteUrl: string;
  profession: string | null;
  company: string | null;
  testingAreas: string[];
  personalMessage: string | null;
  programDurationWeeks: number;
  inviteExpiresDays: number;
}) => Promise<{
  subject: string;
  html: string;
  text: string;
  fromLabel: string;
  fromAddress: string;
  replyToEmail: string;
}>;

export type PrototypeTesterAccessActivatedEmailSender = (input: {
  recipientEmail: string;
  recipientName: string;
  loginUrl: string;
  inviteRequestId: string | null;
  inviteId: string;
  profession: string | null;
  company: string | null;
  programEndsAt: Date | string;
}) => Promise<PrototypeTesterEmailDelivery>;

export type PrototypeTesterSigningCodeIssuer = (input: {
  recipientEmail: string;
  recipientName: string;
  inviteId: string;
  ipAddress: string | null;
}) => Promise<{
  ok: boolean;
  expiresAt: string;
  reason?: "email_not_configured" | "send_failed" | "invalid_email" | "rate_limited";
  retryAfterSeconds?: number;
}>;

export type PrototypeTesterSigningCodeVerifier = (input: {
  recipientEmail: string;
  code: string;
}) => Promise<{
  ok: boolean;
  reason?: "not_found" | "expired" | "used" | "wrong_code" | "max_attempts";
  attemptsRemaining?: number;
  verifiedAt?: string;
}>;

export type PrototypeTesterReceiptEmailSender = (input: {
  recipientEmail: string;
  recipientName: string;
  agreementsUrl: string;
  receiptId: string;
  agreementDigest: string;
  acceptedAt: Date | string;
  programEndsAt: Date | string;
  inviteId: string;
  company: string | null;
}) => Promise<PrototypeTesterEmailDelivery>;

export interface PrototypeTesterInvitesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any | Promise<any>;
  // Oppretter/gjenbruker en brukerkonto for en tester (master/medlem) ved aksept.
  // profession (valgfri) settes på users.profession → riktig dashboard.
  provisionTesterAccount?: (
    email: string,
    name: string,
    profession?: string | null,
    company?: string | null,
    organizationNumber?: string | null,
  ) => Promise<any>;
  sendInviteEmail?: PrototypeTesterDirectInviteEmailSender;
  previewInviteEmail?: PrototypeTesterInviteEmailPreviewer;
  sendAccessActivatedEmail?: PrototypeTesterAccessActivatedEmailSender;
  issueSigningCode?: PrototypeTesterSigningCodeIssuer;
  verifySigningCode?: PrototypeTesterSigningCodeVerifier;
  sendReceiptEmail?: PrototypeTesterReceiptEmailSender;
  lookupBrregCompany?: (
    organizationNumber: string,
  ) => Promise<PrototypeTesterBrregLookupResult>;
  searchBrregCompanies?: (
    searchTerm: string,
  ) => Promise<PrototypeTesterBrregCompany[]>;
  lookupBrregContact?: (
    organizationNumber: string,
  ) => Promise<{ name: string; role: string } | null>;
}

export type PrototypeTesterBrregCompany = {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  organizationFormCode?: string | null;
  primaryIndustryCode?: string | null;
  primaryIndustryDescription?: string | null;
  businessAddress: string | {
    adresse?: string | null;
    postnummer?: string | null;
    poststed?: string | null;
  } | null;
  operationalStatus: "active" | "inactive" | "bankruptcy" | "liquidation";
};

type PrototypeTesterProfession =
  | "photographer"
  | "videographer"
  | "music_producer";

type ProfessionRecommendation = {
  profession: PrototypeTesterProfession;
  confidence: "high" | "medium";
  reason: string;
};

function recommendPrototypeTesterProfessionDetailed(
  company: PrototypeTesterBrregCompany,
): ProfessionRecommendation | null {
  const industryCode = String(company.primaryIndustryCode || "").replace(
    /[^\d]/g,
    "",
  );
  const industry = String(company.primaryIndustryDescription || "")
    .trim()
    .toLocaleLowerCase("nb-NO");

  if (
    industryCode.startsWith("592") ||
    industry.includes("produksjon og utgivelse av musikk") ||
    industry.includes("lydopptak")
  ) {
    return {
      profession: "music_producer",
      confidence: industryCode.startsWith("592") ? "high" : "medium",
      reason: industryCode.startsWith("592")
        ? `Næringskode ${company.primaryIndustryCode} gjelder produksjon eller utgivelse av musikk- og lydopptak.`
        : "Næringsbeskrivelsen omtaler musikk- eller lydproduksjon.",
    };
  }
  if (industryCode.startsWith("742") || industry.includes("fotografering")) {
    return {
      profession: "photographer",
      confidence: industryCode.startsWith("742") ? "high" : "medium",
      reason: industryCode.startsWith("742")
        ? `Næringskode ${company.primaryIndustryCode} gjelder fotografvirksomhet.`
        : "Næringsbeskrivelsen omtaler fotografering.",
    };
  }
  if (
    industryCode.startsWith("5911") ||
    industryCode.startsWith("5912") ||
    industry.includes("film-, video-") ||
    industry.includes("film og video")
  ) {
    return {
      profession: "videographer",
      confidence:
        industryCode.startsWith("5911") || industryCode.startsWith("5912")
          ? "high"
          : "medium",
      reason:
        industryCode.startsWith("5911") || industryCode.startsWith("5912")
          ? `Næringskode ${company.primaryIndustryCode} gjelder film- eller videoproduksjon.`
          : "Næringsbeskrivelsen omtaler film- eller videoproduksjon.",
    };
  }
  return null;
}

function recommendedTestingAreas(profession: string | null): string[] {
  switch (profession) {
    case "music_producer":
      return [
        "CreatorHub-dashboard",
        "Prosjekt og arbeidsflyt",
        "Showcase og klient-godkjenning",
        "Kontrakt og fakturering",
        "Integrasjoner",
      ];
    case "videographer":
      return [
        "CreatorHub-dashboard",
        "Story Arc Studio",
        "Prosjekt og arbeidsflyt",
        "Showcase og klient-godkjenning",
        "Mobil",
      ];
    case "photographer":
      return [
        "CreatorHub-dashboard",
        "Prosjekt og arbeidsflyt",
        "Showcase og klient-godkjenning",
        "Kontrakt og fakturering",
        "Mobil",
        "iPad",
      ];
    default:
      return [
        "CreatorHub-dashboard",
        "Prosjekt og arbeidsflyt",
        "Kontrakt og fakturering",
        "Integrasjoner",
      ];
  }
}

export type PrototypeTesterBrregLookupResult = {
  lookupStatus: "verified" | "not_found" | "fallback";
  company: PrototypeTesterBrregCompany | null;
};

const PROGRAM_DURATION_WEEKS = 12;
const INVITE_EXPIRES_DAYS = 14;
const SIGNING_CODE_LENGTH = 6;
const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 200;
const MAX_COMPANY_LENGTH = 200;
const MAX_BUSINESS_ADDRESS_LENGTH = 500;
const MAX_TESTING_AREAS = 16;
const MAX_TESTING_AREA_LENGTH = 80;
const MAX_PERSONAL_MESSAGE_LENGTH = 2000;
const DISALLOWED_SINGLE_LINE_CHARS = /[\u0000-\u001F\u007F]/;
const DISALLOWED_TEXT_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function normalizeNorwegianOrganizationNumber(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function isValidNorwegianOrganizationNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * digits[index],
    0,
  );
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return digits[8] === 0;
  if (remainder === 10) return false;
  return digits[8] === remainder;
}

function formatBrregBusinessAddress(value: PrototypeTesterBrregCompany["businessAddress"]): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized.slice(0, MAX_BUSINESS_ADDRESS_LENGTH) : null;
  }
  const address = String(value.adresse || "").trim();
  const postal = [value.postnummer, value.poststed]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  const normalized = [address, postal].filter(Boolean).join(", ");
  return normalized ? normalized.slice(0, MAX_BUSINESS_ADDRESS_LENGTH) : null;
}

function mapOpenBrregCompany(unit: any): PrototypeTesterBrregCompany | null {
  const organizationNumber = normalizeNorwegianOrganizationNumber(
    unit?.organisasjonsnummer,
  );
  const name = typeof unit?.navn === "string" ? unit.navn.trim() : "";
  if (!isValidNorwegianOrganizationNumber(organizationNumber) || !name) {
    return null;
  }
  const rawAddress = unit.forretningsadresse || unit.beliggenhetsadresse || null;
  const addressLine = Array.isArray(rawAddress?.adresse)
    ? rawAddress.adresse.filter(Boolean).join(", ")
    : String(rawAddress?.adresse || rawAddress?.adresselinje1 || "").trim();
  const operationalStatus = unit.slettedato
    ? "inactive"
    : unit.konkurs
      ? "bankruptcy"
      : unit.underAvvikling || unit.underTvangsavviklingEllerTvangsopplosning
        ? "liquidation"
        : "active";
  return {
    organizationNumber,
    name,
    organizationForm:
      unit.organisasjonsform?.beskrivelse || unit.enhetstype?.beskrivelse || null,
    organizationFormCode:
      typeof unit.organisasjonsform?.kode === "string"
        ? unit.organisasjonsform.kode.trim().toUpperCase()
        : null,
    primaryIndustryCode:
      typeof unit.naeringskode1?.kode === "string"
        ? unit.naeringskode1.kode.trim()
        : null,
    primaryIndustryDescription:
      typeof unit.naeringskode1?.beskrivelse === "string"
        ? unit.naeringskode1.beskrivelse.trim()
        : null,
    businessAddress: formatBrregBusinessAddress({
      adresse: addressLine,
      postnummer: rawAddress?.postnummer,
      poststed: rawAddress?.poststed,
    }),
    operationalStatus,
  };
}

async function lookupOpenBrregContact(
  organizationNumber: string,
): Promise<{ name: string; role: string } | null> {
  const result = await fetchBrregJson(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}/roller`,
  );
  if (result.status === 404 || result.status === 410) return null;
  if (result.status !== 200) {
    throw new Error(`BRREG role lookup failed (${result.status})`);
  }
  const groups = Array.isArray(result.payload?.rollegrupper)
    ? result.payload.rollegrupper
    : [];
  const roles = groups.flatMap((group: any) =>
    Array.isArray(group?.roller) ? group.roller : [],
  );
  const holder = roles.find(
    (role: any) =>
      role?.type?.kode === "INNH" &&
      role?.person?.erDoed !== true &&
      role?.person?.navn,
  );
  if (!holder) return null;
  const personName = holder.person.navn;
  const name = [personName.fornavn, personName.mellomnavn, personName.etternavn]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_NAME_LENGTH);
  return name ? { name, role: "Innehaver" } : null;
}

async function fetchBrregJson(url: string): Promise<{ status: number; payload: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_500);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CreatorHub/1.0 (+https://creatorhubn.com)",
      },
      signal: controller.signal,
    });
    const payload = response.ok ? await response.json() : null;
    return { status: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function searchOpenBrregCompanies(
  searchTerm: string,
): Promise<PrototypeTesterBrregCompany[]> {
  const term = searchTerm.trim();
  const digits = normalizeNorwegianOrganizationNumber(term);
  const isNumeric = /^[\d\s.]+$/.test(term);
  let units: any[] = [];

  if (isNumeric) {
    if (digits.length !== 9 || !isValidNorwegianOrganizationNumber(digits)) {
      return [];
    }
    const result = await fetchBrregJson(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${digits}`,
    );
    if (result.status === 404 || result.status === 410) return [];
    if (result.status !== 200) {
      throw new Error(`BRREG company lookup failed (${result.status})`);
    }
    units = [result.payload];
  } else {
    const params = new URLSearchParams({
      navn: term,
      navnMetodeForSoek: "FORTLOEPENDE",
      size: "10",
    });
    const result = await fetchBrregJson(
      `https://data.brreg.no/enhetsregisteret/api/enheter?${params.toString()}`,
    );
    if (result.status !== 200) {
      throw new Error(`BRREG company search failed (${result.status})`);
    }
    units = Array.isArray(result.payload?._embedded?.enheter)
      ? result.payload._embedded.enheter
      : [];
  }

  return units
    .map(mapOpenBrregCompany)
    .filter((company): company is PrototypeTesterBrregCompany => Boolean(company));
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prototype_tester_invites (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token                       TEXT NOT NULL UNIQUE,
      email                       TEXT NOT NULL,
      name                        TEXT NOT NULL,
      testing_areas               JSONB NOT NULL DEFAULT '[]'::jsonb,
      personal_message            TEXT,
      invite_request_id           UUID,
      nda_version                 VARCHAR(16) NOT NULL DEFAULT '1.0',
      program_terms_version       VARCHAR(16) NOT NULL DEFAULT '1.0',
      dpa_version                 VARCHAR(16) NOT NULL DEFAULT '1.0',
      letter_of_intent_version    VARCHAR(16) NOT NULL DEFAULT '1.0',
      status                      VARCHAR(20) NOT NULL DEFAULT 'pending',
      accepted_at                 TIMESTAMPTZ,
      accepted_nda_name           TEXT,
      accepted_program_terms      BOOLEAN DEFAULT false,
      accepted_dpa                BOOLEAN NOT NULL DEFAULT false,
      accepted_letter_of_intent   BOOLEAN NOT NULL DEFAULT false,
      accepted_ip                 TEXT,
      accepted_user_agent         TEXT,
      confirmed_signing_authority BOOLEAN NOT NULL DEFAULT false,
      accepted_agreements_snapshot JSONB,
      agreement_digest            VARCHAR(64),
      provisioned_user_id         TEXT,
      provisioned_at              TIMESTAMPTZ,
      program_started_at          TIMESTAMPTZ,
      program_ends_at             TIMESTAMPTZ,
      program_duration_weeks      INTEGER NOT NULL DEFAULT 12,
      benefit_granted             BOOLEAN DEFAULT false,
      benefit_granted_at          TIMESTAMPTZ,
      benefit_description         TEXT,
      feedback_count              INTEGER NOT NULL DEFAULT 0,
      last_feedback_at            TIMESTAMPTZ,
      last_login_at               TIMESTAMPTZ,
      last_digest_sent_at         TIMESTAMPTZ,
      email_sent_at               TIMESTAMPTZ,
      email_provider              VARCHAR(80),
      email_message_id            TEXT,
      email_delivery_reason       TEXT,
      email_opened_at             TIMESTAMPTZ,
      invite_link_clicked_at      TIMESTAMPTZ,
      signature_method            VARCHAR(80),
      email_verified_at           TIMESTAMPTZ,
      signing_receipt_id          UUID,
      receipt_email_sent_at       TIMESTAMPTZ,
      receipt_email_provider      VARCHAR(80),
      receipt_email_message_id    TEXT,
      receipt_email_delivery_reason TEXT,
      email_delivery_attempt_count INTEGER NOT NULL DEFAULT 0,
      email_last_attempt_at        TIMESTAMPTZ,
      account_provisioning_attempt_count INTEGER NOT NULL DEFAULT 0,
      account_provisioning_last_attempt_at TIMESTAMPTZ,
      account_provisioning_error   TEXT,
      access_email_attempt_count   INTEGER NOT NULL DEFAULT 0,
      access_email_last_attempt_at TIMESTAMPTZ,
      access_email_sent_at         TIMESTAMPTZ,
      access_email_provider        VARCHAR(80),
      access_email_message_id      TEXT,
      access_email_delivery_reason TEXT,
      receipt_email_attempt_count  INTEGER NOT NULL DEFAULT 0,
      receipt_email_last_attempt_at TIMESTAMPTZ,
      invited_by                  TEXT,
      expires_at                  TIMESTAMPTZ NOT NULL,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
  // Slice 9X.53 — Granulert tilgang (Hybrid C-modell)
  for (const col of [
    `granted_plan VARCHAR(50) NOT NULL DEFAULT 'tester_all_access'`,
    `granted_features JSONB NOT NULL DEFAULT '[]'::jsonb`,
  ]) {
    await pool.query(`ALTER TABLE prototype_tester_invites ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
  // Complete legal bundle + immutable acceptance evidence.
  for (const col of [
    `dpa_version VARCHAR(16) NOT NULL DEFAULT '1.0'`,
    `letter_of_intent_version VARCHAR(16) NOT NULL DEFAULT '1.0'`,
    `accepted_dpa BOOLEAN NOT NULL DEFAULT false`,
    `accepted_letter_of_intent BOOLEAN NOT NULL DEFAULT false`,
    `accepted_user_agent TEXT`,
    `confirmed_signing_authority BOOLEAN NOT NULL DEFAULT false`,
    `accepted_agreements_snapshot JSONB`,
    `agreement_digest VARCHAR(64)`,
    `provisioned_user_id TEXT`,
    `provisioned_at TIMESTAMPTZ`,
    `email_sent_at TIMESTAMPTZ`,
    `email_provider VARCHAR(80)`,
    `email_message_id TEXT`,
    `email_delivery_reason TEXT`,
    `email_opened_at TIMESTAMPTZ`,
    `invite_link_clicked_at TIMESTAMPTZ`,
    `signature_method VARCHAR(80)`,
    `email_verified_at TIMESTAMPTZ`,
    `signing_receipt_id UUID`,
    `receipt_email_sent_at TIMESTAMPTZ`,
    `receipt_email_provider VARCHAR(80)`,
    `receipt_email_message_id TEXT`,
    `receipt_email_delivery_reason TEXT`,
    `email_delivery_attempt_count INTEGER NOT NULL DEFAULT 0`,
    `email_last_attempt_at TIMESTAMPTZ`,
    `account_provisioning_attempt_count INTEGER NOT NULL DEFAULT 0`,
    `account_provisioning_last_attempt_at TIMESTAMPTZ`,
    `account_provisioning_error TEXT`,
    `access_email_attempt_count INTEGER NOT NULL DEFAULT 0`,
    `access_email_last_attempt_at TIMESTAMPTZ`,
    `access_email_sent_at TIMESTAMPTZ`,
    `access_email_provider VARCHAR(80)`,
    `access_email_message_id TEXT`,
    `access_email_delivery_reason TEXT`,
    `receipt_email_attempt_count INTEGER NOT NULL DEFAULT 0`,
    `receipt_email_last_attempt_at TIMESTAMPTZ`,
  ]) {
    await pool.query(`ALTER TABLE prototype_tester_invites ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
  // Slice 9X.56 — Team-flyt: master kan invitere opptil max_team_size-1
  // andre medlemmer. Alle deler aligned program_ends_at fra master sin start.
  for (const col of [
    `team_role VARCHAR(20) NOT NULL DEFAULT 'individual'`,
    `master_invite_id UUID`,
    `max_team_size INTEGER NOT NULL DEFAULT 1`,
    // Slice 9X.58 — Profesjon per medlem: en fotograf-master kan invitere en
    // videograf. Settes på users.profession ved aksept → riktig dashboard.
    `member_profession VARCHAR(40)`,
    // Firma per invitert tester: fanges ved invitasjon slik at tester-profilen
    // er forhåndsutfylt ved aksept (bare bekreft, ikke fyll på nytt). Bæres
    // videre til users.company_name → grunnlag for konvertering til kunde.
    `member_company VARCHAR(200)`,
    // Verifisert juridisk identitet fra Enhetsregisteret. Disse feltene brukes
    // i avtalegrunnlaget og skal ikke utledes fra et fritt tekstfelt.
    `member_organization_number VARCHAR(9)`,
    `member_business_address VARCHAR(500)`,
  ]) {
    await pool.query(`ALTER TABLE prototype_tester_invites ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_master
       ON prototype_tester_invites (master_invite_id)
       WHERE master_invite_id IS NOT NULL`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_email
       ON prototype_tester_invites (LOWER(email))`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_status
       ON prototype_tester_invites (status, program_ends_at)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_tester_invites_receipt_id
       ON prototype_tester_invites (signing_receipt_id)
       WHERE signing_receipt_id IS NOT NULL`,
  ).catch(() => undefined);
}


// Open/click-tracking persists on the tester invitation itself and, when the
// invitation came from an application, on invite_requests for its conversion
// dashboard as well.
function buildInviteTrackUrls(baseUrl: string, token: string): { openPixelUrl: string; clickUrl: string } {
  const t = encodeURIComponent(token);
  return {
    openPixelUrl: `${baseUrl}/api/prototype-tester-invites/track/open/${t}`,
    clickUrl: `${baseUrl}/api/prototype-tester-invites/track/click/${t}`,
  };
}

function buildInviteEmailHtml(
  name: string,
  inviteUrl: string,
  personalMessage: string | null,
  track?: { openPixelUrl: string; clickUrl: string },
): string {
  const linkUrl = track?.clickUrl || inviteUrl;
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h2 style="margin:0 0 16px;">Hei ${escapeHtml(name)},</h2>
      <p style="font-size:15px;line-height:1.6;">
        Søknaden din om å bli prototype-tester i Creatorhubn er <b>godkjent</b>!
      </p>
      ${personalMessage ? `<div style="background:#fff8ee;border-left:3px solid #ffba6c;padding:12px 16px;margin:16px 0;font-style:italic;">"${escapeHtml(personalMessage)}"</div>` : ""}
      <p style="font-size:15px;line-height:1.6;">
        Før du får tilgang må du gå gjennom avtalegrunnlaget (programvilkår, NDA, databehandleravtale og intensjonsavtale; 12 uker, ~2 t/uke,
        min. 4 feedback per måned) og signere den samlede avtaleaksepten.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${linkUrl}" style="display:inline-block;background:#ffba6c;color:#150d05;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;">Les vilkår og signer</a>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.5;">
        Lenken er gyldig i ${INVITE_EXPIRES_DAYS} dager. Hvis knappen ikke fungerer:<br>
        <a href="${linkUrl}" style="color:#1976d2;word-break:break-all;">${inviteUrl}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
      <p style="font-size:12px;color:#999;">
        Du får denne fordi du søkte om å bli prototype-tester via creatorhubn.com.
        Hvis dette er en feil, kan du ignorere e-posten.
      </p>
      ${track ? `<img src="${track.openPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;">` : ""}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteEmailText(name: string, inviteUrl: string, personalMessage: string | null): string {
  const personal = personalMessage ? `Melding fra CreatorHub: ${personalMessage}` : "";
  return [
    `Hei ${name},`,
    "",
    "Søknaden din om å bli prototype-tester i CreatorHub er godkjent.",
    personal,
    "Før du får tilgang må du lese og akseptere programvilkårene, NDA-en, databehandleravtalen og intensjonsavtalen.",
    `Åpne invitasjonen: ${inviteUrl}`,
    `Lenken er gyldig i ${INVITE_EXPIRES_DAYS} dager.`,
  ].filter(Boolean).join("\n\n");
}

async function deliverInviteEmail(
  pool: any,
  email: string,
  name: string,
  inviteUrl: string,
  personalMessage: string | null,
  subject: string,
  kind: string,
  sentByUserId: string | null = null,
  projectId: string | null = null,
  track: { openPixelUrl: string; clickUrl: string } | undefined = undefined,
) {
  const result = await sendTransactionalEmail({
    to: email,
    subject,
    html: buildInviteEmailHtml(name, inviteUrl, personalMessage, track),
    text: buildInviteEmailText(name, inviteUrl, personalMessage),
    replyTo: "daniel@creatorhubn.com",
    fromLabel: "CreatorHub",
    kind,
    projectId,
    sentByUserId,
    pool,
  });
  return {
    sent: result.sent,
    provider: result.provider,
    reason: result.reason,
    messageId: result.messageId,
  };
}

function dashboardForProfession(profession: string | null): string {
  switch (profession) {
    case "photographer":
      return "/photographer-dashboard-material";
    case "videographer":
      return "/videographer-dashboard-material";
    case "music_producer":
      return "/music_producer-dashboard-material";
    case "vendor":
      return "/vendor-dashboard-material";
    default:
      return "/workspace";
  }
}

const AGREEMENT_KEYS: PrototypeTesterAgreementKey[] = [
  "program_terms",
  "nda",
  "dpa",
  "letter_of_intent",
];

function parseAgreementSnapshot(value: unknown): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function agreementVersionsForRow(r: any) {
  return {
    program_terms: String(r.program_terms_version || PROGRAM_TERMS_VERSION),
    nda: String(r.nda_version || NDA_VERSION),
    dpa: String(r.dpa_version || DPA_VERSION),
    letter_of_intent: String(r.letter_of_intent_version || LETTER_OF_INTENT_VERSION),
  };
}

function buildAgreementsForRow(r: any): PrototypeTesterAgreementDocument[] {
  const stored = parseAgreementSnapshot(r.accepted_agreements_snapshot);
  if (Array.isArray(stored?.documents) && stored.documents.length === AGREEMENT_KEYS.length) {
    return stored.documents as PrototypeTesterAgreementDocument[];
  }
  return buildPrototypeTesterAgreementBundle(
    {
      testerName: String(r.name || r.email || "Tester"),
      testerEmail: String(r.email || ""),
      testerCompany: r.member_company || null,
      testerOrganizationNumber: r.member_organization_number || null,
      testerBusinessAddress: r.member_business_address || null,
    },
    agreementVersionsForRow(r),
  );
}

function agreementAcceptanceForRow(r: any) {
  const documents = buildAgreementsForRow(r);
  const acceptedByKey: Record<PrototypeTesterAgreementKey, boolean> = {
    program_terms: r.accepted_program_terms === true,
    nda: Boolean(r.accepted_nda_name),
    dpa: r.accepted_dpa === true,
    letter_of_intent: r.accepted_letter_of_intent === true,
  };
  return {
    complete: AGREEMENT_KEYS.every((key) => acceptedByKey[key]),
    acceptedAt: r.accepted_at || null,
    signerName: r.accepted_nda_name || null,
    digest: r.agreement_digest || null,
    confirmedSigningAuthority: r.confirmed_signing_authority === true,
    documents: documents.map((document) => ({
      key: document.key,
      title: document.title,
      version: document.version,
      accepted: acceptedByKey[document.key],
      bindingNature: document.bindingNature,
    })),
  };
}

function buildAgreementSnapshot(
  documents: PrototypeTesterAgreementDocument[],
  row: any,
  signerName: string,
  acceptedAt: string,
  emailVerifiedAt: string,
) {
  return {
    schemaVersion: 2,
    acceptedAt,
    signerName,
    signerEmail: String(row.email || ""),
    representedCompany: row.member_company || null,
    representedCompanyOrganizationNumber:
      row.member_organization_number || null,
    representedCompanyBusinessAddress: row.member_business_address || null,
    confirmedSigningAuthority: true,
    signatureMethod: "email_otp_typed_name",
    emailVerifiedAt,
    documents: documents.map((document) => ({ ...document })),
  };
}

function agreementSnapshotDigest(snapshot: unknown): string {
  return crypto.createHash("sha256").update(canonicalJsonStringify(snapshot), "utf8").digest("hex");
}

function rowToInvite(r: any): any {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    testingAreas: r.testing_areas || [],
    personalMessage: r.personal_message,
    ndaVersion: r.nda_version,
    programTermsVersion: r.program_terms_version,
    dpaVersion: r.dpa_version || DPA_VERSION,
    letterOfIntentVersion: r.letter_of_intent_version || LETTER_OF_INTENT_VERSION,
    agreements: buildAgreementsForRow(r),
    agreementAcceptance: agreementAcceptanceForRow(r),
    signatureMethod: r.signature_method || null,
    emailVerifiedAt: r.email_verified_at || null,
    signingReceiptId: r.signing_receipt_id || null,
    accountProvisioningComplete: Boolean(
      r.provisioned_user_id ||
      r.provisioned_at ||
      (r.status === "accepted" && !r.agreement_digest),
    ),
    status: r.status,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    programStartedAt: r.program_started_at,
    programEndsAt: r.program_ends_at,
    programDurationWeeks: r.program_duration_weeks,
    feedbackCount: r.feedback_count,
    lastFeedbackAt: r.last_feedback_at,
    benefitGranted: r.benefit_granted,
    grantedPlan: r.granted_plan || "tester_all_access",
    grantedFeatures: r.granted_features || [],
    teamRole: r.team_role || "individual",
    masterInviteId: r.master_invite_id || null,
    maxTeamSize: r.max_team_size || 1,
    memberProfession: r.member_profession || null,
    memberCompany: r.member_company || null,
    memberOrganizationNumber: r.member_organization_number || null,
    memberBusinessAddress: r.member_business_address || null,
  };
}

function rowToAdminInviteSummary(r: any, baseUrl: string): any {
  const invite = rowToInvite(r);
  const lifecycleStatus = (
    complete: boolean,
    failed: boolean,
  ): "complete" | "failed" | "pending" =>
    complete ? "complete" : failed ? "failed" : "pending";
  const lifecycle = [
    {
      key: "created",
      label: "Invitasjon opprettet",
      status: "complete",
      at: r.created_at || null,
    },
    {
      key: "invite_email",
      label: "Invitasjon sendt",
      status: lifecycleStatus(
        Boolean(r.dashboard_email_sent_at || r.email_sent_at),
        Boolean(r.email_delivery_reason),
      ),
      at: r.dashboard_email_sent_at || r.email_sent_at || r.email_last_attempt_at || null,
      detail: r.email_delivery_reason || null,
      retryStep: !r.dashboard_email_sent_at && !r.email_sent_at ? "invite_email" : null,
    },
    {
      key: "opened",
      label: "E-post åpnet",
      status: lifecycleStatus(Boolean(r.dashboard_email_opened_at || r.email_opened_at), false),
      at: r.dashboard_email_opened_at || r.email_opened_at || null,
    },
    {
      key: "clicked",
      label: "Invitasjonslenke åpnet",
      status: lifecycleStatus(Boolean(r.dashboard_invite_link_clicked_at || r.invite_link_clicked_at), false),
      at: r.dashboard_invite_link_clicked_at || r.invite_link_clicked_at || null,
    },
    {
      key: "email_verified",
      label: "E-post bekreftet med kode",
      status: lifecycleStatus(Boolean(r.email_verified_at), false),
      at: r.email_verified_at || null,
    },
    {
      key: "agreements",
      label: "Fire avtaler akseptert",
      status: lifecycleStatus(Boolean(r.accepted_at), false),
      at: r.accepted_at || null,
    },
    {
      key: "account",
      label: "Konto opprettet",
      status: lifecycleStatus(Boolean(r.provisioned_user_id || r.provisioned_at), Boolean(r.account_provisioning_error)),
      at: r.provisioned_at || r.account_provisioning_last_attempt_at || null,
      detail: r.account_provisioning_error || null,
      retryStep: r.accepted_at && !r.provisioned_user_id ? "account" : null,
    },
    {
      key: "solo_pro",
      label: "solo_pro aktiv",
      status: lifecycleStatus(Boolean(r.solo_pro_active), Boolean(r.provisioned_user_id && !r.solo_pro_active)),
      at: r.provisioned_at || null,
      detail: r.provisioned_user_id && !r.solo_pro_active ? "Tilgangen mangler aktivt solo_pro-abonnement." : null,
      retryStep: r.provisioned_user_id && !r.solo_pro_active ? "account" : null,
    },
    {
      key: "access_email",
      label: "Tilgangs-e-post sendt",
      status: lifecycleStatus(Boolean(r.access_email_sent_at), Boolean(r.access_email_delivery_reason)),
      at: r.access_email_sent_at || r.access_email_last_attempt_at || null,
      detail: r.access_email_delivery_reason || null,
      retryStep: r.provisioned_user_id && !r.access_email_sent_at ? "access_email" : null,
    },
    {
      key: "receipt",
      label: "PDF-kvittering tilgjengelig",
      status: lifecycleStatus(Boolean(r.signing_receipt_id), false),
      at: r.accepted_at || null,
    },
    {
      key: "receipt_email",
      label: "Kvittering sendt",
      status: lifecycleStatus(Boolean(r.receipt_email_sent_at), Boolean(r.receipt_email_delivery_reason)),
      at: r.receipt_email_sent_at || r.receipt_email_last_attempt_at || null,
      detail: r.receipt_email_delivery_reason || null,
      retryStep: r.signing_receipt_id && !r.receipt_email_sent_at ? "receipt_email" : null,
    },
  ];
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    testingAreas: invite.testingAreas,
    status: invite.status,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    programStartedAt: invite.programStartedAt,
    programEndsAt: invite.programEndsAt,
    accountProvisioningComplete: invite.accountProvisioningComplete,
    soloProActive: Boolean(r.solo_pro_active),
    memberProfession: invite.memberProfession,
    memberCompany: invite.memberCompany,
    memberOrganizationNumber: invite.memberOrganizationNumber,
    memberBusinessAddress: invite.memberBusinessAddress,
    inviteRequestId: r.invite_request_id || null,
    createdAt: r.created_at,
    emailDelivery: {
      sent: Boolean(r.dashboard_email_sent_at || r.email_sent_at),
      sentAt: r.dashboard_email_sent_at || r.email_sent_at || null,
      provider: r.email_provider || null,
      reason: r.email_delivery_reason || null,
      messageId: r.email_message_id || null,
    },
    emailOpenedAt: r.dashboard_email_opened_at || r.email_opened_at || null,
    inviteLinkClickedAt:
      r.dashboard_invite_link_clicked_at || r.invite_link_clicked_at || null,
    signatureMethod: r.signature_method || null,
    emailVerifiedAt: r.email_verified_at || null,
    signingReceiptId: r.signing_receipt_id || null,
    receiptEmailDelivery: {
      sent: Boolean(r.receipt_email_sent_at),
      sentAt: r.receipt_email_sent_at || null,
      provider: r.receipt_email_provider || null,
      reason: r.receipt_email_delivery_reason || null,
    },
    accessEmailDelivery: {
      sent: Boolean(r.access_email_sent_at),
      sentAt: r.access_email_sent_at || null,
      provider: r.access_email_provider || null,
      reason: r.access_email_delivery_reason || null,
    },
    operationalAttempts: {
      inviteEmail: Number(r.email_delivery_attempt_count || 0),
      account: Number(r.account_provisioning_attempt_count || 0),
      accessEmail: Number(r.access_email_attempt_count || 0),
      receiptEmail: Number(r.receipt_email_attempt_count || 0),
    },
    lifecycle,
    inviteUrl: `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(r.token)}`,
  };
}

// Slice 9X.58 — Gyldige profesjoner et team-medlem kan ha. Må matche
// frontend-keys (useProfessionAdapter) → riktig dashboard-orchestrator.
const ALLOWED_MEMBER_PROFESSIONS = new Set([
  "photographer",
  "videographer",
  "music_producer",
  "vendor",
]);
function normalizeMemberProfession(raw: unknown): string | null {
  // Delt kanonisering (norske synonymer + skilletegns-varianter som
  // 'musicproducer' → 'music_producer') + lokal whitelist for team-medlemmer.
  const mapped = normalizeProfession(raw);
  if (!mapped) return null;
  return ALLOWED_MEMBER_PROFESSIONS.has(mapped) ? mapped : null;
}

/**
 * Auto-bro: kalles av invite-approval-flow i index.ts.
 * Eksportert som standalone så index.ts kan importere den.
 */
// Slice 9X.56 — Parse team-størrelse fra message-feltet.
// InviteRequestForm prepender "[Team: X medlemmer]" når søker er team-master.
function parseTeamSizeFromMessage(message: string | null): number {
  if (!message) return 1;
  const m = message.match(/\[Team:\s*(\d+)\s*medlemmer?\]/i);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(5, Math.max(1, n)); // Hard-cap maks 5
}

const MAX_TEAM_SIZE = 5;

export async function createInviteFromApprovedRequest(
  pool: any,
  inviteRequestId: string,
  email: string,
  name: string,
  invitedBy: string | null,
  testingAreas: string[] = [],
  baseUrl: string = "https://creatorhubn.com",
  grantedPlan: string = "tester_all_access",
  grantedFeatures: string[] = [],
  teamSize: number = 1,
  // Bær profesjon + firma fra den godkjente invite-request-en → forhåndsutfylt
  // tester-profil ved aksept (bare bekreft) + grunnlag for kunde-konvertering.
  memberProfession: string | null = null,
  memberCompany: string | null = null,
  memberOrganizationNumber: string | null = null,
  memberBusinessAddress: string | null = null,
  sendApprovalEmail?: PrototypeTesterApprovalEmailSender,
): Promise<{ id: string; token: string; inviteUrl: string; reused: boolean; emailDelivery: PrototypeTesterEmailDelivery | null } | null> {
  try {
    await ensureSchema(pool);
    // Skip hvis det allerede finnes en aktiv invitasjon for denne søknaden
    const existing = await pool.query(
      `SELECT id, token FROM prototype_tester_invites
        WHERE invite_request_id = $1 AND status IN ('pending','accepted')
        LIMIT 1`,
      [inviteRequestId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      const row = existing.rows[0];
      return {
        id: row.id,
        token: row.token,
        inviteUrl: `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(row.token)}`,
        reused: true,
        emailDelivery: null,
      };
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const clampedTeamSize = Math.min(MAX_TEAM_SIZE, Math.max(1, teamSize));
    const isTeamMaster = clampedTeamSize > 1;
    const ins = await pool.query(
      `INSERT INTO prototype_tester_invites
         (token, email, name, testing_areas, invite_request_id, nda_version,
          program_terms_version, dpa_version, letter_of_intent_version,
          expires_at, invited_by, granted_plan, granted_features, team_role,
          max_team_size, member_profession, member_company,
          member_organization_number, member_business_address)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19)
       RETURNING id, token`,
      [
        token,
        email,
        name,
        JSON.stringify(testingAreas),
        inviteRequestId,
        NDA_VERSION,
        PROGRAM_TERMS_VERSION,
        DPA_VERSION,
        LETTER_OF_INTENT_VERSION,
        expiresAt.toISOString(),
        invitedBy,
        grantedPlan,
        JSON.stringify(grantedFeatures),
        isTeamMaster ? "master" : "individual",
        clampedTeamSize,
        normalizeMemberProfession(memberProfession),
        typeof memberCompany === "string" && memberCompany.trim()
          ? memberCompany.trim().slice(0, MAX_COMPANY_LENGTH)
          : null,
        isValidNorwegianOrganizationNumber(
          normalizeNorwegianOrganizationNumber(memberOrganizationNumber),
        )
          ? normalizeNorwegianOrganizationNumber(memberOrganizationNumber)
          : null,
        typeof memberBusinessAddress === "string" && memberBusinessAddress.trim()
          ? memberBusinessAddress.trim().slice(0, MAX_BUSINESS_ADDRESS_LENGTH)
          : null,
      ],
    );
    const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(token)}`;
    const tracking = buildInviteTrackUrls(baseUrl, token);

    const emailDelivery = sendApprovalEmail
      ? await sendApprovalEmail({
          recipientEmail: email,
          recipientName: name,
          inviteUrl,
          ctaUrl: tracking.clickUrl,
          trackingPixelUrl: tracking.openPixelUrl,
          inviteRequestId,
          sentByUserId: invitedBy,
          profession: normalizeMemberProfession(memberProfession),
          company: memberCompany,
          programDurationWeeks: PROGRAM_DURATION_WEEKS,
          inviteExpiresDays: INVITE_EXPIRES_DAYS,
        })
      : await deliverInviteEmail(
          pool,
          email,
          name,
          inviteUrl,
          null,
          "Du er godkjent som prototype-tester i CreatorHub",
          "prototype_tester_invite",
          invitedBy,
          inviteRequestId,
          tracking,
        );

    await pool.query(
      `UPDATE prototype_tester_invites
          SET email_sent_at = CASE
                WHEN $2::boolean THEN COALESCE(email_sent_at, NOW())
                ELSE email_sent_at
              END,
              email_provider = $3,
              email_message_id = $4,
              email_delivery_reason = $5,
              email_delivery_attempt_count = COALESCE(email_delivery_attempt_count, 0) + 1,
              email_last_attempt_at = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [
        ins.rows[0].id,
        emailDelivery.sent,
        emailDelivery.provider,
        emailDelivery.messageId,
        emailDelivery.reason,
      ],
    );

    if (emailDelivery.sent) {
      await pool.query(
        `UPDATE invite_requests
            SET invite_sent_at = COALESCE(invite_sent_at, NOW()),
                invite_sent_count = COALESCE(invite_sent_count, 0) + 1,
                user_journey_status = 'invite_sent',
                updated_at = NOW()
          WHERE id = $1`,
        [inviteRequestId],
      ).catch((error: unknown) => {
        console.warn("[prototype-tester-invite] could not update delivery status:", error);
      });
    }

    return { id: ins.rows[0].id, token, inviteUrl, reused: false, emailDelivery };
  } catch (err) {
    console.error("createInviteFromApprovedRequest failed:", err);
    return null;
  }
}

export function setupPrototypeTesterInvitesRoutes(deps: PrototypeTesterInvitesDeps): void {
  const {
    app,
    pool,
    getPricingUserId,
    requireUserSession,
    requireAdminSession,
    provisionTesterAccount,
    sendInviteEmail,
    previewInviteEmail,
    sendAccessActivatedEmail,
    issueSigningCode,
    verifySigningCode,
    sendReceiptEmail,
    lookupBrregCompany,
    searchBrregCompanies = searchOpenBrregCompanies,
    lookupBrregContact = lookupOpenBrregContact,
  } = deps;

  const requestIp = (req: any): string | null => {
    const forwarded = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return String(raw || req.ip || "").split(",")[0]?.trim().slice(0, 200) || null;
  };

  const maskEmail = (email: string): string => {
    const [local, domain] = String(email || "").split("@");
    if (!local || !domain) return "den inviterte e-postadressen";
    return `${local.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
  };

  // ─── Open/click-tracking (public, ingen auth — kalles fra e-postklienter) ───
  // 1×1 transparent GIF; første åpning stemples, senere åpninger beholdes ikke.
  const TRACK_PIXEL_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  // Token er enten en prototype_tester_invites.token ELLER en invite_requests.id
  // direkte (generiske invitasjoner fra /send-invite har ingen tester-rad).
  app.get("/api/prototype-tester-invites/track/open/:token", async (req, res) => {
    try {
      await pool.query(
        `UPDATE prototype_tester_invites
            SET email_opened_at = COALESCE(email_opened_at, NOW()),
                updated_at = NOW()
          WHERE token = $1`,
        [req.params.token],
      );
      await pool.query(
        `UPDATE invite_requests
            SET invite_email_opened_at = COALESCE(invite_email_opened_at, NOW()),
                updated_at = NOW()
          WHERE id = COALESCE(
            (SELECT invite_request_id::text FROM prototype_tester_invites WHERE token = $1 LIMIT 1),
            $1)`,
        [req.params.token],
      );
    } catch (err) {
      console.error("[invite-track] open failed:", (err as { message?: string })?.message || err);
    }
    res
      .set({
        "Content-Type": "image/gif",
        "Content-Length": String(TRACK_PIXEL_GIF.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      })
      .end(TRACK_PIXEL_GIF);
  });

  // Klikk stempler både klikk og åpning (klikk uten pixel-last = åpnet uansett),
  // og redirecter alltid til accept-siden — frontend håndterer ugyldig/utløpt token.
  app.get("/api/prototype-tester-invites/track/click/:token", async (req, res) => {
    const token = String(req.params.token);
    let isTesterToken = false;
    try {
      const match = await pool.query(
        `UPDATE prototype_tester_invites
            SET email_opened_at = COALESCE(email_opened_at, NOW()),
                invite_link_clicked_at = COALESCE(invite_link_clicked_at, NOW()),
                updated_at = NOW()
          WHERE token = $1
          RETURNING 1`,
        [token],
      );
      isTesterToken = match.rows.length > 0;
      await pool.query(
        `UPDATE invite_requests
            SET invite_email_opened_at = COALESCE(invite_email_opened_at, NOW()),
                invite_link_clicked_at = COALESCE(invite_link_clicked_at, NOW()),
                updated_at = NOW()
          WHERE id = COALESCE(
            (SELECT invite_request_id::text FROM prototype_tester_invites WHERE token = $1 LIMIT 1),
            $1)`,
        [token],
      );
    } catch (err) {
      console.error("[invite-track] click failed:", (err as { message?: string })?.message || err);
    }
    const base = safeAppBaseUrl(req);
    res.redirect(
      isTesterToken
        ? `${base}/prototype-tester/accept-invite?token=${encodeURIComponent(token)}`
        : `${base}/login`,
    );
  });

  // ─── GET /api/prototype-tester-invites/brreg/search ─────────
  // Adminbeskyttet proxy mot Enhetsregisterets åpne API. Søkestrengen sendes
  // aldri sammen med CreatorHub-cookies eller andre interne identifikatorer.
  app.get("/api/prototype-tester-invites/brreg/search", async (req, res) => {
    if (!(await requireAdminSession(req, res))) return;
    const searchTerm = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    if (searchTerm.length < 2 || searchTerm.length > 180) {
      return res.status(400).json({
        error: "Søk med mellom 2 og 180 tegn.",
      });
    }
    try {
      const companies = await searchBrregCompanies(searchTerm);
      res.json({
        companies: companies
          .filter((company) => company.operationalStatus === "active")
          .slice(0, 10)
          .map((company) => {
            const recommendation = recommendPrototypeTesterProfessionDetailed(company);
            return {
            organizationNumber: company.organizationNumber,
            name: company.name,
            organizationForm: company.organizationForm,
            organizationFormCode: company.organizationFormCode || null,
            primaryIndustryCode: company.primaryIndustryCode || null,
            primaryIndustryDescription:
              company.primaryIndustryDescription || null,
            recommendedProfession: recommendation?.profession || null,
            professionRecommendation: recommendation,
            suggestedTestingAreas: recommendedTestingAreas(
              recommendation?.profession || null,
            ),
            businessAddress: formatBrregBusinessAddress(company.businessAddress),
            operationalStatus: company.operationalStatus,
            };
          }),
      });
    } catch (error) {
      console.warn("[prototype-tester-invite] BRREG search failed:", error);
      res.status(502).json({
        error: "BRREG-søket er midlertidig utilgjengelig.",
      });
    }
  });

  // Contact suggestions are deliberately separate from the company search so
  // a result list never fan-outs into person lookups. Only ENK holders are
  // suggested, and the admin must explicitly apply the name in the UI.
  app.get(
    "/api/prototype-tester-invites/brreg/:organizationNumber/contact",
    async (req, res) => {
      if (!(await requireAdminSession(req, res))) return;
      const organizationNumber = normalizeNorwegianOrganizationNumber(
        req.params.organizationNumber,
      );
      if (!isValidNorwegianOrganizationNumber(organizationNumber)) {
        return res.status(400).json({ error: "Ugyldig organisasjonsnummer" });
      }
      try {
        const contact = await lookupBrregContact(organizationNumber);
        return res.json({
          contact: contact
            ? {
                name: contact.name,
                role: contact.role,
                source: "BRREG_ROLLER",
                requiresConfirmation: true,
              }
            : null,
        });
      } catch (error) {
        console.warn("[prototype-tester-invite] BRREG contact lookup failed:", error);
        return res.status(502).json({
          error: "BRREG-kontakten kunne ikke hentes akkurat nå.",
        });
      }
    },
  );

  // Uses the exact Email Designer renderer without persisting an invitation or
  // sending mail. The selected company is re-verified server-side first.
  app.post("/api/prototype-tester-invites/preview", async (req, res) => {
    if (!(await requireAdminSession(req, res))) return;
    if (!previewInviteEmail) {
      return res.status(503).json({ error: "E-postforhåndsvisning er ikke tilgjengelig." });
    }
    const body = req.body ?? {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const testingAreas = Array.isArray(body.testingAreas) && body.testingAreas.every(
      (area: unknown) => typeof area === "string",
    )
      ? body.testingAreas.map((area: string) => area.trim()).filter(Boolean)
      : [];
    const personalMessage = typeof body.personalMessage === "string" && body.personalMessage.trim()
      ? body.personalMessage.trim()
      : null;
    const profession = normalizeMemberProfession(body.profession);

    if (!email || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Gyldig e-post er påkrevd" });
    }
    if (name.length < 2 || name.length > MAX_NAME_LENGTH || DISALLOWED_SINGLE_LINE_CHARS.test(name)) {
      return res.status(400).json({ error: "Navn må være mellom 2 og 200 tegn" });
    }
    if (
      testingAreas.length < 1 ||
      testingAreas.length > MAX_TESTING_AREAS ||
      testingAreas.some((area: string) =>
        area.length > MAX_TESTING_AREA_LENGTH || DISALLOWED_SINGLE_LINE_CHARS.test(area),
      )
    ) {
      return res.status(400).json({ error: "Velg minst ett gyldig testområde" });
    }
    if (!profession) {
      return res.status(400).json({ error: "Velg en gyldig profesjon" });
    }
    if (
      personalMessage &&
      (personalMessage.length > MAX_PERSONAL_MESSAGE_LENGTH || DISALLOWED_TEXT_CHARS.test(personalMessage))
    ) {
      return res.status(400).json({ error: "Personlig melding kan være maks 2000 tegn" });
    }

    let company = typeof body.company === "string" && body.company.trim()
      ? body.company.trim().slice(0, MAX_COMPANY_LENGTH)
      : null;
    const organizationNumber = normalizeNorwegianOrganizationNumber(body.organizationNumber);
    if (body.organizationNumber !== undefined) {
      if (!isValidNorwegianOrganizationNumber(organizationNumber)) {
        return res.status(400).json({ error: "Ugyldig organisasjonsnummer" });
      }
      if (!lookupBrregCompany) {
        return res.status(503).json({ error: "BRREG-verifisering er ikke tilgjengelig akkurat nå." });
      }
      const lookup = await lookupBrregCompany(organizationNumber).catch(() => null);
      if (
        !lookup ||
        lookup.lookupStatus !== "verified" ||
        !lookup.company ||
        lookup.company.operationalStatus !== "active" ||
        normalizeNorwegianOrganizationNumber(lookup.company.organizationNumber) !== organizationNumber
      ) {
        return res.status(503).json({ error: "BRREG kunne ikke bekrefte virksomheten. Prøv igjen." });
      }
      company = String(lookup.company.name || "").trim().slice(0, MAX_COMPANY_LENGTH);
    }

    try {
      const inviteUrl = `${safeAppBaseUrl(req)}/prototype-tester/accept-invite?token=forhandsvisning-ingen-utsending`;
      const preview = await previewInviteEmail({
        recipientEmail: email,
        recipientName: name,
        inviteUrl,
        profession,
        company,
        testingAreas,
        personalMessage,
        programDurationWeeks: PROGRAM_DURATION_WEEKS,
        inviteExpiresDays: INVITE_EXPIRES_DAYS,
      });
      return res.json({
        ...preview,
        recipientEmail: email,
        expiresAt: new Date(Date.now() + INVITE_EXPIRES_DAYS * 86_400_000).toISOString(),
        agreements: ["Programvilkår", "NDA", "Databehandleravtale", "Intensjonsavtale"],
      });
    } catch (error) {
      console.error("POST /prototype-tester-invites/preview:", error);
      return res.status(500).json({ error: "Kunne ikke lage e-postforhåndsvisning." });
    }
  });

  // ─── POST /api/prototype-tester-invites ─────────────────────
  // Admin oppretter invitasjon manuelt (push-modell, i tillegg til
  // auto-bro fra approval).
  app.post("/api/prototype-tester-invites", async (req, res) => {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;
    try {
      const body = req.body ?? {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const rawTestingAreas = Array.isArray(body.testingAreas) ? body.testingAreas : [];
      const testingAreas = rawTestingAreas.every((area: unknown) => typeof area === "string")
        ? rawTestingAreas.map((area: string) => area.trim())
        : [];
      const personalMessage = typeof body.personalMessage === "string"
        ? body.personalMessage.trim()
        : null;
      const invitedBy =
        typeof adminSession === "object" && adminSession && "userId" in adminSession
          ? String(adminSession.userId)
          : getPricingUserId(req) || null;
      // Fang profesjon + firma ved invitasjon → forhåndsutfylt tester-profil
      // (bare bekreft, ikke fyll på nytt) + grunnlag for kunde-konvertering.
      const memberProfession = normalizeMemberProfession(body.profession);
      let memberCompany =
        typeof body.company === "string" && body.company.trim()
          ? body.company.trim()
          : null;
      const requestedOrganizationNumber = normalizeNorwegianOrganizationNumber(
        body.organizationNumber,
      );
      let memberOrganizationNumber: string | null = null;
      let memberBusinessAddress: string | null = null;

      if (
        !email ||
        email.length > MAX_EMAIL_LENGTH ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({ error: "Gyldig e-post er påkrevd" });
      }
      if (
        name.length < 2 ||
        name.length > MAX_NAME_LENGTH ||
        DISALLOWED_SINGLE_LINE_CHARS.test(name)
      ) {
        return res.status(400).json({ error: "Navn må være mellom 2 og 200 tegn" });
      }
      if (
        rawTestingAreas.length < 1 ||
        rawTestingAreas.length > MAX_TESTING_AREAS ||
        testingAreas.length !== rawTestingAreas.length ||
        testingAreas.some(
          (area: string) =>
            !area ||
            area.length > MAX_TESTING_AREA_LENGTH ||
            DISALLOWED_SINGLE_LINE_CHARS.test(area),
        )
      ) {
        return res.status(400).json({ error: "Velg minst ett gyldig testområde" });
      }
      if (!memberProfession) {
        return res.status(400).json({ error: "Velg en gyldig profesjon" });
      }
      if (
        memberCompany &&
        (memberCompany.length > MAX_COMPANY_LENGTH ||
          DISALLOWED_SINGLE_LINE_CHARS.test(memberCompany))
      ) {
        return res.status(400).json({ error: "Firmanavn kan være maks 200 tegn" });
      }
      if (
        personalMessage &&
        (personalMessage.length > MAX_PERSONAL_MESSAGE_LENGTH ||
          DISALLOWED_TEXT_CHARS.test(personalMessage))
      ) {
        return res.status(400).json({ error: "Personlig melding kan være maks 2000 tegn" });
      }

      if (body.organizationNumber !== undefined) {
        if (
          typeof body.organizationNumber !== "string" ||
          !isValidNorwegianOrganizationNumber(requestedOrganizationNumber)
        ) {
          return res.status(400).json({
            error: "Organisasjonsnummer må være et gyldig norsk organisasjonsnummer.",
          });
        }
        if (!lookupBrregCompany) {
          return res.status(503).json({
            error: "BRREG-verifisering er ikke tilgjengelig akkurat nå.",
          });
        }

        let brregLookup: PrototypeTesterBrregLookupResult;
        try {
          brregLookup = await lookupBrregCompany(requestedOrganizationNumber);
        } catch (lookupError) {
          console.warn("[prototype-tester-invite] BRREG verification failed:", lookupError);
          return res.status(503).json({
            error: "BRREG-verifisering er midlertidig utilgjengelig. Prøv igjen.",
          });
        }
        if (brregLookup.lookupStatus === "not_found") {
          return res.status(400).json({
            error: "Organisasjonsnummeret ble ikke funnet i Brønnøysundregistrene.",
          });
        }
        if (brregLookup.lookupStatus !== "verified" || !brregLookup.company) {
          return res.status(503).json({
            error: "BRREG kunne ikke bekrefte virksomheten. Prøv igjen.",
          });
        }

        const officialOrganizationNumber = normalizeNorwegianOrganizationNumber(
          brregLookup.company.organizationNumber,
        );
        const officialCompanyName = String(brregLookup.company.name || "").trim();
        if (
          officialOrganizationNumber !== requestedOrganizationNumber ||
          !officialCompanyName ||
          officialCompanyName.length > MAX_COMPANY_LENGTH
        ) {
          return res.status(502).json({
            error: "BRREG returnerte en ugyldig virksomhetsidentitet.",
          });
        }
        if (brregLookup.company.operationalStatus !== "active") {
          return res.status(400).json({
            error: "Virksomheten er ikke aktiv i Brønnøysundregistrene.",
          });
        }

        // Stol på Enhetsregisterets juridiske navn og adresse, ikke verdiene
        // klienten sendte inn. Det hindrer at avtalegrunnlaget kan forfalskes.
        memberCompany = officialCompanyName;
        memberOrganizationNumber = officialOrganizationNumber;
        memberBusinessAddress = formatBrregBusinessAddress(
          brregLookup.company.businessAddress,
        );
      }

      await ensureSchema(pool);
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      const ins = await pool.query(
        `INSERT INTO prototype_tester_invites
           (token, email, name, testing_areas, personal_message, nda_version,
            program_terms_version, dpa_version, letter_of_intent_version,
            expires_at, invited_by, member_profession, member_company,
            member_organization_number, member_business_address)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, token, expires_at, created_at`,
        [
          token,
          email,
          name,
          JSON.stringify(testingAreas),
          personalMessage,
          NDA_VERSION,
          PROGRAM_TERMS_VERSION,
          DPA_VERSION,
          LETTER_OF_INTENT_VERSION,
          expiresAt.toISOString(),
          invitedBy,
          memberProfession,
          memberCompany,
          memberOrganizationNumber,
          memberBusinessAddress,
        ],
      );
      const row = ins.rows[0];
      const baseUrl = safeAppBaseUrl(req);
      const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(row.token)}`;
      const tracking = buildInviteTrackUrls(baseUrl, row.token);

      const emailDelivery = sendInviteEmail
        ? await sendInviteEmail({
            recipientEmail: email,
            recipientName: name,
            inviteUrl,
            ctaUrl: tracking.clickUrl,
            trackingPixelUrl: tracking.openPixelUrl,
            inviteId: String(row.id),
            sentByUserId: invitedBy,
            profession: memberProfession,
            company: memberCompany,
            testingAreas,
            personalMessage,
            programDurationWeeks: PROGRAM_DURATION_WEEKS,
            inviteExpiresDays: INVITE_EXPIRES_DAYS,
          })
        : await deliverInviteEmail(
            pool,
            email,
            name,
            inviteUrl,
            personalMessage,
            "Du er invitert som prototype-tester i CreatorHub",
            "prototype_tester_invite",
            invitedBy,
            null,
            tracking,
          );

      await pool.query(
        `UPDATE prototype_tester_invites
            SET email_sent_at = CASE
                  WHEN $2::boolean THEN COALESCE(email_sent_at, NOW())
                  ELSE email_sent_at
                END,
                email_provider = $3,
                email_message_id = $4,
                email_delivery_reason = $5,
                email_delivery_attempt_count = COALESCE(email_delivery_attempt_count, 0) + 1,
                email_last_attempt_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [
          row.id,
          emailDelivery.sent,
          emailDelivery.provider,
          emailDelivery.messageId,
          emailDelivery.reason,
        ],
      );

      res.status(201).json({
        id: String(row.id),
        token: row.token,
        inviteUrl,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        mailerConfigured: isTransactionalEmailConfigured(),
        emailDelivery,
        verifiedCompany: memberOrganizationNumber
          ? {
              name: memberCompany,
              organizationNumber: memberOrganizationNumber,
              businessAddress: memberBusinessAddress,
            }
          : null,
      });
    } catch (err: any) {
      console.error("POST /prototype-tester-invites:", err);
      res.status(500).json({ error: "Kunne ikke opprette invitasjon" });
    }
  });

  // ─── GET /api/prototype-tester-invites ──────────────────────
  // Adminoversikt for både direkte og søknadsbaserte invitasjoner. Tokenet
  // returneres bare innbakt i den adminbeskyttede akseptlenken.
  app.get("/api/prototype-tester-invites", async (req, res) => {
    if (!(await requireAdminSession(req, res))) return;
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `SELECT p.*,
                r.invite_sent_at AS dashboard_email_sent_at,
                r.invite_email_opened_at AS dashboard_email_opened_at,
                r.invite_link_clicked_at AS dashboard_invite_link_clicked_at,
                EXISTS (
                  SELECT 1
                    FROM user_subscriptions s
                   WHERE s.user_id::text = p.provisioned_user_id::text
                     AND s.plan_id = 'solo_pro'
                     AND s.status IN ('active', 'trial')
                ) AS solo_pro_active
           FROM prototype_tester_invites p
           LEFT JOIN invite_requests r
             ON r.id::text = p.invite_request_id::text
          ORDER BY p.created_at DESC
          LIMIT 200`,
      );
      const baseUrl = safeAppBaseUrl(req);
      res.json({
        invites: result.rows.map((row: any) =>
          rowToAdminInviteSummary(row, baseUrl),
        ),
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites:", err);
      res.status(500).json({ error: "Kunne ikke hente prototype-invitasjoner" });
    }
  });

  app.post("/api/prototype-tester-invites/:inviteId/retry", async (req, res) => {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;
    const inviteId = String(req.params.inviteId || "").trim().toLowerCase();
    const step = String(req.body?.step || "").trim();
    const allowedSteps = new Set(["invite_email", "account", "access_email", "receipt_email"]);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(inviteId)) {
      return res.status(400).json({ error: "Ugyldig invitasjons-ID" });
    }
    if (!allowedSteps.has(step)) {
      return res.status(400).json({ error: "Ugyldig retry-steg" });
    }

    try {
      await ensureSchema(pool);
      const existing = await pool.query(
        `SELECT p.*,
                EXISTS (
                  SELECT 1 FROM user_subscriptions s
                   WHERE s.user_id::text = p.provisioned_user_id::text
                     AND s.plan_id = 'solo_pro'
                     AND s.status IN ('active', 'trial')
                ) AS solo_pro_active
           FROM prototype_tester_invites p
          WHERE p.id = $1
          LIMIT 1`,
        [inviteId],
      );
      if (!existing.rows.length) {
        return res.status(404).json({ error: "Invitasjonen finnes ikke" });
      }
      const invite = existing.rows[0];
      const retrySnapshot = parseAgreementSnapshot(
        invite.accepted_agreements_snapshot,
      );
      const hasVerifiedAcceptance = Boolean(
        invite.status === "accepted" &&
          retrySnapshot &&
          agreementSnapshotDigest(retrySnapshot) ===
            String(invite.agreement_digest || ""),
      );

      // Validate that a retry is both necessary and safe before consuming an
      // attempt or starting the short concurrency lock.
      if (step === "invite_email") {
        if (invite.email_sent_at) {
          return res.status(409).json({ error: "Invitasjons-e-posten er allerede sendt." });
        }
        if (invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
          return res.status(409).json({ error: "Bare en aktiv, ventende invitasjon kan sendes på nytt." });
        }
      } else if (step === "account") {
        if (!hasVerifiedAcceptance) {
          return res.status(409).json({ error: "Konto kan bare repareres etter en verifisert avtaleaksept." });
        }
        if (invite.provisioned_user_id && invite.solo_pro_active) {
          return res.status(409).json({ error: "Konto og solo_pro er allerede aktive." });
        }
        if (!provisionTesterAccount) {
          return res.status(503).json({ error: "Kontooppretting er ikke tilgjengelig." });
        }
      } else if (step === "access_email") {
        if (!invite.provisioned_user_id || invite.status !== "accepted") {
          return res.status(409).json({ error: "Kontoen må være aktiv før tilgangs-e-posten kan sendes." });
        }
        if (invite.access_email_sent_at) {
          return res.status(409).json({ error: "Tilgangs-e-posten er allerede sendt." });
        }
        if (!sendAccessActivatedEmail) {
          return res.status(503).json({ error: "Tilgangs-e-post er ikke konfigurert." });
        }
      } else {
        if (!hasVerifiedAcceptance || !invite.signing_receipt_id) {
          return res.status(409).json({ error: "Kvitteringen kan bare sendes etter en verifisert avtaleaksept." });
        }
        if (invite.receipt_email_sent_at) {
          return res.status(409).json({ error: "Kvitteringen er allerede sendt." });
        }
        if (!sendReceiptEmail) {
          return res.status(503).json({ error: "Kvitterings-e-post er ikke konfigurert." });
        }
      }
      const retryColumn = {
        invite_email: ["email_delivery_attempt_count", "email_last_attempt_at"],
        account: ["account_provisioning_attempt_count", "account_provisioning_last_attempt_at"],
        access_email: ["access_email_attempt_count", "access_email_last_attempt_at"],
        receipt_email: ["receipt_email_attempt_count", "receipt_email_last_attempt_at"],
      }[step] as [string, string];
      const claimed = await pool.query(
        `UPDATE prototype_tester_invites
            SET ${retryColumn[0]} = COALESCE(${retryColumn[0]}, 0) + 1,
                ${retryColumn[1]} = NOW(),
                updated_at = NOW()
          WHERE id = $1
            AND (${retryColumn[1]} IS NULL OR ${retryColumn[1]} < NOW() - INTERVAL '30 seconds')
        RETURNING *`,
        [inviteId],
      );
      if (!claimed.rows.length) {
        res.set("Retry-After", "30");
        return res.status(429).json({ error: "Et forsøk på dette steget kjører nylig. Vent 30 sekunder." });
      }

      const baseUrl = safeAppBaseUrl(req);
      let delivery: PrototypeTesterEmailDelivery | null = null;
      if (step === "invite_email") {
        if (invite.email_sent_at) {
          return res.status(409).json({ error: "Invitasjons-e-posten er allerede sendt." });
        }
        if (invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
          return res.status(409).json({ error: "Bare en aktiv, ventende invitasjon kan sendes på nytt." });
        }
        const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(invite.token)}`;
        const tracking = buildInviteTrackUrls(baseUrl, invite.token);
        delivery = sendInviteEmail
          ? await sendInviteEmail({
              recipientEmail: String(invite.email),
              recipientName: String(invite.name),
              inviteUrl,
              ctaUrl: tracking.clickUrl,
              trackingPixelUrl: tracking.openPixelUrl,
              inviteId,
              sentByUserId:
                typeof adminSession === "object" && adminSession && "userId" in adminSession
                  ? String(adminSession.userId)
                  : null,
              profession: invite.member_profession || null,
              company: invite.member_company || null,
              testingAreas: Array.isArray(invite.testing_areas) ? invite.testing_areas : [],
              personalMessage: invite.personal_message || null,
              programDurationWeeks: Number(invite.program_duration_weeks || PROGRAM_DURATION_WEEKS),
              inviteExpiresDays: INVITE_EXPIRES_DAYS,
            })
          : await deliverInviteEmail(
              pool,
              String(invite.email),
              String(invite.name),
              inviteUrl,
              invite.personal_message || null,
              "Du er invitert som prototype-tester i CreatorHub",
              "prototype_tester_invite_retry",
              null,
              invite.invite_request_id || null,
              tracking,
            );
        await pool.query(
          `UPDATE prototype_tester_invites
              SET email_sent_at = CASE WHEN $2::boolean THEN COALESCE(email_sent_at, NOW()) ELSE email_sent_at END,
                  email_provider = $3,
                  email_message_id = $4,
                  email_delivery_reason = $5,
                  updated_at = NOW()
            WHERE id = $1`,
          [inviteId, delivery.sent, delivery.provider, delivery.messageId, delivery.reason],
        );
      } else if (step === "account") {
        const snapshot = parseAgreementSnapshot(invite.accepted_agreements_snapshot);
        if (
          invite.status !== "accepted" ||
          !snapshot ||
          agreementSnapshotDigest(snapshot) !== String(invite.agreement_digest || "")
        ) {
          return res.status(409).json({ error: "Konto kan bare repareres etter en verifisert avtaleaksept." });
        }
        if (!provisionTesterAccount) {
          return res.status(503).json({ error: "Kontooppretting er ikke tilgjengelig." });
        }
        let accountUserId: string | null = null;
        try {
          const account = await provisionTesterAccount(
            String(invite.email),
            String(invite.accepted_nda_name || invite.name),
            invite.member_profession || null,
            invite.member_company || null,
            invite.member_organization_number || null,
          );
          accountUserId = account?.id ? String(account.id) : null;
        } catch (error) {
          console.error("[prototype-tester retry] account provisioning failed", error);
        }
        await pool.query(
          `UPDATE prototype_tester_invites
              SET provisioned_user_id = COALESCE($2, provisioned_user_id),
                  provisioned_at = CASE WHEN $2 IS NOT NULL THEN COALESCE(provisioned_at, NOW()) ELSE provisioned_at END,
                  account_provisioning_error = CASE WHEN $2 IS NULL THEN 'account_provisioning_failed' ELSE NULL END,
                  updated_at = NOW()
            WHERE id = $1`,
          [inviteId, accountUserId],
        );
        if (!accountUserId) {
          return res.status(502).json({ error: "Konto og solo_pro kunne ikke repareres. Forsøket er loggført." });
        }
      } else if (step === "access_email") {
        if (!invite.provisioned_user_id || invite.status !== "accepted") {
          return res.status(409).json({ error: "Kontoen må være aktiv før tilgangs-e-posten kan sendes." });
        }
        if (invite.access_email_sent_at) {
          return res.status(409).json({ error: "Tilgangs-e-posten er allerede sendt." });
        }
        if (!sendAccessActivatedEmail) {
          return res.status(503).json({ error: "Tilgangs-e-post er ikke konfigurert." });
        }
        delivery = await sendAccessActivatedEmail({
          recipientEmail: String(invite.email),
          recipientName: String(invite.accepted_nda_name || invite.name),
          loginUrl: `${baseUrl}/login?redirect=${encodeURIComponent(dashboardForProfession(invite.member_profession || null))}`,
          inviteRequestId: invite.invite_request_id ? String(invite.invite_request_id) : null,
          inviteId,
          profession: invite.member_profession || null,
          company: invite.member_company || null,
          programEndsAt: invite.program_ends_at,
        });
        await pool.query(
          `UPDATE prototype_tester_invites
              SET access_email_sent_at = CASE WHEN $2::boolean THEN COALESCE(access_email_sent_at, NOW()) ELSE access_email_sent_at END,
                  access_email_provider = $3,
                  access_email_message_id = $4,
                  access_email_delivery_reason = $5,
                  updated_at = NOW()
            WHERE id = $1`,
          [inviteId, delivery.sent, delivery.provider, delivery.messageId, delivery.reason],
        );
      } else {
        const snapshot = parseAgreementSnapshot(invite.accepted_agreements_snapshot);
        if (
          invite.status !== "accepted" ||
          !invite.signing_receipt_id ||
          !snapshot ||
          agreementSnapshotDigest(snapshot) !== String(invite.agreement_digest || "")
        ) {
          return res.status(409).json({ error: "Kvitteringen kan bare sendes etter en verifisert avtaleaksept." });
        }
        if (invite.receipt_email_sent_at) {
          return res.status(409).json({ error: "Kvitteringen er allerede sendt." });
        }
        if (!sendReceiptEmail) {
          return res.status(503).json({ error: "Kvitterings-e-post er ikke konfigurert." });
        }
        delivery = await sendReceiptEmail({
          recipientEmail: String(invite.email),
          recipientName: String(invite.accepted_nda_name || invite.name),
          agreementsUrl: `${baseUrl}/login?redirect=${encodeURIComponent("/mine-avtaler")}`,
          receiptId: String(invite.signing_receipt_id),
          agreementDigest: String(invite.agreement_digest),
          acceptedAt: invite.accepted_at,
          programEndsAt: invite.program_ends_at,
          inviteId,
          company: invite.member_company || null,
        });
        await pool.query(
          `UPDATE prototype_tester_invites
              SET receipt_email_sent_at = CASE WHEN $2::boolean THEN COALESCE(receipt_email_sent_at, NOW()) ELSE receipt_email_sent_at END,
                  receipt_email_provider = $3,
                  receipt_email_message_id = $4,
                  receipt_email_delivery_reason = $5,
                  updated_at = NOW()
            WHERE id = $1`,
          [inviteId, delivery.sent, delivery.provider, delivery.messageId, delivery.reason],
        );
      }

      return res.json({ success: true, inviteId, step, delivery });
    } catch (error) {
      console.error("POST /prototype-tester-invites/:inviteId/retry:", error);
      const failureColumn = {
        invite_email: "email_delivery_reason",
        account: "account_provisioning_error",
        access_email: "access_email_delivery_reason",
        receipt_email: "receipt_email_delivery_reason",
      }[step];
      if (failureColumn) {
        await pool.query(
          `UPDATE prototype_tester_invites
              SET ${failureColumn} = $2,
                  updated_at = NOW()
            WHERE id = $1`,
          [inviteId, `${step}_retry_exception`],
        ).catch(() => undefined);
      }
      return res.status(500).json({ error: "Steget kunne ikke prøves på nytt." });
    }
  });

  // ─── GET /api/prototype-tester-invites/:token ───────────────
  app.get("/api/prototype-tester-invites/:token", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM prototype_tester_invites WHERE token = $1 LIMIT 1`,
        [req.params.token],
      );
      if (!r.rows.length) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      const row = r.rows[0];
      const expired = new Date(row.expires_at).getTime() < Date.now();
      const payload = rowToInvite(row);
      if (expired && payload.status === "pending") {
        await pool.query(
          `UPDATE prototype_tester_invites SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [row.id],
        );
        payload.status = "expired";
      }
      res.json(payload);
    } catch (err) {
      console.error("GET /prototype-tester-invites/:token:", err);
      res.status(500).json({ error: "Kunne ikke hente invitasjon" });
    }
  });

  // E-postkoden bindes alltid til adressen som CreatorHub inviterte. Klienten
  // kan ikke overstyre mottakeren, og klartekst-koden returneres aldri her.
  app.post("/api/prototype-tester-invites/:token/signing-code", async (req, res) => {
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `SELECT id, email, name, status, expires_at
           FROM prototype_tester_invites
          WHERE token = $1
          LIMIT 1`,
        [req.params.token],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Invitasjon ikke funnet" });
      }
      const invite = result.rows[0];
      if (invite.status !== "pending") {
        return res.status(409).json({ error: `Invitasjon er allerede ${invite.status}` });
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await pool.query(
          `UPDATE prototype_tester_invites
              SET status = 'expired', updated_at = NOW()
            WHERE id = $1 AND status = 'pending'`,
          [invite.id],
        );
        return res.status(410).json({ error: "Invitasjonen har utløpt" });
      }
      if (!issueSigningCode) {
        return res.status(503).json({ error: "E-postbekreftelse er midlertidig utilgjengelig" });
      }

      const issued = await issueSigningCode({
        recipientEmail: String(invite.email || ""),
        recipientName: String(invite.name || "Tester"),
        inviteId: String(invite.id),
        ipAddress: requestIp(req),
      });
      if (!issued.ok) {
        if (issued.reason === "rate_limited") {
          const retryAfterSeconds = Math.max(1, Number(issued.retryAfterSeconds) || 60);
          res.setHeader("Retry-After", String(retryAfterSeconds));
          return res.status(429).json({
            error: `Vent ${retryAfterSeconds} sekunder før du ber om ny kode`,
            retryAfterSeconds,
            expiresAt: issued.expiresAt,
          });
        }
        return res.status(503).json({ error: "Kunne ikke sende bekreftelseskoden" });
      }
      return res.json({
        success: true,
        expiresAt: issued.expiresAt,
        maskedEmail: maskEmail(String(invite.email || "")),
      });
    } catch (err) {
      console.error("POST /prototype-tester-invites/:token/signing-code:", err);
      return res.status(500).json({ error: "Kunne ikke sende bekreftelseskoden" });
    }
  });

  // ─── POST /api/prototype-tester-invites/:token/accept ───────
  app.post("/api/prototype-tester-invites/:token/accept", async (req, res) => {
    try {
      const body = req.body ?? {};
      const ndaName = typeof body.ndaName === "string" ? body.ndaName.trim() : "";
      const acceptedProgramTerms = body.acceptedProgramTerms === true;
      const programTermsVersion = typeof body.programTermsVersion === "string" ? body.programTermsVersion : PROGRAM_TERMS_VERSION;
      const acceptedAgreements = body.acceptedAgreements && typeof body.acceptedAgreements === "object"
        ? body.acceptedAgreements as Record<string, unknown>
        : {};
      const submittedVersions: Record<string, unknown> = body.agreementVersions && typeof body.agreementVersions === "object"
        ? body.agreementVersions as Record<string, unknown>
        : { program_terms: programTermsVersion };
      const confirmedSigningAuthority = body.confirmedSigningAuthority === true;
      const verificationCode = typeof body.verificationCode === "string"
        ? body.verificationCode.trim()
        : "";

      if (
        ndaName.length < 2 ||
        ndaName.length > MAX_NAME_LENGTH ||
        DISALLOWED_SINGLE_LINE_CHARS.test(ndaName)
      ) {
        return res.status(400).json({ error: "Fullt navn må være mellom 2 og 200 tegn" });
      }
      const missingAgreements = AGREEMENT_KEYS.filter((key) => acceptedAgreements[key] !== true);
      if (!acceptedProgramTerms || missingAgreements.length > 0 || !confirmedSigningAuthority) {
        return res.status(400).json({
          error: "Du må godta alle fire dokumentene før tilgangen kan aktiveres",
          missingAgreements,
          signingAuthorityRequired: !confirmedSigningAuthority,
        });
      }

      await ensureSchema(pool);
      const existing = await pool.query(
        `SELECT * FROM prototype_tester_invites WHERE token = $1 LIMIT 1`,
        [req.params.token],
      );
      if (!existing.rows.length) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      const inv = existing.rows[0];
      const activationRetry =
        inv.status === "accepted" && Boolean(inv.agreement_digest) && !inv.provisioned_user_id;
      if (inv.status !== "pending" && !activationRetry) {
        return res.status(409).json({ error: "Invitasjon er allerede " + inv.status });
      }
      if (!activationRetry && new Date(inv.expires_at).getTime() < Date.now()) {
        await pool.query(
          `UPDATE prototype_tester_invites SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [inv.id],
        );
        return res.status(410).json({ error: "Invitasjon har utløpt — kontakt daniel@creatorhubn.com for ny" });
      }

      const expectedVersions = agreementVersionsForRow(inv);
      const mismatchedVersions = AGREEMENT_KEYS.filter(
        (key) => String(submittedVersions[key] || "") !== expectedVersions[key],
      );
      if (mismatchedVersions.length > 0) {
        return res.status(409).json({
          error: "Avtaledokumentene er oppdatert. Last siden på nytt før du signerer.",
          mismatchedVersions,
        });
      }
      const agreementDocuments = buildAgreementsForRow(inv);

      const storedSnapshot = parseAgreementSnapshot(inv.accepted_agreements_snapshot);
      if (
        activationRetry &&
        (!storedSnapshot || agreementSnapshotDigest(storedSnapshot) !== String(inv.agreement_digest))
      ) {
        return res.status(409).json({
          error: "Det lagrede signeringsbeviset kunne ikke verifiseres. Kontakt CreatorHub.",
        });
      }

      const ip = requestIp(req);
      let startsAt = activationRetry && inv.program_started_at
        ? new Date(inv.program_started_at)
        : new Date();
      let acceptedAt = activationRetry && inv.accepted_at
        ? new Date(inv.accepted_at).toISOString()
        : startsAt.toISOString();
      const effectiveSignerName = activationRetry
        ? String(inv.accepted_nda_name || ndaName)
        : ndaName;
      const userAgent = String(req.headers["user-agent"] || "").slice(0, 1000) || null;
      let emailVerifiedAt = activationRetry && inv.email_verified_at
        ? new Date(inv.email_verified_at).toISOString()
        : "";
      if (!activationRetry) {
        if (!new RegExp(`^\\d{${SIGNING_CODE_LENGTH}}$`).test(verificationCode)) {
          return res.status(400).json({ error: "Skriv inn den sekssifrede koden fra e-posten" });
        }
        if (!verifySigningCode) {
          return res.status(503).json({ error: "E-postbekreftelse er midlertidig utilgjengelig" });
        }
        const verification = await verifySigningCode({
          recipientEmail: String(inv.email || ""),
          code: verificationCode,
        });
        if (!verification.ok) {
          const status = verification.reason === "expired"
            ? 410
            : verification.reason === "max_attempts"
              ? 429
              : verification.reason === "wrong_code"
                ? 401
                : 400;
          const messages: Record<string, string> = {
            not_found: "Be om en bekreftelseskode før du signerer",
            expired: "Bekreftelseskoden har utløpt. Be om en ny kode.",
            used: "Bekreftelseskoden er allerede brukt. Be om en ny kode.",
            wrong_code: "Bekreftelseskoden er ikke riktig",
            max_attempts: "For mange forsøk. Be om en ny bekreftelseskode.",
          };
          return res.status(status).json({
            error: messages[verification.reason || "not_found"],
            reason: verification.reason,
            attemptsRemaining: verification.attemptsRemaining,
          });
        }
        emailVerifiedAt = verification.verifiedAt || new Date().toISOString();
        // Den juridiske aksepten skal tidsmessig følge e-postkontrollen, ikke
        // se ut som om den skjedde noen millisekunder før kontrollen.
        startsAt = new Date();
        acceptedAt = startsAt.toISOString();
      }
      const agreementSnapshot = activationRetry
        ? storedSnapshot
        : buildAgreementSnapshot(
            agreementDocuments,
            inv,
            effectiveSignerName,
            acceptedAt,
            emailVerifiedAt,
          );
      const agreementDigest = activationRetry
        ? String(inv.agreement_digest)
        : agreementSnapshotDigest(agreementSnapshot);
      let endsAt = activationRetry && inv.program_ends_at
        ? new Date(inv.program_ends_at)
        : new Date(startsAt.getTime() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000);

      // Slice 9X.56 — Aligned team-end-date: hvis dette er et team-medlem,
      // arv master's program_ends_at slik at alle slutter samtidig.
      const masterId = inv.master_invite_id;
      if (!activationRetry && masterId) {
        const masterR = await pool.query(
          `SELECT program_ends_at FROM prototype_tester_invites WHERE id = $1 AND status = 'accepted' LIMIT 1`,
          [masterId],
        );
        if (masterR.rowCount > 0 && masterR.rows[0].program_ends_at) {
          endsAt = new Date(masterR.rows[0].program_ends_at);
        }
      }

      let acceptedInvite = inv;
      if (!activationRetry) {
        const upd = await pool.query(
        `UPDATE prototype_tester_invites
           SET status = 'accepted',
               accepted_at = $2,
               accepted_nda_name = $1,
               accepted_program_terms = true,
               accepted_dpa = true,
               accepted_letter_of_intent = true,
               accepted_ip = $3,
               accepted_user_agent = $4,
               confirmed_signing_authority = true,
               accepted_agreements_snapshot = $5::jsonb,
               agreement_digest = $6,
               program_started_at = $7,
               program_ends_at = $8,
               signature_method = 'email_otp_typed_name',
               email_verified_at = $9,
               signing_receipt_id = COALESCE(signing_receipt_id, gen_random_uuid()),
               updated_at = NOW()
           WHERE id = $10 AND status = 'pending'
         RETURNING *`,
        [
          effectiveSignerName.slice(0, 200),
          acceptedAt,
          ip,
          userAgent,
          JSON.stringify(agreementSnapshot),
          agreementDigest,
          startsAt,
          endsAt,
          emailVerifiedAt,
          inv.id,
        ],
      );
        if (!upd.rows.length) {
          return res.status(409).json({ error: "Invitasjonen er allerede akseptert" });
        }
        acceptedInvite = upd.rows[0];
      }

      // Opprett brukerkonto for testeren (master/medlem) ved aksept, så de
      // faktisk har en konto med matchende e-post å logge inn med (Google OAuth /
      // e-post-match → gjenkjennes som tester). Ved feil beholdes aksepten, og tokenet kan brukes til trygg aktiveringsretry.
      let accountUserId: string | null = null;
      await pool.query(
        `UPDATE prototype_tester_invites
            SET account_provisioning_attempt_count = COALESCE(account_provisioning_attempt_count, 0) + 1,
                account_provisioning_last_attempt_at = NOW(),
                account_provisioning_error = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [acceptedInvite.id],
      );
      if (provisionTesterAccount) {
        try {
          const acct = await provisionTesterAccount(
            String(acceptedInvite.email || ""),
            effectiveSignerName,
            acceptedInvite.member_profession || null,
            acceptedInvite.member_company || null,
            acceptedInvite.member_organization_number || null,
          );
          accountUserId = acct?.id ? String(acct.id) : null;
        } catch (acctErr) {
          console.error("[prototype-tester accept] account provisioning failed", acctErr);
        }
      }

      if (!accountUserId) {
        await pool.query(
          `UPDATE prototype_tester_invites
              SET account_provisioning_error = 'account_provisioning_failed',
                  updated_at = NOW()
            WHERE id = $1`,
          [acceptedInvite.id],
        ).catch(() => undefined);
        return res.status(503).json({
          error:
            "Avtalene er registrert, men kontoen kunne ikke aktiveres. Prøv igjen om litt.",
          agreementsAccepted: true,
          accountCreated: false,
          retryable: true,
        });
      }

      const provisioned = await pool.query(
        `UPDATE prototype_tester_invites
            SET provisioned_user_id = $1,
                provisioned_at = COALESCE(provisioned_at, NOW()),
                account_provisioning_error = NULL,
                updated_at = NOW()
          WHERE id = $2
        RETURNING *`,
        [accountUserId, acceptedInvite.id],
      );
      if (provisioned.rows.length) acceptedInvite = provisioned.rows[0];

      if (acceptedInvite.invite_request_id) {
        await pool.query(
          `UPDATE invite_requests
              SET registered_user_id = COALESCE(registered_user_id, $2),
                  onboarding_started_at = COALESCE(onboarding_started_at, $1),
                  onboarding_completed_at = COALESCE(onboarding_completed_at, $1),
                  onboarding_step = GREATEST(COALESCE(onboarding_step, 0), 4),
                  user_journey_status = 'active',
                  updated_at = NOW()
            WHERE id = $3`,
          [acceptedAt, accountUserId, acceptedInvite.invite_request_id],
        ).catch((journeyError: unknown) => {
          console.warn("[prototype-tester accept] could not mark journey active", journeyError);
        });
      }

      let accessActivatedEmailDelivery: PrototypeTesterEmailDelivery | null = null;
      if (accountUserId && sendAccessActivatedEmail) {
        try {
          await pool.query(
            `UPDATE prototype_tester_invites
                SET access_email_attempt_count = COALESCE(access_email_attempt_count, 0) + 1,
                    access_email_last_attempt_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1`,
            [acceptedInvite.id],
          );
          accessActivatedEmailDelivery = await sendAccessActivatedEmail({
            recipientEmail: String(acceptedInvite.email || ""),
            recipientName: effectiveSignerName,
            loginUrl: `${safeAppBaseUrl(req)}/login?redirect=${encodeURIComponent(
              dashboardForProfession(acceptedInvite.member_profession || null),
            )}`,
            inviteRequestId: acceptedInvite.invite_request_id
              ? String(acceptedInvite.invite_request_id)
              : null,
            inviteId: String(acceptedInvite.id),
            profession: acceptedInvite.member_profession || null,
            company: acceptedInvite.member_company || null,
            programEndsAt: acceptedInvite.program_ends_at || endsAt,
          });
          await pool.query(
            `UPDATE prototype_tester_invites
                SET access_email_sent_at = CASE
                      WHEN $2::boolean THEN COALESCE(access_email_sent_at, NOW())
                      ELSE access_email_sent_at
                    END,
                    access_email_provider = $3,
                    access_email_message_id = $4,
                    access_email_delivery_reason = $5,
                    updated_at = NOW()
              WHERE id = $1`,
            [
              acceptedInvite.id,
              accessActivatedEmailDelivery.sent,
              accessActivatedEmailDelivery.provider,
              accessActivatedEmailDelivery.messageId,
              accessActivatedEmailDelivery.reason,
            ],
          );
        } catch (emailError) {
          console.error(
            "[prototype-tester accept] access-activated email failed",
            emailError,
          );
          await pool.query(
            `UPDATE prototype_tester_invites
                SET access_email_delivery_reason = 'access_delivery_exception',
                    updated_at = NOW()
              WHERE id = $1`,
            [acceptedInvite.id],
          ).catch(() => undefined);
        }
      }

      let receiptEmailDelivery: PrototypeTesterEmailDelivery | null = null;
      const receiptId = String(acceptedInvite.signing_receipt_id || "");
      if (receiptId && sendReceiptEmail && !acceptedInvite.receipt_email_sent_at) {
        try {
          await pool.query(
            `UPDATE prototype_tester_invites
                SET receipt_email_attempt_count = COALESCE(receipt_email_attempt_count, 0) + 1,
                    receipt_email_last_attempt_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1`,
            [acceptedInvite.id],
          );
          const agreementsUrl = `${safeAppBaseUrl(req)}/login?redirect=${encodeURIComponent("/mine-avtaler")}`;
          receiptEmailDelivery = await sendReceiptEmail({
            recipientEmail: String(acceptedInvite.email || ""),
            recipientName: effectiveSignerName,
            agreementsUrl,
            receiptId,
            agreementDigest,
            acceptedAt,
            programEndsAt: acceptedInvite.program_ends_at || endsAt,
            inviteId: String(acceptedInvite.id),
            company: acceptedInvite.member_company || null,
          });
          await pool.query(
            `UPDATE prototype_tester_invites
                SET receipt_email_sent_at = CASE
                      WHEN $2::boolean THEN COALESCE(receipt_email_sent_at, NOW())
                      ELSE receipt_email_sent_at
                    END,
                    receipt_email_provider = $3,
                    receipt_email_message_id = $4,
                    receipt_email_delivery_reason = $5,
                    updated_at = NOW()
              WHERE id = $1`,
            [
              acceptedInvite.id,
              receiptEmailDelivery.sent,
              receiptEmailDelivery.provider,
              receiptEmailDelivery.messageId,
              receiptEmailDelivery.reason,
            ],
          );
          if (receiptEmailDelivery.sent) {
            acceptedInvite.receipt_email_sent_at = new Date().toISOString();
          }
        } catch (emailError) {
          console.error("[prototype-tester accept] receipt email failed", emailError);
          receiptEmailDelivery = {
            sent: false,
            provider: null,
            reason: "receipt_delivery_exception",
            messageId: null,
          };
          await pool.query(
            `UPDATE prototype_tester_invites
                SET receipt_email_delivery_reason = $2,
                    updated_at = NOW()
              WHERE id = $1`,
            [acceptedInvite.id, receiptEmailDelivery.reason],
          ).catch(() => undefined);
        }
      }

      res.json({
        success: true,
        invite: rowToInvite(acceptedInvite),
        accountCreated: !!accountUserId,
        accessActivatedEmailDelivery,
        receiptEmailDelivery,
        receipt: {
          id: receiptId,
          agreementDigest,
          agreementsUrl: "/mine-avtaler",
          downloadUrl: receiptId
            ? `/api/prototype-tester-agreements/${encodeURIComponent(receiptId)}/receipt.pdf`
            : null,
        },
        message: "Velkommen som prototype-tester!",
      });
    } catch (err) {
      console.error("POST /prototype-tester-invites/:token/accept:", err);
      res.status(500).json({ error: "Kunne ikke signere — prøv igjen" });
    }
  });

  // Innlogget avtaleoversikt. E-postmatching gjør at historiske aksepter kan
  // gjenfinnes etter at en eksisterende CreatorHub-konto blir knyttet til dem.
  app.get("/api/prototype-tester-agreements/receipts/:receiptId/verify", async (req, res) => {
    const receiptId = String(req.params.receiptId || "").trim().toLowerCase();
    const digest = String(req.query?.digest || "").trim().toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(receiptId) ||
      !/^[a-f0-9]{64}$/.test(digest)
    ) {
      return res.status(400).json({ valid: false, error: "Ugyldig kontrollreferanse" });
    }
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `SELECT signing_receipt_id, agreement_digest, accepted_at,
                signature_method, email_verified_at, accepted_agreements_snapshot
           FROM prototype_tester_invites
          WHERE signing_receipt_id = $1
            AND agreement_digest = $2
            AND status = 'accepted'
          LIMIT 1`,
        [receiptId, digest],
      );
      const row = result.rows[0];
      const snapshot = row
        ? parseAgreementSnapshot(row.accepted_agreements_snapshot)
        : null;
      if (!row || !snapshot || !isPrototypeTesterReceiptSnapshotValid(snapshot, digest)) {
        return res.status(404).json({ valid: false, error: "Kvitteringen kunne ikke verifiseres" });
      }
      const documents = Array.isArray(snapshot.documents) ? snapshot.documents : [];
      return res.json({
        valid: true,
        receiptId,
        acceptedAt: row.accepted_at,
        signatureMethod: row.signature_method,
        emailVerified: Boolean(row.email_verified_at),
        archiveFormat: "PDF/A-2b",
        documentCount: documents.length,
        documents: documents.map((document: any) => ({
          key: String(document.key || ""),
          title: String(document.title || ""),
          version: String(document.version || ""),
          bindingNature: document.bindingNature === "non_binding" ? "non_binding" : "binding",
        })),
      });
    } catch (error) {
      console.error("GET /prototype-tester-agreements/receipts/:receiptId/verify:", error);
      return res.status(500).json({ valid: false, error: "Kontrollen er midlertidig utilgjengelig" });
    }
  });

  app.get("/api/prototype-tester-agreements/me", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `SELECT id, email, accepted_nda_name, accepted_at, program_ends_at,
                signature_method, email_verified_at, signing_receipt_id,
                agreement_digest, accepted_agreements_snapshot
           FROM prototype_tester_invites
          WHERE status = 'accepted'
            AND agreement_digest IS NOT NULL
            AND signing_receipt_id IS NOT NULL
            AND (
              provisioned_user_id::text = $1
              OR LOWER(email) = LOWER($2)
            )
          ORDER BY accepted_at DESC
          LIMIT 100`,
        [String(session.userId || ""), String(session.email || "")],
      );
      return res.json({
        agreements: result.rows.map((row: any) => {
          const snapshot = parseAgreementSnapshot(row.accepted_agreements_snapshot);
          const receiptId = String(row.signing_receipt_id);
          return {
            id: String(row.id),
            title: "Prototype-testeravtaler",
            status: "signed",
            signerName: row.accepted_nda_name || snapshot?.signerName || null,
            signerEmail: row.email,
            acceptedAt: row.accepted_at,
            programEndsAt: row.program_ends_at,
            signatureMethod: row.signature_method || "typed_name_legacy",
            emailVerifiedAt: row.email_verified_at || null,
            receiptId,
            agreementDigest: row.agreement_digest,
            integrityVerified: isPrototypeTesterReceiptSnapshotValid(
              snapshot,
              row.agreement_digest,
            ),
            receiptDownloadUrl: `/api/prototype-tester-agreements/${encodeURIComponent(receiptId)}/receipt.pdf`,
          };
        }),
      });
    } catch (err) {
      console.error("GET /prototype-tester-agreements/me:", err);
      return res.status(500).json({ error: "Kunne ikke hente signerte avtaler" });
    }
  });

  app.get("/api/prototype-tester-agreements/:receiptId/receipt.pdf", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const receiptId = String(req.params.receiptId || "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(receiptId)) {
      return res.status(400).json({ error: "Ugyldig kvitterings-ID" });
    }
    try {
      await ensureSchema(pool);
      const result = await pool.query(
        `SELECT *
           FROM prototype_tester_invites
          WHERE signing_receipt_id = $1
            AND status = 'accepted'
            AND agreement_digest IS NOT NULL
          LIMIT 1`,
        [receiptId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Kvittering ikke funnet" });
      const row = result.rows[0];
      const role = String(session.role || "").trim().toLowerCase();
      const ownsReceipt =
        String(row.provisioned_user_id || "") === String(session.userId || "") ||
        String(row.email || "").trim().toLowerCase() === String(session.email || "").trim().toLowerCase();
      if (!ownsReceipt && role !== "admin" && role !== "super_admin") {
        return res.status(403).json({ error: "Du har ikke tilgang til denne kvitteringen" });
      }
      const snapshot = parseAgreementSnapshot(row.accepted_agreements_snapshot);
      if (!snapshot || !isPrototypeTesterReceiptSnapshotValid(snapshot, row.agreement_digest)) {
        return res.status(409).json({
          error: "Det lagrede signeringsbeviset kunne ikke verifiseres",
        });
      }
      const pdf = await buildPrototypeTesterSigningReceiptPdf({
        receiptId,
        inviteId: String(row.id),
        snapshot,
        agreementDigest: String(row.agreement_digest),
        signatureMethod: row.signature_method || null,
        emailVerifiedAt: row.email_verified_at || null,
        programEndsAt: row.program_ends_at || null,
        verificationUrl: `${safeAppBaseUrl(req)}/prototype-tester/verify-receipt?receipt=${encodeURIComponent(receiptId)}&digest=${encodeURIComponent(String(row.agreement_digest))}`,
      });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="creatorhub-signeringskvittering-${receiptId}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, noarchive",
      });
      return res.end(pdf);
    } catch (err) {
      console.error("GET /prototype-tester-agreements/:receiptId/receipt.pdf:", err);
      return res.status(500).json({ error: "Kunne ikke lage signeringskvitteringen" });
    }
  });

  // ─── GET /api/prototype-tester-invites/me/status ────────────
  // Innlogget bruker: er jeg en aktiv prototype-tester?
  app.get("/api/prototype-tester-invites/me/status", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.json({ isTester: false });
      await ensureSchema(pool);
      // Heuristikk: matcher e-post mot innlogget bruker
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (!userR.rows.length || !userR.rows[0].email) return res.json({ isTester: false });
      const email = String(userR.rows[0].email).toLowerCase();
      const inv = await pool.query(
        `SELECT * FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted'
            AND program_ends_at > NOW()
          ORDER BY program_started_at DESC LIMIT 1`,
        [email],
      );
      if (!inv.rows.length) return res.json({ isTester: false });
      const row = inv.rows[0];
      // Side-effekt: oppdater last_login_at idempotent
      await pool.query(
        `UPDATE prototype_tester_invites SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      ).catch(() => undefined);
      const daysRemaining = Math.max(0, Math.ceil((new Date(row.program_ends_at).getTime() - Date.now()) / (24 * 3600 * 1000)));
      const daysInProgram = Math.max(0, Math.ceil((Date.now() - new Date(row.program_started_at).getTime()) / (24 * 3600 * 1000)));
      const monthsElapsed = Math.max(1, Math.ceil(daysInProgram / 30));
      const expectedFeedbacks = monthsElapsed * 4;
      res.json({
        isTester: true,
        inviteId: row.id,
        programStartedAt: row.program_started_at,
        programEndsAt: row.program_ends_at,
        daysRemaining,
        feedbackCount: row.feedback_count,
        expectedFeedbacks,
        isOnTrack: row.feedback_count >= expectedFeedbacks * 0.7,
        benefitGranted: row.benefit_granted,
        grantedPlan: row.granted_plan || "tester_all_access",
        grantedFeatures: row.granted_features || [],
        teamRole: row.team_role || "individual",
        masterInviteId: row.master_invite_id || null,
        maxTeamSize: row.max_team_size || 1,
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites/me/status:", err);
      res.json({ isTester: false });
    }
  });

  // ─── GET /api/prototype-tester-invites/me/team ──────────────
  // Slice 9X.56 — Master ser sitt team: medlemmer + plasser igjen.
  app.get("/api/prototype-tester-invites/me/team", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (!userR.rows.length) return res.status(404).json({ error: "Bruker ikke funnet" });
      const email = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id, max_team_size, team_role, program_ends_at, granted_plan, granted_features
           FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          ORDER BY program_started_at DESC LIMIT 1`,
        [email],
      );
      if (!masterR.rows.length) {
        return res.json({ isMaster: false, members: [], slotsRemaining: 0, maxTeamSize: 0 });
      }
      const master = masterR.rows[0];

      const membersR = await pool.query(
        `SELECT id, email, name, status, accepted_at, created_at, program_ends_at, member_profession
           FROM prototype_tester_invites
          WHERE master_invite_id = $1
          ORDER BY created_at ASC`,
        [master.id],
      );
      const usedSlots = membersR.rowCount + 1; // +1 = master selv
      const slotsRemaining = Math.max(0, master.max_team_size - usedSlots);
      res.json({
        isMaster: true,
        masterId: master.id,
        maxTeamSize: master.max_team_size,
        slotsRemaining,
        sharedProgramEndsAt: master.program_ends_at,
        members: membersR.rows.map((r: any) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          status: r.status,
          invitedAt: r.created_at,
          acceptedAt: r.accepted_at,
          programEndsAt: r.program_ends_at,
          profession: r.member_profession || null,
        })),
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites/me/team:", err);
      res.status(500).json({ error: "Kunne ikke hente team" });
    }
  });

  // ─── POST /api/prototype-tester-invites/me/team/invite ──────
  // Master inviterer team-medlem. Arver granted_plan, granted_features og
  // sharedProgramEndsAt automatisk. NDA-e-post sendes hvis mailer er satt.
  app.post("/api/prototype-tester-invites/me/team/invite", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);

      const body = req.body ?? {};
      const memberEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const memberName = typeof body.name === "string" ? body.name.trim() : "";
      const memberProfession = normalizeMemberProfession(body.profession);
      // Firma valgfritt per team-medlem; deler ofte master sitt firma, men lar
      // master overstyre (f.eks. underleverandør). Speiles til users.company_name.
      const memberCompany =
        typeof body.company === "string" && body.company.trim()
          ? body.company.trim().slice(0, 160)
          : null;
      if (!memberEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)) {
        return res.status(400).json({ error: "Gyldig e-post påkrevd" });
      }
      if (!memberName || memberName.length < 2) {
        return res.status(400).json({ error: "Navn påkrevd (min 2 tegn)" });
      }

      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (!userR.rows.length) return res.status(404).json({ error: "Bruker ikke funnet" });
      const masterEmail = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id, max_team_size, granted_plan, granted_features, program_ends_at
           FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          ORDER BY program_started_at DESC LIMIT 1`,
        [masterEmail],
      );
      if (!masterR.rows.length) {
        return res.status(403).json({ error: "Du er ikke registrert som team-master" });
      }
      const master = masterR.rows[0];

      // Sjekk at det er plass igjen
      const countR = await pool.query(
        `SELECT COUNT(*)::int AS used FROM prototype_tester_invites WHERE master_invite_id = $1`,
        [master.id],
      );
      const usedSlots = countR.rows[0].used + 1; // +1 for master selv
      if (usedSlots >= master.max_team_size) {
        return res.status(409).json({ error: "Teamet er fullt — du har brukt alle plassene" });
      }

      // Sjekk for duplikat på e-post
      const dup = await pool.query(
        `SELECT id FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status IN ('pending','accepted')
          LIMIT 1`,
        [memberEmail],
      );
      if ((dup.rowCount ?? 0) > 0) {
        return res.status(409).json({ error: "Denne e-posten har allerede en aktiv invitasjon" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      const ins = await pool.query(
        `INSERT INTO prototype_tester_invites
           (token, email, name, nda_version, program_terms_version, dpa_version,
            letter_of_intent_version, expires_at, invited_by, granted_plan,
            granted_features, team_role, master_invite_id, max_team_size,
            member_profession, member_company)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, 'member', $12, 1, $13, $14)
         RETURNING id, token`,
        [
          token,
          memberEmail,
          memberName,
          NDA_VERSION,
          PROGRAM_TERMS_VERSION,
          DPA_VERSION,
          LETTER_OF_INTENT_VERSION,
          expiresAt.toISOString(),
          uid,
          master.granted_plan,
          JSON.stringify(master.granted_features || []),
          master.id,
          memberProfession,
          memberCompany,
        ],
      );

      const baseUrl = safeAppBaseUrl(req);
      const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(token)}`;

      const teamMessage = `Du har blitt invitert som team-medlem. Når du aksepterer avtalegrunnlaget blir du del av det aktive prototype-tester-teamet (program slutter ${new Date(master.program_ends_at).toLocaleDateString("nb-NO")}).`;
      const emailDelivery = await deliverInviteEmail(
        pool,
        memberEmail,
        memberName,
        inviteUrl,
        teamMessage,
        "Du er invitert som prototype-tester (team-medlem)",
        "prototype_tester_team_invite",
        uid,
        null,
        buildInviteTrackUrls(baseUrl, token),
      );

      res.status(201).json({
        id: ins.rows[0].id,
        token: ins.rows[0].token,
        inviteUrl,
        sharedProgramEndsAt: master.program_ends_at,
        mailerConfigured: isTransactionalEmailConfigured(),
        emailDelivery,
      });
    } catch (err) {
      console.error("POST /me/team/invite:", err);
      res.status(500).json({ error: "Kunne ikke invitere team-medlem" });
    }
  });

  // ─── DELETE /api/prototype-tester-invites/me/team/:memberId ───
  // Master kan trekke tilbake en team-invitasjon FØR medlemmet har signert.
  app.delete("/api/prototype-tester-invites/me/team/:memberId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (!userR.rows.length) return res.status(404).json({ error: "Bruker ikke funnet" });
      const email = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          LIMIT 1`,
        [email],
      );
      if (!masterR.rows.length) return res.status(403).json({ error: "Du er ikke team-master" });

      // Bare trekk tilbake hvis medlemmet ennå ikke har signert
      const del = await pool.query(
        `DELETE FROM prototype_tester_invites
          WHERE id = $1 AND master_invite_id = $2 AND status = 'pending'
        RETURNING id`,
        [req.params.memberId, masterR.rows[0].id],
      );
      if (del.rowCount === 0) {
        return res.status(404).json({ error: "Fant ikke ventende invitasjon — kan ikke trekke tilbake etter signering" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /me/team/:memberId:", err);
      res.status(500).json({ error: "Kunne ikke trekke tilbake" });
    }
  });
}
