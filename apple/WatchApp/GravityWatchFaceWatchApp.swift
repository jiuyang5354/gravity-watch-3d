import SwiftUI

@main
struct GravityWatchFaceWatchApp: App {
    init() {
        WatchSessionManager.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            WatchFace3DView()
        }
    }
}
