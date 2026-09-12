-- Project-owned visual continuity references for Storyboard Room / Prompt Engine.
-- Draft assets are visible to producers, but only approved assets may be
-- inherited by a compiled prompt or sent to an image provider.

CREATE TABLE IF NOT EXISTS storyboard_reference_assets (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  pack_id VARCHAR(120) NOT NULL DEFAULT 'project',
  pack_version VARCHAR(40) NOT NULL DEFAULT 'v1',
  entity_type VARCHAR(32) NOT NULL
    CHECK (entity_type IN ('character', 'wardrobe', 'location', 'prop', 'storyboard')),
  entity_id VARCHAR(255),
  scene_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  name VARCHAR(300) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_image_id VARCHAR(500) NOT NULL,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'approved', 'rejected')),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, reference_image_id)
);

CREATE INDEX IF NOT EXISTS storyboard_reference_assets_project_status_idx
  ON storyboard_reference_assets (project_id, approval_status, entity_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS storyboard_reference_assets_entity_idx
  ON storyboard_reference_assets (project_id, entity_type, entity_id);

-- Install the versioned pack into the canonical TROLL demo without re-seeding
-- or deleting any project data. Human approval remains mandatory.
INSERT INTO storyboard_reference_assets
  (id, project_id, pack_id, pack_version, entity_type, entity_id, scene_ids,
   name, description, reference_image_id, approval_status, locked, metadata,
   created_by, created_at, updated_at)
SELECT seed.id, project.id, 'troll-production-bible', 'v1', seed.entity_type,
       seed.entity_id, seed.scene_ids, seed.name, seed.description,
       seed.reference_image_id, 'draft', FALSE,
       jsonb_build_object(
         'source', 'troll_reference_pack_v1',
         'isDemo', TRUE,
         'originalFictionalDesign', TRUE,
         'generatedAssetKind', seed.asset_kind,
         'requiresHumanApproval', TRUE
       ),
       project.created_by, NOW(), NOW()
FROM casting_projects project
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
WHERE project.id = 'troll-project-2026'
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

