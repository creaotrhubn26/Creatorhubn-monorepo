-- Klient-versjon-historikk + leveranse-progress-timeline.
--
-- Bygger to relaterte features for video/foto-leveranse:
--   1. Versjons-historikk per galleri (R1 → R2 → R3 → Final) med klient-
--      godkjenning/revisjons-anmodning per versjon. Tidligere hadde
--      videografen kun en lokal videoVersion-state i UniversalShowcase
--      som klienten ikke så.
--   2. Leveranse-progress-timeline per galleri: hvilken fase (Selection,
--      Edit, Color grade, R1, Klient-review, R2, ..., Levert) prosjektet
--      er i og når neste milepæl forventes ferdig. Synliggjøres for
--      klient som "Bjarne er nå i fase: Color grade — neste milepæl: R1,
--      forventet 18. mai".
--
-- Vi kunne utvidet `project_milestones`, men det brukes til intern oppgave-
-- styring med fri-tekst-status. Vi vil ha en fast modell på leveranse-
-- siden så klient-UI kan rendere konsistent. Derfor egen tabell.

-- ─── 1. Versjons-tabell ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_gallery_image_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL,
    -- Refererer photographer_client_galleries.id (ikke FK fordi den
    -- tabellen mangler eksplisitt id-constraint i eksisterende schema,
    -- og fordi vi vil holde versjon-historikk selv om galleriet
    -- mykslettes)
  version_label TEXT NOT NULL,
    -- 'R1', 'R2', 'R3', 'Final' — fri tekst så fotografen kan bruke
    -- egne konvensjoner ('Director cut', 'Sosial-versjon', etc.)
  version_order INTEGER NOT NULL DEFAULT 1,
    -- Sorterer versjoner i UI. 1 = R1, 2 = R2, osv. Tillater
    -- gjenoppretting av tegn slik at vi kan sette inn en R1.5 om nødvendig.
  is_published_to_client BOOLEAN NOT NULL DEFAULT FALSE,
    -- Når TRUE: klient ser denne versjonen i galleriet. Fotograf
    -- jobber på neste versjon usett til den publiseres.
  published_at TIMESTAMPTZ,
  notes TEXT,
    -- Fri-tekst "Hva er endret fra forrige versjon":
    --   "Lagt til drone-shots fra 14:30. Trimmet ned tale fra Per."
  metadata JSONB DEFAULT '{}'::jsonb,
    -- Plass for varianter (LUT brukt, frame-rate, etc.) uten å
    -- bløse skjemaet.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gallery_id, version_label)
);

CREATE INDEX IF NOT EXISTS client_gallery_versions_gallery_idx
  ON client_gallery_image_versions (gallery_id, version_order DESC);

CREATE INDEX IF NOT EXISTS client_gallery_versions_published_idx
  ON client_gallery_image_versions (gallery_id, is_published_to_client, published_at DESC)
  WHERE is_published_to_client = TRUE;

-- ─── 2. Per-bilde versjons-mapping ───────────────────────────────────
-- Et bilde/video kan tilhøre flere versjoner (uendret R1 → R2 bilde).
-- Vi lagrer mapping i en bro-tabell heller enn å duplisere bilder.

CREATE TABLE IF NOT EXISTS client_gallery_image_version_links (
  version_id UUID NOT NULL REFERENCES client_gallery_image_versions(id) ON DELETE CASCADE,
  image_id UUID NOT NULL,
    -- Refererer client_gallery_images.id
  sort_order INTEGER NOT NULL DEFAULT 0,
    -- Lar fotograf endre rekkefølge per versjon uten å touche bilde-raden
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, image_id)
);

CREATE INDEX IF NOT EXISTS client_gallery_image_version_links_image_idx
  ON client_gallery_image_version_links (image_id);

-- ─── 3. Klient-avgjørelse per versjon ────────────────────────────────

