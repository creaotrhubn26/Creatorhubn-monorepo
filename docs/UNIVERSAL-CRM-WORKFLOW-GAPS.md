<!-- Generert av multi-agent workflow universal-crm-workflow-gaps. 44 verifiserte gap, 2 avvist. Persona: fotograf Simen. Kjort 2026-06-01. -->

# Universal CRM — Workflow Gap-analyse (fotograf-persona Simen)

## 1. Sammendrag

Universal CRM-en fungerer i dag mer som et **kontaktregister med løse hjelpefunksjoner** enn som et operativt fotograf-CRM. Backend-laget er overraskende komplett — det finnes ferdige API-er for deals, pipeline-stages, tasks, aktiviteter, kontrakt-signering, galleri-levering og fakturering — men store deler av dette er **foreldreløs kapasitet uten frontend-konsument**, eller det er bygget i en *annen* flate som kundekortet aldri lenker til. Hovedmønsteret i de 44 gapene er todelt: (1) **manglende tilbakemelding** — nesten ingen mutasjon i CRM-en viser suksess/feil-toast, til tross for at appen har `notistack` + `use-toast` brukt i ~98 andre filer; og (2) **brutt livssyklus** — det finnes ingen pipeline-tavle, ingen tilbud-flyt, ingen depositum-gate, ingen fakturering og ingen etter-levering-loop fra kundekortet, så Simen kan ikke kjøre business ende-til-ende uten å hoppe mellom moduler. Resultatet er at Simen ofte ikke vet *om handlingen gikk gjennom*, og at penger-/booking-kjernen — det som skiller et CRM fra et regneark — i praksis mangler der han faktisk jobber.

## 2. Topp-prioriteringer

De viktigste fiksene for å lukke kjernefunksjoner og gi Simen forståelse av hva som skjer:

| Gap | Severity | Effort | Fix |
|-----|----------|--------|-----|
| #40 Ingen suksess/feil-toast på noen mutasjon (CRM er eneste outlier blant ~98 filer) | medium | small | Importer `useToast`/`enqueueSnackbar`; legg `onError`+suksess-toast på alle fire useMutation-objekter |
| #9 Ingen fakturering noe sted i CRM-en | high | large | Legg til `Faktura`-handling på kundekortet, koblet til CRM-fakturaendepunkt eller bro til wedding-invoice via `client_id` |
| #6 Ingen depositum-gate — booking «bekreftes» uten penger/signatur | high | large | Innfør depositumsbeløp + betalingslenke (Vipps/Stripe); flipp til «booket» først ved signatur + innbetalt depositum |
| #2 Ingen pipeline-board — flat kundeliste uten steg | high | medium | Bygg PipelineBoard som henter `pipeline-stages` og grupperer kunder per steg med dra-og-slipp → PUT status |
| #3 Ingen tilbud/proposal-flyt fra kundekortet | high | medium | `Tilbud`-knapp som åpner eksisterende QuoteManagement forhåndsutfylt med kundedata; vis accept/decline-status |
| #10 Null betalings-status-sporing (statiske beløp uten betalt/utestående) | high | medium | Innfør deposit/paid/balanceDue/dueDate/paymentStatus på kontrakt/faktura; vis status-chip + utestående-AR i `/stats` |
| #5/#28/#29 Møtedialog feiler stille + viser aldri Meet-lenken | high | small | Legg `onError` med Alert; render `meetLink` med kopier/åpne-knapp før dialogen lukkes; spesialhåndter «koble Google først» |
| #1 Ingen automatisk lead-intake (manuell add er eneste reelle vei) | high | large | Bygg minst én auto-kanal (web-form-endpoint/e-post-parsing) som oppretter lead m/ korrekt source + auto-svar + «følg opp innen 24t»-task |

## 3. Gap gruppert per livssyklus-stadium

