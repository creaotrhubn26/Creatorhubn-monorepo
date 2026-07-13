# Backup og gjenoppretting

Bokføringsloven krever at regnskapsmateriale sikres mot tap. Prinsippet her:
**en backup som ikke er testet gjenopprettet, er ikke en backup.** Derfor er
gjenopprettingstesten en del av backuprutinen — ikke et valgfritt tillegg.

## Rutinen

```bash
npm run backup                       # backup + automatisk gjenopprettingstest
npm run backup -- --skip-verify      # kun backup (frarådes, sier tydelig ifra)
npm run backup:verify -- <katalog>   # verifiser en eksisterende backup
```

Miljøvariabler: `DATABASE_URL`, `LEDGERLY_STORAGE_DIR` (dokumentlageret,
default `./data/documents`), `LEDGERLY_BACKUP_DIR` (default `./backups`).

Hver backup får sin egen tidsstemplede katalog med:

| Fil | Innhold |
|---|---|
| `database.dump` | `pg_dump --format=custom` av hele databasen |
| `documents.tar.gz` | Dokumentlageret (originalbilagene) |
| `manifest.json` | Tidspunkt, sha256 for begge filene, pg_dump-versjon |

## Gjenopprettingstesten (`src/ops/backup.ts`)

`verifyBackup` gjenoppretter dumpen i en **fersk kladdedatabase**
(`ledgerly_restore_verify_<tilfeldig>`, slettes etterpå) og kontrollerer:

1. **Integritet**: sha256 for dump og dokumentarkiv matcher manifestet —
   en korrupt eller manipulert fil avvises før den kan gi falsk trygghet.
2. **Migrasjonshistorikk**: `_ledgerly_migrations` finnes og er ikke tom.
3. **Balanse**: hvert bilag i den gjenopprettede hovedboken balanserer
   (sum debet = sum kredit per postering).
4. **Radantall**: kjernetabellene (organisasjoner, bilag, posteringslinjer,
   kildedokumenter, fakturaer, revisjonslogg) matcher kildedatabasen.
5. **Bilagene**: hvert kildedokument i databasen gjenfinnes i arkivet med
   korrekt sha256 — *regnskap uten bilag er ikke gjenopprettet*.

Alt testes automatisk mot ekte Postgres i `test/backup.pg.test.ts`, inkludert
at en manipulert dumpfil avvises.

## Reell gjenoppretting (katastrofe)

```bash
createdb ledgerly_restored
pg_restore --dbname=postgres://.../ledgerly_restored --no-owner database.dump
mkdir -p /var/lib/ledgerly/documents
tar -xzf documents.tar.gz -C /var/lib/ledgerly/documents
# Pek DATABASE_URL og LEDGERLY_STORAGE_DIR på de gjenopprettede stedene,
# og kjør deretter verifiseringen mot det gjenopprettede miljøet:
npm run backup:verify -- <backup-katalogen>
```

## Kjent funn fra utviklingsmiljøet (bevis på at kontrollen virker)

Første kjøring mot utviklingsdatabasen avslørte 4 bilagsrader uten innhold i
dokumentlageret — rester fra tidlige utviklingsfaser før objektlageret ble
koblet på (og fordi `/tmp`-lagring ryddes av miljøet). Verifiseringen stoppet
med eksplisitt feilmelding i stedet for å rapportere en «vellykket» backup.
Det er nøyaktig ønsket oppførsel. I produksjon lagrer `registerDocument`
alltid innholdet i objektlageret **før** databaseraden committes, så denne
tilstanden skal ikke kunne oppstå.

## Hva som gjenstår for produksjon (drift)

- Planlagt kjøring (cron/systemd-timer) med alarm ved feilet verifisering.
- Kopi til annen lokasjon/skyregion (offsite) — 3-2-1-prinsippet.
- Kryptering av backupfilene i ro (dokumentene inneholder personopplysninger).
- Oppbevaringsplan for backupene i tråd med `docs/data-retention.md`.
- Periodisk katastrofeøvelse mot et faktisk gjenopprettet miljø (ikke bare
  kladdedatabasen).
