-- Eksplisitte koblinger mellom et Nexus-notat og noe annet.
--
-- Merk hva denne tabellen IKKE er: den er ikke der de fleste koblingene bor.
-- Et notat vet allerede hvilket lead det gjelder, hvor det ble skrevet,
-- når, og av hvem. De koblingene utledes fra data som allerede finnes, og
-- krever ingen handling fra selgeren.
--
-- Denne tabellen er for unntaket: koblingen et menneske ser og systemet
-- ikke kan utlede. «Dette notatet fra Coloplast handler om det samme som
-- det fra Medtronic.» Ingen kolonne kan gjette det.
--
-- Derfor er den liten, og derfor skal den forbli liten. Blir den full av
-- rader systemet kunne utledet selv, har vi bygget en wiki i stedet for et
-- notatverktøy — og da må noen vedlikeholde den.
CREATE TABLE IF NOT EXISTS leadgrid_nexus_lenker (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  fra_notat_id    uuid NOT NULL
                  REFERENCES leadgrid_canvas_notater(id) ON DELETE CASCADE,
  -- Hva den peker på. Notat er vanligst; de andre finnes så en skisse kan
  -- knyttes til møtet eller leadet den handler om når automatikken bommer.
  til_type        text NOT NULL CHECK (til_type IN ('notat', 'lead', 'mote')),
  til_id          text NOT NULL,
  -- Hvorfor. Valgfritt, men det er dette som gjør koblingen lesbar for
  -- den som finner den om et halvt år.
  merknad         text,
  laget_av        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Samme kobling to ganger er ikke to koblinger.
  UNIQUE (fra_notat_id, til_type, til_id)
);

-- Oppslaget som driver «hva peker hit»: alle lenker TIL noe.
CREATE INDEX IF NOT EXISTS leadgrid_nexus_lenker_til_idx
  ON leadgrid_nexus_lenker (organization_id, til_type, til_id);

CREATE INDEX IF NOT EXISTS leadgrid_nexus_lenker_fra_idx
  ON leadgrid_nexus_lenker (fra_notat_id);

COMMENT ON TABLE leadgrid_nexus_lenker IS
  'Eksplisitte Nexus-koblinger — unntaket. De fleste koblingene utledes fra lead, sted og tid i leadgrid-nexus-koblinger.ts.';
COMMENT ON COLUMN leadgrid_nexus_lenker.merknad IS
  'Hvorfor koblingen finnes. Det er dette som gjør den lesbar for den som finner den senere.';
