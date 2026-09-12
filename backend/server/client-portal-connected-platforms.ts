import type { Pool } from "pg";

// Klient-vendt oversikt over hvilke plattformer produsenten faktisk har
// koblet på for prosjektet. Kilden er de autoritative connection-tabellene
// (role_room_{google,linkedin,tiktok,instagram}_connections) — IKKE
// produsentens frontend-accountAccess (som kun lever i localStorage).
//
// VIKTIG: dette endepunktet skal aldri returnere tokens, scopes eller andre
// hemmeligheter. Kun {platform, status, kontonavn, koblet-dato} eksponeres.

export type PlatformKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "google_ads"
  | "google";

export type PlatformStatus =
  | "connected"
  | "expired"
  | "revoked"
  | "error"
  | "not_connected";

export interface ConnectedPlatform {
  platform: PlatformKey;
  label: string;
  status: PlatformStatus;
  /** Visningsnavn på den koblede kontoen (aldri tokens). Null hvis ukjent. */
  accountName: string | null;
  /** ISO-tidspunkt for når koblingen sist ble oppdatert. Null hvis ukjent. */
  connectedAt: string | null;
}

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  google_ads: "Google Ads",
  google: "Google Workspace",
};

// Fast visningsrekkefølge slik at klient-kortet ser likt ut hver gang.
export const PLATFORM_ORDER: PlatformKey[] = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "google_ads",
  "google",
];

// Plattformer som produsenten IKKE har valgt å vise for et nytt prosjekt.
// Google Workspace skjules som standard — den er sjelden relevant for klient-
// selvbetjening (Calendar/Drive/Gmail), og produsenten kan slå den på manuelt.
export const DEFAULT_HIDDEN_PLATFORMS: PlatformKey[] = ["google"];

