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

    // MARK: - Direct live view

    /// Starts Canon live view using the exact POST endpoint advertised by the
    /// connected body. The payload shape is already used by CreatorHub's
    /// existing CCAPI backend adapter; endpoint selection remains capability-
    /// negotiated so firmware/API version differences do not get hardcoded.
    func startLiveView(size: String = "small") async throws {
        guard ["small", "medium"].contains(size) else {
            throw CCAPIError.invalidResponse("unsupported liveview size")
        }
        let path = try advertisedEndpoint(
            containing: "/shooting/liveview",
            exactSuffix: "/shooting/liveview",
            method: .post
        )
        try await post(path: path, body: [
            "liveviewsize": size,
            "cameradisplay": "keep"
        ])
    }

    /// Fetches one complete JPEG from Canon's polling `flip` endpoint.
    /// `scroll`, `scrolldetail` and `multipart` are long-lived streams and must
    /// never be sampled with this request/response method: doing so can leave
    /// the body busy and prevent `flip` from producing frames.
    func liveViewFrame() async throws -> Data {
        guard let inventory else { throw CCAPIError.notDiscovered }
        let candidates = inventory.versions
            .sorted { $0.ver > $1.ver }
            .flatMap(\.apis)
            .filter { endpoint in
                endpoint.get == true
                    && endpoint.path.hasSuffix("/shooting/liveview/flip")
            }
        guard !candidates.isEmpty else {
            throw CCAPIError.unsupportedOperation("/shooting/liveview/flip")
        }
        var lastError: Error?
        for endpoint in candidates {
            do {
                let (data, contentType) = try await getBinary(path: endpoint.path, timeout: 3)
                if contentType.lowercased().contains("image/jpeg") || Self.looksLikeJPEG(data) {
                    return data
                }
            } catch {
                lastError = error
            }
        }
        if let lastError { throw lastError }
        throw CCAPIError.invalidResponse("liveview endpoint did not return JPEG")
    }

    /// Reads Canon's detailed finite Live View packet and extracts the image
    /// coordinate space required by `afframeposition`. The packet starts with
    /// a 7-byte metadata header (`FF 00 01` + big-endian JSON length), followed
    /// by JSON and then the JPEG packet.
    func liveViewGeometry() async throws -> CCAPILiveViewGeometry {
        let path = try advertisedEndpoint(
            containing: "/shooting/liveview/flipdetail",
            exactSuffix: "/shooting/liveview/flipdetail",
            method: .get
        )
        let (data, _) = try await getBinary(path: path + "?kind=both", timeout: 3)
        return try Self.parseLiveViewGeometry(data)
    }

    static func parseLiveViewGeometry(_ data: Data) throws -> CCAPILiveViewGeometry {
        guard data.count >= 7,
              data[data.startIndex] == 0xff,
              data[data.index(data.startIndex, offsetBy: 1)] == 0x00,
              data[data.index(data.startIndex, offsetBy: 2)] == 0x01
        else { throw CCAPIError.invalidResponse("invalid flipdetail metadata header") }
        let lengthBytes = (3...6).map { UInt32(data[data.index(data.startIndex, offsetBy: $0)]) }
        let jsonLength = Int(
            (lengthBytes[0] << 24)
                | (lengthBytes[1] << 16)
                | (lengthBytes[2] << 8)
                | lengthBytes[3]
        )
        guard jsonLength > 0, data.count >= 7 + jsonLength else {
            throw CCAPIError.invalidResponse("truncated flipdetail metadata")
        }
        let json = data.subdata(in: 7..<(7 + jsonLength))
        let envelope: CCAPILiveViewDetailEnvelope
        do {
            envelope = try JSONDecoder().decode(CCAPILiveViewDetailEnvelope.self, from: json)
        } catch {
            throw CCAPIError.decode(String(describing: error))
        }
        let detail = envelope.liveviewdata
        guard detail.image.sizex > 0,
              detail.image.sizey > 0,
              detail.visible.positionwidth > 0,
              detail.visible.positionheight > 0
        else { throw CCAPIError.invalidResponse("empty flipdetail geometry") }
        return CCAPILiveViewGeometry(
            imageWidth: detail.image.sizex,
            imageHeight: detail.image.sizey,
            visibleX: detail.visible.positionx,
            visibleY: detail.visible.positiony,
            visibleWidth: detail.visible.positionwidth,
            visibleHeight: detail.visible.positionheight
        )
    }

    /// Stops the exact Live View lifecycle the body advertises. Some Canon
    /// bodies, including the verified R6 Mark II, expose POST-only on the
    /// general endpoint and use Canon's documented `liveviewsize: off` body.
    func stopLiveView() async {
        if let path = try? advertisedEndpoint(
            containing: "/shooting/liveview",
            exactSuffix: "/shooting/liveview",
            method: .delete
        ) {
            try? await delete(path: path)
            return
        }
        guard let path = try? advertisedEndpoint(
            containing: "/shooting/liveview",
            exactSuffix: "/shooting/liveview",
            method: .post
        ) else { return }
        try? await post(path: path, body: [
            "liveviewsize": "off",
            "cameradisplay": "on"
        ])
    }

    // MARK: - Direct movie control

    /// Returns only operations advertised by this specific camera. Movie
    /// recording is intentionally separate from the still-image shutter.
    func videoCapabilities() throws -> CCAPIVideoCapabilities {
        guard inventory != nil else { throw CCAPIError.notDiscovered }
        let canRecordMovie = (try? advertisedEndpoint(
            containing: "/shooting/control/recbutton",
            exactSuffix: "/shooting/control/recbutton",
            method: .post
        )) != nil
        let writableSettings = Set(CCAPIShootingSettingKey.allCases.filter { key in
            writableSettingEndpoint(key) != nil
        })
        return CCAPIVideoCapabilities(
            canRecordMovie: canRecordMovie,
            writableSettings: writableSettings,
            canDriveFocus: supportsAdvertisedEndpoint(
                suffix: "/shooting/control/drivefocus",
                method: .post
            ),
            canAutoFocus: supportsAdvertisedEndpoint(
                suffix: "/shooting/control/af",
                method: .post
            ),
            canSetAFFrame: supportsAdvertisedEndpoint(
                suffix: "/shooting/liveview/afframeposition",
                method: .put
            )
        )
    }

    /// Reads each exposure value from its exact advertised resource. This
    /// keeps the ability list tied to the same endpoint used for writes and
    /// lets bodies omit controls they do not support in the active mode.
    func videoShootingSettings() async throws -> [CCAPIShootingSettingKey: CCAPIChoiceSetting] {
        guard inventory != nil else { throw CCAPIError.notDiscovered }
        var settings: [CCAPIShootingSettingKey: CCAPIChoiceSetting] = [:]
        for key in CCAPIShootingSettingKey.allCases {
            guard let path = readableSettingEndpoint(key) else { continue }
            do {
                let setting: CCAPIChoiceSetting = try await get(path: path)
                guard !setting.ability.isEmpty, setting.ability.contains(setting.value) else { continue }
                settings[key] = setting
            } catch CCAPIError.cameraBusy {
                continue
            } catch CCAPIError.httpStatus(let code, _) where code == 503 {
                // A setting can be advertised by the body but unavailable in
                // the active shooting mode. Keep the other controls visible.
                continue
            } catch CCAPIError.decode {
                // Some optional settings use camera-specific object payloads.
                // They must not make TV/AV/ISO disappear from the whole panel.
                continue
            }
        }
        return settings
    }

    /// Writes only a camera-advertised value through an endpoint that
    /// advertises both GET and PUT. A fresh GET confirms the applied value.
    func updateVideoShootingSetting(
        _ key: CCAPIShootingSettingKey,
        value: String
    ) async throws -> CCAPIChoiceSetting {
        guard let path = writableSettingEndpoint(key) else {
            throw CCAPIError.unsupportedOperation("/shooting/settings/\(key.rawValue)")
        }
        let current: CCAPIChoiceSetting = try await get(path: path)
        guard current.ability.contains(value) else {
            throw CCAPIError.invalidResponse("value is not advertised for \(key.rawValue)")
        }
        let wireValue: any Sendable = if key == .colortemperature, let integer = Int(value) {
            integer
        } else {
            value
        }
        try await put(path: path, body: ["value": wireValue])
        let confirmed: CCAPIChoiceSetting = try await get(path: path)
        guard confirmed.value == value else {
            throw CCAPIError.invalidResponse("camera did not confirm \(key.rawValue)")
        }
        return confirmed
    }

    /// Canon CCAPI movie start/stop. The command is available only when the
    /// connected body advertises the dedicated recbutton POST operation.
    func setMovieRecording(_ recording: Bool) async throws {
        let path = try advertisedEndpoint(
            containing: "/shooting/control/recbutton",
            exactSuffix: "/shooting/control/recbutton",
            method: .post
        )
        try await post(path: path, body: ["action": recording ? "start" : "stop"])
    }

    /// Moves focus by one camera-defined step. Canon exposes relative drive
    /// amounts rather than an absolute lens-distance scale.
    func driveFocus(_ drive: CCAPIFocusDrive) async throws {
        let path = try advertisedEndpoint(
            containing: "/shooting/control/drivefocus",
            exactSuffix: "/shooting/control/drivefocus",
            method: .post
        )
        try await post(path: path, body: ["value": drive.rawValue])
    }

    /// Starts or stops Canon's AF instruction. Focus result information is
    /// delivered with detailed Live View metadata, not by this response.
    func setAutoFocus(_ active: Bool) async throws {
        let path = try advertisedEndpoint(
            containing: "/shooting/control/af",
            exactSuffix: "/shooting/control/af",
            method: .post
        )
        try await post(path: path, body: ["action": active ? "start" : "stop"])
    }

    func setAFFramePosition(x: Int, y: Int) async throws {
        let path = try advertisedEndpoint(
            containing: "/shooting/liveview/afframeposition",
            exactSuffix: "/shooting/liveview/afframeposition",
            method: .put
        )
        try await put(path: path, body: ["positionx": x, "positiony": y])
    }

    /// Downloads camera media through URLSession's file-backed download path,
    /// avoiding a full movie in memory. Absolute URLs are accepted only when
    /// they remain on the connected camera origin.
    func downloadContentToDirectory(
        contentPath: String,
        directory: URL,
        onProgress: (@Sendable (CCAPIMediaTransferProgress) async -> Void)? = nil
    ) async throws -> URL {
        let contentURL = try sameOriginContentURL(contentPath)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        let originalName = contentURL.lastPathComponent.isEmpty
            ? "CANON-\(UUID().uuidString.lowercased()).mp4"
            : contentURL.lastPathComponent
        let destination = Self.uniqueDestination(directory: directory, fileName: originalName)
        var request = URLRequest(url: contentURL)
        request.httpMethod = "GET"
        let startedAt = Date()
        if let onProgress {
            await onProgress(CCAPIMediaTransferProgress(
                receivedBytes: 0,
                totalBytes: nil,
                elapsedSeconds: 0
            ))
        }
        let response = try await download(
            request: request,
            destination: destination,
            startedAt: startedAt,
            onProgress: onProgress
        )
        guard let http = response as? HTTPURLResponse else {
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(code: http.statusCode, body: nil)
        }
        let downloadedBytes = (try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize)
            .map(Int64.init) ?? 0
        let expectedBytes = response.expectedContentLength > 0
            ? response.expectedContentLength
            : (downloadedBytes > 0 ? downloadedBytes : nil)
        if let onProgress {
            await onProgress(CCAPIMediaTransferProgress(
                receivedBytes: downloadedBytes,
                totalBytes: expectedBytes,
                elapsedSeconds: Date().timeIntervalSince(startedAt)
            ))
        }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDestination = destination
        try? mutableDestination.setResourceValues(values)
        return destination
    }

    private func download(
        request: URLRequest,
        destination: URL,
        startedAt: Date,
        onProgress: (@Sendable (CCAPIMediaTransferProgress) async -> Void)?
    ) async throws -> URLResponse {
        let stream = AsyncThrowingStream<URLResponse, Error> { continuation in
            let task = session.downloadTask(with: request) { temporaryURL, response, error in
                if let error {
                    continuation.finish(throwing: error)
                    return
                }
                guard let temporaryURL, let response else {
                    continuation.finish(throwing: CCAPIError.invalidResponse("empty download response"))
                    return
                }
                if let http = response as? HTTPURLResponse,
                   !(200..<300).contains(http.statusCode) {
                    continuation.finish(throwing: CCAPIError.httpStatus(code: http.statusCode, body: nil))
                    return
                }
                do {
                    try FileManager.default.moveItem(at: temporaryURL, to: destination)
                    continuation.yield(response)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            let progressTask = Task {
                while !Task.isCancelled, task.state != .completed {
                    let received = max(0, task.countOfBytesReceived)
                    let expected = task.countOfBytesExpectedToReceive > 0
                        ? task.countOfBytesExpectedToReceive
                        : nil
                    if let onProgress {
                        await onProgress(CCAPIMediaTransferProgress(
                            receivedBytes: received,
                            totalBytes: expected,
                            elapsedSeconds: Date().timeIntervalSince(startedAt)
                        ))
                    }
                    try? await Task.sleep(for: .milliseconds(100))
                }
            }
            continuation.onTermination = { @Sendable reason in
                progressTask.cancel()
                if case .cancelled = reason { task.cancel() }
            }
            task.resume()
        }
        for try await response in stream { return response }
        throw CCAPIError.invalidResponse("download completed without a response")
    }

    private enum HTTPMethod {
        case get, post, put, delete
    }

    private func advertisedEndpoint(
        containing fragment: String,
        exactSuffix: String,
        method: HTTPMethod
    ) throws -> String {
        guard let inventory else { throw CCAPIError.notDiscovered }
        let match = inventory.versions
            .sorted { $0.ver > $1.ver }
            .flatMap(\.apis)
            .first { endpoint in
                endpoint.path.contains(fragment)
                    && endpoint.path.hasSuffix(exactSuffix)
                    && supports(endpoint: endpoint, method: method)
            }
        guard let match else { throw CCAPIError.unsupportedOperation(exactSuffix) }
        return match.path
    }

    private func supports(endpoint: CCAPIEndpoint, method: HTTPMethod) -> Bool {
        switch method {
        case .get: endpoint.get == true
        case .post: endpoint.post == true
        case .put: endpoint.put == true
        case .delete: endpoint.delete == true
        }
    }

    private func supportsAdvertisedEndpoint(suffix: String, method: HTTPMethod) -> Bool {
        guard let inventory else { return false }
        return inventory.versions
            .flatMap(\.apis)
            .contains { $0.path.hasSuffix(suffix) && supports(endpoint: $0, method: method) }
    }

    private func readableSettingEndpoint(_ key: CCAPIShootingSettingKey) -> String? {
        try? advertisedEndpoint(
            containing: "/shooting/settings/\(key.rawValue)",
            exactSuffix: "/shooting/settings/\(key.rawValue)",
            method: .get
        )
    }

    private func writableSettingEndpoint(_ key: CCAPIShootingSettingKey) -> String? {
        guard let inventory else { return nil }
        let suffix = "/shooting/settings/\(key.rawValue)"
        return inventory.versions
            .sorted { $0.ver > $1.ver }
            .flatMap(\.apis)
            .first { endpoint in
                endpoint.path.hasSuffix(suffix)
                    && endpoint.get == true
                    && endpoint.put == true
            }?
            .path
    }

    private func sameOriginContentURL(_ path: String) throws -> URL {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL,
              url.scheme?.lowercased() == baseURL.scheme?.lowercased(),
              url.host?.lowercased() == baseURL.host?.lowercased(),
              Self.effectivePort(for: url) == Self.effectivePort(for: baseURL)
        else {
            throw CCAPIError.invalidResponse("camera returned a cross-origin content URL")
        }
        return url
    }

    private static func effectivePort(for url: URL) -> Int? {
        if let port = url.port { return port }
        switch url.scheme?.lowercased() {
        case "http": return 80
        case "https": return 443
        default: return nil
        }
    }

    private static func uniqueDestination(directory: URL, fileName: String) -> URL {
        let safeName = URL(fileURLWithPath: fileName).lastPathComponent
        let initial = directory.appendingPathComponent(safeName)
        guard FileManager.default.fileExists(atPath: initial.path) else { return initial }
        let stem = initial.deletingPathExtension().lastPathComponent
        let ext = initial.pathExtension
        let uniqueName = "\(stem)-\(UUID().uuidString.lowercased())"
            + (ext.isEmpty ? "" : ".\(ext)")
        return directory.appendingPathComponent(uniqueName)
    }

    private func getBinary(path: String, timeout: TimeInterval) async throws -> (Data, String) {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw CCAPIError.invalidResponse("bad URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        let started = Date()
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw CCAPIError.timedOut
        } catch let urlError as URLError {
            throw CCAPIError.network(String(describing: urlError.code))
        }
        guard let http = response as? HTTPURLResponse else {
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        await recorder?.recordHTTP(
            method: "GET",
            relativePath: path + " (\(data.count) liveview bytes)",
            requestBody: nil,
            statusCode: http.statusCode,
            responseBody: nil,
            durationMs: Date().timeIntervalSince(started) * 1000
        )
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(code: http.statusCode, body: nil)
        }
        return (data, http.value(forHTTPHeaderField: "Content-Type") ?? "")
    }

    private func delete(path: String) async throws {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw CCAPIError.invalidResponse("bad URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(
                code: http.statusCode,
                body: String(data: data, encoding: .utf8)
            )
        }
    }

    private func put(path: String, body: [String: any Sendable]) async throws {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw CCAPIError.invalidResponse("bad URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let requestBody = try JSONSerialization.data(withJSONObject: body)
        request.httpBody = requestBody
        let started = Date()
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CCAPIError.invalidResponse("not HTTPURLResponse")
        }
        await recorder?.recordHTTP(
            method: "PUT",
            relativePath: path,
            requestBody: requestBody,
            statusCode: http.statusCode,
            responseBody: data,
            durationMs: Date().timeIntervalSince(started) * 1000
        )
        if http.statusCode == 503 { throw CCAPIError.cameraBusy }
        guard (200..<300).contains(http.statusCode) else {
            throw CCAPIError.httpStatus(
                code: http.statusCode,
                body: String(data: data, encoding: .utf8)
            )
        }
    }

    private static func looksLikeJPEG(_ data: Data) -> Bool {
        data.count >= 4
            && data[data.startIndex] == 0xff
            && data[data.index(after: data.startIndex)] == 0xd8
            && data[data.index(data.endIndex, offsetBy: -2)] == 0xff
            && data[data.index(before: data.endIndex)] == 0xd9
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
        // 🔑 Query-BEVARENDE bygging. `appendingPathComponent` prosent-koder «?»
        // til «%3F» → long-poll-stien «…/event/polling?continue=on» tapte
        // `continue=on` (kamera blokkerte ikke). `getAbsolute(path:)` bruker
        // `URL(string:relativeTo:)` som beholder query-strengen intakt.
        try await getAbsolute(path: path, timeout: timeout)
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