### Lead-intake

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 1 | high/large | Bryllups-henvendelse på e-post mens han er på jobb fanges ikke, ingen auto-svar, ingen oppfølgings-task | Eneste vei inn: manuelt skjema `UniversalCRMDashboard.tsx:1240-1301` → `POST` `universal-crm-routes.ts:129`. Ingen inbound/webhook; `onSuccess` 526-562 gjør kun query-invalidering + Google-sync | Innkommende henvendelse fanges, lead får auto-svar, SLA-task opprettes | Auto-inntakskanal (web-form/e-post-parsing) m/ korrekt `source` + stage-trigger som sender auto-svar + lager task i `crm_tasks` |
| 16 | medium/large | Empty-state lover et nettside-skjema som ikke finnes | Tekst `UniversalCRMDashboard.tsx:1343` lover automatisk inntak; ingen public lead-form/embed finnes; `universal-crm-routes.ts:129-130` er bak `requireUserSession` | Enten et reelt embeddable skjema, ellers ikke love funksjonen | Fjern setningen til public lead-endpoint finnes; bygg token-beskyttet `POST /api/public/lead/:formToken` med `source='website'` + embed-kode i innstillinger |
| 17 | medium/trivial | «Hvor kom leaden fra?» kan ikke registreres ved manuell add — kanaldata tapes | `source`-kolonne finnes (`universal-crm-routes.ts:143,166`), men skjemaet (1246-1300) har ingen kilde-input; `handleCreateCustomer` (838-852) sender aldri `source` → alltid null | Manuelle leads skal merkes med kilde for ROI-rapport | `Kilde`-Select i skjemaet; inkluder `source` i `customerData`; default `'manual'` |
| 18 | medium/small | Trykker «Lagre kunde», skjemaet lukkes — ble hun lagret? Ved nettverksfeil: ingenting | `createCustomerMutation` 510-563 har KUN `onSuccess`; ingen `onError`, ingen toast; ingen global mutationCache | Suksess-snackbar; feilmelding som beholder skjema+data | `onError` som viser Alert og IKKE lukker skjemaet; suksess-snackbar i `onSuccess` |
| 19 | medium/trivial | Tomt nettside-felt lagres som literal `,` | `UniversalCRMDashboard.tsx:839` fallback `|| ','` lagres i `customFields.website` (849); samme `', '`-antimønster i edit-defaults 2166-2190 (korrumperer kjernefelt) | Tomt felt = tom streng / utelatt | Endre fallback til `''`; utelat website fra customFields hvis tom |

### Qualify / pipeline

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 2 | high/medium | Ingen tavle/kolonner — bare flat kundeliste, «hvor er pipelinen min?» | Backend `deals`/`pipeline-stages` fullt CRUD (`universal-crm-routes.ts:419-496,744-780`) men 0 frontend-konsumenter; dashboard rendrer kun `filteredCustomers.map` (1377) | Kanban: kolonne per steg, dra kort mellom steg | PipelineBoard som henter `pipeline-stages`, grupperer per steg, dra-og-slipp → PUT status/stage |
| 20 | medium/small | Status-fremrykking begravd i Rediger-dialogen — tungvint for daglig handling | Kort-knapper 1623-1687 har ingen status-kontroll; eneste vei er Select i Rediger (2178-2187). Backend PUT støtter status-only update | Inline status-velger/«Neste steg»-knapp på kortet | Liten Select/SegmentedButton på kortet → `updateCustomerMutation.mutate({status})`; gjenbruk `getStatusColor` (755) |
| 21 | medium/small | Endrer status, dialogen lukkes — gikk det bra? | `updateCustomerMutation` 566-587 ingen `onError`; `onSuccess` kun `sendBroadcast`+invalidate+lukk; kun `isPending`-tekst 2216 | Synlig suksess/feil-feedback | MUI Snackbar styrt av `onSuccess`/`onError`; ikke lukk dialogen ved feil |
| 22 | medium/small | Filtrerer «Potensielle» — usikker på om han ser ALLE | Statusfilter kun klient-side (`665-668`); telling `1201` over første side; backend STØTTER status-param (`32-35`) men frontend sender den ikke; LIMIT 100 (`48-50`) | Status server-side (som søk), korrekt telling | Send `statusFilter` i query-key+param; bruk `total` fra respons |
| 23 | medium/trivial | Kortet sier `lead`/`prospect`, filteret sier «Henvendelser»/«Potensielle» — to navn for samme steg | Chip `label={customer.status}` rått (`1437`); norske etiketter i filter/dialog (1190-1194, 2181-2185) | Samme norske etikett overalt | `statusLabel`-map (lead→«Henvendelse»…), gjenbruk i filter for én sannhetskilde |
| 24 | medium/large | Backend regner deals/tasks-metrikker, men ingen UI kan opprette dem → permanent 0 | `/stats` 364-406 regner deals/tasks; create-endepunkter (450,659) har 0 frontend-konsumenter; primaryMetrics leser aldri `stats.deals/tasks` | UI for å opprette deals/tasks, ellers skjul de døde tallene | Bygg minimal deal-/task-opprettelse (via `customer_id`) eller skjul blokkene til UI finnes |

