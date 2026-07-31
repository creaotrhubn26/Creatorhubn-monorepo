import Foundation
import GRDB

/// Databasen outboxen skriver til.
///
/// Protokoll og ikke en konkret type, fordi pakken deles mellom apper som
/// hver har sin egen database-wrapper. Kravet er bare at den kan gi fra seg
/// en GRDB-writer.
///
/// Konsumenten conformer sin egen type med én linje:
///
///     extension AppDatabase: OutboxDatabase {}
///
/// Da står eksisterende kallsteder — `Outbox(database: db)` — urørt.
public protocol OutboxDatabase: Sendable {
    var dbWriter: any DatabaseWriter { get }
}
