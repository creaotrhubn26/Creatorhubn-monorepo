-- 0058_reference_frame_embeddings.sql
-- v2 of the reference archive: semantic search.
--
-- Each frame gets an `embedding vector(1536)` column driven by OpenAI's
-- text-embedding-3-small — cheap ($0.02/1M tokens), 1536 dims, no
-- custom model hosting needed. The vector is computed from a text
-- representation of the frame (film title + cinematographer +
-- claude-generated shotType/mood/palette/keywords), not the image
-- itself, because we already have rich text tags from the vision pass
-- and that sidesteps needing a separate CLIP inference service.
--
-- Null embeddings are allowed so old rows (written before this
-- migration) keep working — the suggest endpoint filters them out,
-- and a backfill script can fill them in later without blocking.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE role_room_reference_frames
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW is the default for pgvector 0.5+ and is faster + more accurate
-- than ivfflat for the corpus sizes a single photographer's archive
-- will reach. If pgvector on this Neon instance is pre-0.5 (unlikely
-- as of 2026), swap to `USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`.
CREATE INDEX IF NOT EXISTS role_room_reference_frames_embedding_idx
  ON role_room_reference_frames
  USING hnsw (embedding vector_cosine_ops);
