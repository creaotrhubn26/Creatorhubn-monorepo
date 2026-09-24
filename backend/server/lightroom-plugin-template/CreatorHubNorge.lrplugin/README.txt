CreatorHub for Lightroom Classic
================================

Versjon: __CREATORHUB_PLUGIN_VERSION__

Denne pakken er generert direkte fra CreatorHub og er klar til bruk for din konto.
Når pakken installeres av CreatorHub Desk, styres innlogging og utlogging automatisk
av Desk med kortlivede, maskinbundne Lightroom-sesjoner.

Installering
------------
1. Pakk ut denne zip-filen.
2. Åpne Adobe Lightroom Classic.
3. Gå til File > Plug-in Manager.
4. Klikk Add og velg mappen "CreatorHubNorge.lrplugin".
5. Eksporter via File > Export > CreatorHub.

Hva pluginen gjør
-----------------
- laster opp rendrede bildefiler fra Lightroom
- lagrer og verifiserer rendrede filer i privat CreatorHub S3
- binder filene til valgt CreatorHub-prosjekt og Photo Room
- kan lage en ekstra privat Google Drive-speilkopi dersom Drive er koblet
- beholder CreatorHub S3 som autoritativ original selv om Drive-speiling feiler

Denne pakken er konfigurert med:
- API Base URL: __CREATORHUB_API_BASE_URL__
- CreatorHub-konto: __CREATORHUB_ACCOUNT_EMAIL__

Desk-installasjoner inneholder ikke et permanent skytoken. Åpne CreatorHub Desk og
logg inn før eksport. Separate nettleserpakker kan fortsatt bruke et avgrenset plugin-token.
