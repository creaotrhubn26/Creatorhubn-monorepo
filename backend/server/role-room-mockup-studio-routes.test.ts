import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { registerRoleRoomMockupStudioRoutes } from "./role-room-mockup-studio-routes.js";
import { createMockupWebhookSecret, signMockupWebhook, validateMockupWebhookUrl } from "./mockup-review-webhook-service.js";

type Handler = (req: Request, res: Response) => Promise<void> | void;
function harness(result: { rows: unknown[] } = { rows: [] }) {
  const handlers = new Map<string, Handler>();
  const register = (method: string) => (path: string, ...values: unknown[]) => handlers.set(method + " " + path, values.at(-1) as Handler);
  const app = { get: register("GET"), put: register("PUT"), post: register("POST"), patch: register("PATCH"), delete: register("DELETE") } as unknown as Express;
  const query = vi.fn().mockResolvedValue(result);
  registerRoleRoomMockupStudioRoutes(app, { pool: { query } as unknown as Pool, activeSessions: new Map() });
  return { handlers, query };
}
function response() {
  const value = {
    statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string>, contentType: "",
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    send(body: unknown) { this.body = body; return this; },
    redirect(code: number, url: string) { this.statusCode = code; this.body = url; return this; },
    setHeader(name: string, content: string) { this.headers[name] = content; return this; },
    type(content: string) { this.contentType = content; return this; },
  };
  return value as typeof value & Response;
}
const publicLink = (overrides: Record<string, unknown> = {}) => ({
  token_hash: "hashed", share_id: "share-id", project_id: "project", created_by: "owner",
  version_id: "7", access_mode: "approve", require_identity: true, allow_recordings: true,
  allow_version_history: false, comments_paused_at: null, expires_at: null, revoked_at: null,
  project_name: "<script>alert(1)</script>",
  project_payload: { name: "<script>alert(1)</script>", reviewPreview: "data:image/png;base64,AAAA" },
  version_payload: { name: "<script>alert(1)</script>", reviewPreview: "data:image/png;base64,AAAA" },
  version_label: "Review 1", review_status: "in_review", source_revision: 3, project_updated_at: new Date(),
  ...overrides,
});

