@import XCTest;
@import Capacitor;
@import WebKit;

@interface DeviceStorageTests : XCTestCase
@end

@implementation DeviceStorageTests
- (void)testNativeKeychainRoundTripWithoutCloudAccount {
    XCTestExpectation *completed = [self expectationWithDescription:@"Native Keychain round trip"];
    NSString *key = [@"pd-native:simulator-test-" stringByAppendingString:NSUUID.UUID.UUIDString];
    dispatch_async(dispatch_get_main_queue(), ^{
        CAPBridgeViewController *bridge = nil;
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if ([scene isKindOfClass:UIWindowScene.class]) {
                for (UIWindow *window in ((UIWindowScene *)scene).windows) {
                    if ([window.rootViewController isKindOfClass:CAPBridgeViewController.class]) {
                        bridge = (CAPBridgeViewController *)window.rootViewController;
                        break;
                    }
                }
            }
        }
        XCTAssertNotNil(bridge.webView);
        if (!bridge.webView) { [completed fulfill]; return; }
        NSString *script =
          @"for (let i = 0; i < 150; i++) {"
           " if (window.Capacitor?.Plugins?.SecureStoragePlugin) break;"
           " await new Promise(resolve => setTimeout(resolve, 100));"
           "}"
           "const store = window.Capacitor.Plugins.SecureStoragePlugin;"
           "if (!store || !window.Capacitor.isNativePlatform()) throw new Error('Native bridge is unavailable');"
           "try {"
           " await store.set({ key, value: 'fictional-native-fixture' });"
           " return (await store.get({ key })).value === 'fictional-native-fixture';"
           "} finally { await store.remove({ key }); }";
        [bridge.webView callAsyncJavaScript:script
            arguments:@{@"key": key}
            inFrame:nil
            inContentWorld:WKContentWorld.pageWorld
            completionHandler:^(id result, NSError *error) {
                XCTAssertNil(error);
                XCTAssertEqualObjects(result, @YES);
                [completed fulfill];
            }];
    });
    [self waitForExpectations:@[completed] timeout:30];
}
@end
