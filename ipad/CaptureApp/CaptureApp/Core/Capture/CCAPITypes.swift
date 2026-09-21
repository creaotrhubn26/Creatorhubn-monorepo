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

// MARK: - Video control

enum CCAPIShootingSettingKey: String, CaseIterable, Sendable, Hashable {
    case tv
    case av
    case iso
    case exposure
    case wb
    case colortemperature
    case afoperation
    case afmethod
    case trackingsetting
    case picturestyle
    case moviecropping

    var displayName: String {
        switch self {
        case .tv: "Lukker"
        case .av: "Blender"
        case .iso: "ISO"
        case .exposure: "Eksponeringskompensasjon"
        case .wb: "Hvitbalanse"
        case .colortemperature: "Fargetemperatur"
        case .afoperation: "AF-operasjon"
        case .afmethod: "AF-metode"
        case .trackingsetting: "Motivsporing"
        case .picturestyle: "Bildestil"
        case .moviecropping: "Movie crop"
        }
    }
}

enum CCAPIFocusDrive: String, CaseIterable, Sendable {
    case near3, near2, near1, far1, far2, far3

    var displayName: String {
        switch self {
        case .near3: "Nær · stor"
        case .near2: "Nær · medium"
        case .near1: "Nær · fin"
        case .far1: "Fjern · fin"
        case .far2: "Fjern · medium"
        case .far3: "Fjern · stor"
        }
    }
}

struct CCAPIChoiceSetting: Sendable, Decodable, Equatable {
    let value: String
    let ability: [String]

    private enum CodingKeys: String, CodingKey { case value, ability }
    private struct NumericRange: Decodable {
        let min: Int
        let max: Int
        let step: Int
    }

    init(value: String, ability: [String]) {
        self.value = value
        self.ability = ability
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let string = try? container.decode(String.self, forKey: .value) {
            value = string
        } else if let integer = try? container.decode(Int.self, forKey: .value) {
            value = String(integer)
        } else if let decimal = try? container.decode(Double.self, forKey: .value) {
            value = String(decimal)
        } else {
            throw DecodingError.typeMismatch(
                String.self,
                .init(codingPath: container.codingPath, debugDescription: "CCAPI setting value is not scalar")
            )
        }

        if let choices = try? container.decode([String].self, forKey: .ability) {
            ability = choices
        } else if let integers = try? container.decode([Int].self, forKey: .ability) {
            ability = integers.map(String.init)
        } else if let range = try? container.decode(NumericRange.self, forKey: .ability),
                  range.step > 0,
                  range.max >= range.min {
            ability = stride(from: range.min, through: range.max, by: range.step)
                .prefix(500)
                .map(String.init)
        } else {
            ability = []
        }
    }
}

struct CCAPIVideoCapabilities: Sendable, Equatable {
    let canRecordMovie: Bool
    let writableSettings: Set<CCAPIShootingSettingKey>
    let canDriveFocus: Bool
    let canAutoFocus: Bool
    let canSetAFFrame: Bool

    init(
        canRecordMovie: Bool,
        writableSettings: Set<CCAPIShootingSettingKey>,
        canDriveFocus: Bool = false,
        canAutoFocus: Bool = false,
        canSetAFFrame: Bool = false
    ) {
        self.canRecordMovie = canRecordMovie
        self.writableSettings = writableSettings
        self.canDriveFocus = canDriveFocus
        self.canAutoFocus = canAutoFocus
        self.canSetAFFrame = canSetAFFrame
    }
}

struct CCAPIMediaTransferProgress: Sendable, Equatable {
    let receivedBytes: Int64
    let totalBytes: Int64?
    let elapsedSeconds: TimeInterval

    var fractionCompleted: Double? {
        guard let totalBytes, totalBytes > 0 else { return nil }
        return min(1, max(0, Double(receivedBytes) / Double(totalBytes)))
    }

    var percentCompleted: Int? {
        fractionCompleted.map { Int(($0 * 100).rounded()) }
    }

