-- 0142 — SSB lønnsestimat-cache
--
-- Cacher SSB statistikkbank-svar for yrkesgrupper. SSB-API har et
-- soft rate-limit og lønnstall oppdateres bare 1-2 ganger per år.
-- TTL: 30 dager.
--
-- styrk_code: STYRK-08-koden brukt av SSB (f.eks. "2511" for systemanalytikere)
-- median_nok / p25_nok / p75_nok: gjennomsnittlig månedslønn i NOK
-- raw_response: full SSB JSON-stat2-respons (debugging / audit)

CREATE TABLE IF NOT EXISTS nextrole_salary_cache (
  id            BIGSERIAL    PRIMARY KEY,
  styrk_code    VARCHAR(16)  NOT NULL,
  styrk_label   VARCHAR(255) NOT NULL,

  median_nok    INT,
  p25_nok       INT,
  p75_nok       INT,
  sample_size   INT,
  source_year   INT,

  raw_response  JSONB,

  fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  UNIQUE (styrk_code)
);

CREATE INDEX IF NOT EXISTS nextrole_salary_cache_expires_idx
  ON nextrole_salary_cache (expires_at);
