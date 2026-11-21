import Combine
import Foundation
import WatchConnectivity

final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published private(set) var isSupported: Bool = WCSession.isSupported()
    @Published private(set) var isReachable: Bool = false
    @Published private(set) var activationState: WCSessionActivationState = .notActivated
    @Published private(set) var lastSyncedAt: Date?

    #if os(iOS)
    @Published private(set) var isPaired: Bool = false
    @Published private(set) var isWatchAppInstalled: Bool = false
    #endif

    @Published var latestRemoteConfig: GravitySyncConfig?
    var onRemoteConfigReceived: ((GravitySyncConfig) -> Void)?

    private var activated = false

    private override init() {
        super.init()
    }

    func activate() {
        guard !activated else { return }
        guard WCSession.isSupported() else {
            isSupported = false
            return
        }
        activated = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
        refreshSessionState(session)
    }

    func sendConfiguration(_ config: GravitySyncConfig) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.activationState != .activated {
            session.activate()
        }

        let payload = config.toDictionary()
        do {
            try session.updateApplicationContext(payload)
            DispatchQueue.main.async {
                self.lastSyncedAt = Date()
            }
        } catch {
            // Context update may fail cleanly on simulators without a paired watch.
        }

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    private func refreshSessionState(_ session: WCSession) {
        DispatchQueue.main.async {
            self.activationState = session.activationState
            self.isReachable = session.isReachable
            #if os(iOS)
            self.isPaired = session.isPaired
            self.isWatchAppInstalled = session.isWatchAppInstalled
            #endif
        }
    }

    private func handleIncomingPayload(_ payload: [String: Any]) {
        guard let parsed = GravitySyncConfig(dictionary: payload) else { return }
        parsed.save()
        DispatchQueue.main.async {
            self.latestRemoteConfig = parsed
            self.lastSyncedAt = Date()
            self.onRemoteConfigReceived?(parsed)
        }
    }
}

extension WatchSessionManager: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        refreshSessionState(session)
        let received = session.receivedApplicationContext
        if !received.isEmpty {
            handleIncomingPayload(received)
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        refreshSessionState(session)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleIncomingPayload(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncomingPayload(message)
    }

    #if os(iOS)
    func sessionWatchStateDidChange(_ session: WCSession) {
        refreshSessionState(session)
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        refreshSessionState(session)
    }

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
        refreshSessionState(session)
    }
    #endif
}
