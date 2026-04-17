import Foundation

// MARK: - Discovery

/// Response from `GET /ccapi` — lists API versions + endpoints the camera
/// supports. Section 6.1 (Discovery Sequence) + 4.2 (List of supported APIs).
///
/// Wire format observed on R6 Mark II is a dict keyed by version string, with
/// each value being an array of endpoint objects:
///
///     {"ver100":[{"path":"...","get":true,…}, …], "ver110":[…], "ver120":[…]}
struct CCAPIInventory: Sendable, Decodable {
    let versions: [CCAPIVersionEntry]

    /// Convenience: does this camera expose a given path under ANY version?
    func supports(path: String) -> Bool {
        versions.contains { $0.apis.contains { $0.path == path } }
    }

    /// Convenience: latest version available for a given base path.
    func latestVersion(for path: String) -> String? {
        versions
            .filter { $0.apis.contains { $0.path == path } }
            .map(\.ver)
            .sorted(by: >)
            .first
    }

    init(versions: [CCAPIVersionEntry]) {
        self.versions = versions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicKey.self)
        self.versions = try container.allKeys
            .sorted(by: { $0.stringValue < $1.stringValue })
            .map { key in
                let apis = try container.decode([CCAPIEndpoint].self, forKey: key)
                return CCAPIVersionEntry(ver: key.stringValue, apis: apis)
            }
    }

    private struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }
}

struct CCAPIVersionEntry: Sendable, Decodable {
    /// e.g. "ver100", "ver110", "ver140"
    let ver: String
    let apis: [CCAPIEndpoint]
}

struct CCAPIEndpoint: Sendable, Decodable, Hashable {
    /// e.g. "/ccapi/ver100/deviceinformation"
    let path: String
    /// Comma-separated HTTP verbs, e.g. "GET", "POST,GET"
    let get: Bool?
    let post: Bool?
    let put: Bool?
    let delete: Bool?
}

// MARK: - Camera information (§6.2.1)

struct CCAPIDeviceInformation: Sendable, Decodable {
    let manufacturer: String
    let productname: String
    let serialnumber: String
    let macaddress: String?
    let firmwareversion: String?
    let guid: String?
}

// MARK: - Storage (§6.2.2)

struct CCAPIStorageList: Sendable, Decodable {
    let storagelist: [CCAPIStorage]
}

struct CCAPIStorage: Sendable, Decodable, Hashable {
    let name: String
    /// Absolute CCAPI path to the storage root, e.g. "/ccapi/ver120/contents/card1".
    /// Field is literally `path` on R6 mkII — verified against real hardware 2026-04-17.
    let path: String
    let accesscapability: String?
    let maxsize: Int64?
    let spacesize: Int64?
    let contentsnumber: Int?
}

// MARK: - Contents (§4.7.3, §4.7.5)

/// Every level of the contents hierarchy on R6 mkII returns the same shape:
/// `{"path":[<array of child URLs>]}`. Used for storages, directories, and
/// files interchangeably — the depth is implicit in the URL you GET.
/// Verified against hardware 2026-04-17.
struct CCAPIContentsURLList: Sendable, Decodable {
    let path: [String]
}

// MARK: - Event polling (§4.13.1 polling, §5.3 Event Data)

/// Polling diff response. R6 mkII returns a huge union (70+ camera-state
/// fields) wrapped in nested objects, most of which we don't care about.
/// We decode defensively: pull out the fields we actually act on, ignore
/// everything else. This keeps the decoder robust against unknown or
/// mis-typed siblings without requiring us to model the full schema.
///
/// Verified against R6 mkII firmware 1.6.0 (2026-04-17).
struct CCAPIPollingResponse: Sendable, Decodable {
    /// URLs of assets that appeared on the card since the last poll.
    /// Surfaces every shutter release with the path to the resulting file(s).
    let addedcontents: [String]?

    /// Total file count on the current card, if that field was part of the
    /// diff. Use as a secondary heartbeat when `addedcontents` is missing
    /// (e.g., after a reconnect we only see the storage snapshot change).
    let totalContentsCount: Int?

    private enum CodingKeys: String, CodingKey {
        case addedcontents
        case storage
    }

    init(
        addedcontents: [String]? = nil,
        totalContentsCount: Int? = nil
    ) {
        self.addedcontents = addedcontents
        self.totalContentsCount = totalContentsCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.addedcontents = try container.decodeIfPresent([String].self, forKey: .addedcontents)
        if let storage = try? container.decodeIfPresent(CCAPIStorageSnapshot.self, forKey: .storage) {
            self.totalContentsCount = storage.storagelist.first?.contentsnumber
        } else {
            self.totalContentsCount = nil
        }
    }
}

/// Wrapper for the `"storage"` field inside a polling diff: the camera
/// nests the actual list one level deeper under `storagelist`, unlike
/// `GET /devicestatus/storage` which returns that list at the top level.
private struct CCAPIStorageSnapshot: Decodable {
    let storagelist: [CCAPIStorage]
}
