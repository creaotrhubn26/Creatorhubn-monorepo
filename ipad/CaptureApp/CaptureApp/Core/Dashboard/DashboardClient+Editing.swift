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
}
