import SwiftUI
import UIKit

/// A launcher, deliberately NOT a WKWebView wrapper with a separate expense DB.
@main
struct EasyFinCompanionApp: App {
    var body: some Scene {
        WindowGroup { LauncherView() }
    }
}

struct LauncherView: View {
    @ObservedObject private var launch = QuickAddLaunch.shared
    @Environment(\.scenePhase) private var scenePhase
    @State private var consumedRequest: UUID?
    @State private var opening = false
    @State private var handoffFailed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 52, weight: .light))
                .foregroundStyle(.blue)
            Text("Less friction.\nMore clarity.")
                .font(.system(size: 38, weight: .medium, design: .default))
                .tracking(-1.5)
            Text("EasyFin Quick Add")
                .font(.headline)
            Text("This companion launches the web form in your default browser. Expenses stay in that browser’s EasyFin database. It cannot access or merge the installed web app’s storage.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button(action: openWebForm) {
                Label(opening ? "Opening…" : "Open Quick Add", systemImage: "arrow.up.forward")
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            .buttonStyle(.borderedProminent)
            .disabled(opening)
            if handoffFailed {
                Text("Could not open the browser. Try again, or open EasyFin from its Home Screen icon.")
                    .font(.footnote).foregroundStyle(.red)
            }
            Text("After installation, add EasyFin Quick Add to Lock Screen controls or Control Center. The same action is available in Shortcuts and on an Action Button where supported. iOS handles authentication before the intent runs.")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .padding(28)
        .frame(maxWidth: 500, maxHeight: .infinity, alignment: .center)
        .background(Color(uiColor: .systemBackground))
        .privacySensitive()
        .overlay { if scenePhase != .active { Color(uiColor: .systemBackground).ignoresSafeArea() } }
        .onChange(of: launch.request) { _, _ in consumeIntent() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { consumeIntent() } }
        .task { consumeIntent() }
    }

    private func consumeIntent() {
        guard scenePhase == .active, let request = launch.request,
              consumedRequest != request, !opening else { return }
        // Consume before handoff so returning from Safari does not launch it again.
        consumedRequest = request
        openWebForm()
    }

    private func openWebForm() {
        guard !opening else { return }
        opening = true
        handoffFailed = false
        UIApplication.shared.open(QuickAddLaunch.webURL, options: [:]) { accepted in
            DispatchQueue.main.async {
                opening = false
                // Accepted means only a URL handoff, never expense-save success.
                handoffFailed = !accepted
            }
        }
    }
}