describe("Mockup Studio Review Room routes", () => {
  it("avviser prosjektlisten uten gyldig sesjon", async () => {
    const { handlers, query } = harness();
    const res = response();
    await handlers.get("GET /api/role-room/mockup-projects")!({ headers: {} } as Request, res);
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("registrerer PATCH-ruter for link- og kommentarinnstillinger", () => {
    const { handlers } = harness();
    expect(handlers.has("PATCH /api/role-room/mockup-projects/:id/shares/:shareId")).toBe(true);
    expect(handlers.has("PATCH /api/role-room/mockup-shared/:token/comments/:commentId")).toBe(true);
  });

  it("krever komplett semantisk elementanker", async () => {
    const { handlers, query } = harness();
    query
      .mockResolvedValueOnce({ rows: [publicLink()] })
      .mockResolvedValueOnce({ rows: [{ id: "r1", display_name: "Daniel", email: "d@example.com", share_token_hash: "hashed" }] });
    const res = response();
    await handlers.get("POST /api/role-room/mockup-shared/:token/comments")!({
      params: { token: "secret" },
      headers: { "x-mockup-reviewer": "reviewer" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { body: "Flytt connector", anchorKind: "element", anchorX: 0.5, anchorY: 0.5 },
    } as unknown as Request, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "ugyldig_elementanker" });
  });

  it("lar en reviewer flytte sin egen pin med normaliserte koordinater", async () => {
    const { handlers, query } = harness();
    query
      .mockResolvedValueOnce({ rows: [publicLink()] })
      .mockResolvedValueOnce({ rows: [{ id: "r1", display_name: "Daniel", email: null, share_token_hash: "hashed" }] })
      .mockResolvedValueOnce({ rows: [{ id: "comment-id" }] });
    const res = response();
    await handlers.get("PATCH /api/role-room/mockup-shared/:token/comments/:commentId")!({
      params: { token: "secret", commentId: "11111111-1111-4111-8111-111111111111" },
      headers: { "x-mockup-reviewer": "reviewer" },
      body: {
        anchorKind: "canvas", anchorRef: null, anchorX: 0.25, anchorY: 0.75,
        anchorOffsetX: null, anchorOffsetY: null, marks: [],
      },
    } as unknown as Request, res);
    expect(res.body).toEqual({ ok: true });
    const update = query.mock.calls.at(-1);
    expect(String(update?.[0])).toContain("anchor_offset_x");
    expect(update?.[1]).toContain(0.25);
    expect(update?.[1]).toContain(0.75);
  });

  it("reserverer reset av godkjenning for interne godkjennere", async () => {
    const { handlers, query } = harness();
    query
      .mockResolvedValueOnce({ rows: [publicLink()] })
      .mockResolvedValueOnce({ rows: [{ id: "r1", display_name: "Daniel", email: null, share_token_hash: "hashed" }] });
    const res = response();
    await handlers.get("POST /api/role-room/mockup-shared/:token/decision")!({
      params: { token: "secret" },
      headers: { "x-mockup-reviewer": "reviewer" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { decision: "reset" },
    } as unknown as Request, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "ugyldig_beslutning" });
  });

  it("escaper prosjektdata og låser HTML-fallback med CSP", async () => {
    const { handlers } = harness({ rows: [publicLink()] });
    const res = response();
    await handlers.get("GET /api/role-room/mockup-shared/:token")!({
      params: { token: "secret" }, headers: { accept: "text/html" },
    } as unknown as Request, res);
    expect(res.contentType).toBe("html");
    expect(String(res.body)).not.toContain("<script>alert(1)</script>");
    expect(String(res.body)).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(res.headers["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("nekter kommentarer fra lenker som bare kan vises", async () => {
    const { handlers } = harness({ rows: [publicLink({ access_mode: "view" })] });
    const res = response();
    await handlers.get("POST /api/role-room/mockup-shared/:token/comments")!({
      params: { token: "secret" }, headers: {}, socket: { remoteAddress: "127.0.0.1" }, body: { body: "Hei" },
    } as unknown as Request, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "kun_visning" });
  });

  it("godkjenning bruker en hash av share-tokenet", async () => {
    const { handlers, query } = harness({ rows: [{ name: "Kampanje" }] });
    const res = response();
    await handlers.get("POST /api/role-room/mockup-shared/:token/approve")!({
      params: { token: "secret" }, headers: { accept: "application/json" },
    } as unknown as Request, res);
    expect(res.body).toEqual({ ok: true, status: "approved" });
    expect(String(query.mock.calls[0][0])).toContain("status='approved'");
    expect(query.mock.calls[0][1][0]).not.toBe("secret");
    expect(query.mock.calls[0][1][0]).toHaveLength(64);
  });
});

describe("Mockup Studio webhook security", () => {
  it("signerer timestamp og body med HMAC-SHA256", () => {
    const expected = "sha256=" + createHmac("sha256", "secret").update("123.{\"ok\":true}").digest("hex");
    expect(signMockupWebhook("secret", "123", "{\"ok\":true}")).toBe(expected);
    expect(createMockupWebhookSecret()).toMatch(/^mws_[A-Za-z0-9_-]{40,}$/);
  });

  it("avviser usikre og lokale webhook-adresser før nettverksoppslag", async () => {
    await expect(validateMockupWebhookUrl("http://example.com/hook")).rejects.toThrow("kun_https_tillatt");
    await expect(validateMockupWebhookUrl("https://localhost/hook")).rejects.toThrow("privat_adresse_ikke_tillatt");
    await expect(validateMockupWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow("privat_adresse_ikke_tillatt");
  });
});
