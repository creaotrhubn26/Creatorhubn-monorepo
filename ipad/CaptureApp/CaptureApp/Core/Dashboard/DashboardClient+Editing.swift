import Foundation

extension DashboardClient {
    /// Partner-program discovery — approved external editing vendors.
    func listEditingVendors() async throws -> [EditingVendor] {
        let resp: EditingVendorListResponse = try await getJSON(path: "/api/editing/vendors")
        return resp.vendors
    }

    /// Hand a project off to an external editor. With a vendorId the job is
    /// created in "requested" state (sent straight to that editor). Returns the
    /// new job id (for the follow-up secure file upload).
    @discardableResult
    func createEditingJob(
        projectId: String?,
        projectTitle: String?,
        vendorId: String,
        brief: String,
        amountCents: Int,
        requestedServices: [String],
        confidentialityAck: Bool = true,
    ) async throws -> String {
        struct Body: Encodable {
            let projectId: String?
            let projectTitle: String?
            let vendorId: String
            let brief: String
            let amountCents: Int
            let requestedServices: [String]
            let confidentialityAck: Bool
            let costModel: String
        }
        struct Resp: Decodable {
            let jobId: String?
            let id: String?
            var resolvedId: String? { jobId ?? id }
        }
        let resp: Resp = try await postJSON(
            path: "/api/editing/jobs",
            body: Body(
                projectId: projectId,
                projectTitle: projectTitle,
                vendorId: vendorId,
                brief: brief,
                amountCents: amountCents,
                requestedServices: requestedServices,
                confidentialityAck: confidentialityAck,
                costModel: "fixed_fee",
            ),
        )
        guard let id = resp.resolvedId else { throw DashboardError.decode("editing job: no id") }
        return id
    }

    // MARK: - Source files (photographer -> editor)

    struct SourceUploadTarget: Decodable, Sendable {
        let uploadUrl: String
        let key: String?
        let fileId: String?
    }

    /// Ask the backend for a presigned PUT so the photographer can upload one
    /// source/raw file to staging for the editor to pull.
    func requestSourceUpload(jobId: String, fileName: String, contentType: String) async throws -> SourceUploadTarget {
        struct Body: Encodable { let fileName: String; let contentType: String }
        return try await postJSON(
            path: "/api/editing/jobs/\(jobId)/source-upload-url",
            body: Body(fileName: fileName, contentType: contentType),
        )
    }

    /// PUT the raw bytes straight to the presigned staging URL (no app auth —
    /// the signature carries the grant). Content-Type must match what was signed.
    func uploadToPresignedURL(_ urlString: String, data: Data, contentType: String) async throws {
        guard let url = URL(string: urlString) else { throw DashboardError.transport("invalid upload url") }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        let (respData, response) = try await self.data(for: request)
        try check(response, respData)
    }

    /// Convenience: presign + upload one source file in a single call. Returns the
    /// staging key on success.
    @discardableResult
    func sendSourceFile(jobId: String, fileName: String, contentType: String, data: Data) async throws -> String? {
        let target = try await requestSourceUpload(jobId: jobId, fileName: fileName, contentType: contentType)
        try await uploadToPresignedURL(target.uploadUrl, data: data, contentType: contentType)
        return target.key
    }

    // MARK: - Job tracking (photographer)

    /// All editing jobs the photographer has, newest first.
    func listEditingJobs(status: String? = nil) async throws -> [EditingJob] {
        struct Resp: Decodable { let jobs: [EditingJob] }
        var path = "/api/editing/jobs"
        if let status { path += "?status=\(status)" }
        let resp: Resp = try await getJSON(path: path)
        return resp.jobs
    }

    func editingJobDetail(id: String) async throws -> EditingJobDetail {
        try await getJSON(path: "/api/editing/jobs/\(id)")
    }

    func jobMessages(id: String) async throws -> (messages: [JobMessage], canMessage: Bool) {
        struct Resp: Decodable { let messages: [JobMessage]; let canMessage: Bool? }
        let resp: Resp = try await getJSON(path: "/api/editing/jobs/\(id)/messages")
        return (resp.messages, resp.canMessage ?? false)
    }

    @discardableResult
    func sendJobMessage(id: String, body: String) async throws -> JobMessage {
        struct Body: Encodable { let body: String }
        struct Resp: Decodable { let message: JobMessage }
        let resp: Resp = try await postJSON(path: "/api/editing/jobs/\(id)/messages", body: Body(body: body))
        return resp.message
    }

    func approveJob(id: String) async throws {
        struct Empty: Encodable {}
        try await send(path: "/api/editing/jobs/\(id)/approve", method: "POST", body: Empty())
    }

    func requestRevision(id: String, note: String?) async throws {
        struct Body: Encodable { let note: String? }
        try await send(path: "/api/editing/jobs/\(id)/request-revision", method: "POST", body: Body(note: note))
    }

    func cancelJob(id: String) async throws {
        struct Empty: Encodable {}
        try await send(path: "/api/editing/jobs/\(id)/cancel", method: "POST", body: Empty())
    }

    struct PayResult: Decodable, Sendable {
        let method: String?
        let status: String?
        let checkoutUrl: String?
    }

    /// Start payment. Invoice puts the job straight into escrow ('held');
    /// Stripe returns a checkout URL to open in the browser.
    func payJob(id: String, method: String) async throws -> PayResult {
        struct Body: Encodable { let paymentMethod: String }
        return try await postJSON(path: "/api/editing/jobs/\(id)/pay", body: Body(paymentMethod: method))
    }
}
