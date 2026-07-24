import { describe, expect, it, vi } from "vitest";

import { createEducationResourcesRouter } from "./role-room-education-resources-routes.js";

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
  for (const h of stack) {
    let nextCalled = false;
    await h(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
}

function makePool(opts: { resources?: any[]; owns?: boolean } = {}) {
  const inserts: any[] = [];
  const pool: any = {
    query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("INSERT INTO role_room_education_resources")) {
        const [id, owner, title, category] = params;
        const row = { id, owner_user_id: owner, title, category, description: null, url: null, body: null, sort_order: 0, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() };
        inserts.push(row);
        return { rows: [row] };
      }
      if (sql.includes("SELECT * FROM role_room_education_resources")) {
        return { rows: opts.resources ?? [] };
      }
      if (sql.includes("DELETE FROM role_room_education_resources")) {
        return { rows: opts.owns ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, inserts };
}

const sessions = new Map([["tok-1", { userId: "inst-1", email: "", name: "", role: "user", loginAt: "" }]]);
const R = (pool: any) => mountHandlers(createEducationResourcesRouter(pool, { activeSessions: sessions as any }));
const H = (rs: any[], method: string, path: string) => rs.find((x) => x.method === method && x.path === path)!.stack;
const authed = (body?: any, params?: any, query?: any) => ({ headers: { authorization: "Bearer tok-1" }, body, params: params ?? {}, query: query ?? {} });

describe("education resources routes", () => {
  it("POST oppretter (owner=inst-1, category default general ved ugyldig)", async () => {
    const { pool, inserts } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/resources"), authed({ title: "Hva er en call sheet?", category: "tull" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.resource).toMatchObject({ title: "Hva er en call sheet?", category: "general" });
    expect(inserts[0].owner_user_id).toBe("inst-1");
  });

  it("POST beholder gyldig kategori", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/resources"), authed({ title: "Slik caster du", category: "casting" }), res);
    expect(res.body.resource.category).toBe("casting");
  });

  it("POST uten tittel → 400", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/resources"), authed({}), res);
    expect(res.statusCode).toBe(400);
  });

  it("uten Bearer → 401", async () => {
    const { pool } = makePool();
    const res = makeRes();
    await runChain(H(R(pool), "POST", "/education/resources"), { headers: {}, body: { title: "X" }, params: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET lister egne ressurser", async () => {
    const { pool } = makePool({ resources: [{ id: "r1", title: "A", category: "planning", owner_user_id: "inst-1", sort_order: 0, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] });
    const res = makeRes();
    await runChain(H(R(pool), "GET", "/education/resources"), authed(), res);
    expect(res.body.resources).toHaveLength(1);
    expect(res.body.resources[0]).toMatchObject({ category: "planning" });
  });

  it("DELETE ikke-eid → 404", async () => {
    const { pool } = makePool({ owns: false });
    const res = makeRes();
    await runChain(H(R(pool), "DELETE", "/education/resources/:id"), authed(undefined, { id: "r-other" }), res);
    expect(res.statusCode).toBe(404);
  });
});
