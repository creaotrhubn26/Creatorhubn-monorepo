# Workflow Gap-rapport: Manus/Screenplay-skriving i The Role Room (Produksjonsteam-modus)

> Generert 2026-05-31 via multi-agent workflow gap-analyse (85 agenter, 60 bekreftede gap, 9 avkreftet).
> Persona: **Simen** — produsent i delt produksjonsprosjekt (`isProductionTeamMode = true`, `isContentProducerMode = false`).
> **Rød tråd:** hele manus-workflowen er bygget for `content_producer`-modus; produksjonsteam-produsenten faller systematisk utenfor stepper-, progress-, integrasjons- og leveringslagene.

## Status på implementering

**Fase 0 ✅** (3 blockere) · **Fase 1 ✅** (Fix 4–7) · **Fase 2 ✅** (Fix 8, 10) · **Fase 3 delvis** (Fix 11, 14 ✅; Fix 12–13 gjenstår) · **Fase 4 delvis** (Cmd+Enter, grammar-på-tablet, confidence-tooltip ✅; resten gjenstår).
Pluss: flere-utkast-discoverability (Daniels tilleggsønske) ✅. Alt tsc-grønt (0 feil, full typecheck).

Fase 2–4 implementert i tillegg til Fase 0/1:
- ✅ Fix 8 — «Story Foundation»-stripe (logline/tema/sjanger/konflikt) øverst i `ScreenplayEditorWithNavigator`; `storyLogicData` trådes inn fra begge monteringer.
- ✅ Fix 10 — lås-eier synlig (banner «Låst av [navn] siden HH:MM» — dekket via Fix 2/7).
- ✅ Fix 11 — «Eksporter manus»-meny (Fountain + Final Draft FDX) i editor-header; kaller eksisterende backend-endepunkt.
- ✅ Fix 14 (del) — revisjon-attribusjon: faktisk innlogget bruker i stedet for `'current-user'`.
- ✅ Cmd+Enter på siste story-logic-fase → Story Writer.
- ✅ Grammatikk-toggle vises nå også på tablet.
- ✅ Confidence-tooltip på «Vis usikre».

Andre runde (Fase 3/4-rester):
- ✅ Fix 12 (foundation) — backend tillater nå screenplay-kommentar-anker (`manuscript`, `manuscript_scene`, `screenplay_line`, `beat` i `role-room-editor-comments-routes.ts`). Inline-anker-UI i editoren gjenstår.
- ✅ Modus-badge («Produksjon» / «Innholdsprodusent» / «Klient») i Story Arc-header.
- ✅ Eksport-oppsummering — JSON-eksport viser antall akter/scener/karakterer/revisjoner.
- ✅ FirstTimeTour — Fountain-guiden auto-åpnes første gang i editoren (localStorage-guard).

Tredje runde:
- ✅ **Levering-tab for produksjonsteam** — la til `PRODUCER_REVIEWS_TAB_INDEX` («Godkjenning») + `PRODUCER_EXPORT_TAB_INDEX` («Levering») i produksjonsteamets `visibleTabValues`. Panelene + labels fantes allerede; var bare ikke synlige for modusen. **Fikset også Fix 6**: «Send til godkjenning» navigerte til en tab som ikke var synlig for produksjonsteam → effekten på `:4026` resatte den (bounce). Nå reell.

Fjerde runde (tidligere utsatte — nå bygget etter beslutninger):
- ✅ **Fix 13 — scene-reorder (Fountain er fasit).** `reorderScenesInContent` flytter scenens linje-blokk i teksten; flytt opp/ned-knapper i navigatoren. Kun for Fountain-baserte scener; respekterer lås.
- ✅ **target-duration** — `targetDurationMinutes` på prosjekt (schemaless compat-store, ingen SQL-migrasjon). Mål-chip + runtime-varsel ved >15 % avvik.
- ✅ **Inline kommentar-panel** — `PostCommentLayer` montert som «Kommentarer»-høyrepanel i editoren (anchorType=manuscript), med polling/composer/tråder.
- ✅ **Presence** — poller manus-låsen og viser aktiv redaktør i headeren («Du redigerer» / «<navn> redigerer»).

