-- 0378: kvalitet-rollen i rollekatalogen (2026-07-16).
-- Rollen 'kvalitet' (kvalitetskontrollør) kan tildeles via team-styringens
-- promotion-endepunkt og gir tilgang til verifiseringskøen. Admin/salgssjef
-- får eksplisitte quality-permissions (gate-koden aksepterer også rollene
-- direkte — dette gjør tilgangen synlig/styrbar i permissions-matrisen).

INSERT INTO permissions (key, category, description) VALUES
  ('leadgrid_quality.verify', 'Kvalitet', 'Se verifiseringskøen og felle verdikt på vunnede salg'),
  ('leadgrid_quality.admin',  'Kvalitet', 'Administrere samtale-maler og kvalitetsinnstillinger')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('kvalitet',  'leadgrid_quality.verify'),
  ('salgssjef', 'leadgrid_quality.verify'),
  ('salgssjef', 'leadgrid_quality.admin'),
  ('admin',     'leadgrid_quality.verify'),
  ('admin',     'leadgrid_quality.admin')
ON CONFLICT DO NOTHING;
