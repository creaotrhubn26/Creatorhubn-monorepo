-- 0451: Splitt workspace_category 'visual' i 'photo'/'video' for de to
-- distinkte profesjonene; 'visual' beholdes som kombinert team-verdi
-- (enterprise/bedriftskontoer ser fortsatt begge Photo/Video Room).
--
-- Ompeker kun rader som fortsatt står på pre-splitt-baseline
-- (workspace_category = 'visual') — admin-overstyringer satt via
-- ProfessionTypeManager røres aldri. Idempotent: kjøres migrasjonen på
-- nytt etter at verdiene alt er 'photo'/'video', treffer WHERE-klausulen
-- ingen rader.

UPDATE profession_types SET workspace_category = 'photo'
 WHERE name = 'photographer' AND workspace_category = 'visual';

UPDATE profession_types SET workspace_category = 'video'
 WHERE name = 'videographer' AND workspace_category = 'visual';

-- enterprise beholdes bevisst på 'visual' — kombinert foto+video-team.
