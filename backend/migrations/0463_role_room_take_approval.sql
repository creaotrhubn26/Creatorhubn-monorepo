-- 0463_role_room_take_approval.sql
--
-- Godkjenningsflyt på take: Review → Approve / Needs Work / Reject → Lock.
--
-- **Dette er en tredje akse, ikke en utvidelse av de to som finnes.** Å slå
-- dem sammen ville vært den nærliggende feilen, så det er verdt å si hvorfor:
--
--   1. `casting_takes.processing_status` (migrering 152) er mediepipeline:
--      pending → queued → processing → analyzed. Sier noe om filen, ikke om
--      innholdet.
--   2. `role_room_take_log.status` (migrering 0463-serien, live-set) er
--      merkingen på settet: circle/print er DP-ens og regissørens markering i
--      øyeblikket, mens kameraet fortsatt står der.
--   3. Godkjenning er redigerings- og produksjonsleddets vurdering i etterkant.
--
-- En sirklet take kan bli underkjent i review, og en usirklet take kan bli
-- godkjent. Hadde de delt kolonne, ville den ene overskrevet den andre — og
-- det som forsvinner er hva som ble bestemt PÅ settet, som er nettopp det
-- script supervisor skal kunne dokumentere i ettertid.

-- ── Godkjenningstilstand ─────────────────────────────────────────────────
-- Egen tabell framfor kolonner på take-loggen, av to grunner: takes finnes i
-- to tabeller (loggført på settet og opplastet materiale), og beslutningen
-- har sin egen historikk som skal overleve at en take-rad endres.

CREATE TABLE IF NOT EXISTS role_room_take_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Hvilken take. `take_source` skiller de to opphavene fra hverandre, slik
  -- at id-ene ikke kan kollidere på tvers.
  take_source  VARCHAR(20) NOT NULL,
  take_ref     VARCHAR(255) NOT NULL,
  scene_id     VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE SET NULL,

  status       VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Låsing fryser beslutningen. Skilt fra status fordi en låst take fortsatt
  -- har en status — den er «godkjent og låst», ikke «låst» i stedet for.
  locked_at    TIMESTAMPTZ,
  locked_by    VARCHAR(255),

  decided_by   VARCHAR(255),
  decided_at   TIMESTAMPTZ,
  -- Påkrevd i tjenestelaget ved needs_work og rejected: en underkjennelse
  -- uten begrunnelse er en beskjed om å gjette.
  note         TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rr_take_approval_source_vocab
    CHECK (take_source IN ('take_log', 'media')),
  CONSTRAINT rr_take_approval_status_vocab
    CHECK (status IN ('pending', 'approved', 'needs_work', 'rejected')),
  -- Låst betyr låst av noen, på et tidspunkt. Halve opplysninger her ville
  -- gjort revisjonssporet ubrukelig.
  CONSTRAINT rr_take_approval_lock_complete
    CHECK ((locked_at IS NULL) = (locked_by IS NULL)),

  CONSTRAINT rr_take_approval_unique UNIQUE (take_source, take_ref)
);

CREATE INDEX IF NOT EXISTS idx_rr_take_approvals_project
  ON role_room_take_approvals (project_id, status);
CREATE INDEX IF NOT EXISTS idx_rr_take_approvals_scene
  ON role_room_take_approvals (scene_id, status);
-- «Hva venter på meg» — køen review-leddet jobber gjennom.
CREATE INDEX IF NOT EXISTS idx_rr_take_approvals_pending
  ON role_room_take_approvals (project_id, updated_at DESC)
  WHERE status = 'pending';

COMMENT ON TABLE role_room_take_approvals IS
  'Godkjenning av take i etterkant. Egen akse fra settets circle/print og fra mediepipelinens processing_status.';
COMMENT ON COLUMN role_room_take_approvals.take_source IS
  'take_log = loggført på settet, media = opplastet materiale. Skiller id-rom.';

-- ── Historikk ────────────────────────────────────────────────────────────
-- Hvem bestemte hva, når. Ikke avledbart av nåtilstanden, og det er nettopp
-- dette leddet som blir spurt om når noe har gått galt i klippen.

CREATE TABLE IF NOT EXISTS role_room_take_approval_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id  UUID NOT NULL REFERENCES role_room_take_approvals(id) ON DELETE CASCADE,

  from_status  VARCHAR(20),
  to_status    VARCHAR(20) NOT NULL,
  action       VARCHAR(20) NOT NULL,
  note         TEXT,
  actor_id     VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rr_take_approval_event_action_vocab
    CHECK (action IN ('approve', 'needs_work', 'reject', 'reopen', 'lock', 'unlock'))
);

CREATE INDEX IF NOT EXISTS idx_rr_take_approval_events_approval
  ON role_room_take_approval_events (approval_id, created_at);

COMMENT ON TABLE role_room_take_approval_events IS
  'Revisjonsspor for godkjenningsbeslutninger. Hvem bestemte hva, når og hvorfor.';

-- ── Favoritt ─────────────────────────────────────────────────────────────
-- Bevisst IKKE en status. Favoritt er personlig og kan gjelde flere takes
-- samtidig; godkjenning er produksjonens og gjelder én tilstand om gangen.
-- Som status ville regissørens favorittmarkering overskrevet klipperens
-- godkjenning, og begge ville trodd de eide feltet.

CREATE TABLE IF NOT EXISTS role_room_take_favorites (
  take_source  VARCHAR(20) NOT NULL,
  take_ref     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  project_id   VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (take_source, take_ref, user_id),
  CONSTRAINT rr_take_favorite_source_vocab
    CHECK (take_source IN ('take_log', 'media'))
);

CREATE INDEX IF NOT EXISTS idx_rr_take_favorites_user
  ON role_room_take_favorites (project_id, user_id);

COMMENT ON TABLE role_room_take_favorites IS
  'Personlig favorittmarkering. Egen tabell fordi favoritt er per bruker, mens godkjenning er produksjonens.';