### Booking / kontrakt

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 3 | high/medium | Ingen «Tilbud»-knapp på kundekortet — kan ikke sende pris å si ja til | Action-rad 1623-1759 har ingen quote-knapp; kapabelt QuoteManagement-modul er orphaned (importert ingen steder utenfor egen fil) | Bygg/send tilbud fra kortet, se accept/decline | `Tilbud`-knapp som åpner QuoteManagement forhåndsutfylt; vis status; link akseptert tilbud → kontrakt via `source_quote_id` |
| 4 | high/medium | Kontrakt-dialog spør ikke om dato/sted/depositum — bryllupsdato + forskudd tapes | Payload 1901-1909 sender kun navn/budget/generisk beskrivelse; `event_date`/`event_location`/`contract_type`-kolonner finnes (`contracts-routes.ts:603`) men sendes aldri; depositum finnes ikke noe sted i contracts-subsystemet | Skjema/arv: eventDate, sted, contractType per sjanger, depositum | Bytt one-click mot skjema (eller åpne full ContractEditor) med disse feltene |
| 5 | high/small | Trykker «Planlegg møte», dialogen lukkes/henger — ser aldri Meet-lenken, ingen bekreftelse | `scheduleMeetingMutation` 653-660 viser aldri `response.meetLink`; ingen `onError`; «koble Google først»-feil (`google-meet.ts:109`) svelges | Suksess: lenke+kopier/åpne+snackbar. Feil: tydelig melding | `onError` med Snackbar/Alert; render `data.meeting.meetLink` før lukking |
| 6 | high/large | Ingenting krever depositum/signatur før booking «bekreftes» | Ingen deposit/retainer i flyten; contracts-INSERT (`600-642`) mangler deposit-felt; `booking-schema.ts` deposit-felt er dead/uwired | Booking gates bak depositum + signatur, saldo-sporing | Innfør depositum + betalingslenke; status→«booket» kun ved signatur + innbetaling |
| 13/27 | high–medium/small | Kontrakter-dialog montert TO ganger på samme state — «Opprett kontrakt» gir ingen synlig respons | To `<Dialog open={showContractsDialog}>` på `1885` og `2304/2305`; onClick (1898-1925) ingen pending/toast, kun `console.error` | Én dialog; knapp disables/spinner + suksess/feil-toast | Slett duplikat (2304-2387); gjør create til `useMutation` m/ isPending + toast |
| 25 | medium/small | «Opprett kontrakt» lager tom draft — ingen «Send til signering», blir draft for alltid | CRM-dialog kaller ingen av signerings-endepunktene (`/google-signature/send` 1174 osv.); kapabel UniversalContractHub finnes, men ikke lenket fra CRM | Send til e-signering + signaturstatus fra kontekst | Per draft-rad: «Send til signering» + signature_status-chip; deep-link til Kontraktsenter |
| 26 | medium/small | Møte+kontrakt opprettet, men kunden står fortsatt «Henvendelse»; tellere stemmer ikke | Verken `scheduleMeetingMutation` (653-660) eller contract-create (1917-1921) endrer `customer.status` (Prosjekt-flyten DOES via backend-cascade `projects-routes.ts:442-446`) | Kontrakt opprettet/signert → lead→active | Kall PUT customers m/ ny status i contract-`onSuccess`/signatur-fullført; invalider |
| 39 | medium/small | «Opprett kontrakt» — listen oppdateres kanskje, ingen bekreftelse, dobbelttrykk-risiko | onClick 1898-1924: kun refetch ved suksess, `console.error` ved feil; ingen pending/disabled | Suksess/feil-toast + loading-state | Snackbar + loading-state; vis backend 4xx/5xx |

