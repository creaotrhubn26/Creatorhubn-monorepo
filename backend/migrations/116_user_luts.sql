-- User-uploaded .cube LUTs for the photo enhancer.
--
-- Per-user scoped storage + metadata. The .cube file itself lives in R2
-- at `users/{owner_user_id}/luts/{id}.cube`; the table here carries the
-- metadata + domain info so we can serve the /luts list without having
-- to parse every file on every request.
--
-- ``id`` is a client-safe uuid exposed in URLs.
-- ``size`` / ``domain_min`` / ``domain_max`` are cached from the parser.
-- ``display_name`` defaults to the filename but photographers can rename.
-- ``category`` is optional and matches the frontend filter chip set.

CREATE TABLE IF NOT EXISTS photo_enhancer_user_luts (
  id               VARCHAR(64) PRIMARY KEY,
  owner_user_id    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(200) NOT NULL,
  description      VARCHAR(500) NOT NULL DEFAULT '',
  category         VARCHAR(40),
  r2_key           VARCHAR(500) NOT NULL,
  size             INTEGER NOT NULL,
  domain_min       NUMERIC(6, 4)[] NOT NULL DEFAULT ARRAY[0.0, 0.0, 0.0],
  domain_max       NUMERIC(6, 4)[] NOT NULL DEFAULT ARRAY[1.0, 1.0, 1.0],
  swatch_r         SMALLINT NOT NULL DEFAULT 128,
  swatch_g         SMALLINT NOT NULL DEFAULT 128,
  swatch_b         SMALLINT NOT NULL DEFAULT 128,
  bytes            INTEGER NOT NULL,
  sha256           VARCHAR(64) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_enhancer_user_luts_owner_idx
  ON photo_enhancer_user_luts(owner_user_id);

CREATE INDEX IF NOT EXISTS photo_enhancer_user_luts_created_idx
  ON photo_enhancer_user_luts(created_at DESC);