// Leser produsentens synlighets-overstyring for klientportalen. Ingen rad =
// standard (DEFAULT_HIDDEN_PLATFORMS). Produsenten styrer dette per prosjekt.
export async function loadClientPortalHiddenPlatforms(
  pool: Pool,
  projectId: string,
): Promise<Set<PlatformKey>> {
  try {
    const res = await pool.query(
      `SELECT hidden_platforms FROM role_room_client_portal_settings
        WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    const row = res.rows[0];
    if (!row) return new Set(DEFAULT_HIDDEN_PLATFORMS);
    const raw = Array.isArray(row.hidden_platforms) ? row.hidden_platforms : [];
    return new Set(
      raw.filter((p: unknown): p is PlatformKey =>
        typeof p === "string" && p in PLATFORM_LABELS,
      ),
    );
  } catch {
    // Tabellen mangler / DB-feil: degrader til standard, aldri velt portalen.
    return new Set(DEFAULT_HIDDEN_PLATFORMS);
  }
}

// Lagrer produsentens synlighets-valg. Lagrer SKJULTE plattformer (hvitt = vis).
export async function setClientPortalHiddenPlatforms(
  pool: Pool,
  projectId: string,
  hidden: PlatformKey[],
  updatedBy: string | null,
): Promise<void> {
  const clean = Array.from(
    new Set(hidden.filter((p) => p in PLATFORM_LABELS)),
  );
  await pool.query(
    `INSERT INTO role_room_client_portal_settings (project_id, hidden_platforms, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (project_id) DO UPDATE SET
       hidden_platforms = EXCLUDED.hidden_platforms,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [projectId, JSON.stringify(clean), updatedBy],
  );
}

interface RawConnection {
  connectionState?: string | null;
  expiryDate?: Date | string | null;
  accountName?: string | null;
  updatedAt?: Date | string | null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Oversetter en rå connection_state (+ utløpsdato) til en klient-vennlig
 * status. Ren funksjon — enhetstestbar uten database.
 */
export function normalizeConnectionStatus(
  raw: RawConnection | null | undefined,
  now: Date = new Date(),
): PlatformStatus {
  if (!raw) return "not_connected";
  const state = String(raw.connectionState ?? "").toLowerCase().trim();

  if (state === "" || state === "disconnected") return "not_connected";

  if (state === "connected") {
    const expiry = raw.expiryDate ? new Date(raw.expiryDate) : null;
    if (expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() <= now.getTime()) {
      return "expired";
    }
    return "connected";
  }

  if (state === "expired" || state === "revoked" || state === "error") {
    return state;
  }

  // Ukjent state — behandle konservativt som ikke koblet.
  return "not_connected";
}

function buildPlatform(
  platform: PlatformKey,
  raw: RawConnection | null,
  now: Date,
): ConnectedPlatform {
  const status = normalizeConnectionStatus(raw, now);
  return {
    platform,
    label: PLATFORM_LABELS[platform],
    status,
    accountName: status === "not_connected" ? null : raw?.accountName ?? null,
    connectedAt: status === "not_connected" ? null : toIso(raw?.updatedAt),
  };
}

// Defensiv query-hjelper: hvis en connection-tabell ikke finnes (f.eks. en
// DB der migrasjonen ikke har kjørt), returnerer vi null i stedet for å
// krasje hele endepunktet. Klienten ser da bare «ikke koblet» for plattformen.
async function safeQueryFirst(
  pool: Pool,
  sql: string,
  params: unknown[],
): Promise<RawConnection | null> {
  try {
    const { rows } = await pool.query<RawConnection>(sql, params);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Prosjekteierens bruker-ID (lead-produsent). Brukes både for å lese
 * connection-status og for å binde en klient-initiert OAuth-kobling til
 * riktig produsent slik at produsenten faktisk kan publisere.
 */
export async function getProjectProducerUserId(
  pool: Pool,
  projectId: string,
): Promise<string | null> {
  const ownerRow = await safeQueryFirst(
    pool,
    `SELECT created_by AS "accountName" FROM casting_projects WHERE id = $1 LIMIT 1`,
    [projectId],
  );
  return ownerRow && typeof ownerRow.accountName === "string" ? ownerRow.accountName : null;
}

export interface ProjectProducerInfo {
  userId: string;
  name: string;
  email: string | null;
  agency: string | null;
}

/**
 * Produsentens visningsinfo (navn + firma) for samtykke-skjermen, slik at
 * klienten tydelig ser HVEM de gir tilgang til. Hentes fra users-raden bak
 * casting_projects.created_by + prosjektets agency-felt.
 */
export async function loadProjectProducerInfo(
  pool: Pool,
  projectId: string,
): Promise<ProjectProducerInfo | null> {
  try {
    const { rows } = await pool.query<{
      userId: string | null;
      agency: string | null;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
    }>(
      `SELECT p.created_by AS "userId",
              p.agency     AS "agency",
              u.email      AS "email",
              u.first_name AS "firstName",
              u.last_name  AS "lastName",
              u.username   AS "username"
         FROM casting_projects p
         LEFT JOIN users u ON u.id::text = p.created_by
        WHERE p.id = $1
        LIMIT 1`,
      [projectId],
    );
    const row = rows[0];
    if (!row || !row.userId) return null;
    const name =
      [row.firstName, row.lastName].filter((v): v is string => Boolean(v)).join(" ") ||
      row.username ||
      (row.email ? row.email.split("@")[0] : null) ||
      "Innholdsprodusenten";
    return {
      userId: row.userId,
      name,
      email: row.email ?? null,
      agency: row.agency ?? null,
    };
  } catch {
    return null;
  }
}

export interface ClientOauthConsentRecord {
  projectId: string;
  clientEmail: string;
  clientName: string | null;
  producerUserId: string;
  producerName: string | null;
  producerAgency: string | null;
  platform: string;
  scopesSummary: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** 'granted' (ga tilgang) eller 'revoked' (trakk tilbake). Default 'granted'. */
  action?: "granted" | "revoked";
}

/**
 * Logger klientens eksplisitte samtykke til at produsenten får publiseringstilgang
 * til en plattform. Gir et sporbart bevis (GDPR) på HVEM som tillot HVA, NÅR.
 * Defensiv: hvis tabellen ikke finnes (migrasjon ikke kjørt) svelges feilen
 * slik at selve tilkoblingen ikke blokkeres.
 */
export async function recordClientOauthConsent(
  pool: Pool,
  record: ClientOauthConsentRecord,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_room_client_oauth_consents
         (project_id, client_email, client_name, producer_user_id, producer_name,
          producer_agency, platform, scopes_summary, ip_address, user_agent, action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.projectId,
        record.clientEmail,
        record.clientName,
        record.producerUserId,
        record.producerName,
        record.producerAgency,
        record.platform,
        record.scopesSummary,
        record.ipAddress,
        record.userAgent,
        record.action ?? "granted",
      ],
    );
  } catch (error) {
    console.warn("[client-oauth-consent] kunne ikke logge samtykke", error);
  }
}

/**
 * Setter connection_state='revoked' for plattformens kobling knyttet til
 * prosjektet/produsenten — så tilgangen faktisk opphører når klienten trekker
 * samtykket. Defensiv per tabell (manglende tabell svelges). IG er prosjekt-
 * scopet; de øvrige er bruker-scopet på produsenten (slik koblingen ble lagret).
 */
export async function revokeProjectPlatformConnection(
  pool: Pool,
  projectId: string,
  producerUserId: string | null,
  platform: string,
): Promise<void> {
  const key = platform.toLowerCase();
  const run = async (sql: string, params: unknown[]) => {
    try {
      await pool.query(sql, params);
    } catch {
      /* tabell mangler e.l. — best-effort */
    }
  };
  if (key === "instagram" || key === "facebook") {
    // IG er prosjekt-scopet; FB avledes av samme Meta-kobling.
    await run(
      `UPDATE role_room_instagram_connections
          SET connection_state = 'revoked', updated_at = now()
        WHERE project_id = $1${producerUserId ? " OR user_id = $2" : ""}`,
      producerUserId ? [projectId, producerUserId] : [projectId],
    );
    return;
  }
  // Klient-eide tilkoblinger er PROSJEKT-scopet — revoker per project_id, aldri
  // per produsentens user_id (det ville truffet produsentens globale kobling).
  // De isolerte Google-tabellene (mig 0339/0343) og de project_id-scopede
  // TikTok/LinkedIn-tabellene (mig 0337/0338) håndteres likt her.
  const table =
    key === "tiktok"
      ? "role_room_tiktok_connections"
      : key === "linkedin"
        ? "role_room_linkedin_connections"
        : key === "google"
          ? "role_room_client_google_connections"
          : key === "google_ads"
            ? "role_room_client_google_ads_connections"
            : null;
  if (!table) return;
  await run(
    `UPDATE ${table} SET connection_state = 'revoked', updated_at = now() WHERE project_id = $1`,
    [projectId],
  );
}

export interface ClientConsentSummary {
  platform: string;
  clientName: string | null;
  clientEmail: string;
  consentedAt: string;
  /** 'granted' eller 'revoked' — gjeldende status for plattformen. */
  action: "granted" | "revoked";
}

/**
 * Siste samtykke per plattform for et prosjekt — slik produsenten kan SE at
 * klienten faktisk har godkjent tilgangen (chip i produsent-UI). Defensiv:
 * tom liste hvis tabellen mangler.
 */
export async function latestClientConsentsForProject(
  pool: Pool,
  projectId: string,
): Promise<ClientConsentSummary[]> {
  try {
    const { rows } = await pool.query<{
      platform: string;
      clientName: string | null;
      clientEmail: string;
      consentedAt: Date | string;
      action: string | null;
    }>(
      `SELECT DISTINCT ON (platform)
              platform,
              client_name  AS "clientName",
              client_email AS "clientEmail",
              consented_at AS "consentedAt",
              action
         FROM role_room_client_oauth_consents
        WHERE project_id = $1
        ORDER BY platform, consented_at DESC`,
      [projectId],
    );
    return rows.map((row) => ({
      platform: row.platform,
      clientName: row.clientName ?? null,
      clientEmail: row.clientEmail,
      consentedAt: toIso(row.consentedAt) ?? new Date(0).toISOString(),
      action: row.action === "revoked" ? "revoked" : "granted",
    }));
  } catch {
    return [];
  }
}

/**
 * Leser de autoritative connection-tabellene og bygger en klient-vennlig
 * liste over koblede plattformer for et prosjekt. Produsenten finnes via
 * casting_projects.created_by (prosjekteier / lead-produsent).
 */
export async function loadConnectedPlatforms(
  pool: Pool,
  projectId: string,
  now: Date = new Date(),
): Promise<ConnectedPlatform[]> {
  // KLIENTPORTAL-SCOPE: vis KUN tilkoblinger som hører til DETTE prosjektet —
  // dvs. kontoer KLIENTEN selv har koblet (lagres med project_id). Tidligere
  // falt spørringen tilbake til produsentens egne bruker-scopede tilkoblinger
  // (`OR user_id = producer` for IG; `WHERE user_id = producer` for de andre),
  // så klienten så produsentens egen konto (f.eks. creatorhubn / CreatorHub
  // Norge) som «Tilkoblet». Klienten skal koble SIN egen konto.

  // Instagram — prosjekt-scopet. Facebook avledes fra IG-radens koblede Page.
  const instagram = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            token_expires_at AS "expiryDate",
            ig_username      AS "accountName",
            facebook_page_name AS "facebookPageName",
            facebook_page_id AS "facebookPageId",
            updated_at       AS "updatedAt"
       FROM role_room_instagram_connections
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [projectId],
  );

  // TikTok — nå prosjekt-scopet (mig 0337): viser klientens egen tilkobling.
  const tiktok = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            expiry_date      AS "expiryDate",
            COALESCE(tiktok_display_name, tiktok_username) AS "accountName",
            updated_at       AS "updatedAt"
       FROM role_room_tiktok_connections
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [projectId],
  );

  // LinkedIn — nå prosjekt-scopet (mig 0338): klientens egen tilkobling.
  const linkedin = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            expiry_date      AS "expiryDate",
            linkedin_name    AS "accountName",
            updated_at       AS "updatedAt"
       FROM role_room_linkedin_connections
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [projectId],
  );

  // Google Workspace — egen isolert tabell (mig 0339): klientens egen
  // tilkobling, helt adskilt fra de 20+ Workspace-leserne + den destruktive
  // produsent-upsert-en. Skjules som standard (se DEFAULT_HIDDEN_PLATFORMS).
  const google = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            expiry_date      AS "expiryDate",
            google_email     AS "accountName",
            updated_at       AS "updatedAt"
       FROM role_room_client_google_connections
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [projectId],
  );

  // Google Ads — egen isolert tabell (mig 0343): klientens egen Ads-konto,
  // OAuth-scope adwords. Lar produsenten kjøre annonser / konvertering på vegne.
  const googleAds = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            expiry_date      AS "expiryDate",
            google_email     AS "accountName",
            updated_at       AS "updatedAt"
       FROM role_room_client_google_ads_connections
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [projectId],
  );

  // Facebook avledes fra Instagram-raden: Meta-publisering krever en koblet
  // FB-side, så hvis IG er koblet med en page er Facebook også «på».
  const igRow = instagram as (RawConnection & {
    facebookPageName?: string | null;
    facebookPageId?: string | null;
  }) | null;
  const facebookRaw: RawConnection | null =
    igRow && igRow.facebookPageId
      ? {
          connectionState: igRow.connectionState,
          expiryDate: igRow.expiryDate,
          accountName: igRow.facebookPageName ?? null,
          updatedAt: igRow.updatedAt,
        }
      : null;

  const byKey: Record<PlatformKey, RawConnection | null> = {
    instagram,
    facebook: facebookRaw,
    tiktok,
    linkedin,
    google_ads: googleAds,
    google,
  };

  // Produsent-styrt synlighet: skjul plattformer produsenten ikke vil vise
  // klienten (Google Workspace skjult som standard). En plattform som ER koblet
  // vises uansett, så klienten aldri «mister» en aktiv kobling visuelt.
  const hidden = await loadClientPortalHiddenPlatforms(pool, projectId);

  return PLATFORM_ORDER
    .filter((key) => {
      if (!hidden.has(key)) return true;
      const raw = byKey[key];
      const state = raw?.connectionState;
      return state != null && state !== "revoked" && state !== "not_connected";
    })
    .map((key) => buildPlatform(key, byKey[key], now));
}
