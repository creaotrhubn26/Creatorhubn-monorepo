-- =====================================================================
-- 294_pitch_deck_permissions.sql
--
-- 3 nye permissions for Pitch Deck Studio. Plugges inn i samme RBAC-
-- katalog (permissions + role_permissions) som 286_lead_map_permissions
-- bygde. Sjekkes av lead-map-routes via resolveEffectivePermissions().
--
-- Hvorfor 3 separate nøkler (og ikke f.eks. én "pitch_deck"-nøkkel):
--   - access: kan åpne studio + bruke presentasjon ute. Bred — vi vil
--     at promotører-i-felt kan presentere, ikke bare salgssjefen.
--   - edit:   kan endre slides + regenerere med Claude. Smalere — vi
--     vil at organisasjonen kontrollerer pitchens innhold sentralt,
--     ikke at en promotør på event kan rote bort en slide.
--   - export: kan eksportere til PDF + dele view-lenke utenfor org.
--     Smaleste — PDF'en kan lekke til konkurrenter, vil typisk være
--     forbeholdt salgssjef.
--
-- Default-rolletildeling:
--   admin       — alle 3 (sikkerhets-floor, hardkodet i resolver)
--   salgssjef   — alle 3 (kan administrere pitchen for sitt team)
--   teamleder   — access + edit (kan jobbe på teamets pitch, men ikke
--                 dele PDF eksternt uten salgssjefens godkjenning)
--   selger      — access (kan kun presentere; alt innhold er sentralt)
--   promotor    — access (samme som selger; brukes ute på events)
--   admin_member — ingen (admins-på-org-nivå håndteres av admin-floor)
--
-- Organisasjonens admins kan overstyre individuelt via
-- user_permission_overrides (eksisterende mekanisme).
-- =====================================================================

BEGIN;

INSERT INTO permissions (key, category, description) VALUES
  ('pitch_deck.access', 'Pitch Deck',
   'Åpne Pitch Deck Studio og presentere for kunder'),
  ('pitch_deck.edit',   'Pitch Deck',
   'Endre slides og regenerere med Claude'),
  ('pitch_deck.export', 'Pitch Deck',
   'Eksportere pitch som PDF og dele view-lenke')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- ─── Default rolle-tildeling ───────────────────────────────────
-- salgssjef: alle 3 (kan administrere pitchen + dele PDF)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('salgssjef', 'pitch_deck.access'),
  ('salgssjef', 'pitch_deck.edit'),
  ('salgssjef', 'pitch_deck.export')
ON CONFLICT (role, permission_key) DO NOTHING;

-- teamleder: access + edit (kan jobbe i studio, men ikke eksportere)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('teamleder', 'pitch_deck.access'),
  ('teamleder', 'pitch_deck.edit')
ON CONFLICT (role, permission_key) DO NOTHING;

-- selger + promotor: kun access (kan presentere, ikke endre/eksportere)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('selger',   'pitch_deck.access'),
  ('promotor', 'pitch_deck.access')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
