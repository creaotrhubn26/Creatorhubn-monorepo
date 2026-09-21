# CreatorHub Importsentral – fysisk QA

Denne sjekklisten verifiserer forhold som simulator og enhetstester ikke kan
bevise: faktisk kortleser, iPadOS-bakgrunnstid, strøm, nettverksbytte og store
kamera-/lydfiler. Kilden skal være skrivebeskyttet fra CreatorHubs side gjennom
hele testen. Kortet skal aldri formateres som del av QA.

## Testsett

- Ett kort med JPEG + RAW, MOV/MP4, MXF eller CRM og WAV/BWF.
- Minst én fil større enn 4 GB.
- Én kjent duplikatfil som allerede er importert.
- Én tom eller kontrollert skadet testfil (aldri eneste kopi av et opptak).
- CreatorHub-prosjekt med planlagt kortetikett.

Noter appversjon, iPad-modell/iPadOS, kortnavn, kortleser og ledig lagring før
hver kjøring. Ta skjermbilde av forhåndskontroll og sluttkvittering.

## Obligatorisk avbruddsmatrise

For hvert scenario skal manifest-ID, filstatus før/etter og SHA-256-kvittering
registreres.

1. **Normal import:** importer alle filtypene og kontroller lokal- og
   CreatorHub-verifisering.
2. **Kort trekkes ut:** trekk kortet mens én stor fil står som «Kopierer».
   Originalen skal ikke endres; filen skal bli «Feilet», kjøringen «Pauset».
   Sett inn samme kort og velg rot/DCIM. Ferdige filer skal hoppes over, den
   avbrutte filen skal starte på nytt fra null og verifiseres.
3. **Skjermlås:** lås iPaden under lokal kopi og under opplasting. Kontroller at
   checkpoint beholdes selv hvis iPadOS suspenderer appen.
4. **Tvungen avslutning:** avslutt appen under `.partial`-kopi. Ved oppstart skal
   bare CreatorHubs uferdige `.partial` slettes; kortet og ferdige kopier skal
   være urørt.
5. **Nettverksbytte:** bytt Wi‑Fi → mobilnett → frakoblet → Wi‑Fi. Lokal import
   skal fortsette; skyjobben skal pause og fortsette uten ny opplasting av
   verifiserte objekter.
6. **Lavt batteri:** kontroller varsel under 20 %. Import skal ikke stoppes uten
   brukerens valg.
7. **Nesten full iPad:** bruk en testmengde som bryter 512 MB-reserven. Start
   skal blokkeres før første byte kopieres.
8. **Store formater:** verifiser MXF, CRM og BWF over flere gigabyte. Følg
   minnebruk, bytefremdrift og at appen forblir responsiv i landscape.
9. **Kortvarianter:** gi kortet nytt navn, velg kortrot og deretter DCIM/mappe,
   og prøv to like Canon-kort. Riktig uferdig manifest skal velges.
10. **Kun CreatorHub:** lokal original kan først frigjøres etter bekreftet
    CreatorHub/S3-verifisering. Ved feil skal den lokale originalen beholdes.

## Godkjenningskrav

- «Trygt å fjerne kortet» vises bare når alle valgte kilder er lokalt
  checksum-verifisert.
- Ingen automatisk sletting eller skriving på minnekortet.
- Ingen ferdig fil kopieres eller lastes opp på nytt etter resume.
- Uleselige filer og mangler er synlige både i Importsentralen og kvitteringen.
- Prosjektoversikten viser samme manifest-SHA, byteantall og kortetikett.
- Alle feiltilstander har en ikke-blokkerende «prøv igjen»-vei.
