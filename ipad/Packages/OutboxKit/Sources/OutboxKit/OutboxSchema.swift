import Foundation
import GRDB

/// Tabellen outboxen bor i.
///
/// DDL-en lå tidligere inline i appens migrator. Den ligger her nå, av samme
/// grunn som GRDB-konformansen: en ny app skal kunne ta i bruk pakken uten å
/// vite hvilke kolonner og indekser den forutsetter.
///
/// **Migreringsnavnet eies fortsatt av appen.** Pakken tilbyr bare DDL-en, så
/// eksisterende installasjoner beholder sin migreringsidentitet — å flytte
/// navnet hit ville fått GRDB til å tro at en allerede kjørt migrering var ny.
///
/// Ny app:
///
///     migrator.registerMigration("v1_outbox") { db in
///         try OutboxSchema.createTable(db)
///     }
public enum OutboxSchema {
    /// Oppretter `outboxMutation` med indeksene worker-spørringene trenger.
    ///
    /// De to indeksene er ikke pynt: `(status, createdAt)` betjener
    /// FIFO-plukket i `nextPending`, og `(entityTable, entityId)` lar UI-et
    /// svare på «venter denne raden på sync» uten å skanne køen.
    public static func createTable(_ db: Database) throws {
        try db.create(table: "outboxMutation") { t in
            t.autoIncrementedPrimaryKey("id")
            // Unik: idempotensnøkkelen må ikke kunne insertes to ganger ved
            // en race, ellers dedupliserer ikke backend som forutsatt.
            t.column("clientMutationId", .text).notNull().unique()
            t.column("endpoint", .text).notNull()
            t.column("method", .text).notNull()
            t.column("bodyJson", .text)
            t.column("entityTable", .text)
            t.column("entityId", .text)
            t.column("status", .text).notNull().defaults(to: "pending")
            t.column("attemptCount", .integer).notNull().defaults(to: 0)
            t.column("lastError", .text)
            t.column("createdAt", .datetime).notNull()
            t.column("updatedAt", .datetime).notNull()
        }
        try db.create(indexOn: "outboxMutation", columns: ["status", "createdAt"])
        try db.create(indexOn: "outboxMutation", columns: ["entityTable", "entityId"])
    }
}
