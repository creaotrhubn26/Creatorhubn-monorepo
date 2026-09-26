-- Hvem har sett et delt notat?
--
-- Et delt notat er en påstand om at noe angår flere enn deg. I dag kan man
-- dele, men ikke se om noen faktisk åpnet det — og da vet man ikke om
-- beskjeden kom fram eller bare ble lagt i en skuff.
--
-- Vi lagrer siste gang hver bruker åpnet notatet, ikke hver åpning. Det er
-- nok til å svare «Kari så dette i går», og det vokser ikke med bruken.

CREATE TABLE IF NOT EXISTS leadgrid_nexus_notat_sett (
  notat_id        UUID NOT NULL,
  user_id         TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sist_sett_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_nexus_notat_sett_notat
  ON leadgrid_nexus_notat_sett (notat_id, sist_sett_at DESC);

COMMENT ON TABLE leadgrid_nexus_notat_sett IS
  'Siste gang hver bruker åpnet et delt Nexus-notat. Én rad per bruker per notat, ikke én per åpning.';
