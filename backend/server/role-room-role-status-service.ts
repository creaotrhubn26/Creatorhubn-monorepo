/**
 * role-room-role-status-service.ts
 *
 * Status-pipeline for roller (Del A punkt 14) — «ryggraden i casting-flyten».
 *
 * Rollen og kandidaten beveger seg gjennom hver sin trakt: kandidaten fra
 * screening til cast (role-room-candidate-status-routes.ts), rollen fra kladd
 * til signert. Denne modulen eier rollens.
 *
 * Overgangene er begrenset med vilje. En rolle som hopper fra `draft` rett til
 * `signed` betyr at noen har omgått castingen, og da er tallene for
 * gjennomløpstid verdiløse. Sidesporene `on_hold` og `cancelled` kan nås fra
 * alle aktive steg, fordi produksjoner faktisk settes på vent.
 */

import type { Pool, PoolClient } from "pg";

export const ROLE_STATUSES = [
  "draft",
  "open",
  "auditioning",
  "shortlisted",
  "offered",
  "signed",
  "on_hold",
  "cancelled",
] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number];

/** Norske etiketter — brukes i UI, varsler og historikk. */
export const ROLE_STATUS_LABELS: Record<RoleStatus, string> = {
  draft: "Kladd",
  open: "Utlyst",
  auditioning: "Prøvespill",
  shortlisted: "Kortliste",
  offered: "Tilbud sendt",
  signed: "Signert",
  on_hold: "På vent",
  cancelled: "Avlyst",
};

/** Stegene som utgjør selve fremdriften, i rekkefølge. */
export const ROLE_PIPELINE: RoleStatus[] = [
  "draft", "open", "auditioning", "shortlisted", "offered", "signed",
];

/**
 * Lovlige overganger. Framover ett steg av gangen, med to unntak som
 * gjenspeiler hvordan casting faktisk foregår:
 *   - man kan gå TILBAKE et steg (kandidaten trakk seg, tilbudet ble avslått)
 *   - `on_hold` og `cancelled` kan nås fra alle aktive steg
 */
const TRANSITIONS: Record<RoleStatus, RoleStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["auditioning", "shortlisted", "on_hold", "cancelled", "draft"],
  auditioning: ["shortlisted", "open", "on_hold", "cancelled"],
  shortlisted: ["offered", "auditioning", "on_hold", "cancelled"],
  offered: ["signed", "shortlisted", "on_hold", "cancelled"],
  // Signert er ikke helt endelig — kontrakter kan falle bort.
  signed: ["cancelled", "offered"],
  on_hold: ["open", "auditioning", "shortlisted", "offered", "cancelled"],
  // En avlyst rolle kan gjenåpnes, men starter da forfra.
  cancelled: ["draft", "open"],
};

export function isRoleStatus(v: unknown): v is RoleStatus {
  return typeof v === "string" && (ROLE_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: RoleStatus, to: RoleStatus): boolean {
  if (from === to) return true; // idempotent
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: RoleStatus): RoleStatus[] {
  return TRANSITIONS[from] ?? [];
}

export class RoleStatusError extends Error {
  constructor(message: string, public code: "unknown_status" | "illegal_transition" | "not_found") {
    super(message);
  }
}

export interface StatusChangeResult {
  roleId: string;
  from: RoleStatus;
  to: RoleStatus;
  changedAt: string;
}

/**
 * Flytter en rolle til ny status. Kjøres i transaksjon: rollen, tidsstemplene
 * og historikkraden må oppdateres samlet, ellers kan historikken vise en
 * overgang som aldri traff rollen.
 */
export async function setRoleStatus(
  pool: Pool,
  input: {
    roleId: string;
    toStatus: string;
    userId: string | null;
    note?: string | null;
  },
): Promise<StatusChangeResult> {
  if (!isRoleStatus(input.toStatus)) {
    throw new RoleStatusError(
      `Ukjent status «${input.toStatus}». Gyldige: ${ROLE_STATUSES.join(", ")}.`,
      "unknown_status",
    );
  }
  const toStatus = input.toStatus;

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    // FOR UPDATE: to samtidige statusendringer skal ikke kunne skrive hver sin
    // historikkrad fra samme utgangspunkt.
    const current = await client.query<{ status: string; project_id: string }>(
      `SELECT status, project_id FROM casting_roles WHERE id = $1 FOR UPDATE`,
      [input.roleId],
    );
    if (current.rowCount === 0) {
      throw new RoleStatusError("Fant ikke rollen.", "not_found");
    }

    const fromRaw = current.rows[0].status;
    const from: RoleStatus = isRoleStatus(fromRaw) ? fromRaw : "draft";

    if (!canTransition(from, toStatus)) {
      throw new RoleStatusError(
        `Kan ikke gå fra «${ROLE_STATUS_LABELS[from]}» til «${ROLE_STATUS_LABELS[toStatus]}». ` +
          `Mulige steg herfra: ${allowedTransitions(from).map((s) => ROLE_STATUS_LABELS[s]).join(", ")}.`,
        "illegal_transition",
      );
    }

    const changed = await client.query<{ status_changed_at: string }>(
      // $2 brukes både som verdi og i sammenligninger; uten eksplisitt cast
      // klarer ikke Postgres å utlede én type (42P08).
      `UPDATE casting_roles
          SET status = $2::text,
              status_changed_at = NOW(),
              -- Første gang rollen utlyses, ikke hver gang den er innom.
              opened_at = CASE WHEN $2::text = 'open' THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
              signed_at = CASE WHEN $2::text = 'signed' THEN COALESCE(signed_at, NOW()) ELSE signed_at END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING status_changed_at`,
      [input.roleId, toStatus],
    );

    // Idempotent kall (samme status) logges ikke — ellers ville historikken
    // fylles med overganger som ikke skjedde.
    if (from !== toStatus) {
      await client.query(
        `INSERT INTO role_room_role_status_history
           (role_id, project_id, from_status, to_status, note, changed_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [input.roleId, current.rows[0].project_id, from, toStatus, input.note ?? null, input.userId],
      );
    }

    await client.query("COMMIT");
    return {
      roleId: input.roleId,
      from,
      to: toStatus,
      changedAt: changed.rows[0].status_changed_at,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface PipelineSummary {
  status: RoleStatus;
  label: string;
  count: number;
}

/**
 * Fordelingen av roller per steg — trakten på prosjektnivå. Tomme steg tas
 * med, fordi et hull midt i trakten er akkurat det man vil se.
 */
export async function getProjectPipeline(
  pool: Pool,
  projectId: string,
): Promise<{ pipeline: PipelineSummary[]; total: number }> {
  const r = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::int AS n FROM casting_roles WHERE project_id = $1 GROUP BY status`,
    [projectId],
  );
  const counts = new Map(r.rows.map((row) => [row.status, Number(row.n)]));

  const pipeline = ROLE_STATUSES.map((status) => ({
    status,
    label: ROLE_STATUS_LABELS[status],
    count: counts.get(status) ?? 0,
  }));

  return {
    pipeline,
    total: pipeline.reduce((sum, s) => sum + s.count, 0),
  };
}
