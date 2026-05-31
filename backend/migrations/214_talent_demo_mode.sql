-- Talent Demo Mode — isolert demo-data for mockup-replikering.
--
-- Phase 2: Daniels mockup #11 viser en bruker med 18 active partners, 5
-- spesifikke partnere i tabellen, fylt matrix, fylt feed. En ny talent har
-- ingenting — derfor seeder vi en isolert demo-tilstand som kan vises via
-- ?demo=1 query-param.
--
-- Demo-data er FULLSTENDIG ISOLERT fra produksjons-data:
--   - is_demo BOOLEAN på alle 5 tabeller (default FALSE)
--   - Demo-rader filtreres VEKK fra alle normale spørringer
--   - ?demo=1-endepunktene returnerer KUN is_demo=true-rader
--   - Demo-talent har owner_user_id = NULL — kan ikke "tas over"
--   - Demo-skriving avvises (read-only modus i frontend)
--
-- Seedet inneholder:
--   - 1 demo-talent: Ingrid Nilsen
--   - 5 demo-agency_orgs: Northern Lights, Stella, Nordic Skuespillersenter,
--     Bergen Film Academy, Dramatikkens Hus
--   - Consents som gir den 5×4 matrix-mønsteret fra mockupen
--   - Audit-rader for "Last Activity"-kolonnen
--   - 1 pending invite for "Pending Requests = 3" (vi seeder bare 1 for kontroll;
--     stat-tallet aggregerer)

-- ── 1. Legg til is_demo på alle 5 tabeller ───────────────────────────
ALTER TABLE talents ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE agency_orgs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE talent_consent_registry ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE talent_access_audit ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE talent_partner_invites ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS talents_is_demo_idx ON talents (is_demo) WHERE is_demo = TRUE;
CREATE INDEX IF NOT EXISTS agency_orgs_is_demo_idx ON agency_orgs (is_demo) WHERE is_demo = TRUE;
CREATE INDEX IF NOT EXISTS talent_consent_is_demo_idx ON talent_consent_registry (is_demo) WHERE is_demo = TRUE;

-- ── 2. Seed demo-talent (fast UUID for idempotens) ──────────────────
-- UUID 11111111-1111-1111-1111-111111111111 er reservert til demo-talenten
INSERT INTO talents (
  id, owner_user_id, display_name, email, city, country, bio,
  represented, agency_name, profile_status, is_demo, created_at, updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  NULL,
  'Ingrid Nilsen',
  'demo-talent@theroleroom.com',
  'Oslo',
  'NO',
  'Demo-profil for The Role Room Talents — vises kun i ?demo=1-modus.',
  TRUE,
  'Stella Casting',
  'active',
  TRUE,
  now() - interval '90 days',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  is_demo = TRUE,
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- ── 3. Seed 5 demo-agency_orgs ──────────────────────────────────────
-- Faste UUIDs for idempotens (matrix + sidebar ankrer mot disse)
INSERT INTO agency_orgs (id, type, name, slug, contact_email, website_url, about, verified, status, is_demo, created_at, updated_at)
VALUES
  ('a1111111-1111-1111-1111-1111111111a1', 'caster_individual', 'Northern Lights Casting', 'demo-northern-lights-casting',
   'contact@northernlights.no', 'https://northernlights.no',
   'Casting for film and television in Northern Europe.', TRUE, 'active', TRUE,
   now() - interval '120 days', now()),
  ('a2222222-2222-2222-2222-2222222222a2', 'stella_casting', 'Stella Casting', 'demo-stella-casting',
   'info@stellacasting.dk', 'https://stellacasting.dk',
   'Scandinavias leading talent agency.', TRUE, 'active', TRUE,
   now() - interval '100 days', now()),
  ('a3333333-3333-3333-3333-3333333333a3', 'skuespillersenter', 'Nordic Skuespillersenter', 'demo-nordic-skuespillersenter',
   'post@skuespillersenter.no', 'https://skuespillersenter.no',
   'Etterutdanning og castingdatabase for nordiske skuespillere.', TRUE, 'active', TRUE,
   now() - interval '85 days', now()),
  ('a4444444-4444-4444-4444-4444444444a4', 'workshop_provider', 'Bergen Film Academy', 'demo-bergen-film-academy',
   'hello@bergenfilmacademy.no', 'https://bergenfilmacademy.no',
   'Workshops for skuespillere på vestlandet.', TRUE, 'active', TRUE,
   now() - interval '70 days', now()),
  ('a5555555-5555-5555-5555-5555555555a5', 'production_company', 'Dramatikkens Hus', 'demo-dramatikkens-hus',
   'post@dramatikkenshus.no', 'https://dramatikkenshus.no',
   'Norges hus for ny dramatikk.', TRUE, 'active', TRUE,
   now() - interval '60 days', now())
ON CONFLICT (id) DO UPDATE SET
  is_demo = TRUE,
  updated_at = now();

-- ── 4. Seed consents — gir matrix-mønsteret fra mockupen ────────────
-- Matrix: NL=✓✓✓✓, SC=✓✓—✓, NS=✓✓——, BF=✓—✓—, DR=✓———
-- Kolonner: profiles, selftapes, workshops, auditions
-- Backend mapper: profiles=media_portfolio, selftapes=self_tape_review,
-- workshops=workshop_access, auditions=audition_invitations.
-- Alle har basic_profile som baseline.
DO $$
DECLARE
  partner_data jsonb := '[
    {"id":"a1111111-1111-1111-1111-1111111111a1","type":"caster_individual","scopes":["basic_profile","media_portfolio","self_tape_review","workshop_access","audition_invitations","full_profile"]},
    {"id":"a2222222-2222-2222-2222-2222222222a2","type":"stella_casting","scopes":["basic_profile","media_portfolio","self_tape_review","audition_invitations"]},
    {"id":"a3333333-3333-3333-3333-3333333333a3","type":"skuespillersenter","scopes":["basic_profile","media_portfolio","self_tape_review"]},
    {"id":"a4444444-4444-4444-4444-4444444444a4","type":"workshop_provider","scopes":["basic_profile","media_portfolio","workshop_access"]},
    {"id":"a5555555-5555-5555-5555-5555555555a5","type":"production_company","scopes":["basic_profile","media_portfolio"]}
  ]'::jsonb;
  partner jsonb;
  scope_text text;
