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
  google: "Google Workspace",
};

// Fast visningsrekkefølge slik at klient-kortet ser likt ut hver gang.
export const PLATFORM_ORDER: PlatformKey[] = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "google",
];

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
  // Produsentens bruker-ID (de fleste connection-tabellene er bruker-scopet).
  const producerUserId = await getProjectProducerUserId(pool, projectId);

  // LinkedIn — bruker-scopet, unik på user_id.
  const linkedin = producerUserId
    ? await safeQueryFirst(
        pool,
        `SELECT connection_state AS "connectionState",
                expiry_date      AS "expiryDate",
                linkedin_name    AS "accountName",
                updated_at       AS "updatedAt"
           FROM role_room_linkedin_connections
          WHERE user_id = $1
          LIMIT 1`,
        [producerUserId],
      )
    : null;

  // TikTok — bruker-scopet, unik på user_id.
  const tiktok = producerUserId
    ? await safeQueryFirst(
        pool,
        `SELECT connection_state AS "connectionState",
                expiry_date      AS "expiryDate",
                COALESCE(tiktok_display_name, tiktok_username) AS "accountName",
                updated_at       AS "updatedAt"
           FROM role_room_tiktok_connections
          WHERE user_id = $1
          LIMIT 1`,
        [producerUserId],
      )
    : null;

  // Google — bruker-scopet connection. Prosjekt-bindingen finnes separat,
  // men selve OAuth-tilstanden ligger på bruker-raden.
  const google = producerUserId
    ? await safeQueryFirst(
        pool,
        `SELECT connection_state AS "connectionState",
                expiry_date      AS "expiryDate",
                google_email     AS "accountName",
                updated_at       AS "updatedAt"
           FROM role_room_google_connections
          WHERE user_id = $1
          LIMIT 1`,
        [producerUserId],
      )
    : null;

  // Instagram — kan være prosjekt-scopet ELLER bruker-vid. Velg nyeste
  // rad som matcher prosjektet eller produsenten.
  const instagram = await safeQueryFirst(
    pool,
    `SELECT connection_state AS "connectionState",
            token_expires_at AS "expiryDate",
            ig_username      AS "accountName",
            facebook_page_name AS "facebookPageName",
            facebook_page_id AS "facebookPageId",
            updated_at       AS "updatedAt"
       FROM role_room_instagram_connections
      WHERE project_id = $1 OR user_id = $2
      ORDER BY (project_id = $1) DESC, updated_at DESC
      LIMIT 1`,
    [projectId, producerUserId],
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
    google,
  };

  return PLATFORM_ORDER.map((key) => buildPlatform(key, byKey[key], now));
}
