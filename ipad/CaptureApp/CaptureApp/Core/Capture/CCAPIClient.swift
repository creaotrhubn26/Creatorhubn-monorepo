import Foundation

/// Typed HTTP client for Canon's Camera Control API.
/// Spec: Canon CCAPI Reference v1.4.0 (NDA — not in repo).
///
/// This client is capability-negotiating: on `connect()` it calls `/ccapi`
/// to discover which endpoints this specific body supports. All subsequent
/// methods check `supports()` before issuing requests and throw
/// `.unsupportedOperation` for endpoints missing on the body.
///
/// Endpoint PATHS in this file are authoritative stubs derived from the
/// CCAPI Reference table of contents + sections 4.7 / 4.13 / 6.1 / 6.2.
/// Any path marked `// TODO: verify spec §X.Y` must be confirmed against
/// the reference on first live integration (task #6 exit) before the client
/// is trusted for production.
actor CCAPIClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let recorder: CCAPISessionRecorder?
    private var inventory: CCAPIInventory?

    init(
        baseURL: URL,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder(),
        recorder: CCAPISessionRecorder? = CCAPISessionRecorder.shared,
    ) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = decoder
        self.recorder = recorder
    }

    /// Strip the camera's base URL out of an absolute URL so the logged
    /// path is relative (``/ccapi/ver100/shooting/...``). Keeps the log
    /// portable across cameras with different IPs.
    private func relativePath(_ url: URL) -> String {
        let abs = url.absoluteString
        let base = baseURL.absoluteString
        if abs.hasPrefix(base) {
            return String(abs.dropFirst(base.count))
        }
        return url.path
    }

    /// Build a `URLSession` that trusts the self-signed certificate served by
    /// a Canon CCAPI camera at `baseURL.host`. The delegate's trust is scoped
    /// to that single host — other hosts still get normal TLS validation.
    ///
    /// Retains the delegate via the session's strong reference so the caller
    /// doesn't have to keep it alive separately. Use once per client.
    static func makeInsecureSession(trustingHostOf baseURL: URL) -> URLSession {
        let host = baseURL.host ?? ""
        let delegate = CCAPIInsecureTrustDelegate(trustedHost: host)
        let config = URLSessionConfiguration.ephemeral
        return URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    }

    // MARK: - Discovery

    /// `GET /ccapi` — returns the inventory of supported API versions + paths.
    /// Must be called once before any other method. See spec §6.1.
    @discardableResult
    func connect() async throws -> CCAPIInventory {
        let inventory: CCAPIInventory = try await get(path: "/ccapi")
        self.inventory = inventory
        return inventory
    }

    var isConnected: Bool { inventory != nil }

    var capabilities: CCAPIInventory? { inventory }

    // MARK: - Camera information

    /// Device information (model, serial, firmware). See spec §6.2.1.
    /// TODO: verify path against spec §4.4.1 before first live run.
    func deviceInformation() async throws -> CCAPIDeviceInformation {
        try await getVersioned(
            base: "/deviceinformation",
            minVersion: "ver100",
        )
    }

    // MARK: - Storages + contents (§4.7)

    /// List of storage URLs. Spec §4.7.1.
    /// R6 Mark II exposes this at ver110 (verified 2026-04-17).
    func listStorages() async throws -> [CCAPIStorage] {
        let wrapper: CCAPIStorageList = try await getVersioned(
            base: "/devicestatus/storage",
            minVersion: "ver110",
        )
        return wrapper.storagelist
    }

    /// List of directory URLs under a storage. Spec §4.7.2.
    /// `storagePath` is an absolute path like `/sd/DCIM` — use the URL from
    /// listStorages() as the prefix.
    func listDirectories(storagePath: String) async throws -> [String] {
        let wrapper: CCAPIContentsURLList = try await getAbsolute(
            path: storagePath,
        )
        return wrapper.path
    }

    /// Pagination metadata for a directory. Spec §contents kind=number.
    /// Always safe to call (no side effects); returns the total file count
    /// plus how many `kind=list` pages we'd need to enumerate every file.
    func listContentsNumber(directoryPath: String) async throws -> CCAPIContentsNumber {
        try await getAbsolute(path: directoryPath + "?kind=number")
    }

    /// All content URLs under a directory, auto-paginated.
    /// CCAPI returns up to 100 URLs per `page`; we fetch every page and
    /// concatenate. Pass `maxPages` when you want to cap enumeration (e.g.,
    /// a progressive UI that only needs the newest N assets up front).
    func listContents(
        directoryPath: String,
        maxPages: Int? = nil,
    ) async throws -> [String] {
        let meta = try await listContentsNumber(directoryPath: directoryPath)
        let pagesToFetch = min(meta.pagenumber, maxPages ?? meta.pagenumber)
        guard pagesToFetch > 0 else { return [] }
        var all: [String] = []
        all.reserveCapacity(meta.contentsnumber)
        for page in 1...pagesToFetch {
            let wrapper: CCAPIContentsURLList = try await getAbsolute(
                path: "\(directoryPath)?kind=list&page=\(page)",
            )
            all.append(contentsOf: wrapper.path)
        }
        return all
    }

    /// Download the binary content at `contentURL`. Supports HTTP Range for
    /// resumable downloads. Spec §4.7.5 Get contents.
    func downloadContent(
        contentURL: URL,
        range: Range<Int64>? = nil,
    ) async throws -> (Data, Int64) {
        var request = URLRequest(url: contentURL)
        request.httpMethod = "GET"
        if let range {
            request.setValue("bytes=\(range.lowerBound)-\(range.upperBound - 1)",
                              forHTTPHeaderField: "Range")
        }
        let path = relativePath(contentURL)
        let started = Date()
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            await recorder?.recordError(method: "GET", relativePath: path, error: String(describing: error))
            throw error
        }
        guard let http = response as? HTTPURLResponse else {
            await recorder?.recordError(method: "GET", relativePath: path, error: "not HTTPURLResponse")
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        // Content downloads are JPEG/RAW bytes — too large to log and
        // would leak image data. Record metadata only: size, range,
        // status, duration. ``nil`` responseBody hints the replay side
        // that actual bytes are elsewhere (or synthetic).
        await recorder?.recordHTTP(
            method: "GET",
            relativePath: path + (range.map { " (range=\($0.lowerBound)-\($0.upperBound - 1))" } ?? " (\(data.count) bytes)"),
            requestBody: nil,
            statusCode: http.statusCode,
            responseBody: nil,
            durationMs: Date().timeIntervalSince(started) * 1000,
        )
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(
                code: http.statusCode,
                body: String(data: data, encoding: .utf8),
            )
        }
        let totalSize = Int64(http.expectedContentLength)
        return (data, totalSize)
    }

    // MARK: - Shooting control (§shutterbutton)

    /// Takes a still image by pressing then releasing the shutter via the
    /// `/manual` endpoint. `af: false` skips autofocus — useful when AF would
    /// fail (lens cap on, featureless target). The resulting file shows up in
    /// the next polling diff's `addedcontents`.
    /// Spec: CCAPI Reference v1.4.0 §shutterbutton/manual.
    func triggerManualShutter(af: Bool = true) async throws {
        let path = "/ccapi/ver100/shooting/control/shutterbutton/manual"
        try await post(path: path, body: ["action": "full_press", "af": af])
        try await post(path: path, body: ["action": "release", "af": af])
    }

    private func post(path: String, body: [String: any Sendable]) async throws {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let requestBody = try JSONSerialization.data(withJSONObject: body)
        request.httpBody = requestBody
        let started = Date()
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            await recorder?.recordError(method: "POST", relativePath: path, error: "timedOut")
            throw CCAPIError.timedOut
        } catch let urlError as URLError {
            await recorder?.recordError(method: "POST", relativePath: path, error: String(describing: urlError.code))
            throw CCAPIError.network(String(describing: urlError.code))
        }
        guard let http = response as? HTTPURLResponse else {
            await recorder?.recordError(method: "POST", relativePath: path, error: "not HTTPURLResponse")
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        await recorder?.recordHTTP(
            method: "POST",
            relativePath: path,
            requestBody: requestBody,
            statusCode: http.statusCode,
            responseBody: data,
            durationMs: Date().timeIntervalSince(started) * 1000,
        )
        if http.statusCode == 503 { throw CCAPIError.cameraBusy }
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(
                code: http.statusCode,
                body: String(data: data, encoding: .utf8),
            )
        }
    }

    // MARK: - Event polling (§4.13.1)

    /// Short poll: returns the current diff immediately. Spec §4.13.1.
    /// Response is lenient — only changed fields are populated.
    /// `ver100` because the original R5 exposes polling only there; the
    /// R6 Mark II has it at ver110 too but `pickVersion` picks the highest
    /// advertised version, so newer bodies still use ver110 and R5 falls
    /// back cleanly. Verified against R5 fixture 2026-04-18.
    func pollEvents() async throws -> CCAPIPollingResponse {
        try await getVersioned(
            base: "/event/polling",
            minVersion: "ver100",
        )
    }

    /// Long poll: server blocks up to ~30s waiting for the next event.
    /// Spec §4.13.1 + §6.2.25 Get Event (polling?continue=on).
    /// Same version logic as `pollEvents`.
    func longPollEvents(timeout: TimeInterval = 30) async throws -> CCAPIPollingResponse {
        try await getVersioned(
            base: "/event/polling?continue=on",
            minVersion: "ver100",
            timeout: timeout,
        )
    }

    // MARK: - Internal helpers

    private func getVersioned<T: Decodable>(
        base: String,
        minVersion: String,
        timeout: TimeInterval? = nil,
    ) async throws -> T {
        guard let inventory else { throw CCAPIError.notDiscovered }
        // Inventory entries never carry a query string; match on path only,
        // then re-attach the query when issuing the request.
        let (basePath, query) = Self.splitQuery(base)
        guard
            let version = pickVersion(
                inventory: inventory,
                base: basePath,
                minVersion: minVersion,
            )
        else {
            throw CCAPIError.unsupportedOperation(base)
        }
        return try await get(path: "/ccapi/\(version)\(basePath)\(query)", timeout: timeout)
    }

    private static func splitQuery(_ base: String) -> (path: String, query: String) {
        guard let q = base.firstIndex(of: "?") else { return (base, "") }
        return (String(base[..<q]), String(base[q...]))
    }

    private func get<T: Decodable>(
        path: String,
        timeout: TimeInterval? = nil,
    ) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        return try await getAbsolute(url: url, timeout: timeout)
    }

    private func getAbsolute<T: Decodable>(
        path: String,
        timeout: TimeInterval? = nil,
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) ?? URL(string: path)
        else {
            throw CCAPIError.invalidResponse("bad URL: \(path)")
        }
        return try await getAbsolute(url: url, timeout: timeout)
    }

    private func getAbsolute<T: Decodable>(
        url: URL,
        timeout: TimeInterval? = nil,
    ) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let timeout {
            request.timeoutInterval = timeout
        }
        let path = relativePath(url)
        let started = Date()
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            await recorder?.recordError(method: "GET", relativePath: path, error: "timedOut")
            throw CCAPIError.timedOut
        } catch let urlError as URLError {
            await recorder?.recordError(method: "GET", relativePath: path, error: String(describing: urlError.code))
            throw CCAPIError.network(String(describing: urlError.code))
        }
        guard let http = response as? HTTPURLResponse else {
            await recorder?.recordError(method: "GET", relativePath: path, error: "not HTTPURLResponse")
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        await recorder?.recordHTTP(
            method: "GET",
            relativePath: path,
            requestBody: nil,
            statusCode: http.statusCode,
            responseBody: data,
            durationMs: Date().timeIntervalSince(started) * 1000,
        )
        if http.statusCode == 503 {
            throw CCAPIError.cameraBusy
        }
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(
                code: http.statusCode,
                body: String(data: data, encoding: .utf8),
            )
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw CCAPIError.decode(String(describing: error))
        }
    }

    /// Among available versions that expose `<ver>/<base>`, pick the highest
    /// that satisfies `minVersion`. Versions compare lexicographically — works
    /// because the format is fixed "ver" + zero-padded triple.
    private func pickVersion(
        inventory: CCAPIInventory,
        base: String,
        minVersion: String,
    ) -> String? {
        let candidates = inventory.versions
            .filter { $0.apis.contains { $0.path.hasSuffix(base) } }
            .map(\.ver)
            .filter { $0 >= minVersion }
            .sorted(by: >)
        return candidates.first
    }
}
