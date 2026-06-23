import Foundation

/// A message attachment reference. The communication backend stores
/// attachments as `{ filename, downloadUrl, mimeType, fileSize }` (it doesn't
/// hold the bytes — historically Google Drive links). For native local files
/// we first upload via the chunked-upload pipeline to get a stable download
/// URL, then attach that.
struct MessageAttachment: Codable, Sendable, Hashable, Identifiable {
    var id: String { downloadUrl }
    var filename: String
    var downloadUrl: String
    var mimeType: String
    var fileSize: Int
}

extension DashboardClient {
    /// Upload a local file via the chunked-upload pipeline and return a
    /// ready-to-attach reference. Single-chunk (whole file in one PUT) — fine
    /// for the photos/PDFs a photographer attaches in the field.
    func uploadAttachment(data: Data, filename: String, mimeType: String) async throws -> MessageAttachment {
        struct InitBody: Encodable {
            let fileName: String; let fileSize: Int; let chunkSize: Int
            let totalChunks: Int; let mimeType: String
        }
        struct InitResp: Decodable { let uploadId: String? }
        struct FinishResp: Decodable { let fileId: String? }

        let size = data.count
        let initResp: InitResp = try await postJSON(
            path: "/api/chunked-upload/init",
            body: InitBody(fileName: filename, fileSize: size, chunkSize: max(size, 1), totalChunks: 1, mimeType: mimeType),
        )
        guard let uploadId = initResp.uploadId else { throw DashboardError.decode("upload init: no uploadId") }

        try await putRaw(path: "/api/chunked-upload/\(uploadId)/chunks/0", data: data)

        struct Empty: Encodable {}
        let finish: FinishResp = try await postJSON(path: "/api/chunked-upload/\(uploadId)/finish", body: Empty())
        guard let fileId = finish.fileId else { throw DashboardError.decode("upload finish: no fileId") }

        let url = URL(string: "/api/chunked-upload/files/\(fileId)", relativeTo: baseURL)?.absoluteString
            ?? "/api/chunked-upload/files/\(fileId)"
        return MessageAttachment(filename: filename, downloadUrl: url, mimeType: mimeType, fileSize: size)
    }

    /// Raw binary PUT (chunk upload). Mirrors the JSON helpers but sends an
    /// octet-stream body.
    private func putRaw(path: String, data: Data) async throws {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw DashboardError.transport("invalid path \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        applyAuth(&request)
        request.httpBody = data
        let (respData, response) = try await self.data(for: request)
        try check(response, respData)
    }
}
