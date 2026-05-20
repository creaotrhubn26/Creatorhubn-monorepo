-- 0136 — Seed "NextRole by CreatorHub" som installerbar abonnement-app
--
-- Strategi: legg inn én rad i marketplace_app_config med to subscription
-- tiers (Gratis + Pro 49 kr/mnd kampanje). Stripe-sync kjører automatisk
-- når admin oppdaterer raden via /api/admin/marketplace/apps/:id.
--
-- Kampanjepris: 49 kr/mnd (introduksjon) — bør forhøyes til 79 kr/mnd
-- etter pilot-perioden er over.
--
-- Idempotent: bruker ON CONFLICT (id) DO UPDATE så vi kan re-seede ved
-- behov uten å miste eksisterende Stripe-IDer.

INSERT INTO marketplace_app_config (
  id, name, category, description, long_description,
  logo_src, logo_alt, gradient_start, gradient_end,
  featured, trending, cta_label, rating, reviews_count,
  download_count, monthly_growth,
  pricing, subscription_tiers, features, display_order, is_active
) VALUES (
  'next-role',
  'NextRole',
  'Karriere',
  'AI-drevet CV-bygger og jobbsøk-pakke på norsk. Å søke jobb har aldri vært enklere.',
  'NextRole gjør jobbsøk like enkelt som å klikke. AI-en lager førsteutkast fra CV-en din, optimaliserer mot ATS-systemer, oversetter til engelsk, skriver søknadsbrev og forbereder deg på intervjuer. 15 profesjonelle maler, 8 fargeskjemaer, offentlig CV-deling med trygg lenke, og full integrasjon med Vitnemålsportalen, GitHub og LinkedIn. Drevet av Claude og bygget for norske jobbsøkere.',
  '/nextrole-mark.svg',
  'NextRole logo',
  '#FF6B35',
  '#E85A24',
  TRUE,
  TRUE,
  'Installer',
  4.8,
  127,
  1247,
  84,
  '{"free": false, "price": 49, "currency": "kr/mnd", "displayPrice": "49 kr / mnd", "note": "14 dagers gratis prøveperiode med alle Pro-features — ingen kort kreves"}'::jsonb,
  '[
    {
      "id": "trial",
      "name": "14 dagers prøveperiode",
      "price": "Gratis i 14 dager",
      "bestFor": "Prøv ALLE Pro-features uten kort — så velg pakken som passer",
      "features": [
        "Alle Pro-features låst opp i 14 dager",
        "Ingen kortinformasjon nødvendig",
        "Auto-konverterer til Standard (49 kr/mnd) ved fullføring — kan kanselleres når som helst"
      ]
    },
    {
      "id": "standard",
      "name": "Standard",
      "price": "49 kr / mnd",
      "bestFor": "Aktive jobbsøkere — kampanjepris ut 2026",
      "recommendedFor": ["photographer", "videographer", "developer", "designer", "marketing", "consultant", "creator"],
      "recommendationReason": "Du jobber i en bransje der profesjonell CV gjør forskjellen. Standard gir deg alt du trenger for å lande neste rolle.",
      "features": [
        "5 CV-er (master + tilpasninger per stilling)",
        "Alle 15 profesjonelle maler + 8 fargeskjemaer",
        "AI: sammendrag, omskriv-bullets, ATS-analyse",
        "PDF/DOCX-import (Claude leser eksisterende CV)",
        "Offentlig CV-deling med trygg lenke + visnings-tracking",
        "Eksport i PDF, DOCX, TXT",
        "Jobbsøknadssporing",
        "LinkedIn- og Vitnemålsportalen-import"
      ],
      "stripeAmount": 4900,
      "stripeInterval": "month"
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": "99 kr / mnd",
      "bestFor": "Bytter jobb ofte eller jobber internasjonalt",
      "features": [
        "Alt i Standard pluss:",
        "Ubegrenset antall CV-er",
        "AI søknadsbrev-generator (norsk + engelsk)",
        "AI intervjuforberedelse med spørsmål-sett",
        "Engelsk versjon av CV-en med ett klikk (AI-oversettelse)",
        "Versjon-historikk med restore-punkter",
        "GitHub-import av prosjekter",
        "CSV-eksport av jobbsøknader",
        "JSON-eksport (backup)",
        "Prioritert AI-rate-limit (50/min, 500/dag)",
        "Tidlig tilgang til nye funksjoner"
      ],
      "stripeAmount": 9900,
      "stripeInterval": "month"
    }
  ]'::jsonb,
  '["AI-CV-bygger", "ATS-optimalisering", "PDF-import", "GitHub-import", "Søknadsbrev-generator", "Intervjuforberedelse", "Offentlig CV-deling", "15 maler + 8 farger", "Engelsk oversettelse", "Versjon-historikk"]'::jsonb,
  10,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  logo_src = EXCLUDED.logo_src,
  logo_alt = EXCLUDED.logo_alt,
  gradient_start = EXCLUDED.gradient_start,
  gradient_end = EXCLUDED.gradient_end,
  featured = EXCLUDED.featured,
  trending = EXCLUDED.trending,
  cta_label = EXCLUDED.cta_label,
  pricing = EXCLUDED.pricing,
  subscription_tiers = EXCLUDED.subscription_tiers,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