CREATE TABLE IF NOT EXISTS client_gallery_version_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES client_gallery_image_versions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
    -- 'approved'           — klient er fornøyd, leveransen er ferdig
    -- 'changes_requested'  — klient vil endringer (se decision_note)
    -- 'in_review'          — klient har åpnet, men ikke svart ennå
    -- 'rejected'           — formelt avvist (sjelden, men håndtert)
  decision_note TEXT,
    -- Fri tekst: "Kan dere bytte ut bilde 47 med en annen?"
  decided_by_email TEXT NOT NULL,
    -- Hvem som faktisk klikket. Brukes til audit + e-post-svar.
  decided_by_label TEXT,
    -- Visningsnavn ("Anna Olsen", "Brudeparet")
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS gallery_version_decisions_version_idx
  ON client_gallery_version_decisions (version_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS gallery_version_decisions_recent_idx
  ON client_gallery_version_decisions (decided_at DESC);

-- ─── 4. Leveranse-progress-milepæler ─────────────────────────────────

CREATE TABLE IF NOT EXISTS client_delivery_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL,
    -- Refererer photographer_client_galleries.id
  stage TEXT NOT NULL,
    -- Faste fasenavn — fotograf kan ikke navngi fritt. Holdes
    -- konsistent slik at klient-UI kan ha typografi/ikon per fase.
    -- 'booking'        — Avtale signert
    -- 'pre_shoot'      — Forberedelser, lokasjon-recce
    -- 'shoot_day'      — Selve fotograferingen
    -- 'selection'      — Sortering av råmateriale
    -- 'editing'        — Klipp + struktur
    -- 'color_grade'    — Fargekorrigering
    -- 'audio_mix'      — Lyd-redigering
    -- 'r1_delivered'   — Første utkast sendt til klient
    -- 'client_review'  — Klient ser igjennom
    -- 'r2_delivered'   — Andre utkast
    -- 'final_delivered'— Endelig versjon levert
    -- 'archived'       — Prosjekt arkivert
  stage_order INTEGER NOT NULL,
    -- Bestemmer rekkefølge i UI. 1 = booking, 12 = archived.
  display_label TEXT NOT NULL,
    -- "Color grade", "Klient-review" — overstyrer default mapping fra
    -- stage hvis fotografen vil tilpasse formuleringen
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'      — ikke startet
    -- 'in_progress'  — pågår nå
    -- 'completed'    — ferdig
    -- 'blocked'      — venter på klient eller annen blokker
    -- 'skipped'      — fotograf valgte bort fasen for dette prosjektet
  estimated_at TIMESTAMPTZ,
    -- Forventet ferdig — klient ser "ETA: 18. mai"
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  blocked_reason TEXT,
    -- Vises til klient: "Venter på godkjenning av R1"
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
    -- Lar fotografen skjule interne stadier (f.eks. 'archived')
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gallery_id, stage)
);

CREATE INDEX IF NOT EXISTS delivery_milestones_gallery_idx
  ON client_delivery_milestones (gallery_id, stage_order);

CREATE INDEX IF NOT EXISTS delivery_milestones_active_idx
  ON client_delivery_milestones (gallery_id, status)
  WHERE status IN ('in_progress', 'blocked');

-- ─── 5. Helper-funksjon: seed standard timeline ─────────────────────
-- Når et nytt galleri opprettes, ringer backend denne funksjonen for å
-- inserte 12 default milepæler. Fotografen kan da slette/skjule de som
-- ikke er relevante.

CREATE OR REPLACE FUNCTION seed_client_delivery_timeline(p_gallery_id UUID)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO client_delivery_milestones
    (gallery_id, stage, stage_order, display_label, status, is_client_visible)
  VALUES
    (p_gallery_id, 'booking',          1, 'Booking',           'completed',  TRUE),
    (p_gallery_id, 'pre_shoot',        2, 'Forberedelser',     'pending',    TRUE),
    (p_gallery_id, 'shoot_day',        3, 'Selve fotograferingen', 'pending', TRUE),
    (p_gallery_id, 'selection',        4, 'Utvalg av råmateriale', 'pending', TRUE),
    (p_gallery_id, 'editing',          5, 'Redigering',        'pending',    TRUE),
    (p_gallery_id, 'color_grade',      6, 'Fargekorrigering',  'pending',    TRUE),
    (p_gallery_id, 'audio_mix',        7, 'Lyd-redigering',    'pending',    TRUE),
    (p_gallery_id, 'r1_delivered',     8, 'R1 sendt til klient', 'pending',  TRUE),
    (p_gallery_id, 'client_review',    9, 'Klient ser igjennom', 'pending',  TRUE),
    (p_gallery_id, 'r2_delivered',    10, 'R2 sendt til klient', 'pending',  TRUE),
    (p_gallery_id, 'final_delivered', 11, 'Endelig versjon levert', 'pending', TRUE),
    (p_gallery_id, 'archived',        12, 'Arkivert',          'pending',    FALSE)
  ON CONFLICT (gallery_id, stage) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
