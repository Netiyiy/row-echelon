import AVFAudio
import SwiftUI

extension Notification.Name {
    static let rowEchelonDidEnterBackground = Notification.Name("RowEchelonDidEnterBackground")
    static let rowEchelonDidBecomeActive = Notification.Name("RowEchelonDidBecomeActive")
}

@main
struct RowEchelonApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .ambient,
                mode: .default,
                options: [.mixWithOthers]
            )
        } catch {
            // WebKit still controls its own playback if the category cannot be configured.
        }
    }

    var body: some Scene {
        WindowGroup {
            GameContainerView()
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase, initial: true) { _, phase in
                    switch phase {
                    case .active:
                        NotificationCenter.default.post(name: .rowEchelonDidBecomeActive, object: nil)
                    case .inactive, .background:
                        NotificationCenter.default.post(name: .rowEchelonDidEnterBackground, object: nil)
                    @unknown default:
                        break
                    }
                }
        }
    }
}
