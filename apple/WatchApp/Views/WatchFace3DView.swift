import Combine
import SceneKit
import SwiftUI
import WatchKit

final class WatchFace3DController: ObservableObject {
    let scene: GravityScene3D
    private let motionManager = MotionManager3D()

    init(initialConfig: GravitySyncConfig) {
        let scene3d = GravityScene3D(config: initialConfig)
        self.scene = scene3d

        motionManager.onMotionUpdate = { [weak scene3d] gravity, userAcceleration in
            scene3d?.updateMotion(gravity: gravity, userAcceleration: userAcceleration)
        }
    }

    func startMotion() {
        motionManager.start()
    }

    func stopMotion() {
        motionManager.stop()
    }

    func setPaused(_ paused: Bool) {
        scene.isPaused = paused
    }

    func setLuminanceReduced(_ reduced: Bool) {
        scene.setLuminanceReduced(reduced)
    }

    func applyConfiguration(_ config: GravitySyncConfig) {
        scene.applyConfiguration(config)
    }

    func simulateTilt(gx: Float, gy: Float) {
        let len = max(sqrtf(gx * gx + gy * gy + 0.68 * 0.68), 0.001)
        scene.updateMotion(
            gravity: SCNVector3(gx / len, gy / len, -0.68 / len),
            userAcceleration: SCNVector3(0, 0, 0)
        )
    }

    func shake() {
        scene.applyShakeImpulse()
    }
}

struct WatchFace3DView: View {
    @State private var config: GravitySyncConfig
    @StateObject private var controller: WatchFace3DController
    @ObservedObject private var sessionManager = WatchSessionManager.shared

    @State private var isShowingSettings = false
    @State private var isApplyingRemoteSync = false
    @State private var crownScroll: Double = 0.0
    @State private var lastCrownStep: Int = 0

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    init() {
        let initial = GravitySyncConfig.load()
        _config = State(initialValue: initial)
        _controller = StateObject(wrappedValue: WatchFace3DController(initialConfig: initial))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geometry in
                SceneView(
                    scene: controller.scene,
                    pointOfView: controller.scene.cameraNode,
                    options: [],
                    preferredFramesPerSecond: 60
                )
                #if targetEnvironment(simulator)
                .gesture(
                    DragGesture(minimumDistance: 6)
                        .onChanged { value in
                            let size = geometry.size
                            guard size.width > 0, size.height > 0 else { return }
                            let rawX = Float((value.location.x / size.width - 0.5) * 2.0)
                            let rawY = Float((0.5 - value.location.y / size.height) * 2.0)
                            let len = max(sqrtf(rawX * rawX + rawY * rawY), 0.001)
                            let clamped = min(len, 1.0)
                            controller.simulateTilt(
                                gx: (rawX / len) * clamped,
                                gy: (rawY / len) * clamped
                            )
                        }
                )
                #endif
            }
            .ignoresSafeArea()

            // Subtle flush 2.5D sapphire crystal surface sheen
            LinearGradient(
                stops: [
                    .init(color: .white.opacity(0.055), location: 0.0),
                    .init(color: .clear, location: 0.42),
                    .init(color: .clear, location: 0.78),
                    .init(color: .white.opacity(0.02), location: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            WatchClockOverlayView(config: config)

            if !isLuminanceReduced {
                Button {
                    WKInterfaceDevice.current().play(.click)
                    isShowingSettings = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.92))
                        .frame(width: 28, height: 28)
                        .background(.ultraThinMaterial, in: Circle())
                        .overlay(
                            Circle()
                                .strokeBorder(.white.opacity(0.20), lineWidth: 0.75)
                        )
                }
                .buttonStyle(.plain)
                .padding(.bottom, 4)
                .accessibilityLabel("切换 3D 场景")
            }
        }
        .contentShape(Rectangle())
        .focusable(!isShowingSettings)
        .digitalCrownRotation($crownScroll)
        .onChange(of: crownScroll) { _, newValue in
            guard !isShowingSettings, !isLuminanceReduced else { return }
            let nextStep = Int((newValue / 1.4).rounded(.towardZero))
            guard nextStep != lastCrownStep else { return }
            let delta = nextStep - lastCrownStep
            lastCrownStep = nextStep
            let themes = WatchFaceTheme.allCases
            if let currentIdx = themes.firstIndex(of: config.theme) {
                let targetIdx = (currentIdx + delta % themes.count + themes.count) % themes.count
                config.theme = themes[targetIdx]
                WKInterfaceDevice.current().play(.click)
            }
        }
        .onTapGesture(count: 2) {
            guard !isLuminanceReduced else { return }
            WKInterfaceDevice.current().play(.click)
            controller.shake()
        }
        .onLongPressGesture(minimumDuration: 0.45) {
            WKInterfaceDevice.current().play(.click)
            isShowingSettings = true
        }
        .toolbar(.hidden, for: .automatic)
        .onAppear {
            sessionManager.activate()
            sessionManager.onRemoteConfigReceived = { incoming in
                if incoming != config && incoming.updatedAt > config.updatedAt + 0.001 {
                    isApplyingRemoteSync = true
                    config = incoming
                    controller.applyConfiguration(incoming)
                }
            }
            controller.applyConfiguration(config)
            controller.setLuminanceReduced(isLuminanceReduced)
            if scenePhase == .active && !isLuminanceReduced {
                controller.startMotion()
            }
        }
        .onDisappear {
            controller.stopMotion()
        }
        .onChange(of: isLuminanceReduced) { _, reduced in
            controller.setLuminanceReduced(reduced)
            if reduced {
                controller.stopMotion()
                controller.setPaused(true)
            } else if scenePhase == .active {
                controller.setPaused(false)
                controller.startMotion()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                if !isLuminanceReduced {
                    controller.setPaused(false)
                    controller.startMotion()
                }
            case .inactive:
                controller.stopMotion()
            case .background:
                controller.stopMotion()
                controller.setPaused(true)
            @unknown default:
                break
            }
        }
        .onChange(of: config) { _, newValue in
            if isApplyingRemoteSync {
                isApplyingRemoteSync = false
                return
            }
            var stamped = newValue
            stamped.updatedAt = Date().timeIntervalSince1970
            stamped.save()
            controller.applyConfiguration(stamped)
            sessionManager.sendConfiguration(stamped)
        }
        .sheet(isPresented: $isShowingSettings) {
            ThemeSettingsView(config: $config) {
                controller.shake()
            }
        }
    }
}
