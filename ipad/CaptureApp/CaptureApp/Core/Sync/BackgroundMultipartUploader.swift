import CryptoKit
import Foundation

/// File-backed S3 part transfer that iOS can continue after the app has been
/// suspended. The multipart plan itself remains in `PersistentUploadStore`;
/// this type only owns the currently-running PUT and a small, durable ETag
/// receipt that bridges a background-session callback across process relaunch.
protocol MultipartPartUploading: Sendable {
    func uploadPart(
        sourceFile: URL,
        offset: Int64,
        length: Int64,
        destination: URL,
        checkpointId: String,
        partNumber: Int
    ) async throws -> String

    func acknowledgePart(checkpointId: String, partNumber: Int) async
}

final class BackgroundMultipartUploader: NSObject, MultipartPartUploading, @unchecked Sendable {
    static let sessionIdentifier = "com.creatorhubn.capture.s3-multipart"
    static let shared = BackgroundMultipartUploader(
        configuration: BackgroundMultipartUploader.productionConfiguration()
    )

    private struct TaskContext: Codable, Equatable {
        let checkpointId: String
        let partNumber: Int
        let temporaryPath: String
    }

    private struct Receipt: Codable {
        let checkpointId: String
        let partNumber: Int
        let etag: String
    }

    private let configuration: URLSessionConfiguration
    private let fileManager: FileManager
    private let rootDirectory: URL
    private let lock = NSLock()
    private var continuations: [Int: CheckedContinuation<String, any Error>] = [:]
    private var completedResults: [Int: Result<String, any Error>] = [:]
    private var backgroundCompletionHandler: (() -> Void)?

    private lazy var session = URLSession(
        configuration: configuration,
        delegate: self,
        delegateQueue: nil
    )

    init(
        configuration: URLSessionConfiguration,
        fileManager: FileManager = .default,
        rootDirectory: URL? = nil
    ) {
        self.configuration = configuration
        self.fileManager = fileManager
        self.rootDirectory = rootDirectory ?? Self.defaultRootDirectory(fileManager: fileManager)
        super.init()
    }

    func uploadPart(
        sourceFile: URL,
        offset: Int64,
        length: Int64,
        destination: URL,
        checkpointId: String,
        partNumber: Int
    ) async throws -> String {
        try await uploadPart(
            sourceFile: sourceFile,
            offset: offset,
            length: length,
            destination: destination,
            checkpointId: checkpointId,
            partNumber: partNumber,
            requiredHeaders: [:]
        )
    }

