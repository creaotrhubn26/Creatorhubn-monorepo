-- Demo-user kobles til Stella demo-agency så agency-mutations via
-- ?demo=1 fungerer end-to-end (Phase 9.9).
--
-- resolveUserContext sjekker users.agency_org_id for å finne hvilket
-- byrå brukeren tilhører. Uten dette ville demo-mutations få 403
-- 'Du tilhører ikke en agency'.

UPDATE users SET
  agency_org_id = 'a2222222-2222-2222-2222-2222222222a2'::uuid,
  agency_role = 'admin'
 WHERE id = '99999999-9999-9999-9999-999999999999';
