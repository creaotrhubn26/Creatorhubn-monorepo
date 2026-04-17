import Foundation

/// In-process fake of a Canon CCAPI-enabled body. Holds the URLProtocol
/// handler closure that intercepts every CCAPI call and returns either a
/// canned JSON response or fake JPEG/RAW bytes.
///
/// One body, one storage card, two known assets at start. Each call to
/// `simulateCapture()` queues a new content URL that the next polling
/// request will return as `addedcontents`.
final class FakeCanonCamera: @unchecked Sendable {
    static let baseURL = URL(string: "http://192.0.2.10:8080")!

    private let lock = NSLock()
    private var pendingAddedContents: [String] = []
    private var contentBodies: [String: Data] = [:]

    private(set) var pollCount = 0
    private(set) var seenRequests: [String] = []

    init() {
        // Pre-populate two assets that already exist on the card at boot.
        contentBodies["/ccapi/ver100/contents/sd/100CANON/IMG_0001.JPG"] = Data(repeating: 0xAA, count: 64)
        contentBodies["/ccapi/ver100/contents/sd/100CANON/IMG_0002.CR3"] = Data(repeating: 0xBB, count: 96)
    }

    /// Initial card contents — present from `connect()` onward.
    func initialContentURLs() -> [String] {
        Array(contentBodies.keys).sorted()
    }

    /// Queue a new content URL so the next `pollEvents` call returns it as
    /// `addedcontents`. Also stages a small body for `downloadContent`.
    func simulateCapture(filename: String, body: Data = Data(repeating: 0xCC, count: 32)) -> String {
        let url = "/ccapi/ver100/contents/sd/100CANON/\(filename)"
        lock.lock()
        defer { lock.unlock() }
        pendingAddedContents.append(url)
        contentBodies[url] = body
        return url
    }

    /// Install this fake as the active MockURLProtocol handler.
    func install() {
        MockURLProtocol.handler = { [weak self] request in
            guard let self else { throw URLError(.cancelled) }
            return try self.respond(to: request)
        }
    }

    /// A URLSession that routes through this fake.
    func makeSession() -> URLSession { MockURLProtocol.makeSession() }

    // MARK: - Routing

    private func respond(to request: URLRequest) throws -> (HTTPURLResponse, Data) {
        guard let url = request.url else {
            throw URLError(.badURL)
        }
        // Path may include query string for long-poll. Compare on full path+query.
        let pathWithQuery: String = {
            var parts = url.path
            if let q = url.query, !q.isEmpty { parts += "?" + q }
            return parts
        }()

        lock.lock()
        seenRequests.append(pathWithQuery)
        lock.unlock()

        switch pathWithQuery {
        case "/ccapi":
            return MockURLProtocol.jsonResponse(for: url, body: Self.inventoryJSON)

        case "/ccapi/ver100/devicestatus/storage":
            return MockURLProtocol.jsonResponse(for: url, body: Self.storageListJSON)

        case "/ccapi/ver100/contents/sd":
            return MockURLProtocol.jsonResponse(for: url, body: Self.directoryListJSON)

        case "/ccapi/ver100/contents/sd/100CANON":
            return MockURLProtocol.jsonResponse(for: url, body: Self.contentsListJSON(initial: initialContentURLs()))

        case "/ccapi/ver100/event/polling?continue=on",
             "/ccapi/ver100/event/polling":
            return pollResponse(for: url)

        default:
            // Treat any other path as a content download if we have bytes for it.
            lock.lock()
            let body = contentBodies[pathWithQuery]
            lock.unlock()
            if let body {
                return MockURLProtocol.binaryResponse(for: url, body: body)
            }
            let resp = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            return (resp, Data("not found: \(pathWithQuery)".utf8))
        }
    }

    private func pollResponse(for url: URL) -> (HTTPURLResponse, Data) {
        lock.lock()
        pollCount += 1
        let drained = pendingAddedContents
        pendingAddedContents.removeAll()
        lock.unlock()
        let body: String
        if drained.isEmpty {
            body = "{}"
        } else {
            let urls = drained.map { "\"\($0)\"" }.joined(separator: ",")
            body = "{\"addedcontents\":[\(urls)]}"
        }
        return MockURLProtocol.jsonResponse(for: url, body: body)
    }

    // MARK: - Canned JSON

    private static let inventoryJSON = """
    {
      "versions": [
        {
          "ver": "ver100",
          "apis": [
            {"path":"/ccapi/ver100/devicestatus/storage","get":true},
            {"path":"/ccapi/ver100/event/polling","get":true},
            {"path":"/ccapi/ver100/deviceinformation","get":true}
          ]
        }
      ]
    }
    """

    private static let storageListJSON = """
    {
      "storagelist": [
        {
          "name": "sd",
          "url": "/ccapi/ver100/contents/sd",
          "accesscapability": "readwrite",
          "maxsize": 256000000000,
          "spacesize": 120000000000,
          "contentsnumber": 2
        }
      ]
    }
    """

    private static let directoryListJSON = """
    {
      "url": ["/ccapi/ver100/contents/sd/100CANON"],
      "path": "/ccapi/ver100/contents/sd"
    }
    """

    private static func contentsListJSON(initial: [String]) -> String {
        let urls = initial.map { "\"\($0)\"" }.joined(separator: ",")
        return """
        {
          "url": [\(urls)],
          "path": "/ccapi/ver100/contents/sd/100CANON"
        }
        """
    }
}
