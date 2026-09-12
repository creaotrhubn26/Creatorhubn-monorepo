import SwiftUI
import WebKit

/// SwiftUI wrapper around ``WKWebView`` that:
///   1. Injects the photographer's CreatorHub session (via
///      ``WebViewAuthBridge``) so the embedded creatorhubn.com
///      page boots already-signed-in.
///   2. Intercepts ``creatorhubone://`` deep-links via
///      ``WKNavigationDelegate`` and routes them to the supplied
///      ``onDeepLink`` handler, so web-side links can jump the
///      photographer into the native shoot / cull surfaces.
///   3. Surfaces a simple "loading / ready / error" status for the
///      parent view to render a progress bar or retry affordance.
///
/// Designed to be the shared substrate for the Admin / Messages /
/// Gallery / Pricing tabs (tasks #61-65). Each of those is just a
/// ``AuthenticatedWebView`` pointing at a different creatorhubn.com
/// path + an on-deep-link handler that matches the relevant
/// intent.
struct AuthenticatedWebView: View {
    let url: URL
    let session: SignInService.StoredSession
    var onDeepLink: (DeepLinkRouter.Intent) -> Void = { _ in }
    /// When true, installs ``PencilBridge`` so the embedded page can
    /// call ``window.CreatorHubOne.requestSignature()`` and receive a
    /// native Apple Pencil capture. Opt-in because most tabs (gallery,
    /// messages) don't need signatures and we don't want rogue scripts
    /// to pop a signature sheet unprovoked.
    var enablePencilBridge: Bool = false

    @State private var loadingProgress: Double = 0
    @State private var isReady = false
    @State private var loadError: String?
    @State private var pencilRequest: PencilBridge.Request?
    /// Holds a strong reference to the bridge for this view. The
    /// ``WKWebViewConfiguration`` stores the handler weakly, so
    /// without a SwiftUI-owned strong ref it gets deallocated
    /// mid-session and signature requests silently drop.
    @State private var bridgeBox = BridgeBox()

    var body: some View {
        ZStack(alignment: .top) {
            WKWebViewRepresentable(
                url: url,
                session: session,
                loadingProgress: $loadingProgress,
                isReady: $isReady,
                loadError: $loadError,
                onDeepLink: onDeepLink,
                enablePencilBridge: enablePencilBridge,
                pencilRequestSink: { request in pencilRequest = request },
                bridgeBox: bridgeBox,
            )

            if !isReady, loadError == nil {
                ProgressView(value: loadingProgress, total: 1)
                    .progressViewStyle(.linear)
                    .tint(.accentColor)
                    .padding(.top, 0)
            }

            if let error = loadError {
                VStack(spacing: 12) {
                    Label("Kunne ikke laste siden", systemImage: "wifi.exclamationmark")
                        .font(.headline)
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(uiColor: .systemBackground))
            }
        }
        .sheet(item: $pencilRequest) { request in
            SignatureCanvasView(
                title: request.title,
                prompt: request.prompt,
                onFinish: { capture in
                    bridgeBox.bridge?.resolve(
                        callbackId: request.callbackId,
                        capture: capture,
                    )
                    pencilRequest = nil
                },
            )
        }
    }
}

/// Container class so the SwiftUI view can hold a strong reference
/// to the bridge. Classes keep identity across re-renders, so the
/// ``PencilBridge`` instance installed in ``makeUIView`` survives
/// long enough for the sheet closure to resolve callbacks.
final class BridgeBox: @unchecked Sendable {
    var bridge: PencilBridge?
}

extension PencilBridge.Request: Identifiable {
    var id: String { callbackId }
}

/// UIViewRepresentable bridge. Held private so call sites use the
/// higher-level ``AuthenticatedWebView`` and don't get tempted to
/// create raw WKWebView instances that miss the auth bridge.
private struct WKWebViewRepresentable: UIViewRepresentable {
    let url: URL
    let session: SignInService.StoredSession
    @Binding var loadingProgress: Double
    @Binding var isReady: Bool
    @Binding var loadError: String?
    let onDeepLink: (DeepLinkRouter.Intent) -> Void
    let enablePencilBridge: Bool
    let pencilRequestSink: (PencilBridge.Request) -> Void
    let bridgeBox: BridgeBox

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Non-persistent preference: keep web storage across app
        // launches so the React bundle comes out of cache.
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.customUserAgent = (webView.value(forKey: "userAgent") as? String).map {
            "\($0) \(WebViewAuthBridge.userAgentSuffix)"
        } ?? WebViewAuthBridge.userAgentSuffix
        webView.navigationDelegate = context.coordinator
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = true