### Produksjon / scheduling

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 7 | high/medium | Planlagt møte forsvinner — ingen kalender/agenda/«kommende møter» | `onSuccess` 653-660 lukker kun dialog; 6 useQuery-er dekker ikke meetings; backend lagrer i `meeting_notes`+kalender men hentes aldri tilbake | Agenda/«kommende møter» per kunde + samlet | useQuery mot meeting-list-endepunkt; render kommende møter + Meet-lenke |
| 8 | high/medium | Kan bare lage generisk «møte» — ingen shotliste, kjøreplan eller location knyttet til kunden | Møte-dialog 1985-2022 har kun tittel/dato/tid/varighet/beskrivelse; ShotListManager ikke koblet til CRM; CRM og timeline er separate tabs | Åpne/koble shotliste + dag-plan fra shoot | Location-felt (backend støtter `meetingLocation` `index.ts:74506`) + «Åpne shotliste/kjøreplan»-handling forhåndsfiltrert på kunde |
| 28 | medium/small | Uten koblet Google: «Planlegger…» → tilbake, ingen feilmelding, 400 svelges | `scheduleMeetingMutation` 630-661 kun `onSuccess`; backend 400 (`index.ts:71676-71681`) svelges av manglende `onError` | Forståelig feil m/ «Koble Google»-knapp; dialog forblir åpen | `onError` → MUI Alert i dialog; spesialhåndter 400 m/ lenke til Google-tilkobling |
| 29 | medium/small | Møtet opprettes i Google, men Meet-lenken vises aldri/kan ikke kopieres | Backend returnerer `meetLink`+`webViewUrl` (`google-meet.ts:37-44`) → `data.meeting` (651); `onSuccess` kaster den i valgfri callback | Vis lenke m/ «Kopier»/«Åpne i kalender» | I `onSuccess`: bekreftelses-Alert/snackbar m/ `meetLink` + kopier-knapp |
| 30 | medium/trivial | For fotografen settes ingen `onMeetingSchedule`-callback → selv suksess gir 0 feedback | Callback satt KUN av `EventsManagementPlatform.tsx:2801`; fotograf-stier (ProfessionAdapter/UniversalDashboard/SmartWorkflowSystem) sender den ikke | Suksess-feedback innebygd i komponenten | Flytt suksess-toast inn i komponenten; behold callback som tillegg |
| 31 | medium/small | Bryllups-shoot om 3 uker — ingen påminnelse til fotograf eller kunde | `google-meet.ts:20-35` payload har ingen reminder-felt; events.insert (`312-341`) setter ingen `reminders`; `automated_reminders` skrives men leses aldri | Auto-påminnelser før shoot; minst kalender-reminders | Sett `reminders.overrides` i `createGoogleMeetLink`; stage-trigget påminnelse |
| 32 | medium/small | Dato defaulter til i dag uten validering → kan booke shoot i fortiden | `meetingForm` init `new Date()...` (158,297); dato-felt 1993-1999 uten `min`; knapp kun disabled på `isPending`; backend slipper gyldig fortidsdato gjennom | `min=i dag`; disabled/advarsel ved fortid | `inputProps={{min: today}}` + validering i onClick/disabled |

