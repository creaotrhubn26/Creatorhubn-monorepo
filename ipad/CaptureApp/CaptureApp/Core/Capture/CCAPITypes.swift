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

struct CCAPIContentsURLList: Sendable, Decodable {
    /// Each entry is a full path URL to a content item.
    let url: [String]
    let path: String?
}

// MARK: - Event polling (§4.13.1 polling, §5.3 Event Data)

/// Union of all event-bearing fields the polling endpoint can return.
/// The camera returns only the subset that has changed since last poll.
/// Decode leniently — unknown fields are OK.
struct CCAPIPollingResponse: Sendable, Decodable {
    let addedcontents: [String]?
    let deviceinformation: CCAPIDeviceInformation?
    let storagelist: [CCAPIStorage]?
    let storageinfo: CCAPIStorageInfo?
    let batterylist: [CCAPIBattery]?
    let temperature: String?
    let cardformatstatus: String?
    let shootingmode: String?
    let shootingmodedial: String?
    let lensname: String?
    let afframeposition: CCAPIAfFramePosition?
}

struct CCAPIStorageInfo: Sendable, Decodable {
    let name: String?
    let url: String?
    let accesscapability: String?
    let maxsize: Int64?
    let spacesize: Int64?
    let contentsnumber: Int?
}

struct CCAPIBattery: Sendable, Decodable {
    let name: String?
    let kind: String?
    let level: String?
    let quality: String?
    let chargestage: String?
}

struct CCAPIAfFramePosition: Sendable, Decodable {
    let positionx: Int?
    let positiony: Int?
}
