/**
 * role-room-take-approval-service.ts
 *
 * Godkjenningsflyt på take (REVIEW-modus).
 *
 * Tilstandene er `pending → approved | needs_work | rejected`, med låsing som
 * en egen akse på toppen. Overgangene er begrenset med vilje — ikke for å
 * være strenge, men fordi en tilstandsmaskin der alt kan bli alt ikke er en
 * tilstandsmaskin, og da mister historikken sin verdi.
 *
 * Tre ting som er lette å gjøre feil, og som derfor er avgjort her:
 *
 *   1. **Låsing hindrer endring, men er ikke en status.** En låst take er
 *      «godkjent og låst». Hadde lås vært en status, ville man mistet hva den
 *      var låst SOM.
 *   2. **Underkjenning krever begrunnelse.** `needs_work` og `rejected` uten
 *      note er en beskjed om å gjette hva som er galt.
 *   3. **Favoritt er ikke en status.** Den er per bruker og kan gjelde mange
 *      takes; godkjenning er produksjonens og gjelder én tilstand.
 */

import type { Pool, PoolClient } from "pg";

export const APPROVAL_STATUSES = ["pending", "approved", "needs_work", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_ACTIONS = [
  "approve", "needs_work", "reject", "reopen", "lock", "unlock",
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export type TakeSource = "take_log" | "media";

/** Handlinger som må begrunnes. Se punkt 2 i filtoppteksten. */
export const ACTIONS_REQUIRING_NOTE: ApprovalAction[] = ["needs_work", "reject"];

/**
 * Hvilken status en handling fører til.
 * `lock`/`unlock` står ikke her — de endrer ikke status.
 */
const ACTION_TARGET: Record<string, ApprovalStatus> = {
  approve: "approved",
  needs_work: "needs_work",
  reject: "rejected",
  reopen: "pending",
};

/**
 * Lovlige overganger.
 *
 * Merk at `approved → approved` ikke er med: å godkjenne noe som allerede er
 * godkjent er enten en dobbeltklikk eller en misforståelse, og begge deler er
 * bedre å få vite om enn å skrive en ny rad i historikken for.
 */
const ALLOWED: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending: ["approved", "needs_work", "rejected"],
  // Et godkjent take kan trekkes tilbake — det skjer når klippen finner noe.
  approved: ["needs_work", "rejected", "pending"],
  // «Trenger arbeid» er ikke endelig: den går videre begge veier.
  needs_work: ["approved", "rejected", "pending"],
  // Underkjent kan gjenåpnes, men ikke godkjennes i ett hopp — da mister man
  // at noen faktisk vurderte den på nytt.
  rejected: ["pending"],
};

export interface TakeApproval {
  id: string;
  projectId: string;
  takeSource: TakeSource;
  takeRef: string;
  sceneId: string | null;
  status: ApprovalStatus;
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  updatedAt: string;
}

export interface ApprovalHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  action: ApprovalAction;
  note: string | null;
  actorId: string | null;
  createdAt: string;
}

export class ApprovalError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

/** Er overgangen lovlig? Eksportert fordi UI-et bør slippe å gjette. */
export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/** Handlingene som er mulige nå. Låst take har bare «unlock». */
export function availableActions(status: ApprovalStatus, locked: boolean): ApprovalAction[] {
  if (locked) return ["unlock"];
  const actions = (Object.keys(ACTION_TARGET) as ApprovalAction[]).filter((action) =>
    canTransition(status, ACTION_TARGET[action]),
  );
  // Låsing gir bare mening når det finnes en beslutning å fryse.
  if (status !== "pending") actions.push("lock");
  return actions;
}

function mapApproval(row: Record<string, unknown>): TakeApproval {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    takeSource: String(row.take_source) as TakeSource,
    takeRef: String(row.take_ref),
    sceneId: (row.scene_id as string) ?? null,
    status: String(row.status) as ApprovalStatus,
    locked: row.locked_at !== null && row.locked_at !== undefined,
    lockedAt: iso(row.locked_at),
    lockedBy: (row.locked_by as string) ?? null,
    decidedBy: (row.decided_by as string) ?? null,
    decidedAt: iso(row.decided_at),
    note: (row.note as string) ?? null,
    updatedAt: iso(row.updated_at) ?? "",
  };
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? null : String(value);
}

/**
 * Henter godkjenningen, og oppretter den som `pending` hvis den ikke finnes.
 *
 * En take uten rad er ikke uvurdert på en annen måte enn en take med
 * `pending` — så raden lages ved første oppslag framfor å tvinge kalleren til
 * å skille mellom «finnes ikke» og «ikke vurdert».
 */
