import SwiftUI

@main
struct GravityWatchStudioApp: App {
    init() {
        WatchSessionManager.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            StudioRootView()
        }
    }
}
