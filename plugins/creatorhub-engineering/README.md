# creatorhub-engineering

Evidensdrevet engineering-workflow for CreatorHub, skreddersydd til
Creatorhubn-monorepoet. Dette er den bedriftstilpassede utgaven av
«creatorhub-engineering»-pluginen: hver skill koder inn repoets faktiske
registre (CH-ARCH, evidence graph, impact-reports, memory.md), gates og
dyrekjøpte feilklasser — ikke generiske råd.

## Innhold

| Komponent | Bruk |
|---|---|
| `skills/repo-intelligence` | Orientering: produkt→katalog-kart + kunnskapsregistrene |
| `skills/dependency-audit` | Deps-endringer: lockfile-/hoisting-feller, Freshness Rule, pinning-evidens |
| `skills/architecture-plan` | Planlegging: fokus-spørsmål, fase-PR-er, incident→rule, modell-disiplin |
| `skills/implement` | Kodekonvensjoner: norske conventional commits, migrasjoner, org-scoping, frontend-invarianter |
| `skills/e2e-verify` | Gate-kartet: hardened E2E-gates, Playwright-oppsett, live-smokes |
| `skills/security-review` | Org-isolasjon, RBAC-feller, webhooks/CORS/OAuth, secrets, GDPR |
| `skills/regression-check` | Kjente feilklasser: whitescreen, «grønn CI lyver», migrasjonsdrift, rute-skygging |
| `skills/release-readiness` | Deploy-topologi (Render/Vercel/TestFlight/Tauri) + GO/NO-GO-sjekkliste |
| `commands/ship-check` | `/creatorhub-engineering:ship-check` — full leveransesjekk av gjeldende branch |

Arbeidsflyten skillsene er bygget rundt:
repo-intelligence → dependency-audit → architecture-plan → implement →
e2e-verify → security-review → regression-check → release-readiness.

## Installasjon

Repoet er et Claude Code plugin-marketplace (`.claude-plugin/marketplace.json`
i rot). I Claude Code:

```
/plugin marketplace add creaotrhubn26/Creatorhubn-monorepo
/plugin install creatorhub-engineering@creatorhub-plugins
```

For claude.ai/Cowork: oppdater den installerte «creatorhub-engineering»-
pluginen med innholdet her (plugin-management-flyten), slik at katalog-
versjonen og repo-versjonen holdes i sync. Repoet er kilden til sannhet.

## Vedlikehold

- Ny produksjonshendelse med ≥2 forekomster → oppdater
  `docs/architecture-rules.md` først, deretter speil klassen i
  `regression-check`-skillen.
- Endret deploy-topologi (f.eks. Netlify-cutover, fikset Vercel-webhook) →
  oppdater `release-readiness` i samme PR.
- Kildene skillsene peker på: `memory.md`, `docs/architecture-rules.md`,
  `docs/evidence/`, `docs/impact-reports/`, `docs/baselines/`,
  `.claude/skills/documentation-intelligence/`.
