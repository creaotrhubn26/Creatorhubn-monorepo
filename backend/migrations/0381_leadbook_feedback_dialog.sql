-- 0381: Tilbakemelding → dialog (2026-07-17). Daniel: «Gjør tilbakemeldingen
-- til en dialog, ikke en megafon» — lest-kvittering (lederen ser at selgeren
-- har sett den), svar-tråd per tilbakemelding, og «Mine tilbakemeldinger»-
-- samleflate for selgeren.

-- Lest-kvittering: settes når SELGEREN (eksempelets seller_user_id) har
-- sett tilbakemeldingen. Ledere ser «Sett <dato>» / «Ulest».
ALTER TABLE leadbook_example_feedback
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Svar-tråd: én tråd per tilbakemelding; både selger og ledere kan svare.
CREATE TABLE IF NOT EXISTS leadbook_feedback_replies (
  id UUID PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES leadbook_example_feedback(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',      -- selger|admin|salgssjef|teamleder|kvalitet
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lb_fbreply_feedback
  ON leadbook_feedback_replies (feedback_id, created_at ASC);
