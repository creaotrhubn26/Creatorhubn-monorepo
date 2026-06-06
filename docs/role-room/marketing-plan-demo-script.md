# Demo-manus — Innholdsprodusent «Stig»: fra brief til markedsplan med innhold

> Manus for en demo-video (~3–4 min) som viser content-producer-flyten i The
> Role Room, med vekt på markedsplanen og det nye arbeidet: stående Markedsplan-
> fane, beskrivende genererings-fremdrift, thumbnails i kalender/tabell, og
> klient-speiling. PR #45.

**Format:** skjermopptak med voiceover (norsk). 16:9, 1280×720+.
**Hovedperson:** Stig, innholdsprodusent/digital markedsfører. Kunde: Northwind Drilling. Klient-kontakt: Helene Nygard.

**Forutsetning for en KOMPLETT video (ekte innhold + thumbnails):** kjør mot et
miljø med **innlogget backend** (Role Room Agent-tilgang + en plan med
preview-content). I den backend-frie e2e-harnessen vises UI-flatene og tomme-
tilstandene, men ikke ekte AI-generert plan/thumbnails — de krever backend.

---

## Scene 1 — Åpning (0:00–0:20)
- **Visuelt:** Harness lastes (`e2e-casting-test.html?session=content-producer`), «Nytt prosjekt» → «Last demo» → Northwind-prosjektet opprettes.
- **Narrasjon:** «Stig er innholdsprodusent. Han starter et nytt kundeprosjekt for Northwind Drilling — her med ferdig demo-data: klient, team og lokasjon.»
- **Highlight:** prosjektet åpnes i content-producer-modus.

## Scene 2 — Workflow-stepperen (0:20–0:45)
- **Visuelt:** Pek på stepperen øverst: Brief → Story → Storyboard → Klient → **Levering** → **Økonomi**.
- **Narrasjon:** «Hele arbeidsflyten er én rød tråd. Brief, story og storyboard hukes av etter hvert som klienten godkjenner. Og — nytt — Levering og Økonomi kan nå markeres fullført, så stepperen aldri ser uferdig ut når jobben faktisk er gjort.»
- **Highlight:** klikk Levering → vis fullføring-baren under stepperen → «Marker levering som fullført» → grønt ✓.

## Scene 3 — Markedsplan-fanen (0:45–1:20)
- **Visuelt:** I produsentens arbeidsområde, naviger til den nye **Markedsplan**-fanen (seksjon «Markedsføring»).
- **Narrasjon:** «Markedsplanen er nå en stående fane — ikke noe som forsvinner inne i en dialog. Den er der uansett om en plan er generert ennå.»
- **Highlight:** tom fane viser «Generer en plan med 30 dagers innholdsforslag» + knapp.

## Scene 4 — Generering med fremdrift (1:20–2:00)
- **Visuelt:** Klikk «Generer plan» (i Agent-dialogen) ELLER «Generer 30 posts nå».
- **Narrasjon:** «Når jeg genererer, ser jeg faktisk hva som skjer — ikke bare en spinner. Den leser research-en, definerer innholdspillarer, setter kanalstrategi og KPI, og bygger 30-dagers-rammeverket.»
- **Highlight:** den beskrivende fremdriften (stegene tikker av: «Leser research…», «Definerer pillarer…», «Setter sammen rammeverk…»).
- *(Backend kreves for ekte generering. I harness: vis fremdrifts-komponenten + tom-tilstand.)*

## Scene 5 — Planen + thumbnails (2:00–2:50)
- **Visuelt:** Plan-dashboardet: pillars, KPI, post-tabell. Bytt til **kalender-visning**.
- **Narrasjon:** «Når innhold er produsert, ser jeg det visuelt — små thumbnails i både tabellen og kalenderen, med et play-merke for video. Jeg ser umiddelbart hva som er laget og hva som gjenstår.»
- **Highlight:** thumbnails i tabell-radene; bytt til kalender → samme thumbnails per dag; ▶-merke på video-poster.
- **Bonus:** shot listen viser shot-/storyboard-bildene som thumbnails — samme visuelle språk på tvers.

## Scene 6 — Klientens speiling (2:50–3:30)
- **Visuelt:** Klient-portalen (`/client/portal/<token>`) — Helenes visning.
- **Narrasjon:** «Helene ser det samme. Koblede kontoer, publisert innhold gruppert per plattform — med de samme små thumbnailene. Hun kan koble kontoer selv, gi og trekke tilbake tilgang, og laste opp logo og brand-filer rett inn til Stig.»
- **Highlight:** publisert-innhold-kort med thumbnails; «Koble til»-knapper; «Send filer til produsenten».

## Scene 7 — Avslutning (3:30–3:50)
- **Narrasjon:** «Fra brief til ferdig markedsplan — alt i én flate, speilet for både produsent og klient. Det er The Role Room.»
- **Visuelt:** zoom ut til stepperen med flere ✓.

---

## Opptaks-sjekkliste
1. Dev-server på `localhost:5001`. For ekte innhold: innlogget backend + Role Room Agent-tilgang.
2. Skjerm 1280×720, mørk modus (default).
3. Voiceover etter narrasjonslinjene over.
4. Hold hver scene rolig (2–4 sek per interaksjon) så seeren rekker å følge med.
5. For thumbnails: bruk et prosjekt der minst 3–4 posts har preview-content (Stream-thumbnail).
