import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadExportRoutes } from "./lead-export-routes.js";

describe("Leadgrid direct export route access", () => {
  it.each(["/api/leadgrid/leads/export", "/api/leadgrid/leads/export-summary"])(
    "requires an explicit customer project for %s",
    async (path) => {
      const query = vi.fn();
      const routes = new Map<string, RequestHandler[]>();
      const app = {
        get: (registeredPath: string, ...handlers: RequestHandler[]) =>
          routes.set(`GET ${registeredPath}`, handlers),
      } as unknown as Express;
      registerLeadExportRoutes({
        app,
        pool: { query } as unknown as Pool,
        activeSessions: new Map([["token-a", { userId: "user-a" }]]),
      });

      const handler = routes.get(`GET ${path}`)?.at(-1);
      if (!handler) throw new Error(`Missing route ${path}`);
      const req = {
        headers: { authorization: "Bearer token-a" },
        query: {},
      } as unknown as Request;
      let status = 200;
      let body: unknown;
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
      } as unknown as Response;

      await handler(req, res, vi.fn());

      expect(status).toBe(400);
      expect(body).toEqual({ error: "project_id_required" });
      expect(query).not.toHaveBeenCalled();
    },
  );
});
