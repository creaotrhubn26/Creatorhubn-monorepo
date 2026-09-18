-- Én lenke per person per dag, ikke én per scene.
--
-- Kortet hører til scenen: hva du gjør, hvor du står, hvilken ramme du er i.
-- LENKEN hører til personen og dagen. Er du med i tre scener samme dag, fikk du
-- til nå tre e-poster med tre lenker og måtte selv skjønne at det er samme dag —
-- stikk i strid med hele poenget, som er at statisten skal slippe å lete.
--
-- Derfor slutter token å være rad-identitet og blir lenke-identitet: alle kortene
-- til samme person samme dag deler token. Da må unik-indeksen vike.
--
-- Trygt nå: tabellen har ingen produksjonsdata (verifisert mot prod-basen før
-- endringen). Senere ville dette krevd en sammenslåing av eksisterende kort.

DROP INDEX IF EXISTS scene_role_cards_token_idx;

-- Fortsatt oppslag på token i hver offentlig forespørsel, bare ikke unikt.
CREATE INDEX IF NOT EXISTS scene_role_cards_token_idx ON scene_role_cards (token);

-- Slå opp «har denne personen allerede en lenke for denne dagen?» ved oppretting.
CREATE INDEX IF NOT EXISTS scene_role_cards_person_dag_idx
  ON scene_role_cards (project_id, production_day_id, lower(person_name));
