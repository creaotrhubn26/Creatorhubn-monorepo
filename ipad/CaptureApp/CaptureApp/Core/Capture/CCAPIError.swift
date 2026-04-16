import Foundation

enum CCAPIError: Error, Sendable, Equatable {
    case notDiscovered
    case unsupportedOperation(String)
    case unsupportedApiVersion(required: String, available: [String])
    case httpStatus(code: Int, body: String?)
    case decode(String)
    case cameraBusy
    case timedOut
    case network(String)
    case invalidResponse(String)
}
