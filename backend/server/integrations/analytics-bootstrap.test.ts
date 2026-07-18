import { describe, expect, it } from "vitest";

import {
  bootstrapInputSchema,
  buildEventPlan,
  renderAnalyticsBootstrap,
} from "./analytics-bootstrap.js";

describe("buildEventPlan (F3 — deterministisk katalog)", () => {
  it("mål → events m/ key-event og Meta-bro; purchase bærer value/currency", () => {
    const plan = buildEventPlan(["purchase", "lead"]);
    const purchase = plan.find((e) => e.ga4Event === "purchase")!;
    expect(purchase.keyEvent).toBe(true);
    expect(purchase.metaEvent).toBe("Purchase");
    expect(purchase.params).toContain("value");
    expect(plan.find((e) => e.ga4Event === "lead_submitted")!.metaEvent).toBe("Lead");
  });

  it("dedupliserer på tvers av mål og bevarer rekkefølge; nyhetsbrev er Lead, ikke Subscribe", () => {
    const plan = buildEventPlan(["booking", "booking", "newsletter"]);
    expect(plan.map((e) => e.ga4Event)).toEqual([
      "book_demo_clicked", "book_demo_submitted", "newsletter_subscribed",
    ]);
    expect(plan[2].metaEvent).toBe("Lead");
  });

  it("tomme mål gir tom plan", () => {
    expect(buildEventPlan([])).toEqual([]);
  });
});

describe("bootstrapInputSchema (F2 — validering)", () => {
  it("krever minst én ID og avviser ugyldige formater", () => {
    expect(bootstrapInputSchema.safeParse({ goals: [] }).success).toBe(false);
    expect(bootstrapInputSchema.safeParse({ ga4MeasurementId: "UA-123" }).success).toBe(false);
    expect(bootstrapInputSchema.safeParse({ metaPixelId: "abc" }).success).toBe(false);
    const ok = bootstrapInputSchema.safeParse({ ga4MeasurementId: "G-3MS91ZHVKS" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.consentMode).toBe("gated"); // default
  });
});

describe("renderAnalyticsBootstrap (F2 — snippet)", () => {
  const full = bootstrapInputSchema.parse({
    ga4MeasurementId: "G-TESTID12",
    gtmId: "GTM-ABC123",
    clarityProjectId: "xnzezvwkbm",
    metaPixelId: "929515126829909",
    goals: ["purchase", "lead"],
  });

  it("gated: ingen umiddelbar lasting; applyConsent-kontrakten er eksplisitt", () => {
    const { snippet } = renderAnalyticsBootstrap(full);
    expect(snippet).toContain("window.applyConsent");
    expect(snippet).not.toMatch(/\n\s*loadAnalytics\(\);\s*\n\s*loadMarketing\(\);/);
    // Pixel bare i marketing-grenen — aldri i analytics-grenen
    const analyticsPart = snippet.slice(snippet.indexOf("function loadAnalytics"), snippet.indexOf("function loadMarketing"));
    expect(analyticsPart).not.toContain("fbq");
  });

  it("always-modus laster direkte og er merket som unntaket", () => {
    const { snippet } = renderAnalyticsBootstrap({ ...full, consentMode: "always" });
    expect(snippet).toMatch(/loadAnalytics\(\);\s*\n\s*loadMarketing\(\);/);
    expect(snippet).toContain("uten samtykkekrav");
  });

  it("tom ID utelater lasteren; Meta-broen bygges fra event-planen", () => {
    const { snippet, eventPlan, notes } = renderAnalyticsBootstrap(
      bootstrapInputSchema.parse({ ga4MeasurementId: "G-TESTID12", goals: ["purchase"] }),
    );
    expect(snippet).toContain('metaPixel: ""');
    expect(snippet).toContain('"purchase":"Purchase"');
    expect(snippet).toContain('"begin_checkout":"InitiateCheckout"');
    expect(eventPlan).toHaveLength(2);
    // Uten pixel-ID: ingen «koblet ikke aktivert»-note; key-event-noten står
    expect(notes.some((n) => n.includes("key events"))).toBe(true);
    expect(notes.some((n) => n.includes("kampanje-aktivering"))).toBe(false);
  });

  it("noter dekker GTM-publisering og F1-verifisering", () => {
    const { notes } = renderAnalyticsBootstrap(full);
    expect(notes.some((n) => n.includes("PUBLISERT"))).toBe(true);
    expect(notes.some((n) => n.includes("site-auditen (F1)"))).toBe(true);
    expect(notes.some((n) => n.includes("marketing-samtykke"))).toBe(true);
  });
});