    var estimatedRemainingSeconds: TimeInterval? {
        guard let totalBytes,
              totalBytes > receivedBytes,
              receivedBytes > 0,
              elapsedSeconds > 0
        else { return nil }
        let bytesPerSecond = Double(receivedBytes) / elapsedSeconds
        guard bytesPerSecond > 0 else { return nil }
        return Double(totalBytes - receivedBytes) / bytesPerSecond
    }
}

struct CCAPILiveViewGeometry: Sendable, Equatable {
    let imageWidth: Int
    let imageHeight: Int
    let visibleX: Int
    let visibleY: Int
    let visibleWidth: Int
    let visibleHeight: Int

    func cameraPosition(normalizedX: Double, normalizedY: Double) -> (x: Int, y: Int) {
        let x = max(0, min(1, normalizedX))
        let y = max(0, min(1, normalizedY))
        return (
            visibleX + Int((Double(visibleWidth) * x).rounded()),
            visibleY + Int((Double(visibleHeight) * y).rounded())
        )
    }
}

struct CCAPILiveViewDetailEnvelope: Decodable {
    let liveviewdata: CCAPILiveViewDetailData
}

struct CCAPILiveViewDetailData: Decodable {
    let image: CCAPILiveViewImageArea
    let visible: CCAPILiveViewVisibleArea
}

struct CCAPILiveViewImageArea: Decodable {
    let sizex: Int
    let sizey: Int
}

struct CCAPILiveViewVisibleArea: Decodable {
    let positionx: Int
    let positiony: Int
    let positionwidth: Int
    let positionheight: Int
}

struct CCAPIBatteryStatus: Sendable, Equatable {
    let rawValue: String
    let percent: Int?

    init?(rawValue: String) {
        let normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }
        self.rawValue = normalized
        let numeric = normalized.trimmingCharacters(in: CharacterSet(charactersIn: "%"))
        if let value = Int(numeric), (0...100).contains(value) {
            percent = value
        } else {
            percent = nil
        }
    }

    var label: String {
        if let percent { return "\(percent)%" }
        switch rawValue.lowercased() {
        case "full": return "Full"
        case "high": return "Høy"
        case "half": return "Halv"
        case "quarter": return "Kvart"
        case "low": return "Lav"
        case "empty": return "Tom"
        case "unknown": return "Ukjent"
        case "charge": return "Lader"
        case "chargestop": return "Lading stoppet"
        case "chargecomp": return "Fulladet"
        default: return rawValue
        }
    }

    var systemImage: String {
        if let percent {
            if percent >= 75 { return "battery.100" }
            if percent >= 50 { return "battery.75" }
            if percent >= 25 { return "battery.50" }
            if percent >= 10 { return "battery.25" }
            return "battery.0"
        }
        switch rawValue.lowercased() {
        case "full", "chargecomp": return "battery.100"
        case "high": return "battery.75"
        case "half": return "battery.50"
        case "quarter", "low": return "battery.25"
        case "empty": return "battery.0"
        case "charge": return "battery.100percent.bolt"
        default: return "battery.75"
        }
    }

    var isLow: Bool {
        if let percent { return percent < 20 }
        return ["quarter", "low", "empty"].contains(rawValue.lowercased())
    }
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

/// Pagination metadata for a directory listing. Fetched via
/// `GET …/contents/{storage}/{dir}?kind=number`. `page=N` returns items
/// (N-1)*100 + 1 … N*100, so pagenumber = ceil(contentsnumber / 100).
/// Spec: CCAPI Reference v1.4.0 §contents kind=number.
struct CCAPIContentsNumber: Sendable, Decodable {
    let contentsnumber: Int
    let pagenumber: Int
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

    /// Bytes still free on the current card, when included in the diff.
    let freeSpaceBytes: Int64?

    /// Battery level as the camera reports it — can be a percent string
    /// ("11") or a named bucket ("full", "half", "low"). We don't normalise.
    let batteryLevel: String?

