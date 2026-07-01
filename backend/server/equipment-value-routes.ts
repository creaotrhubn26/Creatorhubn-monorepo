/**
 * equipment-value-routes.ts — AI-markedsverdi for utstyr som IKKE finnes i den
 * (foto/video-tunge) katalogen. Musikkprodusentens studio-gear (Neumann, Bock,
 * Focusrite osv.) mangler i katalogen → Claude estimerer markedsverdi i NOK
 * (ny + typisk brukt) fra merke/modell. Frontend prøver katalog-søk FØRST,
 * faller tilbake hit.
 */
import type express from "express";

export interface EquipmentValueDeps {
  app: express.Application;
}

export function setupEquipmentValueRoutes(deps: EquipmentValueDeps): void {
  const { app } = deps;

  app.post("/api/equipment/estimate-value", async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "ai_unconfigured" });
      const name = String(req.body?.name || "").trim();
      const brand = String(req.body?.brand || "").trim();
      const model = String(req.body?.model || "").trim();
      const category = String(req.body?.category || "").trim();
      const label = [brand, model].filter(Boolean).join(" ") || name;
      if (!label) return res.status(400).json({ error: "missing_gear" });

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const prompt = `Du er ekspert på markedsverdi for musikk-/lyd-/foto/video-utstyr OG programvare/plugins/DAW-er i Norge.
Estimer markedsverdien i NORSKE KRONER (NOK) for:
- ${label}${category ? ` (kategori: ${category})` : ""}

For fysisk utstyr: gi ny- og typisk bruktpris. For programvare/plugin/DAW/virtuelt instrument/samplepakke: gi ordinær LISENS-/kjøpspris som newNok, og sett usedNok = null (programvare selges normalt ikke brukt). Bruk realistiske norske priser.
Svar KUN med gyldig JSON, ingen annen tekst:
{"newNok": <nypris/lisenspris i NOK, heltall el. null>, "usedNok": <bruktpris i NOK, heltall el. null>, "confidence": "<low|medium|high>", "note": "<kort norsk merknad, maks 12 ord>"}
Hvis du ikke kjenner produktet, sett verdier null og confidence low.`;

      const resp: any = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (resp?.content || []).map((b: any) => b?.text || "").join("").trim();
      let parsed: any = null;
      try { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
      if (!parsed) return res.json({ source: "ai", estimatedNok: null, newNok: null, usedNok: null, confidence: "low", note: "Kunne ikke estimere." });

      const newNok = Number(parsed.newNok) || null;
      const usedNok = Number(parsed.usedNok) || null;
      res.json({
        source: "ai",
        estimatedNok: usedNok || newNok,
        newNok, usedNok,
        confidence: parsed.confidence || "low",
        note: typeof parsed.note === "string" ? parsed.note : null,
      });
    } catch (e) { console.error("estimate-value", e); res.status(500).json({ error: "estimate_failed" }); }
  });
}
