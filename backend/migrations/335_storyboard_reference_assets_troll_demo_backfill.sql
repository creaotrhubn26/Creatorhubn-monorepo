-- Backfill the versioned Storyboard Room reference pack into existing TROLL
-- demo copies. The original table migration only targeted the canonical
-- `troll-project-2026`, while the real demo flow creates owner-scoped
-- `troll-<timestamp>` projects.
--
-- Safety:
--   * only projects carrying the TROLL demo seed metadata are eligible;
--   * no project or storyboard rows are deleted or rewritten;
--   * existing human approval/lock/reviewer state is intentionally preserved.

INSERT INTO storyboard_reference_assets
  (id, project_id, pack_id, pack_version, entity_type, entity_id, scene_ids,
   name, description, reference_image_id, approval_status, locked, metadata,
   created_by, created_at, updated_at)
SELECT
  CASE
    WHEN project.id = 'troll-project-2026' THEN seed.id
    ELSE LEFT(project.id, 24) || '-' || seed.id
  END,
  project.id,
  'troll-production-bible',
  'v1',
  seed.entity_type,
  CASE
    WHEN project.id = 'troll-project-2026' THEN seed.entity_id
    ELSE LEFT(project.id, 24) || '-' || seed.entity_id
  END,
  CASE
    WHEN project.id = 'troll-project-2026' THEN seed.scene_ids
    ELSE (
      SELECT jsonb_agg(LEFT(project.id, 24) || '-' || scene_id)
      FROM jsonb_array_elements_text(seed.scene_ids) AS scene_id
    )
  END,
  seed.name,
  seed.description,
  seed.reference_image_id,
  'draft',
  FALSE,
  jsonb_build_object(
    'source', 'troll_reference_pack_v1',
    'isDemo', TRUE,
    'originalFictionalDesign', TRUE,
    'generatedAssetKind', seed.asset_kind,
    'requiresHumanApproval', TRUE
  ),
  project.created_by,
  NOW(),
  NOW()
FROM casting_projects AS project
CROSS JOIN (
  VALUES
    ('ref-troll-nora-v1', 'character', 'role-nora',
     '["scene-3","scene-4","scene-5","scene-7","scene-9","scene-10"]'::jsonb,
     'Nora Tidemann — karakter og garderobe',
     'Originalt fiktivt karakterdesign med stabil identitet og garderobe. Ingen skuespillerlikhet.',
     'builtin://troll/v1/nora-character-wardrobe', 'character_wardrobe_sheet'),
    ('ref-troll-creature-v1', 'character', 'trollet', '["scene-8"]'::jsonb,
     'Trollet — skapning og skala',
     '40 meter høyt, sørgmodig og intelligent fjelltroll med stabil geologisk anatomi og tydelig skala.',
     'builtin://troll/v1/troll-creature-scale', 'creature_scale_sheet'),
    ('ref-troll-dovrefjell-v1', 'location', 'loc-dovre',
     '["scene-5","scene-8","scene-9"]'::jsonb,
     'Dovrefjell — location og lyskontinuitet',
     'Samme åskam, vei, steinur, trelinje og snøgeografi ved skumring, natt og daggry.',
     'builtin://troll/v1/dovrefjell-location', 'location_continuity_sheet'),
    ('ref-troll-scene-8-sequence-v1', 'storyboard', 'scene-8', '["scene-8"]'::jsonb,
     'Scene 8 — trollet på vandring',
     'Tre sammenhengende storyboardruter med samme troll, location og skjermretning.',
     'builtin://troll/v1/scene-8-storyboard-sequence', 'storyboard_sequence')
) AS seed(id, entity_type, entity_id, scene_ids, name, description,
          reference_image_id, asset_kind)
WHERE LOWER(BTRIM(project.name)) = 'troll'
  AND COALESCE(project.metadata ->> 'isDemo', 'false') = 'true'
  AND project.metadata ->> 'source' = 'troll_seed_v1'
ON CONFLICT (project_id, reference_image_id) DO UPDATE SET
  pack_id = EXCLUDED.pack_id,
  pack_version = EXCLUDED.pack_version,
  entity_type = EXCLUDED.entity_type,
  entity_id = EXCLUDED.entity_id,
  scene_ids = EXCLUDED.scene_ids,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = storyboard_reference_assets.metadata || EXCLUDED.metadata,
  updated_at = NOW();
