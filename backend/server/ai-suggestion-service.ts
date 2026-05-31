/**
 * ai-suggestion-service.ts
 *
 * AI Suggestion System — substratet for alle AI-genererte forslag i The
 * Role Room. Eier `casting_ai_suggestions`-tabellen (migration 149) og
 * koordinerer agent-generering, review-flyt og applier-materialisering.
 *
 * Arkitekturreferanse:
 *   frontend/client/src/components/role-room/ai-suggestion-architecture.md
 *
 * Designprinsipper materialisert i kode:
 *   AD-001  Unified tabell — én generic AISuggestion<TPayload>
 *   AD-002  Immutable bortsett fra status/review/apply-felter
 *   AD-003  generate → accept → apply som tre separate operasjoner
 *           (accept utløser apply automatisk hvis applier er registrert)
 *   AD-005  Agent eier sin Claude-prompt; substratet håndterer ikke
 *           prompt-templates
 *
 * Service registreres som singleton ved server-oppstart og deles på
 * tvers av routes. Agenter og appliers registreres via
 * `registerAgent()` / `registerApplier()` før første `generate()`-kall.
 */

import type { Pool, PoolClient } from "pg";

// ──────────────────────────────────────────────────────────────────────
// Public types — speiler frontend/models/casting.ts (AISuggestion-blokken)
// ──────────────────────────────────────────────────────────────────────

export type AISuggestionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "superseded"
  | "applied";

export type AISuggestionSourceType =
  | "scene"
  | "role"
  | "manuscript"
  | "project";

export interface AISuggestion<TPayload = unknown> {
  id: string;
  projectId: string;
  suggestionType: string;
  payload: TPayload;
  sourceType: AISuggestionSourceType;
  sourceId: string;
  agentName: string;
  modelVersion: string;
  parentSuggestionId?: string;
  confidence: number;
  status: AISuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  appliedAt?: string;
  appliedResult?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AIAgentInput {
  projectId: string;
  userId: string;
  sourceType: AISuggestionSourceType;
  sourceId: string;
  /** Agent-spesifikk input (f.eks. scene-tekst, brukerens idé) */
  payload: unknown;
}

export interface AIAgentOutput<TPayload = unknown> {
  suggestionType: string;
  payload: TPayload;
  confidence: number;
  sourceType: AISuggestionSourceType;
  sourceId: string;
}

export interface AIAgent {
  name: string;
  modelVersion: string;
  /**
   * Agenten kaller Claude (eller annen kilde) og returnerer strukturerte
   * forslag. Skal returnere [] ved tomt input, ikke kaste. Konsekvens av
   * AI-prinsipp 1: forslag, aldri handlinger — agenten skriver aldri
   * direkte til hoveddata.
   */
  generate(input: AIAgentInput): Promise<AIAgentOutput[]>;
}

export interface ApplyContext {
  projectId: string;
  userId: string;
  /** Pg-klient som er i en åpen transaksjon. Applier opererer inne i denne
   *  så feil ruller hele accept tilbake. */
  client: PoolClient;
}

export interface SuggestionApplier<TPayload = unknown> {
  suggestionType: string;
  /**
   * Materialiserer forslaget i hoveddata. Returnert objekt persisteres
   * som `applied_result` for audit (typisk IDer på opprettede rader).
   * Feil propageres til orchestrator som ruller tilbake transaksjonen.
   */
  apply(
    suggestion: AISuggestion<TPayload>,
    context: ApplyContext,
  ): Promise<Record<string, unknown>>;
}

export interface AISuggestionFilter {
  sourceType?: AISuggestionSourceType;
  sourceId?: string;
  agentName?: string;
  suggestionType?: string;
  status?: AISuggestionStatus | AISuggestionStatus[];
  minConfidence?: number;
}

export interface AISuggestionServiceDeps {
  pool: Pool;
  /** Default-terskel for default-query. Settes lavt for testing. */
  defaultMinConfidence?: number;
  /** Hook for analytics — kalles ved generate/accept/reject/apply */
  onTelemetry?: (event: TelemetryEvent) => void;
}

export type TelemetryEvent =
  | {
      kind: "generate";
      agentName: string;
      modelVersion: string;
      projectId: string;
      userId: string;
      sourceType: AISuggestionSourceType;
      sourceId: string;
      suggestionsGenerated: number;
      durationMs: number;
      errorClass?: string;
    }
  | {
      kind: "review";
      action: "accept" | "reject";
      suggestionId: string;
      suggestionType: string;
      agentName: string;
      confidence: number;
      msSinceCreation: number;
      userId: string;
    }
  | {
      kind: "apply";
      suggestionId: string;
      suggestionType: string;
      ok: boolean;
      durationMs: number;
      errorClass?: string;
    };

// ──────────────────────────────────────────────────────────────────────
// Service-implementasjon
// ──────────────────────────────────────────────────────────────────────

export interface AISuggestionService {
  registerAgent(agent: AIAgent): void;
  registerApplier(applier: SuggestionApplier): void;