Femte runde (de tre oppfølgingene — nå bygget):
- ✅ **Per-linje margin-markører** — gul dott i linjenummer-gutteren på kommenterte linjer; klikk åpner linje-tråden. Panel-linjemodus: «Kommenter linje X», «Vis hele manuset», «Gå til linje». Markører hentes/polles (anchorRef `<manusId>#<linje>`).
- ✅ **Vennlig navne-oppslag** — henter prosjekt-medlemmer (`roleRoomProjectMembersService`) og resolver lås-eierens bruker-id → navn i «Låst av»-banneret.
- ✅ **Full multi-viewer presence** — dedikert presence-endepunkt (POST/GET `/manuscripts/:id/presence`, in-memory + 45s TTL). Klienten pinger hvert 20s med visningsnavn; «N andre her»-chip viser alle aktive (ikke bare lås-holderen).

Sjette runde (de siste lav-verdi-restene):
- ✅ **Fix 9 — workflow-breadcrumb** «Role Room Studio › Story» i manus-headeren.
- ✅ **BeatBoard-snarvei-hjelp** — Keyboard-ikon i toolbaren med tooltip som lister snarveiene (Enter / Cmd+→ / Cmd+↑↓ / Cmd+D), som tidligere kun lå i en kode-kommentar.
- ✅ **undo-tooltips** — tydeligere tekst («Angre siste endring i manuset» / «Gjør om endringen du angret»). Merk: per-handlings-etiketter («Angre: satte inn scene») ble bevisst IKKE laget — history-stacken er content-snapshots uten handlings-metadata, så det ville krevd å spore edit-type per steg.

**Alle punktene fra gap-rapporten er nå adressert** (bygget eller bevisst avgrenset med begrunnelse).

Implementert (tsc-grønt):
- ✅ Fix 1 — Unsaved-guard på «Tilbake» fra manus og story-logic (`CastingPlannerPanel.tsx` `confirmDiscardUnsavedIfNeeded`).
- ✅ Fix 2 — Manus-lås tas ved åpning + heartbeat + frigis ved lukking; lås-konflikt-banner viser hvem som låste (`ManuscriptPanel.tsx`). Server håndhevet allerede 409; hullet var at ingen tok låsen.
- ✅ Fix 3 — `AISuggestionsPanel.onAccepted` → refetcher manus + bekreftelse; synlig feil/«Prøv igjen» ved aksept-feil.
- ✅ Fix 4 — Onboarding-toast omformulert for produksjonsteam (ingen falsk stepper-referanse).
- ✅ Fix 5 — «Gå til Story Writer»-knapp i StoryLogic completion-kort (`onNavigateToStoryWriter`).
- ✅ Fix 6 — «Send til godkjenning»-knapp i editor-header → reviews-flate (`onSendToApproval`).
- ✅ Fix 7 — Autosave skiller lås-konflikt fra generisk feil; viser «Låst av [navn]».
- ✅ Flere navngitte utkast — «Dine manuskripter»-knapp i header (når et utkast er åpent) → tilbake til utkast-grid for å bytte/navngi/opprette. (Kapasiteten fantes allerede; dette var et discoverability-gap.)

Se "Anbefalt rekkefølge" nederst for resten.

---

## 1. Sammendrag — de verste «hva skjedde nå?»-øyeblikkene