### Levering / galleri

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 33 | medium/small | Ingen «Send til klient» fra CRM — «Åpne» åpner galleriet for HAM selv | `notify-client`-endepunkt finnes (`photographer-galleries-routes.ts:737-794`) men 0 treff i dashboard; kun `window.open(shareUrl)` (1564,1843) + mark-complete (1854) | «Send til klient» som mailer galleri-lenke + bekreftelse | «Send til klient»-knapp → `POST .../notify-client`; snackbar (håndter 503/400) |
| 34 | medium/small | «Marker ferdig» — knappen forsvinner etter hvert, ingen «markert levert»-melding; feil = ingenting | Handler 1852-1864: kun invalidate ved suksess, `console.warn` ved feil; backend returnerer `alreadyCompleted`/`projectCallbackOk` (554-560) som aldri vises | Suksess-bekreftelse + feilmelding + idempotent-håndtering | Snackbar; vis suksess/feil; disable knapp under kall |
| 35 | medium/trivial | Klientens favoritter/kommentarer usynlige i CRM — kun «X valg» → purrer unødvendig | Backend returnerer `favoriteCount`/`commentCount` (`107-109,158-160`) men type-def (370-382) deklarerer dem ikke; «valg» teller kun `selection_type='selected'` | Vis favoritter + kommentarer i tillegg til «valg» | Legg `favoriteCount`/`commentCount` i query-type; render som egne chips |
| 36 | medium/small | Ingen «Nytt galleri» fra kundekortet — knapp finnes kun HVIS galleri allerede finnes | `POST .../galleries` finnes (181) men 0 treff i CRM; «Galleri-historikk» kun `galleryAgg.count > 0` (1745); kobling kun via e-post-match (1388-1389,403) | «Nytt galleri» (alltid synlig) forhåndsutfylt | «Nytt galleri»-handling → `POST .../galleries` m/ kundedata; koble via `project_id`/`customer_id` |
| 37 | medium/small | «Åpne» tar ham til KLIENT-visningen, ikke fotograf-administrasjon | `window.open(g.shareUrl)` (1564,1843) = public klient-lenke (`buildGalleryShareUrl`); rikere admin-endepunkter (572,883,1049,262) lenkes aldri; admin-side finnes (`photographer-gallery-detail.tsx`) men ikke wired | «Åpne»→admin-visning; egen «Forhåndsvis som klient» | Skill handlingene: «Administrer» → intern detaljside; «Forhåndsvis» → `window.open(shareUrl)` |

### Faktura / oppfølging

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 9 | high/large | Bryllupet levert — ingen «Lag faktura»/«Send faktura» noe sted i CRM | `UniversalCRMDashboard.tsx` 0 invoice-referanser; `universal-crm-routes.ts` ingen invoice-endepunkt; CRM og billing er disconnected øyer (quotes/invoices kobler til fiken/tripletex-id, aldri `crm_customers.id`) | Faktura fra kortet/kontrakt m/ MVA, forfall, online-betaling, sporet tilbake | `Faktura`-handling + per-kunde fakturaliste, eller bro til wedding-invoice via `client_id` |
| 10 | high/medium | Ser «Beløp 25000» men aldri om kunden HAR betalt / hvor mye gjenstår | Kunde = single `budget` float; kontrakt-status enum (`79-93`) har INGEN paid/partial; dialog viser kun `Status • Beløp` (1952); `/stats` summerer kun `crm_deals.value` (uten writer) | Per-oppdrag: contracted/deposit/paid/balance/due + status-badge | Innfør betalings-felt på kontrakt/faktura; render status-chip; regn utestående-AR i `/stats` |
| 11 | high/small | Topp-tellerne viser ingen kroner; eneste «Total inntekt»-kort er gated til musikkprodusenter | `primaryMetrics` 674-699 er rene tellere; «Total inntekt»-kort (1134-1136) inni `isMusicProducer`-blokk; backend regner allerede `stats.deals.totalValue` (`364-399`) men frontend ignorerer det | Minst én penge-KPI (inntekt + utestående-AR) for alle | Profesjons-agnostiske revenue/AR-kort fra `stats.deals.totalValue`; ikke skjul bak musikk-branch |
| 12 | high/small | Oransje chip «3 betalt» — trodde 3 fakturaer; egentlig antall bildekjøp i galleri | `totalPaid`/`paidCount` fra `client_image_payments` succeeded-rows (`110,161`); chips 1554/1835 er eneste «betalt»-signal i CRM | «betalt» = oppgjort faktura, eller eksplisitt «bildekjøp» | Re-label til «{n} bildekjøp»; egen reell betalings-status-chip senere |
| 38 | medium/medium | Etter levering+betaling er kunden «ferdig» — ingen anmeldelse/takk/gjenbestilling | Ingen review/anmeldelse/takk/rebook i CRM eller SmartWorkflowSystem; `mark-complete` trigger ingen oppfølging; EmailCRMBridge har riktige templates men er orphaned (0 importører) | Be om anmeldelse, send takk, seed 1-års-påminnelse | Etter-levering-panel («Be om anmeldelse»/«Send takk»/«Planlegg gjenbestilling») wired til e-post; auto-trigger ved ferdig+betalt |
| 43 | low/trivial | Kontrakter-dialogen (nærmeste billing) montert to ganger | Identiske `<Dialog open={showContractsDialog}>` på 1885 + 2304/2305 (samme `customerContracts` → ingen data-divergens) | Én instans | Slett duplikat-blokken (~2304) |

