# OutboxKit

Offline-kø for iPad-appene. Trukket ut av `CaptureApp` slik at Live Set
(The Role Room) kan bruke den uten å kopiere den.

## Hvorfor pakken finnes

`ipad/` hadde to apper som ikke delte noe: `CaptureApp` med `Outbox.swift`,
`LeadMapApp` med `OfflineActionQueue.swift` — to uavhengige implementasjoner
av samme konsept. En tredje app ville gjort det til tre.

Navnet er bevisst produktnøytralt. Pakken deles mellom CreatorHub og
The Role Room, så et `CH`-prefiks ville pekt på feil eier.

## Hva den gir

- `Outbox` — actor som appender mutasjoner, og som kan gjøre det **atomisk
  sammen med** den lokale radoppdateringen i én GRDB-transaksjon
- `OutboxWorker` — drenerer køen med en retry-stige (1 s → 2 → 5 → 15 → 60)
- `OutboxSender` — protokollen worker sender gjennom; appen kobler sin egen
  HTTP-klient
- `OutboxSchema` — DDL for `outboxMutation`-tabellen

## Ta den i bruk

```swift
// 1. La din database-type oppfylle protokollen
extension AppDatabase: OutboxDatabase {}

// 2. Opprett tabellen i en migrering
migrator.registerMigration("v1_outbox") { db in
    try OutboxSchema.createTable(db)
}

// 3. Køen brukes som før
let outbox = Outbox(database: db)
try await database.dbWriter.write { db in
    try asset.update(db)
    try outbox.enqueueInTransaction(db, endpoint: "...", method: .patch, body: payload)
}
```

Det siste steget er hele poenget: lokal endring og køet sync kan ikke komme i
utakt, fordi de skjer i samme transaksjon.

## Idempotens

`clientMutationId` genereres per mutasjon og sendes som
`X-Client-Mutation-Id`. Backend deduplikerer på den, så en flush kan gjentas
uten dobbelteffekt. Nøkkelen overlever app-restart — derfor ligger køen i
SQLite og ikke i minnet.

For Live Set bærer den `eventId` fra hendelsesloggen direkte.

## Migreringsnavn eies av appen

`OutboxSchema.createTable` gir DDL-en, men appen registrerer migreringen med
sitt eget navn. Å flytte navnet hit ville fått GRDB til å tro at en allerede
kjørt migrering var ny.
