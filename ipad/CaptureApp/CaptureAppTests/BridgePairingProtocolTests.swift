import Foundation
import Testing
@testable import CaptureApp

struct BridgePairingProtocolTests {
    @Test func decodesBridgeTokenFromCurrentPairingMessage() throws {
        let token = String(repeating: "a", count: 64)
        let request = try PairingProtocol.decodeRequest(
            Data("PAIR\tdesk_1\tEdit Mac\t1234\t\(token)\n".utf8)
        )

        #expect(request.deskId == "desk_1")
        #expect(request.pin == "1234")
        #expect(request.bridgeAccessToken == token)
    }

    @Test func keepsLegacyPairingMessagesCompatible() throws {
        let request = try PairingProtocol.decodeRequest(
            Data("PAIR\tdesk_old\tOld Desk\t9876\n".utf8)
        )

        #expect(request.deskId == "desk_old")
        #expect(request.bridgeAccessToken == nil)
    }
}
