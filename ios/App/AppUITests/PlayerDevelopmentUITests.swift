import XCTest

final class PlayerDevelopmentUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testAppWelcomeDemoAndSavedFamilyRoster() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.links["Try the sample demo"].waitForExistence(timeout: 30))
        let welcome = XCTAttachment(screenshot: app.screenshot())
        welcome.name = "iPhone-app-welcome"
        welcome.lifetime = .keepAlways
        add(welcome)
        app.links["Try the sample demo"].tap()
        XCTAssertTrue(app.buttons["Parent & family"].waitForExistence(timeout: 15))
        let addAthlete = app.buttons["Add fictional athlete Jordan"]
        for _ in 0..<5 {
            if addAthlete.isHittable { break }
            app.swipeUp()
        }
        if addAthlete.exists { addAthlete.tap() }
        XCTAssertTrue(app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Jordan")).firstMatch.waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.links["Try the sample demo"].waitForExistence(timeout: 30))
        app.links["Try the sample demo"].tap()
        XCTAssertTrue(app.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", "Jordan")).firstMatch.waitForExistence(timeout: 15))
        let demo = XCTAttachment(screenshot: app.screenshot())
        demo.name = "iPhone-family-demo"
        demo.lifetime = .keepAlways
        add(demo)
    }

    func testPrivateLoginAndAppNavigationWithoutSendingCredentials() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.links["Log in to your account"].waitForExistence(timeout: 30))
        app.links["Log in to your account"].tap()
        let signIn = app.buttons["Sign in securely"]
        for _ in 0..<5 {
            if signIn.exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(signIn.waitForExistence(timeout: 20))
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        let login = XCTAttachment(screenshot: app.screenshot())
        login.name = "iPhone-private-login"
        login.lifetime = .keepAlways
        add(login)
        // No email/password is entered and no Auth request is submitted.
        app.links["Help"].tap()
        XCTAssertTrue(app.staticTexts["Your app, explained."].waitForExistence(timeout: 15))
    }
}
