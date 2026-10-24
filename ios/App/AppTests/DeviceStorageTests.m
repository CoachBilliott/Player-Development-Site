@import XCTest;
@import UIKit;
@import WebKit;

@interface DeviceStorageTests : XCTestCase
@end

@implementation DeviceStorageTests
- (void)waitForApp:(WKWebView *)webView deadline:(NSDate *)deadline completion:(void (^)(BOOL))completion {
    [webView evaluateJavaScript:@"Boolean(document.querySelector('.app-start-photo img') && window.Capacitor?.Plugins?.SecureStoragePlugin)"
        completionHandler:^(id ready, NSError *error) {
            if (!error && [ready isEqual:@YES] && !webView.loading) {
                completion(YES);
            } else if (deadline.timeIntervalSinceNow <= 0) {
                completion(NO);
            } else {
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
                    [self waitForApp:webView deadline:deadline completion:completion];
                });
            }
        }];
}
- (WKWebView *)findWebView:(UIView *)view {
    if ([view isKindOfClass:WKWebView.class]) return (WKWebView *)view;
    for (UIView *child in view.subviews) {
        WKWebView *found = [self findWebView:child];
        if (found) return found;
    }
    return nil;
}
- (void)testNativeKeychainAssetsAndGuidedTrainingWithoutCloudAccount {
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
        // Hosted tests start while WKWebView is still navigating. Wait outside
        // JavaScript so that initial navigation cannot destroy a pending call.
        [self waitForApp:webView deadline:[NSDate dateWithTimeIntervalSinceNow:20] completion:^(BOOL ready) {
        XCTAssertTrue(ready, @"The bundled app did not finish loading");
        if (!ready) { [completed fulfill]; return; }
        NSURL *scriptURL = [[NSBundle bundleForClass:self.class] URLForResource:@"native-smoke" withExtension:@"js"];
        NSString *script = [NSString stringWithContentsOfURL:scriptURL encoding:NSUTF8StringEncoding error:nil];
        XCTAssertNotNil(script);
        if (!script) { [completed fulfill]; return; }
        [webView callAsyncJavaScript:script
            arguments:@{@"key": key}
            inFrame:nil
            inContentWorld:WKContentWorld.pageWorld
            completionHandler:^(id result, NSError *error) {
                XCTAssertNil(error);
                XCTAssertEqualObjects(result, @YES);
                [completed fulfill];
            }];
        }];
    });
    [self waitForExpectationsWithTimeout:40 handler:nil];
}
@end
