-- 0455_role_room_signature_orders.sql
--
-- Del A punkt 42: e-signering med BankID.
--
-- **Leverandør er bevisst ikke valgt her.** Beslutningsnotatet
-- (THE-ROLE-ROOM-BANKID-BESLUTNINGSNOTAT.md § 8) sier at leverandør «velges
-- først etter sammenligning», med RFQ til Idura, Signicat og Scrive. Å bake
-- inn én leverandør nå ville foregripe den beslutningen og låse oss til
-- nettopp det notatet advarer mot.
--
-- Denne modellen er derfor leverandør-agnostisk: signeringsoppdraget og
-- signatarene er våre, mens leverandørens id-er ligger i egne felter. Å bytte
-- leverandør blir da en adapter, ikke en migrering.
--
-- **Mindreårige er grunnen til at signering må med fra start** (notatets § 8,
-- punkt 3). Derfor har en signatar `signs_on_behalf_of` — foresatt som
-- signerer for barn er ikke et spesialtilfelle, det er hovedgrunnen.

CREATE TABLE IF NOT EXISTS role_room_signature_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Hva som signeres. contract_id peker inn i legacy_compat_store-bloben og
  -- kan ikke ha fremmednøkkel; consent peker på casting_consents.
  subject_type    VARCHAR(40) NOT NULL
                  CHECK (subject_type IN ('contract','offer','consent','guardian_consent','other')),
  subject_id      VARCHAR(255),
  title           VARCHAR(255) NOT NULL,

  -- Dokumentet som signeres. Lagres som referanse, ikke innhold.
  document_url    TEXT,
  document_sha256 VARCHAR(64),

  -- Hvilken leverandør oppdraget kjøres hos. NULL inntil en er valgt —
  -- 'stub' brukes i utvikling og test.
  provider        VARCHAR(40),
  provider_order_id VARCHAR(255),

  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partially_signed','completed','declined','expired','cancelled')),

  expires_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  created_by_user_id VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Leverandørens id må være unik per leverandør når den finnes.
  CONSTRAINT rr_signature_order_provider_unique UNIQUE (provider, provider_order_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_signature_orders_project
  ON role_room_signature_orders (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_signature_orders_open
  ON role_room_signature_orders (status)
  WHERE status IN ('sent','partially_signed');

CREATE TABLE IF NOT EXISTS role_room_signature_signers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES role_room_signature_orders(id) ON DELETE CASCADE,

  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255),

  -- Foresatt som signerer på vegne av mindreårig. Dette er hovedgrunnen til
  -- at signering må være på plass fra start, ikke et randtilfelle.
  signs_on_behalf_of VARCHAR(255),

  -- Rekkefølge når signering må skje sekvensielt (f.eks. produsent etter
  -- talent). Lik verdi = kan signere parallelt.
  sign_order      INTEGER NOT NULL DEFAULT 0,

  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','signed','declined','expired')),

  -- Hva leverandøren bekreftet. Vi lagrer ALDRI fødselsnummer — kun at en
  -- gyldig BankID-signering fant sted, og leverandørens referanse til den.
  signed_at       TIMESTAMPTZ,
  signature_method VARCHAR(40),
  provider_signer_id VARCHAR(255),
  -- Leverandørens kvitteringsreferanse; selve beviset ligger hos dem.
  provider_evidence_ref TEXT,

  declined_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_signature_signers_order
  ON role_room_signature_signers (order_id, sign_order);

COMMENT ON TABLE role_room_signature_orders IS
  'Signeringsoppdrag (Del A punkt 42). Leverandør-agnostisk — leverandør velges etter RFQ, se beslutningsnotatet.';
COMMENT ON COLUMN role_room_signature_signers.signs_on_behalf_of IS
  'Foresatt signerer for mindreårig. Hovedgrunnen til at signering må med fra start.';
COMMENT ON COLUMN role_room_signature_signers.provider_evidence_ref IS
  'Referanse til leverandørens signeringsbevis. Vi lagrer aldri fødselsnummer.';