    func uploadPart(
        sourceFile: URL,
        offset: Int64,
        length: Int64,
        destination: URL,
        checkpointId: String,
        partNumber: Int,
        requiredHeaders: [String: String]
    ) async throws -> String {
        guard offset >= 0, length > 0, partNumber > 0 else {
            throw UploadError.invalidRange
        }
        if let receipt = try readReceipt(checkpointId: checkpointId, partNumber: partNumber) {
            return receipt.etag
        }

        let context = TaskContext(
            checkpointId: checkpointId,
            partNumber: partNumber,
            temporaryPath: partFileURL(checkpointId: checkpointId, partNumber: partNumber).path
        )

        // Reattach to a task restored by iOS instead of scheduling the same
        // part twice after a process relaunch.
        if let existing = await allTasks().first(where: { task in
            Self.decodeContext(task.taskDescription) == context
                && task.state != .completed
                && task.state != .canceling
        }) {
            if existing.state == .suspended { existing.resume() }
            return try await result(of: existing)
        }

        // A task may have completed between the first receipt check and the
        // task enumeration above. Check once more before creating a new PUT.
        if let receipt = try readReceipt(checkpointId: checkpointId, partNumber: partNumber) {
            return receipt.etag
        }

        let partFile = URL(fileURLWithPath: context.temporaryPath)
        try Self.copyRange(
            from: sourceFile,
            offset: offset,
            length: length,
            to: partFile,
            fileManager: fileManager
        )

        var request = URLRequest(url: destination)
        request.httpMethod = "PUT"
        request.setValue(String(length), forHTTPHeaderField: "Content-Length")
        for (name, value) in requiredHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        let task = session.uploadTask(with: request, fromFile: partFile)
        task.taskDescription = try Self.encodeContext(context)

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                install(continuation: continuation, for: task.taskIdentifier)
                task.resume()
            }
        } onCancel: {
            task.cancel()
        }
    }

    func acknowledgePart(checkpointId: String, partNumber: Int) async {
        try? fileManager.removeItem(at: receiptURL(checkpointId: checkpointId, partNumber: partNumber))
    }

    /// Called by UIApplicationDelegate when iOS wakes/relaunches the app to
    /// deliver callbacks for this session. Accessing `session` reconnects its
    /// delegate before the system drains those callbacks.
    func handleEvents(identifier: String, completionHandler: @escaping () -> Void) {
        guard identifier == Self.sessionIdentifier else {
            completionHandler()
            return
        }
        lock.lock()
        backgroundCompletionHandler = completionHandler
        lock.unlock()
        session.getAllTasks { _ in }
    }

    private func result(of task: URLSessionTask) async throws -> String {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                install(continuation: continuation, for: task.taskIdentifier)
            }
        } onCancel: {
            task.cancel()
        }
    }

    private func install(
        continuation: CheckedContinuation<String, any Error>,
        for taskIdentifier: Int
    ) {
        lock.lock()
        if let completed = completedResults.removeValue(forKey: taskIdentifier) {
            lock.unlock()
            continuation.resume(with: completed)
            return
        }
        continuations[taskIdentifier] = continuation
        lock.unlock()
    }

    private func finish(taskIdentifier: Int, result: Result<String, any Error>) {
        lock.lock()
        let continuation = continuations.removeValue(forKey: taskIdentifier)
        if continuation == nil {
            completedResults[taskIdentifier] = result
        }
        lock.unlock()
        continuation?.resume(with: result)
    }

    private func allTasks() async -> [URLSessionTask] {
        await withCheckedContinuation { continuation in
            session.getAllTasks { continuation.resume(returning: $0) }
        }
    }

    private func readReceipt(checkpointId: String, partNumber: Int) throws -> Receipt? {
        let url = receiptURL(checkpointId: checkpointId, partNumber: partNumber)
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        let receipt = try JSONDecoder().decode(Receipt.self, from: Data(contentsOf: url))
        guard receipt.checkpointId == checkpointId, receipt.partNumber == partNumber else {
            throw UploadError.invalidReceipt
        }
        return receipt
    }

    private func writeReceipt(_ receipt: Receipt) throws {
        let directory = rootDirectory.appendingPathComponent("Receipts", isDirectory: true)
        try Self.prepareDirectory(directory, fileManager: fileManager)
        try JSONEncoder().encode(receipt).write(
            to: receiptURL(checkpointId: receipt.checkpointId, partNumber: receipt.partNumber),
            options: [.atomic]
        )
    }

    private func partFileURL(checkpointId: String, partNumber: Int) -> URL {
        rootDirectory
            .appendingPathComponent("Parts", isDirectory: true)
            .appendingPathComponent("\(Self.stableName(checkpointId))-\(partNumber).part")
    }

    private func receiptURL(checkpointId: String, partNumber: Int) -> URL {
        rootDirectory
            .appendingPathComponent("Receipts", isDirectory: true)
            .appendingPathComponent("\(Self.stableName(checkpointId))-\(partNumber).json")
    }

    private static func productionConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.background(withIdentifier: sessionIdentifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.allowsCellularAccess = true
        configuration.timeoutIntervalForResource = 24 * 60 * 60
        configuration.httpMaximumConnectionsPerHost = 3
        return configuration
    }

    private static func defaultRootDirectory(fileManager: FileManager) -> URL {
        let base = (try? fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? fileManager.temporaryDirectory
        return base.appendingPathComponent("CreatorHub/BackgroundMultipart", isDirectory: true)
    }

    private static func prepareDirectory(_ directory: URL, fileManager: FileManager) throws {
        try fileManager.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)
    }

    static func copyRange(
        from source: URL,
        offset: Int64,
        length: Int64,
        to destination: URL,
        fileManager: FileManager = .default
    ) throws {
        guard offset >= 0, length > 0 else { throw UploadError.invalidRange }
        try prepareDirectory(destination.deletingLastPathComponent(), fileManager: fileManager)
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        guard fileManager.createFile(
            atPath: destination.path,
            contents: nil,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        ) else {
            throw UploadError.couldNotCreatePartFile
        }

        let reader = try FileHandle(forReadingFrom: source)
        let writer = try FileHandle(forWritingTo: destination)
        defer {
            try? reader.close()
            try? writer.close()
        }
        try reader.seek(toOffset: UInt64(offset))
        var remaining = length
        while remaining > 0 {
            let amount = Int(min(remaining, 4 * 1024 * 1024))
            guard let chunk = try reader.read(upToCount: amount), !chunk.isEmpty else {
                try? fileManager.removeItem(at: destination)
                throw UploadError.sourceEndedEarly
            }
            try writer.write(contentsOf: chunk)
            remaining -= Int64(chunk.count)
        }
        try writer.synchronize()
    }

    private static func stableName(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    private static func encodeContext(_ context: TaskContext) throws -> String {
        try JSONEncoder().encode(context).base64EncodedString()
    }

    private static func decodeContext(_ encoded: String?) -> TaskContext? {
        guard let encoded,
              let data = Data(base64Encoded: encoded)
        else { return nil }
        return try? JSONDecoder().decode(TaskContext.self, from: data)
    }

    enum UploadError: LocalizedError {
        case invalidRange
        case couldNotCreatePartFile
        case sourceEndedEarly
        case invalidResponse
        case httpStatus(Int)
        case missingETag
        case invalidReceipt

        var errorDescription: String? {
            switch self {
            case .invalidRange: "Ugyldig filområde for multipart-opplasting."
            case .couldNotCreatePartFile: "Kunne ikke klargjøre en bakgrunnsdel."
            case .sourceEndedEarly: "Kildefilen sluttet før multipart-delen var komplett."
            case .invalidResponse: "S3 svarte uten en gyldig HTTP-respons."
            case .httpStatus(let status): "S3 avviste multipart-delen med HTTP \(status)."
            case .missingETag: "S3-responsen manglet ETag."
            case .invalidReceipt: "Bakgrunnskvitteringen var ugyldig."
            }
        }
    }
}

