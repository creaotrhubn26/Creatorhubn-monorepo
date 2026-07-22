import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { STANDARD_ACCOUNTS } from '../coa/accounts.js';
import type { Db, DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { OrganizationForm, VatRegistrationStatus } from '../rules/types.js';
import { ConflictError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

export interface CreateOrganizationInput {
  name: string;
  orgNumber?: string;
  orgForm: OrganizationForm;
  vatStatus: VatRegistrationStatus;
  /** Forretningsadresse — kreves på salgsdokumenter (bokføringsforskriften § 5-1-1). */
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  /** Brukeren som oppretter blir owner. */
  createdByUserId: string;
}

export interface Organization {
  id: string;
  name: string;
  orgForm: OrganizationForm;
  vatStatus: VatRegistrationStatus;
}

/** Validerer norsk organisasjonsnummer (9 sifre, MOD11 med vekter 3,2,7,6,5,4,3,2). */
export function isValidOrgNumber(orgNumber: string): boolean {
  if (!/^\d{9}$/.test(orgNumber)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const digits = orgNumber.split('').map(Number);
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i]!, 0);
  const remainder = sum % 11;
  const control = remainder === 0 ? 0 : 11 - remainder;
  if (control === 10) return false;
  return control === digits[8];
}

export async function createOrganization(
  db: Db,
  input: CreateOrganizationInput,
): Promise<Organization> {
  if (!input.name.trim()) throw new ValidationError('Organisasjonen må ha navn.');
  if (input.orgNumber !== undefined && !isValidOrgNumber(input.orgNumber)) {
    throw new ValidationError(`Ugyldig organisasjonsnummer: ${input.orgNumber}`);
  }
  return withTransaction(db, async (client) => {
    if (input.orgNumber) {
      const dupe = await client.query('SELECT id FROM organizations WHERE org_number = $1', [
        input.orgNumber,
      ]);
      if (dupe.rowCount) {
        throw new ConflictError('Organisasjonsnummeret er allerede registrert.');
      }
    }
    const orgId = newId();
    await client.query(
      `INSERT INTO organizations
         (id, name, org_number, org_form, vat_status, street_address, postal_code, city, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orgId,
        input.name.trim(),
        input.orgNumber ?? null,
        input.orgForm,
        input.vatStatus,
        input.streetAddress?.trim() || null,
        input.postalCode?.trim() || null,
        input.city?.trim() || null,
        input.createdByUserId,
      ],
    );
    await client.query(
      `INSERT INTO memberships (id, organization_id, user_id, role, created_by)
       VALUES ($1,$2,$3,'owner',$3)`,
      [newId(), orgId, input.createdByUserId],
    );
    await client.query(
      `INSERT INTO organization_counters (organization_id, next_entry_number) VALUES ($1, 1)`,
      [orgId],
    );
    // Seed standard kontoplan for organisasjonen.
    for (const account of STANDARD_ACCOUNTS) {
      await client.query(
        `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
         VALUES ($1,$2,$3,$4,$5)`,
        [newId(), orgId, account.number, account.name, account.type],
      );
    }
    const actor: Actor = { userId: input.createdByUserId, role: 'owner' };
    await recordAuditEvent(client, {
      organizationId: orgId,
      actor,
      action: 'organization.created',
      entityType: 'organization',
      entityId: orgId,
      newValue: { name: input.name, orgForm: input.orgForm, vatStatus: input.vatStatus },
    });
    return { id: orgId, name: input.name.trim(), orgForm: input.orgForm, vatStatus: input.vatStatus };
  });
}

export interface OrganizationProfile {
  id: string;
  name: string;
  orgNumber: string | null;
  orgForm: OrganizationForm;
  vatStatus: VatRegistrationStatus;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  vatRegisterCheckedAt: string | null;
  vatRegisterRegistered: boolean | null;
}

export async function getOrganizationProfile(
  db: Db | DbClient,
  organizationId: string,
): Promise<OrganizationProfile> {
  const res = await db.query(
    `SELECT id, name, org_number, org_form, vat_status, street_address, postal_code, city,
            vat_register_checked_at::TEXT AS vat_register_checked_at, vat_register_registered
     FROM organizations WHERE id = $1`,
    [organizationId],
  );
  if (!res.rowCount) throw new ValidationError('Organisasjonen finnes ikke.');
  const r = res.rows[0];
  return {
    id: r.id,
    name: r.name,
    orgNumber: r.org_number,
    orgForm: r.org_form,
    vatStatus: r.vat_status,
    streetAddress: r.street_address,
    postalCode: r.postal_code,
    city: r.city,
    vatRegisterCheckedAt: r.vat_register_checked_at,
    vatRegisterRegistered: r.vat_register_registered,
  };
}

export interface UpdateOrganizationSettingsInput {
  organizationId: string;
  actor: Actor;
  orgNumber?: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  vatStatus?: VatRegistrationStatus;
}

/** Oppdaterer fakturaopplysningene (adresse, org.nr., MVA-status) med revisjonsspor. */
export async function updateOrganizationSettings(
  db: Db,
  input: UpdateOrganizationSettingsInput,
): Promise<OrganizationProfile> {
  if (input.orgNumber !== undefined && !isValidOrgNumber(input.orgNumber)) {
    throw new ValidationError(`Ugyldig organisasjonsnummer: ${input.orgNumber}`);
  }
  return withTransaction(db, async (client) => {
    const before = await client.query(
      `SELECT org_number, street_address, postal_code, city, vat_status
       FROM organizations WHERE id = $1 FOR UPDATE`,
      [input.organizationId],
    );
    if (!before.rowCount) throw new ValidationError('Organisasjonen finnes ikke.');
    if (input.orgNumber !== undefined) {
      const dupe = await client.query(
        `SELECT id FROM organizations WHERE org_number = $1 AND id <> $2`,
        [input.orgNumber, input.organizationId],
      );
      if (dupe.rowCount) throw new ConflictError('Organisasjonsnummeret er allerede registrert.');
    }
    await client.query(
      `UPDATE organizations SET
         org_number = COALESCE($2, org_number),
         street_address = COALESCE($3, street_address),
         postal_code = COALESCE($4, postal_code),
         city = COALESCE($5, city),
         vat_status = COALESCE($6, vat_status),
         updated_at = now(), version = version + 1
       WHERE id = $1`,
      [
        input.organizationId,
        input.orgNumber ?? null,
        input.streetAddress?.trim() || null,
        input.postalCode?.trim() || null,
        input.city?.trim() || null,
        input.vatStatus ?? null,
      ],
    );
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'organization.settings_updated',
      entityType: 'organization',
      entityId: input.organizationId,
      previousValue: before.rows[0],
      newValue: {
        orgNumber: input.orgNumber,
        streetAddress: input.streetAddress,
        postalCode: input.postalCode,
        city: input.city,
        vatStatus: input.vatStatus,
      },
    });
    return getOrganizationProfile(client, input.organizationId);
  });
}

export async function ensureUser(db: Db | DbClient, email: string, displayName: string): Promise<string> {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) return existing.rows[0].id;
  const id = newId();
  await db.query('INSERT INTO users (id, email, display_name) VALUES ($1,$2,$3)', [
    id,
    email,
    displayName,
  ]);
  return id;
}

export async function getMembershipRole(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const res = await db.query(
    `SELECT role FROM memberships
     WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
    [organizationId, userId],
  );
  return res.rowCount ? res.rows[0].role : null;
}
