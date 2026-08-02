-- 0382: Visningstall for Leadbook-eksempler (2026-07-17). Daniel (punkt 4,
-- distribusjon): «visningstall per eksempel så ledere ser hva som faktisk
-- brukes». Én rad per (eksempel, bruker) med teller — gir både totale
-- visninger og unike lesere. Publiserings-varselet («Ukens samtale»-push)
-- trenger ingen migrasjon (notification_events finnes).

CREATE TABLE IF NOT EXISTS leadbook_example_views (
  example_id UUID NOT NULL REFERENCES leadbook_examples(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  view_count INT NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (example_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lb_exviews_org
  ON leadbook_example_views (organization_id, example_id);
