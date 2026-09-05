import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  advanceResearchMockupDrafts,
  buildResearchMockupPreviewDataUrl,
  createFeedMockupProject,
  finalizeResearchMockupDrafts,
  initializeResearchMockupDrafts,
  materializeBrandLogoDataUrl,
} from "./role-room-research-mockups.js";

const RESEARCH_ID = "00000000-0000-4000-8000-000000000010";
const VARIANT_IDS = [
  "00000000-0000-4000-8000-000000000021",
  "00000000-0000-4000-8000-000000000022",
  "00000000-0000-4000-8000-000000000023",
  "00000000-0000-4000-8000-000000000024",
  "00000000-0000-4000-8000-000000000025",
];

function draftRows() {
  const mediaTypes = ["image", "carousel", "reel", "image", "carousel"];
  return [1, 2, 3, 4, 5].map((ordinal) => ({
    id: `00000000-0000-4000-8000-00000000003${ordinal}`,
    workspace_project_id: "workspace-1",
    research_id: RESEARCH_ID,
    platform: "instagram",
    ordinal,
    feed_post_id: `role-room-research-post-${ordinal}`,
    media_type: mediaTypes[ordinal - 1],
    status: "building",
    stage: "starting",
    progress: 4,
    title: `Utkast ${ordinal}`,
    caption: "Research pågår",
    preview_data_url: "data:image/svg+xml;base64,PHN2Zy8+",
    mockup_project_id: null,
    variant_id: null,
  }));
}

