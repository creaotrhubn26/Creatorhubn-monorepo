# The Role Room — Location Manager

Oppdatert: 13. september 2026

## Produktløftet

Location Manager skal være produksjonens operative sannhet fra manusbehov og første scout til opptak, wrap og dokumentert tilbakelevering. Hovedmålet er ikke å lagre flest mulig lokasjonskort, men å gjøre det umiddelbart synlig om en lokasjon faktisk er klar, hva som blokkerer den, hvem som eier neste handling og når beslutningen må tas.

## Researchgrunnlag

ScreenSkills beskriver rollen som ansvarlig for manusnedbrytning, research og scout, tillatelser, avtaler, kostnader, teknisk recce, logistikk og endelig bekreftelse av lokasjoner. I Norge finnes ingen samlet nasjonal filmforskrift; behovet for tillatelser varierer etter kommune, myndighet, grunneier, vei, ferdsel og dronebruk. Det gjør en sporbar klareringsmodell viktigere enn en generell oppgaveliste.

Kilder:

- [ScreenSkills — Location manager skills](https://www.screenskills.com/skills-checklists/scripted-film-and-tv/location-department/location-manager-skills/)
- [Norwegian Film Commission — Filming in Norway](https://www.norwegianfilm.com/filming-in-norway)
- [Oslo Film Commission — Filming in Oslo](https://oslofilm.no/filming-in-oslo)
- [Luftfartstilsynet — No-drone zones](https://www.luftfartstilsynet.no/en/drones/no-drone-zones/)
- [Avinor — Drone map](https://www.avinor.no/en/practical-info/drone/dronekart/)

Markedsgjennomgangen av Yamdu, StudioBinder og SetKeeper viser at katalog, kart, media, deling og tilgangskontroll allerede er forventede grunnfunksjoner. Muligheten for å differensiere The Role Room ligger i koblingen mellom disse dataene og en eksplisitt, versjonert produksjonsberedskap.

- [Yamdu](https://yamdu.com/)
- [StudioBinder](https://www.studiobinder.com/)
- [StudioBinder — Locations workflow](https://www.studiobinder.com/tutorials/shoot/intro-to-locations/)
- [SetKeeper — Access rights](https://help.setkeeper.com/en/articles/2961330-what-do-the-different-access-rights-mean)

## Validerte problemområder

1. Informasjon er spredt mellom meldinger, regneark, bilder, kart og dokumenter.
2. Teamet vet ikke alltid hvilken status eller versjon som er gjeldende.
3. Tillatelsesbehov, myndighet og frister varierer fra sted til sted.
4. Eierdialog, tilgjengelighet, restriksjoner og holdfrister følges manuelt.
5. Teknisk recce mangler ofte én samlet sjekkliste og synlig evidens.
6. Endringer i opptaksplanen blir ikke konsekvent sendt tilbake til lokasjonsarbeidet.
7. Primærlokasjonen har ikke alltid en reelt klargjort backup.
8. Feltarbeid krever rask mobilregistrering, også ved svak dekning.
9. Leie, tillatelser, vakthold og tilbakeføring gir sene budsjettavvik.
10. Naboer, trafikk, sikkerhet, nødadkomst og wrap-forpliktelser faller mellom avdelinger.

Brukerdiskusjoner som skal behandles som kvalitativt, ikke representativt, materiale:

- [Location scouting workflow discussion](https://www.reddit.com/r/Filmmakers/comments/1jid3gz)
- [Independent production location challenges](https://www.reddit.com/r/indiefilm/comments/1mfnp9l)
- [Location management workflow discussion](https://www.reddit.com/r/filmmaking/comments/1ld2nph)
- [Permit and owner coordination discussion](https://www.reddit.com/r/Filmmakers/comments/wh4ajp)

## Første vertikale leveranse

Den første leveransen etablerer:

- egne arbeidsflater og rolleprofiler for location manager, location scout og location security;
- porteføljeoversikt med beredskap, blokkeringer og hold som utløper;
- én prioritert neste handling per lokasjon;
- beslutning, eierdialog, dato, teknisk recce og klareringsporter;
- feltlogistikk, risiko, backup og kostnadskontroll;
- mobil og desktop med touchmål på minst 44 piksler;
- servervalidert, prosjektavgrenset og versjonert lagring;
- optimistic concurrency med synlig konflikt i stedet for stille overskriving;
- serverført aktivitetsoppføring ved hver lagring.

## Leveranseplan mot markedsledende arbeidsflyt

### Fase 2 — Scout Capture

- kamera, video, lydprøve, 360-bilder og markering direkte på kart;
- offline kø med tydelig lokal/synkronisert status;
- private medieobjekter i The Role Room sin S3-bøtte via kortlivede signerte URL-er;
- solretning, vær, mobildekning, støy, strøm, parkering og tilgjengelighet som feltmal;
- dublettdeteksjon og søk på manusbehov, geografi og produksjonskrav.

### Fase 3 — Permit Intelligence

- regelsett per jurisdiksjon med ansvarlig myndighet, dokumentkrav og ledetid;
- drone-, vei-, trafikk-, vern-, grunneier- og nabovarsel som separate porter;
- maler for søknad, avtale, forsikring og tilbakelevering;
- fristvarsling og automatisk konsekvens ved endret opptaksdato;
- ingen automatisk godkjenning: bruker må verifisere evidens og ansvarlig instans.

### Fase 4 — Production Graph

- kobling mellom manuslokasjon, kandidater, scene, opptaksdag, call sheet og budsjett;
- endringskonsekvens før en lokasjon, dato eller plan erstattes;
- klargjort backup som kan overta uten å bygge feltplanen på nytt;
- status til 1st AD, produsent, DoP, lyd, transport og sikkerhet uten dobbelregistrering.

### Fase 5 — Owner and Field Portals

- avgrenset eierportal for dato, restriksjoner, dokumenter og signering;
- feltpakke med navigasjon, kontakt, parkering, unit base, load-in og nødadkomst;
- ankomst, avvik, skader, bilder før/etter, wrap og signert tilbakelevering;
- person- og tilgangsstyring per dokument og per lokasjon.

## Researchprogram

Gjennomfør først 12 dybdeintervjuer og observer minst seks reelle scout/recce-økter. Fordel utvalget mellom location managers, scouts, 1st AD, produksjonsledere og location security i reklame, film og serie. Test deretter prototypen over minst 50 aktive lokasjoner.

Mål:

- tid fra manusbehov til første relevante kandidat;
- andel lokasjoner med navngitt neste handling og eier;
- antall sene tillatelses- eller eierblokkeringer;
- tid brukt på statusrapportering og dobbeltregistrering;
- andel primærlokasjoner med klargjort backup;
- avviste eller feilaktige beredskapsforslag;
- tid fra planendring til alle berørte lokasjoner er oppdatert;
- tapte feltregistreringer og synkroniseringskonflikter;
- budsjettavvik og tid til dokumentert wrap.

Ingen analyse skal samle inn manus, private adresser, kontaktdata eller bilder uten uttrykkelig prosjektgrunnlag og korrekt tilgang. Produkttelemetri skal måle arbeidsflyt og systemtilstand, ikke kreativt innhold.