extension BackgroundMultipartUploader: URLSessionTaskDelegate, URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        let context = Self.decodeContext(task.taskDescription)
        if let context {
            try? fileManager.removeItem(at: URL(fileURLWithPath: context.temporaryPath))
        }

        let result: Result<String, any Error>
        if let error {
            result = .failure(error)
        } else if let http = task.response as? HTTPURLResponse {
            if !(200..<300).contains(http.statusCode) {
                result = .failure(UploadError.httpStatus(http.statusCode))
            } else if let etag = http.value(forHTTPHeaderField: "ETag")
                        ?? http.value(forHTTPHeaderField: "Etag") {
                do {
                    guard let context else { throw UploadError.invalidResponse }
                    try writeReceipt(.init(
                        checkpointId: context.checkpointId,
                        partNumber: context.partNumber,
                        etag: etag
                    ))
                    result = .success(etag)
                } catch {
                    result = .failure(error)
                }
            } else {
                result = .failure(UploadError.missingETag)
            }
        } else {
            result = .failure(UploadError.invalidResponse)
        }
        finish(taskIdentifier: task.taskIdentifier, result: result)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        lock.lock()
        let completionHandler = backgroundCompletionHandler
        backgroundCompletionHandler = nil
        lock.unlock()
        guard let completionHandler else { return }
        DispatchQueue.main.async { completionHandler() }
    }
}
