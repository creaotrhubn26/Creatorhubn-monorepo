-- Migration 139: role_nav_config
--
-- Konfigurerbar tab-rekkefølge og synlighet per brukerrolle på tvers av
-- alle viewports i Role Room (telefon, iPad portrait, iPad landscape,
-- desktop). Admin (produkteier) overstyrer defaults via Admin Room-UI.
--
-- Modell:
--   tab_values = ordnet liste av subTab-verdier som rolen skal se.
--   Faner som mangler i lista vises ikke for den rolen.
--   Telefon viser første 4 i bottom-nav + resten i "Mer…"-ark.
--   iPad portrait/landscape og desktop viser alle i denne rekkefølgen.
--
-- Når raden mangler, faller frontend tilbake til hardcoded defaults i
-- bottomNavConfigForRole / DEFAULT_VISIBLE_TABS_BY_ROLE.

CREATE TABLE IF NOT EXISTS role_nav_config (
  role varchar PRIMARY KEY,           -- UserRoleType (director, producer, etc.)
  tab_values text[] NOT NULL,         -- ordnet liste av subTab-verdier
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar                  -- email på admin som sist endret
);

-- Indeks ikke nødvendig: PRIMARY KEY på role gir nok lookup-fart.
