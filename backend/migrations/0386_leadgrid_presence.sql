-- 0386: «Sist aktiv i Leadgrid» (2026-07-18). Kobler utstyrsregisteret til
-- GPS-en appen alt har: appen kan IKKE lese serienummer (Apple-sperre, kun
-- MDM) — men registeret vet hvem utstyret er utlevert til, og appen vet
-- hvor innehaveren sist var aktiv. serienr → innehaver → siste posisjon.
--
-- Personvern (kontrolltiltak-lite): KUN siste punkt per bruker (ingen
-- historikk her — historikk er Leadgrid Go/kjørebok sitt domene m/ egne
-- rammer), vises kun for ledere på utstyr vedkommende har utlevert.

CREATE TABLE IF NOT EXISTS leadgrid_presence (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION,          -- NULL når posisjonstillatelse mangler
  lng DOUBLE PRECISION,
  device_model TEXT NOT NULL DEFAULT '',   -- «iPhone15,3» — hint, ikke serienr
  app_version TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (organization_id, user_id)
);
