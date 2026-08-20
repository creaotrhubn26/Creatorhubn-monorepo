-- Auto-godkjenn for faste leverandører brukeren stoler på (typisk månedlige regninger).
-- Trygt avgrenset: styrer KUN automatisk kobling av kvittering↔betaling (bokføring —
-- reversibel + revisjonslogget), IKKE automatisk utsending av penger.
-- Append-only.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT false;
