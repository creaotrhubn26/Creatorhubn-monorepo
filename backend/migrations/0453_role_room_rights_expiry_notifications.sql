-- 0453_role_room_rights_expiry_notifications.sql
--
-- Del A punkt 46: utløpsvarsling for rettigheter.
--
-- Datagrunnlaget kom med buyout-vilkårene (0446). Denne tabellen bærer den
-- manglende halvdelen: hvem som har fått beskjed om hva.
--
-- Poenget er å varsle ÉN gang per terskel per kontrakt. Uten det ville en
-- utløpt rettighet gitt e-post hver eneste dag til noen skrudde av cronen — og
-- varsler som maser blir slått av, som er nøyaktig feilen punktet skal hindre.

CREATE TABLE IF NOT EXISTS role_room_rights_expiry_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyout_terms_id UUID NOT NULL REFERENCES role_room_buyout_terms(id) ON DELETE CASCADE,
  project_id      VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Hvilken terskel varselet gjaldt: 90, 30, 7 eller 0 dager før utløp.
  threshold_days  INTEGER NOT NULL,

  sent_to         VARCHAR(255) NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Selve nøkkelen mot gjentatt masing.
  CONSTRAINT rr_rights_expiry_notification_once UNIQUE (buyout_terms_id, threshold_days)
);

CREATE INDEX IF NOT EXISTS idx_rr_rights_expiry_notifications_project
  ON role_room_rights_expiry_notifications (project_id, sent_at DESC);

COMMENT ON TABLE role_room_rights_expiry_notifications IS
  'Logg over sendte utløpsvarsler (Del A punkt 46). Unik per kontrakt+terskel — hindrer daglig masing.';
