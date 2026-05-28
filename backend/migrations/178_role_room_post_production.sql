-- Etterproduksjon-utvidelse for The Role Room.
--
-- Klippere + colorister + lyd-folk + VFX-artister er bredeste crew-kategori
-- i Norge (~200-250 aktive klippere alene). Manglet null dekning i Tier-1
-- CRM. Dette legger til 8 nye post-prod-roller + tools-tracking + 2 nye
-- outreach-templates.

ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS post_software JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN role_room_industry_targets.post_software IS
  'Post-prod-software: ["davinci_resolve","adobe_premiere","avid_media_composer","baselight","scratch","frame_io","pro_tools","logic_pro"]';

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_post_software
  ON role_room_industry_targets USING GIN (post_software)
  WHERE post_software IS NOT NULL AND post_software != '[]'::jsonb;

-- Pre-seede 2 nye outreach-templates for post-prod-roller

INSERT INTO role_room_outreach_templates (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'colorist-grading-pitch',
    'Colorist — first DM med grading-referanse',
    'other',
    'dm',
    'no',
    'Colorister vurderes på look + technical mastery. Pitchen må vise at avsender forstår forskjell mellom grade-pass og color-correction, og at de har sett konkret arbeid.',
    'Hei {{first_name}},

Så grade-en din på {{recent_production}}. {{specific_look_observation}} — det er en presis vurdering, ikke bare en "stil".

Vi bygger The Role Room — koordineringslag for norsk produksjon som starter på casting og utvider til post-produksjon. Hypotesen er at colorister i Norge bookes alt for sent (etter offline-klipp er ferdig) — som gir 0 input på color-science før det er for sent å justere look uten å re-shoote.

Spørsmål: hvor mange ganger har du måttet redde et look som DP-en ikke hadde gitt deg LUT-er til? Vil gjerne høre fra én med faktisk erfaring.

Kaffe på Vulkan eller via Zoom, 20 minutter, du velger. Jeg lytter.

Daniel | The Role Room',
    '["first_name","recent_production","specific_look_observation"]'::jsonb,
    TRUE
  ),
  (
    'post-supervisor-collab',
    'Post supervisor — koordinerings-pitch',
    'other',
    'email',
    'no',
    'Post supervisors er den orkestrerende rollen i etterproduksjon. De vurderes på om de kan holde tidsplan + budsjett + leveranse-spec gjennom et komplekst workflow. Pitchen leder med smerten de faktisk eier.',
    'Hei {{first_name}},

{{recent_production}} hadde {{specific_workflow_observation}}. Det er den typen kompleksitet post-supervisors ofte må håndtere uten et koordineringsverktøy bygget for jobben.

Vi bygger The Role Room — produksjonsplattform som starter på casting og utvider til post-supervision og leveranse-koordinering. Hypotesen er at post-prod-koordinering i Norge i 2026 ofte gjøres via Google Sheets + Slack — som funker i 2-personers team, men kollapser når du har 3 klippere + 2 colorister + lyd-mixer + VFX-team samtidig.

Konkret hva vi vil løse:
- Master-versjons-tracking (offline → online → graded → final)
- Frame.io-integrasjon for cross-team review
- Leveranse-spec-håndhevelse (DCP, ProRes, MXF, HDR) før wrap
- Crew-payment-state synlig for produsent

Vil du ha 30 minutter for å fortelle meg hva som faktisk irriterer deg mest? Jeg lytter, du snakker. Betaler kaffen.

Daniel | The Role Room',
    '["first_name","recent_production","specific_workflow_observation"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
