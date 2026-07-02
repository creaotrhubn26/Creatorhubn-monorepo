# Sports Event Agent (Post Agent)

Ny agent i Post Agent for **høydepunkt-video av sports-arrangement**. Første
mål-event: **Romerikes Råeste** — hinderløp (OCR, Obstacle Course Race), NM i
OCR, Nannestad 15. aug 2026. Men bygd **event-type-bevisst** så samme agent
dekker flere idretter.

> Status: **plan / design** (2026-07-02). Ikke implementert.
> Beslutninger fra Daniel: materiale = multi-cam + (evt.) scoreboard-feed;
> leveranser = **arrangør-highlight FØRST** + social 9:16 per øyeblikk;
> lyd = **kun kamera/ambient**; **ingen** per-deltaker/bib-reels og **ingen**
> tidtaker-data i denne omgangen — det skal være en highlight av eventet.

Filosofi (arvet fra PetKey-lærdommen, se `APPLE_VISION.md` og QC-verktøyene):
**timelinen er fasit. AI foreslår øyeblikk i kantene, mennesket triagerer,
og vi rendrer HELE timelinen i én pass + verifiserer.** Aldri bygg leveransen
utenfor timelinen.

---

## 1. Kjerne-innsikt: en OCR-race har verken scoreboard, klokke eller kommentar

Ballsport har kjente signaler (scoreboard-OCR, kommentator, kampklokke). Et
hinderløp har **ingen** av dem:
- Kameraer står **ved hindrene** (vegg, gjørmekryp, rig, vann) — materialet er
  organisert per *stasjon*, ikke per klokke. Hvert kamera = strøm av
  forskjellige utøvere.
- Lyd er **kun ambient** (ingen kommentar) → publikum-brøl er eneste audio-signal.
- Ingen data-fasit (tidtaker droppet i denne omgangen).

Derfor blir øyeblikks-deteksjonen **visuell + ambient**, ikke data-drevet.

---

## 2. Hva er et høydepunkt i et hinderløp?

| Type | Signal å detektere |
|---|---|
| **Wipeout / fall** | plutselig bevegelse/velt, kropp fra vertikal→horisontal (body-pose), gjørme-/vann-plask (saliency/lyshopp) |
| **Maks innsats / kamp** | henge/klatre-positur, gritt, sakte grinding gjennom gjørme (body-pose + varighet) |
| **Triumf** | armer opp, mållinje-jubel (body-pose «arms raised») |
| **Emosjon** | sterkt ansiktsuttrykk — slit, glede, utmattelse (face capture-quality/uttrykk) |
| **Publikum-energi** | ambient brøl-spike (envelope/RMS) — ofte ved harde hinder + mål |
| **Visuelt slående** | plask, vann, masse-start (bølge av løpere), store hinder |
| **Barn (Råtassen)** | egne, «søte» øyeblikk på barneløypa |

Ingen enkelt signal er nok — **fusjon** gir en rangert kandidat-liste med
tidskode + hvorfor + thumbnail.

---

## 3. Event-profil-arkitektur (nøkkelen til «flere event-typer»)

Én agent, en **profil** definerer alt som varierer. OCR-race er første profil.

| | Ballsport (scoreboard) | **OCR-race (Romerikes Råeste)** | Heat/styrke |
|---|---|---|---|
| Øyeblikk fra | scoreboard-OCR + publikum | **visuelt (fall/innsats/triumf) + ambient-brøl** | heat/forsøk + PR |
| Organisert etter | kampklokke | **hinder-stasjon** | heat/øvelse |
| Leveranse | highlight | **highlight + social 9:16** | per-utøver |
| Identitet | draktnummer | (ikke brukt her — bib-OCR er en senere opsjon) | lane/navn |

Profil = JSON: `{ moment_signals[], organize_by, deliverables[], sport_label }`.

---

## 4. Pipeline (wizard med godkjenn-gater, som øvrige Post Agent-agenter)

