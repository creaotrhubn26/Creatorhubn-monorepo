-- Newsletter-maler for å starte nye utgaver fra en strukturert template.
-- 3 maler pre-fylles for Daniels Norwegian Casting Brief.

CREATE TABLE IF NOT EXISTS role_room_newsletter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  preheader VARCHAR(200),
  body_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_templates_user
  ON role_room_newsletter_templates (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_room_newsletter_templates_slug
  ON role_room_newsletter_templates (COALESCE(user_id::text, 'system'), slug);

-- Pre-fyll 3 default-maler (eier=NULL = system-mal tilgjengelig for alle)
INSERT INTO role_room_newsletter_templates (slug, name, description, preheader, body_blocks, is_default)
VALUES
  (
    'standard-ukesbrev',
    'Standard ukesbrev (6 seksjoner)',
    'Klassisk Norwegian Casting Brief — data, founder POV, behind-the-cast, risk + CTA.',
    'Ukens data, founder POV, behind-the-cast og risk-varsler.',
    '[
      {"id":"b1","type":"header","level":1,"text":"Uke __ — Norwegian Casting Brief"},
      {"id":"b2","type":"text","markdown":"**Skarpt åpningstese — 1-2 setninger som scroll-stopper.**"},
      {"id":"b3","type":"header","level":2,"text":"The data point"},
      {"id":"b4","type":"text","markdown":"Én konkret statistikk fra norsk produksjon denne uken."},
      {"id":"b5","type":"header","level":2,"text":"Founder POV"},
      {"id":"b6","type":"text","markdown":"Skriv kort fra ukens voice memo eller LinkedIn-post."},
      {"id":"b7","type":"header","level":2,"text":"Behind the cast"},
      {"id":"b8","type":"quote","text":"Sitat fra en CD eller produsent denne uken.","attribution":"Anonym CD"},
      {"id":"b9","type":"header","level":2,"text":"The risk"},
      {"id":"b10","type":"text","markdown":"Hva endrer seg juridisk i bransjen som folk ikke har fanget opp."},
      {"id":"b11","type":"divider"},
      {"id":"b12","type":"cta","label":"Les mer på theroleroom.com","url":"https://theroleroom.com","align":"center"}
    ]'::jsonb,
    TRUE
  ),
  (
    'data-drop',
    'Data drop',
    'Datadrevet utgave med 3-5 statistikker og kort tolkning.',
    'Ny norsk casting-data — 3 funn å vite.',
    '[
      {"id":"b1","type":"header","level":1,"text":"Norsk casting i tall — __"},
      {"id":"b2","type":"text","markdown":"Vi har samlet inn data fra __ casting calls de siste __ dagene. Tre overraskende funn:"},
      {"id":"b3","type":"text","markdown":"**1.** Funn nummer én — én linje med tolkning under."},
      {"id":"b4","type":"text","markdown":"**2.** Funn nummer to."},
      {"id":"b5","type":"text","markdown":"**3.** Funn nummer tre."},
      {"id":"b6","type":"header","level":2,"text":"Hva det betyr"},
      {"id":"b7","type":"text","markdown":"Tre setninger — hva dette gjør med bransje-praksis i de neste 6 månedene."},
      {"id":"b8","type":"divider"},
      {"id":"b9","type":"cta","label":"Full rapport","url":"https://theroleroom.com/casting-rapport-2026","align":"center"}
    ]'::jsonb,
    TRUE
  ),
  (
    'founder-pov',
    'Founder POV essay',
    'Lengre essay-format — én sterk tese, tre eksempler, tydelig posisjon.',
    'En upopulær mening om norsk casting.',
    '[
      {"id":"b1","type":"header","level":1,"text":"En upopulær mening om __"},
      {"id":"b2","type":"text","markdown":"Tese i 1 setning — skarpest mulig."},
      {"id":"b3","type":"header","level":2,"text":"Hvorfor jeg mener dette"},
      {"id":"b4","type":"text","markdown":"100-150 ord med begrunnelse. Konkret. Ingen hedging."},
      {"id":"b5","type":"header","level":2,"text":"Tre eksempler"},
      {"id":"b6","type":"text","markdown":"**Eksempel 1:** beskriv kort.\n\n**Eksempel 2:** beskriv kort.\n\n**Eksempel 3:** beskriv kort."},
      {"id":"b7","type":"header","level":2,"text":"Hva jeg kan ta feil om"},
      {"id":"b8","type":"text","markdown":"Steelman: hva ville en intelligent motstander si? 50-80 ord."},
      {"id":"b9","type":"divider"},
      {"id":"b10","type":"cta","label":"Svar i en mail","url":"mailto:daniel@creatorhubn.com","align":"center"}
    ]'::jsonb,
    TRUE
  )
ON CONFLICT (COALESCE(user_id::text, 'system'), slug) DO NOTHING;