### Orientering / feedback

| # | Sev/Effort | Hva Simen opplever | Bevis | Forventet | Foreslått fix |
|---|-----------|--------------------|-------|-----------|---------------|
| 40 | medium/small | Ingen suksess/feil-toast på NOEN mutasjon | Alle fire mutasjoner kun `onSuccess`, 0 `onError`; `use-toast`+notistack brukt i ~98 andre filer; feil → `console.warn/error` (557,580,1708,1862,2148,1735,1923,2343) | Synlig snackbar ved suksess/feil per mutasjon | Importer `useToast`/`enqueueSnackbar`; legg `onError`+suksess-toast på alle; erstatt console-blokker |
| 14/22 | high–medium/small | «{n} synlige kunder» lyver — filtrerer kun innlastet side | Søk server-side (`344-350`), statusfilter klient-side (`665-668`); LIMIT 100; `/stats` har de SANNE per-status-tallene rett ved siden av | Status server-side eller tydelig kommuniser «kun innlastede» | Send `statusFilter` som query-param; bruk `total` fra respons; fjern klient-filter |
| 15 | high/small | «Link event» — dialogen lukkes som om noe skjedde; borte ved neste innlogging | Symptom REELT, mekanisme korrigert: `onLinkToEvent` POSTer til `/events/:id/relations` som IKKE finnes → 404 svelges i `try{}catch{}`, suksess-toast fyrer uansett (false positive) | Persistér + ekte suksess kun ved bekreftet skriving | Bygg manglende endepunkt; ikke fyr suksess-toast før bekreftet persistens; ikke svelg fetch-feil |
| 41 | medium/small | Duplikat-kunde kan ikke slettes — ingen Slett/Arkiver på kortet, ingen bekreftelse | Kort-handlinger 1623-1758 ingen Slett/Arkiver; 0 `confirm()`-treff; `DELETE` finnes (`universal-crm-routes.ts:316`, HARD delete) men er uoppnåelig | Slett/Arkiver m/ bekreftelse + toast | DeleteOutline → bekreftelses-Dialog → DELETE via useMutation + toast; «Arkiver»-snarvei |
| 42 | medium/small | Rediger med tomt firma → lagrer «pent», men navn blir `, ` eller beholder gammelt — ingen kvittering | Ukontrollerte inputs `defaultValue={...|| ', '}` (2166-2190) lest via `document.getElementById`+FormData (2202-2211); ingen validering; ingen toast | Kontrollerte felt, `''`-default, required-validering, toast | Konverter til `useState`-felt m/ validering; fallback `''`; `onSuccess`/`onError`-toast |
| 44 | low/small | «Marker ferdig» — knappen forblir grønn, status «Aktiv» en stund; trykker igjen | onClick 1852-1864 uten pending/optimistisk; galleries useQuery `refetchInterval: 30_000` (390); feil → `console.warn` | Disabled under kall + umiddelbar status-flipp + toast | Gjør til `useMutation` m/ isPending-disable + onSuccess/onError-toast + optimistic update |

## 4. Tverget UX-prinsipp-brudd

