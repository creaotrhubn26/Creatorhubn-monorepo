# Leadgrid kunde-onboarding: varslings-kanaler

Denne guiden går gjennom hvordan kunder som tar i bruk Leadgrid setter opp
e-post- og WhatsApp-varsling til sine egne kunder.

Du har **to modeller** å velge mellom. Bestem hvilken i `Innstillinger →
Varslings-kanaler` i Leadgrid Admin Room.

---

## Modell B: Delt nummer (Anbefalt for start) — 3 trinn

**Avsender**: Leadgrid sitt felles WhatsApp Business-nummer (+47 ...).
**Branding**: Din logo + signatur i alle e-poster, ditt navn i WhatsApp-signatur.

### Hva kostnaden er
- E-post: **gratis** (vi tar regningen for Resend i ditt månedsabonnement)
- WhatsApp: **0,15 NOK per melding levert** (vi tar marginal-cost + administrasjon)

### Steg 1 — E-post-branding
1. Last opp logo (PNG/SVG, transparent bakgrunn, ~200×60px)
2. Skriv inn:
   - Bedriftsnavn (vises som «Mvh — [bedriftsnavn]»)
   - Avsender-fullnavn («Anna Hansen»)
   - Tittel («Markedssjef»)
   - Telefonnummer for signatur
   - Reply-to-adresse (kundens svar går hit, ikke til Leadgrid)
3. Velg primær- og aksent-farge
4. Skriv inn footer-adresse (lovkrav for transactional)

### Steg 2 — Verifiser e-post-rendering
Vi sender en test-e-post til admin-adressen i organisasjonen. Sjekk at:
- Logoen vises riktig
- Signaturen er som forventet
- Footer-adressen er korrekt

### Steg 3 — Aktiver
Klikk «Aktiver» — Leadgrid sender heretter alle klient-varsler med din
branding via vårt felles WhatsApp-nummer.

### Hva kunden ser
- **E-post**: ser ut som det kommer fra `<din-adresse>`, signert deg
- **WhatsApp**: ser at det kommer fra «Leadgrid Business», men body
  inneholder din branding og signatur

---

## Modell A: Eget telefonnummer (egen WABA) — 5 trinn

**Avsender**: Ditt eget WhatsApp Business-nummer.
**Branding**: Full kontroll — ditt navn vises som avsender.

### Forutsetninger
- Du eier et telefonnummer som **ikke** er registrert på WhatsApp privat
- Du har en Meta Business Manager-konto (gratis)
- Du har SMS- eller voice-tilgang til nummeret for verifikasjon
- Nummeret er IKKE et fasttelefon eller VoIP som blokkerer SMS

### Steg 1 — Sett opp WhatsApp Business Account hos Meta
1. Gå til **business.facebook.com → WhatsApp Manager**
2. Klikk «Get started» → opprett ny WhatsApp Business Account (WABA)
3. Velg «I want to add a phone number»
4. Skriv inn ønsket nummer (med landskode +47…)
5. Meta sender en verifikasjons-kode på SMS eller voice
6. Skriv inn koden → nummeret er nå registrert som WhatsApp Business

### Steg 2 — Hent dine identifikatorer
Etter at nummeret er registrert, åpne **Meta Business Manager → Settings → WhatsApp accounts → din WABA**:

Du trenger 3 verdier:

| Felt | Hvor det er |
|---|---|
| **WABA ID** | I URLen, eller under «Account info» (er en 16-sifret kode) |
| **Phone Number ID** | I «Phone numbers»-fanen, klikk på nummeret (er en 15-sifret kode) |
| **System User Access Token** | Se under Steg 3 |

### Steg 3 — Generer System User Access Token
1. **Meta Business Manager → Business settings → System Users**
2. Klikk «Add» → navngi system-user som «Leadgrid Integration»
3. Klikk «Add Assets» → WhatsApp Accounts → velg din WABA → gi «Full control»
4. Klikk på system-user → «Generate new token»
5. Velg din Meta-app («Leadgrid» eller liknende)
6. Velg scopes:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. Sett utløp til «Never» (eller 60 dager hvis du foretrekker rotering)
8. **Kopier tokenet** — det vises bare én gang. Ta vare på det.

### Steg 4 — Lim inn i Leadgrid
1. I Leadgrid Admin Room → **Innstillinger → Varslings-kanaler → WhatsApp**
2. Velg «Bruk eget nummer (egen WABA)»
3. Lim inn:
   - WABA ID
   - Phone Number ID
   - Access Token
   - Display-navn (vises i din interne admin, ikke til klienter)
4. Velg primær-språk for templates (nb/en/sv/da)
5. Klikk «Valider»

Vi gjør et `GET`-kall mot Meta for å bekrefte at credentials fungerer.
Hvis du får grønt: gå videre. Hvis rødt: sjekk at:
- Tokenet ikke er utløpt
- System-user har «Full control» på riktig WABA
- Phone Number ID er fra samme WABA

### Steg 5 — Sync Leadgrid-templates til din WABA
Etter validering klikker du «Sync Leadgrid-templates».

Vi POSTer alle 10 templates (5 events × NO+EN) til **din** WABA. Meta godkjenner
typisk utility-templates innen 5-15 minutter.

Når alle er APPROVED kan du begynne å sende klient-varsler fra ditt nummer.

### Hva kunden ser
- **E-post**: ser ut som det kommer fra deg
- **WhatsApp**: ser «ditt firmanavn» som avsender, ditt nummer hvis de
  trykker på profilen

### Vedlikehold
- **Re-generer tokenet** hvis det utløper (Meta varsler deg på e-post)
- **Re-sync templates** hvis du legger til nye event-typer i Leadgrid
- **Sjekk quality_rating** i Meta Business Suite — hvis GREEN er bra

---

## Vanlige spørsmål

**Kan jeg endre fra Modell B → A senere?**
Ja. Aktiver Modell A når du er klar, og fra og med ditt valg sendes
nye varsler fra ditt nummer. Gamle samtaler påvirkes ikke.

**Kan jeg ha samme nummer for både privat WhatsApp og bedrifts-WABA?**
Nei. Meta krever ett nummer = én registrering. Hvis du flytter privat
WA til WABA, mister du privat-funksjonen på det nummeret.

**Hva hvis Meta avviser en template?**
Du ser status i `Innstillinger → Varslings-kanaler → WhatsApp → Templates`.
Hvis REJECTED — vi viser begrunnelsen + tilbyr re-formulering.

**Hva hvis WhatsApp er ned eller mottakeren ikke har WhatsApp?**
Vi sender alltid e-post i SAMME `notifyClient()`-kall hvis kunden har
e-post-opt-in. Det betyr at WhatsApp-fall ikke fører til at klienten
mister varselet.

**Hva med GDPR?**
Vi logger alle utsendte varsler i `client_notification_log` med kun
mottaker-mobil/e-post (ikke innhold). Loggen brukes for audit + dedup.
Mottakeren kan til enhver tid skru av varsling via lenken i e-posten.
