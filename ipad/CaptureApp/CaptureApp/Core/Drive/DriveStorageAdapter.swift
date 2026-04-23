import Foundation

/// High-level Drive API surface the rest of CreatorHub One calls.
/// Wraps ``DriveRequestBuilder`` + ``DriveResponseParser`` with
/// URLSession + an in-memory folder cache, and owns the access-
/// token refresh loop.
///
/// Scope (MVP):
///   * ``ensureProjectFolder`` — idempotent upsert of a project
///     folder under a parent root.
///   * ``uploadSmallFile`` — JPEG/preview-sized inline multipart
///     upload. Good for ≤5 MB; above that use the resumable path.
///   * ``startResumableUpload`` + ``appendChunk`` — raw/huge-file
///     path. Caller drives the loop so #52 RAW upload pipeline can
///     plug in progress reporting + retry logic without
///     re-implementing the Drive contract.
///
/// Out of scope (deferred):
///   * Shared-drive search, trashed-file recovery, thumbnail
///     generation — out of the critical-path for capture → deliver.
actor DriveStorageAdapter {

    /// Source of the current access token + refresh hook. Split off
    /// so tests can inject a fake without running a real OAuth
    /// exchange.
    protocol CredentialStore: Sendable {
        func currentCredentials() async throws -> DriveCredentials
        func refresh(from expired: DriveCredentials) async throws -> DriveCredentials
    }

    enum DriveError: Error, Equatable {
        case unauthorized(String?)
        case httpStatus(Int, message: String?)
        case malformedResponse
        case missingSessionURL
        case network(String)
    }

    private let credentials: CredentialStore
    private let session: URLSession
    private let endpoints: DriveRequestBuilder.Endpoints
    /// (parentId, folderName) → folderId. Keyed on a composite key
    /// so a rename doesn't silently re-use the old id.
    private var folderCache: [String: String] = [:]

    init(
        credentials: CredentialStore,
        session: URLSession = .shared,
        endpoints: DriveRequestBuilder.Endpoints = .production,
    ) {
        self.credentials = credentials
        self.session = session
        self.endpoints = endpoints
    }

    // MARK: - Folders

    /// Look up or create a folder by name under ``parentId``.
    /// Idempotent + caches hits so repeated calls on the same
    /// project don't hammer Drive.
    func ensureProjectFolder(
        parentId: String,
        name: String,
    ) async throws -> DriveFile {
        let cacheKey = "\(parentId)|\(name)"
        if let existingId = folderCache[cacheKey] {
            return DriveFile(
                id: existingId,
                name: name,
                mimeType: DriveFile.folderMimeType,
                size: nil,
                webViewLink: nil,
            )
        }
        let creds = try await activeCredentials()
        let findRequest = DriveRequestBuilder.findFolder(
            parentId: parentId,
            name: name,
            accessToken: creds.accessToken,
            endpoints: endpoints,
        )
        let (findData, findResponse) = try await send(findRequest)
        try throwIfError(response: findResponse, data: findData)
        if let existing = DriveResponseParser.parseFileList(findData).first {
            folderCache[cacheKey] = existing.id
            return existing
        }
        let createRequest = DriveRequestBuilder.createFolder(
            parentId: parentId,
            name: name,
            accessToken: creds.accessToken,
            endpoints: endpoints,
        )
        let (createData, createResponse) = try await send(createRequest)
        try throwIfError(response: createResponse, data: createData)
        guard let folder = DriveResponseParser.parseFile(createData) else {
            throw DriveError.malformedResponse
        }
        folderCache[cacheKey] = folder.id
        return folder
    }

    // MARK: - Resumable upload

    /// Phase 1 of the chunked upload: initialise the session. The
    /// returned ``DriveResumableSession`` carries the URL for every
    /// subsequent chunk PUT. Callers should persist the URL + byte
    /// offset alongside their outbox row so the upload survives an
    /// app kill (#52).
    func startResumableUpload(
        parentId: String,
        fileName: String,
        mimeType: String,
        totalBytes: Int64,
    ) async throws -> DriveResumableSession {
        let creds = try await activeCredentials()
        let request = DriveRequestBuilder.startResumableUpload(
            parentId: parentId,
            name: fileName,
            mimeType: mimeType,
            totalBytes: totalBytes,
            accessToken: creds.accessToken,
            endpoints: endpoints,
        )
        let (data, response) = try await send(request)
        try throwIfError(response: response, data: data)
        guard let http = response as? HTTPURLResponse,
              let url = DriveResponseParser.parseResumableSessionURL(from: http)
        else {
            throw DriveError.missingSessionURL
        }
        return DriveResumableSession(
            uploadURL: url,
            fileName: fileName,
            mimeType: mimeType,
            totalBytes: totalBytes,
        )
    }

    /// Append a chunk. Returns either:
    ///   * ``.finished(DriveFile)`` — Drive accepted the final byte
    ///     and committed. The file metadata is returned so the
    ///     caller can persist the Drive file id.
    ///   * ``.progress(DriveChunkProgress)`` — Drive wants more
    ///     bytes. Caller should send the next chunk starting at
    ///     ``progress.nextByteToSend``.
    enum ChunkResult: Equatable {
        case finished(DriveFile)
        case progress(DriveChunkProgress)
    }

    func appendChunk(
        session: DriveResumableSession,
        startByte: Int64,
        chunk: Data,
    ) async throws -> ChunkResult {
        var request = DriveRequestBuilder.appendChunk(
            sessionURL: session.uploadURL,
            startByte: startByte,
            chunkLength: Int64(chunk.count),
            totalBytes: session.totalBytes,
            mimeType: session.mimeType,
        )
        request.httpBody = chunk
        let (data, response) = try await send(request)
        guard let http = response as? HTTPURLResponse else {
            throw DriveError.malformedResponse
        }
        switch http.statusCode {
        case 200, 201:
            guard let file = DriveResponseParser.parseFile(data) else {
                throw DriveError.malformedResponse
            }
            return .finished(file)
        case 308:
            return .progress(DriveResponseParser.parseChunkProgress(from: http))
        case 401:
            throw DriveError.unauthorized(DriveResponseParser.parseErrorMessage(data))
        default:
            throw DriveError.httpStatus(
                http.statusCode,
                message: DriveResponseParser.parseErrorMessage(data),
            )
        }
    }

    // MARK: - Credentials

    /// Fetch the live credentials, refreshing if necessary. Wraps
    /// the store so every public method gets the freshness check
    /// without remembering to call it.
    private func activeCredentials() async throws -> DriveCredentials {
        let current = try await credentials.currentCredentials()
        if !current.isExpired() {
            return current
        }
        return try await credentials.refresh(from: current)
    }

    // MARK: - URLSession wrapper

    private func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw DriveError.network(error.localizedDescription)
        }
    }

    private func throwIfError(
        response: URLResponse,
        data: Data,
    ) throws {
        guard let http = response as? HTTPURLResponse else {
            throw DriveError.malformedResponse
        }
        switch http.statusCode {
        case 200...299: return
        case 401:
            throw DriveError.unauthorized(DriveResponseParser.parseErrorMessage(data))
        default:
            throw DriveError.httpStatus(
                http.statusCode,
                message: DriveResponseParser.parseErrorMessage(data),
            )
        }
    }
}
