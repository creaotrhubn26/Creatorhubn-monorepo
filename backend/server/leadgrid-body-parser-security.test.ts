import express, { type RequestHandler } from "express";
import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  classifyLeadgridJsonBody,
  createLeadgridBodyParserBoundary,
} from "./leadgrid-body-parser-security.js";

function jsonParser(limit: string): RequestHandler {
  return express.json({
    limit,
    strict: true,
    type: ["application/json", "application/*+json"],
  });
}

function buildApp(
  options: {
    authenticated?: boolean;
    maxConcurrentLargeBodies?: number;
    audioParser?: RequestHandler;
  } = {},
) {
  const app = express();
  const resolveSession = vi.fn(async () =>
    options.authenticated === false ? null : { userId: "user-1" },
  );
  app.use(
    "/api/leadgrid",
    createLeadgridBodyParserBoundary({
      resolveSession,
      maxConcurrentLargeBodies: options.maxConcurrentLargeBodies,
      parsers: {
        default: jsonParser("2kb"),
        publicAuth: jsonParser("1kb"),
        canvas: jsonParser("8kb"),
        audio: options.audioParser ?? jsonParser("8kb"),
      },
    }),
  );
  app.use("/api/leadgrid", (req, res) => {
    res.json({ body: req.body ?? null });
  });
  return { app, resolveSession };
}

