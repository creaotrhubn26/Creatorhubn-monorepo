# 11. Score-modell v1 — GEO Opportunity Score (fase 3)

Dato: 2026-07-12. Bygger på innsiktsmotor-spec-en (doc 10, fase 3):
konfigurerbare faktormodeller erstatter LLM-frihånd i prioritering.
Dette dokumentet ER forslaget Daniel redigerer — vektene under er
startpunkt, ikke fasit.

## Beslutningen modellen støtter

**«Hvilket tema prioriterer vi GEO-/innholdsinnsats for neste uke?»**

Én modell, én beslutning. Vertikal-satsing, kampanjebudsjett osv. er
ANDRE beslutninger som ev. får egne modeller senere — ikke denne.

## Formelen

```
score(tema) = Σ  faktor_i (0–1) × vekt_i     → 0–100
              i med data

dekning = vektandel med data (vises ALLTID sammen med scoren)
```

**No Fake Scores** (samme redelighet som No Fake Insights):

- Manglende faktor = null med begrunnelse — aldri stille 0 eller 0.5.
  Vekten omfordeles til faktorene som har data; dekningen synker og
  vises. En score på 80 med 40 % dekning skal leses som usikker.
- Hver faktor bærer evidens (signal-/kjørings-referanser); panelet
  dekomponerer enhver score til faktorbidrag.
- FORSLAG-merket står i UI til org-en lagrer egne vekter
  (`score_model_config.approved`).

## Faktorene og forslags-vektene

| # | Faktor | Vekt (forslag) | Kilde | Begrunnelse for vekten |
|---|---|---|---|---|
| 1 | **Tomrom** — andel AI-svar uten målmerket | 25 | geo_probe_results | GEO-strategiens kjerne: størst rom der vi er usynlige og det spørres |
| 2 | **Åpenhet** — 1 − sterkeste konkurrents svarandel | 15 | geo_probe_results | Spotlight-dominert casting er tyngre å ta enn ubesatt utdanning |
| 3 | **Etterspørsel** — søkevolum koblet via ord-overlapp | 20 | Keyword Planner / Trends-import | Tomrom uten etterspørsel er verdiløst; dokumentert volum skiller |
| 4 | **Momentum** — endring i samtale-volum mellom målinger | 10 | to siste geo-kjøringer | Ung datakilde (krever 2 målinger) → lav vekt inntil kalibrert |
| 5 | **Trafikk-bevis** — ekte GA4/GSC på lignende temaer | 10 | normalized_signals | Eneste ikke-syntetiske faktoren i dag; lav vekt fordi koblingen er grov |
| 6 | **Kommersiell verdi** — din verdsetting per sett (1–10) | 20 | settes i UI | Kan ikke beregnes: en Leadgrid-storkunde ≠ en danseelev. **Må settes av deg** |

Normalisering: volum på log-skala (100 → ~0.33, 10k → ~0.67);
momentum ±100 % → hele 0–1-skalaen; tema-kobling er deterministisk
ord-overlapp (ingen stemming, ingen LLM — dokumentert begrensning:
«pris» matcher ikke «prisliste»).

## Hva Daniel gjør

1. Åpne **Muligheter**-panelet i MI → tannhjulet.
2. Juster vektene til de speiler strategien (grovt er godt nok).
3. Sett kommersiell verdi per prompt-sett (1–10, relativt).
4. Lagre → FORSLAG-merket forsvinner; modellen er din.

Ingen deploy — vektene bor i `score_model_config` (0382) og valideres
med Zod (kun kjente faktorer, 0–100, minst én vekt > 0).

## Kalibrering (fase 4)

Når Leadgrid har won/lost-data: sammenlign score ved anbefalings-
tidspunkt med faktisk utfall, og juster vektene mot det som predikerte.
Da slutter modellen å være en mening. Frem til da er vektene en
dokumentert hypotese — det er hele poenget med å ha dem eksplisitte.

## Kjente begrensninger i v1 (bevisste)

- Etterspørsel/trafikk-bevis vil ofte mangle til Trends-alpha godkjennes
  eller Keyword Planner-cachen fylles for relevante søkeord — det VISES
  som manglende, det gjettes ikke.
- Momentum er null til måling #2 (mandag) — fylles automatisk.
- Tema-kobling via ord-overlapp er grov; alternativet (LLM-kobling)
  bryter determinismen og er bevisst valgt bort i v1.
