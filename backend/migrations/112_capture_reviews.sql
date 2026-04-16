CREATE TABLE IF NOT EXISTS capture_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES capture_assets(id) ON DELETE CASCADE,
  reviewer_id VARCHAR(255) NOT NULL,
  reviewer_type VARCHAR(32) NOT NULL,
  heart BOOLEAN,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capture_reviews_asset_idx ON capture_reviews(asset_id);
