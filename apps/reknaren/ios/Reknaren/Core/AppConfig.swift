import Foundation

/// Sentral konfig. Base-URL kan overstyres via `REKNAREN_API_BASE` i Info.plist ved
/// lokal utvikling; ellers prod. Samme backend som web-appen → app og web i sync.
enum AppConfig {
    static let apiBase: URL = {
        if let s = Bundle.main.object(forInfoDictionaryKey: "REKNAREN_API_BASE") as? String,
           let u = URL(string: s) {
            return u
        }
        return URL(string: "https://ledgerly-coss.onrender.com")!
    }()
}
