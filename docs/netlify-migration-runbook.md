# Netlify-migrasjon — runbook (frontend, per-brand deploy-isolasjon)

Flytter frontend-hostingen fra Vercel til Netlify, med **én Netlify-site per brand** slik at en deploy på ett brand ikke kan ta ned et annet (deploy-isolasjon). **Backenden blir på Render** — den er en langtkjørende Express-server (WebSockets, bakgrunns-runnere, køer, puppeteer/playwright) og passer ikke Netlify Functions.

## Arkitektur
- Én host-bevisst frontend (`frontend/`, npm-workspace `creatorhub-frontend`) betjener flere brands via `isRoleRoomDedicatedHost(hostname)` + dynamiske entries i `main.tsx`.
- Alle sites bygger fra **samme repo/`main`** og deler **samme `netlify.toml`** — appen skiller på host. Separate sites gir **uavhengig publisering + rollback** (et feilet bygg beholder siste grønne deploy).
- `/api/*`, `/g/*`, `/cdn/*`, `/sitemap.xml` proxes til Render/R2/Worker via `netlify.toml`.

## Scope — hvilke domener
| Brand | Domener | Denne frontenden? |
|---|---|---|
| The Role Room | `theroleroom.com`, `theroleroom.no`, `www.*` | ✅ |
| CreatorHub | `creatorhubn.com`, `www.*` | ✅ |
| Leadgrid | `leadgrid.no`, `www.*` | ✅ (egne Leadgrid-sider + `LEADGRID_DEDICATED_HOSTS`) |
| **Tidum** | `tidum.no` | ❌ **Egen app** (egen backend). Kun admin-panel-referanser her → egen migrasjon. |

## Allerede gjort (verifisert live)
- `netlify.toml` (repo-rot): portet alle 40 rewrites + 7 redirects fra `frontend/vercel.json` (workspace-bygg: `npm run build --workspace creatorhub-frontend` → `frontend/client/dist`).
- Fikset: `/talentportal` + `/utdanningsinstitusjon` 301-loop (Netlify normaliserer trailing slash automatisk — de porterte «strip slash»-reglene ble fjernet).
- Fikset: `isRoleRoomDedicatedHost` kjenner `*.netlify.app` (preview-domener rendrer Role Room-appen, ikke det statiske «Laster …»-skallet).
- Live-verifisert på preview (`creatorhub-frontend-mig.netlify.app`): `/api/health`→`{"status":"ok"}`, `/sitemap.xml`→XML, alle landing-rewrites, SPA-fallback, ekte assets, redirects.

---

## Per-brand oppsett (dashboard — ~5 min hver)
> API-et lar seg ikke scripte for dette: rename, custom-domain-add (krever eierskaps-verifisering) og GitHub-repo-kobling (OAuth) er dashboard-operasjoner.

For **hvert** brand, gjenta:
1. **Add new site → Import an existing project → GitHub** → velg `Creatorhubn-monorepo` → branch `main`.
2. Ingen ekstra byggkonfig — Netlify leser `netlify.toml`. Deploy.
3. **Site configuration → Access & security → Visitor access → Public** (team-SSO gjør sites private by default — MÅ av for produksjon).
4. **Domain management → Add a domain** → brandens apex + `www`. Netlify auto-provisjonerer Let's Encrypt-SSL når DNS peker.
5. Bytt DNS (tabellen under). Verifiser (sjekklisten under).

Site A (`creatorhub-frontend-mig`) er allerede koblet + public + verifisert → bruk den som **The Role Room**-siten (evt. omdøp i dashboardet; `.netlify.app`-navnet er kosmetisk).

## DNS-records (hos registraren)
Hver site får en `<site>.netlify.app`. Netlifys load-balancer-IP for apex er **`75.2.60.5`**.

| domene | record | verdi |
|---|---|---|
| `theroleroom.com` (apex) | A | `75.2.60.5`  *(el. ALIAS/ANAME → `<rr-site>.netlify.app` hvis registraren støtter flattening)* |
| `www.theroleroom.com` | CNAME | `<rr-site>.netlify.app` |
| `theroleroom.no` (apex) | A | `75.2.60.5` → **samme RR-site** (aliaset på siten) |
| `www.theroleroom.no` | CNAME | `<rr-site>.netlify.app` |
| `creatorhubn.com` (apex) | A | `75.2.60.5` → **creatorhub-site** |
| `www.creatorhubn.com` | CNAME | `<ch-site>.netlify.app` |
| `leadgrid.no` (apex) | A | `75.2.60.5` → **leadgrid-site** |
| `www.leadgrid.no` | CNAME | `<lg-site>.netlify.app` |

## Cutover-prosedyre (per domene, null/minimal nedetid)
**Fase 0 — før DNS:** legg domenet på siten (steg 4) · **senk TTL** til 60–300 s ~24 t før · la **Vercel stå live** (rollback).
**Fase 1 — bytt DNS:** endre record(ene) til Netlify (tabell over). Propagerer på minutter pga. lav TTL.
**Fase 2 — verifiser** (se sjekkliste). **Fase 3:** overvåk 24–48 t, hev TTL tilbake, fjern domenet fra Vercel når stabilt.

**🔙 Rollback:** sett record tilbake til Vercel (`76.76.21.21` apex / `cname.vercel-dns.com` www). Vercel-deployen er fortsatt live → null datatap.

## Verifiserings-sjekkliste (etter hvert DNS-bytte)
- [ ] 🔒 SSL gyldig (https uten varsel)
- [ ] `/api/health` → `{"status":"ok"}` (proxy → Render; **CORS OK fordi domenet er uendret**)
- [ ] `/` rendrer riktig brand · `/theroleroom` (301→/, tiltenkt) · `/talentportal` (200, ikke loop) · `/sitemap.xml` · en dyplenke · SPA-fallback
- [ ] Innlogging/OAuth virker (redirect-URI-er uendret siden domenet er likt)
- [ ] Ingen CORS-/mixed-content-feil i konsollen

## Kjente ting / caveats
- **CORS:** appen kaller `VITE_API_URL` (Render) **direkte**. Uendret domene = OK (allerede i backend-allowlist). **Preview-domener (`*.netlify.app`) er IKKE i CORS** → API-avhengig innhold henger på previews. Fiks ved behov: legg preview-host i backend-CORS, ELLER sett `VITE_API_URL` tomt/relativt så `/api`-proxyen brukes (samme-origin, allerede verifisert).
- **`robots.txt`/`sitemap.xml`:** `netlify.toml` serverer `theroleroom-*`-variantene til ALLE hoster på en site (host-betingede rewrites finnes ikke i vanlig `_redirects`). På per-brand-sites er dette som regel greit; for perfekt per-host robots trengs en Netlify Edge Function (oppfølging).
- **Team-SSO:** account-nivå SSO gjør nye sites private → husk steg 3 (Public) per site.
- **Deploy-isolasjon (Tier 1):** separate sites gir uavhengig *publisering/rollback*. Delt kildekode bygges fortsatt inn i alle → en delt-kode-bug treffer alle. Tier 2 (eget byggmål) / Tier 3 (eget repo) for hardere isolasjon — se scoping-notat.

## Kommandoer for live-verifisering (referanse)
```
U=https://<domene>
curl -sI "$U/api/health"        # -> 200 application/json {"status":"ok"}
curl -sI "$U/talentportal"      # -> 200 (ikke 301-loop)
curl -sI "$U/theroleroom"       # -> 301 -> /
curl -s  "$U/sitemap.xml" | head -1   # -> <?xml ...
```