1. **Onboarding lover en stepper som ikke finnes.** Toast: «Følg pipelinen Brief → Story → Storyboard → Klient → Levering øverst. Klikkbar.» Men `ContentProducerWorkflowStepper` rendres kun når `isContentProducerMode && currentProject` (`CastingPlannerPanel.tsx:9276`). Simen er produksjonsteam → stepper finnes aldri. (`usePlannerOnboardingTour.tsx:57-65`)
2. **Akseptert AI-logline forsvinner (blocker).** Fjernes optimistisk fra lista (`useAISuggestions.ts:73-86`), men `AISuggestionsPanel` har ingen `onAccept`-callback (`AISuggestionsPanel.tsx:839-852`) og StoryLogic henter fra et annet endepunkt (`storyLogicService.ts:144`).
3. **Tilfeldig «Tilbake»-klikk = tapt arbeid (blocker).** `setStoryArcView('main')` kalles direkte uten unsaved-sjekk (`CastingPlannerPanel.tsx:12661`/`12799`). `useBeforeUnloadIfDirty` finnes (`:1497-1500`) men `confirmIfDirty()` kobles aldri til knappene.
4. **To team-medlemmer overskriver hverandre stille (blocker).** `updateManuscript` sender PUT uten `If-Match`/versjon (`manuscriptService.ts:1958-1963`); server-håndhevelse bevisst deaktivert (`_shared-concurrency.ts:19-23`). Siste skriver vinner.
5. **Ingen vei fra manus til godkjenning/levering.** Kun «Eksporter PDF/JSON» (`ManuscriptPanel.tsx:2058-2068`). «Send til godkjenning» finnes ikke i editoren (approval = tab #14), og produksjonsteam har ingen Levering-tab (`:3977-3991` ekskluderer `PRODUCER_EXPORT_TAB_INDEX=15`).

## 2. Den røde tråden — Simens reise

- **Åpne delt prosjekt:** Header identisk for alle moduser (`CastingPlannerPanel.tsx:11715-11733`); onboarding-toast peker på fraværende stepper. → feil mental modell allerede ved inngang.
- **Story-inngang:** Content-producer redirectes til 'planning' med nummerert stepper (`:4372-4374`); Simen blir i 'main' med 4 kontekstløse kort (`:11736-11920`), lander i samme `ManuscriptPanel` uten breadcrumb/narrativ (`:12763-12832`).
- **Story Logic (blank start):** Åpner tomt, «Hvor vil du starte?» (`StoryLogicPanel.tsx:1340`) uten forklaring; fullført-kort har KUN «Eksporter PDF» (`:2489-2568`), ingen «Gå til Story Writer»; Cmd+Enter dør på fase 3 (`:645`). → dead-end.
- **Skrive screenplay:** `storyLogicData` når aldri `ScreenplayEditorWithNavigator` (`:211-255`) — story-DNA usynlig mens han skriver.
- **AI-assist:** Spinner uten ETA (`AISuggestionsPanel.tsx:875-887`), «Godta» uten forklaring (`:809-818`), aksept feiler stille (tom catch `SuggestionCard:763-779`), og selv ved suksess integreres forslaget ingen steder.
- **Redigere:** `SceneNavigatorSidebar` mangler `onReorder` (DragIcon importert, ubrukt `:75-98`); BeatBoard ↔ tekst usynket (`ScreenplayEditorWithNavigator:1107-1113`). → uklar source-of-truth.
- **Lagre:** Autosave-feil køes ikke for retry (`ManuscriptPanel.tsx:1583-1592`); lås-konflikt (409) gir generisk «error». → «Lagret»-badgen lyver.
- **Team/godkjenning:** Ingen presence; klientkommentarer i tab #14, ikke margin-noter (`:13150`).
- **Eksport:** PDF/JSON finnes; FDX lovet i guiden (`ScreenplayGuide.tsx:892`) + støttet i backend (`casting-manuscripts-routes.ts:800-806`) men har ingen knapp.

## 3. Gap-tabell etter alvorlighetsgrad

### BLOCKER
| Simens opplevelse | Hva skjer nå (file:line) | Hva burde skje | Kategori |
|---|---|---|---|
| «Godta AI-logline — gamle står igjen» | `AISuggestionsPanel.tsx:839-852` (ingen `onAccept`); `useAISuggestions.ts:73-86`; `storyLogicService.ts:144` | `onAccept` som populerer StoryLogic-feltene + bekreftelse | missing-function |
| «Tilbake ved uhell — alt borte» | `CastingPlannerPanel.tsx:12661`/`12799`; `useBeforeUnloadIfDirty:1497-1500` returverdi fanges aldri | Sjekk dirty før view-bytte → «Lagre & gå / Forlat / Avbryt» | illogical-flow |
| «Script-editor overskrev scenen min» | `manuscriptService.ts:1958-1963`; `_shared-concurrency.ts:19-23`; `casting-manuscripts-routes.ts:227-234` | ETag/version optimistic lock → 409 + merge-dialog | data-loss-risk |

### HIGH
| Simens opplevelse | Hva skjer nå (file:line) | Hva burde skje | Kategori |
|---|---|---|---|
| «Toast peker på stepper som ikke finnes» | `usePlannerOnboardingTour.tsx:57-65`; gated `CastingPlannerPanel.tsx:9276` | Egen tip for produksjonsteam, ev. skjul | confusing-terminology |
| «Fullførte Story-steget? Ingen progresjon» | `completedWorkflowSteps:6490-6498` kun for stepper | Utvid steg-tracking til produksjonsteam | missing-function |
| «Klar til å skrive — ingen Neste-knapp» | `StoryLogicPanel.tsx:2489-2568` kun Eksporter PDF; ingen `onNavigate` `:318-323` | «Gå til Story Writer»-knapp | illogical-flow |
| «Hvor er loglinen mens jeg skriver?» | `ScreenplayEditorWithNavigator:211-255` mangler prop | Collapsible «Story Foundation»-sidebar | dead-end |
| «AI-aksept feiler stille» | `SuggestionCard:763-779` tom catch | Error-state + Retry | silent-error |
| «Hvor sender jeg til godkjenning?» | `ManuscriptPanel.tsx:2058-2068`; approval = tab #14 `:484` | «Send til godkjenning» i editor-header | missing-function |
| «Hvor ser jeg teamets feedback?» | `role-room-editor-comments-routes.ts:23-30` ekskluderer screenplay-anker | Kommentar-sidebar med linjenivå | missing-function |
| «Kan ikke flytte Scene 5 før Scene 3» | `SceneNavigatorSidebar:75-98` ingen `onReorder`; reorder kun `ProductionManuscriptView:2189-2208` | Drag/keyboard-reorder i navigator | missing-function |
| «Beats og tekst ute av synk» | `ScreenplayEditorWithNavigator:1107-1113`; `BeatBoard:1017` | Definer source-of-truth, ev. toveis sync | illogical-flow |
| «Manus låst — vet ikke av hvem» | `ManuscriptPanel.tsx:1583` generisk; metadata `:1968-1977` vises ikke | «Låst av [navn] siden HH:MM» | illogical-flow |
| «Byttet tab med ulagret manus — borte» | `CastingPlannerPanel.tsx:1724-1763` ingen unsaved-sjekk | Bekreftelse ved tab-bytte | missing-function |
| «Ingen team-kontekst mens jeg skriver» | `ManuscriptPanel.tsx:12769` kun back-knapp | Avatar-bar + presence + uløste kommentarer | missing-function |
| «Approval frakoblet manusredigering» | `ProducerClientReviewPanel` kun tab #14; `ScreenplayEditorWithNavigator:198` mangler approval | Client-Feedback-toggle i editor-header | dead-end |
| «Vet ikke hvem som kan redigere / hvem låste» | `ScreenplayEditorWithNavigator:649-656` kun «Låst» | Vis «Låst av [navn]» + permission-oversikt | missing-function |
| «Klientkommentar på Scene 3 — ingen markør» | `producerWorkflowService.ts:112`; editor får ingen comment-props `:211-255` | Margin-ikoner + inline-tråder | missing-function |
| «Eksporterte — hvem fikk det?» | `ManuscriptPanel.tsx:1324-1347`; `exportedBy` hardkodet | Mottakerliste/varsling + nedlastings-logg | missing-function |
| «Ingen Levering-steg for produksjonsteam» | `CastingPlannerPanel.tsx:3977-3991` ekskluderer `PRODUCER_EXPORT_TAB_INDEX=15` | Levering-tab/flate for produksjonsteam | illogical-flow |
| «Ingen veiledning første gang i Story Writer» | `ManuscriptPanel.tsx:4330-4358` ingen FirstTimeTour; `ScreenplayEditorWithNavigator:303` guide auto-åpner ikke | Kontekstuell EmptyState/tour + CTA | missing-function |
| «Story Writer ikke koblet til workflow» | stepper kun content-producer `:9276` | Workflow-breadcrumb + «neste steg»-CTA | confusing-terminology |
| «Save-feil 'Lagringsfeil' — hvorfor?» | `ManuscriptPanel.tsx:1204-1206` generisk; `handleOnline:960-977` retrier ikke | Informativ feil + Retry + offline-indikator | illogical-flow |

### MEDIUM
| Simens opplevelse | Hva skjer nå (file:line) | Hva burde skje | Kategori |
|---|---|---|---|
| «Hvilken modus er jeg i?» | Identisk header `:11715-11733`; `ROLE_ROOM_PREVIEW_MODE_LABELS:553-558` ubrukt | Modus-badge «Produksjon» i header | discoverability |
| «Story Writer-kortet — riktig plass?» | `:12763-12832` ingen workflow-kontekst | Breadcrumb «Role Room Studio > Story» | illogical-flow |
| «Bør jeg gjøre Story Logic før manus?» | `ManuscriptPanel.tsx:507` aldri sjekket for completeness | Soft info-banner ved tom Story Logic | missing-function |
| «Three-Act-mal = Three-Act story logic?» | `ManuscriptPanel.tsx:3679` maler uten kontekst | Hjelpetekst/forhåndsvalg basert på rammeverk | confusing-terminology |
| «Hvem laget revisjonen, og hvorfor?» | `ManuscriptPanel.tsx:6087` `changedBy:'current-user'` hardkodet | Vis hvem/hvorfor/godkjenningsstatus per revisjon | no-feedback |
| «Ingen live-presence / merge-konflikt-varsel» | `collaborationManager.ts` ikke koblet til editoren; lock uten metadata `:359-365` | Active-editors-badge + lås-eier | missing-function |
| «FDX lovet i guiden, ingen knapp» | `ScreenplayGuide.tsx:892`; backend `casting-manuscripts-routes.ts:800-806` | FDX-knapp i eksport-meny | missing-function |
| «Grammatikk skjult på iPad» | `ScreenplayEditorWithNavigator.tsx:848-859` `{!isTablet && ...}` | Vis grammar-toggle på tablet | confusing-terminology |
| «Cmd+Enter slutter å virke på fase 3» | `StoryLogicPanel.tsx:645` `if (current >= 2) return;` | Cmd+Enter på fase 3 → naviger til Story Writer | illogical-flow |
| «Ingen vei tilbake til Story Logic» | `ProductionManuscriptView:3853-3947` chips uten onClick | Klikkbar logline/edit-link tilbake | dead-end |
| «Spinner uten ETA ved AI-generering» | `AISuggestionsPanel.tsx:875-887` binær state | Elapsed-time/status-tekst | no-feedback |
| «Godta AI-forslag ved uhell — ingen angre» | `useAISuggestions.ts:73-86` optimistisk fjerning | «Recently accepted» + Undo (30s) | data-loss-risk |
| «Undo/redo-knapper uten kontekst» | `ScreenplayEditor.tsx:1572-1615` statiske tooltips; `useSceneHistory:178` `lastPatchLabel` ubrukt | Kontekstuelle tooltips | discoverability |
| «BeatBoard-snarveier ikke synlige» | `BeatBoard.tsx:10`; `HelpButton:102-107` mangler dem | Hjelp-boks + handling-feedback | discoverability |
| «ProjectTabAccessDialog finner jeg ikke fra manus» | `RoleRoomDashboardPanel:1849-1923` kun crew-tab | Gear-ikon i editor-header → dialog | discoverability |
| «Hvordan linker jeg klientfeedback til revisjon?» | Revisions-tab `:6035-6040` får ingen feedback-props | «Linked Feedback»-panel | missing-function |
| «Manus låst, kan låses opp — finnes final?» | `ScreenplayEditorWithNavigator:197` lås uten workflow-state; `ManuscriptPanel:4326` sender ikke `lockState` | Status-maskin writing→ready→approval→approved→locked | illogical-flow |
| «Ingen eksport-oppsummering» | `ManuscriptPanel.tsx:1342` kun success-toast | Dialog: filnavn/størrelse/scener/akter/tid | confusing-terminology |
| «Tilbake-knapp: lagret det?» | `CastingPlannerPanel.tsx:12796-12812` CloseIcon, ingen guard | Unsaved-sjekk + ArrowBackIcon + «Lagret»-toast | illogical-flow |
| «StoryLogic ulagret blokkerer ikke view-bytte» | `StoryLogicPanel:386-395` rapporterer; back `:12661` sjekker ikke | Bekreftelse ved view-bytte / autosave on unmount | data-loss-risk |
| «Autosave-feil køes ikke for retry» | `ManuscriptPanel.tsx:1583-1592` forkaster `pendingContentRef` | `failedSavesRef`-kø + retry ved online | missing-function |

### LOW
| Simens opplevelse | Hva skjer nå (file:line) | Hva burde skje | Kategori |
|---|---|---|---|
| «Karakter ikke i logline — ingen varsel» | `ProductionManuscriptView:3853-3947`; `scriptAnalysisService.ts:523` tar ikke `storyLogicData` | Validering: protagonist i logline | no-feedback |
| «65% confidence — av hva?» | `AISuggestionsPanel.tsx:912` «Vis usikre» uten forklaring | Tooltip som forklarer confidence | confusing-terminology |
| «45 min vs. klients 30 min — ingen varsel» | metadata `manuscriptService.ts:2909-2922`, ingen target | `targetDuration` + advarsel før godkjenning | missing-function |
| «Ingen presence i header» | `ManuscriptPanel:4326-4358` sender ikke `teamMembers` | Collaborators-avatar-stack | missing-function |

## 4. Screenplay-format-spesifikt

**Fungerer:** Fountain-editor m/ scene-navigator, beat board, table read, lås-tilstander, syntax-highlight, sidetall/runtime (`ScreenplayEditorWithNavigator:704-773`), PDF-eksport (`ScreenplayPDFExport.tsx:239`), JSON-eksport, strukturmaler (`manuscriptTemplates.ts`), komplett Fountain-guide (avkreftet som gap).

**Brister:**
- **FDX-eksport** implementert i backend (`casting-manuscripts-routes.ts:800-806`, `casting-screenplay-formats.ts:323-357`) + dokumentert (`ScreenplayGuide.tsx:892`), men ingen UI-knapp.
- Ingen «Eksporter som»-meny (kun PDF + JSON).
- **To parallelle scene-modeller**: Fountain-tekst vs. `ProductionManuscriptView`-database-scener; reorder kun i sistnevnte; beat↔scene usynket.
- Ingen eksport-bekreftelse.

## 5. Produksjonsteam-spesifikt (svakeste området)

Samtidig redigering = stille datatap (blocker); ingen presence/lås-eier selv om `lockedBy/lockedAt` finnes i API (`manuscriptService.ts:2010-2026`); kommentarer silet i tab #14 (screenplay-anker eksplisitt ekskludert `role-room-editor-comments-routes.ts:23-30`); ingen «send til godkjenning» fra editor; revisjoner uten attribusjon (`ManuscriptPanel.tsx:6087`); `ProjectTabAccessDialog` (seats) kun fra crew-tab; ingen Levering-steg. `CollaborationManager` finnes men kun koblet til admin-dashboardet.

## 6. Discoverability (finnes, men gjemt)

Workflow-stepper (usynlig for produksjonsteam `:9276`), FDX-eksport (ingen knapp), grammar-panel (skjult på tablet `:848-859`), `ROLE_ROOM_PREVIEW_MODE_LABELS` (definert, ubrukt `:553-558`), `ProjectTabAccessDialog` (kun crew-tab), `useBeforeUnloadIfDirty`/`confirmIfDirty` (kalles men returverdi ignoreres `:1497-1500`), Fountain-guiden (auto-åpnes aldri `:303`).

## 7. Anbefalt rekkefølge (ROI-sortert)

**Fase 0 — datatap-stopp (blockers):**
1. Unsaved-guard på view/tab-bytte — koble `confirmIfDirty()` til back/tab-knappene (`CastingPlannerPanel.tsx:12661, 12799, 1724`).
2. Concurrent-edit-beskyttelse — aktiver If-Match/412 (`_shared-concurrency.ts`, `manuscriptService.ts:1958`) + vis lås-eier ved 409.
3. AI-aksept-integrasjon — `onAccept` fra `AISuggestionsPanel` → populer StoryLogic (`:839-852`).

**Fase 1 — verste forvirring (billig):**
4. Fiks onboarding-toast for produksjonsteam (`usePlannerOnboardingTour.tsx:57-65`).
5. «Gå til Story Writer»-knapp i Story Logic completion-kort (`StoryLogicPanel.tsx:2553-2563`) + `onNavigate`-prop.
6. «Send til godkjenning»-knapp i editor-header (`ManuscriptPanel.tsx:2058`).
7. Lås-konflikt + autosave-feil med synlig melding/retry (`ManuscriptPanel.tsx:1583`).

**Fase 2 — story-DNA + kontekst synlig:**
8. «Story Foundation»-sidebar i editoren — send `storyLogicData` til `ScreenplayEditorWithNavigator` (`:211-255`).
9. Workflow-kontekst for produksjonsteam (breadcrumb + progress + «neste steg»-CTA).
10. Team-presence + lås-eier i header (`ScreenplayEditorWithNavigator:649-656`).

**Fase 3 — samarbeid + format-komplett:**
11. FDX-eksport-knapp (backend finnes).
12. Inline kommentar-anker for screenplay (`role-room-editor-comments-routes.ts:23-30`).
13. Scene-reordering i navigator + avklar beat↔scene source-of-truth.
14. Revisjon-attribusjon + Levering-tab for produksjonsteam.

**Fase 4 — polish:**
15. Modus-badge, grammar-på-tablet, Cmd+Enter-exit, eksport-oppsummering, target-duration-varsel, confidence-tooltip, FirstTimeTour, undo-tooltips, BeatBoard-snarvei-hjelp.

**Hovedinnsikt:** ~70 % av gapene har én felles rot — manus-workflowen er arkitektonisk bygget for `content_producer`-modus, og produksjonsteam-produsenten faller utenfor stepper-, progress-, integrasjons- og leveringslagene (`useProducerAccess.ts:42-44`, `CastingPlannerPanel.tsx:9276, 2867, 3977-3991`).
