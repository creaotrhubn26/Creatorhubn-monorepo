/**
 * Avtalesignering og kundeoversikt.
 *
 * Databehandleravtalen er ikke valgfri. Leadgrid behandler personopplysninger
 * på kundens vegne — kontaktpersoner hos leads — og da er vi databehandler
 * etter GDPR artikkel 28. Avtalen SKAL foreligge før behandlingen starter.
 *
 * Derfor blokkerer den manglende DPA-en ikke innlogging, men den flagges
 * tydelig i oversikten: en kunde som kjører Discovery uten signert
 * databehandleravtale er et avvik du må kunne se med én gang.
 */
import { createHash } from "node:crypto";

import type { Pool } from "pg";

export type AgreementType = "dpa" | "loi" | "terms" | "privacy";

export const AGREEMENT_LABELS: Record<AgreementType, string> = {
  dpa: "Databehandleravtale",
  loi: "Intensjonsavtale",
  terms: "Generelle vilkår",
  privacy: "Personvernerklæring",
};

/**
 * Avtaleparten.
 *
 * Leadgrid er et produktnavn, ikke et rettssubjekt. En databehandleravtale må
 * navngi et selskap med organisasjonsnummer — ellers vet ikke kunden hvem de
 * har avtale med. Verifisert mot Enhetsregisteret 2026-09-24.
 */
export const PROVIDER = {
  legalName: "Creatorhub AS",
  orgNumber: "937518684",
  address: "Søsterveien 11, 1474 Lørenskog",
} as const;

/**
 * Hvordan underskriften gjengis.
 *
 * Kunden skriver navnet sitt og velger en av tre stiler. Vi lagrer valget,
 * ikke et bilde: da ser signaturen lik ut i kvitteringen, i «Mine avtaler»
 * og i din oversikt, og den kan ikke klippes ut og limes på et annet
 * dokument slik en PNG kan.
 */
export const SIGNATURE_STYLES = ["flyt", "klassisk", "rund"] as const;
export type SignatureStyle = (typeof SIGNATURE_STYLES)[number];

/** Skriftstakkene stilene tegnes med. Delt med klienten så de ser like ut. */
export const SIGNATURE_FONTS: Record<SignatureStyle, string> = {
  flyt: "'Snell Roundhand', 'Apple Chancery', 'Segoe Script', cursive",
  klassisk: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  rund: "'Bradley Hand', 'Comic Sans MS', 'Segoe Print', cursive",
};

/** Sammenligner navn slik et menneske ville: uten doble mellomrom og store bokstaver. */
function likt(a: string, b: string): boolean {
  const normaliser = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  return normaliser(a) === normaliser(b);
}

export interface SignAgreementInput {
  organizationId: string;
  agreementType: AgreementType;
  documentVersion: string;
  /** Selve teksten som ble vist. Hashes, lagres ikke. */
  documentText: string;
  signerName: string;
  signerTitle?: string | null;
  signerEmail: string;
  signedByUserId?: string | null;
  signerIp?: string | null;
  /** Fakturaopplysninger kunden bekreftet i samme steg. */
  confirmedBilling?: Record<string, unknown> | null;
  /** Navnet slik signataren skrev det i underskriftsfeltet. */
  signatureText: string;
  signatureStyle: SignatureStyle;
}

/** Hva som må være signert før vi kan behandle kundens data lovlig. */
export const REQUIRED_AGREEMENT_TYPES: AgreementType[] = ["dpa", "privacy", "loi"];

export function documentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export class AgreementError extends Error {
  constructor(
    readonly code:
      | "missing_signer"
      | "empty_document"
      | "missing_signature"
      | "signature_mismatch"
      | "invalid_signature_style",
    message: string,
  ) {
    super(message);
    this.name = "AgreementError";
  }
}