        // Progress observation. Using KVO lets us drive the
        // SwiftUI progress bar without having to poll.
        context.coordinator.progressObservation = webView.observe(
            \.estimatedProgress,
            options: [.new],
        ) { [weak coordinator = context.coordinator] _, change in
            guard let value = change.newValue else { return }
            Task { @MainActor in
                coordinator?.progressBinding.wrappedValue = value
                if value >= 0.99 {
                    coordinator?.readyBinding.wrappedValue = true
                }
            }
        }

        // Attach the auth bridge, then the Pencil bridge, then load.
        // Ordering matters: ``WebViewAuthBridge.attach`` calls
        // ``removeAllUserScripts`` to replace any prior auth-token
        // shim, which would also wipe the Pencil shim if we installed
        // it first. Script-message handlers aren't touched by that
        // call, but the shim must go in afterwards.
        let shouldEnablePencil = enablePencilBridge
        let sink = pencilRequestSink
        let box = bridgeBox
        Task { @MainActor in
            await WebViewAuthBridge.attach(to: config, session: session)
            if shouldEnablePencil {
                let bridge = PencilBridge.attach(
                    to: config,
                    onRequest: { request in sink(request) },
                )
                bridge.bind(webView: webView)
                box.bridge = bridge
            }
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // The URL is immutable for a given tab; nothing to do. If
        // we grow dynamic URL switching we'd diff + reload here.
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            progressBinding: $loadingProgress,
            readyBinding: $isReady,
            errorBinding: $loadError,
            onDeepLink: onDeepLink,
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let progressBinding: Binding<Double>
        let readyBinding: Binding<Bool>
        let errorBinding: Binding<String?>
        let onDeepLink: (DeepLinkRouter.Intent) -> Void
        var progressObservation: NSKeyValueObservation?

        init(
            progressBinding: Binding<Double>,
            readyBinding: Binding<Bool>,
            errorBinding: Binding<String?>,
            onDeepLink: @escaping (DeepLinkRouter.Intent) -> Void,
        ) {
            self.progressBinding = progressBinding
            self.readyBinding = readyBinding
            self.errorBinding = errorBinding
            self.onDeepLink = onDeepLink
        }

        deinit {
            progressObservation?.invalidate()
        }

        // MARK: - Deep-link interception

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void,
        ) {
            if let url = navigationAction.request.url,
               url.scheme == DeepLinkRouter.scheme {
                if let intent = DeepLinkRouter.parse(url) {
                    Task { @MainActor in self.onDeepLink(intent) }
                }
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // MARK: - HTTP error status (4xx / 5xx)

        // WKWebView treats an HTTP error like 404/500 as a *successful*
        // navigation and renders the response body — e.g. Express's bare
        // "Cannot GET <path>". Catch main-frame error statuses here and
        // surface the retry UI instead of the raw error page.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void,
        ) {
            if navigationResponse.isForMainFrame,
               let http = navigationResponse.response as? HTTPURLResponse,
               http.statusCode >= 400 {
                Task { @MainActor in
                    self.errorBinding.wrappedValue =
                        "Siden svarte med HTTP \(http.statusCode). Sjekk at du er logget inn og prøv igjen."
                }
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // MARK: - Error + ready state

        func webView(_ webView: WKWebView,
                     didFail navigation: WKNavigation!,
                     withError error: Error) {
            reportLoadFailure(error)
        }

        func webView(_ webView: WKWebView,
                     didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            reportLoadFailure(error)
        }

        /// Surface a real load failure — but ignore cancellations, which
        /// includes the `.cancel` we issue ourselves for HTTP error
        /// statuses above (so the precise "HTTP 404" message isn't
        /// clobbered by a generic "cancelled").
        private func reportLoadFailure(_ error: Error) {
            let ns = error as NSError
            let isCancellation =
                (ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled) ||
                (ns.domain == "WebKitErrorDomain" && ns.code == 102) // frame load interrupted by policy change
            if isCancellation { return }
            Task { @MainActor in
                self.errorBinding.wrappedValue = error.localizedDescription
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in
                self.readyBinding.wrappedValue = true
                self.errorBinding.wrappedValue = nil
            }
        }
    }
}
