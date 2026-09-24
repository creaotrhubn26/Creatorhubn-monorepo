/**
 * Manuell registrering av en bedrift — ni siffer inn, ferdig konto ut.
 *
 * De første kundene onboardes i et møte, ikke via selvbetjening. Sitter du hos
 * kunden skal kontoen stå klar før kaffen er drukket: du skriver org.nr,
 * BRREG fyller resten, og organisasjon, admin-bruker, medlemskap og første
 * kundeprosjekt opprettes i én transaksjon.
 *
 * Alt eller ingenting: en halv konto er verre enn ingen, fordi du da må rydde
 * manuelt foran kunden.
 *
 * Ingen e-post sendes herfra. Du sitter i rommet — admin logger inn med Google
 * eller LinkedIn på stedet, og da er det e-posten som knytter dem til
 * organisasjonen, ikke en magisk lenke som kan bli liggende i en innboks.
 */
import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { lookupCompanyForNewLead } from "./lead-brreg-service.js";
import { setTrialHardLimit } from "./leadgrid-trial.js";

export interface ManualRegistrationInput {
  /** Ni siffer. Mellomrom og punktum tåles. */
  organizationNumber: string;
  /** E-posten admin logger inn med via Google eller LinkedIn. */
  adminEmail: string;
  /** Overstyrer BRREG-navnet. Tomt = bruk registerets navn. */
  organizationName?: string;
  projectName?: string;
  createdByUserId: string;
}

export interface ManualRegistrationResult {
  organization: {
    id: string;
    name: string;
    org_number: string;
    nace_code: string | null;
    city: string | null;
    reused: boolean;
  };
  admin: { id: string; email: string; reused: boolean };
  project: { id: string; name: string };
  trial: { hard_expires_at: string; starts_on_first_discovery: true };
}

export class ManualRegistrationError extends Error {
  constructor(
    readonly code:
      | "invalid_org_number"
      | "company_not_found"
      | "company_bankrupt"
      | "invalid_email",
    message: string,
  ) {
    super(message);
    this.name = "ManualRegistrationError";
  }
}

export function normalizeOrgNumber(raw: string): string | null {
  const siffer = (raw ?? "").replace(/\D/g, "");
  return siffer.length === 9 ? siffer : null;
}

function slugFor(navn: string, orgNr: string): string {
  const base = navn
    .toLocaleLowerCase("nb-NO")
    .replace(/[æ]/g, "ae").replace(/[ø]/g, "o").replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  // Org.nr bakerst gjør slugen unik uten å måtte telle oppover ved kollisjon.
  return `${base || "bedrift"}-${orgNr.slice(-4)}`;
}

export async function registerCompanyManually(
  pool: Pool,
  input: ManualRegistrationInput,
): Promise<ManualRegistrationResult> {
  const orgNr = normalizeOrgNumber(input.organizationNumber);
  if (!orgNr) {
    throw new ManualRegistrationError(
      "invalid_org_number",
      "Organisasjonsnummeret må være ni siffer.",
    );
  }
  const epost = (input.adminEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost)) {
    throw new ManualRegistrationError("invalid_email", "Ugyldig e-postadresse.");
  }

  const oppslag = await lookupCompanyForNewLead(orgNr);
  const firma = oppslag.company;
  if (!oppslag.found || !firma) {
    throw new ManualRegistrationError(
      "company_not_found",
      `Fant ingen bedrift med organisasjonsnummer ${orgNr} i Enhetsregisteret.`,
    );
  }
  if (firma.isBankrupt) {
    // Å opprette en konto for et konkursbo er nesten alltid en tastefeil.
    throw new ManualRegistrationError(
      "company_bankrupt",
      `${firma.name} er registrert som konkurs i Enhetsregisteret. Sjekk nummeret.`,
    );
  }

  const navn = (input.organizationName ?? "").trim() || firma.name;
  const klient = await pool.connect();
  try {
    await klient.query("BEGIN");
    const ut = await opprett(klient, { input, orgNr, navn, firma, epost });
    await klient.query("COMMIT");
    await setTrialHardLimit(pool, ut.organization.id);
    const status = await pool.query<{ trial_hard_expires_at: Date | null }>(
      `SELECT trial_hard_expires_at FROM organizations WHERE id = $1::uuid`,
      [ut.organization.id],
    );
    return {
      ...ut,
      trial: {
        hard_expires_at:
          status.rows[0]?.trial_hard_expires_at?.toISOString() ?? "",
        starts_on_first_discovery: true,
      },
    };
  } catch (error) {
    await klient.query("ROLLBACK");
    throw error;
  } finally {
    klient.release();
  }
}

