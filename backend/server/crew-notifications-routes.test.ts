import { describe, expect, it, vi } from "vitest";

import {
  resolveChannel,
  createCrewNotificationsRouter,
} from "./crew-notifications-routes.js";

// ── Ren helper ──────────────────────────────────────────────────────────────

describe("resolveChannel", () => {
  it("default: e-post når crew har adresse, ellers in_app", () => {
    expect(resolveChannel(undefined, "a@b.no")).toBe("email");
    expect(resolveChannel(undefined, "")).toBe("in_app");
    expect(resolveChannel(undefined, null)).toBe("in_app");
  });
  it("eksplisitt 'email' uten adresse → in_app (kan ikke levere)", () => {
    expect(resolveChannel("email", "")).toBe("in_app");
    expect(resolveChannel("email", "a@b.no")).toBe("email");
  });
  it("eksplisitt 'in_app' respekteres selv med adresse", () => {
    expect(resolveChannel("in_app", "a@b.no")).toBe("in_app");
  });
  it("'push' (ikke implementert) → in_app", () => {
    expect(resolveChannel("push", "a@b.no")).toBe("in_app");
  });
});

// ── Router-harness ──────────────────────────────────────────────────────────

function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) {
      out.push({
        method: Object.keys(layer.route.methods)[0].toUpperCase(),
        path: layer.route.path,
        stack: layer.route.stack.map((s: any) => s.handle),
      });
    }
  }
  return out;
}
function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}
async function runChain(stack: any[], req: any, res: any) {
  // Kjør hver middleware sekvensielt og AVVENT den fullt ut. En middleware
  // som ikke kaller next() (svarte/feilet) stopper kjeden. (Express-middleware
  // kaller next() uten await, så vi kan ikke la next drive kjeden selv.)
  for (const h of stack) {
    let nextCalled = false;
    await h(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
}

// Fake pool som svarer på de spesifikke spørringene ruteren gjør.
function makePool(opts: { crew: { id: string; project_id: string; name: string; email: string | null } | null }) {
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("FROM casting_crew WHERE id")) {
        return { rows: opts.crew ? [opts.crew] : [] };
      }
      if (sql.includes("INSERT INTO role_room_crew_notifications")) {
        const [id, crew_id, project_id, event_id, notification_type, channel, title, message, payload, status] = params;
        const row = { id, crew_id, project_id, event_id, notification_type, channel, title, message, payload: JSON.parse(payload), status, sent_at: status === "sent" ? new Date(0).toISOString() : null, read_at: null, created_at: new Date(0).toISOString() };
        inserts.push(row);
        return { rows: [row] };
      }
      if (sql.includes("SELECT * FROM role_room_crew_notifications WHERE crew_id")) {
        return { rows: inserts };
      }
      if (sql.includes("JOIN casting_crew c ON c.id = n.crew_id")) {
        const n = inserts.find((r) => r.id === params[0]);
        return { rows: n ? [{ ...n, crew_project_id: opts.crew?.project_id }] : [] };
      }
      if (sql.includes("UPDATE role_room_crew_notifications SET status = 'read'")) {
        const n = inserts.find((r) => r.id === params[0]);
        return { rows: [{ ...n, status: "read", read_at: new Date(0).toISOString() }] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "u1", email: "", name: "", role: "user", loginAt: "" }]]);
const allow = async () => true;

function router(pool: any, sendEmailImpl?: any, canAccessImpl: any = allow) {
  return mountHandlers(createCrewNotificationsRouter(pool, { activeSessions: sessions as any, sendEmailImpl, canAccessImpl }));
}
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any, query?: any) => ({ headers: { authorization: "Bearer tok-1" }, body, params: params ?? {}, query: query ?? {} });

describe("POST /crew/:crewId/notifications", () => {
  const crew = { id: "crew-1", project_id: "proj-1", name: "Kari", email: "kari@film.no" };

  it("crew med e-post + ingen kanal → sender e-post, lagrer channel=email status=sent", async () => {
    const { pool, inserts } = makePool({ crew });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });
    const rs = router(pool, sendEmail);
    const res = makeRes();
    await runChain(H(rs, "POST", "/crew/:crewId/notifications"), authed({ title: "Ny tildeling", message: "Du er tildelt: Scene 4", event_id: "ev-1" }, { crewId: "crew-1" }), res);

    expect(res.statusCode).toBe(201);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "kari@film.no", subject: "Ny tildeling" });
    expect(inserts[0]).toMatchObject({ channel: "email", status: "sent", crew_id: "crew-1", project_id: "proj-1" });
    expect(res.body.notification.channel).toBe("email");
  });

  it("crew UTEN e-post → in_app, ingen e-post sendt", async () => {
    const { pool, inserts } = makePool({ crew: { ...crew, email: null } });
    const sendEmail = vi.fn().mockResolvedValue({ sent: true });
    const rs = router(pool, sendEmail);
    const res = makeRes();
    await runChain(H(rs, "POST", "/crew/:crewId/notifications"), authed({ title: "T" }, { crewId: "crew-1" }), res);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(inserts[0].channel).toBe("in_app");
  });

  it("uten tittel → 400", async () => {
    const { pool } = makePool({ crew });
    const res = makeRes();
    await runChain(H(router(pool, vi.fn()), "POST", "/crew/:crewId/notifications"), authed({}, { crewId: "crew-1" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool({ crew });
    const res = makeRes();
    await runChain(H(router(pool, vi.fn()), "POST", "/crew/:crewId/notifications"), { headers: {}, body: { title: "T" }, params: { crewId: "crew-1" }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("ukjent crew → 404", async () => {
    const { pool } = makePool({ crew: null });
    const res = makeRes();
    await runChain(H(router(pool, vi.fn()), "POST", "/crew/:crewId/notifications"), authed({ title: "T" }, { crewId: "nope" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("uten prosjekt-tilgang → 403 (og ingen e-post)", async () => {
    const { pool } = makePool({ crew });
    const sendEmail = vi.fn();
    const res = makeRes();
    await runChain(H(router(pool, sendEmail, async () => false), "POST", "/crew/:crewId/notifications"), authed({ title: "T" }, { crewId: "crew-1" }), res);
    expect(res.statusCode).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("GET + PUT read", () => {
  const crew = { id: "crew-1", project_id: "proj-1", name: "Kari", email: "kari@film.no" };

  it("list returnerer opprettede notifikasjoner; marker-lest setter status=read", async () => {
    const { pool } = makePool({ crew });
    const rs = router(pool, vi.fn().mockResolvedValue({ sent: true }));
    // opprett én
    const created = makeRes();
    await runChain(H(rs, "POST", "/crew/:crewId/notifications"), authed({ title: "A" }, { crewId: "crew-1" }), created);
    const notifId = created.body.notification.id;

    const listed = makeRes();
    await runChain(H(rs, "GET", "/crew/:crewId/notifications"), authed(undefined, { crewId: "crew-1" }), listed);
    expect(listed.body.notifications).toHaveLength(1);

    const read = makeRes();
    await runChain(H(rs, "PUT", "/notifications/:notificationId/read"), authed(undefined, { notificationId: notifId }), read);
    expect(read.body.notification.status).toBe("read");
  });
});
