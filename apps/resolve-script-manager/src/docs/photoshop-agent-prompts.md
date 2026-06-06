# Photoshop Agent — prompts du kan kopiere

Ferdigskrevne prompts du kan kopiere direkte inn i **🎨 Photoshop Agent…** i Post Agent. Agenten kaller Photoshop-funksjonene for deg via Claude.

Bytt ut `[stiene-mine]` med dine egne absolutte fil-stier (start med `/Users/...`).

## Komme i gang — enkle prompts

**Sjekk at agenten ser dokumentet:**
```
Hvilket dokument er åpent i Photoshop akkurat nå?
Si meg dimensjoner, navn og alle layers du ser.
```

**Åpne en fil:**
```
Åpne /Users/[navn]/Desktop/test.psd og fortell meg hva som er der.
```

**Eksporter aktivt dokument:**
```
Eksporter det aktive dokumentet til /Users/[navn]/Desktop/render.jpg
med JPG-kvalitet 11.
```

## Template-fylling — kjernebrukstilfelle

**Skann + fortell hva som trengs:**
```
Skann /Users/[navn]/Templates/instagram-post.psd og fortell meg
hvilke felter jeg må fylle ut.
```

**Fyll et template og eksporter:**
```
Bruk template /Users/[navn]/Templates/poster.psd:
- title = "Vinterkurs 2026"
- subtitle = "8 uker, gratis prøvetime"
- date = "Start 14. januar"

Eksporter resultatet til /Users/[navn]/Desktop/poster-vinterkurs.jpg
som JPG kvalitet 12.
```

**Bytt smart-object i et template:**
```
Bruk template /Users/[navn]/Templates/album-cover.psd:
- main_photo = /Users/[navn]/Pictures/julie-marius/hero.jpg
- couple_names = "Julie & Marius"
- wedding_date = "23. august 2025"

Eksporter til /Users/[navn]/Desktop/julie-marius-cover.png som PNG.
```

## Batch — flere varianter på en gang

**3 versjoner med ulik tittel:**
```
Bruk template /Users/[navn]/Templates/social-post.psd.
Lag 3 versjoner med forskjellig title-felt:
  1. "Booking åpner mandag"
  2. "Booking åpner tirsdag"
  3. "Booking åpner onsdag"

Eksporter hver som JPG til /Users/[navn]/Desktop/booking-{n}.jpg
(n = 1, 2, 3).
```

**Bytt logo i et template:**
```
Skru av layer "old_logo" og bytt smart-object "new_logo" til
/Users/[navn]/Assets/brand-2026.png i aktivt dokument.
Lagre og eksporter til /Users/[navn]/Desktop/rebranded.jpg.
```

## Mer avanserte oppgaver

**Tøm tekst-felt + eksporter blank-versjon:**
```
I aktivt dokument: sett text-layer "headline" til tom streng,
sett "subtitle" til tom streng, skru av layer "background_image",
og eksporter til /Users/[navn]/Desktop/blank-template.png.
```

**Slå sammen flere assets til én PSD:**
```
Åpne /Users/[navn]/Templates/montage.psd.
Bytt smart-object "photo_1" til /Users/[navn]/Pics/01.jpg
Bytt smart-object "photo_2" til /Users/[navn]/Pics/02.jpg
Bytt smart-object "photo_3" til /Users/[navn]/Pics/03.jpg
Eksporter som PSD til /Users/[navn]/Desktop/final-montage.psd
(jeg vil ha en redigerbar fil, ikke flatet).
```

## Hva agenten kan og ikke kan

**Den kan:**
- Åpne, lagre, eksportere PSD/PSB/JPG/PNG/TIFF
- Bytte innhold i smart-object-layers
- Endre tekst i text-layers
- Skru layers av/på
- Skanne templater for `{{key}}`-felter
- Rendre templater i ett-steg (åpne → fyll → eksporter → lukk uten å lagre)
- Slå sammen flere tool-kall i én flyt (f.eks. "bytt logo OG sett title OG eksporter")

**Den kan IKKE (ennå):**
- Lage nye layers fra scratch
- Tegne, malte, eller manuelle pixel-operasjoner
- Color grading / curves / levels
- Filters (Gaussian Blur, Liquify, etc.)
- Selection-baserte operasjoner (Magic Wand, Quick Select)
- Batch på tvers av flere PSD-er i én operasjon (men du kan be den sekvensielt: "Gjør det samme for filen X også")

Hvis du trenger noe agenten ikke kan, gjør det manuelt i Photoshop og bruk Post Agent kun for utfylling/eksport.

## Tips for gode prompts

- **Vær spesifikk om filsti**: absolutte stier (`/Users/.../...`) — agenten gjetter ikke.
- **Si format eksplisitt**: "som JPG kvalitet 12" eller "som PNG". Ellers spør agenten.
- **Be om scan FØRST hvis du er usikker** på hva templatet inneholder. Da kan agenten lese feltene og foreslå riktige nøkkelnavn.
- **Bruk navn fra layer-panelet**, ikke beskrivelser. "Bytt smart-object 'main_photo'" — ikke "Bytt det store bildet i midten".
- **Si stopp**: hvis agenten gjør noe du ikke ønsker, klikk **Avbryt** i dialogen. Den slutter umiddelbart.
