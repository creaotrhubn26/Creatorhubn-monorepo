import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  composeFramePrompt,
  normalizeDalleSize,
  STORYBOARD_TEMPLATES,
  STORYBOARD_CAMERA_ANGLES,
  STORYBOARD_CAMERA_MOVEMENTS,
  createStoryboardAiRouter,
} from "./storyboard-ai-routes.js";

// ── Rene helpers ────────────────────────────────────────────────────────────

describe("normalizeDalleSize", () => {
  it("beholder gyldige dall-e-3-størrelser", () => {
    expect(normalizeDalleSize("1024x1024")).toBe("1024x1024");
    expect(normalizeDalleSize("1792x1024")).toBe("1792x1024");
    expect(normalizeDalleSize("1024x1792")).toBe("1024x1792");
  });
  it("mapper frontend-default 1536x1024 → 1792x1024", () => {
    expect(normalizeDalleSize("1536x1024")).toBe("1792x1024");
  });
  it("portrett-hint → 1024x1792", () => {
    expect(normalizeDalleSize("1024x1536")).toBe("1024x1792");
  });
  it("undefined/ukjent → 1792x1024", () => {
    expect(normalizeDalleSize(undefined)).toBe("1792x1024");
    expect(normalizeDalleSize("weird")).toBe("1792x1024");
  });
});

describe("composeFramePrompt", () => {
  it("inkluderer prompt, kameravinkel-LABEL, bevegelse-LABEL og stil", () => {
    const p = composeFramePrompt({
      prompt: "Hero enters the room",
      template: "drama",
      camera_angle: "close-up",
      camera_movement: "tracking",
      additional_notes: "tense",
    });
    expect(p).toContain("Hero enters the room");
    expect(p).toContain("Nærbilde"); // close-up → norsk label
    expect(p).toContain("Tracking");
    expect(p).toContain("warm intimate TV-drama tones"); // drama-stil
    expect(p).toContain("no text, no captions, no logos");
  });
  it("ukjent template → cinematic-stil (fallback)", () => {
    expect(composeFramePrompt({ prompt: "x", template: "nope" })).toContain("cinematic film look");
  });
  it("utelater tomme felt", () => {
    const p = composeFramePrompt({ prompt: "solo" });
    expect(p).not.toContain("Camera angle");
    expect(p).not.toContain("Notes:");
  });
});

describe("statiske referansekart", () => {
  it("har forventede nøkler", () => {
    expect(Object.keys(STORYBOARD_TEMPLATES)).toEqual(["cinematic", "documentary", "commercial", "drama"]);
    expect(STORYBOARD_CAMERA_ANGLES["close-up"]).toBe("Nærbilde");
    expect(STORYBOARD_CAMERA_MOVEMENTS.pan).toBe("Panorering");
  });
});

// ── Router-handlere (fake req/res, injisert fetch) ──────────────────────────

// Fanger route-handlere fra en Express Router uten å starte en server.
function mountHandlers(router: any) {
  const handlers: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) {
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      handlers.push({ method, path: layer.route.path, stack: layer.route.stack.map((s: any) => s.handle) });
    }
  }
  return handlers;
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

// Kjør en handler-kjede (middleware + handler) til en av dem sender respons.
async function runChain(stack: any[], req: any, res: any) {
  let idx = 0;
  const next = async () => {
    if (idx >= stack.length) return;
    const h = stack[idx++];
    await h(req, res, next);
  };
  await next();
}

const fakePool = {} as any;

describe("generate-frame handler", () => {
  const OLD = process.env.OPENAI_API_KEY;
  afterEach(() => { process.env.OPENAI_API_KEY = OLD; });

  function getGenerateFrame(fetchImpl?: any) {
    const sessions = new Map([["tok-1", { userId: "u1", email: "", name: "", role: "user", loginAt: "" }]]);
    const router = createStoryboardAiRouter(fakePool, { activeSessions: sessions as any, fetchImpl });
    const h = mountHandlers(router).find((x) => x.method === "POST" && x.path === "/generate-frame")!;
    return h.stack;
  }

  it("GET /templates returnerer malene", async () => {
    const router = createStoryboardAiRouter(fakePool, {});
    const h = mountHandlers(router).find((x) => x.path === "/templates")!;
    const res = makeRes();
    await runChain(h.stack, {}, res);
    expect(res.body.drama.name).toBe("Drama/TV-serie");
  });

  it("uten Bearer → 401", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const stack = getGenerateFrame();
    const res = makeRes();
    await runChain(stack, { headers: {}, body: { prompt: "x" } }, res);
    expect(res.statusCode).toBe(401);
  });

  it("uten OPENAI_API_KEY → 503", async () => {
    delete process.env.OPENAI_API_KEY;
    const stack = getGenerateFrame();
    const res = makeRes();
    await runChain(stack, { headers: { authorization: "Bearer tok-1" }, body: { prompt: "x" } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("image_gen_disabled");
  });

  it("uten prompt → 400", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const stack = getGenerateFrame();
    const res = makeRes();
    await runChain(stack, { headers: { authorization: "Bearer tok-1" }, body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it("suksess → imageBase64 + composedPrompt (uten project_id)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "AAAA", revised_prompt: "r" }] }),
    });
    const stack = getGenerateFrame(fetchImpl);
    const res = makeRes();
    await runChain(stack, { headers: { authorization: "Bearer tok-1" }, body: { prompt: "hero", template: "drama", size: "1536x1024" } }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.imageBase64).toBe("AAAA");
    expect(res.body.model).toBe("dall-e-3");
    // size normalisert til gyldig dall-e-3-verdi
    const sentBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sentBody.size).toBe("1792x1024");
    expect(sentBody.prompt).toContain("hero");
  });

  it("OpenAI 402 → propageres som 402 (kredittgrense)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 402, text: async () => "limit" });
    const stack = getGenerateFrame(fetchImpl);
    const res = makeRes();
    await runChain(stack, { headers: { authorization: "Bearer tok-1" }, body: { prompt: "x" } }, res);
    expect(res.statusCode).toBe(402);
  });
});
