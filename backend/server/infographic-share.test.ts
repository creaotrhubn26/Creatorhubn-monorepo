import { describe, expect, it } from "vitest";

import { buildInfographicUrl, emailImgTag, ogImageTags } from "./infographic-share.js";

describe("buildInfographicUrl — validert render.png-URL", () => {
  it("default → tpl=auto, standard dims utelates", () => {
    const u = buildInfographicUrl();
    expect(u).toBe("/api/infographics/render.png?tpl=auto");
  });

  it("gyldig mal-id, ws, source og accent tas med", () => {
    const u = new URL(buildInfographicUrl({ base: "https://x.no", tpl: "kpi-grid", ws: "leadgrid", source: "agency_leads", accent: "#ff8c00" }));
    expect(u.origin).toBe("https://x.no");
    expect(u.searchParams.get("tpl")).toBe("kpi-grid");
    expect(u.searchParams.get("ws")).toBe("leadgrid");
    expect(u.searchParams.get("source")).toBe("agency_leads");
    expect(u.searchParams.get("accent")).toBe("#ff8c00");
  });

  it("embed-sti godtas; ugyldig tpl faller til «auto» (SSRF-trygt)", () => {
    expect(new URL(buildInfographicUrl({ base: "https://x.no", tpl: "/embed/templates/donut.html" })).searchParams.get("tpl")).toBe("/embed/templates/donut.html");
    expect(new URL(buildInfographicUrl({ base: "https://x.no", tpl: "../../etc/passwd" })).searchParams.get("tpl")).toBe("auto");
    expect(new URL(buildInfographicUrl({ base: "https://x.no", tpl: "http://evil.com/x.html" })).searchParams.get("tpl")).toBe("auto");
  });

  it("ugyldige source/accent/ws droppes (aldri kastet inn i URL-en)", () => {
    const u = new URL(buildInfographicUrl({ base: "https://x.no", source: "bad key!", accent: "red", ws: "has space" }));
    expect(u.searchParams.get("source")).toBeNull();
    expect(u.searchParams.get("accent")).toBeNull();
    expect(u.searchParams.get("ws")).toBeNull();
  });

  it("dims klampes; standard 1200×630 utelates, custom settes", () => {
    expect(new URL(buildInfographicUrl({ base: "https://x.no", w: 1200, h: 630 })).search).toBe("?tpl=auto");
    const u = new URL(buildInfographicUrl({ base: "https://x.no", w: 1080, h: 1350 }));
    expect(u.searchParams.get("w")).toBe("1080");
    expect(u.searchParams.get("h")).toBe("1350");
    // klamping
    expect(new URL(buildInfographicUrl({ base: "https://x.no", w: 999999, h: 1 })).searchParams.get("w")).toBe("3000");
    expect(new URL(buildInfographicUrl({ base: "https://x.no", w: 999999, h: 1 })).searchParams.get("h")).toBe("64");
  });

  it("data base64url-kodes og dekoder round-trip", () => {
    const data = { value: 1247, label: "CV-er bygget", accent: "#ff8c00" };
    const u = new URL(buildInfographicUrl({ base: "https://x.no", data }));
    const d = u.searchParams.get("d")!;
    expect(JSON.parse(Buffer.from(d, "base64url").toString("utf8"))).toEqual(data);
  });

  it("for stor data droppes (holder URL-en under lengde-tak)", () => {
    const huge = { blob: "x".repeat(9000) };
    expect(new URL(buildInfographicUrl({ base: "https://x.no", data: huge })).searchParams.get("d")).toBeNull();
  });
});

describe("ogImageTags — meta for delte lenker", () => {
  it("inkluderer og:image + twitter:image + summary_large_image", () => {
    const tags = ogImageTags("https://x.no/api/infographics/render.png?tpl=auto", { alt: "Q3-tall" });
    expect(tags).toContain('property="og:image" content="https://x.no/api/infographics/render.png?tpl=auto"');
    expect(tags).toContain('name="twitter:card" content="summary_large_image"');
    expect(tags).toContain('name="twitter:image"');
    expect(tags).toContain('content="Q3-tall"');
  });

  it("escaper attributt-verdier (ingen brudd ut av content=\"…\")", () => {
    const tags = ogImageTags('https://x.no/x?a="><script>', { alt: 'A "B" <c>' });
    expect(tags).not.toContain('"><script>');
    expect(tags).toContain("&quot;");
  });
});

describe("emailImgTag — e-post-trygt <img>", () => {
  it("gir img med src/alt/width og inline-stil (ingen JS)", () => {
    const t = emailImgTag("https://x.no/api/infographics/render.png?tpl=kpi-grid", { width: 600, alt: "Månedstall" });
    expect(t).toMatch(/^<img /);
    expect(t).toContain('src="https://x.no/api/infographics/render.png?tpl=kpi-grid"');
    expect(t).toContain('width="600"');
    expect(t).toContain('alt="Månedstall"');
    expect(t).toContain("max-width:100%");
    expect(t).not.toContain("script");
  });

  it("escaper src + alt", () => {
    const t = emailImgTag('https://x.no/x?"><b>', { alt: '"><img onerror=x>' });
    expect(t).not.toContain('"><b>');
    expect(t).toContain("&quot;");
  });
});
