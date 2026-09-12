import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  anonymousCandidateLabel,
  buildDeterministicRevisionBrief,
} from "./sound-room-operating-system";
import { setupSoundRoomOperatingSystemRoutes } from "./sound-room-operating-system-routes";

const PROJECT_ID = "00000000-0000-4000-8000-000000000101";
const DECISION_ID = "00000000-0000-4000-8000-000000000102";
const VERSION_A = "00000000-0000-4000-8000-000000000103";
const VERSION_B = "00000000-0000-4000-8000-000000000104";
const MEMBER_ID = "00000000-0000-4000-8000-000000000105";
const MANIFEST_ID = "00000000-0000-4000-8000-000000000106";
const DELIVERABLE_ID = "00000000-0000-4000-8000-000000000107";

describe("Sound Room Producer OS", () => {
  it("builds an actionable deterministic brief grouped by priority", () => {
    const result = buildDeterministicRevisionBrief("Nordlys", [
      { id: "c1", body: "Vokalen må opp", category: "balance", status: "unresolved", author: "Ada", timecode_seconds: 64 },
      { id: "c2", body: "Bassen er for høy", category: "balance", status: "in_progress", author: "Ola", timecode_seconds: 70 },
      { id: "c3", body: "Godkjent", category: "vocal", status: "resolved", author: "Ada", timecode_seconds: 15 },
    ]);

    expect(result.title).toContain("Nordlys");
    expect(result.unresolvedCount).toBe(2);
    expect(result.resolvedCount).toBe(1);
    expect(result.priorities[0]).toMatchObject({
      title: "Balanse og nivå",
      commentIds: ["c1", "c2"],
      timecodes: [64, 70],
    });
    expect(result.conflicts[0]).toContain("Ada, Ola");
    expect(result.generationMode).toBe("deterministic");
  });

  it("uses stable anonymous candidate labels", () => {
    expect([0, 1, 2, 26].map(anonymousCandidateLabel)).toEqual([
      "Versjon A", "Versjon B", "Versjon C", "Versjon 27",
    ]);
  });

  it("rejects private command-center access without a session", async () => {
    const query = vi.fn();
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({
      app,
      pool: { query },
      requireUserSession: (_req, res) => {
        res.status(401).json({ error: "authentication_required" });
        return null;
      },
    });

    const response = await request(app).get("/api/sound-room/command-center");
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("prevents an owner from closing another tenant's decision", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM audio_decision_rooms d JOIN audio_review_projects")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({
      app,
      pool: { query },
      requireUserSession: () => ({ userId: "producer-1", name: "Produsent" }),
    });

    const response = await request(app)
      .post(`/api/sound-room/decisions/${DECISION_ID}/close`)
      .send({ winnerVersionId: VERSION_A });
    expect(response.status).toBe(404);
  });

  it("validates every version in a new decision against the project", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("FROM audio_review_versions") && sql.includes("ANY")) return { rows: [{ id: VERSION_A }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({
      app,
      pool: { query },
      requireUserSession: () => ({ userId: "producer-1", name: "Produsent" }),
    });

    const response = await request(app)
      .post(`/api/sound-room/projects/${PROJECT_ID}/decisions`)
      .send({ versionIds: [VERSION_A, VERSION_B] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("version_outside_project");
  });

  it("scopes a shared vote to the member project and allowed candidates", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("WHERE m.invite_token")) return { rows: [{ member_id: "00000000-0000-4000-8000-000000000105", name: "Artist", project_id: PROJECT_ID }], rowCount: 1 };
      if (sql.includes("SELECT status,closes_at")) return { rows: [{ status: "open", closes_at: null }], rowCount: 1 };
      if (sql.includes("FROM audio_decision_candidates")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({ app, pool: { query }, requireUserSession: () => null });

    const response = await request(app)
      .post(`/api/audio-review-shared/inv_validtoken/decisions/${DECISION_ID}/vote`)
      .send({ versionId: VERSION_A });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_candidate");
  });

  it("removes private candidate data from a blind shared decision", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("WHERE m.invite_token")) return { rows: [{ member_id: MEMBER_ID, name: "Artist", role: "Artist", can_approve: false, project_id: PROJECT_ID }], rowCount: 1 };
      if (sql.includes("FROM audio_decision_rooms d")) return { rows: [{ id: DECISION_ID, status: "open", blind: true, candidates: [{ version_id: VERSION_A, version_label: "Secret master.wav", version_number: 7, file_url: "https://private.example/secret-master.wav", votes: 9 }], vote_count: 9 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({ app, pool: { query }, requireUserSession: () => null });

    const response = await request(app).get("/api/audio-review-shared/inv_validtoken/os");
    expect(response.status).toBe(200);
    expect(response.body.decisions[0].candidates[0]).toEqual(expect.objectContaining({
      version_id: VERSION_A,
      version_label: "Versjon A",
      version_number: null,
    }));
    expect(response.body.decisions[0].candidates[0]).not.toHaveProperty("file_url");
    expect(response.body.decisions[0].candidates[0]).not.toHaveProperty("votes");
    expect(response.body.decisions[0]).not.toHaveProperty("vote_count");
  });

  it("creates a delivery manifest and its items in one locked transaction", async () => {
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("MAX(manifest_number)")) return { rows: [{ number: 4 }], rowCount: 1 };
      if (sql.includes("INSERT INTO audio_delivery_manifests")) return { rows: [{ id: MANIFEST_ID, project_id: PROJECT_ID, manifest_number: 4, status: "ready" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const release = vi.fn();
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT title FROM audio_review_projects")) return { rows: [{ title: "Nordlys" }], rowCount: 1 };
      if (sql.includes("FROM audio_review_deliverables")) return { rows: [{ id: DELIVERABLE_ID, version_id: VERSION_A, file_name: "Nordlys.wav", file_url: "/api/audio/file/nordlys", format: "wav", file_size: 1024 }], rowCount: 1 };
      if (sql.includes("unresolved_comments")) return { rows: [{ unresolved_comments: 0, incomplete_signoffs: 0 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupSoundRoomOperatingSystemRoutes({
      app,
      pool: { query, connect: async () => ({ query: clientQuery, release }) },
      requireUserSession: () => ({ userId: "producer-1", name: "Produsent" }),
    });

    const response = await request(app).post(`/api/sound-room/projects/${PROJECT_ID}/manifests`).send({});
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: MANIFEST_ID, manifest_number: 4, item_count: 1 });
    const transactionSql = clientQuery.mock.calls.map(([sql]) => String(sql));
    expect(transactionSql[0]).toBe("BEGIN");
    expect(transactionSql.some((sql) => sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(transactionSql.some((sql) => sql.includes("INSERT INTO audio_delivery_manifest_items"))).toBe(true);
    expect(transactionSql.at(-1)).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