| Mønster | Hvor det manifesterer seg | Effekt på Simen |
|---------|---------------------------|-----------------|
| **Manglende tilbakemelding (systemisk)** | #5, #13, #18, #21, #28, #29, #30, #34, #39, #40, #44 — alle fire CRM-mutasjoner mangler `onError`; ingen toast tross at ~98 andre filer bruker `use-toast`/notistack | «Skjedde det noe? Frøs den?» — dobbelttrykk-risiko, tap av tillit, stille feil han aldri ser |
| **Illogisk/brutt flyt** | #20 (status begravd i Rediger), #26 (booking endrer aldri status), #15 (false-positive suksess på 404), #32 (kan booke fortid) | Pipelinen reflekterer ikke virkeligheten; tellere stemmer ikke; han stoler på data som ikke ble lagret |
| **Døde funksjoner / orphaned kapasitet** | #2, #3, #9, #24 (deals/tasks/pipeline-stages/quote-modul/EmailCRMBridge har fullt backend men 0 frontend-konsument); #41 (`DELETE`-endepunkt uoppnåelig) | Kjernefunksjonalitet finnes i koden, men ikke der Simen jobber → må forlate CRM-en eller kan ikke nå funksjonen i det hele tatt |
| **Tomme/villedende tilstander** | #16 (lover ikke-eksisterende skjema), #11 (penge-KPI gated til musikk), #12 («betalt» = bildekjøp, ikke oppgjør), #23 (engelsk rådata vs norske etiketter), #14 («synlige kunder» lyver) | Empty-state og chips kommuniserer feil; samme steg har to navn; han tror han har fått oppgjør han ikke har |
| **Data-tap/-korrupsjon** | #4 (event-dato+depositum tapes), #17 (lead-source tapes), #19/#42 (`,`/`, ` skrives inn i felt), #29 (Meet-lenke kastes) | Kontrakter ubrukelige som avtaler; ROI-attribusjon umulig; korrupte navn/nettside-felt |

Tverrgående: appen har all infrastruktur (toast-system, backend-API-er, ferdige UI-komponenter) — gapene er nesten utelukkende **wiring og feedback**, ikke manglende byggekloss.

## 5. Anbefalt rekkefølge

For at Simen skal kunne kjøre business ende-til-ende, bygd i avhengighets-/ROI-rekkefølge:

1. **Toast-baseline (#40 + #5/#21/#28/#29/#34/#39/#44).** Billigst, høyest tillits-gevinst. Importer `useToast`, legg `onError`+suksess-toast på alle mutasjoner, vis Meet-lenken. Fikser ~halvparten av «vet ikke hva som skjer»-gapene på én liten innsats.
2. **Rydd opp i korrupsjon og duplikat (#13/#27/#43, #19, #42, #4-dataflyt).** Slett duplikat-kontrakt-dialogen, fjern `','`/`', '`-fallbacks, send event-dato til kontrakt. Lav effort, stopper aktiv data-skade.
3. **Pipeline + status-flyt (#2, #20, #22/#14, #26, #23).** Wire opp status server-side, inline status-velger, board-visning, auto-status ved booking. Gir Simen *oversikt* — kjernen i et CRM.
4. **Tilbud → kontrakt → signatur (#3, #25, #4-skjema).** Koble det orphaned quote-modulet til kortet; deep-link draft til Kontraktsenter for signering. Lukker «hvordan booker jeg henne».
5. **Penger: faktura + betalings-status + depositum (#9, #10, #11, #12, #6).** Det største løftet, men det som skiller CRM fra register. Begynn med å vise eksisterende `stats.deals.totalValue` (#11, nesten gratis) og re-label «betalt»-chip (#12), deretter bygg fakturering og depositum-gate.
6. **Levering fra kortet (#33, #36, #37, #35, #34).** «Send til klient», «Nytt galleri», skill admin/klient-visning, vis favoritter/kommentarer.
7. **Scheduling-synlighet (#7, #8, #31, #32).** Agenda/kommende møter, shotliste-kobling, påminnelser.
8. **Vekst-loop: lead-intake + etter-levering (#1, #16, #17, #38).** Auto-inntak, lead-source, anmeldelse/takk/gjenbestilling. Høyest langsiktig ROI, men avhenger av at kjernen over står.

---

**Merknad:** 2 kandidat-gap ble avkreftet under verifisering — #15 (mekanismen «in-memory bus no-op» var feil; ekte årsak er manglende `/events/:id/relations`-endepunkt + svelget 404 + false-positive toast) og deler av #3/#4/#9/#26 (kapasitet finnes i andre flater enn antatt, så framingen «finnes ikke» ble nedjustert til «ikke wired til CRM»). Symptomene Simen opplever er likevel reelle i alle tilfeller.
