-- Migration 0410: Leadgrid Pondus-quiz (baseline-profil per selger)
--
-- Akademiets kapittel 12 («Test din pondus») blir en ekte interaktiv quiz:
-- 12 spørsmål → score per Pondus-dimensjon (autoritet/klarhet/troverdighet/
-- trygghet/fremdrift, 0-100) → profil per selger. Historikk beholdes (ny rad
-- per gjennomføring) så utvikling over tid kan vises senere.

CREATE TABLE IF NOT EXISTS leadgrid_pondus_quiz_results (
    id               SERIAL PRIMARY KEY,
    organization_id  VARCHAR(255) NOT NULL,
    user_id          VARCHAR(255) NOT NULL,
    user_name        VARCHAR(255),
    autoritet        INT NOT NULL DEFAULT 0,
    klarhet          INT NOT NULL DEFAULT 0,
    troverdighet     INT NOT NULL DEFAULT 0,
    trygghet         INT NOT NULL DEFAULT 0,
    fremdrift        INT NOT NULL DEFAULT 0,
    total            INT NOT NULL DEFAULT 0,
    -- Rå svar (spørsmål-id → valgt alternativ-indeks) for senere analyse.
    answers          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leadgrid_pondus_quiz_user_idx
    ON leadgrid_pondus_quiz_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leadgrid_pondus_quiz_org_idx
    ON leadgrid_pondus_quiz_results (organization_id, created_at DESC);
