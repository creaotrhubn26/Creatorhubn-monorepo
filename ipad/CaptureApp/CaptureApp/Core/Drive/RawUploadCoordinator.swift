import Foundation

/// Orchestrates a single RAW-file resumable upload to Drive using
/// ``DriveStorageAdapter``. Hands UI callers a stream of progress
/// states so a SwiftUI view can render a live progress bar without
/// polling the actor.
///
/// Responsibilities:
///   * Read the source file in ``ChunkPlanner``-sized slices.
///   * Initialise (or resume) the Drive resumable session.
///   * PUT each chunk in sequence, surfacing progress after each.
///   * Re-drive from ``DriveChunkProgress`` on a transient failure
///     so a spotty LTE connection doesn't restart 50 MB of upload.
///   * Persist the session URL + last-confirmed byte to disk so an
///     app-kill mid-upload recovers on relaunch (persistence adapter
///     injected so tests don't touch the filesystem).
///
/// Retry policy: mirrors ``OutboxWorker``/``RealtimeBackoff`` — 1s,
/// 2s, 5s, 15s, 60s, clamped. Permanent Drive errors (4xx other
/// than 408/429) skip the retry and fail the upload.
actor RawUploadCoordinator {

    /// Persistence contract. Production is disk-backed, tests inject
    /// an in-memory fake. Keyed on the outbox mutation id (which
    /// survives app kill) so lookups are deterministic.
    protocol PersistenceStore: Sendable {
        func savedSession(for uploadId: UUID) async throws -> PersistedSession?
        func persist(_ session: PersistedSession) async throws
        func clear(for uploadId: UUID) async throws
    }

    struct PersistedSession: Equatable, Sendable {
        let uploadId: UUID
        let sessionURL: URL
        let fileName: String
        let mimeType: String
        let totalBytes: Int64
        /// Last byte Drive confirmed on the last successful chunk.
        /// -1 means "no chunk has committed yet".
        let lastByteReceived: Int64
    }

    /// Progress state stream caller observes for UI updates.
    enum Progress: Equatable, Sendable {
        case planning
        case uploading(bytesSent: Int64, total: Int64)
        case finished(DriveFile)
        case failed(String)
    }

    enum UploadError: Error, Equatable {
        case fileReadFailed(String)
        case driveRejected(Int, message: String?)
        case tooManyRetries
        case cancelled
    }

    private let adapter: DriveStorageAdapter
    private let persistence: PersistenceStore
    private let chunkSize: Int64
    private let maxRetries: Int

    /// Track active uploads so ``cancel`` can find + stop them.
    private var activeUploads: Set<UUID> = []

    init(
        adapter: DriveStorageAdapter,
        persistence: PersistenceStore,
        chunkSize: Int64 = DriveRequestBuilder.preferredChunkBytes,
        maxRetries: Int = 5,
    ) {
        self.adapter = adapter
        self.persistence = persistence
        self.chunkSize = chunkSize
        self.maxRetries = maxRetries
    }

    /// Drive a full upload. Returns the final ``DriveFile`` on
    /// success; throws on hard failure. Caller passes an
    /// ``onProgress`` closure so the SwiftUI layer can observe
    /// byte-progress without exposing internal state.
    func upload(
        uploadId: UUID,
        localURL: URL,
        parentFolderId: String,
        fileName: String,
        mimeType: String,
        onProgress: @Sendable (Progress) -> Void = { _ in },
    ) async throws -> DriveFile {
        activeUploads.insert(uploadId)
        defer { activeUploads.remove(uploadId) }

        onProgress(.planning)

        // Step 1: resolve file size. Reading attributes on a URL is
        // cheap and avoids loading the whole RAW into memory.
        let totalBytes: Int64
        do {
            let resourceValues = try localURL.resourceValues(forKeys: [.fileSizeKey])
            totalBytes = Int64(resourceValues.fileSize ?? 0)
        } catch {
            throw UploadError.fileReadFailed(error.localizedDescription)
        }
        guard totalBytes > 0 else {
            throw UploadError.fileReadFailed("file is empty or missing")
        }

        // Step 2: resume if we have a saved session, else start one.
        let session: DriveResumableSession
        var resumeFromByte: Int64 = 0
        if let saved = try await persistence.savedSession(for: uploadId),
           saved.totalBytes == totalBytes {
            session = DriveResumableSession(
                uploadURL: saved.sessionURL,
                fileName: saved.fileName,
                mimeType: saved.mimeType,
                totalBytes: saved.totalBytes,
            )
            resumeFromByte = max(0, saved.lastByteReceived + 1)
        } else {
            session = try await adapter.startResumableUpload(
                parentId: parentFolderId,
                fileName: fileName,
                mimeType: mimeType,
                totalBytes: totalBytes,
            )
            try await persistence.persist(PersistedSession(
                uploadId: uploadId,
                sessionURL: session.uploadURL,
                fileName: fileName,
                mimeType: mimeType,
                totalBytes: totalBytes,
                lastByteReceived: -1,
            ))
        }

        // Step 3: step through the remaining chunks.
        let chunks = ChunkPlanner.planResume(
            totalBytes: totalBytes,
            startingAtByte: resumeFromByte,
            chunkSize: chunkSize,
        )
        onProgress(.uploading(bytesSent: resumeFromByte, total: totalBytes))

        let handle: FileHandle
        do {
            handle = try FileHandle(forReadingFrom: localURL)
        } catch {
            throw UploadError.fileReadFailed(error.localizedDescription)
        }
        defer { try? handle.close() }

        for chunk in chunks {
            if !activeUploads.contains(uploadId) {
                throw UploadError.cancelled
            }
            let data = try readChunk(handle: handle, offset: chunk.startByte, length: chunk.length)
            let result = try await sendWithRetry(
                session: session,
                startByte: chunk.startByte,
                chunk: data,
                attempt: 1,
            )
            switch result {
            case .finished(let file):
                try await persistence.clear(for: uploadId)
                onProgress(.finished(file))
                return file
            case .progress(let p):
                try await persistence.persist(PersistedSession(
                    uploadId: uploadId,
                    sessionURL: session.uploadURL,
                    fileName: fileName,
                    mimeType: mimeType,
                    totalBytes: totalBytes,
                    lastByteReceived: p.lastByteReceived,
                ))
                onProgress(.uploading(bytesSent: p.nextByteToSend, total: totalBytes))
            }
        }
        // We ran out of chunks but Drive never returned .finished.
        // Treat as a failure so the caller can retry rather than
        // assume success silently.
        throw UploadError.tooManyRetries
    }

    /// Cancel an in-flight upload. Best-effort: the coordinator
    /// checks ``activeUploads`` before sending the next chunk, so
    /// cancellation takes effect at chunk boundaries. Matches Drive
    /// semantics — we can't un-send a PUT already in flight.
    func cancel(uploadId: UUID) {
        activeUploads.remove(uploadId)
    }

    // MARK: - Private

    private func readChunk(
        handle: FileHandle,
        offset: Int64,
        length: Int64,
    ) throws -> Data {
        try handle.seek(toOffset: UInt64(offset))
        guard let data = try handle.read(upToCount: Int(length)), data.count == Int(length)
        else {
            throw UploadError.fileReadFailed("short read at offset \(offset)")
        }
        return data
    }

    private func sendWithRetry(
        session: DriveResumableSession,
        startByte: Int64,
        chunk: Data,
        attempt: Int,
    ) async throws -> DriveStorageAdapter.ChunkResult {
        do {
            return try await adapter.appendChunk(
                session: session,
                startByte: startByte,
                chunk: chunk,
            )
        } catch let error as DriveStorageAdapter.DriveError {
            if Self.shouldRetry(error: error), attempt < maxRetries {
                let delay = RealtimeBackoff.delay(forFailures: attempt)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await sendWithRetry(
                    session: session,
                    startByte: startByte,
                    chunk: chunk,
                    attempt: attempt + 1,
                )
            }
            // Map permanent errors to a UploadError so callers
            // don't need to switch on two different types.
            switch error {
            case .httpStatus(let code, let message):
                throw UploadError.driveRejected(code, message: message)
            case .unauthorized(let message):
                throw UploadError.driveRejected(401, message: message)
            case .malformedResponse, .missingSessionURL:
                throw UploadError.driveRejected(-1, message: "malformed Drive response")
            case .network(let msg):
                throw UploadError.driveRejected(0, message: msg)
            }
        }
    }

    /// Only transient failures should retry. ``DriveStorageAdapter``
    /// maps network errors + 5xx into ``httpStatus`` / ``network``;
    /// permanent 4xx (except 408 request-timeout + 429 rate-limit)
    /// aren't worth retrying because the same request will get the
    /// same rejection.
    static func shouldRetry(error: DriveStorageAdapter.DriveError) -> Bool {
        switch error {
        case .network: return true
        case .httpStatus(let code, _):
            if code >= 500 { return true }
            if code == 408 || code == 429 { return true }
            return false
        case .unauthorized: return true // token refresh on next try
        case .malformedResponse, .missingSessionURL: return false
        }
    }
}
