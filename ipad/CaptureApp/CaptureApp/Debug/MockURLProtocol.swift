// swiftformat:disable redundantSelf
#if DEBUG
import Foundation

/// URLProtocol that routes requests to a closure-based handler. Used by
/// unit tests to stand up a fake HTTP server in-process, and by the app's
/// in-process Demo Mode (see `FakeCanonCamera.install()`). DEBUG-only —
/// release builds don't ship the protocol or its handler.
///
/// Usage:
/// ```swift
/// let config = URLSessionConfiguration.ephemeral
/// config.protocolClasses = [MockURLProtocol.self]
/// MockURLProtocol.handler = { request in
///     // …return (response, body) keyed off request.url
/// }
/// let session = URLSession(configuration: config)
/// ```
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    typealias Handler = @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)

    /// Single handler shared across all in-flight requests.
    /// Tests must reset to nil in tearDown.
    nonisolated(unsafe) static var handler: Handler?

    // URLProtocol-overrides MÅ være `class func` (kan ikke overstyres med `static`).
    // swiftlint:disable:next static_over_final_class
    override class func canInit(with request: URLRequest) -> Bool { true }

    // swiftlint:disable:next static_over_final_class
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.cannotConnectToHost))
            return
        }
        do {
            let (response, body) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

extension MockURLProtocol {
    /// Build an isolated URLSession that routes through this protocol only.
    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }

    /// Convenience JSON 200 response for a given URL.
    static func jsonResponse(for url: URL, body: String, status: Int = 200) -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (response, Data(body.utf8))
    }

    static func binaryResponse(for url: URL, body: Data, status: Int = 200) -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/octet-stream", "Content-Length": "\(body.count)"]
        )!
        return (response, body)
    }
}
#endif
