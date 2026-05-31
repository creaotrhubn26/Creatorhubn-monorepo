-- Lag 3b: klient-styrt auto-pause når perioden treffer budsjett-taket.
-- Off by default — kunden slår det på når de vil at agenten automatisk skal
-- pause aktive kampanjer ved overforbruk (MedInnova-avtalen §2.3 / §3).

ALTER TABLE role_room_ads_budgets
  ADD COLUMN IF NOT EXISTS auto_pause_on_cap boolean NOT NULL DEFAULT false;
