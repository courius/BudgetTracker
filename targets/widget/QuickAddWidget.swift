import SwiftUI
import WidgetKit

// A "+" you can put on the Lock Screen (or Home Screen). Tapping it opens the app straight
// on the amount keypad via the budgettracker://add deep link.

struct QuickAddEntry: TimelineEntry {
  let date: Date
}

struct QuickAddProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: .now) }

  func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
    completion(QuickAddEntry(date: .now))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
    // Static content: nothing to refresh.
    completion(Timeline(entries: [QuickAddEntry(date: .now)], policy: .never))
  }
}

struct QuickAddView: View {
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        ZStack {
          AccessoryWidgetBackground()
          Image(systemName: "plus").font(.system(size: 24, weight: .bold))
        }
      case .accessoryRectangular:
        HStack(spacing: 8) {
          Image(systemName: "plus.circle.fill").font(.system(size: 26, weight: .semibold))
          VStack(alignment: .leading) {
            Text("Add expense").font(.headline)
            Text("BudgetTracker").font(.caption).opacity(0.7)
          }
          Spacer(minLength: 0)
        }
      default:
        VStack(spacing: 8) {
          Image(systemName: "plus.circle.fill")
            .font(.system(size: 44, weight: .semibold))
            .foregroundStyle(Color("AccentColor"))
          Text("Add expense").font(.footnote.weight(.semibold)).foregroundStyle(.white)
        }
      }
    }
    .widgetURL(URL(string: "budgettracker://add"))
    .containerBackground(for: .widget) { Color("WidgetBackground") }
  }
}

struct QuickAddWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "QuickAdd", provider: QuickAddProvider()) { _ in
      QuickAddView()
    }
    .configurationDisplayName("Add expense")
    .description("Jump straight to adding an expense.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .systemSmall])
  }
}

@main
struct QuickAddBundle: WidgetBundle {
  var body: some Widget {
    QuickAddWidget()
  }
}
