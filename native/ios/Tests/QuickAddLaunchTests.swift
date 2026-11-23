import XCTest
@testable import EasyFinCompanion

final class QuickAddLaunchTests: XCTestCase {
    @MainActor
    func testRouteHasNoFinancialPayload() {
        let parts = URLComponents(url: QuickAddLaunch.webURL, resolvingAgainstBaseURL: false)!
        XCTAssertEqual(parts.scheme, "https")
        XCTAssertEqual(parts.host, "easyfin-soham.vercel.app")
        XCTAssertEqual(parts.queryItems, [URLQueryItem(name: "action", value: "quick-add")])
    }

    @MainActor
    func testLaunchRequestsAreDistinctNavigationEvents() {
        let router = QuickAddLaunch()
        XCTAssertNil(router.request)
        router.requestQuickAdd()
        let first = router.request
        router.requestQuickAdd()
        XCTAssertNotNil(first)
        XCTAssertNotEqual(first, router.request)
    }
}
