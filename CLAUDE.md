# Creatorhubn-monorepo

## Documentation Intelligence (obligatorisk ruting)

Ved spørsmål om eksterne leverandører, releaser, API-er, kompatibilitet,
oppgraderinger — ELLER åpne forbedringsspørsmål om integrasjonsflater
(«hva kan bli bedre med Post Agent og Resolve?», «hvilke muligheter gir
ny Xcode?»):

1. Les `.claude/skills/documentation-intelligence/SKILL.md` og følg rutingen der.
2. Sjekk ALLTID først hva systemet allerede vet:
   - `docs/impact-reports/` — ukentlige versjons-/impact-rapporter med
     `## Produktmuligheter`-seksjoner (konkrete forslag med fil-pekere)
   - `docs/evidence/` — beslutninger med kilder og livssyklus
     (`sh .claude/skills/documentation-intelligence/scripts/evidence-query.sh <vendor>`)
   - `docs/baselines/` — vår faktiske eksterne API-bruk per app
3. Aldri svar på versjons-/API-spørsmål fra hukommelse alene
   (Freshness Rule i `shared/SOURCE_POLICY.md`).

**Spør før du graver:** Ved åpne forbedrings-/impact-spørsmål i interaktive
økter: still ALLTID først 1–3 korte fokus-spørsmål (AskUserQuestion) før
analysen — hvilket system (Post Agent / iPad-appene / Role Room / Leadgrid /
CreatorHub-plattformen / Reknaren / Pondus), hvilken vendor-flate, og
risiko-fokus vs. mulighets-fokus. Ikke lever bred analyse av alt når brukeren
ville hatt dybde på ett system. (Gjelder ikke autonome cron-/cloud-kjøringer.)

**Modell-disiplin:** mekanisk arbeid = scripts (null modell); henting/
kondensering per vendor = Haiku-subagenter i parallell; symbol-validering =
Sonnet; verdikt/migrering/forslag = sterkeste modell. Se Model Tiering i
skill-pakkens SKILL.md.

**Output-kontrakt:** token-effektivt, null svada. Hvert forslag = hva (ny
vendor-funksjon m/ kilde) + hvor (system + fil-peker) + hvorfor/gevinst (én
setning) + størrelse. Mangler en del → dropp forslaget. Analyse = verdikt
først + kun prosjekt-relevante punkter.

Ved beslutninger med lang hale («vi pinner X fordi Y»): skriv en
`docs/evidence/`-fil (konvensjon i `docs/evidence/README.md`) — det er det
som gjør stale-varsling og «hvorfor gjorde vi dette» gratis senere.
