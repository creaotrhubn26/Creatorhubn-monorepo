import Foundation
import WebKit

/// Plumbing that lets a ``WKWebView`` share the photographer's
/// signed-in session with the CreatorHub web app. Without this,
/// every admin / messages / gallery tab would prompt for a fresh
/// login the first time the photographer touches it — the opposite
/// of "one app".
///
/// The bridge has three parallel mechanisms, because different
/// parts of the web stack read auth from different places and we
/// don't want the tab to break if any single one gets refactored:
///
///   1. **Cookie** on the backend's cookie-store. ``apiRequest`` on
///      the web side reads ``document.cookie`` as a fallback when
///      the Authorization header isn't present. Cookies also
///      survive the page's own ``fetch`` calls automatically.
///
///   2. **localStorage** pre-seed via a ``WKUserScript`` injected
///      ``atDocumentStart``. The web ``getAuthHeader()`` reads
///      localStorage.creatorhub_auth_token and localStorage.creatorhub_user_id
///      on bootstrap. Running *before* document start means the
///      React app sees the values on first render — no flash of
///      signed-out UI.
///
///   3. **User-agent suffix** ``CreatorHubOne-iPad/1.0`` so the
///      backend + any future client-side analytics can detect the
///      embedded-native context and adjust (e.g. hide "Download
///      iPad app" banners).
///
/// The bridge is idempotent: calling it twice on the same config
/// replaces the prior script + overwrites the cookie. Tear-down via
/// ``signOut(config:)`` clears all three so a log-out from native
/// actually signs out the WebView too.
struct WebViewAuthBridge {

    /// One-shot wiring: call before the WKWebView loads its first
    /// page. Returns the same configuration so call sites can chain
    /// in SwiftUI builders.
    @MainActor
    @discardableResult
    static func attach(
        to config: WKWebViewConfiguration,
        session: SignInService.StoredSession,
    ) async -> WKWebViewConfiguration {
        // 1 — Cookie
        if let host = session.backendBaseURL.host,
           let cookie = HTTPCookie(properties: [
               .domain: host,
               .path: "/",
               .name: "creatorhub_auth",
               .value: session.bearer,
               .secure: true,
               // No expires set → session cookie; dies when the
               // backing process tears down. Matches the web
               // behaviour of per-browser-session tokens.
           ])
        {
            await config.websiteDataStore.httpCookieStore.setCookie(cookie)
        }

        // 2 — localStorage pre-seed script. The web app reads these
        // keys on bootstrap. Triple-escaped so the JSON we inject
        // can't break out of the string literal into executable
        // code.
        let tokenJS = jsStringLiteral(session.bearer)
        let userIdJS = jsStringLiteral(session.userId)
        let emailJS = jsStringLiteral(session.email)
        let displayJS = jsStringLiteral(session.displayName)
        let script = WKUserScript(
            source: """
            (function() {
              try {
                localStorage.setItem('creatorhub_auth_token', \(tokenJS));
                localStorage.setItem('creatorhub_user_id', \(userIdJS));
                localStorage.setItem('creatorhub_user_email', \(emailJS));
                localStorage.setItem('creatorhub_user_display', \(displayJS));
                // Mark the embedding so React can opt into
                // iPad-specific rendering (larger touch targets,
                // hide download banners, bridge Pencil events).
                localStorage.setItem('creatorhub_embedding', 'ipad-native');
              } catch (e) {
                // Private browsing / storage disabled: fall through.
                // Cookie will still carry auth; just flag.
                console.warn('CreatorHubOne auth bridge: localStorage blocked', e);
              }
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false,
        )
        // Replace any prior script — WKUserContentController keeps
        // a stack of scripts and re-running attach() would otherwise
        // double-inject.
        config.userContentController.removeAllUserScripts()
        config.userContentController.addUserScript(script)

        return config
    }

    /// Clear the bridge state on log-out. We explicitly don't
    /// remove *all* cookies/storage — only the keys we wrote —
    /// so any non-CreatorHub site the WebView happened to visit
    /// keeps its own session intact.
    @MainActor
    static func clear(
        config: WKWebViewConfiguration,
        for baseURL: URL,
    ) async {
        config.userContentController.removeAllUserScripts()

        if let host = baseURL.host {
            let store = config.websiteDataStore.httpCookieStore
            let cookies = await store.allCookies()
            for cookie in cookies where cookie.domain == host {
                if cookie.name.hasPrefix("creatorhub_") {
                    await store.deleteCookie(cookie)
                }
            }
        }
        // Inject a clear-localStorage script for the next page load,
        // so a logged-in page already rendered in the WebView gets
        // flushed when the photographer switches accounts without
        // killing the tab.
        let clearScript = WKUserScript(
            source: """
            (function() {
              try {
                localStorage.removeItem('creatorhub_auth_token');
                localStorage.removeItem('creatorhub_user_id');
                localStorage.removeItem('creatorhub_user_email');
                localStorage.removeItem('creatorhub_user_display');
                localStorage.removeItem('creatorhub_embedding');
              } catch (_) { /* noop */ }
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false,
        )
        config.userContentController.addUserScript(clearScript)
    }

    /// User-agent suffix the bridge stamps onto outgoing requests
    /// via ``WKWebView.customUserAgent`` so the backend + analytics
    /// can detect the embedded-native context.
    static let userAgentSuffix = "CreatorHubOne-iPad/1.0"

    // MARK: - JS string escaping

    /// Emit a JS string literal that's safe to embed in the
    /// injected source — escapes backslash, quotes, newlines, and
    /// terminates cleanly. Exposed for testing.
    static func jsStringLiteral(_ value: String) -> String {
        var escaped = ""
        escaped.reserveCapacity(value.count + 2)
        escaped.append("\"")
        for char in value {
            switch char {
            case "\\": escaped.append("\\\\")
            case "\"": escaped.append("\\\"")
            case "\n": escaped.append("\\n")
            case "\r": escaped.append("\\r")
            case "\t": escaped.append("\\t")
            case "<":
                // </script> breaks the injected script tag; escape
                // the opening angle bracket to prevent early close.
                escaped.append("\\u003c")
            default:
                escaped.append(char)
            }
        }
        escaped.append("\"")
        return escaped
    }
}