async function opprett(
  klient: PoolClient,
  ctx: {
    input: ManualRegistrationInput;
    orgNr: string;
    navn: string;
    firma: NonNullable<Awaited<ReturnType<typeof lookupCompanyForNewLead>>["company"]>;
    epost: string;
  },
): Promise<Omit<ManualRegistrationResult, "trial">> {
  const { input, orgNr, navn, firma, epost } = ctx;

  // Samme bedrift skal ikke få to organisasjoner. Org.nr er nøkkelen, ikke navnet.
  const finnesOrg = await klient.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM organizations WHERE org_number = $1 LIMIT 1`,
    [orgNr],
  );
  let orgId = finnesOrg.rows[0]?.id ?? null;
  const orgGjenbrukt = Boolean(orgId);

  // Admin først: organizations.owner_user_id skal peke på en bruker som finnes.
  const finnesBruker = await klient.query<{ id: string }>(
    `SELECT id::text FROM users WHERE lower(email) = $1 LIMIT 1`,
    [epost],
  );
  let adminId = finnesBruker.rows[0]?.id ?? null;
  const adminGjenbrukt = Boolean(adminId);
  if (!adminId) {
    const ny = await klient.query<{ id: string }>(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'user', NOW(), NOW())
       RETURNING id::text`,
      [epost, epost.split("@")[0]],
    );
    adminId = ny.rows[0].id;
  }

  if (!orgId) {
    const ny = await klient.query<{ id: string }>(
      `INSERT INTO organizations (
         id, name, slug, org_type, plan, owner_user_id, contact_email,
         billing_email, org_number, nace_code, nace_description,
         address_line, postal_code, city, country, website,
         status, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, 'customer', 'trial', $3::uuid, $4,
         $4, $5, $6, $7, $8, $9, $10, 'NO', $11,
         'active', NOW(), NOW()
       ) RETURNING id::text`,
      [
        navn, slugFor(navn, orgNr), adminId, epost, orgNr,
        firma.naceCode, firma.naceDescription, firma.address,
        firma.postalCode, firma.city, firma.website,
      ],
    );
    orgId = ny.rows[0].id;
  }

  // Medlemskapet er det som faktisk gir tilgang. Uten det er admin en bruker
  // uten organisasjon, og hele registreringen er uten virkning.
  await klient.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
     VALUES ($1, $2::uuid, $3::uuid, 'admin', NOW())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin'`,
    [randomUUID(), orgId, adminId],
  );

  const prosjektNavn = (input.projectName ?? "").trim() || navn;
  const prosjektId = `${slugFor(prosjektNavn, orgNr)}-${Date.now().toString(36)}`;
  await klient.query(
    `INSERT INTO leadgrid_projects (id, name, organization_id, created_at, updated_at)
     VALUES ($1, $2, $3::uuid, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [prosjektId, prosjektNavn, orgId],
  );

  return {
    organization: {
      id: orgId!,
      name: navn,
      org_number: orgNr,
      nace_code: firma.naceCode,
      city: firma.city,
      reused: orgGjenbrukt,
    },
    admin: { id: adminId!, email: epost, reused: adminGjenbrukt },
    project: { id: prosjektId, name: prosjektNavn },
  };
}