  generate(agentName: string, input: AIAgentInput): Promise<AISuggestion[]>;

  listPending(
    projectId: string,
    filter?: AISuggestionFilter,
  ): Promise<AISuggestion[]>;

  get(suggestionId: string): Promise<AISuggestion | null>;

  accept(
    suggestionId: string,
    userId: string,
    note?: string,
  ): Promise<AISuggestion>;

  reject(
    suggestionId: string,
    userId: string,
    note?: string,
  ): Promise<AISuggestion>;

  /**
   * Sjelden brukt — accept utløser normalt apply automatisk. Eksisterer
   * for re-apply ved infrastructure-feil.
   */
  apply(suggestionId: string, userId: string): Promise<AISuggestion>;
}

export function createAISuggestionService(
  deps: AISuggestionServiceDeps,
): AISuggestionService {
  const { pool, defaultMinConfidence = 0.7, onTelemetry } = deps;
  const agents = new Map<string, AIAgent>();
  const appliers = new Map<string, SuggestionApplier>();

  const emit = (event: TelemetryEvent): void => {
    try {
      onTelemetry?.(event);
    } catch {
      // Telemetri skal aldri spise produksjons-feil
    }
  };

  // ── Row → object mapping ────────────────────────────────────────────

  function rowToSuggestion(row: Record<string, unknown>): AISuggestion {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      suggestionType: String(row.suggestion_type),
      payload: row.payload as unknown,
      sourceType: row.source_type as AISuggestionSourceType,
      sourceId: String(row.source_id),
      agentName: String(row.agent_name),
      modelVersion: String(row.model_version),
      parentSuggestionId:
        row.parent_suggestion_id != null
          ? String(row.parent_suggestion_id)
          : undefined,
      confidence: Number(row.confidence),
      status: row.status as AISuggestionStatus,
      reviewedBy: row.reviewed_by != null ? String(row.reviewed_by) : undefined,
      reviewedAt:
        row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : (row.reviewed_at as string | undefined),
      reviewNote:
        row.review_note != null ? String(row.review_note) : undefined,
      appliedAt:
        row.applied_at instanceof Date
          ? row.applied_at.toISOString()
          : (row.applied_at as string | undefined),
      appliedResult:
        (row.applied_result as Record<string, unknown> | undefined) ?? undefined,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  }

  // ── Registrering ────────────────────────────────────────────────────

  function registerAgent(agent: AIAgent): void {
    if (agents.has(agent.name)) {
      throw new Error(`Agent already registered: ${agent.name}`);
    }
    agents.set(agent.name, agent);
  }

  function registerApplier(applier: SuggestionApplier): void {
    if (appliers.has(applier.suggestionType)) {
      throw new Error(
        `Applier already registered for type: ${applier.suggestionType}`,
      );
    }
    appliers.set(applier.suggestionType, applier);
  }

  // ── generate: agent → forslag i DB ──────────────────────────────────

  async function generate(
    agentName: string,
    input: AIAgentInput,
  ): Promise<AISuggestion[]> {
    const agent = agents.get(agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    const start = Date.now();
    let outputs: AIAgentOutput[];
    try {
      outputs = await agent.generate(input);
    } catch (err) {
      emit({
        kind: "generate",
        agentName: agent.name,
        modelVersion: agent.modelVersion,
        projectId: input.projectId,
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        suggestionsGenerated: 0,
        durationMs: Date.now() - start,
        errorClass: err instanceof Error ? err.name : "Unknown",
      });
      throw err;
    }

    if (outputs.length === 0) {
      emit({
        kind: "generate",
        agentName: agent.name,
        modelVersion: agent.modelVersion,
        projectId: input.projectId,
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        suggestionsGenerated: 0,
        durationMs: Date.now() - start,
      });
      return [];
    }

    // Bulk-insert. Bruker parametriserte arrays for å unngå mange round-trips.
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let i = 1;
    for (const out of outputs) {
      // Validér confidence-bounds før DB-insert (matcher CHECK constraint)
      const clampedConfidence = Math.max(0, Math.min(1, out.confidence));
      placeholders.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
      );
      values.push(
        input.projectId,
        out.suggestionType,
        JSON.stringify(out.payload),
        out.sourceType,
        out.sourceId,
        agent.name,
        agent.modelVersion,
        clampedConfidence,
      );
    }

    const sql = `
      INSERT INTO casting_ai_suggestions
        (project_id, suggestion_type, payload, source_type, source_id,
         agent_name, model_version, confidence)
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const { rows } = await pool.query(sql, values);
    const created = rows.map(rowToSuggestion);

    emit({
      kind: "generate",
      agentName: agent.name,
      modelVersion: agent.modelVersion,
      projectId: input.projectId,
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      suggestionsGenerated: created.length,
      durationMs: Date.now() - start,
    });

    return created;
  }

  // ── listPending ─────────────────────────────────────────────────────

  async function listPending(
    projectId: string,
    filter: AISuggestionFilter = {},
  ): Promise<AISuggestion[]> {
    // casting_ai_suggestions.project_id er uuid-type. TROLL-demo og andre
    // legacy-prosjekter har string-IDer som ikke er gyldige UUIDs (f.eks.
    // 'troll-1780050683358') — sender vi dem til Postgres returnerer den
    // 500 "invalid input syntax for type uuid". Tabellen kan likevel ikke
    // ha rader for ikke-UUID prosjekter, så vi kortslutter med tom liste.
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(projectId)) {
      return [];
    }
    const conditions: string[] = ["project_id = $1"];
    const values: unknown[] = [projectId];
    let i = 2;

    const statusFilter = filter.status ?? "pending";
    if (Array.isArray(statusFilter)) {
      conditions.push(`status = ANY($${i++}::text[])`);
      values.push(statusFilter);
    } else {
      conditions.push(`status = $${i++}`);
      values.push(statusFilter);
    }

    const minConf = filter.minConfidence ?? defaultMinConfidence;
    conditions.push(`confidence >= $${i++}`);
    values.push(minConf);

    if (filter.sourceType) {
      conditions.push(`source_type = $${i++}`);
      values.push(filter.sourceType);
    }
    if (filter.sourceId) {
      conditions.push(`source_id = $${i++}`);
      values.push(filter.sourceId);
    }
    if (filter.agentName) {
      conditions.push(`agent_name = $${i++}`);
      values.push(filter.agentName);
    }
    if (filter.suggestionType) {
      conditions.push(`suggestion_type = $${i++}`);
      values.push(filter.suggestionType);
    }

    const sql = `
      SELECT * FROM casting_ai_suggestions
      WHERE ${conditions.join(" AND ")}
      ORDER BY confidence DESC, created_at DESC
      LIMIT 500
    `;

    const { rows } = await pool.query(sql, values);
    return rows.map(rowToSuggestion);
  }

  // ── get (single by id) ──────────────────────────────────────────────

  async function get(suggestionId: string): Promise<AISuggestion | null> {
    const { rows } = await pool.query(
      "SELECT * FROM casting_ai_suggestions WHERE id = $1",
      [suggestionId],
    );
    return rows[0] ? rowToSuggestion(rows[0]) : null;
  }

  // ── accept (utløser apply automatisk hvis applier finnes) ───────────

  async function accept(
    suggestionId: string,
    userId: string,
    note?: string,
  ): Promise<AISuggestion> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Hent + lås raden så ingen annen accept/reject kan parallellisere
      const lockResult = await client.query(
        `SELECT * FROM casting_ai_suggestions
         WHERE id = $1
         FOR UPDATE`,
        [suggestionId],
      );
      const row = lockResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        throw new Error(`Suggestion not found: ${suggestionId}`);
      }

      const suggestion = rowToSuggestion(row);
      if (suggestion.status !== "pending") {
        await client.query("ROLLBACK");
        throw new Error(
          `Cannot accept suggestion in status: ${suggestion.status}`,
        );
      }

      // Marker accepted
      await client.query(
        `UPDATE casting_ai_suggestions
         SET status = 'accepted', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
         WHERE id = $3`,
        [userId, note ?? null, suggestionId],
      );

      emit({
        kind: "review",
        action: "accept",
        suggestionId,
        suggestionType: suggestion.suggestionType,
        agentName: suggestion.agentName,
        confidence: suggestion.confidence,
        msSinceCreation:
          Date.now() - new Date(suggestion.createdAt).getTime(),
        userId,
      });

      // Materialiser via applier i samme transaksjon
      const applier = appliers.get(suggestion.suggestionType);
      let appliedResult: Record<string, unknown> = {};
      let appliedOk = true;
      const applyStart = Date.now();

      if (applier) {
        try {
          appliedResult = await applier.apply(
            { ...suggestion, status: "accepted" },
            { projectId: suggestion.projectId, userId, client },
          );

          await client.query(
            `UPDATE casting_ai_suggestions
             SET status = 'applied', applied_at = NOW(), applied_result = $1
             WHERE id = $2`,
            [JSON.stringify(appliedResult), suggestionId],
          );
        } catch (err) {
          appliedOk = false;
          emit({
            kind: "apply",
            suggestionId,
            suggestionType: suggestion.suggestionType,
            ok: false,
            durationMs: Date.now() - applyStart,
            errorClass: err instanceof Error ? err.name : "Unknown",
          });
          await client.query("ROLLBACK");
          throw err;
        }
      }

      await client.query("COMMIT");

      if (applier && appliedOk) {
        emit({
          kind: "apply",
          suggestionId,
          suggestionType: suggestion.suggestionType,
          ok: true,
          durationMs: Date.now() - applyStart,
        });
      }

      // Hent oppdatert rad for retur
      const refetch = await pool.query(
        "SELECT * FROM casting_ai_suggestions WHERE id = $1",
        [suggestionId],
      );
      return rowToSuggestion(refetch.rows[0]);
    } finally {
      client.release();
    }
  }

  // ── reject ──────────────────────────────────────────────────────────

  async function reject(
    suggestionId: string,
    userId: string,
    note?: string,
  ): Promise<AISuggestion> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const lockResult = await client.query(
        `SELECT * FROM casting_ai_suggestions
         WHERE id = $1
         FOR UPDATE`,
        [suggestionId],
      );
      const row = lockResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        throw new Error(`Suggestion not found: ${suggestionId}`);
      }

      const suggestion = rowToSuggestion(row);
      if (suggestion.status !== "pending") {
        await client.query("ROLLBACK");
        throw new Error(
          `Cannot reject suggestion in status: ${suggestion.status}`,
        );
      }

      await client.query(
        `UPDATE casting_ai_suggestions
         SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
         WHERE id = $3`,
        [userId, note ?? null, suggestionId],
      );

      await client.query("COMMIT");

      emit({
        kind: "review",
        action: "reject",
        suggestionId,
        suggestionType: suggestion.suggestionType,
        agentName: suggestion.agentName,
        confidence: suggestion.confidence,
        msSinceCreation:
          Date.now() - new Date(suggestion.createdAt).getTime(),
        userId,
      });

      const refetch = await pool.query(
        "SELECT * FROM casting_ai_suggestions WHERE id = $1",
        [suggestionId],
      );
      return rowToSuggestion(refetch.rows[0]);
    } finally {
      client.release();
    }
  }

  // ── apply (manuell re-apply ved infrastructure-feil) ────────────────

  async function apply(
    suggestionId: string,
    userId: string,
  ): Promise<AISuggestion> {
    const current = await get(suggestionId);
    if (!current) throw new Error(`Suggestion not found: ${suggestionId}`);
    if (current.status !== "accepted") {
      throw new Error(
        `Cannot apply suggestion in status: ${current.status} (must be 'accepted')`,
      );
    }

    const applier = appliers.get(current.suggestionType);
    if (!applier) {
      throw new Error(
        `No applier registered for type: ${current.suggestionType}`,
      );
    }

    const client = await pool.connect();
    const applyStart = Date.now();
    try {
      await client.query("BEGIN");

      const appliedResult = await applier.apply(current, {
        projectId: current.projectId,
        userId,
        client,
      });

      await client.query(
        `UPDATE casting_ai_suggestions
         SET status = 'applied', applied_at = NOW(), applied_result = $1
         WHERE id = $2`,
        [JSON.stringify(appliedResult), suggestionId],
      );

      await client.query("COMMIT");

      emit({
        kind: "apply",
        suggestionId,
        suggestionType: current.suggestionType,
        ok: true,
        durationMs: Date.now() - applyStart,
      });

      const refetch = await pool.query(
        "SELECT * FROM casting_ai_suggestions WHERE id = $1",
        [suggestionId],
      );
      return rowToSuggestion(refetch.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      emit({
        kind: "apply",
        suggestionId,
        suggestionType: current.suggestionType,
        ok: false,
        durationMs: Date.now() - applyStart,
        errorClass: err instanceof Error ? err.name : "Unknown",
      });
      throw err;
    } finally {
      client.release();
    }
  }

  return {
    registerAgent,
    registerApplier,
    generate,
    listPending,
    get,
    accept,
    reject,
    apply,
  };
}
