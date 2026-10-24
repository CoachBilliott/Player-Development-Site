import XCTest
import Capacitor
import WebKit

@MainActor
final class DeviceStorageTests: XCTestCase {
    func testNativeKeychainRoundTripWithoutCloudAccount() async throws {
        let key = "pd-native:simulator-test-" + UUID().uuidString
        // The host launches the actual app and its bundled WKWebView.
        var bridge: CAPBridgeViewController?
        for _ in 0..<100 {
            bridge = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .compactMap { $0.rootViewController as? CAPBridgeViewController }
                .first
            if bridge?.webView != nil { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let webView = try XCTUnwrap(bridge?.webView)
        let result = try await webView.callAsyncJavaScript("""
          for (let i = 0; i < 150; i++) {
            if (window.Capacitor?.Plugins?.SecureStoragePlugin) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          const store = window.Capacitor.Plugins.SecureStoragePlugin;
          if (!store || !window.Capacitor.isNativePlatform()) throw new Error('Native bridge is unavailable');
          try {
            await store.set({ key, value: 'fictional-native-fixture' });
            return (await store.get({ key })).value === 'fictional-native-fixture';
          } finally { await store.remove({ key }); }
        """, arguments: ["key": key], in: nil, contentWorld: .page)
        XCTAssertEqual(result as? Bool, true)
    }
}