describe("Role Room progressive research mockups", () => {
  it("renders the live preview as an editable-campaign visual with independently positioned headline lines", () => {
    const preview = buildResearchMockupPreviewDataUrl(
      "Timen starter før pasienten kommer inn",
      "Research blir til et tydelig visuelt bevis.",
      "#1A2F4B",
      "#C9A04A",
    );
    const decoded = Buffer.from(preview.split(",")[1] || "", "base64").toString(
      "utf8",
    );

    expect(decoded).toContain("SKILL-BASERT KONSEPT");
    expect(decoded).toContain('text x="72" y="205"');
    expect(decoded).toContain('text x="72" y="273"');
    expect(decoded).toContain("Research → visuelt bevis");
    expect(decoded).not.toContain("<tspan");
  });

  it("sanitizes inline SVG logos before they enter the editable canvas", async () => {
    const unsafe =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><style>rect{fill:url(https://evil.test/x)}</style><script>alert(2)</script><a href="javascript:alert(3)"><rect style="fill:#123456"/></a></svg>';
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(unsafe).toString("base64")}`;
    const safe = await materializeBrandLogoDataUrl(dataUrl);
    const decoded = Buffer.from(String(safe).split(",")[1], "base64").toString(
      "utf8",
    );
    expect(decoded).toContain("<svg");
    expect(decoded).not.toMatch(
      /script|onload|javascript:|evil\.test|\sstyle=/i,
    );
  });

  it("rejects SVG logos with a doctype or entity declaration", async () => {
    const svg =
      '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>';
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await expect(materializeBrandLogoDataUrl(dataUrl)).resolves.toBeUndefined();
  });

  it("rejects a raster data URL when its bytes do not match the declared type", async () => {
    await expect(
      materializeBrandLogoDataUrl("data:image/png;base64,QUJD"),
    ).resolves.toBeUndefined();
  });

  it("uses stable feed slots and idempotent draft inserts across retries", async () => {
    const rows = draftRows();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM role_room_research_mockup_drafts"))
        return { rows };
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;

    await initializeResearchMockupDrafts(pool, {
      projectId: "workspace-1",
      researchId: RESEARCH_ID,
      projectName: "MedSide",
      createdByUserId: "user-1",
    });
    await initializeResearchMockupDrafts(pool, {
      projectId: "workspace-1",
      researchId: RESEARCH_ID,
      projectName: "MedSide",
      createdByUserId: "user-1",
    });

    const inserts = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO role_room_research_mockup_drafts"),
    );
    expect(inserts).toHaveLength(10);
    expect(
      inserts.slice(0, 5).map(([, params]) => (params as unknown[])[3]),
    ).toEqual([
      "role-room-research-post-1",
      "role-room-research-post-2",
      "role-room-research-post-3",
      "role-room-research-post-4",
      "role-room-research-post-5",
    ]);
    expect(inserts.every(([sql]) => String(sql).includes("ON CONFLICT"))).toBe(
      true,
    );
  });

  it("turns completed source evidence into a persisted visual preview", async () => {
    const rows = draftRows();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT title,caption"))
        return { rows: [{ title: "Utkast 1", caption: "Research pågår" }] };
      if (sql.includes("FROM role_room_research_mockup_drafts"))
        return { rows };
      return { rows: [] };
    });

    await advanceResearchMockupDrafts({ query } as unknown as Pool, {
      projectId: "workspace-1",
      researchId: RESEARCH_ID,
      stage: "brreg",
      completed: true,
      preview: {
        headline: "MEDINNOVA AS",
        detail: "Verifisert juridisk identitet",
      },
    });

    const previewUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("SET title=$4"),
    );
    expect(previewUpdate).toBeTruthy();
    const params = previewUpdate?.[1] as unknown[];
    expect(params[2]).toBe(1);
    expect(params[3]).toBe("MEDINNOVA AS");
    expect(String(params[5])).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("deduplicates identical manual variants but changes the key when content changes", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO role_room_feed_mockup_variants")) {
        return { rows: [{ id: VARIANT_IDS[0] }] };
      }
      if (sql.includes("INSERT INTO role_room_feed_mockup_links")) {
        return { rows: [{ id: VARIANT_IDS[1] }] };
      }
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const pool = {
      query,
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const base = {
      projectId: "workspace-1",
      platform: "instagram" as const,
      actorId: "user-1",
      mediaType: "image" as const,
      label: "Produktfokus",
      brandSnapshot: {
        companyName: "MedSide",
        primaryColor: "#102030",
        accentColor: "#40c0a0",
      },
      feedPost: {
        id: "post-1",
        concept: "product_highlight",
        title: "Trygg journalføring",
        caption: "Dokumentert research.",
        hashtags: [],
        callToAction: "Les mer",
        imageStyle: "brand",
        mediaType: "image" as const,
      },
    };

    await createFeedMockupProject(pool, base);
    await createFeedMockupProject(pool, base);
    await createFeedMockupProject(pool, {
      ...base,
      feedPost: { ...base.feedPost, title: "Et faktisk nytt budskap" },
    });

    const keys = query.mock.calls
      .filter(([sql]) =>
        String(sql).includes("INSERT INTO role_room_feed_mockup_variants"),
      )
      .map(([, params]) => String((params as unknown[])[3]));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("updates five stable feed posts without duplicating them or overwriting approved copy", async () => {
    const rows = draftRows();
    let storedPosts: Array<Record<string, unknown>> = [
      {
        id: "role-room-research-post-1",
        title: "Godkjent kundetekst",
        caption: "Skal ikke endres",
        approvalState: "approved",
        mediaType: "image",
      },
      {
        id: "manual-post",
        title: "Manuell post",
        caption: "Behold meg",
        approvalState: "draft",
      },
    ];
    let variantIndex = 0;
    let linkIndex = 40;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM role_room_research_mockup_drafts"))
        return { rows };
      if (sql.includes("SELECT posts,brand_snapshot")) {
        return {
          rows: [
            { posts: storedPosts, brand_snapshot: { toneOfVoice: "trygg" } },
          ],
        };
      }
      if (sql.includes("INSERT INTO role_room_feed_mockup_variants")) {
        const id = VARIANT_IDS[variantIndex % VARIANT_IDS.length];
        variantIndex += 1;
        return { rows: [{ id }] };
      }
      if (sql.includes("INSERT INTO role_room_feed_mockup_links")) {
        linkIndex += 1;
        return {
          rows: [{ id: `00000000-0000-4000-8000-0000000000${linkIndex}` }],
        };
      }
      if (sql.includes("INSERT INTO role_room_feed_plans")) {
        storedPosts = JSON.parse(String(params?.[1])) as Array<
          Record<string, unknown>
        >;
        return { rows: [] };
      }
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const pool = {
      query,
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const result = {
      companyProfile: {
        companyName: "MedSide",
        offerings: ["Sikker medisinsk dokumentasjon"],
        targetAudience: ["norske leger"],
        industry: "Helseteknologi og programvare",
      },
      intakeDraft: { keyMessage: "GDPR-sikker arbeidsflyt for klinikere." },
      planningDraft: {
        activationPlan: {
          businessGoal: "Gjøre produktverdien enkel å forstå.",
        },
        contentLogic: {
          hook: "Mer tid til pasienten.",
          proofPoints: ["GDPR-sikker arbeidsflyt"],
        },
        brandGuide: {
          colors: [{ hex: "#102030" }, { hex: "#40c0a0" }],
          logoUrl:
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        },
      },
    } as never;

    await finalizeResearchMockupDrafts(pool, {
      projectId: "workspace-1",
      researchId: RESEARCH_ID,
      result,
      createdByUserId: "user-1",
    });
    await finalizeResearchMockupDrafts(pool, {
      projectId: "workspace-1",
      researchId: RESEARCH_ID,
      result,
      createdByUserId: "user-1",
    });

    expect(storedPosts).toHaveLength(6);
    expect(new Set(storedPosts.map((post) => post.id)).size).toBe(6);
    expect(
      storedPosts.find((post) => post.id === "role-room-research-post-1"),
    ).toEqual(
      expect.objectContaining({
        title: "Godkjent kundetekst",
        caption: "Skal ikke endres",
      }),
    );
    expect(
      storedPosts.find((post) => post.id === "role-room-research-post-2"),
    ).toEqual(expect.objectContaining({ mediaType: "carousel" }));
    const projectInserts = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO demo_studio_mockup_projects"),
    );
    const linkInserts = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO role_room_feed_mockup_links"),
    );
    expect(projectInserts).toHaveLength(24);
    expect(linkInserts).toHaveLength(24);
    expect(
      new Set(
        projectInserts.map(
          ([, params]) => String((params as unknown[] | undefined)?.[0]),
        ),
      ).size,
    ).toBe(12);
    const firstRunPayloads = projectInserts.slice(0, 12).map(([, params]) =>
      JSON.parse(String((params as unknown[] | undefined)?.[5])),
    ) as Array<Record<string, unknown>>;
    const productStoryRoles = firstRunPayloads
      .filter((payload) => String(payload.name).includes("Utkast 2"))
      .map(
        (payload) =>
          (payload.creativeDecision as Record<string, unknown> | undefined)
            ?.role,
      );
    expect(productStoryRoles).toEqual([
      "hook",
      "context",
      "mechanism",
      "proof",
      "cta",
    ]);
    const firstProjectPayload = JSON.parse(
      String((projectInserts[0]?.[1] as unknown[] | undefined)?.[5]),
    ) as Record<string, unknown>;
    expect(firstProjectPayload).toEqual(
      expect.objectContaining({
        template: "role_room_campaign_post_v2",
        mockupQualityStatus: "ready",
        mockupSkillRuns: expect.arrayContaining([
          expect.objectContaining({
            id: "audit_mockup_dataflow",
            status: "ready",
          }),
        ]),
        brandDecision: expect.objectContaining({
          primaryColor: "#102030",
          accentColor: "#40C0A0",
        }),
        creativeDecision: expect.objectContaining({
          layout: "photo-product-bridge",
          role: "hook",
        }),
        images: expect.arrayContaining([
          expect.objectContaining({ illustration: "waiting-room-backdrop" }),
          expect.objectContaining({
            illustration: "person-laptop",
            personStyle: expect.objectContaining({ outfit: "legefrakk" }),
          }),
          expect.objectContaining({
            infoCardContent: expect.objectContaining({
              title: "MedSide",
            }),
          }),
        ]),
      }),
    );
    const finalizedDraftUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("quality_status=$9"),
    );
    const finalPreview = String(
      (finalizedDraftUpdate?.[1] as unknown[] | undefined)?.[5],
    );
    expect(
      Buffer.from(finalPreview.split(",")[1] || "", "base64").toString("utf8"),
    ).toContain('<image href="data:image/svg+xml;base64,');
    const variantInserts = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO role_room_feed_mockup_variants"),
    );
    expect(
      variantInserts.every(([sql]) =>
        [
          "input_fingerprint",
          "quality_status",
          "brand_snapshot",
          "skill_runs",
        ].every((column) => String(sql).includes(column)),
      ),
    ).toBe(true);
    expect(
      linkInserts.every(([sql]) =>
        String(sql).includes("ON CONFLICT (variant_id,output_position)"),
      ),
    ).toBe(true);
  });
});
