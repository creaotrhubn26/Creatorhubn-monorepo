import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  CanvasServiceError,
  MAX_CANVAS_NOTE_BYTES,
  createCanvasNote,
  parseCanvasNoteFields,
  parseCanvasPdf,
  permanentlyDeleteCanvasNote,
  purgeExpiredCanvasTrash,
  snapshotFromRow,
  storeCanvasPdf,
  upsertCanvasLibraryElement,
  updateCanvasNote,
  type CanvasNoteRow,
} from "./leadgrid-canvas-service.js";
import { requestCanvasRevision } from "./leadgrid-canvas-routes.js";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";

function noteRow(overrides: Partial<CanvasNoteRow> = {}): CanvasNoteRow {
  return {
    id: NOTE_ID,
    organization_id: "org-a",
    user_id: "user-a",
    tittel: "Før",
    kategori: "mote",
    selskap: "Acme",
    lead_id: "lead-1",
    drawing_base64: "drawing-a",
    delt: false,
    lat: 59.91,
    lon: 10.75,
    stempler: "[]",
    tekstbokser: "[]",
    figurer: "[]",
    papir: "blank",
    noder: "[]",
    sider: 1,
    objekter: "[]",
    sokbar_tekst: "før",
    dokumenter: "[]",
    revision: 3,
    slettet_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

function transactionPool(row: CanvasNoteRow) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: string, values?: unknown[]) => {
    const sql = String(sqlValue);
    calls.push({ sql, values });
    if (sql.includes("SELECT * FROM leadgrid_canvas_notater")) {
      return { rows: [row], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { pool, calls, client };
}

afterEach(() => {
  delete process.env.CANVAS_REQUIRE_IF_MATCH;
  delete process.env.CANVAS_ALLOW_MISSING_IF_MATCH;
});
describe("Canvas payload and snapshot integrity", () => {
  it("canonicalizes arrays and rejects malformed JSON instead of slicing it", () => {
    const parsed = parseCanvasNoteFields({
      kategori: "mote",
      stempler: '[ { "id": 1 } ]',
    });
    expect(parsed.stempler).toBe('[{"id":1}]');
    expect(() => parseCanvasNoteFields({ stempler: "[" })).toThrowError(
      expect.objectContaining({ code: "invalid_canvas_json", status: 400 }),
    );
  });

  it("serializes every mutable note field in a schema-v1 snapshot", () => {
    expect(snapshotFromRow(noteRow())).toEqual(
      expect.objectContaining({
        tittel: "Før",
        selskap: "Acme",
        lead_id: "lead-1",
        drawing_base64: "drawing-a",
        stempler: "[]",
        tekstbokser: "[]",
        figurer: "[]",
        noder: "[]",
        objekter: "[]",
        dokumenter: "[]",
        slettet_at: null,
      }),
    );
  });

  it("validates decoded PDF bytes and hashes immutable content", () => {
    const bytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const parsed = parseCanvasPdf({
      id: "pdf_1",
      navn: "avtale.pdf",
      base64: bytes.toString("base64"),
    });
    expect(parsed.byteSize).toBe(bytes.length);
    expect(parsed.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      parseCanvasPdf({
        id: "pdf_2",
        navn: "tekst.pdf",
        base64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).toThrowError(expect.objectContaining({ code: "document_must_be_pdf" }));
    expect(() =>
      parseCanvasPdf({
        id: "pdf_3",
        navn: "skjult.pdf",
        base64: Buffer.from("junk%PDF-1.7\n%%EOF").toString("base64"),
      }),
    ).toThrowError(expect.objectContaining({ code: "document_must_be_pdf" }));
  });

  it("enforces an aggregate note payload budget", () => {
    expect(() => parseCanvasNoteFields({
      kategori: "mote",
      objekter: JSON.stringify(["x".repeat(MAX_CANVAS_NOTE_BYTES)]),
    })).toThrowError(expect.objectContaining({
      status: 413,
      code: "canvas_field_too_large",
    }));

    const drawing = "d".repeat(5 * 1024 * 1024);
    const objekter = JSON.stringify(["o".repeat(11 * 1024 * 1024)]);
    const dokumenter = JSON.stringify(["p".repeat(9 * 1024 * 1024)]);
    expect(() => parseCanvasNoteFields({
      kategori: "mote",
      drawing_base64: drawing,
      objekter,
      dokumenter,
    })).toThrowError(expect.objectContaining({
      status: 413,
      code: "canvas_note_too_large",
      details: { maxBytes: MAX_CANVAS_NOTE_BYTES },
    }));
  });

  it("returns the persisted revision for a same-owner stable-ID retry", async () => {
    const row = noteRow({ tittel: "Persisted", revision: 5 });
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [row], rowCount: 1 }),
    } as unknown as Pool;
    const result = await createCanvasNote(
      pool,
      { organizationId: "org-a", userId: "user-a" },
      parseCanvasNoteFields({ tittel: "Local draft", kategori: "mote" }),
      NOTE_ID,
    );
    expect(result).toEqual({ id: NOTE_ID, revision: 5, created: false });
  });

  it("enforces the per-note PDF quota while holding the parent lock", async () => {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (sqlValue: string) => {
        const sql = String(sqlValue);
        calls.push(sql);
        if (sql.includes("SELECT * FROM leadgrid_canvas_notater")) {
          return { rows: [noteRow()], rowCount: 1 };
        }
        if (sql.includes("SELECT notat_id")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT COUNT(*)")) {
          return {
            rows: [{ document_count: 50, total_bytes: 0 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const pdf = parseCanvasPdf({
      id: "pdf_quota",
      navn: "quota.pdf",
      base64: Buffer.from("%PDF-1.7\n%%EOF").toString("base64"),
    });
    await expect(
      storeCanvasPdf(
        pool,
        { organizationId: "org-a", userId: "user-a", noteId: NOTE_ID },
        pdf,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 413,
        code: "document_quota_exceeded",
      }),
    );
    expect(
      calls.find((sql) =>
        sql.includes("SELECT * FROM leadgrid_canvas_notater"),
      ),
    ).toContain("FOR UPDATE");
    expect(calls.at(-1)).toBe("ROLLBACK");
  });
});

describe("Canvas OCC transaction", () => {
  it("scopes the lock, stores a full snapshot, bumps revision, and commits", async () => {
    const { pool, calls } = transactionPool(noteRow());
    const fields = parseCanvasNoteFields({
      tittel: "Etter",
      kategori: "mote",
      selskap: "Acme",
      lead_id: "lead-1",
      drawing_base64: "drawing-b",
    });
    const result = await updateCanvasNote(
      pool,
      { organizationId: "org-a", userId: "user-a", noteId: NOTE_ID },
      fields,
      3,
    );

    expect(result).toEqual({ revision: 4, changed: true });
    expect(calls[0].sql).toBe("BEGIN");
    const lock = calls.find((call) => call.sql.includes("FOR UPDATE"));
    expect(lock?.sql).toContain("organization_id = $2 AND user_id = $3");
    expect(lock?.values).toEqual([NOTE_ID, "org-a", "user-a"]);
    const history = calls.find((call) =>
      call.sql.includes("INSERT INTO leadgrid_canvas_versjoner"),
    );
    const snapshot = JSON.parse(String(history?.values?.[3]));
    expect(snapshot).toEqual(
      expect.objectContaining({
        tittel: "Før",
        selskap: "Acme",
        drawing_base64: "drawing-a",
        dokumenter: "[]",
      }),
    );
    expect(calls.at(-1)?.sql).toBe("COMMIT");
  });

  it("returns 412 with current revision and rolls back a stale write", async () => {
    const { pool, calls } = transactionPool(noteRow({ revision: 7 }));
    const fields = parseCanvasNoteFields({ tittel: "Etter", kategori: "mote" });
    await expect(
      updateCanvasNote(
        pool,
        { organizationId: "org-a", userId: "user-a", noteId: NOTE_ID },
        fields,
        6,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 412,
        code: "revision_conflict",
        details: { currentRevision: 7 },
      }),
    );
    expect(calls.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("requires preconditions unless the explicit legacy flag is enabled", () => {
    expect(() => requestCanvasRevision({ headers: {} } as never)).toThrowError(
      expect.objectContaining<Partial<CanvasServiceError>>({
        status: 428,
        code: "revision_required",
      }),
    );
    process.env.CANVAS_ALLOW_MISSING_IF_MATCH = "true";
    expect(requestCanvasRevision({ headers: {} } as never)).toBeNull();
    expect(
      requestCanvasRevision({
        headers: { "if-match": 'W/"9"' },
      } as never),
    ).toBe(9);
  });

  it("explicitly deletes versions and PDFs before the parent note", async () => {
    const { pool, calls } = transactionPool(noteRow({
      revision: 8,
      slettet_at: new Date("2026-01-10T00:00:00Z"),
    }));
    await expect(permanentlyDeleteCanvasNote(
      pool,
      { organizationId: "org-a", userId: "user-a", noteId: NOTE_ID },
      8,
    )).resolves.toEqual({ revision: 8 });

    const versionDelete = calls.findIndex((call) =>
      call.sql.includes("DELETE FROM leadgrid_canvas_versjoner"));
    const documentDelete = calls.findIndex((call) =>
      call.sql.includes("DELETE FROM leadgrid_canvas_dokumenter"));
    const parentDelete = calls.findIndex((call) =>
      call.sql.includes("DELETE FROM leadgrid_canvas_notater"));
    expect(versionDelete).toBeGreaterThan(0);
    expect(documentDelete).toBeGreaterThan(versionDelete);
    expect(parentDelete).toBeGreaterThan(documentDelete);
    expect(calls[documentDelete].values).toEqual([NOTE_ID]);
    expect(calls.at(-1)?.sql).toBe("COMMIT");
  });

  it("purges expired trash in a bounded child-first transaction", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sqlValue: string, values?: unknown[]) => {
        const sql = String(sqlValue);
        calls.push({ sql, values });
        if (sql.includes("SELECT id") && sql.includes("FOR UPDATE SKIP LOCKED")) {
          return { rows: [{ id: NOTE_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    await expect(purgeExpiredCanvasTrash(pool, 25)).resolves.toBe(1);
    expect(calls.find((call) => call.sql.includes("FOR UPDATE SKIP LOCKED"))?.values)
      .toEqual([25]);
    const deletes = calls
      .filter((call) => call.sql.includes("DELETE FROM leadgrid_canvas_"))
      .map((call) => call.sql);
    expect(deletes[0]).toContain("leadgrid_canvas_versjoner");
    expect(deletes[1]).toContain("leadgrid_canvas_dokumenter");
    expect(deletes[2]).toContain("leadgrid_canvas_notater");
    expect(calls.at(-1)?.sql).toBe("COMMIT");
  });
});

describe("Canvas PDF aggregate quotas", () => {
  it("serializes quota decisions and blocks a full user allocation", async () => {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (sqlValue: string) => {
        const sql = String(sqlValue);
        calls.push(sql);
        if (sql.includes("SELECT * FROM leadgrid_canvas_notater")) {
          return { rows: [noteRow()], rowCount: 1 };
        }
        if (sql.includes("SELECT notat_id")) return { rows: [], rowCount: 0 };
        if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
        if (sql.includes("SELECT COUNT(*)") && sql.includes("notat_id = $1")) {
          return { rows: [{ document_count: 0, total_bytes: 0 }], rowCount: 1 };
        }
        if (sql.includes("SELECT COUNT(*)") && sql.includes("user_id = $2")) {
          return { rows: [{ document_count: 500, total_bytes: 0 }], rowCount: 1 };
        }
        if (sql.includes("SELECT COUNT(*)")) {
          return { rows: [{ document_count: 0, total_bytes: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const pdf = parseCanvasPdf({
      id: "pdf_user_quota",
      navn: "quota.pdf",
      base64: Buffer.from("%PDF-1.7\n%%EOF").toString("base64"),
    });
    await expect(storeCanvasPdf(
      pool,
      { organizationId: "org-a", userId: "user-a", noteId: NOTE_ID },
      pdf,
    )).rejects.toEqual(expect.objectContaining({
      status: 413,
      code: "document_user_quota_exceeded",
    }));
    expect(calls.findIndex((sql) => sql.includes("pg_advisory_xact_lock")))
      .toBeLessThan(calls.findIndex((sql) =>
        sql.includes("SELECT COUNT(*)") && sql.includes("user_id = $2")));
    expect(calls.at(-1)).toBe("ROLLBACK");
  });
});

describe("Canvas aggregate storage quotas", () => {
  it("serializes create and blocks a full per-user note allocation", async () => {
    const client = {
      query: vi.fn(async (sqlValue: string) => {
        const sql = String(sqlValue);
        if (sql.includes("COUNT(*)") && sql.includes("AND user_id = $2")) {
          return { rows: [{ note_count: 500, total_bytes: 0 }], rowCount: 1 };
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ note_count: 0, total_bytes: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    await expect(createCanvasNote(
      pool,
      { organizationId: "org-quota", userId: "user-quota" },
      parseCanvasNoteFields({ tittel: "Ny", kategori: "mote" }),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    )).rejects.toEqual(expect.objectContaining({
      status: 413,
      code: "canvas_user_storage_quota_exceeded",
    }));
    expect(client.query.mock.calls.map((call) => String(call[0])))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("pg_advisory_xact_lock"),
      ]));
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });

  it("blocks a full per-user library allocation before upsert", async () => {
    const client = {
      query: vi.fn(async (sqlValue: string) => {
        const sql = String(sqlValue);
        if (sql.includes("SELECT organization_id")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("COUNT(*)") && sql.includes("AND user_id = $2")) {
          return { rows: [{ item_count: 500, total_bytes: 0 }], rowCount: 1 };
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ item_count: 0, total_bytes: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    await expect(upsertCanvasLibraryElement(
      pool,
      { organizationId: "org-quota", userId: "user-quota" },
      { id: "element_1", name: "Element", content: "{}", shared: false },
    )).rejects.toEqual(expect.objectContaining({
      status: 413,
      code: "canvas_library_user_quota_exceeded",
    }));
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
});
