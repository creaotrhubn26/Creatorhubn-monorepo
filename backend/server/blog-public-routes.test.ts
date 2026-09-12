import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupBlogPublicRoutes } from "./blog-public-routes.js";

function makeApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  setupBlogPublicRoutes({
    app,
    pool: { query } as unknown as Pool,
  });
  return app;
}

describe("Leadgrid public blog routes", () => {
  it("lists only the public Leadgrid shape and keeps body content out of cards", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{
        slug: "leadgrid-lansering",
        title: "Vi lanserer Leadgrid",
        excerpt: "Kartbasert CRM",
        content: Array.from({ length: 201 }, () => "ord").join(" "),
        cover_image: null,
        category: "product",
        tags: ["leadgrid"],
        author: "Daniel Qazi",
        published_at: "2026-06-18T13:38:07.509Z",
        updated_at: "2026-06-18T13:38:07.509Z",
      }],
    });

    const response = await request(makeApp(query))
      .get("/api/public/leadgrid/blog?pillar=product&limit=999");

    expect(response.status).toBe(200);
    expect(response.body.articles).toEqual([expect.objectContaining({
      slug: "leadgrid-lansering",
      public_slug: "leadgrid-lansering",
      pillar: "product",
      reading_minutes: 2,
    })]);
    expect(response.body.articles[0]).not.toHaveProperty("content");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM blog_posts"),
      ["product", 200],
    );
    expect(query.mock.calls[0][0]).toContain("published = TRUE");
  });

  it("returns a published article as markdown with related posts", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          slug: "leadgrid-lansering",
          title: "Vi lanserer Leadgrid",
          excerpt: "Kartbasert CRM",
          content: "# Leadgrid\n\nInnhold",
          cover_image: null,
          category: "product",
          tags: ["leadgrid", "crm"],
          author: "Daniel Qazi",
          published_at: "2026-06-18T13:38:07.509Z",
          updated_at: "2026-06-18T13:38:07.509Z",
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          slug: "neste-artikkel",
          title: "Neste artikkel",
          excerpt: "Mer innsikt",
          published_at: "2026-06-19T13:38:07.509Z",
        }],
      });

    const response = await request(makeApp(query))
      .get("/api/public/leadgrid/blog/leadgrid-lansering");

    expect(response.status).toBe(200);
    expect(response.body.article).toEqual(expect.objectContaining({
      public_slug: "leadgrid-lansering",
      pillar: "product",
      body_markdown: "# Leadgrid\n\nInnhold",
      reading_minutes: 1,
    }));
    expect(response.body.related[0].public_slug).toBe("neste-artikkel");
    expect(query.mock.calls[0][1]).toEqual(["leadgrid-lansering"]);
    expect(query.mock.calls[1][1]).toEqual(["leadgrid-lansering", "product"]);
  });

  it("returns 404 for an unpublished or unknown slug", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });

    const response = await request(makeApp(query))
      .get("/api/public/leadgrid/blog/ikke-publisert");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Artikkel ikke funnet");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
