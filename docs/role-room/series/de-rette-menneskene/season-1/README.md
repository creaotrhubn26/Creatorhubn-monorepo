# De rette menneskene — Sesong 1

Storyboardmateriale for The Role Room-produksjonen om The Role Room.

## Live-prosjekt

- Prosjekt-ID: `de-rette-menneskene-sesong-1-2026`
- Manusepisoder: `de-rette-menneskene-sesong-1-2026-episode-01` til `-episode-08`
- Omfang: 8 episoder, 24 scener og 56 shots
- Live-kobling: hvert shot har sin egen `imageUrl` og `imageSource = generated_storyboard_frame`
- Episode-moodboard: det komplette syvrutersarket for episoden

## Filer

- `episode-XX-<tittel>-storyboard.png`: komplett syvruters episodeark, 1672 × 941
- `frames-drawn/episode-XX-<tittel>-shot-YY.png`: selvstendig håndtegnet 16:9-frame, 1672 × 941
- `frames/`: tidligere utsnitt fra episodearkene, beholdt som produksjonshistorikk
- Det finnes 8 episodeark og 56 selvstendige håndtegnede frame-filer.

Shot-rekkefølgen følger scene- og frame-rekkefølgen i manusdataene i Storyboard Room. Hver episode har nøyaktig syv unike frame-bilder.

## Visuell retning

Bildene er generert med den innebygde imagegen-modusen. Promptsettet komponerer:

- profesjonell monokrom produksjons-storyboard
- Story Pencil med selektiv Story Hatch
- trygg grafittkonstruksjon, kontrollert krysskravering og synlig papirstruktur
- klare silhuetter, lesbar blocking og dokumentarisk filmfotografi
- faste karakterankere på tvers av episodene
- egne scene-, shot-, kamera-, lys- og kontinuitetsinstruksjoner per episode
- ingen polert concept-art-finish

Flater som skal vise produktet er bevisst tomme registreringsflater med svært diskrete fiolette merker. Ekte The Role Room- og Storyboard Room-grensesnitt skal compositeres inn senere; AI-generert produkt-UI skal ikke brukes.

## Redigering

Panelbildet er den redigerbare rasterbasen i Storyboard Room, ikke bare et låst
referanseunderlag:

- blyant, tusj, markør, skygge og øvrige pensler endrer den kompositerte framen
- viskelær, knagummi og lysløft fjerner også piksler fra panelbildet
- undo/redo beholder den opprinnelige kilden og spiller bilde + strøkhistorikk på nytt
- iPad, Role Room-board, thumbnails og PDF/PNG/animatic bruker samme resultat
- valg av en pensel aktiverer tegneverktøyet direkte

## Verifisering

Live-verifisert 27. august 2026 mot `https://theroleroom.com`:

- 8 av 8 episoder lest tilbake
- 7 av 7 unike bilder per episode
- 56 av 56 storyboard-frames utfylt
- målrettet iPad-simulatortest: 1 test, 0 feil
- pikseltest for viskelær mot originalbilde og eksport: 1 test, 0 feil
