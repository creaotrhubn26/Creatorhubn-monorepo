/**
 * client-scope-permissions-service.ts
 *
 * Klient-godkjenning per handling + ToS-aksept (GDPR Art. 7.1 audit trail).
 *
 * Brukes av alle "skriv-handlinger" som krever klient-data eller binder
 * klient-ressurser:
 *   - audience_upload   (POST /tiktok/create-audience)
 *   - crm_event_sync    (POST /tiktok/sync-crm-event)
 *   - plugin_install    (POST /tiktok/install-plugin)
 *   - creator_invitation (planlagt — invitere creator på vegne av klient)
 */

import type { Pool } from "pg";

export type ScopePermissionAction =
  // TikTok (Phase 1 — opprinnelige)
  | "audience_upload"        // bakover-kompat: tiktok_audience_upload
  | "crm_event_sync"         // bakover-kompat: tiktok_crm_event_sync
  | "plugin_install"         // bakover-kompat: tiktok_plugin_install
  | "creator_invitation"     // bakover-kompat: tiktok_creator_invitation
  // TikTok (eksplisitt-prefixed alias)
  | "tiktok_audience_upload"
  | "tiktok_crm_event_sync"
  | "tiktok_plugin_install"
  | "tiktok_creator_invitation"
  // Meta
  | "meta_audience_upload"
  | "meta_capi_sync"
  | "meta_lead_sync"
  // LinkedIn
  | "linkedin_audience_upload"
  | "linkedin_capi_sync"
  | "linkedin_lead_sync"
  // Google Ads
  | "google_customer_match"
  | "google_offline_conversions"
  | "google_enhanced_conversions";

export type ScopePermissionStatus = "pending" | "approved" | "rejected";

export const CURRENT_TERMS_VERSION = "2026-06-10-v2";

export const TERMS_TEXT_NO = `
VILKÅR FOR AT INNHOLDSPRODUSENTEN HANDLER PÅ VEGNE AV DIN BEDRIFT
(versjon ${CURRENT_TERMS_VERSION})

Når du som klient godtar disse vilkårene, gir du The Role Room
(creatorhub-backend-rtbl.onrender.com) — på vegne av din valgte
innholdsprodusent — fullmakt til å handle på dine annonsekontoer
på TikTok, Meta (Facebook + Instagram), LinkedIn og Google Ads.

1. KOBLE OG DRIFTE ANNONSEKONTOENE DINE
   Producer bruker sin egen OAuth-tilkobling til ditt Business
   Center på hver plattform. Du forblir eier av kontoene og kan
   trekke tilgang når som helst.

2. SENDE DATA TIL PLATTFORMENE (kun handlinger DU har godkjent)
   For hver handling under er det en egen "av/på"-bryter du må
   slå på eksplisitt. Bryterne er gruppert per plattform.

   A) MÅLGRUPPE-OPPLASTING
      Gjelder: TikTok Custom Audience, Meta Custom Audience,
      LinkedIn Matched Audience, Google Customer Match.
      E-postlister og telefonnumre du gir tilgang til, blir
      SHA256-kryptert FØR de sendes til plattformen. Plattformen
      bruker hashene til å finne dine eksisterende kunder blant
      sine brukere. Rå-data lagres aldri hos oss.

   B) KONVERTERINGS-SYNC (CAPI / Server-side events)
      Gjelder: TikTok CRM Events, Meta CAPI, LinkedIn Conversions
      API, Google Enhanced/Offline Conversions.
      Når noen registrerer seg, betaler eller avbryter hos dere,
      sender vi en hendelse til plattformen så annonsealgoritmen
      lærer hvilke annonser som faktisk gir salg — ikke bare
      klikk. Vi sender kun event-navn + verdi + hashet e-post.

   C) LEAD-SYNC
      Gjelder: TikTok Lead Ads, Meta Lead Ads, LinkedIn Lead
      Gen Forms. Vi henter leads fra plattformens egne lead-
      former direkte inn i deres CRM. Rådata ligger i plattformen.

   D) NETTSIDE/BUTIKK-KOBLING (kun TikTok)
      Producer kan binde domenet ditt (f.eks. holycrust.no) til
      TikTok Business som plugin. Dette gjør at TikTok-annonser
      kan sende folk rett til kassen.

   E) CREATOR-INVITASJONER (kun TikTok Creator Marketplace)
      Producer kan invitere innholdsskapere til samarbeid med
      din merkevare. Hver avtale går ALLTID gjennom deg for
      endelig godkjenning av pris og innhold.

3. MÅLE OG RAPPORTERE
   Vi henter ad-spend, konverteringer, lead-skjema-svar og
   rapporterings-data fra plattformene og viser det i dette
   dashboardet. Vi videreselger ikke data til tredjeparter.

4. KOSTNADER OG BETALING
   Annonsekostnaden trekkes direkte fra ditt kort/-konto til
   plattformen. Vi tar 20 % management-fee av annonsekostnaden
   per plattform, fakturert månedlig.

5. TILBAKEKALLING
   Du kan når som helst trekke tilbake denne fullmakten ved å
   klikke "Avslutt samarbeid" i dashboardet. Da stopper alle
   automatiske handlinger umiddelbart på alle plattformer.

6. PERSONVERN
   Vi er databehandler for kundedata du gir tilgang til (GDPR
   Art. 28). Vi har egen databehandleravtale du kan be om.
   Vilkår-versjonen lagres som permanent revisjonslogg med
   tidspunkt, IP og brukernavn på den som godkjente.

Ved å bekrefte under, signerer du elektronisk at du har lest
og forstått disse vilkårene. Versjon ${CURRENT_TERMS_VERSION}
lagres som permanent revisjonslogg.
`.trim();

