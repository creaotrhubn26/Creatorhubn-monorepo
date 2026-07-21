/**
 * Org-bootstrap for hodeløs drift (cron). Den deployede prod-appen har ingen
 * interaktiv innlogging (dev-login er av i produksjon, OIDC/BankID ikke bygd),
 * så automatiske jobber som Stripe-inntektssynk må kunne sikre at organisasjonen
 * + en system-bruker finnes UTEN en menneskelig sesjon.
 *
 * Idempotent: organisasjonen slås opp på organisasjonsnummer, system-brukeren på
 * e-post. Systembrukeren blir «owner» (createOrganization gjør oppretter til owner)
 * og har dermed invoices.manage — nok til å lage utkast-fakturaer i synken.
 */

import { createOrganization, ensureUser } from '../orgs/service.js';
import { ensureProductDimensions } from './products.js';
import { ensureAiAccounts } from './ai-accounts.js';
import type { OrganizationForm, VatRegistrationStatus } from '../rules/types.js';
import type { Db } from '../db/pool.js';

export interface BootstrapOrgConfig {
  name: string;
  orgNumber: string;
  orgForm: OrganizationForm;
  vatStatus: VatRegistrationStatus;
  systemUserEmail: string;
  systemUserName: string;
}

export interface BootstrapResult {
  orgId: string;
  userId: string;
  createdOrg: boolean;
}

export async function ensureBootstrapOrg(
  db: Db,
  config: BootstrapOrgConfig,
): Promise<BootstrapResult> {
  const userId = await ensureUser(db, config.systemUserEmail, config.systemUserName);
  const actor = { userId, role: 'owner' };
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM organizations WHERE org_number = $1`,
    [config.orgNumber],
  );
  if (existing.rows[0]) {
    const orgId = existing.rows[0].id;
    // Produktlinjene + AI-kontoene skal alltid finnes (uavhengig av Stripe).
    await ensureProductDimensions(db, orgId, actor);
    await ensureAiAccounts(db, orgId);
    return { orgId, userId, createdOrg: false };
  }
  const org = await createOrganization(db, {
    name: config.name,
    orgForm: config.orgForm,
    vatStatus: config.vatStatus,
    orgNumber: config.orgNumber,
    createdByUserId: userId,
  });
  await ensureProductDimensions(db, org.id, actor);
  await ensureAiAccounts(db, org.id);
  return { orgId: org.id, userId, createdOrg: true };
}
