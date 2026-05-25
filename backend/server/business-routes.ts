import express from "express";
import type { Pool } from "pg";
import { readString } from "./_shared";

export interface BusinessRoutesDeps {
  app: express.Application;
  pool: Pool;
}

export function setupBusinessRoutes(deps: BusinessRoutesDeps): void {
  const { app, pool } = deps;

  const norwegianRegionData: Record<
    string,
    { population: number; avgIncome: number; density: number; growth: number }
  > = {
    Oslo: { population: 709000, avgIncome: 620000, density: 1650, growth: 1.3 },
    Bergen: { population: 289000, avgIncome: 540000, density: 580, growth: 0.9 },
    Trondheim: {
      population: 213000,
      avgIncome: 530000,
      density: 560,
      growth: 1.1,
    },
    Stavanger: {
      population: 149000,
      avgIncome: 590000,
      density: 750,
      growth: 0.7,
    },
    Tromsø: { population: 79000, avgIncome: 510000, density: 32, growth: 0.6 },
    Kristiansand: {
      population: 117000,
      avgIncome: 500000,
      density: 290,
      growth: 0.8,
    },
    Drammen: { population: 104000, avgIncome: 510000, density: 420, growth: 1.0 },
  };

  // Wedding service seasonal factors (Norwegian wedding season peaks May-September)
  const weddingSeasonalFactors = [
    0.3, 0.4, 0.6, 0.8, 1.2, 1.5, 1.4, 1.3, 1.0, 0.6, 0.4, 0.3,
  ];


  function professionToCategory(profession: string): string {
    const map: Record<string, string> = {
      photographer: "Fotograf",
      videographer: "Videograf",
      music_producer: "Musikk",
      musician: "Musikk",
      venue: "Venue",
      planner: "Planlegger",
      makeup: "Hår & Makeup",
      florist: "Blomster",
      catering: "Catering",
      cake: "Kake",
      transport: "Transport",
    };
    return map[profession] || profession;
  }

  // Price range to numeric value
  function priceRangeToNumber(priceRange: string | null): number {
    switch (priceRange) {
      case "low":
        return 15000;
      case "medium":
        return 30000;
      case "high":
        return 50000;
      case "premium":
        return 80000;
      default:
        return 30000;
    }
  }

  // Determine current seasonal demand
  function getCurrentSeasonalDemand(): "high" | "medium" | "low" {
    const month = new Date().getMonth();
    const factor = weddingSeasonalFactors[month];
    if (factor >= 1.2) return "high";
    if (factor >= 0.7) return "medium";
    return "low";
  }

  function toBiNumericMetric(value: unknown, fallback = 0): number {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toBiStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) =>
        typeof entry === "string" ? entry.trim() : String(entry ?? "").trim(),
      )
      .filter((entry) => entry.length > 0);
  }

  function toBiIsoDateString(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  function parseBiPersonaAge(ageRange: string): number {
    const matches = ageRange.match(/\d+/g);
    if (!matches || matches.length === 0) {
      return 35;
    }

    const values = matches
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return 35;
    }

    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  function normalizeSwotItemRecord(row: Record<string, unknown>) {
    return {
      id: String(row.id),
      type: String(row.type || "strength") as
        | "strength"
        | "weakness"
        | "opportunity"
        | "threat",
      title: String(row.title || "Uten tittel"),
      description: String(row.description || ""),
      impact: String(row.impact || "medium") as
        | "low"
        | "medium"
        | "high"
        | "critical",
      probability: Math.max(
        0,
        Math.min(100, Math.round(toBiNumericMetric(row.probability, 50))),
      ),
      urgency: String(row.urgency || "medium") as "low" | "medium" | "high",
      status: String(row.status || "identified") as
        | "identified"
        | "analyzing"
        | "in_progress"
        | "resolved"
        | "archived",
      category: String(row.category || "general"),
      tags: toBiStringArray(row.tags),
      relatedPersonas: toBiStringArray(
        row.related_personas ?? row.relatedPersonas,
      ),
      identifiedDate:
        toBiIsoDateString(row.created_at) ?? new Date().toISOString(),
      targetDate: toBiIsoDateString(row.target_date),
      resolvedDate: toBiIsoDateString(row.resolved_date),
      confidence: Math.max(
        0,
        Math.min(100, Math.round(toBiNumericMetric(row.confidence, 50))),
      ),
    };
  }

  function normalizePersonaRecord(row: Record<string, unknown>) {
    const age = Math.round(toBiNumericMetric(row.age, 35));
    const motivations =
      toBiStringArray(row.preferred_brands).length > 0
        ? toBiStringArray(row.preferred_brands)
        : toBiStringArray(row.goals);
    return {
      id: String(row.id),
      name: String(row.name || "Ukjent persona"),
      description: String(row.bio || row.occupation || ""),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
      ageRange: `${Math.max(age - 5, 18)}-${age + 5}`,
      location: String(row.location || "Norge"),
      income: String(row.income || "standard"),
      goals: toBiStringArray(row.goals),
      painPoints: toBiStringArray(row.frustrations),
      motivations,
      customerType: String(row.customer_type || "quality_focused") as
        | "budget_conscious"
        | "quality_focused"
        | "time_sensitive"
        | "luxury_seeker",
      budgetTier: String(row.budget_tier || "standard") as
        | "economy"
        | "standard"
        | "premium"
        | "luxury",
      marketSize: Math.round(toBiNumericMetric(row.market_size, 0)),
      averageValue: toBiNumericMetric(row.average_value, 0),
      conversionRate: Math.round(toBiNumericMetric(row.conversion_rate, 0)),
    };
  }

  function swotImpactWeight(impact: unknown): number {
    switch (String(impact || "medium")) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "low":
        return 1;
      default:
        return 2;
    }
  }

  function buildSwotScores(items: Array<Record<string, unknown>>) {
    const categoryScore = (categories: string[]) => {
      const positive = items
        .filter(
          (item) =>
            categories.includes(String(item.category || "").toLowerCase()) &&
            (item.type === "strength" || item.type === "opportunity"),
        )
        .reduce((sum, item) => sum + swotImpactWeight(item.impact), 0);
      const negative = items
        .filter(
          (item) =>
            categories.includes(String(item.category || "").toLowerCase()) &&
            (item.type === "weakness" || item.type === "threat"),
        )
        .reduce((sum, item) => sum + swotImpactWeight(item.impact), 0);

      return Math.max(10, Math.min(100, 50 + (positive - negative) * 8));
    };

    const brand = categoryScore([
      "brand",
      "branding",
      "marketing",
      "positioning",
    ]);
    const product = categoryScore(["product", "service", "quality", "portfolio"]);
    const distribution = categoryScore([
      "distribution",
      "sales",
      "operations",
      "delivery",
    ]);
    const promotion = categoryScore([
      "promotion",
      "marketing",
      "social",
      "seo",
      "content",
    ]);
    const overall = Math.round((brand + product + distribution + promotion) / 4);

    return { brand, product, distribution, promotion, overall };
  }

  function buildSwotRecommendations(
    items: Array<Record<string, unknown>>,
    personasCount: number,
    surveyCount: number,
  ): string[] {
    const strengths = items.filter((item) => item.type === "strength");
    const opportunities = items.filter((item) => item.type === "opportunity");
    const weaknesses = items.filter((item) => item.type === "weakness");
    const threats = items.filter((item) => item.type === "threat");

    const strongestOpportunity = opportunities
      .slice()
      .sort(
        (left, right) =>
          swotImpactWeight(right.impact) - swotImpactWeight(left.impact),
      )[0];
    const mostUrgentWeakness = weaknesses
      .slice()
      .sort(
        (left, right) =>
          swotImpactWeight(right.impact) - swotImpactWeight(left.impact),
      )[0];
    const highestThreat = threats
      .slice()
      .sort(
        (left, right) =>
          swotImpactWeight(right.impact) - swotImpactWeight(left.impact),
      )[0];

    const recommendations = [
      strengths.length > 0
        ? `Bygg videre på styrken "${String(strengths[0].title || "sterk leveranse")}" i markedskommunikasjonen.`
        : "Dokumenter flere styrker i SWOT for å få tydeligere markedsposisjonering.",
      strongestOpportunity
        ? `Prioriter muligheten "${String(strongestOpportunity.title)}" i neste 30-dagers plan.`
        : "Identifiser minst én ny vekstmulighet fra kundeinnsikt eller markedstall.",
      mostUrgentWeakness
        ? `Lag en konkret tiltaksliste for svakheten "${String(mostUrgentWeakness.title)}".`
        : "Bruk SWOT-tavlen aktivt for å avdekke operative flaskehalser.",
      highestThreat
        ? `Etabler en motstrategi mot trusselen "${String(highestThreat.title)}".`
        : "Følg konkurranse- og sesongendringer ukentlig for å oppdage nye trusler tidligere.",
    ];

    if (personasCount === 0) {
      recommendations.push(
        "Opprett minst én persona for å koble SWOT og markedsføring til en tydelig målgruppe.",
      );
    }
    if (surveyCount === 0) {
      recommendations.push(
        "Publiser en kort undersøkelse for å få ferske signaler inn i SWOT-analysen.",
      );
    }

    return recommendations.slice(0, 5);
  }

  function buildSeasonalTrendPayload(profession: string, service: string) {
    const normalizedService = service.toLowerCase();
    const normalizedProfession = profession.toLowerCase();
    const serviceAdjustments = normalizedService.includes("bryllup")
      ? weddingSeasonalFactors
      : weddingSeasonalFactors.map((factor) =>
          Number((0.65 + factor * 0.35).toFixed(2)),
        );

    const professionMultiplier =
      normalizedProfession === "videographer"
        ? 1.05
        : normalizedProfession === "music_producer"
          ? 0.9
          : 1;

    const monthlyFactors = serviceAdjustments.map((factor) =>
      Number((factor * professionMultiplier).toFixed(2)),
    );
    const highestFactor = Math.max(...monthlyFactors);
    const peakMonths = monthlyFactors
      .map((factor, index) => ({ factor, index }))
      .filter((entry) => entry.factor >= highestFactor - 0.05)
      .map((entry) => entry.index);
    const monthLabels = [
      "jan",
      "feb",
      "mar",
      "apr",
      "mai",
      "jun",
      "jul",
      "aug",
      "sep",
      "okt",
      "nov",
      "des",
    ];
    const peakLabel = peakMonths.map((index) => monthLabels[index]).join(", ");

    return {
      serviceType: service,
      monthlyFactors,
      recommendations: [
        `Planlegg kampanjer og prisøkning mot høysesongen i ${peakLabel || "mai-september"}.`,
        monthlyFactors[new Date().getMonth()] >= 1
          ? "Etterspørselen er sterk nå. Prioriter raske svar og premium-pakker."
          : "Bruk roligere perioder til portefølje, SEO og relasjonsbygging.",
        normalizedService.includes("bryllup")
          ? "Bryllupssegmentet topper seg sent vår og sommer. Sikre bookingflyten tidlig i året."
          : `Tilpass innholdsplanen til når ${service} faktisk har høyest etterspørsel.`,
      ],
    };
  }

  function humanizeAudienceSegment(segment: unknown): string {
    switch (String(segment || "all")) {
      case "active":
        return "Aktive kunder";
      case "inactive":
        return "Inaktive kunder";
      case "new":
        return "Nye kunder";
      default:
        return "Alle kunder";
    }
  }

  function humanizeNewsletterStatus(status: unknown): string {
    switch (String(status || "draft")) {
      case "scheduled":
        return "Planlagt";
      case "sent":
        return "Sendt";
      case "cancelled":
        return "Avlyst";
      default:
        return "Utkast";
    }
  }


  app.get("/api/business/surveys/:userId/:profession", async (req, res) => {
    try {
      const { userId, profession } = req.params;
      const result = await pool.query(
        `SELECT id, user_id, profession, title, description, purpose, questions, status,
                response_count, completion_rate, shareable_link, expires_at, created_at, updated_at
         FROM surveys
         WHERE user_id = $1 AND profession = $2
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        [userId, profession],
      );

      const data = result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        profession: row.profession,
        title: row.title,
        description: row.description,
        purpose: row.purpose,
        questions: Array.isArray(row.questions) ? row.questions : [],
        status: row.status,
        responseCount: Number(row.response_count || 0),
        completionRate: Number(row.completion_rate || 0),
        shareableLink: row.shareable_link,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error("Business surveys list error:", error);
      res.status(500).json({ success: false, error: "Failed to load surveys" });
    }
  });

  // POST /api/business/surveys — Create or update a BI survey
  app.post("/api/business/surveys", async (req, res) => {
    try {
      const {
        id,
        userId,
        profession,
        title,
        description,
        purpose,
        questions,
        status,
        shareableLink,
        expiresAt,
      } = req.body || {};

      if (
        typeof userId !== "string" ||
        !userId.trim() ||
        typeof profession !== "string" ||
        !profession.trim()
      ) {
        return res
          .status(400)
          .json({ success: false, error: "userId and profession are required" });
      }

      if (typeof title !== "string" || !title.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "title is required" });
      }

      const surveyId =
        typeof id === "string" && id.trim() ? id.trim() : crypto.randomUUID();
      const safeQuestions = Array.isArray(questions) ? questions : [];
      const normalizedShareableLink =
        typeof shareableLink === "string" && shareableLink.trim().length > 0
          ? shareableLink.trim()
          : `/surveys/${surveyId}`;

      const existing = await pool.query(
        `SELECT id
         FROM surveys
         WHERE id = $1 AND user_id = $2 AND profession = $3
         LIMIT 1`,
        [surveyId, userId, profession],
      );

      if ((existing.rowCount ?? 0) > 0) {
        await pool.query(
          `UPDATE surveys
           SET title = $4,
               description = $5,
               purpose = $6,
               questions = $7::jsonb,
               status = $8,
               shareable_link = $9,
               expires_at = $10,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND profession = $3`,
          [
            surveyId,
            userId,
            profession,
            title.trim(),
            typeof description === "string" ? description.trim() : "",
            typeof purpose === "string" ? purpose : "customer_satisfaction",
            JSON.stringify(safeQuestions),
            typeof status === "string" ? status : "draft",
            normalizedShareableLink,
            expiresAt || null,
          ],
        );
      } else {
        await pool.query(
          `INSERT INTO surveys (
            id, user_id, profession, title, description, purpose, questions, status,
            response_count, completion_rate, shareable_link, expires_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7::jsonb, $8,
            0, 0, $9, $10, NOW(), NOW()
          )`,
          [
            surveyId,
            userId,
            profession,
            title.trim(),
            typeof description === "string" ? description.trim() : "",
            typeof purpose === "string" ? purpose : "customer_satisfaction",
            JSON.stringify(safeQuestions),
            typeof status === "string" ? status : "draft",
            normalizedShareableLink,
            expiresAt || null,
          ],
        );
      }

      const saved = await pool.query(
        `SELECT id, user_id, profession, title, description, purpose, questions, status,
                response_count, completion_rate, shareable_link, expires_at, created_at, updated_at
         FROM surveys
         WHERE id = $1
         LIMIT 1`,
        [surveyId],
      );

      const row = saved.rows[0];
      res.json({
        success: true,
        data: {
          id: row.id,
          userId: row.user_id,
          profession: row.profession,
          title: row.title,
          description: row.description,
          purpose: row.purpose,
          questions: Array.isArray(row.questions) ? row.questions : [],
          status: row.status,
          responseCount: Number(row.response_count || 0),
          completionRate: Number(row.completion_rate || 0),
          shareableLink: row.shareable_link,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      console.error("Business survey save error:", error);
      res.status(500).json({ success: false, error: "Failed to save survey" });
    }
  });

  // GET /api/business/surveys/:surveyId/responses — Load survey responses
  app.get("/api/business/surveys/:surveyId/responses", async (req, res) => {
    try {
      const { surveyId } = req.params;
      const result = await pool.query(
        `SELECT id, survey_id, respondent_email, respondent_name, answers, sentiment, key_insights, completed_at
         FROM survey_responses
         WHERE survey_id = $1
         ORDER BY completed_at DESC NULLS LAST`,
        [surveyId],
      );

      const data = result.rows.map((row: any) => ({
        id: row.id,
        surveyId: row.survey_id,
        respondentEmail: row.respondent_email,
        respondentName: row.respondent_name,
        answers: row.answers || {},
        sentiment: row.sentiment || "neutral",
        keyInsights: Array.isArray(row.key_insights) ? row.key_insights : [],
        completedAt: row.completed_at,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error("Business survey responses error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load survey responses" });
    }
  });

  // POST /api/business/surveys/:surveyId/responses — Submit survey response
  app.post("/api/business/surveys/:surveyId/responses", async (req, res) => {
    try {
      const { surveyId } = req.params;
      const { answers, respondentInfo } = req.body || {};

      const normalizedAnswers =
        typeof answers === "object" && answers !== null ? answers : {};
      const surveyResult = await pool.query(
        `SELECT id, questions, response_count, completion_rate
         FROM surveys
         WHERE id = $1
         LIMIT 1`,
        [surveyId],
      );

      if (surveyResult.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Survey not found" });
      }

      const survey = surveyResult.rows[0];
      const surveyQuestions = Array.isArray(survey.questions)
        ? survey.questions
        : [];
      const answeredCount = Object.values(normalizedAnswers).filter((value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "string") return value.trim().length > 0;
        return value !== null && value !== undefined;
      }).length;
      const responseCompletionRate =
        surveyQuestions.length > 0
          ? Math.round((answeredCount / surveyQuestions.length) * 100)
          : 100;

      const flattenedAnswerText = Object.values(normalizedAnswers)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
        .join(" ")
        .toLowerCase();

      const positiveWords = [
        "bra",
        "god",
        "flott",
        "fantastisk",
        "love",
        "great",
        "excellent",
      ];
      const negativeWords = [
        "darlig",
        "dårlig",
        "bad",
        "poor",
        "slow",
        "problem",
        "issue",
      ];
      const positiveHits = positiveWords.reduce(
        (count, word) => count + (flattenedAnswerText.includes(word) ? 1 : 0),
        0,
      );
      const negativeHits = negativeWords.reduce(
        (count, word) => count + (flattenedAnswerText.includes(word) ? 1 : 0),
        0,
      );
      const sentiment =
        positiveHits > negativeHits
          ? "positive"
          : negativeHits > positiveHits
            ? "negative"
            : "neutral";
      const keyInsights = Object.entries(normalizedAnswers)
        .filter(
          ([, value]) => typeof value === "string" && value.trim().length > 0,
        )
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value).trim()}`);

      const responseId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO survey_responses (
          id, survey_id, respondent_email, respondent_name, answers, sentiment, key_insights, completed_at, ip_address, user_agent
        ) VALUES (
          $1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, NOW(), $8, $9
        )`,
        [
          responseId,
          surveyId,
          typeof respondentInfo?.email === "string" ? respondentInfo.email : null,
          typeof respondentInfo?.name === "string" ? respondentInfo.name : null,
          JSON.stringify(normalizedAnswers),
          sentiment,
          JSON.stringify(keyInsights),
          req.ip || null,
          req.get("user-agent") || null,
        ],
      );

      const previousCount = Number(survey.response_count || 0);
      const previousCompletion = Number(survey.completion_rate || 0);
      const nextCount = previousCount + 1;
      const nextCompletion =
        previousCount > 0
          ? (previousCompletion * previousCount + responseCompletionRate) /
            nextCount
          : responseCompletionRate;

      await pool.query(
        `UPDATE surveys
         SET response_count = $2,
             completion_rate = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [surveyId, nextCount, nextCompletion],
      );

      res.json({
        success: true,
        data: {
          id: responseId,
          surveyId,
          respondentEmail:
            typeof respondentInfo?.email === "string"
              ? respondentInfo.email
              : null,
          respondentName:
            typeof respondentInfo?.name === "string" ? respondentInfo.name : null,
          answers: normalizedAnswers,
          sentiment,
          keyInsights,
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Business survey response save error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to submit survey response" });
    }
  });

  // GET /api/business/price-recommendation/:profession/:service — Recommended pricing snapshot
  app.get(
    "/api/business/price-recommendation/:profession/:service",
    async (req, res) => {
      try {
        const { profession, service } = req.params;
        const region = readString(req.query.region) ?? "Oslo";
        const categoryName = professionToCategory(profession);

        const result = await pool.query(
          `SELECT v.price_range, vp.unit_price
         FROM vendors v
         LEFT JOIN vendor_products vp ON vp.vendor_id = v.id AND vp.is_archived = false
         LEFT JOIN vendor_categories vc ON vc.id = v.category_id
         WHERE LOWER(vc.name) = LOWER($1) OR v.location ILIKE $2`,
          [categoryName, `%${region}%`],
        );

        const prices = result.rows
          .map((row: Record<string, unknown>) => {
            if (row.unit_price != null) {
              return toBiNumericMetric(row.unit_price, 0);
            }
            return priceRangeToNumber(
              typeof row.price_range === "string" ? row.price_range : null,
            );
          })
          .filter((price) => price > 0);

        if (prices.length === 0) {
          const fallbackPrice = service.toLowerCase().includes("bryllup")
            ? 35000
            : profession === "photographer"
              ? 9000
              : 15000;
          prices.push(
            Math.round(fallbackPrice * 0.8),
            fallbackPrice,
            Math.round(fallbackPrice * 1.25),
          );
        }

        const averagePrice = Math.round(
          prices.reduce((sum, value) => sum + value, 0) / prices.length,
        );
        const suggestedPrice = Math.round(
          averagePrice * (getCurrentSeasonalDemand() === "high" ? 1.12 : 1.05),
        );
        const spread = Math.max(...prices) - Math.min(...prices);
        const confidence = Math.max(
          0.55,
          Math.min(0.96, 0.58 + prices.length * 0.03 - spread / 250000),
        );

        return res.json({
          data: {
            suggestedPrice,
            confidence: Number(confidence.toFixed(2)),
            reasoning: `Basert på ${prices.length} prisreferanser i ${region} for ${categoryName.toLowerCase()} anbefales et nivå rundt ${suggestedPrice.toLocaleString("no-NO")} kr.`,
            competitiveAdvantage: [
              `Markedsintervall: ${Math.min(...prices).toLocaleString("no-NO")}–${Math.max(...prices).toLocaleString("no-NO")} kr`,
              getCurrentSeasonalDemand() === "high"
                ? "Høy sesong gjør det mulig å prise noe over markedssnittet."
                : "Moderat sesong tilsier tydelig differensiering og sterk verdiargumentasjon.",
              `Fokuser på tydelig leveransebeskrivelse for ${service.toLowerCase()} når du presenterer pris.`,
            ],
          },
        });
      } catch (error) {
        console.error("Business price recommendation error:", error);
        res
          .status(500)
          .json({ error: "Failed to load business price recommendation" });
      }
    },
  );

  // GET /api/business/seasonal-trends/:profession/:service — Seasonal demand model
  app.get(
    "/api/business/seasonal-trends/:profession/:service",
    async (req, res) => {
      try {
        const { profession, service } = req.params;
        res.json({
          data: buildSeasonalTrendPayload(profession, service),
        });
      } catch (error) {
        console.error("Business seasonal trends error:", error);
        res.status(500).json({ error: "Failed to load seasonal trends" });
      }
    },
  );

  // GET /api/business/swot-items/:userId/:profession — Filtered SWOT board items
  app.get("/api/business/swot-items/:userId/:profession", async (req, res) => {
    try {
      const { userId, profession } = req.params;
      const conditions = ["user_id = $1", "profession = $2"];
      const values: Array<string> = [userId, profession];

      const type = readString(req.query.type);
      const status = readString(req.query.status);
      const category = readString(req.query.category);

      if (type) {
        values.push(type);
        conditions.push(`type = $${values.length}`);
      }
      if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
      }
      if (category) {
        values.push(category);
        conditions.push(`category = $${values.length}`);
      }

      const result = await pool.query(
        `SELECT id, user_id, profession, type, title, description, impact, probability, urgency, status,
                category, tags, related_personas, target_date, resolved_date, confidence,
                created_at, updated_at
         FROM swot_items
         WHERE ${conditions.join(" AND ")}
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        values,
      );

      res.json({
        success: true,
        data: result.rows.map((row: Record<string, unknown>) =>
          normalizeSwotItemRecord(row),
        ),
      });
    } catch (error) {
      console.error("Business SWOT items list error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load SWOT items" });
    }
  });

  // POST /api/business/swot-items — Create SWOT item
  app.post("/api/business/swot-items", async (req, res) => {
    try {
      const userId = readString(req.body?.userId);
      const profession = readString(req.body?.profession);
      const type = readString(req.body?.type);
      const title = readString(req.body?.title);

      if (!userId || !profession || !type || !title) {
        return res
          .status(400)
          .json({
            success: false,
            error: "userId, profession, type and title are required",
          });
      }

      const swotId = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO swot_items (
          id, user_id, profession, type, title, description, impact, probability, urgency, status,
          category, tags, related_personas, target_date, resolved_date,
          data_source, confidence, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12::jsonb, $13::jsonb, $14::timestamp, $15::timestamp,
          $16, $17, NOW(), NOW()
        )
        RETURNING id, user_id, profession, type, title, description, impact, probability, urgency, status,
                  category, tags, related_personas, target_date, resolved_date, confidence,
                  created_at, updated_at`,
        [
          swotId,
          userId,
          profession,
          type,
          title,
          readString(req.body?.description) ?? "",
          readString(req.body?.impact) ?? "medium",
          Math.max(
            0,
            Math.min(
              100,
              Math.round(toBiNumericMetric(req.body?.probability, 50)),
            ),
          ),
          readString(req.body?.urgency) ?? "medium",
          readString(req.body?.status) ?? "identified",
          readString(req.body?.category) ?? "general",
          JSON.stringify(toBiStringArray(req.body?.tags)),
          JSON.stringify(toBiStringArray(req.body?.relatedPersonas)),
          readString(req.body?.targetDate) ?? null,
          readString(req.body?.resolvedDate) ?? null,
          readString(req.body?.source) ?? "manual",
          Math.max(
            0,
            Math.min(
              100,
              Math.round(toBiNumericMetric(req.body?.confidence, 50)),
            ),
          ),
        ],
      );

      res.status(201).json({
        success: true,
        data: normalizeSwotItemRecord(result.rows[0] as Record<string, unknown>),
      });
    } catch (error) {
      console.error("Business SWOT item create error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create SWOT item" });
    }
  });

  // PUT /api/business/swot-items — Update SWOT item
  app.put("/api/business/swot-items", async (req, res) => {
    try {
      const swotId = readString(req.body?.id);
      const requesterId =
        readString(req.headers["x-user-id"]) ?? readString(req.body?.userId);

      if (!swotId) {
        return res.status(400).json({ success: false, error: "id is required" });
      }

      const values: Array<unknown> = [
        readString(req.body?.type) ?? "strength",
        readString(req.body?.title) ?? "Uten tittel",
        readString(req.body?.description) ?? "",
        readString(req.body?.impact) ?? "medium",
        Math.max(
          0,
          Math.min(100, Math.round(toBiNumericMetric(req.body?.probability, 50))),
        ),
        readString(req.body?.urgency) ?? "medium",
        readString(req.body?.status) ?? "identified",
        readString(req.body?.category) ?? "general",
        JSON.stringify(toBiStringArray(req.body?.tags)),
        JSON.stringify(toBiStringArray(req.body?.relatedPersonas)),
        readString(req.body?.targetDate) ?? null,
        readString(req.body?.resolvedDate) ?? null,
        readString(req.body?.source) ?? "manual",
        Math.max(
          0,
          Math.min(100, Math.round(toBiNumericMetric(req.body?.confidence, 50))),
        ),
        swotId,
      ];

      let whereClause = "id = $15";
      if (requesterId) {
        values.push(requesterId);
        whereClause += ` AND user_id = $${values.length}`;
      }

      const result = await pool.query(
        `UPDATE swot_items
         SET type = $1,
             title = $2,
             description = $3,
             impact = $4,
             probability = $5,
             urgency = $6,
             status = $7,
             category = $8,
             tags = $9::jsonb,
             related_personas = $10::jsonb,
             target_date = $11::timestamp,
             resolved_date = $12::timestamp,
             data_source = COALESCE($13, data_source),
             confidence = $14,
             updated_at = NOW()
         WHERE ${whereClause}
         RETURNING id, user_id, profession, type, title, description, impact, probability, urgency, status,
                   category, tags, related_personas, target_date, resolved_date, confidence,
                   created_at, updated_at`,
        values,
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "SWOT item not found" });
      }

      res.json({
        success: true,
        data: normalizeSwotItemRecord(result.rows[0] as Record<string, unknown>),
      });
    } catch (error) {
      console.error("Business SWOT item update error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update SWOT item" });
    }
  });

  // DELETE /api/business/swot-items/:itemId — Delete SWOT item
  app.delete("/api/business/swot-items/:itemId", async (req, res) => {
    try {
      const itemId = req.params.itemId;
      const requesterId =
        readString(req.headers["x-user-id"]) ?? readString(req.query.userId);
      const values: Array<string> = [itemId];
      let query = "DELETE FROM swot_items WHERE id = $1";

      if (requesterId) {
        values.push(requesterId);
        query += ` AND user_id = $${values.length}`;
      }

      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: "SWOT item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Business SWOT item delete error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete SWOT item" });
    }
  });

  // GET /api/business/swot-analysis/:userId/:profession — Aggregated SWOT dashboard
  app.get("/api/business/swot-analysis/:userId/:profession", async (req, res) => {
    try {
      const { userId, profession } = req.params;
      const [itemResult, personaResult, surveyResult] = await Promise.all([
        pool.query(
          `SELECT id, user_id, profession, type, title, description, impact, probability, urgency, status,
                  category, tags, related_personas, target_date, resolved_date, confidence,
                  created_at, updated_at
           FROM swot_items
           WHERE user_id = $1 AND profession = $2
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
          [userId, profession],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM customer_personas
           WHERE user_id = $1 AND profession = $2`,
          [userId, profession],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM surveys
           WHERE user_id = $1 AND profession = $2`,
          [userId, profession],
        ),
      ]);

      const items = itemResult.rows as Array<Record<string, unknown>>;
      const formatLine = (row: Record<string, unknown>) => {
        const title = String(row.title || "Uten tittel");
        const description = readString(row.description);
        return description ? `${title} — ${description}` : title;
      };

      const strengths = items
        .filter((item) => item.type === "strength")
        .map(formatLine);
      const weaknesses = items
        .filter((item) => item.type === "weakness")
        .map(formatLine);
      const opportunities = items
        .filter((item) => item.type === "opportunity")
        .map(formatLine);
      const threats = items
        .filter((item) => item.type === "threat")
        .map(formatLine);

      const lastUpdated =
        items
          .map((item) => toBiIsoDateString(item.updated_at ?? item.created_at))
          .filter((value): value is string => typeof value === "string")
          .sort()
          .at(-1) ?? new Date().toISOString();

      res.json({
        success: true,
        data: {
          strengths,
          weaknesses,
          opportunities,
          threats,
          recommendations: buildSwotRecommendations(
            items,
            Math.round(toBiNumericMetric(personaResult.rows[0]?.count, 0)),
            Math.round(toBiNumericMetric(surveyResult.rows[0]?.count, 0)),
          ),
          scores: buildSwotScores(items),
          lastUpdated,
        },
      });
    } catch (error) {
      console.error("Business SWOT analysis error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load SWOT analysis" });
    }
  });

  // GET /api/business/swot-trends/:userId/:profession — SWOT trend series
  app.get("/api/business/swot-trends/:userId/:profession", async (req, res) => {
    try {
      const { userId, profession } = req.params;
      const days = Math.max(
        7,
        Math.min(365, Math.round(toBiNumericMetric(req.query.days, 30))),
      );

      const historyResult = await pool
        .query(
          `SELECT snapshot_date, strength_score, weakness_score, opportunity_score, threat_score,
                  opportunities_converted, weaknesses_resolved
           FROM swot_history
           WHERE user_id = $1 AND profession = $2
             AND snapshot_date >= NOW() - ($3::int * INTERVAL '1 day')
           ORDER BY snapshot_date ASC`,
          [userId, profession, days],
        )
        .catch(() => ({ rows: [] }));

      const rows =
        historyResult.rows.length > 0
          ? historyResult.rows
          : (
              await pool.query(
                `SELECT DATE(COALESCE(updated_at, created_at, NOW())) AS snapshot_date,
                    SUM(CASE WHEN type = 'strength' THEN
                      CASE impact WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
                    ELSE 0 END)::int AS strength_score,
                    SUM(CASE WHEN type = 'weakness' THEN
                      CASE impact WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
                    ELSE 0 END)::int AS weakness_score,
                    SUM(CASE WHEN type = 'opportunity' THEN
                      CASE impact WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
                    ELSE 0 END)::int AS opportunity_score,
                    SUM(CASE WHEN type = 'threat' THEN
                      CASE impact WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
                    ELSE 0 END)::int AS threat_score,
                    COUNT(*) FILTER (WHERE type = 'opportunity' AND status = 'resolved')::int AS opportunities_converted,
                    COUNT(*) FILTER (WHERE type = 'weakness' AND status = 'resolved')::int AS weaknesses_resolved
             FROM swot_items
             WHERE user_id = $1 AND profession = $2
               AND COALESCE(updated_at, created_at, NOW()) >= NOW() - ($3::int * INTERVAL '1 day')
             GROUP BY 1
             ORDER BY 1 ASC`,
                [userId, profession, days],
              )
            ).rows;

      res.json({
        success: true,
        data: rows.map((row: Record<string, unknown>) => ({
          date: toBiIsoDateString(row.snapshot_date) ?? new Date().toISOString(),
          strengthScore: Math.round(toBiNumericMetric(row.strength_score, 0)),
          weaknessScore: Math.round(toBiNumericMetric(row.weakness_score, 0)),
          opportunityScore: Math.round(
            toBiNumericMetric(row.opportunity_score, 0),
          ),
          threatScore: Math.round(toBiNumericMetric(row.threat_score, 0)),
          opportunitiesConverted: Math.round(
            toBiNumericMetric(row.opportunities_converted, 0),
          ),
          weaknessesResolved: Math.round(
            toBiNumericMetric(row.weaknesses_resolved, 0),
          ),
        })),
      });
    } catch (error) {
      console.error("Business SWOT trends error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load SWOT trends" });
    }
  });

  // GET /api/business/personas/:userId/:profession — Persona library
  app.get("/api/business/personas/:userId/:profession", async (req, res) => {
    try {
      const { userId, profession } = req.params;
      const result = await pool.query(
        `SELECT id, user_id, profession, name, age, location, occupation, family, income, bio, goals,
                frustrations, preferred_brands, avatar_color, avatar_url, customer_type, budget_tier,
                market_size, average_value, conversion_rate, created_at, updated_at
         FROM customer_personas
         WHERE user_id = $1 AND profession = $2
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        [userId, profession],
      );

      res.json({
        success: true,
        data: result.rows.map((row: Record<string, unknown>) =>
          normalizePersonaRecord(row),
        ),
      });
    } catch (error) {
      console.error("Business personas list error:", error);
      res.status(500).json({ success: false, error: "Failed to load personas" });
    }
  });

  // POST /api/business/personas — Create persona
  app.post("/api/business/personas", async (req, res) => {
    try {
      const userId = readString(req.body?.userId);
      const profession = readString(req.body?.profession);
      const name = readString(req.body?.name);

      if (!userId || !profession || !name) {
        return res
          .status(400)
          .json({
            success: false,
            error: "userId, profession and name are required",
          });
      }

      const personaId = crypto.randomUUID();
      const ageRange = readString(req.body?.ageRange) ?? "30-40";
      const parsedAge = parseBiPersonaAge(ageRange);
      const result = await pool.query(
        `INSERT INTO customer_personas (
          id, user_id, profession, name, age, location, occupation, family, income, bio, goals,
          frustrations, personality, social, preferred_channels, preferred_brands, avatar_color,
          avatar_url, customer_type, budget_tier, market_size, average_value, conversion_rate, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17,
          $18, $19, $20, $21, $22, $23, NOW(), NOW()
        )
        RETURNING id, user_id, profession, name, age, location, occupation, family, income, bio, goals,
                  frustrations, preferred_brands, avatar_color, avatar_url, customer_type, budget_tier,
                  market_size, average_value, conversion_rate, created_at, updated_at`,
        [
          personaId,
          userId,
          profession,
          name,
          parsedAge,
          readString(req.body?.location) ?? "Norge",
          readString(req.body?.occupation) ??
            readString(req.body?.description) ??
            null,
          readString(req.body?.family) ??
            readString(req.body?.customerType) ??
            "quality focused",
          readString(req.body?.income) ?? "standard",
          readString(req.body?.description) ?? "",
          JSON.stringify(toBiStringArray(req.body?.goals)),
          JSON.stringify(toBiStringArray(req.body?.painPoints)),
          JSON.stringify({
            introvert: 50,
            sensing: 50,
            thinking: 50,
            judging: 50,
          }),
          JSON.stringify({ growth: 50, power: 50, social: 50 }),
          JSON.stringify({
            traditionalAds: 35,
            socialMedia: 55,
            referral: 60,
            email: 45,
          }),
          JSON.stringify(toBiStringArray(req.body?.motivations)),
          readString(req.body?.avatarColor) ?? "#ff6b35",
          readString(req.body?.avatarUrl) ?? null,
          readString(req.body?.customerType) ?? "quality_focused",
          readString(req.body?.budgetTier) ?? "standard",
          Math.round(toBiNumericMetric(req.body?.marketSize, 0)),
          toBiNumericMetric(req.body?.averageValue, 0),
          Math.round(toBiNumericMetric(req.body?.conversionRate, 0)),
        ],
      );

      res.status(201).json({
        success: true,
        data: normalizePersonaRecord(result.rows[0] as Record<string, unknown>),
      });
    } catch (error) {
      console.error("Business persona create error:", error);
      res.status(500).json({ success: false, error: "Failed to create persona" });
    }
  });

  // PUT /api/business/personas — Update persona
  app.put("/api/business/personas", async (req, res) => {
    try {
      const personaId = readString(req.body?.id);
      const requesterId =
        readString(req.headers["x-user-id"]) ?? readString(req.body?.userId);

      if (!personaId) {
        return res.status(400).json({ success: false, error: "id is required" });
      }

      const values: Array<unknown> = [
        readString(req.body?.name) ?? "Ukjent persona",
        parseBiPersonaAge(readString(req.body?.ageRange) ?? "30-40"),
        readString(req.body?.location) ?? "Norge",
        readString(req.body?.occupation) ??
          readString(req.body?.description) ??
          null,
        readString(req.body?.family) ??
          readString(req.body?.customerType) ??
          "quality focused",
        readString(req.body?.income) ?? "standard",
        readString(req.body?.description) ?? "",
        JSON.stringify(toBiStringArray(req.body?.goals)),
        JSON.stringify(toBiStringArray(req.body?.painPoints)),
        JSON.stringify(toBiStringArray(req.body?.motivations)),
        readString(req.body?.avatarColor) ?? "#ff6b35",
        readString(req.body?.avatarUrl) ?? null,
        readString(req.body?.customerType) ?? "quality_focused",
        readString(req.body?.budgetTier) ?? "standard",
        Math.round(toBiNumericMetric(req.body?.marketSize, 0)),
        toBiNumericMetric(req.body?.averageValue, 0),
        Math.round(toBiNumericMetric(req.body?.conversionRate, 0)),
        personaId,
      ];

      let whereClause = "id = $18";
      if (requesterId) {
        values.push(requesterId);
        whereClause += ` AND user_id = $${values.length}`;
      }

      const result = await pool.query(
        `UPDATE customer_personas
         SET name = $1,
             age = $2,
             location = $3,
             occupation = $4,
             family = $5,
             income = $6,
             bio = $7,
             goals = $8::jsonb,
             frustrations = $9::jsonb,
             preferred_brands = $10::jsonb,
             avatar_color = $11,
             avatar_url = $12,
             customer_type = $13,
             budget_tier = $14,
             market_size = $15,
             average_value = $16,
             conversion_rate = $17,
             updated_at = NOW()
         WHERE ${whereClause}
         RETURNING id, user_id, profession, name, age, location, occupation, family, income, bio, goals,
                   frustrations, preferred_brands, avatar_color, avatar_url, customer_type, budget_tier,
                   market_size, average_value, conversion_rate, created_at, updated_at`,
        values,
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Persona not found" });
      }

      res.json({
        success: true,
        data: normalizePersonaRecord(result.rows[0] as Record<string, unknown>),
      });
    } catch (error) {
      console.error("Business persona update error:", error);
      res.status(500).json({ success: false, error: "Failed to update persona" });
    }
  });

  // DELETE /api/business/personas/:personaId — Archive persona
  app.delete("/api/business/personas/:personaId", async (req, res) => {
    try {
      const requesterId =
        readString(req.headers["x-user-id"]) ?? readString(req.query.userId);
      const values: Array<string> = [req.params.personaId];
      let query = "DELETE FROM customer_personas WHERE id = $1";

      if (requesterId) {
        values.push(requesterId);
        query += ` AND user_id = $${values.length}`;
      }

      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Persona not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Business persona delete error:", error);
      res.status(500).json({ success: false, error: "Failed to delete persona" });
    }
  });

  // GET /api/business/marketing-strategy/:userId/:profession — Marketing recommendations and content cadence
  app.get(
    "/api/business/marketing-strategy/:userId/:profession",
    async (req, res) => {
      try {
        const { userId, profession } = req.params;
        const [personaResult, newsletterResult] = await Promise.all([
          pool.query(
            `SELECT name, customer_type, location
           FROM customer_personas
           WHERE user_id = $1 AND profession = $2
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
           LIMIT 3`,
            [userId, profession],
          ),
          pool.query(
            `SELECT subject, audience_segment, status, open_rate, click_rate, scheduled_at
           FROM newsletter_campaigns
           WHERE user_id = $1
           ORDER BY scheduled_at DESC NULLS LAST, created_at DESC NULLS LAST
           LIMIT 3`,
            [userId],
          ),
        ]);

        const categoryLabel = professionToCategory(profession).toLowerCase();
        const currentDemand = getCurrentSeasonalDemand();
        const strongestPersona = personaResult.rows[0] as
          | Record<string, unknown>
          | undefined;
        const personaName = strongestPersona?.name
          ? String(strongestPersona.name)
          : "nye leads";
        const personaLocation = strongestPersona?.location
          ? String(strongestPersona.location)
          : "Oslo";
        const newsletterCampaigns = newsletterResult.rows as Array<
          Record<string, unknown>
        >;

        const campaigns =
          newsletterCampaigns.length > 0
            ? newsletterCampaigns.map((campaign) => ({
                title: String(campaign.subject || "Ny kampanje"),
                description: `Målrettet mot ${humanizeAudienceSegment(campaign.audience_segment)} med fokus på ${categoryLabel}.`,
                duration: campaign.scheduled_at
                  ? new Date(String(campaign.scheduled_at)).toLocaleDateString(
                      "no-NO",
                    )
                  : "Løpende",
                expectedROI: `${Math.max(12, Math.round(toBiNumericMetric(campaign.open_rate, 18) + toBiNumericMetric(campaign.click_rate, 4)))}%`,
              }))
            : [
                {
                  title: "Portefølje-boost",
                  description: `Løft frem ferske leveranser og sosialt bevis for ${categoryLabel}.`,
                  duration: "2 uker",
                  expectedROI: currentDemand === "high" ? "28%" : "18%",
                },
                {
                  title: "Referral-flyt",
                  description:
                    "Belønn henvisninger med tydelig bonus eller prioritet i bookingkalenderen.",
                  duration: "Løpende",
                  expectedROI: "34%",
                },
                {
                  title: "Lokalt autoritetsinnhold",
                  description: `Bygg synlighet rundt ${personaLocation} med guides, case og anbefalinger.`,
                  duration: "4 uker",
                  expectedROI: "22%",
                },
              ];

        res.json({
          data: {
            socialMedia: {
              facebook: `Fremhev kundehistorier og anbefalinger for ${personaName} 3 ganger i uken.`,
              instagram: `Vis prosess, detaljer og ferdige resultater for ${categoryLabel} i reels og stories nesten daglig.`,
              linkedin: `Del faglige refleksjoner og case som viser profesjonalitet og pålitelig levering i ${personaLocation}.`,
              twitter: `Bruk korte faglige observasjoner, bransjenyheter og sesongtips for å holde merkevaren synlig.`,
            },
            contentPlan: [
              {
                day: "Mandag",
                content: "Vis konkret før/etter-resultat eller leveransecase.",
              },
              {
                day: "Onsdag",
                content: `Svar på et vanlig spørsmål fra ${personaName} i kortformat.`,
              },
              {
                day: "Fredag",
                content: "Publiser testimonial, referanse eller kvalitetsbevis.",
              },
              {
                day: "Søndag",
                content:
                  currentDemand === "high"
                    ? "Call-to-action for booking og tilgjengelige datoer."
                    : "Bygg relasjon med behind-the-scenes og ekspertise.",
              },
            ],
            seo: {
              primaryKeywords: [
                `${categoryLabel} ${personaLocation}`.trim(),
                `profesjonell ${categoryLabel}`,
                `${categoryLabel} pris`,
              ],
              secondaryKeywords: [
                `${categoryLabel} tips`,
                `${categoryLabel} booking`,
                `${categoryLabel} kundeerfaringer`,
              ],
            },
            campaigns,
          },
        });
      } catch (error) {
        console.error("Business marketing strategy error:", error);
        res.status(500).json({ error: "Failed to load marketing strategy" });
      }
    },
  );

  // GET /api/business/newsletter-campaigns/:userId — Newsletter performance and campaign list
  app.get("/api/business/newsletter-campaigns/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT id, subject, content, audience_segment, recipient_count, status, scheduled_at, sent_at,
                open_count, click_count, unsubscribe_count, bounce_count, open_rate, click_rate, created_at
         FROM newsletter_campaigns
         WHERE user_id = $1
         ORDER BY scheduled_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        [userId],
      );

      const campaigns = result.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        subject: String(row.subject || "Uten emne"),
        audience: humanizeAudienceSegment(row.audience_segment),
        status: humanizeNewsletterStatus(row.status),
        scheduledDate: row.scheduled_at
          ? new Date(String(row.scheduled_at)).toLocaleDateString("no-NO")
          : row.sent_at
            ? new Date(String(row.sent_at)).toLocaleDateString("no-NO")
            : "-",
        openRate:
          row.open_rate != null
            ? `${Math.round(toBiNumericMetric(row.open_rate, 0))}%`
            : "-",
      }));

      const stats = {
        totalCampaigns: campaigns.length,
        totalSubscribers: result.rows.reduce(
          (highest, row: Record<string, unknown>) =>
            Math.max(
              highest,
              Math.round(toBiNumericMetric(row.recipient_count, 0)),
            ),
          0,
        ),
        avgOpenRate:
          campaigns.length > 0
            ? Math.round(
                result.rows.reduce(
                  (sum, row: Record<string, unknown>) =>
                    sum + toBiNumericMetric(row.open_rate, 0),
                  0,
                ) / campaigns.length,
              )
            : 0,
        avgClickRate:
          campaigns.length > 0
            ? Math.round(
                result.rows.reduce(
                  (sum, row: Record<string, unknown>) =>
                    sum + toBiNumericMetric(row.click_rate, 0),
                  0,
                ) / campaigns.length,
              )
            : 0,
      };

      res.json({
        data: {
          stats,
          campaigns,
        },
      });
    } catch (error) {
      console.error("Business newsletter campaigns error:", error);
      res.status(500).json({ error: "Failed to load newsletter campaigns" });
    }
  });

  // POST /api/business/newsletter-campaigns — Create newsletter campaign draft or schedule
  app.post("/api/business/newsletter-campaigns", async (req, res) => {
    try {
      const userId = readString(req.body?.userId);
      const subject = readString(req.body?.subject);
      const content = readString(req.body?.content);

      if (!userId || !subject || !content) {
        return res
          .status(400)
          .json({ error: "userId, subject and content are required" });
      }

      const campaignId = crypto.randomUUID();
      const scheduledDate = readString(req.body?.scheduledDate);
      const result = await pool.query(
        `INSERT INTO newsletter_campaigns (
          id, user_id, subject, content, html_content, audience_segment, template_id, recipient_count, status, scheduled_at,
          open_count, click_count, unsubscribe_count, bounce_count, open_rate, click_rate, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 0, $8, $9::timestamp,
          0, 0, 0, 0, 0, 0, '{}'::jsonb, NOW(), NOW()
        )
        RETURNING id, subject, audience_segment, status, scheduled_at, open_rate`,
        [
          campaignId,
          userId,
          subject,
          content,
          content,
          readString(req.body?.audienceSegment) ?? "all",
          readString(req.body?.templateId) ?? null,
          scheduledDate ? "scheduled" : "draft",
          scheduledDate ?? null,
        ],
      );

      const row = result.rows[0] as Record<string, unknown>;
      res.status(201).json({
        success: true,
        data: {
          id: String(row.id),
          subject: String(row.subject || subject),
          audience: humanizeAudienceSegment(row.audience_segment),
          status: humanizeNewsletterStatus(row.status),
          scheduledDate: row.scheduled_at
            ? new Date(String(row.scheduled_at)).toLocaleDateString("no-NO")
            : "-",
          openRate:
            row.open_rate != null
              ? `${Math.round(toBiNumericMetric(row.open_rate, 0))}%`
              : "-",
        },
      });
    } catch (error) {
      console.error("Business newsletter create error:", error);
      res.status(500).json({ error: "Failed to create newsletter campaign" });
    }
  });

  // GET /api/business/dashboard/:userId/:profession — Full BI dashboard data
  app.get("/api/business/dashboard/:userId/:profession", async (req, res) => {
    try {
      const { profession } = req.params;
      const categoryName = professionToCategory(profession);

      // Get competitor count (vendors in same category)
      const categoryResult = await pool.query(
        `SELECT c.id FROM vendor_categories c WHERE LOWER(c.name) = LOWER($1)`,
        [categoryName],
      );
      const categoryId = categoryResult.rows[0]?.id;

      let competitorCount = 0;
      let vendorPrices: number[] = [];
      let vendorLocations: string[] = [];

      if (categoryId) {
        const vendorsResult = await pool.query(
          `SELECT v.price_range, v.location FROM vendors v WHERE v.category_id = $1`,
          [categoryId],
        );
        competitorCount = vendorsResult.rows.length;
        vendorPrices = vendorsResult.rows.map(
          (v: { price_range: string | null }) =>
            priceRangeToNumber(v.price_range),
        );
        vendorLocations = vendorsResult.rows
          .map((v: { location: string | null }) => v.location || "")
          .filter((l: string) => l.length > 0);
      } else {
        // Fallback: count all vendors
        const allResult = await pool.query(
          `SELECT price_range, location FROM vendors`,
        );
        competitorCount = allResult.rows.length;
        vendorPrices = allResult.rows.map((v: { price_range: string | null }) =>
          priceRangeToNumber(v.price_range),
        );
        vendorLocations = allResult.rows
          .map((v: { location: string | null }) => v.location || "")
          .filter((l: string) => l.length > 0);
      }

      // Also check vendor_products for real prices
      const productsResult = await pool.query(
        `SELECT vp.unit_price FROM vendor_products vp
         JOIN vendors v ON v.id = vp.vendor_id
         WHERE vp.unit_price IS NOT NULL AND vp.is_archived = false
         ${categoryId ? "AND v.category_id = $1" : ""}
         LIMIT 100`,
        categoryId ? [categoryId] : [],
      );
      if (productsResult.rows.length > 0) {
        vendorPrices = productsResult.rows.map((p: { unit_price: string }) =>
          parseFloat(p.unit_price),
        );
      }

      const averageMarketPrice =
        vendorPrices.length > 0
          ? Math.round(
              vendorPrices.reduce((a: number, b: number) => a + b, 0) /
                vendorPrices.length,
            )
          : 30000;

      const minPrice =
        vendorPrices.length > 0 ? Math.min(...vendorPrices) : 15000;
      const maxPrice =
        vendorPrices.length > 0 ? Math.max(...vendorPrices) : 50000;

      // Determine best regions from vendor locations
      const regionCounts: Record<string, number> = {};
      for (const loc of vendorLocations) {
        for (const region of Object.keys(norwegianRegionData)) {
          if (loc.toLowerCase().includes(region.toLowerCase())) {
            regionCounts[region] = (regionCounts[region] || 0) + 1;
          }
        }
      }
      const bestRegions = Object.entries(regionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([region]) => region);
      if (bestRegions.length === 0)
        bestRegions.push("Oslo", "Bergen", "Trondheim");

      // Confidence based on data availability
      const confidence = Math.min(
        0.95,
        0.5 + vendorPrices.length * 0.05 + competitorCount * 0.03,
      );
      const suggestedPrice = Math.round(averageMarketPrice * 1.1); // Slightly above average

      const data = {
        quickStats: {
          averageMarketPrice,
          competitorCount,
          seasonalDemand: getCurrentSeasonalDemand(),
          bestRegions,
        },
        marketInsights: {
          pricingGuidance: {
            suggestedPrice,
            confidence: Math.round(confidence * 100) / 100,
            marketPosition:
              suggestedPrice > averageMarketPrice * 1.2
                ? "Premium"
                : suggestedPrice > averageMarketPrice * 0.9
                  ? "Mid-market"
                  : "Budget",
            competitiveAdvantage: [
              `${competitorCount} konkurrenter i ${categoryName}-segmentet`,
              `Prisintervall: kr ${minPrice.toLocaleString()} – kr ${maxPrice.toLocaleString()}`,
              bestRegions.length > 0
                ? `Sterkeste markeder: ${bestRegions.join(", ")}`
                : "Markedsdata begrens et",
              getCurrentSeasonalDemand() === "high"
                ? "Høy sesongetterspørsel akkurat nå"
                : "Moderat etterspørsel denne perioden",
            ],
            reasoning:
              `Basert på ${vendorPrices.length} prisreferanser og ${competitorCount} aktive konkurrenter. ` +
              `Gjennomsnittsprisen i markedet er kr ${averageMarketPrice.toLocaleString()}, ` +
              `og vi anbefaler en pris på kr ${suggestedPrice.toLocaleString()} for å posisjonere deg over markedsgjennomsnittet.`,
          },
        },
        recommendations: [
          `Fokuser på ${bestRegions[0] || "Oslo"}-regionen for best avkastning`,
          getCurrentSeasonalDemand() === "high"
            ? "Nå er høysesong – utnytt høy etterspørsel med premiumprising"
            : "Bruk lavsesongen til å bygge portefølje og markedsføring",
          `Med ${competitorCount} konkurrenter bør du differensiere gjennom kvalitet og unik stil`,
          "Opprett en sterk online tilstedeværelse med Google-anmeldelser",
          averageMarketPrice > 40000
            ? "Det er rom for premiumpakker i dette segmentet"
            : "Vurder å bygge ut tilleggstjenester for å øke snittprisen",
        ],
      };

      res.json({ data });
    } catch (error) {
      console.error("Business dashboard error:", error);
      res.status(500).json({ error: "Failed to load business dashboard data" });
    }
  });

  // GET /api/business/market-analysis/:profession/:service — Market pricing analysis
  app.get(
    "/api/business/market-analysis/:profession/:service",
    async (req, res) => {
      try {
        const { profession, service } = req.params;
        const region = (req.query.region as string) || "Oslo";
        const categoryName = professionToCategory(profession);

        // Get vendor prices for this category in the specified region
        const result = await pool.query(
          `SELECT v.price_range, vp.unit_price
         FROM vendors v
         LEFT JOIN vendor_products vp ON vp.vendor_id = v.id AND vp.is_archived = false
         LEFT JOIN vendor_categories vc ON vc.id = v.category_id
         WHERE LOWER(vc.name) = LOWER($1)
         OR v.location ILIKE $2`,
          [categoryName, `%${region}%`],
        );

        const prices: number[] = [];
        for (const row of result.rows) {
          if (row.unit_price) {
            prices.push(parseFloat(row.unit_price));
          } else if (row.price_range) {
            prices.push(priceRangeToNumber(row.price_range));
          }
        }

        // Fallback pricing based on service type
        if (prices.length === 0) {
          const servicePricing: Record<string, number> = {
            bryllup: 35000,
            portrett: 4000,
            bedrift: 8000,
            arrangement: 15000,
            produkt: 6000,
          };
          const basePrice = servicePricing[service] || 25000;
          prices.push(basePrice * 0.7, basePrice, basePrice * 1.4);
        }

        const averagePrice = Math.round(
          prices.reduce((a, b) => a + b, 0) / prices.length,
        );

        const data = {
          averagePrice,
          priceRange: {
            min: Math.round(Math.min(...prices)),
            max: Math.round(Math.max(...prices)),
          },
          seasonalFactors: weddingSeasonalFactors,
          sampleSize: result.rows.length,
          region,
          service,
        };

        res.json({ data });
      } catch (error) {
        console.error("Market analysis error:", error);
        res.status(500).json({ error: "Failed to load market analysis data" });
      }
    },
  );

  // GET /api/business/regional-analysis/:profession — Regional market opportunities
  app.get("/api/business/regional-analysis/:profession", async (req, res) => {
    try {
      const { profession } = req.params;
      const categoryName = professionToCategory(profession);

      // Count vendors per region
      const vendorResult = await pool.query(
        `SELECT v.location FROM vendors v
         LEFT JOIN vendor_categories vc ON vc.id = v.category_id
         WHERE LOWER(vc.name) = LOWER($1) OR $1 = ''`,
        [categoryName],
      );

      const regionVendorCounts: Record<string, number> = {};
      for (const row of vendorResult.rows) {
        const loc = (row.location || "").toLowerCase();
        for (const region of Object.keys(norwegianRegionData)) {
          if (loc.includes(region.toLowerCase())) {
            regionVendorCounts[region] = (regionVendorCounts[region] || 0) + 1;
          }
        }
      }

      const totalVendors = vendorResult.rows.length || 1;
      const data = Object.entries(norwegianRegionData).map(([region, info]) => {
        const vendorCount = regionVendorCounts[region] || 0;
        const competitionDensity = Math.round((vendorCount / totalVendors) * 100);
        // Higher opportunity = high population + low competition
        const marketOpportunity = Math.min(
          100,
          Math.round(
            (info.population / 709000) * 50 + // population weight
              (1 - competitionDensity / 100) * 30 + // low competition bonus
              (info.avgIncome / 620000) * 20, // income weight
          ),
        );

        return {
          region,
          populationSize: info.population,
          averageIncome: info.avgIncome,
          competitionDensity,
          marketOpportunity,
          recommendedStrategy:
            marketOpportunity > 60
              ? "Ekspander aktivt – stort potensial"
              : marketOpportunity > 35
                ? "Utforsk muligheter – moderat konkurranse"
                : "Niche-strategi – fokuser på differensiering",
        };
      });

      res.json({ data });
    } catch (error) {
      console.error("Regional analysis error:", error);
      res.status(500).json({ error: "Failed to load regional analysis data" });
    }
  });

  // GET /api/business/intelligence/status — BI system health status
  app.get("/api/business/intelligence/status", async (_req, res) => {
    try {
      // Verify database connectivity
      const start = Date.now();
      await pool.query("SELECT 1");
      const queryTime = Date.now() - start;

      // Count data sources for accuracy metric
      const vendorCount = await pool.query("SELECT COUNT(*) as cnt FROM vendors");
      const productCount = await pool.query(
        "SELECT COUNT(*) as cnt FROM vendor_products",
      );
      const totalDataPoints =
        parseInt(vendorCount.rows[0].cnt) + parseInt(productCount.rows[0].cnt);
      const dataAccuracy =
        totalDataPoints > 20 ? "95%" : totalDataPoints > 5 ? "80%" : "65%";

      res.json({
        online: true,
        analyticsEngine: "active",
        performance: {
          dataAccuracy,
          queryResponseTime: `${queryTime}ms`,
        },
        version: "2.1.0",
        timestamp: new Date().toISOString(),
        dataSources: {
          vendors: parseInt(vendorCount.rows[0].cnt),
          products: parseInt(productCount.rows[0].cnt),
        },
      });
    } catch (error) {
      console.error("BI status error:", error);
      res.json({
        online: false,
        analyticsEngine: "inactive",
        performance: { dataAccuracy: "0%", queryResponseTime: "N/A" },
        version: "2.1.0",
        timestamp: new Date().toISOString(),
      });
    }
  });
}