    /// Exposure triangle, each as the user-facing display string.
    let apertureValue: String?     // e.g. "f5.0"
    let shutterSpeed: String?      // e.g. "1/60"
    let isoValue: String?          // e.g. "1250"
    /// Eksponeringskompensasjon (EC), som kameraet rapporterer den, f.eks. "+0.3"
    /// / "0" / "-1 1/3". Mirrors `/shooting/settings/exposure`.
    let exposureCompensation: String?

    /// Attached lens name, mirrors `/devicestatus/lens.name`.
    let lensName: String?

    /// Movie recording state emitted after `/shooting/control/recbutton`.
    /// Camera event payloads have been observed with both `action` and
    /// `status` for the same `start` / `stop` value, so the decoder tolerates
    /// both shapes and ignores all other values.
    let movieRecording: Bool?

    private enum CodingKeys: String, CodingKey {
        case addedcontents
        case storage
        case battery
        case av
        case tv
        case iso
        case exposure
        case lens
        case recbutton
    }

    init(
        addedcontents: [String]? = nil,
        totalContentsCount: Int? = nil,
        freeSpaceBytes: Int64? = nil,
        batteryLevel: String? = nil,
        apertureValue: String? = nil,
        shutterSpeed: String? = nil,
        isoValue: String? = nil,
        exposureCompensation: String? = nil,
        lensName: String? = nil,
        movieRecording: Bool? = nil
    ) {
        self.addedcontents = addedcontents
        self.totalContentsCount = totalContentsCount
        self.freeSpaceBytes = freeSpaceBytes
        self.batteryLevel = batteryLevel
        self.apertureValue = apertureValue
        self.shutterSpeed = shutterSpeed
        self.isoValue = isoValue
        self.exposureCompensation = exposureCompensation
        self.lensName = lensName
        self.movieRecording = movieRecording
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.addedcontents = try container.decodeIfPresent([String].self, forKey: .addedcontents)

        if let storage = try? container.decodeIfPresent(CCAPIStorageSnapshot.self, forKey: .storage) {
            self.totalContentsCount = storage.storagelist.first?.contentsnumber
            self.freeSpaceBytes = storage.storagelist.first?.spacesize
        } else {
            self.totalContentsCount = nil
            self.freeSpaceBytes = nil
        }

        self.batteryLevel = (try? container.decodeIfPresent(CCAPIBatteryDiff.self, forKey: .battery))?.level
        self.lensName = (try? container.decodeIfPresent(CCAPILensDiff.self, forKey: .lens))?.name
        self.apertureValue = (try? container.decodeIfPresent(CCAPIValueDiff.self, forKey: .av))?.value
        self.shutterSpeed = (try? container.decodeIfPresent(CCAPIValueDiff.self, forKey: .tv))?.value
        self.isoValue = (try? container.decodeIfPresent(CCAPIValueDiff.self, forKey: .iso))?.value
        self.exposureCompensation = (try? container.decodeIfPresent(CCAPIValueDiff.self, forKey: .exposure))?.value
        self.movieRecording = (try? container.decodeIfPresent(CCAPIRecordingDiff.self, forKey: .recbutton))?.isRecording
    }
}

/// Wrapper for the `"storage"` field inside a polling diff: the camera
/// nests the actual list one level deeper under `storagelist`, unlike
/// `GET /devicestatus/storage` which returns that list at the top level.
private struct CCAPIStorageSnapshot: Decodable {
    let storagelist: [CCAPIStorage]
}

/// Most setting fields in the polling diff look like `{"value": <x>, "ability": [...]}`.
private struct CCAPIValueDiff: Decodable {
    let value: String?
}

private struct CCAPIBatteryDiff: Decodable {
    let kind: String?
    let name: String?
    let level: String?
    let quality: String?
}

private struct CCAPILensDiff: Decodable {
    let mount: Bool?
    let name: String?
}

private struct CCAPIRecordingDiff: Decodable {
    let action: String?
    let status: String?

    var isRecording: Bool? {
        switch action ?? status {
        case "start": true
        case "stop": false
        default: nil
        }
    }
}