const VALID_ACTIONS = new Set<ScopePermissionAction>([
  // TikTok (legacy keys + prefixed)
  "audience_upload", "crm_event_sync", "plugin_install", "creator_invitation",
  "tiktok_audience_upload", "tiktok_crm_event_sync", "tiktok_plugin_install", "tiktok_creator_invitation",
  // Meta
  "meta_audience_upload", "meta_capi_sync", "meta_lead_sync",
  // LinkedIn
  "linkedin_audience_upload", "linkedin_capi_sync", "linkedin_lead_sync",
  // Google
  "google_customer_match", "google_offline_conversions", "google_enhanced_conversions",
]);

/** Bakover-kompat: gamle nøkler (uten plattform-prefiks) er aliases for tiktok_*. */
const ACTION_ALIASES: Record<string, ScopePermissionAction> = {
  audience_upload: "tiktok_audience_upload",
  crm_event_sync: "tiktok_crm_event_sync",
  plugin_install: "tiktok_plugin_install",
  creator_invitation: "tiktok_creator_invitation",
};

function normalizeAction(action: string): ScopePermissionAction | null {
  if (ACTION_ALIASES[action]) return ACTION_ALIASES[action];
  if (VALID_ACTIONS.has(action as ScopePermissionAction)) return action as ScopePermissionAction;
  return null;
}

/** Sjekker om klient har godkjent en spesifikk handling for denne config-en.
 *  Returnerer { ok: true } hvis approved, ellers { ok: false, status, reason }. */
export async function checkScopePermission(
  pool: Pool,
  configId: string,
  action: ScopePermissionAction,
): Promise<
  | { ok: true }
  | { ok: false; status: ScopePermissionStatus | "missing"; reason: string }