export async function signAgreement(
  pool: Pool,
  input: SignAgreementInput,
): Promise<{
  id: string;
  signed_at: string;
  document_sha256: string;
  signature_text: string;
  signature_style: SignatureStyle;
}> {
  const navn = input.signerName?.trim();
  const epost = input.signerEmail?.trim().toLowerCase();
  if (!navn || !epost) {
    // Brukerkontoen sier hvem som var innlogget, ikke hvem som forpliktet seg.
    throw new AgreementError(
      "missing_signer",
      "Navn og e-post på den som signerer må fylles ut.",
    );
  }
  if (!input.documentText?.trim()) {
    throw new AgreementError(
      "empty_document",
      "Dokumentteksten mangler — det er den som hashes og utgjør beviset.",
    );
  }
  const signatur = input.signatureText?.trim();
  if (!signatur) {
    throw new AgreementError(
      "missing_signature",
      "Skriv navnet ditt i underskriftsfeltet for å signere.",
    );
  }
  if (!likt(signatur, navn)) {
    // Forebygg feilen i stedet for å forklare den etterpå: en underskrift som
    // ikke stemmer med navnet over er nesten alltid en skrivefeil, og en
    // avtale med to forskjellige navn på seg er vanskelig å rydde opp i.
    throw new AgreementError(
      "signature_mismatch",
      `Underskriften må være det samme navnet som over («${navn}»).`,
    );
  }
  if (!SIGNATURE_STYLES.includes(input.signatureStyle)) {
    throw new AgreementError(
      "invalid_signature_style",
      "Velg en av signaturstilene.",
    );
  }
  const hash = documentHash(input.documentText);
  const rad = await pool.query<{ id: string; signed_at: Date }>(
    `INSERT INTO leadgrid_org_agreements (
       organization_id, agreement_type, document_version, document_sha256,
       signed_by_user_id, signer_name, signer_title, signer_email, signer_ip,
       confirmed_billing,
       provider_legal_name, provider_org_number,
       signature_text, signature_style
     ) VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
     ON CONFLICT (organization_id, agreement_type, document_version)
     DO UPDATE SET signed_at = NOW(),
                   signer_name = EXCLUDED.signer_name,
                   signer_title = EXCLUDED.signer_title,
                   signer_email = EXCLUDED.signer_email,
                   signer_ip = EXCLUDED.signer_ip,
                   confirmed_billing = EXCLUDED.confirmed_billing,
                   signature_text = EXCLUDED.signature_text,
                   signature_style = EXCLUDED.signature_style,
                   receipt_sent_at = NULL
     RETURNING id::text, signed_at`,
    [
      input.organizationId, input.agreementType, input.documentVersion, hash,
      input.signedByUserId ?? null, navn, input.signerTitle ?? null, epost,
      input.signerIp ?? null,
      input.confirmedBilling ? JSON.stringify(input.confirmedBilling) : null,
      PROVIDER.legalName, PROVIDER.orgNumber,
      signatur, input.signatureStyle,
    ],
  );
  return {
    id: rad.rows[0].id,
    signed_at: rad.rows[0].signed_at.toISOString(),
    document_sha256: hash,
    signature_text: signatur,
    signature_style: input.signatureStyle,
  };
}

export interface SignedAgreement {
  agreement_type: AgreementType;
  label: string;
  document_version: string;
  document_sha256: string;
  signed_at: string;
  signer_name: string;
  signer_title: string | null;
  signer_email: string;
  /** Hvem avtalen faktisk ble inngått med, slik det sto da den ble signert. */
  provider_legal_name: string;
  provider_org_number: string;
  signature_text: string | null;
  signature_style: SignatureStyle | null;
  receipt_sent_at: string | null;
}

export async function signedAgreements(
  pool: Pool,
  organizationId: string,
): Promise<SignedAgreement[]> {
  const rader = await pool.query<{
    agreement_type: AgreementType;
    document_version: string;
    document_sha256: string;
    signed_at: Date;
    signer_name: string;
    signer_title: string | null;
    signer_email: string;
    provider_legal_name: string;
    provider_org_number: string;
    signature_text: string | null;
    signature_style: SignatureStyle | null;
    receipt_sent_at: Date | null;
  }>(
    `SELECT DISTINCT ON (agreement_type)
            agreement_type, document_version, document_sha256, signed_at,
            signer_name, signer_title, signer_email,
            provider_legal_name, provider_org_number,
            signature_text, signature_style, receipt_sent_at
       FROM leadgrid_org_agreements
      WHERE organization_id = $1::uuid
      ORDER BY agreement_type, signed_at DESC`,
    [organizationId],
  );
  return rader.rows.map((r) => ({
    agreement_type: r.agreement_type,
    label: AGREEMENT_LABELS[r.agreement_type] ?? r.agreement_type,
    document_version: r.document_version,
    document_sha256: r.document_sha256,
    signed_at: r.signed_at.toISOString(),
    signer_name: r.signer_name,
    signer_title: r.signer_title,
    signer_email: r.signer_email,
    provider_legal_name: r.provider_legal_name,
    provider_org_number: r.provider_org_number,
    signature_text: r.signature_text,
    signature_style: r.signature_style,
    receipt_sent_at: r.receipt_sent_at?.toISOString() ?? null,
  }));
}

/** Kvitteringen gikk ut. Kunden skal kunne se at den ble sendt, ikke bare tro det. */
export async function markReceiptSent(pool: Pool, agreementId: string): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_org_agreements SET receipt_sent_at = NOW() WHERE id = $1::uuid`,
    [agreementId],
  );
}
