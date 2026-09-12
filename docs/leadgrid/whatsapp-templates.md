# Leadgrid — WhatsApp utility-templates (Meta Business Suite)

Disse 5 templates må registreres + godkjennes i **Meta Business Suite → WhatsApp Manager → Message Templates** før `notifyClient()` kan sende via WhatsApp.

- **Kategori**: `UTILITY` (transactional, IKKE marketing)
- **Header**: `TEXT` (statisk)
- **Body**: med variabler `{{1}}, {{2}}, ...`
- **Button**: én `URL` med dynamisk path-parameter — peker til klient-portalen

## WABA-kontoen

WhatsApp Business Account ID + Phone Number ID skal allerede være satt på Render som:

- `WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN` (eller `META_APP_ACCESS_TOKEN`)
- `META_WHATSAPP_TEMPLATE_LANGUAGE` (default `nb`)

For multi-tenant: hver organisasjon kan ha egen WABA via `role_room_org_whatsapp_config`. Default-sender = The Role Room's delte WABA.

## URL-button-mønster

Alle templates har én `URL`-button med:

- **Type**: `URL`
- **Dynamic part**: ja
- **Base URL**: `https://leadgrid.theroleroom.com/c/`
- **Button text**: `Åpne portalen` (NO) / `Open portal` (EN)
- **Example**: `https://leadgrid.theroleroom.com/c/abc123xyz`

Vi sender klient-portal-token som dynamisk del.

---

## 1. `leadgrid_deliverable_completed_nb`

**Kategori**: UTILITY  
**Språk**: Norsk (`nb`)  
**Header**: `TEXT`

```
✓ Leveranse klar
```

**Body**:

```
Hei {{1}}!

Leveransen "{{2}}" er nå klar i klient-portalen din.

Du kan se den, gi tilbakemelding eller be om fokus på neste steg når som helst.

— {{3}}
```

**Variabel-eksempler** (kreves av Meta for godkjenning):
- `{{1}}` = `Anna`
- `{{2}}` = `Pixel + GA4 satt opp`
- `{{3}}` = `Leadgrid v/ Daniel`

**Button**: URL `Åpne portalen` → `https://leadgrid.theroleroom.com/c/{{1}}`

---

## 2. `leadgrid_focus_request_received_nb`

**Kategori**: UTILITY  
**Språk**: Norsk (`nb`)  
**Header**: `TEXT`

```
Vi har mottatt fokus-ønsket ditt
```

**Body**:

```
Hei {{1}}!

Vi har mottatt fokus-ønsket ditt på {{2}}.

Rådgiveren din tar kontakt innen 1 virkedag for å sette i gang. Du kan følge fremdriften i portalen.

— {{3}}
```

**Variabel-eksempler**:
- `{{1}}` = `Anna`
- `{{2}}` = `Pixel-oppsett, Google Ads-tracking`
- `{{3}}` = `Leadgrid v/ Daniel`

**Button**: URL `Åpne portalen` → `https://leadgrid.theroleroom.com/c/{{1}}`

---

## 3. `leadgrid_score_changed_nb`

**Kategori**: UTILITY  
**Språk**: Norsk (`nb`)  
**Header**: `TEXT`

```
Markeds-scoren din har endret seg
```

**Body**:

```
Hei {{1}}!

Markeds-scoren din gikk fra {{2}} til {{3}}.

{{4}}

Åpne portalen for å se hvilke signaler som bidro.
```

**Variabel-eksempler**:
- `{{1}}` = `Anna`
- `{{2}}` = `62`
- `{{3}}` = `74`
- `{{4}}` = `Det er en økning på 12 poeng — godt jobbet!`

**Button**: URL `Åpne portalen` → `https://leadgrid.theroleroom.com/c/{{1}}`

---

## 4. `leadgrid_new_finding_nb`

**Kategori**: UTILITY  
**Språk**: Norsk (`nb`)  
**Header**: `TEXT`

```
Nytt funn i markedsanalysen
```

**Body**:

```
Hei {{1}}!

Vi har et nytt funn i markedsanalysen din:

*{{2}}*

{{3}}

Åpne portalen for å se hele anbefalingen.
```

**Variabel-eksempler**:
- `{{1}}` = `Anna`
- `{{2}}` = `Konkurrenten din kjører Meta-annonser`
- `{{3}}` = `Vi har lagt en anbefaling i portalen din.`

**Button**: URL `Åpne portalen` → `https://leadgrid.theroleroom.com/c/{{1}}`

---

## 5. `leadgrid_monthly_report_nb`

**Kategori**: UTILITY  
**Språk**: Norsk (`nb`)  
**Header**: `TEXT`

```
Månedsrapporten din er klar
```

**Body**:

```
Hei {{1}}!

Månedsrapporten din for {{2}} er klar.

Denne måneden: {{3}}

Åpne portalen for å lese hele rapporten.
```

**Variabel-eksempler**:
- `{{1}}` = `Anna`
- `{{2}}` = `mai 2026`
- `{{3}}` = `Se hele rapporten i portalen.`

**Button**: URL `Åpne portalen` → `https://leadgrid.theroleroom.com/c/{{1}}`

---

## English variants

Repeat all 5 templates med suffix `_en` og engelsk-tekstene fra `leadgrid-whatsapp-templates.ts`. Variabel-strukturen er identisk.

### Naming-konvensjon

- `leadgrid_deliverable_completed_en`
- `leadgrid_focus_request_received_en`
- `leadgrid_score_changed_en`
- `leadgrid_new_finding_en`
- `leadgrid_monthly_report_en`

---

## Etter godkjenning

1. Bekreft at template-navn matcher fullName i `backend/server/leadgrid-whatsapp-templates.ts`
2. Sett `META_WHATSAPP_TEMPLATE_LANGUAGE=nb` (eller `en`) på Render hvis du vil overstyre per-org default
3. Test: `POST /api/superadmin/notification-prefs/{customerId}/test` — sender `new_finding` til kunden

## Outside-window-fallback

WhatsApp tillater fri-form-sending i 24 timer etter kundens siste innkommende melding. Vi sender **utelukkende templates**, så vi er innen reglene uavhengig av 24t-vinduet.

Hvis WhatsApp-levering feiler (kunden blokkerte / nummer ikke registrert) → vi har allerede sendt e-post i samme `notifyClient()`-kall. Ingen ekstra fallback nødvendig.
