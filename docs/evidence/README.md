# Evidence Graph — lagringskonvensjon

Persistert evidensminne for Documentation Intelligence
(`.claude/skills/documentation-intelligence/evidence-graph/SKILL.md`).

## Konvensjon

- Én YAML-fil per sak/beslutning: `YYYY-MM-<slug>.yaml`
- Feltene følger `schemas/evidence-record.json` i skill-pakken, pluss
  `decision`, `affected`, `lesson` for beslutningskontekst.
- Skriv en fil når en ekstern teknisk beslutning har lang hale
  ("hvorfor er vi pinnet", "hva blir stale når X slippes") — ikke for
  hverdagsfakta.
- Oppdater aldri historikk destruktivt: livssyklus representeres med
  `valid_from`/`valid_to`, ikke overskriving (temporal-regelen i SKILL.md).

## Seed-saker

De fire første filene er dyrekjøpte drift-caser fra dette repoet. De er
kalibreringsdata: når en påstand ligner en av disse klassene, krev fersk
verifisering (se `shared/SOURCE_POLICY.md` → Freshness Rule).

| Fil | Klasse |
|---|---|
| `2026-08-adobe-udt-rename.yaml` | Dokumentasjonsdrift uten release |
| `2026-08-moodle-x-frame-options.yaml` | Host-policy bryter integrasjonsflate |
| `2026-07-ios27-fm-symbols.yaml` | Dokumentert symbol ≠ kompilerbart i vår SDK |
| `2026-08-apex-redirect-webkit.yaml` | Plattform-oppførsel bryter klient stille |
