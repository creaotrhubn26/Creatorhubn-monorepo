import Foundation
import GRDB

/// Kvikk-teaser: send 3-5 hero-frames til klient fra iPad mellom
/// sesjonene. Fotografen trykker Send, backend speiler sesjonen inn
/// i et ``photographer_client_galleries``-rad og returnerer en
/// share-URL klienten kan åpne uten autentisering — samme surface
/// som deliver-fra-web bruker, så klienten ser galleriet i sitt
/// vanlige format.
///
/// Design-valg:
///
///   * **Online-only**. Kvikk-teaser lager et nytt galleri med
///     signerte URLer, som krever en live backend-runde. Vi kunne
///     kjørt flyten via ``Outbox`` for senere sync, men da får
///     fotografen ingen delbar URL før nettet er tilbake — motsatt
///     av intensjonen. Feilhåndteringen flagger "offline" i UI og
///     lar dem prøve igjen.
///
///   * **Filter = flagged**. Default er bare hero-markerte frames.
///     Fotografen kan velge ``ratingAtLeast4`` for et bredere
///     utvalg når dagen har vært rolig. Full-utvalg (``allNonRejected``)
///     er bevisst ikke eksponert her — det hører hjemme i den
///     fullstendige leverings-flaten på web.
///
///   * **Pre-flight count**. Før vi POSTer teller vi lokalt hvor
///     mange assets som matcher filteret. Ingen meningsfulle 0-
///     frame-levanser; en klientlenke til et tomt galleri er verre
///     enn å vente til etter neste shoot.
/// Narrow backend surface QuickTeaserService depends on. Defined as
/// a protocol so tests can inject an in-memory stand-in without
/// subclassing ``BackendClient`` (which is an actor and can't be
/// subclassed under Swift 6).
protocol QuickTeaserBackend: Sendable {
    func deliverToShowcase(
        sessionId: UUID,
        body: BackendDeliverToShowcaseRequest,
    ) async throws -> BackendDeliverToShowcaseResponse
}

extension BackendClient: QuickTeaserBackend {}

struct QuickTeaserService: Sendable {
    let database: AppDatabase
    let backend: any QuickTeaserBackend

    // MARK: - Pre-flight

    /// How many assets in this session match the chosen filter.
    /// Runs against the local mirror so it's instant + works offline;
    /// the backend may disagree by one or two if an asset was
    /// mutated on another device since the last sync, but the
    /// order-of-magnitude is right.
    func eligibleCount(
        sessionId: UUID,
        ownerUserId: String,
        filter: BackendDeliverFilter,
    ) async throws -> Int {
        try await database.dbWriter.read { db in
            var sql = """
                SELECT COUNT(*) FROM asset
                JOIN session ON session.id = asset.sessionId
                WHERE asset.sessionId = ?
                  AND session.ownerUserId = ?
                  AND asset.rejected = 0
                """
            switch filter {
            case .flagged:
                sql += " AND asset.flaggedForClient = 1"
            case .ratingAtLeast4:
                sql += " AND asset.rating >= 4"
            case .picksOr4Plus:
                sql += " AND (asset.flaggedForClient = 1 OR asset.rating >= 4)"
            case .allNonRejected:
                break
            }
            return try Int.fetchOne(db, sql: sql, arguments: [
                sessionId.uuidString.uppercased(),
                ownerUserId,
            ]) ?? 0
        }
    }

    // MARK: - Deliver

    /// Mint a client gallery from this session's picks. Returns the
    /// server response including the share URL. Throws ``Failure``
    /// with a photographer-readable message for every
    /// known-unhappy-path so the UI can render exactly what's wrong
    /// without scraping error strings.
    func deliver(
        sessionId: UUID,
        ownerUserId: String,
        clientName: String,
        clientEmail: String,
        projectTitle: String?,
        filter: BackendDeliverFilter = .flagged,
    ) async throws -> BackendDeliverToShowcaseResponse {
        // Validate before paying for the round-trip. Email format is
        // loose on purpose — the client's address gets double-checked
        // on the backend via SendGrid/Postmark later.
        let trimmedName = clientName.trimmingCharacters(in: .whitespaces)
        let trimmedEmail = clientEmail.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else {
            throw Failure.missingClientName
        }
        guard trimmedEmail.contains("@") && trimmedEmail.contains(".") else {
            throw Failure.invalidEmail
        }

        let count = try await eligibleCount(
            sessionId: sessionId,
            ownerUserId: ownerUserId,
            filter: filter,
        )
        guard count > 0 else {
            throw Failure.noEligiblePicks(filter: filter)
        }

        do {
            return try await backend.deliverToShowcase(
                sessionId: sessionId,
                body: BackendDeliverToShowcaseRequest(
                    filter: filter,
                    clientName: trimmedName,
                    clientEmail: trimmedEmail,
                    projectTitle: projectTitle?.isEmpty == true ? nil : projectTitle,
                ),
            )
        } catch BackendError.unauthorized {
            throw Failure.notAuthorised
        } catch BackendError.notFound {
            throw Failure.sessionNotFound
        } catch let BackendError.httpStatus(code, body) {
            throw Failure.serverRejected(status: code, body: body)
        } catch {
            throw Failure.transport(String(describing: error))
        }
    }

    enum Failure: Error, Equatable, CustomStringConvertible {
        case missingClientName
        case invalidEmail
        case noEligiblePicks(filter: BackendDeliverFilter)
        case notAuthorised
        case sessionNotFound
        case serverRejected(status: Int, body: String?)
        case transport(String)

        var description: String {
            switch self {
            case .missingClientName:
                return "Fyll ut klientens navn."
            case .invalidEmail:
                return "E-postadressen ser ikke riktig ut."
            case let .noEligiblePicks(filter):
                switch filter {
                case .flagged:
                    return "Ingen hero-markerte bilder i denne økten ennå."
                case .ratingAtLeast4:
                    return "Ingen bilder har 4+ stjerner i denne økten."
                case .picksOr4Plus:
                    return "Ingen hero-flaggede eller 4+ stjerners bilder funnet."
                case .allNonRejected:
                    return "Denne økten har ingen bilder å levere."
                }
            case .notAuthorised:
                return "Økta kan ikke leveres fra denne kontoen."
            case .sessionNotFound:
                return "Økta finnes ikke på serveren — er den synkronisert?"
            case let .serverRejected(status, body):
                return "Serveren avslo (HTTP \(status))\(body.map { ": \($0)" } ?? "")."
            case let .transport(message):
                return "Kunne ikke nå serveren: \(message)"
            }
        }
    }
}
