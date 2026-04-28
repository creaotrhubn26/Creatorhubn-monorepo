-- 0073_dance_upgrade_offer.sql
-- Konverterings-flyt: Co-danser/team-medlem skal få ÉN dialog hvor
-- de kan oppgradere til Frilansdanser (uten å miste team-medlemskapet),
-- eller fortsette som team-medlem.
--
-- For å vise dialogen kun én gang per medlem-rad, legger vi til
-- upgrade_offer_seen_at-kolonne. Når brukeren har sett dialogen
-- (uansett valg), settes timestampet — vi spør ikke igjen for denne
-- team-tilknytningen.

ALTER TABLE enterprise_team_members
  ADD COLUMN IF NOT EXISTS upgrade_offer_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN enterprise_team_members.upgrade_offer_seen_at IS
  'Når team-medlemmet har sett upgrade-dialogen (Frilansdanser vs fortsett-som-medlem). NULL = ikke vist ennå. Settes uavhengig av hvilken vei brukeren velger.';
