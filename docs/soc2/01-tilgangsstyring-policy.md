# Tilgangsstyring — policy (utkast)

> SOC 2 Type II-kjernepolicy. Del av `docs/soc2/00-KICKOFF-PLAN.md` (Fase 4).
> Bygget 2026-08-15 basert på faktisk implementert RBAC/SSO/SCIM i kodebasen
> (Fase 1-2). **Utkast — trenger en navngitt eier som formelt vedtar den, og
> bør kvalitetssikres av noen med reell SOC 2-revisjonserfaring.**

---

## 1. Formål

Sikre at tilgang til systemer og data hos Creatorhub AS gis etter prinsippet
om minste privilegium (*least privilege*), er sporbar, og fjernes umiddelbart
når den ikke lenger er berettiget.

## 2. Omfang

Gjelder tilgang til: produksjonsinfrastruktur (Render, Neon, Cloudflare R2,
Backblaze B2), kildekode (GitHub), enterprise-kunders Role Room-organisasjoner
(via SSO/SCIM), og interne administrative grensesnitt.

## 3. Prinsipper

- **Minste privilegium.** Tilgang gis for det som faktisk kreves for rollen,
  ikke mer. Administrator-/super_admin-roller reserveres til et minimum antall
  personer.
- **Sporbarhet.** All rolletildeling registrerer hvem som tildelte den
  (`assigned_by`) og når. Se `role_room_user_org_roles.assigned_by` og
  `user_roles.assigned_by` (eksisterende, reell kolonne i produksjonsskjemaet).
- **Automatisk fjerning ved offboarding, der det er teknisk mulig.** For
  enterprise-kunder som bruker SCIM (se §5), skjer dette automatisk fra
  kundens IdP. For interne ansatte er dette **[AVKLAR — manuell prosess i dag,
  ingen automatisert HR-til-tilgang-kobling funnet i kodebasen]**.

## 4. Rollebasert tilgangsstyring (RBAC)

Role Room-plattformen har to separate, reelle RBAC-implementasjoner:

- **Enterprise-organisasjoner** (kunder med SSO/SCIM): `role_room_organization_roles`
  + `role_room_user_org_roles` (migrasjon 0452). Org-scopet — hver kunde
  definerer sine egne roller, tildelinger er isolert per organisasjon.
- **Interne/plattform-brukere**: `custom_roles` + `user_roles` (migrasjon
  0001) — den eldre, plattformbrede rollemodellen.

**Kjent gap, funnet og delvis lukket i dette veikartet:** før Fase 1-2 var
mye av rollehåndhevingen i Role Room kun gjort på klient-siden (UI-gating i
`castingAuthService.ts`), ikke håndhevet på server. SAML-innlogging (Fase 1)
håndhever nå aktivt org-medlemskap server-side før en sesjon mintes (se
`role-room-saml-routes.ts`). **[AVKLAR: en fullstendig gjennomgang av ALLE
skrive-endepunkter for manglende server-side håndheving er ikke gjort — dette
bør være en tidlig oppgave i selve SOC 2-gap-analysen, ikke noe denne
policyen alene løser.]**

## 5. Enterprise-kunde-tilgang (SSO/SCIM)

- Innlogging skjer via kundens IdP (SAML 2.0) — Role Room lagrer ingen
  passord for disse brukerne.
- Provisjonering/deprovisjonering skjer automatisk via SCIM 2.0 fra kundens
  IdP (Fase 2). Deaktivering fjerner både rolletildelingen og enhver aktiv
  innloggingssesjon umiddelbart (ikke bare ved neste sesjonsutløp).
- Én kunde-organisasjon kan ikke se eller påvirke en annen — håndhevet ved
  at alle spørringer er scopet på `organization_id`.

## 6. Interne ansatte — tilgangsgjennomgang

**[AVKLAR — trenger en eier og en fastsatt kadanse.]** Anbefalt minimum for
en SOC 2 Type II-revisjon: kvartalsvis gjennomgang av hvem som har
admin/super_admin-tilgang til produksjon, dokumentert med dato og hvem som
utførte gjennomgangen.

## 7. Multi-faktor-autentisering (MFA)

**[AVKLAR — ikke verifiserbart fra kildekoden.]** Er MFA håndhevet (ikke bare
tilgjengelig) for: Google Workspace-kontoer, GitHub-organisasjonen,
Render-dashboardet, Neon-konsollen? Dette er blant de første tingene en
revisor/Vanta-integrasjon vil sjekke.

## 8. Passordkrav

Interne brukerkontoer som ikke bruker SSO: passord lagres som bcrypt-hash
(kodifisert praksis, se `role-room-scim-routes.ts` og `role-room-routes.ts`
sin brukeropprettelse — aldri lagret i klartekst).

## 9. Avvik og unntak

Ethvert unntak fra denne policyen (f.eks. midlertidig utvidet tilgang for
feilsøking) skal dokumenteres med begrunnelse, hvem som godkjente det, og en
frist for å fjerne den utvidede tilgangen.

---

**Eier:** **[AVKLAR — navngi en internt ansvarlig for denne policyen.]**
**Neste gjennomgang:** **[AVKLAR — sett en dato, typisk årlig eller ved
vesentlig endring i infrastruktur.]**
