import Foundation
import WebKit

/// Native ↔ Web Apple Pencil signature bridge.
///
/// Problem: the CreatorHub web app has rich forms (quote builder,
/// invoice approval, contract addenda) that need a handwritten
/// signature, but web PointerEvents on iPad don't expose Apple
/// Pencil pressure + tilt. Running the React form inside a
/// ``WKWebView`` and doing the signature capture natively gives us
/// PencilKit-quality ink without duplicating the entire form in
/// SwiftUI.
///
/// Protocol:
///   1. Web calls
///      ``window.webkit.messageHandlers.pencilBridge.postMessage({
///         callbackId: "uuid", title: "Signer tilbud",
///         prompt: "Fotografens godkjenning"
///      })``.
///   2. Native resolves the request via ``PencilBridge.Request``,
///      surfaces it to the host SwiftUI view, which presents a
///      ``SignatureCanvasView``.
///   3. On finish/cancel, native evaluates
///      ``window.__creatorhubOnePencilResolve(callbackId, payload)``
///      where payload is either ``{ pngBase64, width, height }`` or
///      ``null``.
///   4. The installed ``CreatorHubOne.requestSignature(opts)`` JS
///      shim wraps (1)+(3) as a Promise, so the web form can:
///      ``const sig = await window.CreatorHubOne.requestSignature({
///         title: "Signer tilbud" });``
///      without thinking about callback plumbing.
///
/// The bridge is isolated per ``AuthenticatedWebView``: two tabs
/// have two bridges so a signature request in the Quote tab can't
/// collide with one in the Contract tab.
final class PencilBridge: NSObject, WKScriptMessageHandler {

    /// A signature capture request, decoded from the JS postMessage.
    struct Request: Equatable {
        let callbackId: String
        let title: String
        let prompt: String?
    }

    /// Called when the web page asks for a signature. The host SwiftUI
    /// view is responsible for presenting ``SignatureCanvasView``
    /// and feeding the capture back via ``resolve``.
    ///
    /// The bridge holds a weak pointer to the hosting ``WKWebView``
    /// so ``resolve`` can evaluate the completion callback on the
    /// same page that issued the request. A weak capture is correct
    /// here — the web view owns the content controller, which owns
    /// the bridge; without weak we'd create a retain cycle.
    var onRequest: ((Request) -> Void)?

    private weak var webView: WKWebView?

    /// JS-side script handler name. Exposed so ``AuthenticatedWebView``
    /// registers + the shim below both refer to the same string.
    static let messageName = "pencilBridge"

    /// User script that defines ``window.CreatorHubOne.requestSignature``
    /// as a Promise-returning wrapper around the postMessage bridge.
    /// Installed via ``AuthenticatedWebView`` when the bridge is on.
    ///
    /// Re-running the script is a no-op because the factory assigns
    /// ``window.CreatorHubOne`` only if it isn't already bound, so a
    /// web-side SPA hot-reload doesn't wipe in-flight callbacks.
    static let shimSource = """
    (function() {
      if (window.CreatorHubOne && window.CreatorHubOne.__pencilReady) { return; }
      var pending = {};
      window.__creatorhubOnePencilResolve = function(cbId, payload) {
        var entry = pending[cbId];
        if (!entry) { return; }
        delete pending[cbId];
        try { entry(payload); } catch (e) { console.warn('pencil bridge resolve failed', e); }
      };
      window.CreatorHubOne = window.CreatorHubOne || {};
      window.CreatorHubOne.__pencilReady = true;
      window.CreatorHubOne.isIPadNative = function() {
        try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pencilBridge != null; }
        catch (_) { return false; }
      };
      window.CreatorHubOne.requestSignature = function(opts) {
        return new Promise(function(resolve) {
          if (!window.CreatorHubOne.isIPadNative()) { resolve(null); return; }
          var cbId = (crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
          pending[cbId] = resolve;
          try {
            window.webkit.messageHandlers.pencilBridge.postMessage({
              callbackId: cbId,
              title: (opts && opts.title) || 'Signatur',
              prompt: (opts && opts.prompt) || null
            });
          } catch (e) {
            delete pending[cbId];
            resolve(null);
          }
        });
      };
    })();
    """

