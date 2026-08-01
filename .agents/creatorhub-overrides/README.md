# CreatorHub — Higgsfield skill-overrides (backup + restore)

Kilde-av-sannhet for CreatorHub-tilpasningene av Higgsfield-skillene. Ligger her
(utenfor `.agents/skills/`) fordi `npx skills add higgsfield-ai/skills`
**overskriver** skill-mappene ved en upstream-oppdatering.

## Innhold
- `system-context.md` — den delte plattform-konteksten (kanonisk kopi). Live-
  versjonen skillene leser ligger på `../skills/_creatorhub/system-context.md`.
- `skill-context-block.md` — CreatorHub-blokken som settes inn øverst i hver SKILL.md.
- `restore.sh` — idempotent gjenoppretting av 1) system-context, 2) blokken i
  alle 7 SKILL.md, 3) `curl|sh`-herdingen.

## Når kjøre
Etter enhver `npx skills add higgsfield-ai/skills` (skill-oppdatering):

```bash
bash .agents/creatorhub-overrides/restore.sh
```

## Endre konteksten
Rediger `system-context.md` og/eller `skill-context-block.md` HER, kjør så
`restore.sh` for å pushe endringene inn i skillene. Da holder du én kilde.
