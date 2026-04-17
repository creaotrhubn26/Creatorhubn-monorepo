import Foundation
import Network
import Darwin

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

    private var scanTask: Task<Void, Never>?

    func start() {
        guard browser == nil else { return }
        cameras = []
        permissionDenied = false
        isSearching = true

        // Bonjour first. Most Canon bodies don't advertise via mDNS in
        // CCAPI mode (verified against R5 + R6 mkII 2026-04-18), but
        // running the browser is essentially free and catches bodies that
        // might in future firmware.
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
                    self.permissionDenied = true
                    print("CameraDiscovery: browser failed — \(error)")
                case .cancelled:
                    break
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

        // IP-range scan is the actual discovery path for Canon. Scan the
        // local /24 subnet in parallel; successful CCAPI probes land as
        // Found entries alongside any Bonjour hits (deduped by host).
        scanTask = Task { [weak self] in
            await self?.scanLocalSubnets()
        }
    }

    func stop() {
        browser?.cancel()
        browser = nil
        scanTask?.cancel()
        scanTask = nil
        for task in probes.values { task.cancel() }
        probes.removeAll()
        isSearching = false
    }

    /// Enumerate all local /24 subnets via `getifaddrs`, probe every host
    /// in each, and surface CCAPI responders. Parallelism is capped so we
    /// don't open 254 simultaneous sockets — batches of 16.
    private func scanLocalSubnets() async {
        let subnets = Self.localIPv4Subnets()
        if subnets.isEmpty {
            print("CameraDiscovery: no private IPv4 subnets found — getifaddrs empty")
            return
        }
        for s in subnets {
            print("CameraDiscovery: scanning \(s.base).1-254 (skipping \(s.base).\(s.mine))")
        }
        let hosts = subnets.flatMap(\.hosts)
        let batchSize = 16
        var index = 0
        while index < hosts.count, !Task.isCancelled {
            let upper = min(index + batchSize, hosts.count)
            let slice = Array(hosts[index..<upper])
            await withTaskGroup(of: Void.self) { group in
                for host in slice {
                    group.addTask { [weak self] in
                        await self?.probeIP(host: host)
                    }
                }
                await group.waitForAll()
            }
            index = upper
        }
        await MainActor.run {
            self.isSearching = false
            print("CameraDiscovery: scan complete — \(self.cameras.count) camera(s) found")
        }
    }

    private func probeIP(host: String) async {
        guard let baseURL = URL(string: "https://\(host)") else { return }
        let key = "ip:\(host)"
        let alreadyFound = await MainActor.run {
            self.cameras.contains { $0.baseURL.host == host }
        }
        if alreadyFound { return }

        let session = sessionFactory(baseURL)
        let client = CCAPIClient(baseURL: baseURL, session: session)
        do {
            _ = try await withTimeout(seconds: 3.5) {
                try await client.connect()
            }
            print("CameraDiscovery: CCAPI responder at \(host)")
            let info = try? await client.deviceInformation()
            let found = Found(
                id: key,
                serviceName: info?.productname ?? host,
                baseURL: baseURL,
                deviceName: info?.productname,
                firmware: info?.firmwareversion,
                serial: info?.serialnumber
            )
            if !Task.isCancelled {
                await MainActor.run {
                    if !self.cameras.contains(where: { $0.baseURL.host == host }) {
                        self.cameras.append(found)
                    }
                }
            }
        } catch {
            // Silent: either no server, not CCAPI, or timeout.
        }
    }

    private func withTimeout<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw CancellationError()
            }
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }

    private struct Subnet {
        let base: String  // e.g. "192.168.1"
        let mine: Int     // our own host byte so we skip it

        var hosts: [String] {
            (1...254).filter { $0 != mine }.map { "\(base).\($0)" }
        }
    }

    /// Uses getifaddrs to enumerate active IPv4 /24 interfaces. Loopback
    /// and link-local autoconf ranges are filtered out.
    private static func localIPv4Subnets() -> [Subnet] {
        var result: [Subnet] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
        defer { freeifaddrs(first) }

        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let entry = ptr {
            defer { ptr = entry.pointee.ifa_next }
            let flags = Int32(entry.pointee.ifa_flags)
            guard (flags & IFF_UP) != 0, (flags & IFF_LOOPBACK) == 0 else { continue }
            guard let addr = entry.pointee.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) else { continue }

            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let err = getnameinfo(addr, socklen_t(addr.pointee.sa_len),
                                  &host, socklen_t(host.count),
                                  nil, 0, NI_NUMERICHOST)
            guard err == 0 else { continue }
            let ip = String(cString: host)

            // Keep private ranges only; skip link-local 169.254.x.x
            guard ip.hasPrefix("192.168.") || ip.hasPrefix("10.") || ip.hasPrefix("172.") else { continue }

            let parts = ip.split(separator: ".").compactMap { Int($0) }
            guard parts.count == 4 else { continue }
            let base = "\(parts[0]).\(parts[1]).\(parts[2])"
            if !result.contains(where: { $0.base == base }) {
                result.append(Subnet(base: base, mine: parts[3]))
            }
        }
        return result
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
