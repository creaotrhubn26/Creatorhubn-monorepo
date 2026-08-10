-- 0460_role_room_funding_applications.sql
--
-- Del A punkt 114, tredje runde: fra eksportfunksjon til søknadsflate.
--
-- Eksporten (0458) og innsendings-snapshotet (0459) løste hver sin bit, men
-- ingen av dem svarer på spørsmålet produsenten faktisk stiller: «er søknaden
-- klar til å sendes?» Det er der tiden går, og det er der søknader ryker.
--
-- Kravene under er hentet fra NFIs ordningssider, ikke funnet på. For
-- produksjonstilskudd til spillefilm etter markedsvurdering skal søknaden
-- inneholde kalkyle, finansieringsplan, framdriftsplan, opptaksplan og
-- inntektsprognose, samt forpliktende avtale med kinodistributør og
-- dokumentasjon av rettigheter etter åndsverkloven.
--
-- **Det viktigste enkeltkravet er 80 %.** Finansieringsplanen skal skille
-- bekreftet fra ubekreftet finansiering, og filmen må ha minimum 80 %
-- bekreftet. Det er en hard, regnbar terskel — og dermed noe systemet kan
-- svare på selv, framfor å be produsenten telle i et regneark.

-- ── Finansieringsplan ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_financing_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  source_name   VARCHAR(255) NOT NULL,
  -- NFI krever at planen spesifiserer private og offentlige midler.
  source_type   VARCHAR(20) NOT NULL CHECK (source_type IN ('public','private','own','other')),

  amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'NOK',

  -- Selve skillet 80 %-kravet regnes på. Bekreftet betyr tilsagn eller
  -- avtale — ikke «vi tror det går i orden».
  confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at  DATE,
  -- Hva bekreftelsen består i: tilsagnsbrev, avtale, e-post.
  evidence_note TEXT,

  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_financing_sources_project
  ON role_room_financing_sources (project_id);

COMMENT ON COLUMN role_room_financing_sources.confirmed IS
  'Tilsagn eller avtale foreligger. NFI krever minimum 80 % bekreftet finansiering.';

-- ── Krav per ordning ─────────────────────────────────────────────────────
-- Data, ikke kode — ordningene endrer krav, og den som oppdager det er en
-- produsent foran en frist.

CREATE TABLE IF NOT EXISTS role_room_funding_requirements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id     UUID NOT NULL REFERENCES role_room_funding_schemes(id) ON DELETE CASCADE,

  requirement_key VARCHAR(60) NOT NULL,
  label         VARCHAR(255) NOT NULL,
  description   TEXT,

  -- Hvilken automatisk sjekk som kan avgjøre kravet. NULL = kan bare
  -- bekreftes manuelt (typisk et vedlegg som må lastes opp).
  auto_check    VARCHAR(60),

  mandatory     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT rr_funding_requirement_unique UNIQUE (scheme_id, requirement_key)
);

CREATE INDEX IF NOT EXISTS idx_rr_funding_requirements_scheme
  ON role_room_funding_requirements (scheme_id, sort_order);

-- ── Søknaden ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_funding_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scheme_id     UUID NOT NULL REFERENCES role_room_funding_schemes(id) ON DELETE CASCADE,

  label         VARCHAR(255) NOT NULL,
  deadline_at   DATE,

  status        VARCHAR(30) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','ready','submitted','granted','rejected','withdrawn')),

  -- Settes ved innsending og peker på det fryste snapshotet (0459).
  submitted_at  TIMESTAMPTZ,
  snapshot_id   UUID REFERENCES role_room_funding_snapshots(id) ON DELETE SET NULL,

  amount_applied_for NUMERIC(14,2),
  notes         TEXT,
  created_by_user_id VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_funding_applications_project
  ON role_room_funding_applications (project_id, deadline_at);
-- Åpne søknader med frist — det som skal opp på skjermen.
CREATE INDEX IF NOT EXISTS idx_rr_funding_applications_open
  ON role_room_funding_applications (deadline_at)
  WHERE status IN ('draft','ready');

-- Manuell status per krav. Automatiske krav trenger ingen rad — de regnes ut.
CREATE TABLE IF NOT EXISTS role_room_funding_application_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES role_room_funding_applications(id) ON DELETE CASCADE,
  requirement_key VARCHAR(60) NOT NULL,

  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','ready','not_applicable')),
  -- Hvor dokumentet ligger. Vi lagrer referanse, ikke innhold.
  document_url   TEXT,
  note           TEXT,
  updated_by_user_id VARCHAR(255),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rr_funding_application_item_unique UNIQUE (application_id, requirement_key)
);

COMMENT ON TABLE role_room_funding_applications IS
  'Søknad om tilskudd (Del A punkt 114). Bærer «er den klar?»-vurderingen, ikke bare eksportfilen.';

-- ── Krav for NFI-ordningen ───────────────────────────────────────────────
-- Kildene er NFIs ordningssider for produksjonstilskudd. auto_check peker på
-- sjekker i role-room-funding-application-service.ts.

DO $$
DECLARE
  nfi_id UUID;
BEGIN
  SELECT id INTO nfi_id FROM role_room_funding_schemes WHERE scheme_key = 'nfi';
  IF nfi_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM role_room_funding_requirements WHERE scheme_id = nfi_id) THEN RETURN; END IF;

  INSERT INTO role_room_funding_requirements
    (scheme_id, requirement_key, label, description, auto_check, mandatory, sort_order)
  VALUES
    (nfi_id, 'kalkyle', 'Kalkyle (budsjett)',
     'Budsjett satt opp etter kontoplanen søknaden skal føres mot.',
     'budget_present', TRUE, 100),

    (nfi_id, 'kalkyle_kartlagt', 'Alle budsjettposter kartlagt',
     'Ingen budsjettkategorier uten kobling til ordningens kontoplan — ukartlagte poster kommer ikke med i eksporten.',
     'budget_fully_mapped', TRUE, 110),

    (nfi_id, 'finansieringsplan', 'Finansieringsplan',
     'Skal spesifisere private og offentlige midler, og angi andelen bekreftet og ubekreftet finansiering.',
     'financing_plan_present', TRUE, 200),

    (nfi_id, 'finansiering_80', 'Minimum 80 % bekreftet finansiering',
     'NFI krever at minst 80 prosent av finansieringen er bekreftet.',
     'financing_80_percent', TRUE, 210),

    (nfi_id, 'framdriftsplan', 'Framdriftsplan',
     'Produksjoner uten realistisk framdriftsplan får avslag.',
     'timeline_present', TRUE, 300),

    (nfi_id, 'opptaksplan', 'Opptaksplan',
     'Planlagte opptaksdager med scener fordelt.',
     'shoot_plan_present', TRUE, 310),

    (nfi_id, 'inntektsprognose', 'Inntektsprognose',
     'Lastes opp som vedlegg.',
     NULL, TRUE, 400),

    (nfi_id, 'distributoravtale', 'Forpliktende avtale med kinodistributør',
     'Kreves for spillefilm etter markedsvurdering.',
     NULL, TRUE, 410),

    (nfi_id, 'rettigheter', 'Dokumentasjon av rettigheter',
     'Avtaler med rettighetshavere etter åndsverkloven.',
     NULL, TRUE, 420),

    (nfi_id, 'tidligere_resultater', 'Dokumentasjon av tidligere resultater',
     'For regissør, produsent og selskap.',
     NULL, FALSE, 430);
END $$;
