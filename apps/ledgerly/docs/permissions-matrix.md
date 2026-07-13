# Rettighetsmatrise

Generert fra `src/access/permissions.ts` (`ROLE_PERMISSIONS`). Prinsipp: minste
privilegium — en rolle har **kun** eksplisitt tildelte rettigheter; ukjente roller har
ingen. Håndheves per endepunkt i `src/api/server.ts` etter medlemskapssjekk
(`requireOrgPermission`), og i tillegg i pipelinen (`actorRoleVerified` i
`approveAndPost`).

Roller: **own** = owner, **adm** = admin, **gm** = general_manager,
**acm** = accounting_manager, **acc** = accountant (ekstern regnskapsfører),
**aud** = auditor_readonly, **att** = attestant, **app** = approver,
**emp** = employee, **ext** = external_advisor.

| Rettighet | own | adm | gm | acm | acc | aud | att | app | emp | ext |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| org.manage | x | x | | | | | | | | |
| members.manage | x | x | | | | | | | | |
| documents.upload | x | x | x | x | x | | | | x | |
| documents.view | x | x | x | x | x | x | x | x | x | x |
| documents.approve | x | x | x | x | x | | x | x | | |
| journal.post | x | x | | x | x | | | | | |
| journal.reverse | x | x | | x | x | | | | | |
| period.lock | x | x | | x | x | | | | | |
| reports.view | x | x | x | x | x | x | | | | x |
| vat.view | x | x | x | x | x | x | | | | |
| vat.submit | x | | x | x | x | | | | | |
| bank.reconcile | x | x | | x | x | | | | | |
| integrations.manage | x | x | | | | | | | | |
| audit.view | x | x | x | x | x | x | | | | |

## Merknader

- `vat.submit` krever i tillegg en eksplisitt signeringshandling (kommentar i koden);
  selve innsendingen til Altinn/Skatteetaten er ikke implementert
  (`docs/integration-status.md`). Merk at `admin` **ikke** har `vat.submit` —
  innsending er forbeholdt roller med reelt ansvar (owner, general_manager,
  accounting_manager, accountant).
- `attestant` og `approver` har identiske rettigheter i MVP (kun se og godkjenne
  dokumenter); de er skilt som roller for fremtidig attestasjonsflyt.
- `documents.approve` (godkjenne dokument) er ikke det samme som å bokføre:
  API-endepunktet `POST .../documents/:documentId/approve` krever `journal.post`,
  siden godkjenningen der utløser bokføring.
- Rollene ligger også som CHECK-constraint på `memberships.role` i
  `migrations/0001_foundation.sql`; listene må holdes i synk.
- RBAC-oppførselen er testet i `test/api.pg.test.ts` («RBAC: ansatt kan laste opp,
  men ikke bokføre eller låse periode»).
