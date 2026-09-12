-- 0374: leadgrid_vehicles.eu_control_due — EU-kontroll (PKK) neste frist fra
-- Vegvesen (2026-07-13). Til vedlikeholds-/kontroll-varsler i Leadgrid Go.
ALTER TABLE leadgrid_vehicles ADD COLUMN IF NOT EXISTS eu_control_due DATE;
