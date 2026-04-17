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

    init(initialAssetCount: Int = 2) {
        // Pre-populate N assets that already exist on the card at boot.
        // Default 2 is enough for the basic contents tests; pass larger values
        // (e.g. 250) to exercise the paginated enumerate path. 0 is valid.
        for i in 0..<initialAssetCount {
            let name = String(format: "IMG_%04d.JPG", i + 1)
            let path = "/ccapi/ver120/contents/sd/100CANON/\(name)"
            contentBodies[path] = Data(repeating: 0xAA, count: 32)
        }
    }

    /// Initial card contents — present from `connect()` onward.
    func initialContentURLs() -> [String] {
        Array(contentBodies.keys).sorted()
    }

    /// Queue a new content URL so the next `pollEvents` call returns it as
    /// `addedcontents`. Also stages a small body for `downloadContent`.
    func simulateCapture(filename: String, body: Data = Data(repeating: 0xCC, count: 32)) -> String {
        let url = "/ccapi/ver120/contents/sd/100CANON/\(filename)"
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

        case "/ccapi/ver110/devicestatus/storage":
            return MockURLProtocol.jsonResponse(for: url, body: Self.storageListJSON)

        case "/ccapi/ver120/contents/sd":
            return MockURLProtocol.jsonResponse(for: url, body: Self.directoryListJSON)

        case "/ccapi/ver110/event/polling?continue=on",
             "/ccapi/ver110/event/polling":
            return pollResponse(for: url)

        default:
            // Contents-directory pagination: /ccapi/ver120/contents/sd/100CANON
            // with optional ?kind=number or ?kind=list&page=N.
            if url.path == "/ccapi/ver120/contents/sd/100CANON" {
                return contentsDirectoryResponse(for: url)
            }
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

    /// Canon pagination: `?kind=number` → totals, `?kind=list&page=N` → slice
    /// of up to 100 URLs. Default (no kind) behaves like page=1.
    private func contentsDirectoryResponse(for url: URL) -> (HTTPURLResponse, Data) {
        let all = initialContentURLs()
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let query = components?.queryItems ?? []
        let kind = query.first(where: { $0.name == "kind" })?.value ?? "list"

        if kind == "number" {
            let pages = max(1, Int((Double(all.count) / 100.0).rounded(.up)))
            let body = "{\"contentsnumber\":\(all.count),\"pagenumber\":\(pages)}"
            return MockURLProtocol.jsonResponse(for: url, body: body)
        }

        let page = Int(query.first(where: { $0.name == "page" })?.value ?? "1") ?? 1
        let start = (page - 1) * 100
        let end = min(start + 100, all.count)
        let slice = (start < end) ? Array(all[start..<end]) : []
        let urls = slice.map { "\"\($0)\"" }.joined(separator: ",")
        return MockURLProtocol.jsonResponse(for: url, body: "{\"path\":[\(urls)]}")
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
      "ver100": [
        {"path":"/ccapi/ver100/deviceinformation","get":true,"post":false,"put":false,"delete":false}
      ],
      "ver110": [
        {"path":"/ccapi/ver110/devicestatus/storage","get":true,"post":false,"put":false,"delete":false},
        {"path":"/ccapi/ver110/event/polling","get":true,"post":false,"put":false,"delete":true}
      ]
    }
    """

    private static let storageListJSON = """
    {
      "storagelist": [
        {
          "name": "sd",
          "path": "/ccapi/ver120/contents/sd",
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
      "path": ["/ccapi/ver120/contents/sd/100CANON"]
    }
    """
}
