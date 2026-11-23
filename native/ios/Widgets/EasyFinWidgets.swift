import AppIntents
import SwiftUI
import WidgetKit

struct QuickAddEntry: TimelineEntry { let date: Date }
struct QuickAddTimeline: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        completion(Timeline(entries: [QuickAddEntry(date: .now)], policy: .never))
    }
}

struct QuickAddLockWidget: Widget {
    let kind = "EasyFin.QuickAdd.LockScreen"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddTimeline()) { _ in
            Button(intent: OpenQuickAddIntent()) {
                Label("Quick Add", systemImage: "plus.circle")
            }
            .buttonStyle(.plain)
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("EasyFin Quick Add")
        .description("Authenticate and open focused web expense entry. No financial data appears here.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
    }
}

struct QuickAddControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "EasyFin.QuickAdd.Control") {
            ControlWidgetButton(action: OpenQuickAddIntent()) {
                Label("Quick Add", systemImage: "plus.circle")
            }
        }
        .displayName("EasyFin Quick Add")
        .description("Open focused web expense entry after authentication.")
    }
}

@main
struct EasyFinWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickAddLockWidget()
        QuickAddControl()
    }
}
