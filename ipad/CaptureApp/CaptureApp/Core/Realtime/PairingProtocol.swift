import Foundation
import Network

/// Linje-basert paringsprotokoll mellom Creatorhub One Desk og iPad
/// CaptureApp. Bevisst custom-protocol (ikke HTTP) for å holde
/// implementasjons-overflaten liten: én oneliner inn, én oneliner ut,
/// connection lukkes.
///
/// Wire-format (UTF-8, `\t`-separert, `\n`-terminert):
///   Desk → iPad:  `PAIR\t<desk_id>\t<desk_name>\t<pin>\n`
///   iPad → Desk:  `OK\t<ipad_device_id>\n`     (bruker godkjente i prompt)
///   iPad → Desk:  `ERR\t<reason>\n`            (avvist eller timeout)
///
/// `desk_id` er en stabil identifikator Desk-siden lager (UUID lagret i
/// `~/.creatorhub-one-desk/config.json`). `pin` er den 4-sifrede
/// engangskoden Desk viste på skjermen — iPad-en bekrefter at brukeren
/// tastet samme tall i prompten.
///
/// Time-out: iPad har 60 sek på å svare. Lukker forbindelsen hvis bruker
/// ikke har bekreftet innen da → Desk får ERR\ttimeout og kan retry.

enum PairingProtocol {
    static let maxRequestLength = 1024
    static let promptTimeoutSeconds: TimeInterval = 60

    struct PairRequest: Sendable, Equatable {
        let deskId: String
        let deskName: String
        let pin: String
    }

    enum DecodeError: Error, CustomStringConvertible {
        case empty
        case tooLarge
        case malformed
        case unknownCommand(String)
        case missingField

        var description: String {
            switch self {
            case .empty: return "empty payload"
            case .tooLarge: return "payload over \(PairingProtocol.maxRequestLength) bytes"
            case .malformed: return "malformed line"
            case .unknownCommand(let cmd): return "unknown command: \(cmd)"
            case .missingField: return "missing field"
            }
        }
    }

    /// Parser én linje fra Desk. Strenge-trimming + length-cap så vi
    /// ikke kjører JSON-parser eller annet over upålitelig wire.
    static func decodeRequest(_ data: Data) throws -> PairRequest {
        guard !data.isEmpty else { throw DecodeError.empty }
        guard data.count <= maxRequestLength else { throw DecodeError.tooLarge }
        guard let raw = String(data: data, encoding: .utf8) else { throw DecodeError.malformed }
        let line = raw.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? raw
        let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        guard let command = parts.first else { throw DecodeError.malformed }
        switch command {
        case "PAIR":
            guard parts.count >= 4 else { throw DecodeError.missingField }
            return PairRequest(
                deskId: parts[1].trimmingCharacters(in: .whitespacesAndNewlines),
                deskName: parts[2].trimmingCharacters(in: .whitespacesAndNewlines),
                pin: parts[3].trimmingCharacters(in: .whitespacesAndNewlines),
            )
        default:
            throw DecodeError.unknownCommand(command)
        }
    }

    /// OK-response. `iPadDeviceId` lar Desk lagre samme identifikator
    /// som Bonjour-TXT-recorden så dedup-logikken matcher mellom paring
    /// og fremtidige discovery-events.
    static func encodeOK(iPadDeviceId: String) -> Data {
        let line = "OK\t\(iPadDeviceId)\n"
        return Data(line.utf8)
    }

    static func encodeError(reason: String) -> Data {
        // Sanitiser så reason ikke kan injecte ekstra felter via \t/\n
        let safe = reason
            .replacingOccurrences(of: "\t", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        let line = "ERR\t\(safe)\n"
        return Data(line.utf8)
    }
}
