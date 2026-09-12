-- 0370: Crew-roller blir data (frontend/shared/crew-roles.ts + GET
-- /api/projects/:id/crew-roles). Historisk gjenbrukte musikk/vendor/service-
-- boardene de visuelle nøklene (fotograf/videograf/begge/editor) med
-- kategori-labels — nå remappes lagrede oppgaver til ekte nøkler slik at
-- kolonnene kan være per-prosjekt-data og blandede team kan få egne roller.
--
-- Team-medlemmers crew_role røres IKKE (der valgte brukeren rollen ut fra
-- label, ikke kolonneposisjon). Idempotent: remapper kun de fire gamle
-- nøklene; kjøres den to ganger er andre kjøring no-op.

DO $$
BEGIN
  IF to_regclass('project_board_tasks') IS NULL THEN
    RAISE NOTICE 'project_board_tasks finnes ikke ennå — hopper over remap';
    RETURN;
  END IF;

  WITH cat AS (
    SELECT p.id AS project_id,
           COALESCE(
             pt.workspace_category,
             CASE lower(regexp_replace(coalesce(u.profession, ''), '[^a-zA-Z0-9]', '', 'g'))
               WHEN 'musicproducer' THEN 'music'
               WHEN 'musician' THEN 'music'
               WHEN 'music' THEN 'music'
               WHEN 'vendor' THEN 'vendor'
               WHEN 'petgroomer' THEN 'service'
               ELSE 'visual'
             END
           ) AS category
      FROM projects p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN profession_types pt ON pt.name = lower(coalesce(u.profession, ''))
  )
  UPDATE project_board_tasks bt
     SET crew_role = CASE cat.category
       WHEN 'music' THEN CASE bt.crew_role
         WHEN 'fotograf' THEN 'produsent' WHEN 'videograf' THEN 'vokal'
         WHEN 'begge' THEN 'musikere' WHEN 'editor' THEN 'miks' END
       WHEN 'vendor' THEN CASE bt.crew_role
         WHEN 'fotograf' THEN 'bestilling' WHEN 'videograf' THEN 'klargjoring'
         WHEN 'begge' THEN 'levering' WHEN 'editor' THEN 'oppfolging' END
       WHEN 'service' THEN CASE bt.crew_role
         WHEN 'fotograf' THEN 'booking' WHEN 'videograf' THEN 'forberedelse'
         WHEN 'begge' THEN 'gjennomforing' WHEN 'editor' THEN 'oppfolging' END
     END
    FROM cat
   WHERE bt.project_id = cat.project_id
     AND cat.category IN ('music', 'vendor', 'service')
     AND bt.crew_role IN ('fotograf', 'videograf', 'begge', 'editor');
END $$;
