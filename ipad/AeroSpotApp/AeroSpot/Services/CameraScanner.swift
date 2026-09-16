// CameraScanner.swift — én-gangs subnett-skann etter Canon CCAPI-kamera.
// Fallback for auto-reconnect: når tilkobling til lagret IP feiler vedvarende
// (typisk fordi DHCP ga kameraet en ny IP), finner vi kameraet på nytt og
// bytter IP sømløst. Selvstendig — reuser kun CCAPIClient.makeInsecureSession.

import Foundation

enum CameraScanner {
    /// Enhetens lokale IPv4 på Wi-Fi (en0). nil hvis ikke på Wi-Fi.
    static func localIPv4() -> String? {
        var result: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let ifa = p.pointee
            if let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET),
               String(cString: ifa.ifa_name) == "en0" {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(addr, socklen_t(addr.pointee.sa_len),
                            &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
                result = String(cString: host)
            }
            ptr = ifa.ifa_next
        }
        return result
    }

    /// Skann eget /24-subnett. Returner første host som svarer som Canon CCAPI,
    /// ellers nil. Parallell med tak på samtidige prober.
    static func scanForCanon(timeoutPerHost: Double = 1.2) async -> String? {
        guard let ip = localIPv4() else { return nil }
        let parts = ip.split(separator: ".")
        guard parts.count == 4 else { return nil }
        let prefix = parts.prefix(3).joined(separator: ".")
        let candidates = (1...254)
            .map { "\(prefix).\($0)" }
            .filter { $0 != ip }

        return await withTaskGroup(of: String?.self) { group in
            let maxConcurrent = 24
            var next = 0
            func schedule() {
                guard next < candidates.count else { return }
                let host = candidates[next]; next += 1
                group.addTask { await probe(host: host, timeout: timeoutPerHost) ? host : nil }
            }
            for _ in 0..<min(maxConcurrent, candidates.count) { schedule() }

            var found: String?
            while let result = await group.next() {
                if let hit = result {
                    found = hit
                    group.cancelAll()
                    break
                }
                schedule()
            }
            return found
        }
    }

    /// Bekreft at host er et Canon CCAPI-kamera: GET /ccapi/ → 200 + versjons-kart.
    private static func probe(host: String, timeout: Double) async -> Bool {
        guard let url = URL(string: "https://\(host):443/ccapi/") else { return false }
        let session = CCAPIClient.makeInsecureSession(trustingHostOf: url)
        var request = URLRequest(url: url)
        request.timeoutInterval = timeout
        guard let (data, response) = try? await session.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let body = String(data: data, encoding: .utf8),
              body.contains("ver1")   // {"ver100":[...]} — Canon CCAPI-signatur
        else { return false }
        return true
    }
}