1. **Ingest & organiser** multi-cam → grupper per kamera/hinder-stasjon.
   Multi-cam-sync via timecode/tid-på-døgn (audio-sync fallback — `robust_audio_sync`).
2. **Skann for øyeblikk** (per klipp/kamera): visuelle signaler (motion/body-pose/
   face/plask) + ambient-brøl → **rangert kandidat-liste** {kamera, t, type, score,
   hvorfor, thumbnail}. 🔴 Ytelse: sample frames (f.eks. 2–4 fps), ikke hver frame;
   Vision batch i én Swift-prosess.
3. **Menneske-triage** (gate): kontaktark med thumbnails → godkjenn/forkast/ranger
   (samme mønster som `take_ranker`, men for øyeblikk). AI foreslår, du bestemmer.
4. **Bygg highlight** (gate): ordne godkjente øyeblikk, pace til musikk-beats,
   beste vinkel per øyeblikk, overganger → timeline.
5. **Social 9:16 per øyeblikk**: auto-reframe som sporer utøveren gjennom hinderet
   (face/body → Transform-keyframes) — gjenbruk social-vertikal-pipeline + SoMe-lengde-sjekk.
6. **Lyd/musikk-balanse**: ambient under musikk, behold brøl-swells; blokk-ducking
   (`music_duck_balance`).
7. **QC + render hele timeline**: `render_timeline_safe` + `delivery_qc`.

---

## 5. Gjenbruk (mye finnes allerede)

- **Apple Vision-sidecar** (`APPLE_VISION.md`): body-pose (fall/innsats/triumf),
  face capture-quality (emosjon/culling), saliency (plask/blikkfang), auto-reframe 9:16.
- **Audio**: ambient envelope-spikes (publikum-brøl) — samme envelope-teknikk som stemme-arbeidet.
- **Multi-cam sync**: `robust_audio_sync`.
- **Social 9:16**: `svb_*`-pipeline + `some_length_check` + `extract_social_cut`.
- **Balanse**: `music_duck_balance`.
- **Levering**: `render_timeline_safe` + `delivery_qc` (timeline er fasit, AI verifiserer).

---

## 6. Nye scripts som trengs (`scripts/sports/`)

- `event_moment_scan.py` — fusjons-detektor: kjør Vision-sidecar (body-pose/face/
  saliency) + ambient-envelope pr klipp → rangert kandidat-liste + thumbnails.
- `event_profile.py` (evt. bare JSON-profiler) — sport-profil (signaler/organisering/leveranse).
- `build_highlight_timeline.py` — legg godkjente øyeblikk på ny timeline, beste vinkel,
  pace til musikk.
- (Senere) `broll_from_stations.py`, `bib_ocr.py` (per-deltaker-reels som opsjon).

UI: `SportsEventPanel.tsx` i et eget Sports-view — wizard med gater + kandidat-
kontaktark (thumbnails, godkjenn/forkast/ranger) + highlight-preview.

---

## 7. Hva bygges først (MVP)

Skjelett + **steg 2–3**: `event_moment_scan` (visuell + ambient fusjon) →
kandidat-kontaktark → menneske-triage → markører på timelinen. Det er 80 % av
verdien; highlight-bygging (steg 4) + social (steg 5) bygger på markørene.

Krever Apple Vision-sidecaren (`APPLE_VISION.md` steg 1) for body-pose/face —
det er den eneste nye grunnmuren; resten er audio + Resolve-scripting vi har.

---

## Relaterte
- `docs/APPLE_VISION.md` — Vision-sidecar (bib-OCR, body-pose, face, auto-reframe)
- `scripts/social/take_ranker.py` — menneske-i-loop rangering (mønster for triage)
- `scripts/social/render_timeline_safe.py` + `delivery_qc.py` — render hele timeline + QC
- `scripts/social/music_duck_balance.py` — ambient/musikk-balanse