> {
  const normalized = normalizeAction(action);
  if (!normalized) {
    return { ok: false, status: "missing", reason: `Ukjent handling: ${action}` };
  }
  const r = await pool.query(
    `SELECT scope_permissions, authorization_accepted_at, authorization_revoked_at
       FROM client_ads_configs WHERE id = $1::uuid`,
    [configId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = r.rows[0];
  if (!row) return { ok: false, status: "missing", reason: "Klient-config ikke funnet" };
  if (!row.authorization_accepted_at || row.authorization_revoked_at) {
    return {
      ok: false,
      status: "missing",
      reason: "Klient har ikke akseptert vilkårene ennå (eller har trukket dem tilbake).",
    };
  }
  const perms = (row.scope_permissions ?? {}) as Record<string, ScopePermissionStatus>;
  // Sjekk både normalisert nøkkel OG original (bakover-kompat med gamle DB-rader)
  const status = perms[normalized] ?? perms[action];
  if (status === "approved") return { ok: true };
  if (status === "rejected") {
    return { ok: false, status: "rejected", reason: `Klient har avvist denne handlingen: ${action}` };
  }
  return {
    ok: false,
    status: status ?? "missing",
    reason: `Klient har ikke gitt tillatelse til "${action}" ennå.`,
  };
}

/** Klient godtar vilkår + setter per-handling-tillatelser. Lagrer audit-trail. */
export async function acceptScopePermissions(
  pool: Pool,
  opts: {
    configId: string;
    acceptedByUserId: string;
    acceptedByName?: string;
    acceptedByEmail?: string;
    permissions: Partial<Record<ScopePermissionAction, ScopePermissionStatus>>;
    termsVersion?: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<{ ok: true; acceptanceId: string } | { ok: false; error: string }> {
  // Valider + normaliser permissions (alias-kompat)
  const cleanPerms: Record<string, ScopePermissionStatus> = {};
  for (const [k, v] of Object.entries(opts.permissions)) {
    const normalized = normalizeAction(k);
    if (!normalized) continue;
    if (v === "approved" || v === "rejected" || v === "pending") cleanPerms[normalized] = v;
  }

  // Hent client_project_id for audit-trail
  const cfgR = await pool.query(
    `SELECT client_project_id::text FROM client_ads_configs WHERE id = $1::uuid`,
    [opts.configId],
  );
  const projectId = cfgR.rows[0]?.client_project_id;
  if (!projectId) return { ok: false, error: "Klient-config ikke funnet" };

  const termsVersion = opts.termsVersion ?? CURRENT_TERMS_VERSION;

  // Oppdater config + lagre audit-rad
  await pool.query(
    `UPDATE client_ads_configs
        SET scope_permissions = $1::jsonb,
            authorization_terms_version = $2,
            authorization_accepted_at = NOW(),
            authorization_accepted_by_user_id = $3::uuid,
            authorization_revoked_at = NULL,
            updated_at = NOW()
      WHERE id = $4::uuid`,
    [JSON.stringify(cleanPerms), termsVersion, opts.acceptedByUserId, opts.configId],
  );

  const auditR = await pool.query(
    `INSERT INTO client_authorization_acceptances (
       config_id, client_project_id, accepted_by_user_id,
       accepted_by_name, accepted_by_email,
       terms_version, permissions_snapshot, ip_address, user_agent
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb, $8, $9)
     RETURNING id::text`,
    [
      opts.configId,
      projectId,
      opts.acceptedByUserId,
      opts.acceptedByName ?? null,
      opts.acceptedByEmail ?? null,
      termsVersion,
      JSON.stringify(cleanPerms),
      opts.ipAddress ?? null,
      opts.userAgent ?? null,
    ],
  );

  return { ok: true, acceptanceId: auditR.rows[0].id };
}

/** Klient trekker tilbake hele samtykket. Setter alle permissions til 'rejected'. */
export async function revokeScopePermissions(
  pool: Pool,
  opts: {
    configId: string;
    revokedByUserId: string;
    revokeReason?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Marker aktiv acceptance som revoked
  await pool.query(
    `UPDATE client_authorization_acceptances
        SET revoked_at = NOW(),
            revoked_by_user_id = $1::uuid,
            revoke_reason = $2
      WHERE config_id = $3::uuid AND revoked_at IS NULL`,
    [opts.revokedByUserId, opts.revokeReason ?? null, opts.configId],
  );
  // Nullstill config
  await pool.query(
    `UPDATE client_ads_configs
        SET authorization_revoked_at = NOW(),
            scope_permissions = '{}'::jsonb,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [opts.configId],
  );
  return { ok: true };
}

/** Hent gjeldende ToS-tekst + status for én config. */
export async function getScopePermissionsState(
  pool: Pool,
  configId: string,
): Promise<{
  termsVersion: string;
  termsText: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  permissions: Record<string, ScopePermissionStatus>;
  needsReaccept: boolean;
}> {
  const r = await pool.query(
    `SELECT scope_permissions, authorization_terms_version,
            authorization_accepted_at, authorization_revoked_at
       FROM client_ads_configs WHERE id = $1::uuid`,
    [configId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = r.rows[0] ?? {};
  return {
    termsVersion: CURRENT_TERMS_VERSION,
    termsText: TERMS_TEXT_NO,
    acceptedAt: row.authorization_accepted_at ?? null,
    revokedAt: row.authorization_revoked_at ?? null,
    permissions: (row.scope_permissions ?? {}) as Record<string, ScopePermissionStatus>,
    needsReaccept:
      !row.authorization_accepted_at ||
      !!row.authorization_revoked_at ||
      row.authorization_terms_version !== CURRENT_TERMS_VERSION,
  };
}
