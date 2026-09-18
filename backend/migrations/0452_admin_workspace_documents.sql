-- 0452_admin_workspace_documents.sql
--
-- Operativt dokumentsystem for Admin Workspace. Dokumentene tilhører admin-
-- brukeren og er interne arbeidsdokumenter, ikke castingproduksjoner eller
-- kundegallerier. Historikk, vedlegg og polymorfe koblinger er eksplisitte.

CREATE TABLE IF NOT EXISTS admin_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  product_key VARCHAR(20),
  title VARCHAR(240) NOT NULL,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  document_type VARCHAR(40) NOT NULL DEFAULT 'other',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  due_date DATE,
  next_action TEXT,
  version_no INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_kind VARCHAR(20) NOT NULL DEFAULT 'workspace',
  external_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT admin_documents_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_documents_product_key_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid')),
  CONSTRAINT admin_documents_type_check
    CHECK (document_type IN (
      'funding_application',
      'strategy_memo',
      'decision_note',
      'meeting_note',
      'market_analysis',
      'sales_proposal',
      'partnership_proposal',
      'agreement',
      'report',
      'playbook',
      'other'
    )),
  CONSTRAINT admin_documents_status_check
    CHECK (status IN ('draft', 'in_review', 'approved', 'sent', 'signed', 'archived')),
  CONSTRAINT admin_documents_version_check CHECK (version_no >= 1),
  CONSTRAINT admin_documents_source_check
    CHECK (source_kind IN ('workspace', 'google_drive', 'external')),
  CONSTRAINT admin_documents_external_url_check
    CHECK (
      (source_kind = 'workspace' AND external_url IS NULL)
      OR (source_kind IN ('google_drive', 'external') AND external_url IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_documents_user_active
  ON admin_documents (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_documents_user_product_status
  ON admin_documents (user_id, product_key, status, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_documents_user_trash
  ON admin_documents (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  version_number INTEGER NOT NULL,
  title VARCHAR(240) NOT NULL,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  document_type VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  product_key VARCHAR(20),
  due_date DATE,
  next_action TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_kind VARCHAR(20) NOT NULL,
  external_url TEXT,
  change_note VARCHAR(500),
  created_by VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_versions_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_versions_unique UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_admin_document_versions_document
  ON admin_document_versions (document_id, version_number DESC);

CREATE TABLE IF NOT EXISTS admin_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_links_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_links_entity_type_check
    CHECK (entity_type IN (
      'workspace_project',
      'workspace_case',
      'funding_app',
      'industry_target',
      'leadgrid_lead',
      'investor',
      'partner'
    )),
  CONSTRAINT admin_document_links_unique
    UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_document_links_document
  ON admin_document_links (document_id, created_at);

CREATE INDEX IF NOT EXISTS idx_admin_document_links_entity
  ON admin_document_links (user_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS admin_document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(160),
  file_size BIGINT,
  file_data BYTEA,
  source_kind VARCHAR(20) NOT NULL DEFAULT 'upload',
  external_url TEXT,
  sha256 VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_files_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_files_source_check
    CHECK (source_kind IN ('upload', 'google_drive', 'external')),
  CONSTRAINT admin_document_files_payload_check
    CHECK (
      (source_kind = 'upload' AND file_data IS NOT NULL AND external_url IS NULL)
      OR (source_kind IN ('google_drive', 'external') AND file_data IS NULL AND external_url IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_document_files_document
  ON admin_document_files (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_document_templates (
  id VARCHAR(80) PRIMARY KEY,
  product_key VARCHAR(20),
  document_type VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  title_template VARCHAR(240) NOT NULL,
  content_template TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_templates_product_key_check
    CHECK (product_key IS NULL OR product_key IN ('role_room', 'leadgrid'))
);

INSERT INTO admin_document_templates
  (id, product_key, document_type, name, description, title_template, content_template, tags, sort_order)
VALUES
  (
    'innovation_norway_application',
    NULL,
    'funding_application',
    'Innovasjon Norge-søknad',
    'Arbeidsmal for prosjektbeskrivelse, marked, effekt, gjennomføring og budsjett.',
    'Innovasjon Norge — [prosjektnavn]',
    E'# Kort sammendrag\n\n[Hva skal gjennomføres, hvorfor nå, og hvilken effekt skal prosjektet gi?]\n\n# Problemet og behovet\n\n[Beskriv det dokumenterte markedsbehovet.]\n\n# Løsningen\n\n[Beskriv produktet, innovasjonshøyden og hva som skiller det fra alternativer.]\n\n# Marked og kunder\n\n[Målgruppe, betalingsvilje, konkurrenter og go-to-market.]\n\n# Gjennomføringsplan\n\n[Milepæler, ansvar, tidslinje og risiko.]\n\n# Budsjett og finansiering\n\n[Kostnader, egeninnsats, annen finansiering og søknadsbeløp.]\n\n# Forventet effekt\n\n[Verdiskaping, arbeidsplasser, eksport, bærekraft eller produktivitetsgevinst.]\n\n# Vedlegg og dokumentasjon\n\n[Liste over relevante vedlegg.]',
    ARRAY['støtte', 'innovasjon-norge'],
    10
  ),
  (
    'decision_note',
    NULL,
    'decision_note',
    'Beslutningsnotat',
    'Kort og etterprøvbart grunnlag for en adminbeslutning.',
    'Beslutningsnotat — [tema]',
    E'# Beslutning\n\n[Hva skal besluttes?]\n\n# Anbefaling\n\n[Anbefalt alternativ og hvorfor.]\n\n# Bakgrunn\n\n[Relevant kontekst og premisser.]\n\n# Alternativer\n\n1. [Alternativ A]\n2. [Alternativ B]\n\n# Konsekvenser og risiko\n\n[Økonomi, kapasitet, marked, sikkerhet og avhengigheter.]\n\n# Neste handling\n\n[Ansvarlig, frist og første steg.]',
    ARRAY['beslutning'],
    20
  ),
  (
    'meeting_note',
    NULL,
    'meeting_note',
    'Møtenotat med oppfølging',
    'Agenda, innsikt, beslutninger og avtalte handlinger i ett dokument.',
    'Møtenotat — [virksomhet/person] — [dato]',
    E'# Deltakere\n\n- [Navn og rolle]\n\n# Mål for møtet\n\n[Hva skulle møtet oppnå?]\n\n# Viktigste innsikt\n\n- [Innsikt]\n\n# Beslutninger\n\n- [Beslutning]\n\n# Avtalte handlinger\n\n- [ ] [Handling] — ansvarlig: [navn] — frist: [dato]\n\n# Neste kontakt\n\n[Dato, kanal og ønsket utfall.]',
    ARRAY['møte', 'oppfølging'],
    30
  ),
  (
    'strategy_memo',
    NULL,
    'strategy_memo',
    'Strateginotat',
    'Arbeidsmal for mål, valg, initiativer, måltall og risiko.',
    'Strategi — [område] — [periode]',
    E'# Ambisjon\n\n[Ønsket posisjon og effekt.]\n\n# Situasjon nå\n\n[Fakta, flaskehalser og muligheter.]\n\n# Strategiske valg\n\n- Dette skal vi gjøre: [...]\n- Dette skal vi ikke gjøre: [...]\n\n# Prioriterte initiativer\n\n1. [Initiativ]\n\n# Måltall\n\n- [KPI, startpunkt, mål og dato]\n\n# Risiko og mottiltak\n\n- [Risiko] — [mottiltak]\n\n# Neste 30 dager\n\n- [ ] [Handling]',
    ARRAY['strategi'],
    40
  ),
  (
    'leadgrid_pilot_proposal',
    'leadgrid',
    'sales_proposal',
    'Leadgrid pilotforslag',
    'Konkret forslag til pilotkunde med problem, leveranse, suksessmål og kommersielle vilkår.',
    'Leadgrid pilot — [kunde]',
    E'# Kundens situasjon\n\n[Hvordan arbeider kunden med leads og oppfølging i dag?]\n\n# Hypotese\n\n[Hvilken målbar forbedring skal Leadgrid gi?]\n\n# Pilotens omfang\n\n- Varighet: [antall uker]\n- Brukere/team: [...]\n- Datakilder: [...]\n- Arbeidsflyter: [...]\n\n# Leveranser\n\n1. [Leveranse]\n\n# Suksesskriterier\n\n- [KPI, startpunkt og mål]\n\n# Pris og betingelser\n\n[Pris, fakturering, binding og behandling av data.]\n\n# Neste steg\n\n[Beslutning, ansvarlig og dato.]',
    ARRAY['leadgrid', 'pilot', 'salg'],
    50
  ),
  (
    'leadgrid_partner_brief',
    'leadgrid',
    'partnership_proposal',
    'Leadgrid partnerbrief',
    'Grunnlag for byrå-, integrasjons- eller distribusjonspartner.',
    'Leadgrid partnerskap — [partner]',
    E'# Felles mulighet\n\n[Hvorfor er partnerskapet relevant nå?]\n\n# Partene bidrar med\n\n## Leadgrid\n- [...]\n\n## Partner\n- [...]\n\n# Målgruppe og tilbud\n\n[Segment, verdi og pakketering.]\n\n# Kommersiell modell\n\n[Pris, provisjon, eierskap til kunde og fornyelse.]\n\n# Pilot og måltall\n\n[Omfang, tidslinje og suksesskriterier.]\n\n# Åpne spørsmål\n\n- [...]\n\n# Neste steg\n\n- [ ] [Handling]',
    ARRAY['leadgrid', 'partner'],
    60
  ),
  (
    'role_room_casting_agency_meeting',
    'role_room',
    'meeting_note',
    'Castingbyrå — møtekort',
    'Forberedelse og oppfølging når The Role Room møter castingmarkedet.',
    'Castingbyrå — [byrå] — [dato]',
    E'# Om byrået\n\n[Marked, produksjonstyper, kunder og relevante personer.]\n\n# Relasjonen så langt\n\n[Tidligere kontakt, signaler og åpne dører.]\n\n# Mål for møtet\n\n1. [...]\n\n# Spørsmål vi må få svar på\n\n- Hvordan finner og vurderer dere talenter i dag?\n- Hvor oppstår mest friksjon i castingprosessen?\n- Hvilke krav må en ny løsning møte?\n\n# The Role Room-hypotese\n\n[Relevante verdiforslag for akkurat dette byrået.]\n\n# Innsikt fra møtet\n\n- [...]\n\n# Neste handling\n\n[Ansvarlig, frist og ønsket utfall.]',
    ARRAY['role-room', 'castingbyrå', 'marked'],
    70
  ),
  (
    'role_room_partnership_proposal',
    'role_room',
    'partnership_proposal',
    'The Role Room partnerforslag',
    'Arbeidsmal for markeds-, bransje- eller teknologipartnerskap.',
    'The Role Room partnerskap — [partner]',
    E'# Bakgrunn og felles mål\n\n[Hvorfor bør partene samarbeide?]\n\n# Markedsbehov\n\n[Dokumentert behov hos castingbyrå, produksjon eller talent.]\n\n# Forslag til samarbeid\n\n[Roller, leveranser og kundereise.]\n\n# Verdi for partneren\n\n[Inntekt, effektivitet, kvalitet, nettverk eller innsikt.]\n\n# Pilot\n\n[Omfang, deltakere, tid og suksesskriterier.]\n\n# Kommersiell og juridisk ramme\n\n[Modell, data, rettigheter og ansvar.]\n\n# Neste steg\n\n- [ ] [Handling]',
    ARRAY['role-room', 'partner'],
    80
  ),
  (
    'monthly_operating_report',
    NULL,
    'report',
    'Månedlig driftsrapport',
    'Kort status for fremdrift, marked, økonomi, risiko og prioriteringer.',
    'Driftsrapport — [måned år]',
    E'# Sammendrag\n\n[Hva er den viktigste utviklingen denne måneden?]\n\n# Fremdrift mot mål\n\n- [Mål] — [status og avvik]\n\n# Marked og pipeline\n\n[Kontakter, møter, tilbud, salg og læring.]\n\n# Produkt og leveranse\n\n[Levert, pågående, blokkert.]\n\n# Økonomi og finansiering\n\n[Likviditet, kostnader, inntekter og støttearbeid.]\n\n# Risiko og beslutninger\n\n- [Risiko/beslutning]\n\n# Prioriteringer neste måned\n\n1. [...]',
    ARRAY['rapport', 'drift'],
    90
  )
ON CONFLICT (id) DO UPDATE SET
  product_key = EXCLUDED.product_key,
  document_type = EXCLUDED.document_type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  title_template = EXCLUDED.title_template,
  content_template = EXCLUDED.content_template,
  tags = EXCLUDED.tags,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

COMMENT ON TABLE admin_documents IS
  'Tenant-eide interne arbeidsdokumenter for Admin Workspace, på tvers av Creatorhub, The Role Room og Leadgrid.';

COMMENT ON TABLE admin_document_versions IS
  'Immutable eksplisitte snapshots av admin-dokumenter; gjenoppretting lager alltid en ny versjon.';

COMMENT ON TABLE admin_document_files IS
  'Tenant-eide opplastede vedlegg eller validerte eksterne dokumentlenker.';
