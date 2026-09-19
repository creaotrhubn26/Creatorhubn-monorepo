import Foundation
import Network
import Observation

@MainActor
@Observable
final class CreatorHubBridgeDiscovery {
    struct Source: Identifiable, Sendable, Equatable {
        enum Role: String, Sendable, Codable {
            case multiview
            case camera
        }

        let id: String
        let bridgeId: String
        let bridgeName: String
        let sourceId: String
        let label: String
        let role: Role
        let playbackURL: URL
        let qualityLabel: String
    }

    private struct Manifest: Decodable, Sendable {
        struct ManifestSource: Decodable, Sendable {
            let id: String
            let label: String
            let role: Source.Role
            let playbackUrl: URL
            let qualityLabel: String

            enum CodingKeys: String, CodingKey {
                case id, label, role
                case playbackUrl = "playback_url"
                case qualityLabel = "quality_label"
            }
        }

        let protocolVersion: Int
        let deskId: String
        let deskName: String
        let localOnly: Bool
        let sources: [ManifestSource]

        enum CodingKeys: String, CodingKey {
            case sources
            case protocolVersion = "protocol_version"
            case deskId = "desk_id"
            case deskName = "desk_name"
            case localOnly = "local_only"
        }
    }

    private struct BridgeResult: Sendable {
        let serviceKey: String
        let sources: [Source]
    }

    private struct ResolvedEndpoint: Sendable {
        let host: String
        let port: UInt16

        var manifestURL: URL? {
            var displayHost = host
            if displayHost.contains(":"), !displayHost.hasPrefix("[") {
                if let zone = displayHost.firstIndex(of: "%") {
                    displayHost = String(displayHost[..<zone])
                }
                displayHost = "[\(displayHost)]"
            }
            return URL(string: "http://\(displayHost):\(port)/v1/manifest")
        }
    }

    private(set) var sources: [Source] = []
    private(set) var isSearching = false
    private(set) var lastError: String?

    private var browser: NWBrowser?
    private var probes: [String: Task<Void, Never>] = [:]
    private var sourcesByService: [String: [Source]] = [:]

    func start() {
        guard browser == nil else { return }
        let parameters = NWParameters.tcp
        parameters.includePeerToPeer = true
        let browser = NWBrowser(
            for: .bonjour(type: "_creatorhubbridge._tcp", domain: nil),
            using: parameters
        )
        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                guard let self else { return }
                switch state {
                case .ready:
                    self.isSearching = true
                    self.lastError = nil
                case .failed(let error):
                    self.isSearching = false
                    self.lastError = error.localizedDescription
                case .cancelled:
                    self.isSearching = false
                default:
                    break
                }
            }
        }
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in self?.reconcile(Array(results)) }
        }
        browser.start(queue: .global(qos: .userInitiated))
        self.browser = browser
    }

    func stop() {
        browser?.cancel()
        browser = nil
        probes.values.forEach { $0.cancel() }
        probes.removeAll()
        sourcesByService.removeAll()
        sources = []
        isSearching = false
    }

    private func reconcile(_ results: [NWBrowser.Result]) {
        let current = Set(results.compactMap(Self.serviceKey))
        for (key, task) in probes where !current.contains(key) {
            task.cancel()
            probes.removeValue(forKey: key)
            sourcesByService.removeValue(forKey: key)
        }
        publishSources()

        for result in results {
            guard let key = Self.serviceKey(result), probes[key] == nil else { continue }
            probes[key] = Task { [weak self] in
                while !Task.isCancelled {
                    if let found = await self?.probe(result: result, serviceKey: key),
                       !Task.isCancelled {
                        self?.accept(found)
                    } else {
                        self?.clearSources(for: key)
                    }
                    try? await Task.sleep(for: .seconds(2))
                }
            }
        }
    }

    private static func serviceKey(_ result: NWBrowser.Result) -> String? {
        guard case let .service(name, type, domain, _) = result.endpoint else { return nil }
        return "\(name).\(type).\(domain)"
    }

    private func accept(_ result: BridgeResult) {
        sourcesByService[result.serviceKey] = result.sources
        publishSources()
    }

    private func clearSources(for serviceKey: String) {
        sourcesByService.removeValue(forKey: serviceKey)
        publishSources()
    }

    private func publishSources() {
        sources = sourcesByService.values
            .flatMap { $0 }
            .sorted { lhs, rhs in
                if lhs.role != rhs.role { return lhs.role == .multiview }
                return lhs.label.localizedCaseInsensitiveCompare(rhs.label) == .orderedAscending
            }
    }

    private func probe(result: NWBrowser.Result, serviceKey: String) async -> BridgeResult? {
        guard let resolved = await resolve(endpoint: result.endpoint),
              let manifestURL = resolved.manifestURL
        else { return nil }
        let desks = PairedDeskStore.shared.load()
        for desk in desks {
            guard let token = BridgeCredentialStore.token(forDeskId: desk.deskId) else { continue }
            var request = URLRequest(url: manifestURL)
            request.timeoutInterval = 3
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse,
                      http.statusCode == 200,
                      let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
                      manifest.protocolVersion == 1,
                      manifest.localOnly,
                      manifest.deskId == desk.deskId
                else { continue }
                let mapped = manifest.sources.compactMap { source -> Source? in
                    guard let url = rewriteLoopbackURL(source.playbackUrl, bridgeHost: resolved.host) else {
                        return nil
                    }
                    return Source(
                        id: "bridge:\(manifest.deskId):\(source.id)",
                        bridgeId: manifest.deskId,
                        bridgeName: manifest.deskName,
                        sourceId: source.id,
                        label: source.label,
                        role: source.role,
                        playbackURL: url,
                        qualityLabel: source.qualityLabel
                    )
                }
                return BridgeResult(serviceKey: serviceKey, sources: mapped)
            } catch {
                continue
            }
        }
        return nil
    }

    private func rewriteLoopbackURL(_ url: URL, bridgeHost: String) -> URL? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let host = components.host
        else { return nil }
        if host == "localhost" || host == "127.0.0.1" || host == "::1" {
            components.host = bridgeHost.split(separator: "%", maxSplits: 1).first.map(String.init)
        }
        return components.url
    }

    private func resolve(endpoint: NWEndpoint) async -> ResolvedEndpoint? {
        let resumed = BridgeResolutionFlag()
        return await withCheckedContinuation { continuation in
            let connection = NWConnection(to: endpoint, using: .tcp)
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    guard let remote = connection.currentPath?.remoteEndpoint,
                          case let .hostPort(host, port) = remote,
                          resumed.fire()
                    else { return }
                    let hostString: String
                    switch host {
                    case .ipv4(let address): hostString = "\(address)"
                    case .ipv6(let address): hostString = "\(address)"
                    case .name(let name, _): hostString = name
                    @unknown default: hostString = "\(host)"
                    }
                    connection.cancel()
                    continuation.resume(returning: ResolvedEndpoint(host: hostString, port: port.rawValue))
                case .failed, .cancelled:
                    if resumed.fire() { continuation.resume(returning: nil) }
                default:
                    break
                }
            }
            connection.start(queue: .global(qos: .userInitiated))
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 3) {
                if resumed.fire() {
                    connection.cancel()
                    continuation.resume(returning: nil)
                }
            }
        }
    }
}

private final class BridgeResolutionFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var fired = false

    func fire() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !fired else { return false }
        fired = true
        return true
    }
}
