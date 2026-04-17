import Foundation
import Network

/// Auto-discovery of CCAPI-enabled Canon cameras on the local network.
/// Uses Bonjour (`_http._tcp.local.`) to find candidate HTTP services,
/// resolves each to an IP + port via a short-lived NWConnection, then
/// probes `GET /ccapi` + `GET /ccapi/ver100/deviceinformation` to confirm
/// it's actually a Canon body and capture its model + firmware + serial
/// for display.
///
/// Results stream on the `cameras` AsyncStream as they're validated;
/// service drops also surface so the UI can show/remove cards live.
///
/// First-time use triggers the iOS local-network permission dialog
/// (we already declare NSLocalNetworkUsageDescription + NSBonjourServices
/// in project.yml). If the user denies, `permissionDenied` flips true —
/// caller should show a Settings deep-link.
@MainActor
final class CameraDiscovery: ObservableObject {
    struct Found: Identifiable, Equatable, Sendable {
        let id: String          // stable across refreshes: name+host+port
        let serviceName: String  // Bonjour instance name, often the user nickname
        let baseURL: URL
        let deviceName: String?   // productname from /deviceinformation
        let firmware: String?
        let serial: String?

        var displayName: String {
            deviceName ?? serviceName
        }
    }

    @Published private(set) var cameras: [Found] = []
    @Published private(set) var isSearching: Bool = false
    @Published private(set) var permissionDenied: Bool = false

    private var browser: NWBrowser?
    private var probes: [String: Task<Void, Never>] = [:]

    /// Inject a custom URLSession factory for tests; defaults to the
    /// self-signed-cert-trusting session `CCAPIClient` expects.
    private let sessionFactory: @Sendable (URL) -> URLSession

    init(sessionFactory: @escaping @Sendable (URL) -> URLSession = CCAPIClient.makeInsecureSession(trustingHostOf:)) {
        self.sessionFactory = sessionFactory
    }

    func start() {
        guard browser == nil else { return }
        cameras = []
        permissionDenied = false
        isSearching = true

        let params = NWParameters()
        params.includePeerToPeer = true

        let descriptor = NWBrowser.Descriptor.bonjour(type: "_http._tcp", domain: nil)
        let browser = NWBrowser(for: descriptor, using: params)
        self.browser = browser

        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                guard let self else { return }
                switch state {
                case .failed(let error):
                    // Most common failure: local-network permission denied.
                    // NWError.dns(-65570) on iOS is the policy-denied code.
                    self.permissionDenied = true
                    self.isSearching = false
                    print("CameraDiscovery: browser failed — \(error)")
                case .cancelled:
                    self.isSearching = false
                default:
                    break
                }
            }
        }

        browser.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in
                self?.reconcile(results: Array(results))
            }
        }

        browser.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        for task in probes.values { task.cancel() }
        probes.removeAll()
        isSearching = false
    }

    private func reconcile(results: [NWBrowser.Result]) {
        let activeKeys = Set(results.compactMap(Self.key(for:)))

        // Drop probes + cameras for services that vanished.
        for (key, task) in probes where !activeKeys.contains(key) {
            task.cancel()
            probes.removeValue(forKey: key)
        }
        cameras.removeAll { !activeKeys.contains($0.id) }

        // Start a probe for each new service we haven't seen yet.
        for result in results {
            guard let key = Self.key(for: result),
                  probes[key] == nil,
                  !cameras.contains(where: { $0.id == key }) else { continue }
            probes[key] = Task { [weak self] in
                await self?.probe(result: result, key: key)
            }
        }
    }

    private static func key(for result: NWBrowser.Result) -> String? {
        guard case let .service(name, type, domain, _) = result.endpoint else { return nil }
        return "\(name).\(type).\(domain)"
    }

    /// Resolve the Bonjour service to a host+port by starting a short-lived
    /// NWConnection — when the connection reaches `.ready`, its currentPath
    /// holds the resolved remote endpoint. Then probe `/ccapi` to confirm
    /// it's a Canon body and fetch its device info.
    private func probe(result: NWBrowser.Result, key: String) async {
        let resolved = await resolve(endpoint: result.endpoint)
        guard let resolved else { return }
        let baseURL = resolved.buildBaseURL()
        guard let baseURL else { return }

        // Probe CCAPI + device info via the scoped cert-trust session.
        let session = sessionFactory(baseURL)
        let client = CCAPIClient(baseURL: baseURL, session: session)
        do {
            _ = try await client.connect()
            let info = try? await client.deviceInformation()
            let serviceName: String = {
                if case let .service(name, _, _, _) = result.endpoint { return name }
                return "Unknown camera"
            }()
            let found = Found(
                id: key,
                serviceName: serviceName,
                baseURL: baseURL,
                deviceName: info?.productname,
                firmware: info?.firmwareversion,
                serial: info?.serialnumber
            )
            if !Task.isCancelled {
                await MainActor.run {
                    if !self.cameras.contains(where: { $0.id == key }) {
                        self.cameras.append(found)
                    }
                }
            }
        } catch {
            // Not a CCAPI camera — HTTP services like printers, routers,
            // AirPrint, etc. will fail here and silently drop out of the
            // candidate list.
        }
    }

    private struct ResolvedEndpoint: Sendable {
        let host: String
        let port: UInt16

        func buildBaseURL() -> URL? {
            // Bracket IPv6 literals and strip trailing zone identifiers.
            var h = host
            if h.contains(":") {
                // Strip %zone suffix if present
                if let pct = h.firstIndex(of: "%") {
                    h = String(h[..<pct])
                }
                h = "[\(h)]"
            }
            // Canon CCAPI bodies serve over HTTPS; if this is a plain HTTP
            // printer etc., the probe will fail anyway and we'll drop it.
            return URL(string: "https://\(h):\(port)")
        }
    }

    private func resolve(endpoint: NWEndpoint) async -> ResolvedEndpoint? {
        let resumed = ResumedFlag()
        return await withCheckedContinuation { continuation in
            let connection = NWConnection(to: endpoint, using: .tcp)
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    guard let remote = connection.currentPath?.remoteEndpoint,
                          case let .hostPort(host, port) = remote,
                          resumed.fire()
                    else { return }
                    connection.cancel()
                    let hostString: String
                    switch host {
                    case .ipv4(let v4): hostString = "\(v4)"
                    case .ipv6(let v6): hostString = "\(v6)"
                    case .name(let n, _): hostString = n
                    @unknown default:   hostString = "\(host)"
                    }
                    continuation.resume(returning: ResolvedEndpoint(host: hostString, port: port.rawValue))
                case .failed, .cancelled:
                    if resumed.fire() {
                        continuation.resume(returning: nil)
                    }
                default:
                    break
                }
            }
            connection.start(queue: .main)
        }
    }
}

/// One-shot continuation guard usable from a Sendable closure. NWConnection's
/// state handler can fire multiple terminal states and we must resume the
/// checked continuation exactly once.
private final class ResumedFlag: @unchecked Sendable {
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
