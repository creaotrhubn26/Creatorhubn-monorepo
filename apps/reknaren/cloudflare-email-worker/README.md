# Reknaren inn-e-post — Cloudflare Email Worker

Gratis inn-e-post-mottak for Reknaren. Cloudflare Email Routing tar imot e-post til
virksomhetenes bilag-adresse (`bilag.<hex>@<domene>`) og kaller denne workeren, som
parser vedleggene og POST-er dem til Reknarens webhook
(`POST /api/inbound/email`). Ingen meldingstak, ingen kostnad.

## Forutsetninger

- Et domene i Cloudflare (gratisplan holder). Anbefalt: bruk et **eget subdomene
  eller domene kun for inn-e-post**, så du ikke fanger ekte e-post (som
  `daniel@…`). Sett Reknarens `REKNAREN_INBOUND_DOMAIN` til nøyaktig dette domenet.
- Reknaren-API-et kjører med `REKNAREN_INBOUND_SECRET` satt.

## 1. Deploy workeren

```bash
cd apps/reknaren/cloudflare-email-worker
npm install
npx wrangler login
npx wrangler secret put REKNAREN_WEBHOOK_URL       # https://<api-host>/api/inbound/email
npx wrangler secret put REKNAREN_INBOUND_SECRET     # samme verdi som API-ens
npx wrangler deploy
```

## 2. Koble Email Routing → workeren

I Cloudflare-dashbordet for domenet:

1. **Email → Email Routing → Get started** (setter MX/SPF automatisk).
2. **Routes → Catch-all address → Edit → Action: Send to a Worker →**
   velg `reknaren-inbound-email`.
3. Har domenet også ekte postadresser? Legg dem inn som **Custom addresses
   FØR** catch-all (spesifikke ruter vinner), så bare bilag-adressene treffer
   workeren.

## 3. Sett domenet i Reknaren

Sett `REKNAREN_INBOUND_DOMAIN` til domenet du aktiverte routing på (f.eks.
`inbound.reknaren.no`). Da blir hver virksomhets adresse
`bilag.<8 hex av org-id>@<domenet>`, som vises i «Kom i gang»-veiviseren.

## 4. Test

Send en e-post med et PDF-vedlegg til en virksomhets bilag-adresse (se veiviseren
eller Virksomhet-fanen). Innen sekunder skal bilaget dukke opp i Bilagsinnboksen
med kilde `forward`.

```bash
# Rask webhook-test uten e-post (erstatt host/secret/adresse):
curl -X POST https://<api-host>/api/inbound/email \
  -H 'content-type: application/json' \
  -H 'x-inbound-secret: <secret>' \
  -d '{"to":"bilag.89b728c3@inbound.reknaren.no","attachments":[{"filename":"kvittering.pdf","contentType":"application/pdf","contentBase64":"JVBERi0xLjQK"}]}'
```

## Slik henger det sammen

```
Leverandør/kunde  ──▶  bilag.<hex>@<domene>  ──▶  Cloudflare Email Routing
                                                        │  (catch-all → Worker)
                                                        ▼
                                                   denne workeren
                                          (postal-mime: plukk PDF/bilde-vedlegg)
                                                        │  POST JSON + x-inbound-secret
                                                        ▼
                                    Reknaren  POST /api/inbound/email
                                    (ruter på mottaker → `forward`-bilag)
```

Merk: gratis-tall og subdomene-støtte i Cloudflare Email Routing kan endre seg;
sjekk gjeldende docs hvis noe avviker.
