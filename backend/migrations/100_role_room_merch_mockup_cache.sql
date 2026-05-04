-- Role Room — merch mockup cache.
--
-- Caches Printful Mockup Generator results so identical (productId,
-- variantId, designImageUrl) requests return instantly without
-- re-billing the upstream API.
--
-- TTL is enforced at read-time via expires_at; a nightly prune drops
-- expired rows. Cache key is sha256(productId|variantId|designImageUrl)
-- — deterministic, so the same logo always produces the same cache row.

CREATE TABLE IF NOT EXISTS role_room_merch_mockup_cache (
  cache_key VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL,
  mockup_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS role_room_merch_mockup_cache_expires_idx
  ON role_room_merch_mockup_cache (expires_at);