export async function getOrCreateApproval(
  client: Pool | PoolClient,
  input: { projectId: string; takeSource: TakeSource; takeRef: string; sceneId?: string | null },
): Promise<TakeApproval> {
  const r = await client.query(
    `INSERT INTO role_room_take_approvals (project_id, take_source, take_ref, scene_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (take_source, take_ref) DO UPDATE SET updated_at = role_room_take_approvals.updated_at
     RETURNING *`,
    [input.projectId, input.takeSource, input.takeRef, input.sceneId ?? null],
  );
  return mapApproval(r.rows[0] as Record<string, unknown>);
}

export interface ApplyActionInput {
  projectId: string;
  takeSource: TakeSource;
  takeRef: string;
  sceneId?: string | null;
  action: ApprovalAction;
  note?: string | null;
  actorId?: string | null;
}

/**
 * Utfører en handling.
 *
 * Hele operasjonen ligger i transaksjon med `FOR UPDATE` på raden: to
 * personer i review-modus som trykker samtidig skal ikke kunne ende med at
 * historikken viser to overganger fra samme utgangspunkt.
 */
export async function applyAction(
  pool: Pool,
  input: ApplyActionInput,
): Promise<{ approval: TakeApproval; history: ApprovalHistoryEntry[] }> {
  const note = input.note?.trim() || null;
  if (ACTIONS_REQUIRING_NOTE.includes(input.action) && !note) {
    throw new ApprovalError(
      "note_required",
      "Underkjenning krever en begrunnelse — ellers vet ikke den som skal rette hva som er galt.",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await getOrCreateApproval(client, input);

    const current = mapApproval(
      (
        await client.query(
          `SELECT * FROM role_room_take_approvals
            WHERE take_source = $1 AND take_ref = $2 FOR UPDATE`,
          [input.takeSource, input.takeRef],
        )
      ).rows[0] as Record<string, unknown>,
    );

    // Låsen sjekkes først. En låst take skal avvise alt annet enn opplåsing,
    // uansett hvor lovlig overgangen ellers ville vært.
    if (current.locked && input.action !== "unlock") {
      throw new ApprovalError("locked", "Taken er låst. Lås den opp før du endrer beslutningen.");
    }

    let next = current.status;
    if (input.action === "lock") {
      if (current.status === "pending") {
        throw new ApprovalError("nothing_to_lock", "Det er ingen beslutning å låse ennå.");
      }
      await client.query(
        `UPDATE role_room_take_approvals
            SET locked_at = now(), locked_by = $2, updated_at = now()
          WHERE id = $1`,
        [current.id, input.actorId ?? null],
      );
    } else if (input.action === "unlock") {
      if (!current.locked) {
        throw new ApprovalError("not_locked", "Taken er ikke låst.");
      }
      await client.query(
        `UPDATE role_room_take_approvals
            SET locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = $1`,
        [current.id],
      );
    } else {
      const target = ACTION_TARGET[input.action];
      if (!canTransition(current.status, target)) {
        throw new ApprovalError(
          "illegal_transition",
          `Kan ikke gå fra «${current.status}» til «${target}».`,
        );
      }
      next = target;
      await client.query(
        `UPDATE role_room_take_approvals
            SET status = $2, note = $3, decided_by = $4, decided_at = now(), updated_at = now()
          WHERE id = $1`,
        [current.id, target, note, input.actorId ?? null],
      );
    }

    await client.query(
      `INSERT INTO role_room_take_approval_events
         (approval_id, from_status, to_status, action, note, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [current.id, current.status, next, input.action, note, input.actorId ?? null],
    );

    const updated = mapApproval(
      (await client.query(`SELECT * FROM role_room_take_approvals WHERE id = $1`, [current.id]))
        .rows[0] as Record<string, unknown>,
    );
    const history = await readHistory(client, current.id);

    await client.query("COMMIT");
    return { approval: updated, history };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function readHistory(
  client: Pool | PoolClient,
  approvalId: string,
): Promise<ApprovalHistoryEntry[]> {
  const r = await client.query(
    `SELECT from_status, to_status, action, note, actor_id, created_at
       FROM role_room_take_approval_events
      WHERE approval_id = $1
      ORDER BY created_at, id`,
    [approvalId],
  );
  return (r.rows as Array<Record<string, unknown>>).map((row) => ({
    fromStatus: (row.from_status as string) ?? null,
    toStatus: String(row.to_status),
    action: String(row.action) as ApprovalAction,
    note: (row.note as string) ?? null,
    actorId: (row.actor_id as string) ?? null,
    createdAt: iso(row.created_at) ?? "",
  }));
}

export interface ApprovalSummary {
  pending: number;
  approved: number;
  needsWork: number;
  rejected: number;
  locked: number;
  /** Takes uten rad i det hele tatt. De er uvurderte, ikke fraværende. */
  unreviewed: number;
  total: number;
}

/**
 * Status for hele prosjektet, eller én scene.
 *
 * `unreviewed` regnes ut fra take-loggen og ikke fra godkjenningstabellen:
 * en take ingen har åpnet har ingen rad, og ville ellers ikke telt med noe
 * sted. «18 takes, 4 vurdert» er beskjeden REVIEW-skjermen trenger.
 */
export async function getApprovalSummary(
  pool: Pool,
  projectId: string,
  sceneId?: string,
): Promise<ApprovalSummary> {
  const params: unknown[] = [projectId];
  let sceneClause = "";
  if (sceneId) {
    params.push(sceneId);
    sceneClause = ` AND scene_id = $${params.length}`;
  }

  const [approvals, takes] = await Promise.all([
    pool.query<Record<string, string>>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int    AS pending,
         COUNT(*) FILTER (WHERE status = 'approved')::int   AS approved,
         COUNT(*) FILTER (WHERE status = 'needs_work')::int AS needs_work,
         COUNT(*) FILTER (WHERE status = 'rejected')::int   AS rejected,
         COUNT(*) FILTER (WHERE locked_at IS NOT NULL)::int AS locked,
         COUNT(*)::int                                      AS total
       FROM role_room_take_approvals
      WHERE project_id = $1${sceneClause}`,
      params,
    ),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM role_room_take_log
        WHERE project_id = $1${sceneId ? " AND scene_id = $2" : ""}`,
      sceneId ? [projectId, sceneId] : [projectId],
    ),
  ]);

  const a = approvals.rows[0];
  const totalTakes = Number(takes.rows[0]?.n ?? 0);
  const withRow = Number(a?.total ?? 0);
  return {
    pending: Number(a?.pending ?? 0),
    approved: Number(a?.approved ?? 0),
    needsWork: Number(a?.needs_work ?? 0),
    rejected: Number(a?.rejected ?? 0),
    locked: Number(a?.locked ?? 0),
    unreviewed: Math.max(totalTakes - withRow, 0),
    total: totalTakes,
  };
}

export async function listApprovals(
  pool: Pool,
  projectId: string,
  options: { sceneId?: string; status?: ApprovalStatus; limit?: number; offset?: number } = {},
): Promise<{ approvals: TakeApproval[]; total: number }> {
  const params: unknown[] = [projectId];
  const where: string[] = ["project_id = $1"];
  if (options.sceneId) {
    params.push(options.sceneId);
    where.push(`scene_id = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    where.push(`status = $${params.length}`);
  }

  // Paginert fra første stund. Ytelseskravet er 100 000+ takes, og en
  // ubegrenset liste ville vært det første som ga etter.
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT * FROM role_room_take_approvals
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM role_room_take_approvals WHERE ${where.join(" AND ")}`,
      params,
    ),
  ]);

  return {
    approvals: (rows.rows as Array<Record<string, unknown>>).map(mapApproval),
    total: Number(count.rows[0]?.n ?? 0),
  };
}

// ── Favoritt ────────────────────────────────────────────────────────────────

export async function setFavorite(
  pool: Pool,
  input: {
    projectId: string; takeSource: TakeSource; takeRef: string;
    userId: string; favorite: boolean;
  },
): Promise<boolean> {
  if (input.favorite) {
    await pool.query(
      `INSERT INTO role_room_take_favorites (take_source, take_ref, user_id, project_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [input.takeSource, input.takeRef, input.userId, input.projectId],
    );
    return true;
  }
  await pool.query(
    `DELETE FROM role_room_take_favorites
      WHERE take_source = $1 AND take_ref = $2 AND user_id = $3`,
    [input.takeSource, input.takeRef, input.userId],
  );
  return false;
}

/** Brukerens favoritter i prosjektet, som «kilde:ref»-nøkler. */
export async function listFavorites(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<string[]> {
  const r = await pool.query<{ take_source: string; take_ref: string }>(
    `SELECT take_source, take_ref FROM role_room_take_favorites
      WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  return r.rows.map((row) => `${row.take_source}:${row.take_ref}`);
}
