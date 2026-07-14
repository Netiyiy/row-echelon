import SwiftUI
import UIKit
import WebKit

struct GameWebView: UIViewRepresentable {
    @Binding var loadState: GameLoadState
    let reloadToken: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(loadState: $loadState)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "RowEchelon-iOS/1.0"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let bridge = WKUserContentController()
        bridge.add(context.coordinator, name: Coordinator.bridgeName)
        bridge.addUserScript(WKUserScript(
            source: Coordinator.nativeBridgeScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        configuration.userContentController = bridge

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 74 / 255, green: 48 / 255, blue: 38 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        #if DEBUG
        webView.isInspectable = true
        #endif

        context.coordinator.attach(webView)
        context.coordinator.loadLocalGame(reloadToken: reloadToken)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.update(loadState: $loadState)
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.loadLocalGame(reloadToken: reloadToken)
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Coordinator.bridgeName)
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        coordinator.detach()
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        static let bridgeName = "rowEchelonNative"

        static let nativeBridgeScript = #"""
        (() => {
          if (window.__rowEchelonNativeBridgeInstalled) return;
          window.__rowEchelonNativeBridgeInstalled = true;
          const bridge = window.webkit?.messageHandlers?.rowEchelonNative;
          if (!bridge) return;
          const send = (kind) => bridge.postMessage(kind);

          document.addEventListener("click", (event) => {
            if (!(event.target instanceof Element)) return;
            const button = event.target.closest("button");
            if (!button) return;
            if (button.matches("#intro-begin, #next-level-button")) send("impact-heavy");
            else if (button.matches(".matrix-row, .operation-button, #reset-button")) send("impact-medium");
            else send("impact-light");
          }, true);

          const shell = document.querySelector(".game-shell");
          if (shell) {
            let wasCelebrating = shell.classList.contains("celebrating");
            new MutationObserver(() => {
              const celebrating = shell.classList.contains("celebrating");
              if (celebrating && !wasCelebrating) send("success");
              wasCelebrating = celebrating;
            }).observe(shell, { attributes: true, attributeFilter: ["class"] });
          }
          send("ready");
        })();
        """#

        @Binding private var loadState: GameLoadState
        weak var webView: WKWebView?
        var lastReloadToken: UUID?

        init(loadState: Binding<GameLoadState>) {
            _loadState = loadState
            super.init()

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(pauseForBackground),
                name: .rowEchelonDidEnterBackground,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(resumeFromBackground),
                name: .rowEchelonDidBecomeActive,
                object: nil
            )
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }

        func update(loadState: Binding<GameLoadState>) {
            _loadState = loadState
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func detach() {
            NotificationCenter.default.removeObserver(self)
            webView = nil
        }

        func loadLocalGame(reloadToken: UUID) {
            lastReloadToken = reloadToken
            guard
                let indexURL = Bundle.main.url(
                    forResource: "index",
                    withExtension: "html",
                    subdirectory: "Web"
                )
            else {
                Task { @MainActor [weak self] in
                    self?.loadState = .failed("The bundled game resources are missing.")
                }
                return
            }

            webView?.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        }

        @objc private func pauseForBackground() {
            webView?.evaluateJavaScript("window.dispatchEvent(new Event('pagehide'))")
            webView?.pauseAllMediaPlayback(completionHandler: {})
        }

        @objc private func resumeFromBackground() {
            webView?.evaluateJavaScript("window.dispatchEvent(new Event('pageshow'))")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loadState = .ready
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            handle(error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            handle(error)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            loadState = .loading
            webView.reload()
        }

        private func handle(_ error: Error) {
            let nsError = error as NSError
            guard nsError.code != NSURLErrorCancelled else { return }
            loadState = .failed(error.localizedDescription)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard
                navigationAction.navigationType == .linkActivated,
                let url = navigationAction.request.url,
                let scheme = url.scheme?.lowercased(),
                ["http", "https"].contains(scheme)
            else {
                decisionHandler(.allow)
                return
            }

            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard let kind = message.body as? String else { return }
            switch kind {
            case "impact-light":
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            case "impact-medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "impact-heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "success":
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            default:
                break
            }
        }
    }
}