describe("Leadgrid body parser boundary", () => {
  it("is mounted for the full Leadgrid namespace before the global parser", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const authorityMount = source.indexOf(
      'app.use("/api/leadgrid", leadgridAuthoritativePreBodyGuard)',
    );
    const mount = source.indexOf("createLeadgridBodyParserBoundary({");
    const globalParser = source.indexOf('express.json({ limit: "50mb" })');
    expect(authorityMount).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(authorityMount);
    expect(globalParser).toBeGreaterThan(mount);
  });

  it("guards native namespaces and caps iPad tokens before global parsers", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const globalJson = source.indexOf('express.json({ limit: "50mb" })');
    const globalForm = source.indexOf('express.urlencoded({ limit: "50mb"');

    for (const prefix of [
      "/api/admin-room/lead-map",
      "/api/admin-room/ipad-tokens",
    ]) {
      const authorityMount = source.indexOf(
        `app.use("${prefix}", leadgridAuthoritativePreBodyGuard)`,
      );
      expect(authorityMount).toBeGreaterThan(-1);
      expect(globalJson).toBeGreaterThan(authorityMount);
      expect(globalForm).toBeGreaterThan(authorityMount);
    }

    const nativeTokenBoundary = source.indexOf(
      'app.use("/api/admin-room/ipad-tokens", leadgridBodyParserBoundary)',
    );
    expect(nativeTokenBoundary).toBeGreaterThan(-1);
    expect(globalJson).toBeGreaterThan(nativeTokenBoundary);
    expect(globalForm).toBeGreaterThan(nativeTokenBoundary);

    const nativeLeadMapBoundary = source.indexOf(
      'app.use("/api/admin-room/lead-map", leadgridBodyParserBoundary)',
    );
    const nativeLeadMapAuthority = source.indexOf(
      'app.use("/api/admin-room/lead-map", leadgridAuthoritativePreBodyGuard)',
    );
    expect(nativeLeadMapBoundary).toBeGreaterThan(nativeLeadMapAuthority);
    expect(globalJson).toBeGreaterThan(nativeLeadMapBoundary);
    expect(globalForm).toBeGreaterThan(nativeLeadMapBoundary);

    const exchangeBoundary = source.indexOf(
      'app.use("/api/ipad-tokens/exchange", leadgridBodyParserBoundary)',
    );
    expect(exchangeBoundary).toBeGreaterThan(-1);
    expect(globalJson).toBeGreaterThan(exchangeBoundary);
  });

  it("classifies only the documented large JSON write routes", () => {
    expect(
      classifyLeadgridJsonBody("POST", "/api/leadgrid/self-onboard"),
    ).toBe("publicAuth");
    expect(
      classifyLeadgridJsonBody(
        "POST",
        "/api/leadgrid/self-onboard/consume-magic",
      ),
    ).toBe("publicAuth");
    expect(
      classifyLeadgridJsonBody("POST", "/api/ipad-tokens/exchange"),
    ).toBe("publicAuth");
    expect(classifyLeadgridJsonBody("POST", "/api/leadgrid/canvas")).toBe(
      "canvas",
    );
    expect(classifyLeadgridJsonBody("PUT", "/api/leadgrid/canvas/note-1")).toBe(
      "canvas",
    );
    expect(
      classifyLeadgridJsonBody(
        "POST",
        "/api/leadgrid/canvas/note-1/dokumenter",
      ),
    ).toBe("canvas");
    expect(
      classifyLeadgridJsonBody(
        "POST",
        "/api/leadgrid/leads/lead-1/meeting-notes/upload-audio",
      ),
    ).toBe("audio");
    expect(
      classifyLeadgridJsonBody(
        "POST",
        "/api/admin-room/lead-map/pitch-deck/slides/slide-1/mockup",
      ),
    ).toBe("canvas");
    expect(
      classifyLeadgridJsonBody("POST", "/api/leadgrid/canvas/bibliotek"),
    ).toBe("default");
    expect(
      classifyLeadgridJsonBody("POST", "/api/leadgrid/not-a-real-route"),
    ).toBe("default");
  });

  it("requires JSON and caps public auth bodies before the global parser", async () => {
    const { app } = buildApp();
    app.use(express.json({ limit: "50mb" }));

    await request(app)
      .post("/api/leadgrid/self-onboard")
      .type("form")
      .send({ email: "owner@example.test" })
      .expect(415, { error: "content_type_must_be_json" });

    await request(app)
      .post("/api/leadgrid/self-onboard")
      .send({ value: "x".repeat(2 * 1024) })
      .expect(413, { error: "request_body_too_large" });
  });

  it("caps unknown Leadgrid JSON routes before a later global parser", async () => {
    const { app, resolveSession } = buildApp();
    app.use(express.json({ limit: "50mb" }));

    await request(app)
      .post("/api/leadgrid/not-a-real-route")
      .send({ value: "x".repeat(3 * 1024) })
      .expect(413, { error: "request_body_too_large" });
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it("keeps public iPad exchange JSON-only and within its 16 KiB envelope", async () => {
    const app = express();
    const boundary = createLeadgridBodyParserBoundary({
      resolveSession: vi.fn(),
      parsers: {
        default: jsonParser("2kb"),
        publicAuth: jsonParser("1kb"),
        canvas: jsonParser("8kb"),
        audio: jsonParser("8kb"),
      },
    });
    app.use("/api/ipad-tokens/exchange", boundary);
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));
    app.post("/api/ipad-tokens/exchange", (req, res) => {
      res.json({ body: req.body });
    });

    await request(app)
      .post("/api/ipad-tokens/exchange")
      .type("form")
      .send({ pair_code: "123456" })
      .expect(415, { error: "content_type_must_be_json" });
    await request(app)
      .post("/api/ipad-tokens/exchange")
      .send({ pair_code: "x".repeat(2 * 1024) })
      .expect(413, { error: "request_body_too_large" });
    await request(app)
      .post("/api/ipad-tokens/exchange")
      .send({ pair_code: "123456" })
      .expect(200)
      .expect(({ body }) => expect(body.body.pair_code).toBe("123456"));
  });

  it("does not let a duplicate slash bypass the public exchange JSON contract", async () => {
    const app = express();
    app.use(createLeadgridBodyParserBoundary({
      resolveSession: vi.fn(),
      parsers: {
        default: jsonParser("2kb"),
        publicAuth: jsonParser("1kb"),
        canvas: jsonParser("8kb"),
        audio: jsonParser("8kb"),
      },
    }));

    await request(app)
      .post("/api//ipad-tokens/exchange")
      .set("Content-Type", "text/plain")
      .send("pair_code=123456")
      .expect(415, { error: "content_type_must_be_json" });
  });

  it("rejects unauthenticated native GET bodies before any parser runs", async () => {
    const app = express();
    const parser = vi.fn<RequestHandler>((_req, _res, next) => next());
    const authority = vi.fn<RequestHandler>((_req, res) => {
      res.status(401).json({ error: "authentication_required" });
    });
    app.use("/api/admin-room/lead-map", authority);
    app.use(
      "/api/admin-room/lead-map",
      createLeadgridBodyParserBoundary({
        resolveSession: vi.fn(),
        parsers: {
          default: parser,
          publicAuth: parser,
          canvas: parser,
          audio: parser,
          form: parser,
        },
      }),
    );
    app.use(express.json({ limit: "50mb" }));
    app.get("/api/admin-room/lead-map/leads", (_req, res) => res.sendStatus(200));

    await request(app)
      .get("/api/admin-room/lead-map/leads")
      .set("Content-Type", "application/json")
      .send({ padding: "x".repeat(4 * 1024) })
      .expect(401, { error: "authentication_required" });

    expect(authority).toHaveBeenCalledOnce();
    expect(parser).not.toHaveBeenCalled();
  });

  it("caps ordinary Lead Map JSON while preserving the documented mockup envelope", async () => {
    const app = express();
    const resolveSession = vi.fn(async () => ({ userId: "user-1" }));
    const boundary = createLeadgridBodyParserBoundary({
      resolveSession,
      parsers: {
        default: jsonParser("2kb"),
        publicAuth: jsonParser("1kb"),
        canvas: jsonParser("8kb"),
        audio: jsonParser("8kb"),
      },
    });
    app.use("/api/admin-room/lead-map", boundary);
    app.use(express.json({ limit: "50mb" }));
    app.post("/api/admin-room/lead-map/leads", (_req, res) => {
      res.json({ reached: true });
    });
    app.post(
      "/api/admin-room/lead-map/pitch-deck/slides/:id/mockup",
      (req, res) => res.json({ size: String(req.body.data_base64).length }),
    );

    await request(app)
      .post("/api/admin-room/lead-map/leads")
      .send({ value: "x".repeat(3 * 1024) })
      .expect(413, { error: "request_body_too_large" });

    await request(app)
      .post("/api/admin-room/lead-map/pitch-deck/slides/slide-1/mockup")
      .send({ data_base64: "x".repeat(4 * 1024) })
      .expect(200, { size: 4 * 1024 });
    expect(resolveSession).toHaveBeenCalledOnce();
  });

  it("applies the same small cap to chunked unknown requests", async () => {
    const { app } = buildApp();

    await new Promise<void>((resolve, reject) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("missing test server address"));
          return;
        }
        const http = import("node:http");
        void http.then(({ request: createRequest }) => {
          const req = createRequest(
            {
              host: "127.0.0.1",
              port: address.port,
              path: "/api/leadgrid/unknown-chunked",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Transfer-Encoding": "chunked",
              },
            },
            (res) => {
              res.resume();
              res.once("end", () => {
                try {
                  expect(res.statusCode).toBe(413);
                  server.close((error) => (error ? reject(error) : resolve()));
                } catch (error) {
                  server.close(() => reject(error));
                }
              });
            },
          );
          req.once("error", (error) => server.close(() => reject(error)));
          req.write('{"value":"');
          req.write("x".repeat(3 * 1024));
          req.end('"}');
        });
      });
    });
  });

  it("rejects a large-route body before parsing when the session is invalid", async () => {
    const parser = vi.fn<RequestHandler>((_req, _res, next) => next());
    const { app, resolveSession } = buildApp({
      authenticated: false,
      audioParser: parser,
    });

    await request(app)
      .post("/api/leadgrid/leads/lead-1/meeting-notes/upload-audio")
      .set("Authorization", "Bearer invalid")
      .send({ audio_base64: "x".repeat(4 * 1024) })
      .expect(401, { error: "authentication_required" });

    expect(resolveSession).toHaveBeenCalledOnce();
    expect(parser).not.toHaveBeenCalled();
  });

  it("allows documented large routes through their explicit parser after auth", async () => {
    const { app, resolveSession } = buildApp();

    await request(app)
      .post("/api/leadgrid/canvas")
      .set("Authorization", "Bearer valid")
      .send({ drawing_base64: "x".repeat(4 * 1024) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.body.drawing_base64).toHaveLength(4 * 1024);
      });
    expect(resolveSession).toHaveBeenCalledOnce();
  });

  it("releases large-body capacity after parser errors", async () => {
    const { app } = buildApp({ maxConcurrentLargeBodies: 1 });

    await request(app)
      .post("/api/leadgrid/canvas")
      .send({ drawing_base64: "x".repeat(9 * 1024) })
      .expect(413);
    await request(app)
      .post("/api/leadgrid/canvas")
      .send({ drawing_base64: "ok" })
      .expect(200);
  });

  it("reserves capacity before awaiting session resolution", async () => {
    let releaseAuthentication!: (session: unknown) => void;
    const authentication = new Promise<unknown>((resolve) => {
      releaseAuthentication = resolve;
    });
    const resolveSession = vi.fn(() => authentication);
    const app = express();
    app.use(
      "/api/leadgrid",
      createLeadgridBodyParserBoundary({
        resolveSession,
        maxConcurrentLargeBodies: 1,
        parsers: {
          default: jsonParser("2kb"),
          publicAuth: jsonParser("1kb"),
          canvas: jsonParser("8kb"),
          audio: jsonParser("8kb"),
        },
      }),
    );
    app.use("/api/leadgrid", (req, res) => res.json({ body: req.body }));

    const first = request(app)
      .post("/api/leadgrid/canvas")
      .send({ drawing_base64: "first" });
    const firstResponse = first.then((response) => response);
    await vi.waitFor(() => expect(resolveSession).toHaveBeenCalledOnce());

    await request(app)
      .post("/api/leadgrid/canvas")
      .send({ drawing_base64: "second" })
      .expect(503, { error: "large_body_capacity_reached" });
    expect(resolveSession).toHaveBeenCalledOnce();

    releaseAuthentication({ userId: "user-1" });
    expect((await firstResponse).status).toBe(200);
  });
});
