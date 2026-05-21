-- Slice 9X.82 — Submit-step på klient-galleri-utvalg (Pixieset-stil)
--
-- client_image_selections eksisterer allerede med selection_type='favorite'.
-- Det som manglet var "submitted"-konseptet: klient kan endre på utvalget
-- helt til hun trykker "Send mitt utvalg", som låser favoritt-listen og
-- sender e-post til fotograf med curated summary.
--
-- submitted_at = NULL  → klient kan fortsatt legge til / fjerne
-- submitted_at != NULL → endelig utvalg sendt (vis "Sendt 15. mai"-badge)

ALTER TABLE client_image_selections
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE client_image_selections
  ADD COLUMN IF NOT EXISTS submission_note TEXT;

CREATE INDEX IF NOT EXISTS idx_client_image_selections_submitted
  ON client_image_selections (gallery_id, client_email, submitted_at)
  WHERE submitted_at IS NOT NULL;
