-- Andel/lot-sporing for realisert gevinst ved uttak (salg) av plassering.
-- FIFO for enkeltaksjer, gjennomsnittsmetoden for verdipapirfond (norsk skatterett).
-- Andeler lagres i mikroandeler (andeler × 1 000 000) for eksakt heltallsregning.

-- Kjøp (lot): andeler ervervet til en kostpris på en dato.
CREATE TABLE placement_lots (
  id            UUID PRIMARY KEY,
  placement_id  UUID NOT NULL REFERENCES tax_reserve_placements(id),
  acquired_at   DATE NOT NULL,
  units_micro   BIGINT NOT NULL CHECK (units_micro > 0),
  cost_minor    BIGINT NOT NULL CHECK (cost_minor >= 0),
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pl_lots_placement ON placement_lots (placement_id, acquired_at);

-- Salg (disposal): andeler realisert. Kostbasis + gevinst beregnes ved bokføring
-- (FIFO/gjennomsnitt) og lagres — append-only historikk for skattemeldingen.
CREATE TABLE placement_disposals (
  id                 UUID PRIMARY KEY,
  placement_id       UUID NOT NULL REFERENCES tax_reserve_placements(id),
  disposed_at        DATE NOT NULL,
  units_micro        BIGINT NOT NULL CHECK (units_micro > 0),
  proceeds_minor     BIGINT NOT NULL CHECK (proceeds_minor >= 0),
  cost_basis_minor   BIGINT NOT NULL,
  realised_gain_minor BIGINT NOT NULL,
  method             TEXT NOT NULL CHECK (method IN ('fifo','average')),
  created_by         UUID NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pl_disp_placement ON placement_disposals (placement_id, disposed_at);
