-- Erstatt randomuser.me-snapshots med profesjonelle pravatar.cc-headshots
-- for de 9 demo-talents. Bedre kvalitet for screenshots/demo/sales-pitches.
--
-- pravatar.cc har 70 kuraterte 400×400-portretter (lisens-frie). Hvert
-- bildet er kropp-kontrollert og minner mer om profesjonelle headshots
-- enn randomuser sine snapshots.

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=11'
 WHERE id = 'b1111111-1111-1111-1111-111111111111'::uuid;  -- Elias Berg (mann)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=20'
 WHERE id = 'b2222222-2222-2222-2222-222222222222'::uuid;  -- Sara Øien (kvinne)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=33'
 WHERE id = 'b3333333-3333-3333-3333-333333333333'::uuid;  -- Marius Holm (mann)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=23'
 WHERE id = 'b4444444-4444-4444-4444-444444444444'::uuid;  -- Live Solberg (kvinne)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=53'
 WHERE id = 'b5555555-5555-5555-5555-555555555555'::uuid;  -- Nils Hauge (mann, eldre)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=45'
 WHERE id = 'b6666666-6666-6666-6666-666666666666'::uuid;  -- Ingrid Vik (kvinne)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=12'
 WHERE id = 'b7777777-7777-7777-7777-777777777777'::uuid;  -- Jonas Mørk (mann)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=24'
 WHERE id = 'b8888888-8888-8888-8888-888888888888'::uuid;  -- Amalie Skog (kvinne)

UPDATE talents SET headshot_url = 'https://i.pravatar.cc/400?img=60'
 WHERE id = 'b9999999-9999-9999-9999-999999999999'::uuid;  -- Henrik Dahl (mann)