BEGIN
  FOR partner IN SELECT jsonb_array_elements(partner_data) LOOP
    FOR scope_text IN SELECT jsonb_array_elements_text(partner->'scopes') LOOP
      INSERT INTO talent_consent_registry
        (talent_id, partner_type, partner_ref, partner_display_name, scope,
         status, granted_at, is_demo)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        partner->>'type',
        partner->>'id',
        NULL,
        scope_text,
        'granted',
        now() - (random() * interval '60 days'),
        TRUE
      )
      ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
        status = 'granted',
        is_demo = TRUE,
        updated_at = now();
    END LOOP;
  END LOOP;
END $$;

-- ── 5. Seed audit-rader — gir "Last Activity"-kolonnen ──────────────
-- Slett eksisterende demo-audit-rader først for idempotens (audit har ingen unik constraint)
DELETE FROM talent_access_audit
 WHERE talent_id = '11111111-1111-1111-1111-111111111111' AND is_demo = TRUE;

INSERT INTO talent_access_audit (talent_id, partner_type, partner_ref, scope, accessed_at, is_demo)
VALUES
  -- Today, 10:24 — Northern Lights
  ('11111111-1111-1111-1111-111111111111', 'caster_individual', 'a1111111-1111-1111-1111-1111111111a1',
   'full_profile', date_trunc('day', now()) + interval '10 hours 24 minutes', TRUE),
  -- Yesterday, 16:45 — Stella
  ('11111111-1111-1111-1111-111111111111', 'stella_casting', 'a2222222-2222-2222-2222-2222222222a2',
   'media_portfolio', date_trunc('day', now() - interval '1 day') + interval '16 hours 45 minutes', TRUE),
  -- May 18, 2024 — Nordic (relativt: 13 dager siden)
  ('11111111-1111-1111-1111-111111111111', 'skuespillersenter', 'a3333333-3333-3333-3333-3333333333a3',
   'media_portfolio', now() - interval '13 days', TRUE),
  -- May 17 — Bergen Film
  ('11111111-1111-1111-1111-111111111111', 'workshop_provider', 'a4444444-4444-4444-4444-4444444444a4',
   'workshop_access', now() - interval '14 days', TRUE),
  -- May 15 — Dramatikkens
  ('11111111-1111-1111-1111-111111111111', 'production_company', 'a5555555-5555-5555-5555-5555555555a5',
   'basic_profile', now() - interval '16 days', TRUE);

-- ── 6. Feed-events: 5 rader for Collaboration Feed ──────────────────
-- Bruker audit-tabellen + en pending invite for varieet.
INSERT INTO talent_access_audit (talent_id, partner_type, partner_ref, scope, accessed_at, access_context, is_demo)
VALUES
  -- "viewed 12 new profiles from the Oslo Pool" — 10 minutes ago
  ('11111111-1111-1111-1111-111111111111', 'caster_individual', 'a1111111-1111-1111-1111-1111111111a1',
   'full_profile', now() - interval '10 minutes',
   '{"endpoint":"/agency/talents","profiles_viewed":12,"pool":"Oslo"}'::jsonb, TRUE),
  -- "shared Workshop: Scene Study Masterclass" — Yesterday
  ('11111111-1111-1111-1111-111111111111', 'skuespillersenter', 'a3333333-3333-3333-3333-3333333333a3',
   'workshop_access', date_trunc('day', now() - interval '1 day') + interval '11 hours 32 minutes',
   '{"endpoint":"/workshops/share","workshop":"Scene Study Masterclass"}'::jsonb, TRUE),
  -- "downloaded 5 self-tapes" — May 19, 14:08
  ('11111111-1111-1111-1111-111111111111', 'workshop_provider', 'a4444444-4444-4444-4444-4444444444a4',
   'self_tape_review', now() - interval '12 days' + interval '14 hours 8 minutes',
   '{"endpoint":"/selftapes/download","count":5}'::jsonb, TRUE);

-- ── 7. En pending invite — "Pending Requests"-stat + Pending-badge i feed
INSERT INTO talent_partner_invites
  (talent_id, partner_type, partner_email, partner_display_name, scopes,
   token, status, message, created_at, expires_at, is_demo)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'stella_casting',
  'invite-demo@stellacasting.dk',
  'Stella Casting',
  '["basic_profile","self_tape_review"]'::jsonb,
  'demo-pending-stella-' || substr(md5(random()::text), 1, 16),
  'pending',
  'Demo: requested access to Self-Tapes library.',
  now() - interval '2 hours',
  now() + interval '28 days',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM talent_partner_invites
   WHERE talent_id = '11111111-1111-1111-1111-111111111111'
     AND partner_email = 'invite-demo@stellacasting.dk'
     AND is_demo = TRUE
);

-- For "Pending Requests = 3" — vi har 1 ekte pending invite; stat-tallet
-- viser den ekte count. Hvis Daniel vil eksakt mockup-tall (3), kan vi
-- legge til 2 til invites her senere.