    /// Attach the bridge to a ``WKWebViewConfiguration``. Idempotent —
    /// re-attaching replaces the prior handler so iOS doesn't crash
    /// with "handler already registered for name".
    @MainActor
    static func attach(
        to config: WKWebViewConfiguration,
        onRequest: @escaping (Request) -> Void,
    ) -> PencilBridge {
        let bridge = PencilBridge()
        bridge.onRequest = onRequest
        let controller = config.userContentController
        // iOS throws if the same name is registered twice; remove
        // defensively so re-entry in SwiftUI previews doesn't crash.
        controller.removeScriptMessageHandler(forName: messageName)
        controller.add(bridge, name: messageName)

        let shim = WKUserScript(
            source: shimSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false,
        )
        controller.addUserScript(shim)
        return bridge
    }

    /// Wire up the ``WKWebView`` that hosts this bridge. Must be set
    /// as soon as the web view is created so ``resolve`` has
    /// somewhere to evaluate its JS callback.
    @MainActor
    func bind(webView: WKWebView) {
        self.webView = webView
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
    ) {
        guard message.name == Self.messageName else { return }
        guard let request = Self.decode(message.body) else { return }
        // Hop to main so the caller can safely present SwiftUI sheets.
        if Thread.isMainThread {
            onRequest?(request)
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.onRequest?(request)
            }
        }
    }

    /// Decode the raw JS body into a typed request. Exposed for
    /// testing because the JS↔Swift message shape is load-bearing.
    ///
    /// ``nonisolated``: ``WKScriptMessageHandler`` carries
    /// ``@MainActor`` inference to classes that adopt it, which
    /// would otherwise force every call site (including unit tests)
    /// to hop to the main actor. Decode is pure — no shared state
    /// — so opting out of isolation is safe and avoids the Swift 6
    /// "sending" diagnostic on the ``Any`` body.
    nonisolated static func decode(_ body: Any) -> Request? {
        guard let dict = body as? [String: Any] else { return nil }
        guard let callbackId = dict["callbackId"] as? String, !callbackId.isEmpty
        else { return nil }
        let title = (dict["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Signatur"
        let prompt: String? = {
            if let s = dict["prompt"] as? String, !s.isEmpty { return s }
            return nil
        }()
        return Request(callbackId: callbackId, title: title, prompt: prompt)
    }

    // MARK: - Resolve

    /// Hand the captured signature back to the page. ``capture`` is
    /// nil when the photographer cancelled; the JS promise resolves
    /// with ``null`` so the form can show a "signatur avbrutt"
    /// indicator rather than hang.
    @MainActor
    func resolve(callbackId: String, capture: SignatureCapture?) {
        let payloadJS: String
        if let capture {
            let base64 = capture.pngData.base64EncodedString()
            let width = Int(capture.bounds.width)
            let height = Int(capture.bounds.height)
            payloadJS = "{ pngBase64: \(Self.jsString(base64)), width: \(width), height: \(height) }"
        } else {
            payloadJS = "null"
        }
        let script = """
        (function() {
          if (typeof window.__creatorhubOnePencilResolve === 'function') {
            window.__creatorhubOnePencilResolve(\(Self.jsString(callbackId)), \(payloadJS));
          }
        })();
        """
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }

    /// Emit a double-quoted JS string literal. Mirrors the escape
    /// rules in ``WebViewAuthBridge.jsStringLiteral`` so injected
    /// values can't break out of the literal.
    static func jsString(_ value: String) -> String {
        var out = "\""
        out.reserveCapacity(value.count + 2)
        for ch in value {
            switch ch {
            case "\\": out.append("\\\\")
            case "\"": out.append("\\\"")
            case "\n": out.append("\\n")
            case "\r": out.append("\\r")
            case "\t": out.append("\\t")
            case "<": out.append("\\u003c")
            default: out.append(ch)
            }
        }
        out.append("\"")
        return out
    }
}
