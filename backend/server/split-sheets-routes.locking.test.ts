import { describe, expect, it, vi } from "vitest";
import { setupSplitSheetsRoutes } from "./split-sheets-routes";

const SHEET_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "owner-1";

type RouteHandler = (req: any, res: any) => Promise<unknown>;

const normalizeSql = (sql: unknown): string =>
  String(sql).replace(/\s+/g, " ").trim();

function createResponse() {
  const response: any = {
    statusCode: 200,
    body: undefined,
  };
  response.status = vi.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = vi.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
}

function createRouteHarness(options: {
  signed: boolean | (() => boolean);
  metadata?: Record<string, unknown>;
  ownerExists?: boolean;
  failOnSql?: (sql: string) => boolean;
  headerLockGate?: Promise<void>;
}) {
  const sqlCalls: string[] = [];
  const client = {
    query: vi.fn(async (sqlInput: unknown) => {
      const sql = normalizeSql(sqlInput);
      sqlCalls.push(sql);
      if (options.failOnSql?.(sql)) {
        throw new Error("forced database failure");
      }
      if (sql.includes("SELECT ss.metadata") && sql.includes("FOR UPDATE OF ss")) {
        if (options.headerLockGate) await options.headerLockGate;
        return options.ownerExists === false
          ? { rowCount: 0, rows: [] }
          : {
              rowCount: 1,
              rows: [{ metadata: options.metadata ?? { agreementVersion: 1 } }],
            };
      }
      if (sql.startsWith("SELECT EXISTS")) {
        const signed = typeof options.signed === "function"
          ? options.signed()
          : options.signed;
        return { rowCount: 1, rows: [{ has_signed: signed }] };
      }
      if (sql.startsWith("SELECT * FROM split_sheets")) {
        return { rowCount: 1, rows: [{ id: SHEET_ID, status: "archived" }] };
      }
      if (sql.startsWith("SELECT * FROM split_sheet_contributors")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async () => {
      throw new Error("mutation escaped the transaction client");
    }),
  };
  const routes = new Map<string, RouteHandler>();
  const app: any = {};
  for (const method of ["get", "post", "put", "delete"]) {
    app[method] = (path: string, ...handlers: RouteHandler[]) => {
      routes.set(`${method.toUpperCase()} ${path}`, handlers[handlers.length - 1]);
      return app;
    };
  }

  setupSplitSheetsRoutes({
    app,
    pool: pool as any,
    getSplitSheetUserId: () => OWNER_ID,
    requireAdminSession: () => ({ id: OWNER_ID }),
  });

  return {
    client,
    pool,
    sqlCalls,
    create: routes.get("POST /api/split-sheets")!,
    put: routes.get("PUT /api/split-sheets/:id")!,
    remove: routes.get("DELETE /api/split-sheets/:id")!,
  };
}

describe("versioned split-sheet agreement locking", () => {
  it("rejects a one-participant versioned share agreement before opening a transaction", async () => {
    const harness = createRouteHarness({ signed: false });
    const response = createResponse();

    await harness.create(
      {
        body: {
          title: "Solo share",
          metadata: { agreementVersion: 1, compensationModel: "share" },
          contributors: [{
            name: "Only participant",
            percentage: 100,
            custom_fields: { compensationType: "share" },
          }],
        },
      },
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("share_agreement_requires_two_participants");
    expect(harness.pool.connect).not.toHaveBeenCalled();
  });

  it("rejects incomplete hourly terms before opening a transaction", async () => {
    const harness = createRouteHarness({ signed: false });
    const response = createResponse();

    await harness.create(
      {
        body: {
          title: "Incomplete hourly assignment",
          metadata: { agreementVersion: 1, compensationModel: "hourly" },
          contributors: [{
            name: "Hourly specialist",
            percentage: 0,
            custom_fields: { compensationType: "hourly", hourlyRate: 1250 },
          }],
        },
      },
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("invalid_hourly_compensation_terms");
    expect(harness.pool.connect).not.toHaveBeenCalled();
  });

  it("locks the header, refreshes signature state, and rejects term edits", async () => {
    const harness = createRouteHarness({ signed: true });
    const response = createResponse();

    await harness.put(
      { params: { id: SHEET_ID }, body: { title: "Changed terms" } },
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe("signed_agreement_locked");
    expect(harness.sqlCalls[0]).toBe("BEGIN");
    const lockIndex = harness.sqlCalls.findIndex((sql) => sql.includes("FOR UPDATE OF ss"));
    const signatureIndex = harness.sqlCalls.findIndex((sql) => sql.startsWith("SELECT EXISTS"));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(signatureIndex).toBeGreaterThan(lockIndex);
    expect(harness.sqlCalls).toContain("ROLLBACK");
    expect(harness.sqlCalls.some((sql) => sql.startsWith("UPDATE split_sheets SET"))).toBe(false);
    expect(harness.pool.query).not.toHaveBeenCalled();
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("allows archiving a signed agreement and commits on the locked client", async () => {
    const harness = createRouteHarness({ signed: true });
    const response = createResponse();

    await harness.put(
      { params: { id: SHEET_ID }, body: { status: "archived" } },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(harness.sqlCalls[0]).toBe("BEGIN");
    const updateIndex = harness.sqlCalls.findIndex((sql) => sql.startsWith("UPDATE split_sheets SET"));
    const commitIndex = harness.sqlCalls.indexOf("COMMIT");
    expect(updateIndex).toBeGreaterThan(
      harness.sqlCalls.findIndex((sql) => sql.startsWith("SELECT EXISTS")),
    );
    expect(commitIndex).toBeGreaterThan(updateIndex);
    expect(harness.sqlCalls).not.toContain("ROLLBACK");
    expect(harness.pool.query).not.toHaveBeenCalled();
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("rejects deletion after a signature without deleting child evidence", async () => {
    const harness = createRouteHarness({ signed: true });
    const response = createResponse();

    await harness.remove({ params: { id: SHEET_ID } }, response);

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe("signed_agreement_locked");
    expect(harness.sqlCalls[0]).toBe("BEGIN");
    expect(harness.sqlCalls).toContain("ROLLBACK");
    expect(harness.sqlCalls.some((sql) => sql.startsWith("DELETE FROM"))).toBe(false);
    expect(harness.pool.query).not.toHaveBeenCalled();
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("deletes an unsigned agreement atomically", async () => {
    const harness = createRouteHarness({ signed: false });
    const response = createResponse();

    await harness.remove({ params: { id: SHEET_ID } }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(harness.sqlCalls[0]).toBe("BEGIN");
    const parentDeleteIndex = harness.sqlCalls.findIndex(
      (sql) => sql === "DELETE FROM split_sheets WHERE id = $1",
    );
    expect(parentDeleteIndex).toBeGreaterThan(
      harness.sqlCalls.findIndex((sql) => sql.startsWith("SELECT EXISTS")),
    );
    expect(harness.sqlCalls.indexOf("COMMIT")).toBeGreaterThan(parentDeleteIndex);
    expect(harness.pool.query).not.toHaveBeenCalled();
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the client when a mandatory delete fails", async () => {
    const harness = createRouteHarness({
      signed: false,
      failOnSql: (sql) => sql.startsWith("DELETE FROM split_sheet_comments"),
    });
    const response = createResponse();

    await harness.remove({ params: { id: SHEET_ID } }, response);

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe("Failed to delete split sheet");
    expect(harness.sqlCalls).toContain("ROLLBACK");
    expect(harness.sqlCalls).not.toContain("COMMIT");
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("refreshes signature state after a simulated wait on the header lock", async () => {
    let signed = false;
    let releaseHeaderLock: () => void = () => undefined;
    const headerLockGate = new Promise<void>((resolve) => {
      releaseHeaderLock = resolve;
    });
    const harness = createRouteHarness({
      signed: () => signed,
      headerLockGate,
    });
    const response = createResponse();

    const pendingUpdate = harness.put(
      { params: { id: SHEET_ID }, body: { title: "Changed while waiting" } },
      response,
    );
    await vi.waitFor(() => {
      expect(harness.sqlCalls.some((sql) => sql.includes("FOR UPDATE OF ss"))).toBe(true);
    });

    // Models another transaction committing the first signature while this
    // request is blocked on the parent row. The separate SELECT EXISTS must
    // read this new state after the lock is granted.
    signed = true;
    releaseHeaderLock();
    await pendingUpdate;

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe("signed_agreement_locked");
    expect(harness.sqlCalls.findIndex((sql) => sql.startsWith("SELECT EXISTS"))).toBeGreaterThan(
      harness.sqlCalls.findIndex((sql) => sql.includes("FOR UPDATE OF ss")),
    );
    expect(harness.sqlCalls).toContain("ROLLBACK");
  });

  it("replaces contributors atomically on the transaction client before signing", async () => {
    const harness = createRouteHarness({ signed: false });
    const response = createResponse();

    await harness.put(
      {
        params: { id: SHEET_ID },
        body: {
          contributors: [{
            name: "Hourly specialist",
            email: "specialist@example.com",
            role: "collaborator",
            percentage: 0,
            custom_fields: { compensationType: "hourly", hourlyRate: 1250, estimatedHours: 8 },
          }],
        },
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(harness.sqlCalls[0]).toBe("BEGIN");
    const deleteIndex = harness.sqlCalls.findIndex((sql) =>
      sql.startsWith("DELETE FROM split_sheet_contributors"),
    );
    const insertIndex = harness.sqlCalls.findIndex((sql) =>
      sql.startsWith("INSERT INTO split_sheet_contributors"),
    );
    const totalIndex = harness.sqlCalls.findIndex((sql) =>
      sql.startsWith("UPDATE split_sheets SET total_percentage"),
    );
    const commitIndex = harness.sqlCalls.indexOf("COMMIT");
    expect(deleteIndex).toBeGreaterThan(
      harness.sqlCalls.findIndex((sql) => sql.startsWith("SELECT EXISTS")),
    );
    expect(insertIndex).toBeGreaterThan(deleteIndex);
    expect(totalIndex).toBeGreaterThan(insertIndex);
    expect(commitIndex).toBeGreaterThan(totalIndex);
    expect(harness.pool.query).not.toHaveBeenCalled();
  });

  it("rolls back the complete update when contributor replacement fails", async () => {
    const harness = createRouteHarness({
      signed: false,
      failOnSql: (sql) => sql.startsWith("INSERT INTO split_sheet_contributors"),
    });
    const response = createResponse();

    await harness.put(
      {
        params: { id: SHEET_ID },
        body: {
          contributors: [
            { name: "Will fail A", percentage: 50 },
            { name: "Will fail B", percentage: 50 },
          ],
        },
      },
      response,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe("Failed to update split sheet");
    expect(harness.sqlCalls).toContain("ROLLBACK");
    expect(harness.sqlCalls).not.toContain("COMMIT");
    expect(harness.client.release).toHaveBeenCalledOnce();
  });

  it("recovers an optional revenue-table delete with a savepoint and commits", async () => {
    const harness = createRouteHarness({
      signed: false,
      failOnSql: (sql) => sql === "DELETE FROM split_sheet_revenue WHERE split_sheet_id = $1",
    });
    const response = createResponse();

    await harness.remove({ params: { id: SHEET_ID } }, response);

    expect(response.statusCode).toBe(200);
    expect(harness.sqlCalls).toContain("SAVEPOINT delete_split_sheet_revenue");
    expect(harness.sqlCalls).toContain("ROLLBACK TO SAVEPOINT delete_split_sheet_revenue");
    expect(harness.sqlCalls).toContain("RELEASE SAVEPOINT delete_split_sheet_revenue");
    expect(harness.sqlCalls).toContain("DELETE FROM split_sheets WHERE id = $1");
    expect(harness.sqlCalls).toContain("COMMIT");
    expect(harness.sqlCalls).not.toContain("ROLLBACK");
  });

  it("preserves legacy behavior for signed but unversioned sheets", async () => {
    const harness = createRouteHarness({ signed: true, metadata: {} });
    const response = createResponse();

    await harness.put(
      { params: { id: SHEET_ID }, body: { title: "Legacy title update" } },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(harness.sqlCalls.some((sql) => sql.startsWith("UPDATE split_sheets SET"))).toBe(true);
    expect(harness.sqlCalls).toContain("COMMIT");
    expect(harness.sqlCalls).not.toContain("ROLLBACK");
  });

  it("rejects relabeling legacy signatures as versioned personal signatures", async () => {
    const harness = createRouteHarness({ signed: true, metadata: {} });
    const response = createResponse();

    await harness.put(
      {
        params: { id: SHEET_ID },
        body: { metadata: { agreementVersion: 1, compensationModel: "share" } },
      },
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe("personal_signing_required");
    expect(harness.sqlCalls).toContain("ROLLBACK");
    expect(harness.sqlCalls.some((sql) => sql.startsWith("UPDATE split_sheets SET"))).toBe(false);
  });
});
