#if DEBUG
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// In-process fake of a Canon CCAPI-enabled body. Drives both the test
/// suite and the app's Demo Mode (connect to `https://camera.demo` to
/// stand up a fake locally without hardware). DEBUG-only.
///
/// One body, one storage card, N known assets at start. Each call to
/// `simulateCapture()` queues a new content URL that the next polling
/// request will return as `addedcontents`. Shutter POSTs also trigger
/// a simulated capture in Demo Mode.
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
            contentBodies[path] = Self.makePreviewJPEG(seed: i + 1)
        }
    }

    /// Initial card contents — present from `connect()` onward.
    func initialContentURLs() -> [String] {
        Array(contentBodies.keys).sorted()
    }

    /// Queue a new content URL so the next `pollEvents` call returns it as
    /// `addedcontents`. Also stages a small body for `downloadContent`.
    func simulateCapture(filename: String, body: Data? = nil) -> String {
        let url = "/ccapi/ver120/contents/sd/100CANON/\(filename)"
        lock.lock()
        defer { lock.unlock() }
        pendingAddedContents.append(url)
        contentBodies[url] = body ?? Self.makePreviewJPEG(seed: abs(filename.hashValue))
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

        case "/ccapi/ver100/shooting/control/shutterbutton/manual",
             "/ccapi/ver100/shooting/control/shutterbutton":
            return shutterResponse(for: request, url: url)

        default:
            // Contents-directory pagination: /ccapi/ver120/contents/sd/100CANON
            // with optional ?kind=number or ?kind=list&page=N.
            if url.path == "/ccapi/ver120/contents/sd/100CANON" {
                return contentsDirectoryResponse(for: url)
            }
            // Content file download: look up by path WITHOUT query so
            // ?kind=display, ?kind=thumbnail, ?kind=main all resolve to
            // the same bytes. Real camera would return different sizes,
            // but for unit-test wiring they're equivalent.
            lock.lock()
            let bodyIgnoringQuery = contentBodies[url.path]
            lock.unlock()
            if let body = bodyIgnoringQuery {
                return MockURLProtocol.binaryResponse(for: url, body: body)
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
        let emitSnapshot = (pollCount == 1)
        let currentPoll = pollCount
        lock.unlock()

        var fields: [String] = []
        if !drained.isEmpty {
            let urls = drained.map { "\"\($0)\"" }.joined(separator: ",")
            fields.append("\"addedcontents\":[\(urls)]")
        }
        if emitSnapshot {
            // Full telemetry snapshot on the first poll — matches what a
            // real camera does when a client starts polling fresh.
            fields.append(contentsOf: [
                #""battery":{"kind":"battery","name":"LP-E6NH","quality":"normal","level":"78"}"#,
                #""lens":{"mount":true,"name":"RF50mm F1.8 STM"}"#,
                #""av":{"value":"f5.0","ability":["f1.8","f2.8","f4.0","f5.0","f5.6","f8.0","f11","f16"]}"#,
                #""tv":{"value":"1/125","ability":["1/30","1/60","1/125","1/250","1/500"]}"#,
                #""iso":{"value":"400","ability":["auto","100","200","400","800","1600","3200"]}"#,
                #""storage":{"storagelist":[{"name":"card1","path":"/ccapi/ver120/contents/sd","accesscapability":"readwrite","maxsize":256000000000,"spacesize":119000000000,"contentsnumber":\#(initialContentURLs().count)}]}"#,
            ])
        } else if !drained.isEmpty {
            // After a capture, surface the updated file count + a tiny
            // battery drain so the footer feels alive. 78 → 77 → 76 …
            let simulatedLevel = max(10, 78 - ((currentPoll / 20) % 70))
            fields.append(#""battery":{"kind":"battery","name":"LP-E6NH","quality":"normal","level":"\#(simulatedLevel)"}"#)
            fields.append(#""storage":{"storagelist":[{"name":"card1","path":"/ccapi/ver120/contents/sd","accesscapability":"readwrite","maxsize":256000000000,"spacesize":119000000000,"contentsnumber":\#(contentBodies.count)}]}"#)
        }
        let body = "{" + fields.joined(separator: ",") + "}"
        return MockURLProtocol.jsonResponse(for: url, body: body)
    }

    /// Full-press registers one simulated capture; release is a no-op so
    /// the press/release pair counts as a single shot (matches what the
    /// iPad's `CCAPIClient.triggerManualShutter` sends in the real app).
    private func shutterResponse(for request: URLRequest, url: URL) -> (HTTPURLResponse, Data) {
        let body = (request.httpBody ?? Self.drainStream(request.httpBodyStream)) ?? Data()
        let json = String(data: body, encoding: .utf8) ?? ""
        if json.contains("full_press") {
            let filename = String(format: "IMG_%04d.JPG", Int.random(in: 9001...9999))
            _ = simulateCapture(filename: filename)
        }
        return MockURLProtocol.jsonResponse(for: url, body: "{}")
    }

    private static func drainStream(_ stream: InputStream?) -> Data? {
        guard let stream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buf = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let n = stream.read(&buf, maxLength: buf.count)
            if n <= 0 { break }
            data.append(buf, count: n)
        }
        return data
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

    /// Generates a real 640x480 JPEG with a seeded two-tone background so
    /// each fake asset looks distinct in the filmstrip and has actual
    /// decodable pixels the DemoEnhancer can run CoreImage over. Used only
    /// in DEBUG / Demo Mode; tests that just check file existence don't
    /// care about what's inside but this still satisfies them.
    static func makePreviewJPEG(seed: Int) -> Data {
        let width = 640, height = 480
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.noneSkipLast.rawValue
        guard let ctx = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return Data() }

        let s = abs(seed)
        let r = CGFloat((s * 47) % 256) / 255.0
        let g = CGFloat((s * 91) % 256) / 255.0
        let b = CGFloat((s * 157) % 256) / 255.0

        // Background: lighter hue
        ctx.setFillColor(CGColor(red: min(1, r + 0.2), green: min(1, g + 0.2), blue: min(1, b + 0.2), alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

        // Offset rectangle: darker hue for visual interest
        ctx.setFillColor(CGColor(red: r * 0.6, green: g * 0.6, blue: b * 0.6, alpha: 1))
        ctx.fill(CGRect(x: 80, y: 80, width: width - 160, height: height - 160))

        // Inner accent: a narrow strip
        ctx.setFillColor(CGColor(red: min(1, r + 0.35), green: min(1, g + 0.35), blue: min(1, b + 0.35), alpha: 1))
        ctx.fill(CGRect(x: 0, y: height / 2 - 8, width: width, height: 16))

        guard let cgImage = ctx.makeImage() else { return Data() }

        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            data,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { return Data() }
        CGImageDestinationAddImage(
            destination,
            cgImage,
            [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary
        )
        CGImageDestinationFinalize(destination)
        return data as Data
    }
}
#endif
