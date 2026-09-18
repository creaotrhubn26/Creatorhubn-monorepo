# Story Graph — manusimport (Fase 8b)

Story Graph kan lese et manusdokument (Word `.docx`, PDF, Markdown eller ren tekst) og
oppdatere scener og replikker fra det. Importen er **alltid en diff først**: dokumentet
analyseres på serveren, du ser hva som er nytt, endret, uendret og hva som finnes i
prosjektet men ikke i dokumentet — og ingenting skrives før du trykker «Bruk endringer».

**Ingenting slettes.** Scener og replikker som mangler i dokumentet blir foreslått som
åpne spørsmål (`kind = check`) til neste manusgjennomgang. Det er regelen fra
`AGENTS.md`: ingen replikk strykes stille.

## Hvor

Scener-fanen → **Importer** (øverst i scenelista). Krever prosjekt-tilgang; ingen plan-gate.

## Formatkrav

Parseren er avledet av dokumentene til «What Follows Us» (OPENING-HYBRID-v2,
SCENE-PLAN-v3, OPENING-DIALOGUE-v2). Den tåler Markdown som skrevet, Word-dokumenter
(overskrifter, fet skrift og tabeller bevares via HTML) og PDF-tekst (uten fet skrift og
uten tabell-streker).

### Scener

```
### P01 — Skoleveien · W01 · 1797, ettermiddag

**Før:** Bok hos Elise, løs skolisse, Oskar har filleballen.
**Handling:** Nora tar boken, gir den tilbake og knyter skolissen.
**Kontroll:** Rolig bevegelse, se seg rundt, snakke.
**Etter/utløser:** Alle fire har nådd lekeplassen.
**Lyd:** skoleveisamtale, sko, stoff og naturlig miljø.
```

- **Scene-ID** først i overskriften: `P01`, `G03A`, `H01`, `R02` (1–3 bokstaver, 2–4 sifre,
  valgfri bokstav). ID-en matches mot scenens *arbeids-ID* (`working_id`) eller *kode*;
  nye scener får ID-en som kode.
- **Tittel** etter tankestreken; deretter valgfrie deler skilt med ` · `:
  replikkblokk (`W01`, `U04`, `K03`) og epoke (`1797`, `1802`, `1817`; «før 1797»/«kult»
  gir `pre`).
- **Felt**: `Før`, `Handling`, `Kontroll` (eller `Kontroll/utgang`), `Etter` (eller
  `Etter/utløser`), `Lyd`. Engelske etiketter (`Before/Action/Control/After/Audio`) godtas.
  Fet skrift er valgfri (PDF-tekst har den ikke). Et felt kan gå over flere linjer fram
  til blank linje eller neste etikett.
- Felt som **ikke** står i dokumentet rører ikke eksisterende verdi. Tomme felt i
  dokumentet overskriver aldri.

### Replikker

```
## W01 — Skoleveien · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W01.01 | NORA | E | Must you read all the way home? |
| W01.02 | ELISE | E | You will not drop my book, will you? |
```

- Blokk-overskrift `## W01 — …` (prefiks `W`, `U` eller `K` + to sifre). Rader kan også
  stå uten pipes (`W01.01 NORA E Must you …`) — slik PDF-tekst ser ut.
- **Type** er `E`, `T`, `E+T`, `U` eller `A` (som i replikkgrunnlaget). Utelates den,
  beholdes eksisterende type.
- En blokk kobles til scenen som nevner den i overskriften (`· W01 ·`). Finnes ingen slik
  scene i dokumentet, kobles blokken til en eksisterende scene som eier `W01` (via
  undertittel eller eksisterende replikker). Et rent replikk-dokument (uten scener)
  kan derfor importeres alene.
- **Taler** matches mot karakterer i komponentarkivet på navn (`NORA`, `NORA, 12` → Nora).
  Uten treff lagres bare etiketten.

## Hva importen skriver

| Diff-status | Hva som skjer ved «Bruk endringer» |
| --- | --- |
| Ny scene | Opprettes med kode = ID, felt, epoke og kildemerker per fylt felt (`tag` = kildekoden når den er W/K/U/A/E/T, ellers `W`) |
| Endret scene | Kun endrede felt patches; kildemerker for de feltene oppdateres |
| Ny/endret replikk | Opprettes / patches (taler, tekst, type). Aldri slettet |
| Uendret | Rørt ikke |
| Mangler i dokumentet | Åpent spørsmål `IMP-<sha6>-nn` (`kind = check`) per avkrysset scene/replikk |

Kilderegisteret får (eller oppdaterer) en rad med kildekoden, etiketten, filtypen og
dokumentets **SHA-256**, merket verifisert nå. Alt skjer i én transaksjon.

## API

- `POST /api/role-room/narrative/projects/:projectId/import-document` — multipart `file`
  (≤ 15 MB). Svar: `{ fileName, kind, sourceSha256, title, stats, diff }`. Skriver ingenting.
  415 ved ukjent filtype, 422 når verken scener eller replikker gjenkjennes, 413 for stor fil.
- `POST /api/role-room/narrative/projects/:projectId/scenes/import-document/apply` — body
  `{ sourceSha256, sourceCode, sourceLabel, sourceKind, fileName?, create, update, openQuestions }`
  (samme form som diffen). 201 med `{ source, createdSceneIds, updatedSceneIds, linesCreated,
  linesUpdated, openQuestionsCreated }`; 409 `duplicate_code` / `duplicate_cue` hvis noen
  andre tok koden i mellomtiden — analyser på nytt.

Kode: `backend/server/narrative-document-import.ts` (parser + diff, ren),
`backend/server/narrative-document-import-service.ts` (DB), ruter i
`role-room-narrative-routes.ts`, UI i `narrative/scenes/ImportDocumentDialog.tsx`.
