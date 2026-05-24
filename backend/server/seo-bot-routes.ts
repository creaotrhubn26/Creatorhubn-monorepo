import express from "express";
import crypto from "crypto";
import { readNumber, readString } from "./_shared";

export interface SeoBotRoutesDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
  getSeoBotVisitSnapshot: (days: number) => Promise<any[]>;
  listStoredSeoMobileTests: (
    limit: number,
  ) => Promise<Record<string, unknown>[]>;
  getSeoBotEmulationUserAgent: (botName: string) => string;
  extractVisibleTextFromHtml: (html: string) => string;
  countWords: (text: string) => number;
  roundAdminMetric: (value: number, decimals?: number) => number;
  normalizeJsonObjectField: (value: unknown) => Record<string, unknown> | null;
  compatStoreSet: (
    key: string,
    value: Record<string, unknown>,
  ) => Promise<void>;
}

export function setupSeoBotRoutes(deps: SeoBotRoutesDeps): void {
  const {
    app,
    requireAdminSession,
    getSeoBotVisitSnapshot,
    listStoredSeoMobileTests,
    getSeoBotEmulationUserAgent,
    extractVisibleTextFromHtml,
    countWords,
    roundAdminMetric,
    normalizeJsonObjectField,
    compatStoreSet,
  } = deps;

  app.post("/api/seo-bot/initialize", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const visits = await getSeoBotVisitSnapshot(30);

      res.json({
        success: true,
        mode: "analytics-derived",
        trackedBots: Array.from(
          new Set(visits.map((visit: any) => visit.bot_name)),
        ).length,
        trackedVisits: visits.length,
      });
    } catch (error) {
      console.error("SEO bot initialize error:", error);
      res
        .status(500)
        .json({ error: "Failed to initialize SEO bot analytics" });
    }
  });

  app.get("/api/seo-bot/analytics", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const days = Math.max(1, Math.min(365, Number(req.query.days) || 7));
      const visits = await getSeoBotVisitSnapshot(days);
      const grouped = new Map<
        string,
        {
          bot_name: string;
          bot_category: any;
          total_visits: number;
          pages: Set<string>;
          response_time_total: number;
          response_time_count: number;
          success_count: number;
        }
      >();

      for (const visit of visits) {
        const existing = grouped.get(visit.bot_name) || {
          bot_name: visit.bot_name,
          bot_category: visit.bot_category,
          total_visits: 0,
          pages: new Set<string>(),
          response_time_total: 0,
          response_time_count: 0,
          success_count: 0,
        };

        existing.total_visits += 1;
        existing.pages.add(visit.page);
        if (visit.response_time > 0) {
          existing.response_time_total += visit.response_time;
          existing.response_time_count += 1;
        }
        if (visit.success) {
          existing.success_count += 1;
        }
        grouped.set(visit.bot_name, existing);
      }

      res.json({
        analytics: Array.from(grouped.values())
          .map((entry) => ({
            bot_name: entry.bot_name,
            bot_category: entry.bot_category,
            total_visits: entry.total_visits,
            total_pages: entry.pages.size,
            avg_response_time:
              entry.response_time_count > 0
                ? roundAdminMetric(
                    entry.response_time_total / entry.response_time_count,
                    1,
                  )
                : 0,
            success_count: entry.success_count,
          }))
          .sort((left, right) => right.total_visits - left.total_visits),
      });
    } catch (error) {
      console.error("SEO bot analytics error:", error);
      res.status(500).json({ error: "Failed to load SEO bot analytics" });
    }
  });

  app.get("/api/seo-bot/visits", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const botName =
        typeof req.query.botName === "string"
          ? req.query.botName.trim()
          : "";
      const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
      const visits = await getSeoBotVisitSnapshot(90);

      const filteredVisits = visits
        .filter((visit: any) =>
          botName
            ? visit.bot_name.toLowerCase() === botName.toLowerCase()
            : true,
        )
        .sort(
          (left: any, right: any) =>
            new Date(right.visited_at).getTime() -
            new Date(left.visited_at).getTime(),
        )
        .slice(0, limit);

      res.json({ visits: filteredVisits });
    } catch (error) {
      console.error("SEO bot visits error:", error);
      res.status(500).json({ error: "Failed to load SEO bot visits" });
    }
  });

  app.get("/api/seo-bot/crawl-budget", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const days = Math.max(1, Math.min(365, Number(req.query.days) || 7));
      const visits = await getSeoBotVisitSnapshot(days);
      const grouped = new Map<
        string,
        {
          bot_name: string;
          date: string;
          actual_pages_crawled: number;
          total_budget_wasted: number;
        }
      >();

      for (const visit of visits) {
        const date = visit.visited_at.slice(0, 10);
        const key = `${visit.bot_name}::${date}`;
        const existing = grouped.get(key) || {
          bot_name: visit.bot_name,
          date,
          actual_pages_crawled: 0,
          total_budget_wasted: 0,
        };

        existing.actual_pages_crawled += 1;
        if (visit.is_wasteful) {
          existing.total_budget_wasted += 1;
        }
        grouped.set(key, existing);
      }

      const budgetReport = Array.from(grouped.values())
        .map((entry) => ({
          ...entry,
          waste_percent:
            entry.actual_pages_crawled > 0
              ? roundAdminMetric(
                  (entry.total_budget_wasted / entry.actual_pages_crawled) *
                    100,
                  1,
                )
              : 0,
        }))
        .sort(
          (left, right) =>
            new Date(right.date).getTime() - new Date(left.date).getTime(),
        );

      const avgWastePercent =
        budgetReport.length > 0
          ? roundAdminMetric(
              budgetReport.reduce(
                (sum, row) => sum + Number(row.waste_percent),
                0,
              ) / budgetReport.length,
              1,
            )
          : 0;

      res.json({
        budgetReport,
        summary: {
          avgWastePercent,
          totalBots: Array.from(
            new Set(budgetReport.map((row) => row.bot_name)),
          ).length,
        },
      });
    } catch (error) {
      console.error("SEO crawl budget error:", error);
      res.status(500).json({ error: "Failed to load crawl budget" });
    }
  });

  app.get("/api/seo-bot/mobile-tests", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
      const tests = await listStoredSeoMobileTests(limit);
      res.json({ tests });
    } catch (error) {
      console.error("SEO mobile tests error:", error);
      res.status(500).json({ error: "Failed to load mobile tests" });
    }
  });

  app.get("/api/seo-bot/recommendations", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const days = 30;
      const visits = await getSeoBotVisitSnapshot(days);
      const crawlBudget = new Map<
        string,
        { total: number; wasted: number }
      >();

      visits.forEach((visit: any) => {
        const existing = crawlBudget.get(visit.bot_name) || {
          total: 0,
          wasted: 0,
        };
        existing.total += 1;
        if (visit.is_wasteful) {
          existing.wasted += 1;
        }
        crawlBudget.set(visit.bot_name, existing);
      });

      const tests = await listStoredSeoMobileTests(10);
      const recommendations: Array<Record<string, unknown>> = [];

      for (const [botName, summary] of crawlBudget.entries()) {
        const wastePercent =
          summary.total > 0 ? (summary.wasted / summary.total) * 100 : 0;
        if (wastePercent >= 10) {
          recommendations.push({
            recommendation_id: `crawl-budget-${botName.toLowerCase().replace(/\s+/g, "-")}`,
            priority: wastePercent >= 25 ? "high" : "medium",
            category: "crawl-budget",
            recommendation_title: `Reduser bortkastet crawl-budget for ${botName}`,
            recommendation_text: `${roundAdminMetric(
              wastePercent,
              1,
            )}% av crawl-trafikken fra ${botName} treffer admin-, API- eller query-tunge sider. Blokker eller canonicaliser disse rutene for å prioritere offentlige sider.`,
            estimated_impact: wastePercent >= 25 ? "Høy" : "Middels",
          });
        }
      }

      tests.forEach((test: any, index: number) => {
        const mobileScore = readNumber(test.mobile_usability_score) || 0;
        if (mobileScore < 80) {
          recommendations.push({
            recommendation_id: `mobile-test-${index}`,
            priority: mobileScore < 60 ? "high" : "medium",
            category: "mobile-usability",
            recommendation_title: `Forbedre mobil brukbarhet for ${readString(test.url) || "testet side"}`,
            recommendation_text: `Siste mobile test scoret ${mobileScore}/100. Prioriter viewport, touch-avstander og rendering på mobil før ny crawl.`,
            estimated_impact: mobileScore < 60 ? "Høy" : "Middels",
          });
        }
      });

      res.json({
        recommendations,
      });
    } catch (error) {
      console.error("SEO recommendations error:", error);
      res
        .status(500)
        .json({ error: "Failed to load SEO recommendations" });
    }
  });

  app.post("/api/seo-bot/render-test", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const body = normalizeJsonObjectField(req.body) || {};
      const url = readString(body.url);
      const botName = readString(body.botName) || "Googlebot";
      if (!url) {
        return res.status(400).json({ error: "Missing url" });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": getSeoBotEmulationUserAgent(botName),
        },
      });
      const html = await response.text();
      const textContent = extractVisibleTextFromHtml(html);
      const htmlOnlyWordCount = countWords(textContent);
      const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
      const hasStructuredData = /application\/ld\+json/i.test(html);
      const seoIssues: string[] = [];
      const recommendations: string[] = [];

      if (htmlOnlyWordCount < 120) {
        seoIssues.push("Siden har lite synlig HTML-innhold for crawlers.");
        recommendations.push(
          "Vurder mer synlig tekstinnhold eller SSR på viktige landingssider.",
        );
      }
      if (!hasViewport) {
        seoIssues.push("Viewport-meta mangler i HTML-responsen.");
        recommendations.push(
          "Legg inn en gyldig viewport-meta for mobilvennlig rendering.",
        );
      }
      if (!hasStructuredData) {
        recommendations.push(
          "Legg inn strukturert data på nøkkelsider for rikere søkeresultater.",
        );
      }

      res.json({
        testResults: {
          htmlOnlyWordCount,
          jsRenderedWordCount: htmlOnlyWordCount,
          contentMatchPercent: 100,
          seoIssues,
          recommendations,
          analysisMode: "static-html-audit",
        },
      });
    } catch (error) {
      console.error("SEO render test error:", error);
      res.status(500).json({ error: "Failed to run render test" });
    }
  });

  app.post("/api/seo-bot/mobile-usability-test", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const body = normalizeJsonObjectField(req.body) || {};
      const url = readString(body.url);
      if (!url) {
        return res.status(400).json({ error: "Missing url" });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": getSeoBotEmulationUserAgent("Googlebot (Mobile)"),
        },
      });
      const html = await response.text();
      const viewportMatch = html.match(
        /<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i,
      );
      const hasViewport = Boolean(viewportMatch);
      const viewportContent = viewportMatch?.[1] || "";
      const hasDeviceWidth = /width\s*=\s*device-width/i.test(viewportContent);
      const hasLargeImages = /<img/i.test(html);
      const textWordCount = countWords(extractVisibleTextFromHtml(html));

      let mobileUsabilityScore = 100;
      if (!hasViewport) mobileUsabilityScore -= 35;
      if (hasViewport && !hasDeviceWidth) mobileUsabilityScore -= 20;
      if (textWordCount < 120) mobileUsabilityScore -= 15;
      if (!hasLargeImages) mobileUsabilityScore -= 5;
      mobileUsabilityScore = Math.max(0, mobileUsabilityScore);

      const mobileSeoScore = Math.max(
        0,
        Math.min(
          100,
          mobileUsabilityScore +
            (/<title>[^<]+<\/title>/i.test(html) ? 5 : -10),
        ),
      );

      const result = {
        test_id: crypto.randomUUID(),
        url,
        googlebot_mobile_compatible: hasViewport,
        chrome_android_compatible: hasViewport && hasDeviceWidth,
        safari_ios_compatible: hasViewport,
        mobile_usability_score: mobileUsabilityScore,
        mobile_seo_score: mobileSeoScore,
        tested_at: new Date().toISOString(),
      };

      await compatStoreSet(
        `seo:mobile-test:${result.tested_at}:${result.test_id}`,
        result,
      );

      res.json({ success: true, test: result });
    } catch (error) {
      console.error("SEO mobile usability test error:", error);
      res
        .status(500)
        .json({ error: "Failed to run mobile usability test" });
    }
  });
}
