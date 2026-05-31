# Photoshop-kobling — kom i gang (for Irene)

Slik kobler du Post Agent til Adobe Photoshop slik at appen kan styre Photoshop direkte fra naturlig språk. Tar ca. 10 minutter første gang.

## Du trenger

- Adobe Photoshop 2022 (versjon 23) eller nyere — sjekk via **Photoshop → Om Photoshop**
- Adobe Creative Cloud-konto (samme som du bruker for å installere Photoshop)
- Post Agent installert og åpen

## Steg 1 · Installer Adobe UXP Developer Tool (engangs-jobb)

Dette er det eneste eksterne verktøyet du trenger. Det er gratis.

1. Åpne **Creative Cloud Desktop** (samme app du installerer Photoshop fra)
2. Klikk **Apps** øverst → søk etter "**UXP Developer Tool**"
3. Klikk **Installer**
4. Når installasjonen er ferdig: åpne UXP Developer Tool

Hvis du ikke finner det i Creative Cloud: [direktelenke til guide hos Adobe](https://helpx.adobe.com/creative-cloud/help/install-uxp-developer-tool.html).

## Steg 2 · Last Post Agent Bridge-pluginen

1. **Åpne Photoshop** og lag en ny fil (File → New → OK med standard innstillinger). Du trenger ett åpent dokument for at pluginen skal kunne lastes.
2. Bytt til **UXP Developer Tool**
3. Klikk **Add Plugin…** øverst til høyre
4. Naviger til: `apps/post-agent-photoshop-plugin/manifest.json` i Post Agent-prosjektmappen
5. Velg fila → den dukker opp som "Post Agent Bridge" i listen
6. Klikk **Load** på samme rad (eller **Load & Watch** for auto-reload ved kodeendringer)

Pluginen er nå aktiv i Photoshop. Du finner den under **Plugins-menyen → Post Agent Bridge** eller **Window → Extensions (UXP) → Post Agent Bridge**.

## Steg 3 · Verifiser at alt fungerer

Det viktigste steget. I Post Agent:

1. Klikk **tannhjul-ikonet** øverst til høyre
2. Velg **Helse-sjekk Photoshop…**
3. Klikk **Kjør helse-sjekk**

Du skal se en grønn banner som sier:

> ✓ ALT FUNGERER — 8 av 8 sjekker grønne

Hvis noe er rødt, står det en **Fix:**-tekst under hver feilet sjekk som forteller deg hva du må gjøre.

## Hva du kan gjøre nå

Når helse-sjekken er grønn, har du fire nye verktøy i tannhjul-menyen:

| Verktøy | Hva det gjør |
|---|---|
| **Photoshop Bridge…** | Manuell testing av enkelt-kommandoer (ping, åpne fil, eksporter, etc.) |
| **Photoshop Templates…** | Pek på en `.psd` med `{{key}}`-navngitte layers → fyll feltene → eksporter automatisk |
| **🎨 Photoshop Agent…** | Skriv naturlig språk ("åpne template-X, sett title til 'Test', eksporter som JPG") og la AI gjøre jobben |
| **PSD-galleri…** | Visuelt galleri over `.psd`-filene i en mappe — uten å åpne dem i Photoshop |

## Templater — slik gir du Post Agent kontroll

Magi-en oppstår når du lager templater Post Agent kan fylle. Slik gjør du det:

1. Lag en ny PSD i Photoshop
2. Gi text-layers navn som `{{title}}`, `{{subtitle}}`, `{{date}}` — disse blir tekst-felter i Post Agent
3. Gi smart-object-layers (bilder du har dratt inn med File → Place Embedded) navn som `{{poster}}`, `{{logo}}` — disse blir bilde-felter
4. Lagre PSD-en et sted

Når du åpner **Photoshop Templates…** i Post Agent og peker på fila, skanner den automatisk alle `{{key}}`-felter og lager et skjema du fyller inn. Originalen røres aldri — Post Agent åpner kopien, fyller, eksporterer, og lukker uten å lagre.

## Vanlige problemer

**Pluginen viser "Headless mode has no photoshopAction"** → Photoshop hadde ikke et dokument åpent da pluginen lastet. Lag et nytt dokument og **Reload** pluginen i UDT.

**Helse-sjekken sier "Plugin ikke tilkoblet" selv om jeg har klikket Load** → Sjekk at panelet "Post Agent Bridge" faktisk er synlig i Photoshop (Plugins-menyen). Hvis ikke, gå tilbake til UDT og klikk Load på nytt.

**Helse-sjekken sier "Token utløpt"** → Klikk på "Token utløpt"-pillen i Post Agent øverst og logg inn på nytt via Role Room.

**Helse-sjekken sier "schemaDegraded — migrate venter"** → Render-deployen har ikke kjørt migrasjonen ennå. Ikke kritisk — appen fungerer fortsatt, profession-feltet vises bare som tomt inntil migrasjonen er fullført.

**Smart-object-replace feiler** → Layer-en må ALLEREDE være et smart object (Photoshop's høyreklikk → "Convert to Smart Object" hvis ikke). Vanlige raster-layers støttes ikke for replace.

## Hvis ingenting fungerer

1. Quit Photoshop helt (cmd+Q)
2. Quit Post Agent helt (cmd+Q)
3. Start Post Agent først
4. Start Photoshop
5. Reload pluginen i UDT
6. Kjør helse-sjekken på nytt

Hvis fortsatt ikke fungerer, send skjermbilde av helse-sjekken til Daniel.
