import AppIntents
import Combine
import Foundation

/// Navigation only. Financial records never enter the native process or widget.
enum QuickAddDestination: String, AppEnum {
    case quickAdd
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "EasyFin destination")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .quickAdd: DisplayRepresentation(title: "Quick Add")
    ]
}

@MainActor
final class QuickAddLaunch: ObservableObject {
    static let shared = QuickAddLaunch()
    static let webURL = URL(string: "https://easyfin-soham.vercel.app/?action=quick-add")!
    @Published private(set) var request: UUID?

    func requestQuickAdd() { request = UUID() }
}

/// Target membership MUST include both the app and widget extension.
/// OpenIntent brings the host app forward; no custom URL scheme is used.
struct OpenQuickAddIntent: OpenIntent {
    static var title: LocalizedStringResource = "EasyFin Quick Add"
    static var description = IntentDescription("Open EasyFin’s focused web expense entry. This launcher does not save records.")
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Destination") var target: QuickAddDestination

    init() { target = .quickAdd }

    @MainActor
    func perform() async throws -> some IntentResult {
        QuickAddLaunch.shared.requestQuickAdd()
        return .result()
    }
}

struct EasyFinShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenQuickAddIntent(),
            phrases: ["Quick Add in \(.applicationName)", "Open \(.applicationName) Quick Add"],
            shortTitle: "Quick Add",
            systemImageName: "plus.circle"
        )
    }
}
