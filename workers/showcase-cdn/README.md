# showcase-cdn Worker

Cloudflare Worker som proxyer signed Backblaze B2-download-URL-er for UniversalShowcase-galleri som er levert fra B2-arkiv (One Desk-flyten).

## Hva den gjør

- Tar request på `creatorhubn.com/api/showcase/cdn/<gallery-token>/<item-id>`
- Henter signed B2-URL fra backend (kort TTL)
- Fetcher fra B2 via Bandwidth Alliance ($0 egress)
- Streamer tilbake med 30-dagers cache-headere
- Cloudflare CDN cacher → andre visning er ren cache-hit, ingen B2-hit

## Hvorfor

Backblaze + Cloudflare Bandwidth Alliance gir gratis egress fra B2 til
Cloudflare CDN. Uten dette ville fotografer betale $10/TB egress når
klienter ser galleriet.

Detaljer i `apps/creatorhub-one-desk/docs/showcase-from-archive-plan.md`.

## Lokal dev

```bash
cd workers/showcase-cdn
npm install
npx wrangler dev --remote
```

Test:
```bash
curl http://localhost:8787/api/showcase/cdn/gly_test/pci_test
```

## Deploy

```bash
npx wrangler deploy
```

Etter første deploy må Cloudflare Dashboard konfigureres med route:
- Route pattern: `creatorhubn.com/api/showcase/cdn/*`
- Zone: `creatorhubn.com`
