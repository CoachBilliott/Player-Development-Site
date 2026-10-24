@import XCTest;
@import UIKit;
@import WebKit;

@interface DeviceStorageTests : XCTestCase
@end

@implementation DeviceStorageTests
- (WKWebView *)findWebView:(UIView *)view {
    if ([view isKindOfClass:WKWebView.class]) return (WKWebView *)view;
    for (UIView *child in view.subviews) {
        WKWebView *found = [self findWebView:child];
        if (found) return found;
    }
    return nil;
}
- (void)testNativeKeychainRoundTripWithoutCloudAccount {
    XCTestExpectation *completed = [self expectationWithDescription:@"Native Keychain round trip"];
    NSString *key = [@"pd-native:simulator-test-" stringByAppendingString:NSUUID.UUID.UUIDString];
    dispatch_async(dispatch_get_main_queue(), ^{
        WKWebView *webView = nil;
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if ([scene isKindOfClass:UIWindowScene.class]) {
                for (UIWindow *window in ((UIWindowScene *)scene).windows) {
                    webView = [self findWebView:window.rootViewController.view];
                    if (webView) {
                        break;
                    }
                }
            }
        }
        XCTAssertNotNil(webView);
        if (!webView) { [completed fulfill]; return; }
        NSString *script =
          @"for (let i = 0; i < 150; i++) {"
           " if (window.Capacitor?.Plugins?.SecureStoragePlugin) break;"
           " await new Promise(resolve => setTimeout(resolve, 100));"
           "}"
           "const store = window.Capacitor.Plugins.SecureStoragePlugin;"
           "if (!store || !window.Capacitor.isNativePlatform()) throw new Error('Native bridge is unavailable');"
           "const image = document.querySelector('.app-start-photo img');"
           "if (!image) throw new Error('The app welcome image is missing');"
           "await image.decode();"
           "await document.fonts.ready;"
           "if (image.naturalWidth !== 1440) throw new Error('Bundled welcome image did not load: ' + image.src);"
           "if (!document.fonts.check('700 16px \"Barlow Condensed\"')) throw new Error('Bundled display font did not load');"
           "try {"
           " await store.set({ key, value: 'fictional-native-fixture' });"
           " return (await store.get({ key })).value === 'fictional-native-fixture';"
           "} finally { await store.remove({ key }); }";
        [webView callAsyncJavaScript:script
            arguments:@{@"key": key}
            inFrame:nil
            inContentWorld:WKContentWorld.pageWorld
            completionHandler:^(id result, NSError *error) {
                XCTAssertNil(error);
                XCTAssertEqualObjects(result, @YES);
                [completed fulfill];
            }];
    });
    [self waitForExpectationsWithTimeout:30 handler:nil];
}
@end
